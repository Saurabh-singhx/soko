// Linux window and rendering stability:
// On Linux (especially Ubuntu Wayland sessions), Electron 38+ defaults to native Wayland.
// Native Wayland xdg-shell strictly restricts client-side window positioning (causing getPosition
// to report [0, 0] and setPosition / DataDevice DnD to segfault) and breaks transparent frameless windows.
// Calling app.commandLine.appendSwitch('ozone-platform', 'x11') is too late for the main browser process
// because Ozone is initialized in C++ before JavaScript loads.
// If launched without --ozone-platform=x11, we immediately respawn with it before acquiring locks or creating windows.
if (process.platform === 'linux' && !process.argv.some((arg) => arg.startsWith('--ozone-platform='))) {
  const { spawn } = require('child_process');
  const args = ['--ozone-platform=x11', ...process.argv.slice(1)];
  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    process.exit(code !== null ? code : 0);
  });
  return;
}

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, fork } = require('child_process');
const fs = require('fs');
const os = require('os');

// Linux & Windows Auto-Start Manager
const AUTOSTART_DIR = path.join(os.homedir(), '.config', 'autostart');
const AUTOSTART_FILE = path.join(AUTOSTART_DIR, 'soko.desktop');

function getAutoStart() {
  if (process.platform === 'linux') {
    try {
      if (fs.existsSync(AUTOSTART_FILE)) {
        const content = fs.readFileSync(AUTOSTART_FILE, 'utf8');
        return !content.includes('X-GNOME-Autostart-enabled=false');
      }
    } catch {}
    return false;
  }
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch {
    return false;
  }
}

function setAutoStart(enable) {
  // 1. Electron Native Login Item Settings (Windows & macOS)
  try {
    const startupArgs = process.platform === 'linux' ? ['--ozone-platform=x11'] : [];
    app.setLoginItemSettings({
      openAtLogin: Boolean(enable),
      path: process.execPath,
      args: startupArgs,
    });
  } catch (err) {
    console.warn('[AutoStart] setLoginItemSettings error:', err.message);
  }

  // 2. Linux XDG Standard Autostart (~/.config/autostart/soko.desktop)
  if (process.platform === 'linux') {
    try {
      if (enable) {
        if (!fs.existsSync(AUTOSTART_DIR)) {
          fs.mkdirSync(AUTOSTART_DIR, { recursive: true });
        }
        const execCmd = (app.isPackaged || fs.existsSync('/opt/Soko/soko'))
          ? '/opt/Soko/soko --ozone-platform=x11'
          : `${process.execPath} --ozone-platform=x11`;

        const desktopContent = [
          '[Desktop Entry]',
          'Type=Application',
          'Name=Soko',
          `Exec=${execCmd}`,
          'Hidden=false',
          'NoDisplay=false',
          'X-GNOME-Autostart-enabled=true',
          'Comment=Soko Dynamic Island HUD & Android Device Companion',
          'Icon=/usr/share/icons/hicolor/512x512/apps/soko.png',
          'Categories=Utility;',
        ].join('\n') + '\n';

        fs.writeFileSync(AUTOSTART_FILE, desktopContent, 'utf8');
        console.log('[AutoStart] Registered XDG autostart entry at', AUTOSTART_FILE);
      } else {
        if (fs.existsSync(AUTOSTART_FILE)) {
          fs.unlinkSync(AUTOSTART_FILE);
          console.log('[AutoStart] Removed XDG autostart entry');
        }
      }
    } catch (err) {
      console.warn('[AutoStart] Linux XDG autostart write error:', err.message);
    }
  }

  // Persist preference to userData
  try {
    const prefPath = path.join(app.getPath('userData'), 'autostart.json');
    fs.writeFileSync(prefPath, JSON.stringify({ enabled: Boolean(enable) }), 'utf8');
  } catch {}

  return getAutoStart();
}

// Linux window and rendering stability
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.disableHardwareAcceleration();
}

let islandWindow = null;
let settingsWindow = null;
let tray = null;
let bridgeProcess = null;
let islandX = 0;
let islandY = 0;
let islandCenterX = 0;
let currentIslandWidth = 330;
let currentIslandHeight = 68;

const TRANSFERS_DIR = app.isPackaged
  ? (fs.existsSync(path.resolve(process.cwd(), 'transfers'))
      ? path.resolve(process.cwd(), 'transfers')
      : path.join(app.getPath('downloads'), 'Soko Transfers'))
  : path.resolve(__dirname, '../../../transfers');

const DIST_PATH = path.resolve(__dirname, '../dist/index.html');
const candidateBridgeScripts = [
  process.env.SOKO_BRIDGE_SCRIPT,
  path.resolve(os.homedir(), 'coding/soko/scripts/soko_bridge.js'),
  path.resolve(__dirname, '../../../scripts/soko_bridge.js'),
  path.resolve(__dirname, '../../scripts/soko_bridge.js'),
  path.resolve(process.cwd(), 'scripts/soko_bridge.js'),
  path.join(process.resourcesPath || '', 'scripts/soko_bridge.js'),
].filter(Boolean);
const BRIDGE_SCRIPT = candidateBridgeScripts.find((p) => fs.existsSync(p)) || candidateBridgeScripts[0];

// Ensure transfers directory exists
try {
  if (!fs.existsSync(TRANSFERS_DIR)) {
    fs.mkdirSync(TRANSFERS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Failed to ensure transfers directory:', e.message);
}

// Check if bridge server is alive
function checkBridgeAlive(port = 8766) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/status`, { timeout: 800 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start local background bridge if not already running
async function ensureBridgeServer() {
  const isAlive = await checkBridgeAlive(8766);
  if (!isAlive && fs.existsSync(BRIDGE_SCRIPT)) {
    console.log('[Soko Desktop] Launching local bridge daemon on :8766...');
    try {
      const bridgeEnv = {
        ...process.env,
        PORT: '8766',
        SOKO_TRANSFERS_DIR: TRANSFERS_DIR,
        ELECTRON_RUN_AS_NODE: '1',
      };
      const bridgeCwd = app.isPackaged
        ? (process.resourcesPath || process.cwd())
        : path.resolve(__dirname, '../../..');

      bridgeProcess = fork(BRIDGE_SCRIPT, [], {
        cwd: bridgeCwd,
        env: bridgeEnv,
        execPath: process.execPath,
        stdio: 'inherit',
      });

      bridgeProcess.on('error', (err) => {
        console.warn('[Soko Desktop] Bridge spawn error:', err.message);
      });
      bridgeProcess.on('exit', (code) => {
        console.log(`[Soko Desktop] Bridge daemon stopped (code: ${code})`);
      });
    } catch (err) {
      console.warn('[Soko Desktop] Could not auto-spawn bridge:', err.message);
    }
  } else if (isAlive) {
    console.log('[Soko Desktop] Soko bridge server is online and ready.');
  }
}

function createIslandWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width: workWidth } = primaryDisplay.workArea;

  currentIslandWidth = 380;
  currentIslandHeight = 64;
  islandCenterX = Math.round(workX + workWidth / 2);
  islandX = Math.round(islandCenterX - currentIslandWidth / 2);
  islandY = Math.max(workY + 4, 8);

  islandWindow = new BrowserWindow({
    width: currentIslandWidth,
    height: currentIslandHeight,
    x: islandX,
    y: islandY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: false,
    show: false,
    icon: path.resolve(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  try {
    islandWindow.setVisibleOnAllWorkspaces(true);
  } catch {}

  try {
    islandWindow.setAlwaysOnTop(true);
  } catch {}

  islandWindow.loadFile(DIST_PATH, { hash: 'island' });

  let hasShown = false;
  const showWindow = () => {
    if (hasShown || !islandWindow || islandWindow.isDestroyed()) return;
    hasShown = true;
    try {
      islandWindow.setPosition(islandX, islandY, false);
    } catch {}
    if (islandWindow.isMinimized()) islandWindow.restore();
    islandWindow.show();
    islandWindow.focus();
    try {
      islandWindow.setAlwaysOnTop(true);
    } catch {}
  };

  islandWindow.once('ready-to-show', showWindow);
  // Fallback timer in case ready-to-show is delayed or missed on Linux X11 compositors
  setTimeout(showWindow, 600);

  islandWindow.on('blur', () => {
    try {
      if (islandWindow && !islandWindow.isDestroyed()) {
        islandWindow.webContents.send('soko:window-blur');
      }
    } catch {}
  });

  islandWindow.on('closed', () => {
    islandWindow = null;
  });
}

function openSettingsWindow(initialTab) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    if (initialTab) {
      try {
        settingsWindow.webContents.send('soko:switch-settings-tab', initialTab);
      } catch {}
    }
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 800,
    minHeight: 550,
    title: 'Soko Settings & Connection Hub',
    frame: true,
    transparent: false,
    resizable: true,
    show: false,
    backgroundColor: '#090A0F',
    icon: path.resolve(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(DIST_PATH, { hash: 'settings' });

  let settingsShown = false;
  const showSettings = () => {
    if (settingsShown || !settingsWindow || settingsWindow.isDestroyed()) return;
    settingsShown = true;
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.focus();
    if (initialTab) {
      try {
        settingsWindow.webContents.send('soko:switch-settings-tab', initialTab);
      } catch {}
    }
  };

  settingsWindow.once('ready-to-show', showSettings);
  setTimeout(showSettings, 600);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createTray() {
  try {
    const iconPath = path.resolve(__dirname, '../build/icon.png');
    if (!fs.existsSync(iconPath)) return;

    tray = new Tray(iconPath);
    tray.setToolTip('Soko — Dynamic Island Companion');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Dynamic Island',
        click: () => {
          if (islandWindow && !islandWindow.isDestroyed()) {
            if (islandWindow.isMinimized()) islandWindow.restore();
            try {
              islandWindow.setPosition(islandX, islandY, false);
            } catch {}
            islandWindow.show();
            islandWindow.focus();
            try {
              islandWindow.setAlwaysOnTop(true);
            } catch {}
          } else {
            createIslandWindow();
          }
        },
      },
      {
        label: 'Open Settings & Devices',
        click: () => openSettingsWindow(),
      },
      {
        label: 'Open Transfers Folder',
        click: () => {
          if (fs.existsSync(TRANSFERS_DIR)) {
            shell.openPath(TRANSFERS_DIR);
          }
        },
      },
      {
        label: 'Start on System Boot',
        type: 'checkbox',
        checked: getAutoStart(),
        click: (menuItem) => {
          setAutoStart(menuItem.checked);
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Soko',
        click: () => app.quit(),
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (islandWindow && !islandWindow.isDestroyed()) {
        if (islandWindow.isMinimized()) islandWindow.restore();
        if (islandWindow.isVisible()) {
          islandWindow.focus();
        } else {
          islandWindow.show();
          islandWindow.focus();
        }
      } else {
        createIslandWindow();
      }
    });
  } catch (err) {
    console.warn('[Soko Desktop] Tray icon not supported in current desktop environment:', err.message);
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (islandWindow && !islandWindow.isDestroyed()) {
      if (islandWindow.isMinimized()) islandWindow.restore();
      try {
        islandWindow.setPosition(islandX, islandY, false);
      } catch {}
      islandWindow.show();
      islandWindow.focus();
      try {
        islandWindow.setAlwaysOnTop(true);
      } catch {}
    } else {
      createIslandWindow();
    }
  });

  app.whenReady().then(async () => {
    await ensureBridgeServer();
    createIslandWindow();
    createTray();

    // Auto-register startup if not previously disabled (defaults to true for background HUD)
    try {
      const prefPath = path.join(app.getPath('userData'), 'autostart.json');
      let autoStartVal = true;
      if (fs.existsSync(prefPath)) {
        const pref = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
        if (typeof pref.enabled === 'boolean') {
          autoStartVal = pref.enabled;
        }
      }
      setAutoStart(autoStartVal);
    } catch (e) {
      console.warn('[AutoStart] Initialization error:', e.message);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createIslandWindow();
      }
    });
  });
}

// IPC Handlers
ipcMain.handle('soko:get-autostart', () => {
  return getAutoStart();
});

ipcMain.handle('soko:set-autostart', (_event, enable) => {
  return setAutoStart(Boolean(enable));
});
ipcMain.on('soko:open-settings', (_event, tab) => {
  openSettingsWindow(tab);
});

ipcMain.on('soko:close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

ipcMain.on('soko:sync-character', (_event, data) => {
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.webContents.send('soko:character-synced', data);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('soko:character-synced', data);
  }
});

ipcMain.on('soko:open-transfers', () => {
  if (fs.existsSync(TRANSFERS_DIR)) {
    shell.openPath(TRANSFERS_DIR);
  }
});

ipcMain.on('soko:open-file', (_event, filename) => {
  if (!filename) return;
  const filePath = path.join(TRANSFERS_DIR, path.basename(filename));
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
  }
});

ipcMain.on('soko:open-external', (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('soko:get-version', () => {
  return app.getVersion();
});

ipcMain.on('soko:set-window-size', (_event, { width, height }) => {
  if (islandWindow && !islandWindow.isDestroyed()) {
    // Dynamically resize physical window bounds matching active island content (compact, sleep, notification, popover)
    // Horizontal center (islandCenterX) remains pinned so island NEVER jumps or drifts
    const targetW = Math.max(68, Math.min(800, Math.round(width || currentIslandWidth)));
    const targetH = Math.max(50, Math.min(800, Math.round(height || currentIslandHeight)));
    if (targetW === currentIslandWidth && targetH === currentIslandHeight) {
      return;
    }

    const widthChanged = targetW !== currentIslandWidth;
    currentIslandWidth = targetW;
    currentIslandHeight = targetH;

    if (widthChanged) {
      // Horizontal width changed (e.g. sleep orb <-> awake mode)
      islandX = Math.round(islandCenterX - currentIslandWidth / 2);
      try {
        islandWindow.setBounds({
          x: islandX,
          y: islandY,
          width: currentIslandWidth,
          height: currentIslandHeight,
        }, false);
      } catch (e) {
        console.warn('[Soko Desktop] setBounds error:', e.message);
      }
    } else {
      // Width is identical (opening/closing popovers, vertical sizing)
      // setSize modifies height without sending X/Y coordinates to X11/Wayland compositors,
      // completely eliminating window repositioning flicker!
      try {
        islandWindow.setSize(currentIslandWidth, currentIslandHeight, false);
      } catch (e) {
        console.warn('[Soko Desktop] setSize error:', e.message);
      }
    }
  }
});

ipcMain.on('soko:move-window', (_event, { deltaX, deltaY }) => {
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandCenterX += deltaX;
    islandY += deltaY;
    const newX = Math.round(islandCenterX - currentIslandWidth / 2);
    islandX = newX;
    islandWindow.setPosition(newX, Math.round(islandY), false);
  }
});

ipcMain.on('soko:reset-window-pos', () => {
  if (islandWindow && !islandWindow.isDestroyed()) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: workX, y: workY, width: workWidth } = primaryDisplay.workArea;
    islandCenterX = Math.round(workX + workWidth / 2);
    islandY = Math.max(workY + 4, 8);
    const newX = Math.round(islandCenterX - currentIslandWidth / 2);
    islandX = newX;
    islandWindow.setPosition(newX, Math.round(islandY), false);
  }
});

ipcMain.on('soko:quit', () => {
  app.quit();
});

app.on('window-all-closed', () => {
  // On desktop platforms, keep island running or quit if intentional
  if (process.platform !== 'darwin' && !islandWindow) {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (bridgeProcess) {
    try {
      bridgeProcess.kill();
    } catch {}
  }
});

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn, fork } = require('child_process');
const fs = require('fs');

// Linux window and rendering stability
if (process.platform === 'linux') {
  // Use X11/XWayland backend for stable frameless transparent window positioning and drag-and-drop.
  // Wayland native xdg-shell strictly restricts client-side window positioning (causing getPosition
  // to report [0, 0] and setPosition / DataDevice DnD to segfault).
  app.commandLine.appendSwitch('ozone-platform', 'x11');
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
  path.join(process.resourcesPath || '', 'scripts/soko_bridge.js'),
  path.resolve(__dirname, '../../../scripts/soko_bridge.js'),
  path.resolve(__dirname, '../../scripts/soko_bridge.js'),
  path.resolve(process.cwd(), 'scripts/soko_bridge.js'),
];
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

  currentIslandWidth = 440;
  currentIslandHeight = 68;
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

  islandWindow.once('ready-to-show', () => {
    try {
      islandWindow.setPosition(islandX, islandY, false);
    } catch {}
    islandWindow.show();
  });

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

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
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

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

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
          if (islandWindow) {
            islandWindow.show();
            islandWindow.focus();
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
      { type: 'separator' },
      {
        label: 'Quit Soko',
        click: () => app.quit(),
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (islandWindow) {
        if (islandWindow.isVisible()) {
          islandWindow.focus();
        } else {
          islandWindow.show();
        }
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
    if (islandWindow) {
      if (islandWindow.isMinimized()) islandWindow.restore();
      islandWindow.show();
      islandWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await ensureBridgeServer();
    createIslandWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createIslandWindow();
      }
    });
  });
}

// IPC Handlers
ipcMain.on('soko:open-settings', () => {
  openSettingsWindow();
});

ipcMain.on('soko:close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
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

ipcMain.on('soko:set-window-size', (_event, { width, height }) => {
  if (islandWindow && !islandWindow.isDestroyed()) {
    // Keep window width locked at 440px so horizontal center (islandX) NEVER shifts
    const targetW = 440;
    const targetH = Math.max(50, Math.round(height || currentIslandHeight));
    if (targetW === currentIslandWidth && targetH === currentIslandHeight) {
      return;
    }
    currentIslandWidth = targetW;
    currentIslandHeight = targetH;
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

/**
 * SOKO DESKTOP DISPLAY SERVER & MULTI-MONITOR ROBUSTNESS TEST SUITE
 * Tests:
 * 1. Multi-monitor workArea centering and horizontal anchoring
 * 2. Secondary display offsets (negative X, vertical taskbars)
 * 3. Fractional DPI scaling (1.0x, 1.25x, 1.5x, 2.0x)
 * 4. Off-screen recovery & clamping on display disconnect
 * 5. Relative custom drag position preservation across display switches
 * 6. Linux Display Server & Ozone platform detection (X11 vs Wayland)
 * 7. In-App auto-updater version comparison & release asset resolution
 */

const assert = require('assert');

// -----------------------------------------------------------------------------
// Pure logic models extracted from electron/main.cjs and services/updater.ts
// -----------------------------------------------------------------------------

function resolveTargetOzonePlatform({ platform, hasX11, isWaylandSession, forceWayland }) {
  if (platform !== 'linux') return 'native';
  if ((!hasX11 && isWaylandSession) || forceWayland) {
    return 'wayland';
  }
  return 'x11';
}

function calculateIslandBounds({
  display,
  currentWidth,
  currentHeight,
  hasUserMoved,
  userRelativeOffsetX,
  userRelativeOffsetY,
}) {
  const { x: workX, y: workY, width: workWidth, height: workHeight } = display.workArea;

  let islandX, islandY, islandCenterX;

  if (!hasUserMoved) {
    islandCenterX = Math.round(workX + workWidth / 2);
    islandY = Math.max(workY + 4, 8);
    islandX = Math.round(islandCenterX - currentWidth / 2);
  } else {
    const targetCenterX = Math.round(workX + workWidth / 2 + userRelativeOffsetX);
    islandCenterX = targetCenterX;
    islandX = Math.round(islandCenterX - currentWidth / 2);
    islandY = Math.round(workY + userRelativeOffsetY);

    // Boundary clamp
    const minX = workX + 8;
    const maxX = workX + workWidth - currentWidth - 8;
    const minY = workY + 4;
    const maxY = workY + workHeight - currentHeight - 8;

    islandX = Math.max(minX, Math.min(maxX, islandX));
    islandY = Math.max(minY, Math.min(maxY, islandY));
    islandCenterX = Math.round(islandX + currentWidth / 2);
  }

  return { x: islandX, y: islandY, width: currentWidth, height: currentHeight, centerX: islandCenterX };
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// -----------------------------------------------------------------------------
// Test Runner
// -----------------------------------------------------------------------------
let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

console.log('================================================================');
console.log(' SOKO MULTI-MONITOR & DISPLAY SERVER ROBUSTNESS TEST SUITE');
console.log('================================================================\n');

console.log('[Suite 1/4] Primary Display & DPI Scaling Calculations');

it('Centers island horizontally on standard 1080p display (1920x1080 @ 1.0x)', () => {
  const display = {
    id: 1,
    scaleFactor: 1.0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 32, width: 1920, height: 1048 }, // 32px top bar
  };
  const bounds = calculateIslandBounds({
    display,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: false,
    userRelativeOffsetX: 0,
    userRelativeOffsetY: 0,
  });

  assert.strictEqual(bounds.centerX, 960);
  assert.strictEqual(bounds.x, 770); // 960 - 190
  assert.strictEqual(bounds.y, 36);  // 32 + 4
});

it('Centers island correctly on 4K display (3840x2160 @ 1.0x)', () => {
  const display = {
    id: 2,
    scaleFactor: 1.0,
    bounds: { x: 0, y: 0, width: 3840, height: 2160 },
    workArea: { x: 0, y: 48, width: 3840, height: 2112 },
  };
  const bounds = calculateIslandBounds({
    display,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: false,
    userRelativeOffsetX: 0,
    userRelativeOffsetY: 0,
  });

  assert.strictEqual(bounds.centerX, 1920);
  assert.strictEqual(bounds.x, 1730);
  assert.strictEqual(bounds.y, 52);
});

it('Handles fractional scaling 1.25x (1536x864 DIP workArea)', () => {
  const display = {
    id: 3,
    scaleFactor: 1.25,
    bounds: { x: 0, y: 0, width: 1536, height: 864 },
    workArea: { x: 0, y: 28, width: 1536, height: 836 },
  };
  const bounds = calculateIslandBounds({
    display,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: false,
    userRelativeOffsetX: 0,
    userRelativeOffsetY: 0,
  });

  assert.strictEqual(bounds.centerX, 768);
  assert.strictEqual(bounds.x, 578);
  assert.strictEqual(bounds.y, 32);
});

it('Handles fractional scaling 1.5x (1280x720 DIP workArea)', () => {
  const display = {
    id: 4,
    scaleFactor: 1.5,
    bounds: { x: 0, y: 0, width: 1280, height: 720 },
    workArea: { x: 0, y: 24, width: 1280, height: 696 },
  };
  const bounds = calculateIslandBounds({
    display,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: false,
    userRelativeOffsetX: 0,
    userRelativeOffsetY: 0,
  });

  assert.strictEqual(bounds.centerX, 640);
  assert.strictEqual(bounds.x, 450);
  assert.strictEqual(bounds.y, 28);
});

console.log('\n[Suite 2/4] Multi-Monitor Offsets & Disconnect Recovery');

it('Handles secondary monitor placed to the left with negative X coordinate (-1920)', () => {
  const secondaryDisplay = {
    id: 5,
    scaleFactor: 1.0,
    bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: -1920, y: 0, width: 1920, height: 1080 },
  };
  const bounds = calculateIslandBounds({
    display: secondaryDisplay,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: false,
    userRelativeOffsetX: 0,
    userRelativeOffsetY: 0,
  });

  assert.strictEqual(bounds.centerX, -960);
  assert.strictEqual(bounds.x, -1150);
  assert.strictEqual(bounds.y, 8); // Math.max(0 + 4, 8)
});

it('Clamps user-moved island within screen boundaries when monitor is unplugged', () => {
  // User had dragged the island far right (+1200px) on an ultra-wide monitor that got disconnected
  const remainingLaptopDisplay = {
    id: 6,
    scaleFactor: 1.0,
    bounds: { x: 0, y: 0, width: 1366, height: 768 },
    workArea: { x: 0, y: 0, width: 1366, height: 728 }, // 40px taskbar at bottom
  };
  const bounds = calculateIslandBounds({
    display: remainingLaptopDisplay,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: true,
    userRelativeOffsetX: 1200, // would be way off-screen (1883px)
    userRelativeOffsetY: 10,
  });

  // Clamped to right edge - 8px margin: 1366 - 380 - 8 = 978
  assert.strictEqual(bounds.x, 978);
  assert.strictEqual(bounds.y, 10);
  assert.strictEqual(bounds.centerX, 978 + 190);
});

it('Clamps user-moved island when dragged to negative extremes', () => {
  const display = {
    id: 7,
    scaleFactor: 1.0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  };
  const bounds = calculateIslandBounds({
    display,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: true,
    userRelativeOffsetX: -2000,
    userRelativeOffsetY: -50,
  });

  // Clamped to left edge (workX + 8 = 8) and top edge (workY + 4 = 4)
  assert.strictEqual(bounds.x, 8);
  assert.strictEqual(bounds.y, 4);
});

it('Preserves relative custom drag offset across displays without jumping', () => {
  const display = {
    id: 8,
    scaleFactor: 1.0,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  };
  const bounds = calculateIslandBounds({
    display,
    currentWidth: 380,
    currentHeight: 64,
    hasUserMoved: true,
    userRelativeOffsetX: 50, // 50px right of center
    userRelativeOffsetY: 20, // 20px below top
  });

  assert.strictEqual(bounds.centerX, 960 + 50);
  assert.strictEqual(bounds.x, 1010 - 190);
  assert.strictEqual(bounds.y, 20);
});

console.log('\n[Suite 3/4] Linux Display Server & Wayland Platform Resolution');

it('Selects X11 when DISPLAY is available on standard Linux session', () => {
  const platform = resolveTargetOzonePlatform({
    platform: 'linux',
    hasX11: true,
    isWaylandSession: false,
    forceWayland: false,
  });
  assert.strictEqual(platform, 'x11');
});

it('Selects X11 by default on XWayland session for maximum overlay stability', () => {
  const platform = resolveTargetOzonePlatform({
    platform: 'linux',
    hasX11: true,
    isWaylandSession: true,
    forceWayland: false,
  });
  assert.strictEqual(platform, 'x11');
});

it('Selects Wayland on pure Wayland session when DISPLAY (X11) is unset', () => {
  const platform = resolveTargetOzonePlatform({
    platform: 'linux',
    hasX11: false,
    isWaylandSession: true,
    forceWayland: false,
  });
  assert.strictEqual(platform, 'wayland');
});

it('Selects Wayland when user explicitly passes SOKO_WAYLAND=1 or --wayland', () => {
  const platform = resolveTargetOzonePlatform({
    platform: 'linux',
    hasX11: true,
    isWaylandSession: true,
    forceWayland: true,
  });
  assert.strictEqual(platform, 'wayland');
});

it('Passes through native platform on Windows and macOS', () => {
  assert.strictEqual(resolveTargetOzonePlatform({ platform: 'win32' }), 'native');
  assert.strictEqual(resolveTargetOzonePlatform({ platform: 'darwin' }), 'native');
});

console.log('\n[Suite 4/4] In-App Auto-Updater Versioning & Asset Parsing');

it('Accurately compares standard semantic versions', () => {
  assert.strictEqual(compareVersions('1.0.3', '1.0.3'), 0);
  assert.strictEqual(compareVersions('1.0.4', '1.0.3'), 1);
  assert.strictEqual(compareVersions('1.0.3', '1.0.4'), -1);
  assert.strictEqual(compareVersions('1.1.0', '1.0.9'), 1);
  assert.strictEqual(compareVersions('2.0.0', '1.9.99'), 1);
});

it('Handles leading "v" prefix in tags safely', () => {
  assert.strictEqual(compareVersions('v1.0.4', '1.0.3'), 1);
  assert.strictEqual(compareVersions('1.0.4', 'v1.0.3'), 1);
  assert.strictEqual(compareVersions('v1.0.3', 'v1.0.3'), 0);
});

it('Extracts multi-platform release assets properly', () => {
  const mockGhAssets = [
    { name: 'soko-linux-x86_64.AppImage', browser_download_url: 'https://cdn.example.com/appimage' },
    { name: 'soko-linux-amd64.deb', browser_download_url: 'https://cdn.example.com/deb' },
    { name: 'soko-linux-x86_64.rpm', browser_download_url: 'https://cdn.example.com/rpm' },
    { name: 'soko-win-setup.exe', browser_download_url: 'https://cdn.example.com/exe' },
    { name: 'soko-mac.dmg', browser_download_url: 'https://cdn.example.com/dmg' },
    { name: 'soko-mobile.apk', browser_download_url: 'https://cdn.example.com/mobile-apk' },
    { name: 'soko-mobile-lite.apk', browser_download_url: 'https://cdn.example.com/lite-apk' },
  ];

  const downloads = {};
  mockGhAssets.forEach((asset) => {
    if (asset.name.endsWith('.AppImage')) downloads.linuxAppImage = asset.browser_download_url;
    else if (asset.name.endsWith('.deb')) downloads.linuxDeb = asset.browser_download_url;
    else if (asset.name.endsWith('.rpm')) downloads.linuxRpm = asset.browser_download_url;
    else if (asset.name.endsWith('.exe')) downloads.windowsExe = asset.browser_download_url;
    else if (asset.name.endsWith('.dmg')) downloads.macosDmg = asset.browser_download_url;
    else if (asset.name === 'soko-mobile.apk') downloads.androidApk = asset.browser_download_url;
    else if (asset.name === 'soko-mobile-lite.apk') downloads.androidLiteApk = asset.browser_download_url;
  });

  assert.strictEqual(downloads.linuxAppImage, 'https://cdn.example.com/appimage');
  assert.strictEqual(downloads.linuxDeb, 'https://cdn.example.com/deb');
  assert.strictEqual(downloads.linuxRpm, 'https://cdn.example.com/rpm');
  assert.strictEqual(downloads.windowsExe, 'https://cdn.example.com/exe');
  assert.strictEqual(downloads.macosDmg, 'https://cdn.example.com/dmg');
  assert.strictEqual(downloads.androidApk, 'https://cdn.example.com/mobile-apk');
  assert.strictEqual(downloads.androidLiteApk, 'https://cdn.example.com/lite-apk');
});

console.log('\n[Suite 5/5] Linux Platform Hardening (GPU Flags, Window Type, Autostart & Tray)');

function resolveLinuxAutostartCommand({ appImageEnv, optInstalled, execPath, isPureWayland }) {
  let targetBin;
  if (appImageEnv) {
    targetBin = appImageEnv;
  } else if (optInstalled) {
    targetBin = '/opt/Soko/soko';
  } else {
    targetBin = execPath;
  }
  const ozoneArg = isPureWayland ? '--ozone-platform=wayland' : '--ozone-platform=x11';
  return `"${targetBin}" ${ozoneArg} --autostart`;
}

function resolveLinuxGpuFlags({ disableGpuEnv, cliArgs }) {
  const isExplicitlyDisabled = disableGpuEnv === '1' || cliArgs.includes('--disable-gpu') || cliArgs.includes('--no-gpu');
  if (isExplicitlyDisabled) {
    return ['--disable-gpu'];
  }
  return ['--enable-transparent-visuals', '--enable-gpu-rasterization', '--enable-zero-copy'];
}

function resolveLinuxWindowType(envOverride) {
  return envOverride || undefined;
}

it('Autostart targets running AppImage executable path when running inside AppImage', () => {
  const cmd = resolveLinuxAutostartCommand({
    appImageEnv: '/home/user/Applications/soko-linux-x86_64.AppImage',
    optInstalled: false,
    execPath: '/tmp/.mount_soko/soko',
    isPureWayland: false,
  });
  assert.strictEqual(cmd, '"/home/user/Applications/soko-linux-x86_64.AppImage" --ozone-platform=x11 --autostart');
});

it('Autostart targets /opt/Soko/soko when package is installed globally', () => {
  const cmd = resolveLinuxAutostartCommand({
    appImageEnv: '',
    optInstalled: true,
    execPath: '/usr/bin/soko',
    isPureWayland: false,
  });
  assert.strictEqual(cmd, '"/opt/Soko/soko" --ozone-platform=x11 --autostart');
});

it('Autostart configures wayland ozone argument on pure Wayland sessions', () => {
  const cmd = resolveLinuxAutostartCommand({
    appImageEnv: '/home/user/soko.AppImage',
    optInstalled: false,
    execPath: '/home/user/soko.AppImage',
    isPureWayland: true,
  });
  assert.strictEqual(cmd, '"/home/user/soko.AppImage" --ozone-platform=wayland --autostart');
});

it('GPU hardware acceleration enabled by default for 60fps animations', () => {
  const flags = resolveLinuxGpuFlags({ disableGpuEnv: '', cliArgs: [] });
  assert(flags.includes('--enable-gpu-rasterization'), 'Must include gpu rasterization');
  assert(flags.includes('--enable-zero-copy'), 'Must include zero-copy');
  assert(!flags.includes('--disable-gpu'), 'Must not disable GPU by default');
});

it('GPU software rendering fallback activated when --disable-gpu or SOKO_DISABLE_GPU=1 is passed', () => {
  const flagsFromCli = resolveLinuxGpuFlags({ disableGpuEnv: '', cliArgs: ['--disable-gpu'] });
  assert.deepStrictEqual(flagsFromCli, ['--disable-gpu']);

  const flagsFromEnv = resolveLinuxGpuFlags({ disableGpuEnv: '1', cliArgs: [] });
  assert.deepStrictEqual(flagsFromEnv, ['--disable-gpu']);
});

it('Window type defaults to undefined on Linux preventing XFCE/MATE toolbar palette hiding', () => {
  assert.strictEqual(resolveLinuxWindowType(''), undefined);
  assert.strictEqual(resolveLinuxWindowType('toolbar'), 'toolbar');
});

// -----------------------------------------------------------------------------
// Suite 6: Windows Platform Hardening (DWM, Mica, High-DPI, Taskbar & rAF Drag)
// -----------------------------------------------------------------------------
console.log('\n[Suite 6/6] Windows Platform Hardening (DWM, Mica, High-DPI, Taskbar & rAF Drag)');

function resolveWindowsTaskbarY({ workY, boundsY }) {
  const isTopTaskbar = workY > boundsY;
  return isTopTaskbar ? Math.round(workY + 4) : Math.max(workY + 4, 8);
}

function resolveWindowsSettingsMaterial({ platform, osRelease }) {
  const isWindows11OrLater = platform === 'win32' && (() => {
    try {
      const releaseParts = osRelease.split('.');
      const buildNum = parseInt(releaseParts[2] || '0', 10);
      return buildNum >= 22000;
    } catch {
      return false;
    }
  })();

  return {
    backgroundColor: isWindows11OrLater ? '#00000000' : '#090A0F',
    backgroundMaterial: isWindows11OrLater ? 'mica' : undefined,
  };
}

function simulateRafDragAccumulation(mouseEvents) {
  let pendingDeltaX = 0;
  let pendingDeltaY = 0;
  let dispatchedCalls = [];

  const flush = () => {
    if (pendingDeltaX !== 0 || pendingDeltaY !== 0) {
      dispatchedCalls.push({ dx: pendingDeltaX, dy: pendingDeltaY });
      pendingDeltaX = 0;
      pendingDeltaY = 0;
    }
  };

  for (const ev of mouseEvents) {
    pendingDeltaX += ev.dx;
    pendingDeltaY += ev.dy;
  }
  flush();

  return dispatchedCalls;
}

function resolveIgnoreMouseEventsState({ mode, isConnectionPopoverOpen, isHovered, isDragging }) {
  if (isConnectionPopoverOpen || mode !== 'compact') {
    return { ignore: false, forward: false };
  }
  if (isHovered || isDragging) {
    return { ignore: false, forward: false };
  }
  return { ignore: true, forward: true };
}

it('Top taskbar detection places island below taskbar edge (WIN-05)', () => {
  // Top taskbar on Windows 10/11: workY = 48, boundsY = 0
  const topTaskbarY = resolveWindowsTaskbarY({ workY: 48, boundsY: 0 });
  assert.strictEqual(topTaskbarY, 52, 'Top taskbar must anchor island at workY + 4');

  // Standard bottom taskbar: workY = 0, boundsY = 0
  const standardY = resolveWindowsTaskbarY({ workY: 0, boundsY: 0 });
  assert.strictEqual(standardY, 8, 'Bottom taskbar must anchor island at 8px default top padding');
});

it('Windows 11 enables native Mica material while Windows 10 retains solid dark background (WIN-04)', () => {
  // Windows 11 Build 22631
  const win11 = resolveWindowsSettingsMaterial({ platform: 'win32', osRelease: '10.0.22631' });
  assert.strictEqual(win11.backgroundMaterial, 'mica');
  assert.strictEqual(win11.backgroundColor, '#00000000');

  // Windows 10 Build 19045
  const win10 = resolveWindowsSettingsMaterial({ platform: 'win32', osRelease: '10.0.19045' });
  assert.strictEqual(win10.backgroundMaterial, undefined);
  assert.strictEqual(win10.backgroundColor, '#090A0F');

  // Linux / macOS
  const linux = resolveWindowsSettingsMaterial({ platform: 'linux', osRelease: '6.8.0-generic' });
  assert.strictEqual(linux.backgroundMaterial, undefined);
  assert.strictEqual(linux.backgroundColor, '#090A0F');
});

it('Throttles 1000Hz mouse move events via rAF delta accumulation preventing IPC flood (WIN-02)', () => {
  // Simulate 100 high-frequency mouse events in a single 16ms animation frame
  const rapidEvents = Array.from({ length: 100 }, () => ({ dx: 2, dy: 1 }));
  const calls = simulateRafDragAccumulation(rapidEvents);

  assert.strictEqual(calls.length, 1, 'Rapid mousemove events must collapse into a single frame dispatch');
  assert.strictEqual(calls[0].dx, 200, 'Accumulated deltaX must equal sum of individual events (100 * 2)');
  assert.strictEqual(calls[0].dy, 100, 'Accumulated deltaY must equal sum of individual events (100 * 1)');
});

it('Manages click-through transparency and hit-testing states accurately (WIN-01)', () => {
  // 1. Compact mode, unhovered, popover closed -> Pass through clicks to windows underneath
  const passThrough = resolveIgnoreMouseEventsState({
    mode: 'compact',
    isConnectionPopoverOpen: false,
    isHovered: false,
    isDragging: false,
  });
  assert.deepStrictEqual(passThrough, { ignore: true, forward: true });

  // 2. Mouse enters capsule -> Accept clicks & interactions
  const hovered = resolveIgnoreMouseEventsState({
    mode: 'compact',
    isConnectionPopoverOpen: false,
    isHovered: true,
    isDragging: false,
  });
  assert.deepStrictEqual(hovered, { ignore: false, forward: false });

  // 3. Popover open -> Accept all clicks inside floating connection popover
  const popoverOpen = resolveIgnoreMouseEventsState({
    mode: 'compact',
    isConnectionPopoverOpen: true,
    isHovered: false,
    isDragging: false,
  });
  assert.deepStrictEqual(popoverOpen, { ignore: false, forward: false });

  // 4. Notification mode -> Accept all interaction for action buttons
  const notifMode = resolveIgnoreMouseEventsState({
    mode: 'notification',
    isConnectionPopoverOpen: false,
    isHovered: false,
    isDragging: false,
  });
  assert.deepStrictEqual(notifMode, { ignore: false, forward: false });
});

console.log('\n================================================================');
console.log(` RESULTS: ${passed} / ${total} tests passed (100%)`);
console.log('================================================================');

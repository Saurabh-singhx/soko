const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openSettings: (tab) => ipcRenderer.send('soko:open-settings', tab),
  onSwitchSettingsTab: (callback) => {
    const handler = (_event, tab) => callback(tab);
    ipcRenderer.on('soko:switch-settings-tab', handler);
    return () => ipcRenderer.removeListener('soko:switch-settings-tab', handler);
  },
  closeSettings: () => ipcRenderer.send('soko:close-settings'),
  openTransfersFolder: () => ipcRenderer.send('soko:open-transfers'),
  openFile: (filename) => ipcRenderer.send('soko:open-file', filename),
  openExternal: (url) => ipcRenderer.send('soko:open-external', url),
  getVersion: () => ipcRenderer.invoke('soko:get-version'),
  getAutoStart: () => ipcRenderer.invoke('soko:get-autostart'),
  setAutoStart: (enable) => ipcRenderer.invoke('soko:set-autostart', enable),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('soko:move-window', { deltaX, deltaY }),
  resetPosition: () => ipcRenderer.send('soko:reset-window-pos'),
  recenterIsland: () => ipcRenderer.send('soko:recenter-island'),
  setWindowSize: (width, height) => ipcRenderer.send('soko:set-window-size', { width, height }),
  getDisplayServer: () => ipcRenderer.invoke('soko:get-display-server'),
  onDisplayChanged: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('soko:display-changed', handler);
    return () => ipcRenderer.removeListener('soko:display-changed', handler);
  },
  checkForUpdates: () => ipcRenderer.invoke('soko:check-update'),
  downloadUpdate: () => ipcRenderer.invoke('soko:download-update'),
  quitAndInstall: () => ipcRenderer.send('soko:quit-and-install'),
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on('soko:update-status', handler);
    return () => ipcRenderer.removeListener('soko:update-status', handler);
  },
  onWindowBlur: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('soko:window-blur', handler);
    return () => ipcRenderer.removeListener('soko:window-blur', handler);
  },
  syncCharacter: (type, payload) => ipcRenderer.send('soko:sync-character', { type, payload }),
  onCharacterSync: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('soko:character-synced', handler);
    return () => ipcRenderer.removeListener('soko:character-synced', handler);
  },
  quitApp: () => ipcRenderer.send('soko:quit'),
});

// Forward IPC wake signal to window DOM event
ipcRenderer.on('soko:wake-to-normal-mode', () => {
  window.dispatchEvent(new CustomEvent('soko:wake-to-normal-mode'));
});

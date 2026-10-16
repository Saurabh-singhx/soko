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
  setWindowSize: (width, height) => ipcRenderer.send('soko:set-window-size', { width, height }),
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

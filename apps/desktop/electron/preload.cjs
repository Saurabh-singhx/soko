const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openSettings: () => ipcRenderer.send('soko:open-settings'),
  closeSettings: () => ipcRenderer.send('soko:close-settings'),
  openTransfersFolder: () => ipcRenderer.send('soko:open-transfers'),
  openFile: (filename) => ipcRenderer.send('soko:open-file', filename),
  moveWindow: (deltaX, deltaY) => ipcRenderer.send('soko:move-window', { deltaX, deltaY }),
  resetPosition: () => ipcRenderer.send('soko:reset-window-pos'),
  setWindowSize: (width, height) => ipcRenderer.send('soko:set-window-size', { width, height }),
  onWindowBlur: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('soko:window-blur', handler);
    return () => ipcRenderer.removeListener('soko:window-blur', handler);
  },
  quitApp: () => ipcRenderer.send('soko:quit'),
});

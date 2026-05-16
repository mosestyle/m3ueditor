const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openInVlc: (url) => ipcRenderer.invoke("open-in-vlc", url),
});

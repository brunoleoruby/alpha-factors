const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deskShell", {
  isDesktop: true,
  captureRect: (rect) => ipcRenderer.invoke("desk:capture-rect", rect),
});

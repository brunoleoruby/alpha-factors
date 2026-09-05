const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("deskShell", {
  isDesktop: true,
});

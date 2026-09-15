const { app, BrowserWindow, Menu, shell, ipcMain } = require("electron");
const path = require("path");

app.disableHardwareAcceleration();
if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
}

const PORT = process.env.DESK_PORT || "43123";
const DESK_URL = process.env.DESK_URL || `http://127.0.0.1:${PORT}/?desktop=1`;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "News Pattern Desk",
    backgroundColor: "#1c1914",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.loadURL(DESK_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

const menu = Menu.buildFromTemplate([
  {
    label: "File",
    submenu: [
      { role: "reload" },
      { role: "forcereload" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "togglefullscreen" },
      { role: "resetzoom" },
      { role: "zoomin" },
      { role: "zoomout" },
    ],
  },
]);

ipcMain.handle("desk:capture-rect", async (event, rect) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return "";
  const image = await win.webContents.capturePage({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  });
  return image.toDataURL();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

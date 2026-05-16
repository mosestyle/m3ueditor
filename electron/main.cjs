const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

function findVlcPath() {
  const candidates = [
    "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
    "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "vlc";
}

ipcMain.handle("open-in-vlc", async (_event, url) => {
  const cleanUrl = typeof url === "string" ? url.trim() : "";

  if (!cleanUrl) {
    return { ok: false, message: "No stream URL found." };
  }

  try {
    const vlcPath = findVlcPath();
    const child = spawn(vlcPath, [cleanUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.unref();
    return { ok: true, message: "Opened in VLC." };
  } catch (error) {
    return {
      ok: false,
      message:
        "Could not open VLC. Make sure VLC is installed in C:\\Program Files\\VideoLAN\\VLC or available in PATH.",
    };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1350,
    height: 850,
    minWidth: 1050,
    minHeight: 650,
    title: "Moses M3U Editor",
    backgroundColor: "#f3f4f6",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  win.once("ready-to-show", () => {
    win.show();
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// electron/main.js
//
// This is the entire "desktop app" wrapper. It doesn't change what Life OS
// is — it's still the same Express server + JSON files on disk — it just:
//   1. Starts that server as a background process, pointed at a writable,
//      per-user data folder instead of a folder inside the app package.
//   2. Opens a native window pointed at it.
//   3. Shuts the server down when you close the window.
//
// Nothing here talks to the internet except the two *optional* integrations
// the app already had (Google Calendar sync, and the Support page's
// bring-your-own-key Gemini chat) — both are off unless you turn them on in
// Settings, exactly as before.

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { fork } = require("child_process");
const http = require("http");

const isDev = !app.isPackaged;
const PORT = process.env.LIFE_OS_PORT || 4310;

// The app's icon/cover art (also the source used to generate build/icon.icns,
// build/icon.ico, build/icon.png for the packaged installers — see
// package.json's "build" config). Bundled inside electron/**/* so it's
// available at runtime both in dev and inside the packaged asar.
const ICON_PATH = path.join(__dirname, "icon.png");

// In dev, `npm run electron:dev` already has the real server (port 4310)
// and the Vite dev server (port 5173, which proxies /api to it) running via
// `concurrently` — that gives you hot reload. This window just points at
// that Vite URL instead of forking a second server of its own.
const DEV_URL = process.env.ELECTRON_DEV_URL;

let serverProcess = null;
let mainWindow = null;

// --- Where the server code and the client build live ---
// In dev: run straight from the repo (server/index.js, with its own
// node_modules resolved normally by Node).
// Packaged: a single self-contained bundle produced by `npm run build:server`
// (see scripts/build-server.js) — every dependency is inlined into one file,
// so there's no node_modules tree for the packager to get wrong.
const SERVER_ENTRY = isDev
  ? path.join(__dirname, "..", "server", "index.js")
  : path.join(process.resourcesPath, "app.asar", "server-dist", "index.js");

const CLIENT_DIST = isDev
  ? path.join(__dirname, "..", "client", "dist")
  : path.join(process.resourcesPath, "app.asar", "client", "dist");

// --- Where user data lives ---
// A real per-user, writable folder outside the read-only app bundle, e.g.
//   macOS:   ~/Library/Application Support/Life OS/data
//   Windows: %APPDATA%/Life OS/data
//   Linux:   ~/.config/Life OS/data
const DATA_DIR = path.join(app.getPath("userData"), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

// A small log file so a failure has somewhere to show up, since a packaged
// app has no visible terminal. Same folder as the data, for easy finding.
const LOG_FILE = path.join(app.getPath("userData"), "life-os.log");
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // ignore logging failures
  }
  if (isDev) console.log(line);
}

function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = fork(SERVER_ENTRY, [], {
      env: {
        ...process.env,
        PORT: String(PORT),
        LIFE_OS_DATA_DIR: DATA_DIR,
        LIFE_OS_CLIENT_DIST: CLIENT_DIST,
        // Same-origin: the server serves the built client itself, so
        // OAuth redirects (Google Calendar) come straight back to it.
        CLIENT_ORIGIN: `http://localhost:${PORT}`,
        // CRITICAL: without this, Electron's forked process tries to launch
        // itself as a second Electron GUI app instead of running this file
        // as plain Node — the server silently never starts. This forces it
        // to behave like a normal `node server/index.js` process.
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    serverProcess.stdout?.on("data", (d) => log("[server]", d.toString().trim()));
    serverProcess.stderr?.on("data", (d) => log("[server:err]", d.toString().trim()));

    serverProcess.on("error", (err) => {
      log("Failed to fork server process:", err.message);
      reject(err);
    });
    serverProcess.once("exit", (code) => {
      if (code && code !== 0) log(`Life OS server exited with code ${code}`);
    });

    waitForServer(resolve, reject);
  });
}

function waitForServer(resolve, reject, attempt = 0) {
  const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
    if (res.statusCode === 200) return resolve();
    retry();
  });
  req.on("error", retry);

  function retry() {
    if (attempt > 100) return reject(new Error("Life OS server did not start in time"));
    setTimeout(() => waitForServer(resolve, reject, attempt + 1), 100);
  }
}

function createWindow() {
  const targetURL = DEV_URL || `http://localhost:${PORT}`;
  const targetOrigin = new URL(targetURL).origin;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Life OS",
    backgroundColor: "#f4f4ef",
    autoHideMenuBar: true,
    // Windows/Linux taskbar icon (macOS packaged builds get their dock icon
    // from build/icon.icns via electron-builder instead; see app.dock.setIcon
    // below for unpackaged mac dev runs, where that .icns isn't applied).
    icon: ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(targetURL);

  // Anything that isn't the app itself (Google's consent screen link,
  // "Get a free key" link on the Support page, etc.) opens in the system
  // browser instead of hijacking the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(targetOrigin)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(targetOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Only one instance — a second launch just focuses the existing window
// (data lives in a single set of JSON files, so two instances writing at
// once isn't safe).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    // On macOS, the dock icon for a *packaged* app comes from
    // build/icon.icns (baked into the .app bundle by electron-builder).
    // That only applies to a built .app, though — running unpackaged in
    // dev (`electron .`) always shows Electron's default dock icon unless
    // we set one explicitly here.
    if (process.platform === "darwin" && app.dock) {
      app.dock.setIcon(ICON_PATH);
    }
    try {
      if (!DEV_URL) await startServer();
      createWindow();
    } catch (err) {
      log("Failed to start Life OS:", err.message);
      dialog.showErrorBox(
        "Life OS failed to start",
        `${err.message}\n\nDetails were written to:\n${LOG_FILE}`
      );
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

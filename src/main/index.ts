import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  clipboard,
} from "electron";
import { join, basename } from "path";
import { optimizer, is } from "@electron-toolkit/utils";
import { DatabaseService } from "./services/database";
import { Processor } from "./logic/processor";
import fs from "fs-extra";

const isDev = !app.isPackaged;

// Database and Processor Initialization
const dbPath = join(app.getPath("userData"), "tweets.db");
const db = new DatabaseService(dbPath);
db.init();

const processor = new Processor(db);
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;

let isProcessing = false;
// Start background worker interval
setInterval(async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    await processor.processQueue();
  } catch (err) {
    console.error(err);
  } finally {
    isProcessing = false;
  }
}, 5000); // Check every 5 seconds for precise thread timing

function createTray(): void {
  const iconPath = isDev
    ? join(app.getAppPath(), "resources/icon.png")
    : join(process.resourcesPath, "icon.png");

  // Create icon from file, ensuring it exists
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    // On Windows, 32x32 is better for high DPI
    icon = icon.resize({ width: 32, height: 32 });
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "Open TweetFlow", click: () => mainWindow?.show() },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setToolTip("TweetFlow Scheduler");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => mainWindow?.show());
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC Handlers - Accounts
  ipcMain.handle("get-accounts", () => {
    return db.getAccounts();
  });

  ipcMain.handle("add-account", (_, accountData) => {
    return db.createAccount(accountData);
  });

  ipcMain.handle("update-account", (_, id, accountData) => {
    return db.updateAccount(id, accountData);
  });

  ipcMain.handle("delete-account", (_, id) => {
    return db.deleteAccount(id);
  });

  // IPC Handlers - Queue Slots
  ipcMain.handle("get-queue-slots", () => {
    return db.getQueueSlots();
  });

  ipcMain.handle("add-queue-slot", (_, timeStr) => {
    return db.addQueueSlot(timeStr);
  });

  ipcMain.handle("delete-queue-slot", (_, id) => {
    return db.deleteQueueSlot(id);
  });

  // IPC Handlers - Tweets
  ipcMain.handle("get-pending-tweets", () => {
    return db.getPendingTweets(Date.now() + 1000 * 60 * 60 * 24 * 365); // Get all pending
  });

  ipcMain.handle("get-drafts", () => {
    return db.getDrafts();
  });

  ipcMain.handle("get-history", (_, limit) => {
    return db.getHistory(limit);
  });

  ipcMain.handle("soft-delete-history", (_, id) => {
    return db.softDeleteSendLog(id);
  });

  ipcMain.handle("schedule-tweet", (_, tweetData) => {
    return db.createTweet({
      ...tweetData,
      status: "pending",
    });
  });

  ipcMain.handle("save-draft", (_, tweetData) => {
    return db.createTweet({
      ...tweetData,
      status: "draft",
    });
  });

  ipcMain.handle("update-tweet", (_, id, tweetData) => {
    return db.updateTweet(id, tweetData);
  });

  ipcMain.handle("delete-tweet", (_, id) => {
    return db.deleteTweet(id);
  });

  ipcMain.handle("soft-delete-tweet", (_, id) => {
    return db.softDeleteTweet(id);
  });

  ipcMain.handle("handle-media-upload", async (_, filePath: string) => {
    const mediaDir = join(app.getPath("userData"), "media");
    await fs.ensureDir(mediaDir);
    const fileName = `${Date.now()}-${basename(filePath)}`;
    const destPath = join(mediaDir, fileName);
    await fs.copy(filePath, destPath);
    return destPath;
  });

  ipcMain.handle("save-pasted-image", async (_, base64Data: string) => {
    const mediaDir = join(app.getPath("userData"), "media");
    await fs.ensureDir(mediaDir);
    const fileName = `${Date.now()}-pasted.png`;
    const destPath = join(mediaDir, fileName);
    const buffer = Buffer.from(base64Data, "base64");
    await fs.writeFile(destPath, buffer);
    return destPath;
  });

  // IPC Handlers - Settings
  ipcMain.handle("get-setting", (_, key: string) => {
    return db.getSetting(key);
  });

  ipcMain.handle("set-setting", (_, key: string, value: string) => {
    db.setSetting(key, value);
  });

  // IPC Handlers - Ready to Post (manual mode)
  ipcMain.handle("get-ready-tweets", () => {
    return db.getReadyTweets(Date.now());
  });

  ipcMain.handle("mark-tweet-posted", (_, id: number) => {
    db.updateTweetStatus(id, "sent");
    db.addSendLog({
      tweet_id: id,
      account_id: 0, // manual post — no account used
      content: db.getTweetById(id)?.content || "",
      sent_at: Date.now(),
      status: "sent",
      error_message: null,
    });
  });

  ipcMain.handle("copy-image-to-clipboard", async (_, imagePath: string) => {
    try {
      const image = nativeImage.createFromPath(imagePath);
      if (image.isEmpty()) {
        return { success: false, error: "Could not load image" };
      }
      clipboard.writeImage(image);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // IPC Handlers - Database View (testing)
  ipcMain.handle("db-get-tables", () => {
    return db.getTableNames();
  });

  ipcMain.handle("db-get-rows", (_, table: string) => {
    return db.getAllRows(table);
  });

  ipcMain.handle(
    "db-insert-row",
    (_, table: string, data: Record<string, any>) => {
      return db.insertRow(table, data);
    },
  );

  ipcMain.handle(
    "db-update-row",
    (_, table: string, id: number, data: Record<string, any>) => {
      db.updateRow(table, id, data);
    },
  );

  ipcMain.handle("db-delete-row", (_, table: string, id: number) => {
    db.deleteRow(table, id);
  });

  ipcMain.handle("db-get-schema", (_, table: string) => {
    return db.getTableInfo(table);
  });

  createWindow();
  createTray();

  // Enable Auto-start on boot
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
    path: app.getPath("exe"),
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // We stay active in the tray
});

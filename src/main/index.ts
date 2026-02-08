import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import { DatabaseService } from './services/database'
import { Processor } from './logic/processor'
import { TwitterApi } from 'twitter-api-v2'
import * as dotenv from 'dotenv'
import fs from 'fs-extra'
import path from 'path'

const isDev = !app.isPackaged

if (isDev) {
    dotenv.config()
} else {
    // In production, look for .env next to the executable
    dotenv.config({ path: join(process.resourcesPath, '.env') })
    dotenv.config({ path: join(path.dirname(process.execPath), '.env') })
}

const dbPath = join(app.getPath('userData'), 'tweets.db')
const db = new DatabaseService(dbPath)
db.init()

const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY || '',
    appSecret: process.env.TWITTER_APP_SECRET || '',
    accessToken: process.env.TWITTER_ACCESS_TOKEN || '',
    accessSecret: process.env.TWITTER_ACCESS_SECRET || ''
})

const processor = new Processor(db, twitterClient)
let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null

// Start background worker interval
setInterval(() => {
    processor.processQueue().catch(console.error)
}, 5000) // Check every 5 seconds for precise thread timing

function createTray(): void {
    const iconPath = isDev
        ? join(__dirname, '../../resources/icon.png')
        : join(process.resourcesPath, 'icon.png')

    // Create icon from file, ensuring it exists
    let icon;
    if (fs.existsSync(iconPath)) {
        icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    } else {
        icon = nativeImage.createEmpty()
    }

    tray = new Tray(icon)
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open TweetFlow', click: () => mainWindow?.show() },
        { type: 'separator' },
        {
            label: 'Quit', click: () => {
                (app as any).isQuitting = true
                app.quit()
            }
        }
    ])
    tray.setToolTip('TweetFlow Scheduler')
    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => mainWindow?.show())
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
    })

    mainWindow.on('close', (event) => {
        if (!(app as any).isQuitting) {
            event.preventDefault()
            mainWindow?.hide()
        }
        return false
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

app.whenReady().then(() => {
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // IPC Handlers
    ipcMain.handle('get-pending-tweets', () => {
        return db.getPendingTweets(Date.now() + 1000 * 60 * 60 * 24 * 365) // Get all pending
    })

    ipcMain.handle('get-drafts', () => {
        return db.getDrafts()
    })

    ipcMain.handle('get-history', (_, limit) => {
        return db.getHistory(limit)
    })

    ipcMain.handle('schedule-tweet', (_, tweetData) => {
        return db.createTweet({
            ...tweetData,
            status: 'pending'
        })
    })

    ipcMain.handle('save-draft', (_, tweetData) => {
        return db.createTweet({
            ...tweetData,
            status: 'draft'
        })
    })

    ipcMain.handle('update-tweet', (_, id, tweetData) => {
        return db.updateTweet(id, tweetData)
    })

    ipcMain.handle('delete-tweet', (_, id) => {
        return db.deleteTweet(id)
    })

    ipcMain.handle('handle-media-upload', async (_, filePath: string) => {
        const mediaDir = join(app.getPath('userData'), 'media')
        await fs.ensureDir(mediaDir)
        const fileName = `${Date.now()}-${path.basename(filePath)}`
        const destPath = join(mediaDir, fileName)
        await fs.copy(filePath, destPath)
        return destPath
    })

    createWindow()
    createTray()

    // Enable Auto-start on boot
    app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        path: app.getPath('exe')
    })

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    // We stay active in the tray
})

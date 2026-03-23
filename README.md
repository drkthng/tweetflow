# TweetFlow Scheduler

Desktop tweet scheduler for X (Twitter). Compose tweets and threads, schedule them, and post automatically via the API or manually via a copy-paste queue.

Built with Electron + React + TypeScript + SQLite.

## Features

- **Dual-mode posting** — Auto mode posts via the X API in the background. Manual mode shows a copy-paste queue so you can post by hand at zero cost.
- **Thread support** — Compose multi-tweet threads with automatic numbering, configurable inter-tweet delay, and correct reply-chain posting.
- **Scheduling & queue** — Schedule tweets for exact times, or add them to a daily queue with configurable time slots (e.g. 09:00, 14:00, 19:00).
- **Smart text splitter** — Paste long text and split it into a thread automatically using sentence boundaries or a custom separator.
- **Media attachments** — Attach images to tweets. In manual mode, copy images to clipboard for pasting into X's web UI.
- **Multi-account** — Add multiple X accounts with API credentials. Select which account to post from per-tweet.
- **Recurring tweets** — Mark tweets as recurring with a configurable interval (months). After posting, they re-enter the queue for the next cycle.
- **Retry with backoff** — Transient API errors (429, 503, network timeouts) are retried with exponential backoff. Permanent errors fail immediately. Thread children are halted when a parent fails.
- **Drafts & history** — Save drafts, view posting history with error details.
- **System tray** — Runs in the background, auto-starts on boot, posts while the window is closed.
- **Local-first** — All data stored locally in SQLite. No cloud dependency.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm

### Install & Run

```bash
git clone https://github.com/AntGravity-Research/TweetFlow-Scheduler.git
cd TweetFlow-Scheduler
npm install
npm run dev
```

### Build for Production

```bash
npm run pack
```

This compiles the app and packages it to `dist/win-unpacked/tweetflow-scheduler.exe`.

## Usage

### Manual Mode (default)

The app starts in **manual mode** — no API credentials needed.

1. Compose a tweet or thread in the left panel.
2. Set a schedule time and click **Publish**.
3. When the scheduled time arrives, switch to the **📋 Ready to Post** tab.
4. For each tweet: **Copy Text** → paste into X → **Mark as Posted**.
5. For images: **Copy Image** → paste into X's media upload.

Threads are grouped and numbered (1/3, 2/3, 3/3) so you can post them in order.

### Auto Mode

Toggle **Manual ↔ Auto** in the top-right corner. In auto mode, the background processor posts tweets via the X API when their scheduled time arrives.

Requires API credentials: go to the **Accounts** tab and add your X app key, secret, access token, and access secret. The X API uses pay-per-use pricing ($0.01/tweet as of 2026).

### Queue Slots

Instead of scheduling exact times, add tweets to the **queue** and configure daily time slots in the **Queue Slots** tab. The processor picks one queued tweet per slot.

## Architecture

```
src/
  main/                    # Electron main process
    index.ts               # App lifecycle, IPC handlers, tray
    logic/processor.ts     # Background tweet processor (retry, threading, backoff)
    services/database.ts   # SQLite service (schema, migrations, queries)
  preload/index.ts         # Context bridge (IPC API exposed to renderer)
  renderer/src/            # React UI
    App.tsx                # Main application component
    components/            # TweetBlock, DatabaseView
```

**Key patterns:**
- IPC bridge: renderer → preload (`contextBridge`) → main (`ipcMain.handle`)
- Schema migrations via column-existence checks in `DatabaseService.init()`
- Processor runs on a 5-second interval with a mutex flag
- Settings stored as key-value pairs in SQLite `settings` table
- Soft-delete on tweets and send logs (`is_deleted` flag)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development mode with hot reload |
| `npm run build` | Compile to `out/` (no packaging) |
| `npm run pack` | Compile + package to `dist/win-unpacked/` |
| `npm run start` | Preview the production build |
| `npm run test` | Run unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## License

MIT

---

*Built by Antigravity*

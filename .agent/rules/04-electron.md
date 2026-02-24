---
description: Electron desktop shell rules for Retrocast (Phase 3)
---

# Electron Rules

These rules apply to all code under `electron/`. Read `01-general.md` first.

## 1. Security (Non-Negotiable)

Every `BrowserWindow` must be created with these security settings:

```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, "preload.js"),
  // Do NOT enable the remote module
}
```

- `nodeIntegration: false` — renderer process has no access to Node.js APIs.
- `contextIsolation: true` — preload script runs in isolated context.
- **Never** use the `remote` module. It is deprecated and a security risk.

## 2. IPC Usage (Minimal)

- The frontend communicates with the backend via **HTTP** (localhost:8000), NOT via Electron IPC.
- IPC is only used for:
  - Window management (minimize, maximize, close)
  - File dialogs (`dialog.showOpenDialog` for CSV import)
  - Application lifecycle events (quit, update)
- Keep IPC channels to an absolute minimum. Each channel must be documented in the preload script.

## 3. Python Process Management

- The backend runs as a **sidecar process** managed by Electron's main process.
- Use `child_process.spawn()` to start the Python backend.
- **Always use `tree-kill`** on Windows for process cleanup. `process.kill()` does NOT kill child processes on Windows.

```typescript
import treeKill from "tree-kill";

function stopBackend(pid: number): void {
  treeKill(pid, "SIGTERM", (err) => {
    if (err) logger.error(`Failed to kill backend process: ${err.message}`);
  });
}
```

- Handle `app.on("before-quit")` to ensure the Python process is killed.
- Implement a health check loop: poll `http://localhost:8000/health` until the backend is ready before loading the frontend.

## 4. Error Handling

- Use `dialog.showErrorBox()` for fatal errors during startup (e.g., Python not found, backend won't start).
- Log all errors to a file in the user's app data directory.
- Never let the app hang silently — always surface errors to the user.

## 5. Resource Paths

- Always use `path.join()` for constructing file paths.
- Handle both development and production paths:

```typescript
const isDev = !app.isPackaged;
const backendPath = isDev
  ? path.join(__dirname, "..", "backend")
  : path.join(process.resourcesPath, "backend");
```

- Never use hardcoded absolute paths or forward slashes on Windows.

## 6. Window State (Post-MVP)

- Remembering window size and position is in `docs/BACKLOG.md`.
- For MVP: use sensible defaults (1280×800, centered).
- Do NOT implement window state persistence unless explicitly requested.

## 7. Dev vs Production

- **Dev mode**: Start backend (`python run.py`), frontend (`npm run dev`), and Electron concurrently.
- **Production**: Electron loads the built frontend from `frontend/dist/` and starts the PyInstaller-bundled backend.
- Use `app.isPackaged` to detect the environment, not `process.env.NODE_ENV`.

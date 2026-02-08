---
description: how to pin the app to start in windows
---
To pin the TweetFlow Scheduler to your Windows Start menu, follow these steps:

### Option 1: Using the Development Version (Fastest)
1. Right-click on your Desktop and select **New > Shortcut**.
2. In the location field, type:
   `cmd.exe /c "cd /d C:\Users\Gordon\.gemini\antigravity\playground\midnight-omega && npm run dev"`
3. Click **Next** and name the shortcut "TweetFlow Scheduler".
4. Once created, **Right-click** the shortcut on your Desktop and select **Pin to Start**.

### Option 2: Building a Standalone App (Recommended for long-term use)
1. Run the build command in the terminal:
   ```bash
   npm run build
   ```
2. Navigate to the `out` or `dist` folder:
   `C:\Users\Gordon\.gemini\antigravity\playground\midnight-omega\dist`
3. Find the `TweetFlow Scheduler Setup.exe` (or the unpacked `.exe` in `win-unpacked`).
4. **Right-click** the executable and select **Pin to Start**.

> [!TIP]
> Option 2 is better as it doesn't require a terminal window to stay open in the background!

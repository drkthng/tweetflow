# TweetFlow Scheduler 🚀

TweetFlow Scheduler is a high-performance, desktop-native Twitter scheduling application built with Electron. It provides a seamless experience for power users to manage their presence on X (Twitter) with advanced threading, media support, and a smart text splitter.

![TweetFlow Screenshot](resources/screenshot.png) *(Note: Add your screenshot here)*

## ✨ Key Features

-   📅 **Advanced Scheduling**: Plan your tweets and threads for any future date/time.
-   🧵 **First-Class Threads**: Create long-form threads with automatic numbering (e.g., 1/5, 2/5) and custom delays between posts.
-   🖼️ **Media Support**: Upload and schedule images directly from your desktop.
-   🧠 **Smart Text Splitter**: Paste long-form content and let TweetFlow automatically split it into a perfectly formatted thread using semantic rules or custom separators.
-   💾 **Drafts & History**: Save your ideas for later and keep a complete log of your scheduled and posted content.
-   ⚡ **Desktop Native**: Lightweight, fast, and runs in your system tray for non-intrusive background processing.
-   🔒 **Privacy First**: Your data is stored locally in a SQLite database.

## 🛠️ Tech Stack

-   **Frontend**: React, TypeScript, Vite
-   **Backend**: Electron, Node.js
-   **Database**: SQLite (better-sqlite3)
-   **API**: Twitter API v2 (twitter-api-v2)

## 🚀 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [npm](https://www.npmjs.com/)
-   A Twitter Developer account with API keys.

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/TweetFlow-Scheduler.git
    cd TweetFlow-Scheduler
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add your Twitter API credentials:
    ```env
    TWITTER_APP_KEY=your_app_key
    TWITTER_APP_SECRET=your_app_secret
    TWITTER_ACCESS_TOKEN=your_access_token
    TWITTER_ACCESS_SECRET=your_access_secret
    ```

4.  **Run Development Mode**:
    ```bash
    npm run dev
    ```

### Building for Production

To create a production-ready package:
```bash
npm run build
```

## 📜 Development Scripts

-   `npm run dev`: Starts the application in development mode with HMR.
-   `npm run build`: Builds the application for production.
-   `npm run lint`: Runs ESLint for code quality checks.
-   `npm run format`: Formats code using Prettier.
-   `npm run test`: Executes unit tests via Vitest.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ by Antigravity*

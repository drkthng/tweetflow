import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";

const dbPath = join(
  homedir(),
  "AppData",
  "Roaming",
  "tweetflow-scheduler",
  "tweets.db",
);
const db = new Database(dbPath);

function runDiagnostics() {
  console.log("--- Account Diagnostics ---");
  const accounts = db.prepare("SELECT id, name FROM accounts").all();
  console.log("Found accounts:", accounts);

  if (accounts.length === 0) {
    console.log("No accounts found in database.");
    return;
  }

  const now = Date.now();
  for (const acc of accounts) {
    console.log(
      `Scheduling test tweet for account: ${acc.name} (ID: ${acc.id})`,
    );
    const stmt = db.prepare(`
            INSERT INTO tweets (content, status, scheduled_at, account_id)
            VALUES (?, ?, ?, ?)
        `);
    stmt.run(
      `Multi-account test from TweetFlow for @${acc.name} at ${new Date().toLocaleString()}`,
      "pending",
      now - 1000,
      acc.id,
    );
  }
  console.log("Test tweets scheduled.");
}

runDiagnostics();
db.close();

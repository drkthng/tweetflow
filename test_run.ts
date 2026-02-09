import { DatabaseService } from './src/main/services/database';
import { join } from 'path';
import { app } from 'electron';
// Note: App might not be available in standalone script, using direct path
import { homedir } from 'os';

const dbPath = join(homedir(), 'AppData', 'Roaming', 'tweetflow-scheduler', 'tweets.db');
const db = new DatabaseService(dbPath);
db.init();

async function runTest() {
    console.log('--- Account Diagnostics ---');
    const accounts = db.getAccounts();
    console.log('Found accounts:', accounts.map(a => ({ id: a.id, name: a.name })));

    if (accounts.length === 0) {
        console.log('No accounts found.');
        return;
    }

    const now = Date.now();
    for (const acc of accounts) {
        console.log(`Scheduling test for: ${acc.name}`);
        db.createTweet({
            content: `Multi-account test from TweetFlow for @${acc.name} at ${new Date().toLocaleString()}`,
            status: 'pending',
            scheduled_at: now - 1000,
            account_id: acc.id!,
            media_path: null,
            thread_id: null,
            sequence_index: 0,
            parent_id: null
        });
    }
    console.log('Done.');
}

runTest().catch(console.error);

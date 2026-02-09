import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs-extra'

export interface AccountRecord {
    id?: number
    name: string
    app_key: string
    app_secret: string
    access_token: string
    access_secret: string
}

export interface TweetRecord {
    id?: number
    content: string
    status: 'pending' | 'sent' | 'failed' | 'draft'
    scheduled_at: number
    media_path: string | null
    thread_id: string | null
    sequence_index: number
    parent_id: string | null
    tweet_id?: string | null
    account_id: number
    error_message?: string | null
}

export class DatabaseService {
    private db: Database.Database

    constructor(dbPath: string) {
        if (dbPath !== ':memory:') {
            fs.ensureDirSync(path.dirname(dbPath))
        }
        this.db = new Database(dbPath)
    }

    init() {
        // Create accounts table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                app_key TEXT NOT NULL,
                app_secret TEXT NOT NULL,
                access_token TEXT NOT NULL,
                access_secret TEXT NOT NULL
            )
        `)

        // Create tweets table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS tweets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        scheduled_at INTEGER NOT NULL,
        media_path TEXT,
        thread_id TEXT,
        sequence_index INTEGER DEFAULT 0,
        parent_id TEXT,
        tweet_id TEXT,
        account_id INTEGER,
        error_message TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `)

        // Migrate existing schema if necessary (adding account_id if it doesn't exist)
        const tableInfo = this.getTableInfo('tweets') as any[]
        const hasAccountId = tableInfo.some((col: any) => col.name === 'account_id')
        if (!hasAccountId) {
            this.db.exec('ALTER TABLE tweets ADD COLUMN account_id INTEGER')
        }

        const hasErrorMessage = tableInfo.some((col: any) => col.name === 'error_message')
        if (!hasErrorMessage) {
            this.db.exec('ALTER TABLE tweets ADD COLUMN error_message TEXT')
        }
    }

    // Account Methods
    getAccounts(): AccountRecord[] {
        return this.db.prepare('SELECT * FROM accounts').all() as AccountRecord[]
    }

    getAccountById(id: number): AccountRecord {
        return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRecord
    }

    createAccount(account: AccountRecord): number {
        const stmt = this.db.prepare(`
            INSERT INTO accounts (name, app_key, app_secret, access_token, access_secret)
            VALUES (?, ?, ?, ?, ?)
        `)
        const result = stmt.run(
            account.name,
            account.app_key,
            account.app_secret,
            account.access_token,
            account.access_secret
        )
        return result.lastInsertRowid as number
    }

    updateAccount(id: number, account: Partial<AccountRecord>) {
        const fields = Object.keys(account).map(k => `${k} = ?`).join(', ')
        const values = Object.values(account)
        const stmt = this.db.prepare(`UPDATE accounts SET ${fields} WHERE id = ?`)
        stmt.run(...values, id)
    }

    deleteAccount(id: number) {
        this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
    }

    // Tweet Methods
    createTweet(tweet: TweetRecord): number {
        const stmt = this.db.prepare(`
      INSERT INTO tweets (content, status, scheduled_at, media_path, thread_id, sequence_index, parent_id, account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
        const result = stmt.run(
            tweet.content,
            tweet.status,
            tweet.scheduled_at,
            tweet.media_path,
            tweet.thread_id,
            tweet.sequence_index,
            tweet.parent_id,
            tweet.account_id
        )
        return result.lastInsertRowid as number
    }

    getTweetById(id: number): TweetRecord {
        const stmt = this.db.prepare('SELECT * FROM tweets WHERE id = ?')
        return stmt.get(id) as TweetRecord
    }

    updateTweetStatus(id: number, status: string, tweetId?: string, errorMessage?: string) {
        const stmt = this.db.prepare('UPDATE tweets SET status = ?, tweet_id = ?, error_message = ? WHERE id = ?')
        stmt.run(status, tweetId || null, errorMessage || null, id)
    }

    getPendingTweets(now: number): TweetRecord[] {
        const stmt = this.db.prepare("SELECT * FROM tweets WHERE status = 'pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC")
        return stmt.all(now) as TweetRecord[]
    }

    getDrafts(): TweetRecord[] {
        const stmt = this.db.prepare("SELECT * FROM tweets WHERE status = 'draft' ORDER BY id DESC")
        return stmt.all() as TweetRecord[]
    }

    updateTweet(id: number, tweet: Partial<TweetRecord>) {
        const fields = Object.keys(tweet).map(k => `${k} = ?`).join(', ')
        const values = Object.values(tweet)
        const stmt = this.db.prepare(`UPDATE tweets SET ${fields} WHERE id = ?`)
        stmt.run(...values, id)
    }

    getHistory(limit: number = 50): TweetRecord[] {
        return this.db.prepare(`
            SELECT * FROM tweets
            WHERE status IN ('sent', 'failed')
            ORDER BY scheduled_at DESC
            LIMIT ?
        `).all(limit) as TweetRecord[]
    }

    deleteTweet(id: number) {
        const stmt = this.db.prepare('DELETE FROM tweets WHERE id = ?')
        stmt.run(id)
    }

    getTableInfo(tableName: string) {
        return this.db.pragma(`table_info(${tableName})`)
    }

    close() {
        this.db.close()
    }
}

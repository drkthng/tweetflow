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
    mode: 'scheduled' | 'queued'
    is_recurring: boolean
    send_count: number
    recurrence_interval: number
}

export interface QueueSlot {
    id?: number
    time_str: string
    last_sent_at: number
}

export interface SendLog {
    id?: number
    tweet_id: number
    account_id: number
    content: string
    sent_at: number
    status: string
    error_message?: string | null
    twitter_tweet_id?: string | null
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
        mode TEXT DEFAULT 'scheduled',
        is_recurring INTEGER DEFAULT 0,
        send_count INTEGER DEFAULT 0,
        recurrence_interval INTEGER DEFAULT 15552000000,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )
    `)

        // Migrate existing schema if necessary
        const tableInfo = this.getTableInfo('tweets') as any[]
        const hasAccountId = tableInfo.some((col: any) => col.name === 'account_id')
        if (!hasAccountId) {
            this.db.exec('ALTER TABLE tweets ADD COLUMN account_id INTEGER')
        }

        const hasErrorMessage = tableInfo.some((col: any) => col.name === 'error_message')
        if (!hasErrorMessage) {
            this.db.exec('ALTER TABLE tweets ADD COLUMN error_message TEXT')
        }

        const hasMode = tableInfo.some((col: any) => col.name === 'mode')
        if (!hasMode) {
            this.db.exec("ALTER TABLE tweets ADD COLUMN mode TEXT DEFAULT 'scheduled'")
        }
        const hasRecurring = tableInfo.some((col: any) => col.name === 'is_recurring')
        if (!hasRecurring) {
            this.db.exec("ALTER TABLE tweets ADD COLUMN is_recurring INTEGER DEFAULT 0")
        }
        const hasSendCount = tableInfo.some((col: any) => col.name === 'send_count')
        if (!hasSendCount) {
            this.db.exec("ALTER TABLE tweets ADD COLUMN send_count INTEGER DEFAULT 0")
        }
        const hasRecurrenceInterval = tableInfo.some((col: any) => col.name === 'recurrence_interval')
        if (!hasRecurrenceInterval) {
            this.db.exec("ALTER TABLE tweets ADD COLUMN recurrence_interval INTEGER DEFAULT 15552000000")
        }

        // Create queue_slots table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS queue_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time_str TEXT NOT NULL,
                last_sent_at INTEGER DEFAULT 0
            )
        `)

        // Create send_logs table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS send_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tweet_id INTEGER,
                account_id INTEGER,
                content TEXT NOT NULL,
                sent_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT,
                twitter_tweet_id TEXT
            )
        `)

        // Seed default slots
        const slotCount = this.db.prepare('SELECT COUNT(*) as count FROM queue_slots').get() as { count: number }
        if (slotCount.count === 0) {
            const insertSlot = this.db.prepare('INSERT INTO queue_slots (time_str) VALUES (?)')
            insertSlot.run('09:00')
            insertSlot.run('14:00')
            insertSlot.run('19:00')
        }

        // Phase 6: Migrate legacy history from tweets table to send_logs
        const logCount = this.db.prepare('SELECT COUNT(*) as count FROM send_logs').get() as { count: number }
        if (logCount.count === 0) {
            const legacySentTweets = this.db.prepare("SELECT * FROM tweets WHERE status = 'sent'").all() as any[]
            if (legacySentTweets.length > 0) {
                const insertLog = this.db.prepare(`
                    INSERT INTO send_logs (tweet_id, account_id, content, sent_at, status, twitter_tweet_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                `)
                legacySentTweets.forEach(tweet => {
                    insertLog.run(
                        tweet.id,
                        tweet.account_id,
                        tweet.content,
                        tweet.scheduled_at, // Use scheduled_at as sent_at for legacy entries
                        'sent',
                        tweet.tweet_id
                    )
                })
            }
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
      INSERT INTO tweets (content, status, scheduled_at, media_path, thread_id, sequence_index, parent_id, account_id, mode, is_recurring, send_count, recurrence_interval)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
        const result = stmt.run(
            tweet.content,
            tweet.status,
            tweet.scheduled_at,
            tweet.media_path,
            tweet.thread_id,
            tweet.sequence_index,
            tweet.parent_id,
            tweet.account_id,
            tweet.mode || 'scheduled',
            tweet.is_recurring ? 1 : 0,
            tweet.send_count || 0,
            tweet.recurrence_interval || 15552000000
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

    getHistory(limit: number = 50): SendLog[] {
        return this.db.prepare(`
            SELECT * FROM send_logs
            ORDER BY sent_at DESC
            LIMIT ?
        `).all(limit) as SendLog[]
    }

    // Queue Slot Methods
    getQueueSlots(): QueueSlot[] {
        return this.db.prepare('SELECT * FROM queue_slots ORDER BY time_str ASC').all() as QueueSlot[]
    }

    addQueueSlot(timeStr: string): number {
        const stmt = this.db.prepare('INSERT INTO queue_slots (time_str) VALUES (?)')
        const result = stmt.run(timeStr)
        return result.lastInsertRowid as number
    }

    deleteQueueSlot(id: number) {
        this.db.prepare('DELETE FROM queue_slots WHERE id = ?').run(id)
    }

    updateQueueSlotLastSent(id: number, time: number) {
        this.db.prepare('UPDATE queue_slots SET last_sent_at = ? WHERE id = ?').run(time, id)
    }

    // Send Log Methods
    addSendLog(log: SendLog): number {
        const stmt = this.db.prepare(`
            INSERT INTO send_logs (tweet_id, account_id, content, sent_at, status, error_message, twitter_tweet_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        const result = stmt.run(
            log.tweet_id,
            log.account_id,
            log.content,
            log.sent_at,
            log.status,
            log.error_message || null,
            log.twitter_tweet_id || null
        )
        return result.lastInsertRowid as number
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

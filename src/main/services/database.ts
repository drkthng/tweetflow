import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs-extra'

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
}

export class DatabaseService {
    private db: Database.Database

    constructor(dbPath: string) {
        fs.ensureDirSync(path.dirname(dbPath))
        this.db = new Database(dbPath)
    }

    init() {
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
        tweet_id TEXT
      )
    `)
    }

    createTweet(tweet: TweetRecord): number {
        const stmt = this.db.prepare(`
      INSERT INTO tweets (content, status, scheduled_at, media_path, thread_id, sequence_index, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
        const result = stmt.run(
            tweet.content,
            tweet.status,
            tweet.scheduled_at,
            tweet.media_path,
            tweet.thread_id,
            tweet.sequence_index,
            tweet.parent_id
        )
        return result.lastInsertRowid as number
    }

    getTweetById(id: number): TweetRecord {
        const stmt = this.db.prepare('SELECT * FROM tweets WHERE id = ?')
        return stmt.get(id) as TweetRecord
    }

    updateTweetStatus(id: number, status: string, tweetId?: string) {
        const stmt = this.db.prepare('UPDATE tweets SET status = ?, tweet_id = ? WHERE id = ?')
        stmt.run(status, tweetId || null, id)
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

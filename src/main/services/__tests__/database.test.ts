import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseService } from '../database'
import fs from 'fs-extra'
import path from 'path'

const TEST_DB_PATH = path.join(__dirname, 'test.db')

describe('DatabaseService', () => {
    let dbService: DatabaseService

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.removeSync(TEST_DB_PATH)
        }
        dbService = new DatabaseService(TEST_DB_PATH)
        dbService.init()
    })

    afterEach(() => {
        dbService.close()
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.removeSync(TEST_DB_PATH)
        }
    })

    it('should create the tweets table with correct columns', () => {
        const tableInfo = dbService.getTableInfo('tweets')
        const columns = tableInfo.map((col: any) => col.name)

        expect(columns).toContain('id')
        expect(columns).toContain('content')
        expect(columns).toContain('status')
        expect(columns).toContain('scheduled_at')
        expect(columns).toContain('media_path')
        expect(columns).toContain('thread_id')
        expect(columns).toContain('sequence_index')
        expect(columns).toContain('parent_id')
        expect(columns).toContain('tweet_id')
    })

    it('should insert and retrieve a tweet', () => {
        const tweet = {
            content: 'Hello World',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: null,
            thread_id: null,
            sequence_index: 0,
            parent_id: null
        }

        const id = dbService.createTweet(tweet)
        const retrieved = dbService.getTweetById(id)

        expect(retrieved).toBeDefined()
        expect(retrieved.content).toBe(tweet.content)
        expect(retrieved.status).toBe(tweet.status)
    })

    it('should update tweet status and tweet_id', () => {
        const id = dbService.createTweet({
            content: 'Hello',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: null,
            thread_id: null,
            sequence_index: 0,
            parent_id: null
        })

        dbService.updateTweetStatus(id, 'sent', '123456789')
        const updated = dbService.getTweetById(id)

        expect(updated.status).toBe('sent')
        expect(updated.tweet_id).toBe('123456789')
    })

    it('should retrieve pending tweets', () => {
        const now = Date.now()
        dbService.createTweet({ content: 'Past', status: 'pending', scheduled_at: now - 1000, media_path: null, thread_id: null, sequence_index: 0, parent_id: null })
        dbService.createTweet({ content: 'Future', status: 'pending', scheduled_at: now + 1000, media_path: null, thread_id: null, sequence_index: 0, parent_id: null })
        dbService.createTweet({ content: 'Sent', status: 'sent', scheduled_at: now - 1000, media_path: null, thread_id: null, sequence_index: 0, parent_id: null })

        const pending = dbService.getPendingTweets(now)
        expect(pending).toHaveLength(1)
        expect(pending[0].content).toBe('Past')
    })
})

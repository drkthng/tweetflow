import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Processor } from '../processor'
import { TweetRecord } from '../../services/database'
import { TwitterApi } from 'twitter-api-v2'
import fs from 'fs-extra'

// Mocking dependencies
vi.mock('../../services/database')
vi.mock('twitter-api-v2')
vi.mock('fs-extra')

describe('Processor', () => {
    let processor: Processor
    let mockDb: any
    let mockTwitter: any
    let mockV1Client: any
    let mockV2Client: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockDb = {
            getPendingTweets: vi.fn(),
            updateTweetStatus: vi.fn(),
            getTweetById: vi.fn(),
            getAccountById: vi.fn()
        }

        mockV1Client = {
            uploadMedia: vi.fn().mockResolvedValue('media_id_123')
        }

        mockV2Client = {
            tweet: vi.fn().mockResolvedValue({ data: { id: 'tweet_id_456' } })
        }

        mockTwitter = {
            v1: mockV1Client,
            v2: mockV2Client
        }

        // Mock TwitterApi constructor logic or getTwitterClient dynamic return
        vi.mocked(TwitterApi).mockImplementation(() => mockTwitter)

        processor = new Processor(mockDb as any)
    })

    it('should process a single tweet without media using correct account', async () => {
        const account = {
            id: 1,
            app_key: 'key',
            app_secret: 'secret',
            access_token: 'token',
            access_secret: 'secret'
        }
        const tweet: TweetRecord = {
            id: 1,
            content: 'Hello Twitter',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: null,
            thread_id: null,
            sequence_index: 0,
            parent_id: null,
            account_id: 1
        }

        mockDb.getPendingTweets.mockReturnValue([tweet])
        mockDb.getAccountById.mockReturnValue(account)

        await processor.processQueue()

        expect(mockDb.getAccountById).toHaveBeenCalledWith(1)
        expect(mockV2Client.tweet).toHaveBeenCalledWith({ text: 'Hello Twitter' })
        expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(1, 'sent', 'tweet_id_456')
    })

    it('should process a tweet with media', async () => {
        const tweet: TweetRecord = {
            id: 2,
            content: 'Tweet with image',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: 'path/to/image.jpg',
            thread_id: null,
            sequence_index: 0,
            parent_id: null,
            account_id: 1
        }

        mockDb.getPendingTweets.mockReturnValue([tweet])
        mockDb.getAccountById.mockReturnValue({ id: 1, app_key: 'k', app_secret: 's', access_token: 't', access_secret: 'as' })
            ; (fs.existsSync as any).mockReturnValue(true)
            ; (fs.readFile as any).mockResolvedValue(Buffer.from('dummy-data'))

        await processor.processQueue()

        expect(mockV1Client.uploadMedia).toHaveBeenCalled()
        expect(mockV2Client.tweet).toHaveBeenCalledWith({
            text: 'Tweet with image',
            media: { media_ids: ['media_id_123'] }
        })
        expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(2, 'sent', 'tweet_id_456')
    })

    it('should handle threaded tweets using parent_id', async () => {
        const tweet1: TweetRecord = {
            id: 10,
            content: 'Tweet 1',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: null,
            thread_id: 'thread_1',
            sequence_index: 0,
            parent_id: null,
            account_id: 1
        }

        const tweet2: TweetRecord = {
            id: 11,
            content: 'Tweet 2',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: null,
            thread_id: 'thread_1',
            sequence_index: 1,
            parent_id: '10', // In the DB we store the local ID of the parent tweet
            account_id: 1
        }

        mockDb.getPendingTweets.mockReturnValueOnce([tweet1]).mockReturnValueOnce([tweet2])
        mockDb.getAccountById.mockReturnValue({ id: 1, app_key: 'k', app_secret: 's', access_token: 't', access_secret: 'as' })
        // Mock getTweetById to return the actual Twitter ID for the reply
        mockDb.getTweetById.mockReturnValue({ tweet_id: 'tweet_id_10' })

        // Process first tweet
        await processor.processQueue()
        expect(mockV2Client.tweet).toHaveBeenCalledWith({ text: 'Tweet 1' })

        // Process second tweet
        await processor.processQueue()
        expect(mockV2Client.tweet).toHaveBeenCalledWith({
            text: 'Tweet 2',
            reply: { in_reply_to_tweet_id: 'tweet_id_10' }
        })
    })

    it('should mark tweet as failed if posting fails', async () => {
        const tweet: TweetRecord = {
            id: 3,
            content: 'Bad Tweet',
            status: 'pending',
            scheduled_at: Date.now(),
            media_path: null,
            thread_id: null,
            sequence_index: 0,
            parent_id: null,
            account_id: 1
        }

        mockDb.getPendingTweets.mockReturnValue([tweet])
        mockDb.getAccountById.mockReturnValue({ id: 1, app_key: 'k', app_secret: 's', access_token: 't', access_secret: 'as' })
        mockV2Client.tweet.mockRejectedValue(new Error('API Error'))

        await processor.processQueue()

        expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(3, 'failed')
    })
})

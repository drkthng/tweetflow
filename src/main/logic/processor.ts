import { TwitterApi } from 'twitter-api-v2'
import fs from 'fs-extra'
import { DatabaseService, TweetRecord } from '../services/database'

export class Processor {
    private db: DatabaseService
    private clients: Map<number, TwitterApi> = new Map()

    constructor(db: DatabaseService) {
        this.db = db
    }

    private getTwitterClient(accountId: number): TwitterApi {
        if (this.clients.has(accountId)) {
            return this.clients.get(accountId)!
        }

        const account = this.db.getAccountById(accountId)
        if (!account) {
            throw new Error(`Account not found: ${accountId}`)
        }

        const client = new TwitterApi({
            appKey: account.app_key,
            appSecret: account.app_secret,
            accessToken: account.access_token,
            accessSecret: account.access_secret
        })

        this.clients.set(accountId, client)
        return client
    }

    async processQueue(): Promise<void> {
        const now = Date.now()
        const pendingTweets = this.db.getPendingTweets(now)

        for (const tweet of pendingTweets) {
            try {
                await this.sendTweet(tweet)
            } catch (error: any) {
                console.error('Failed to send tweet:', error)
                if (tweet.id) {
                    let message = 'Unknown error'
                    if (error.data) {
                        if (error.data.detail) {
                            message = error.data.detail
                        } else if (error.data.errors && Array.isArray(error.data.errors) && error.data.errors.length > 0) {
                            message = error.data.errors[0].message
                        } else if (typeof error.data === 'string') {
                            message = error.data
                        }
                    } else {
                        message = error.message || 'Unknown error'
                    }
                    this.db.updateTweetStatus(tweet.id, 'failed', undefined, message)
                }
            }
        }
    }

    private async sendTweet(tweet: TweetRecord): Promise<void> {
        const twitter = this.getTwitterClient(tweet.account_id)
        const options: any = {}

        // 1. Handle Media
        if (tweet.media_path && fs.existsSync(tweet.media_path)) {
            const mediaData = await fs.readFile(tweet.media_path)
            const mediaId = await twitter.v1.uploadMedia(mediaData, { mimeType: 'image/jpeg' })
            options.media = { media_ids: [mediaId] }
        }

        // 2. Handle Threading (Reply)
        if (tweet.parent_id) {
            const parentTweet = this.db.getTweetById(Number(tweet.parent_id))
            if (parentTweet && parentTweet.tweet_id) {
                options.reply = { in_reply_to_tweet_id: parentTweet.tweet_id }
            }
        }

        // 3. Post to Twitter
        const response = await twitter.v2.tweet({
            text: tweet.content,
            ...options
        })

        // 4. Update Database
        if (tweet.id) {
            this.db.updateTweetStatus(tweet.id, 'sent', response.data.id)
        }
    }
}

import { TwitterApi } from 'twitter-api-v2'
import fs from 'fs-extra'
import { DatabaseService, TweetRecord } from '../services/database'

export class Processor {
    private db: DatabaseService
    private twitter: TwitterApi

    constructor(db: DatabaseService, twitter: TwitterApi) {
        this.db = db
        this.twitter = twitter
    }

    async processQueue(): Promise<void> {
        const now = Date.now()
        const pendingTweets = this.db.getPendingTweets(now)

        for (const tweet of pendingTweets) {
            try {
                await this.sendTweet(tweet)
            } catch (error) {
                console.error('Failed to send tweet:', error)
                if (tweet.id) {
                    this.db.updateTweetStatus(tweet.id, 'failed')
                }
            }
        }
    }

    private async sendTweet(tweet: TweetRecord): Promise<void> {
        const options: any = {}

        // 1. Handle Media
        if (tweet.media_path && fs.existsSync(tweet.media_path)) {
            const mediaData = await fs.readFile(tweet.media_path)
            const mediaId = await this.twitter.v1.uploadMedia(mediaData, { mimeType: 'image/jpeg' })
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
        const response = await this.twitter.v2.tweet({
            text: tweet.content,
            ...options
        })

        // 4. Update Database
        if (tweet.id) {
            this.db.updateTweetStatus(tweet.id, 'sent', response.data.id)
        }
    }
}

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
        // Get all pending tweets
        const pendingTweets = this.db.getPendingTweets(now + 1000 * 60 * 60 * 24 * 365)

        // 1. Process Scheduled Tweets
        const scheduledTweets = pendingTweets.filter(t => t.mode === 'scheduled' && t.scheduled_at <= now)
        for (const tweet of scheduledTweets) {
            try {
                await this.sendTweet(tweet)
            } catch (error: any) {
                console.error('Failed to send scheduled tweet:', error)
                this.handleSendError(tweet, error)
            }
        }

        // 2. Process Queued Tweets
        const queuedTweets = pendingTweets.filter(t => t.mode === 'queued' && t.scheduled_at <= now)
        if (queuedTweets.length > 0) {
            const slots = this.db.getQueueSlots()
            const nowObj = new Date(now)
            const todayStr = nowObj.toISOString().split('T')[0]

            for (const slot of slots) {
                // Check if slot time has passed today
                const [slotH, slotM] = slot.time_str.split(':').map(Number)
                const slotTimeToday = new Date(nowObj)
                slotTimeToday.setHours(slotH, slotM, 0, 0)

                if (now >= slotTimeToday.getTime()) {
                    // Check if slot was already used today
                    const lastSentDate = new Date(slot.last_sent_at).toISOString().split('T')[0]
                    if (lastSentDate !== todayStr) {
                        // Slot is available! Find the oldest queued tweet
                        const tweet = queuedTweets[0] // Already sorted by scheduled_at ASC in db query
                        try {
                            await this.sendTweet(tweet)
                            this.db.updateQueueSlotLastSent(slot.id!, now)
                            break // Only one queued tweet per processor run/slot check
                        } catch (error: any) {
                            console.error('Failed to send queued tweet:', error)
                            this.handleSendError(tweet, error)
                        }
                    }
                }
            }
        }
    }

    private handleSendError(tweet: TweetRecord, error: any) {
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

            // Log failure
            this.db.addSendLog({
                tweet_id: tweet.id,
                account_id: tweet.account_id,
                content: tweet.content,
                sent_at: Date.now(),
                status: 'failed',
                error_message: message
            })
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

        // 4. Update Database & Handle Recurrence
        if (tweet.id) {
            // Add to send logs
            this.db.addSendLog({
                tweet_id: tweet.id,
                account_id: tweet.account_id,
                content: tweet.content,
                sent_at: Date.now(),
                status: 'sent',
                twitter_tweet_id: response.data.id
            })

            if (tweet.is_recurring) {
                // Return to queue with updated send count and next date
                this.db.updateTweet(tweet.id, {
                    status: 'pending',
                    mode: 'queued', // Once it's sent once, it becomes part of the queue regardless if it was scheduled first
                    send_count: (tweet.send_count || 0) + 1,
                    scheduled_at: Date.now() + (tweet.recurrence_interval || 15552000000)
                })
            } else {
                this.db.updateTweetStatus(tweet.id, 'sent', response.data.id)
            }
        }
    }
}

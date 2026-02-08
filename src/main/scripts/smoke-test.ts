import { TwitterApi } from 'twitter-api-v2'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config()

const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY!,
    appSecret: process.env.TWITTER_APP_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_SECRET!
})

async function smokeTest() {
    console.log('--- Starting TweetFlow Smoke Test ---')

    try {
        console.log('1. Verifying credentials...')
        const me = await client.v2.me()
        console.log(`Logged in as: @${me.data.username}`)

        console.log('2. Attempting to post a test tweet...')
        const tweet = await client.v2.tweet(`Smoke test from TweetFlow Scheduler at ${new Date().toISOString()}`)
        console.log(`Tweet posted successfully! ID: ${tweet.data.id}`)

        console.log('\nSUCCESS: Twitter API connectivity verified.')
    } catch (error: any) {
        console.error('\nERROR: Smoke test failed.')
        console.error(error.data || error.message)
        process.exit(1)
    }
}

smokeTest()

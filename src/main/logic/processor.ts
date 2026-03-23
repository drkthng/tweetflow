import { TwitterApi, ApiResponseError, ApiRequestError, ApiPartialResponseError } from "twitter-api-v2";
import fs from "fs-extra";
import { DatabaseService, TweetRecord } from "../services/database";

/** Max retries before a tweet is permanently failed */
const MAX_RETRIES = 5;

/** Base delay for exponential backoff (ms). Actual delay = BASE * 2^retryCount */
const RETRY_BASE_DELAY_MS = 15_000; // 15s → 30s → 60s → 120s → 240s

/** Cap the maximum backoff delay */
const RETRY_MAX_DELAY_MS = 5 * 60_000; // 5 minutes

/**
 * HTTP status codes and error conditions that are transient and should be retried.
 * - 429: Rate limited
 * - 500: Internal server error
 * - 502: Bad gateway
 * - 503: Service unavailable (known X API issue, March 2026)
 * - 504: Gateway timeout
 */
const TRANSIENT_HTTP_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Classify an error thrown during tweet sending.
 * Returns 'transient' for errors that may resolve on retry,
 * 'permanent' for errors that will never succeed (auth, validation, etc).
 */
function classifyError(error: unknown): { kind: "transient" | "permanent"; message: string; retryAfterMs?: number } {
  // Network-level errors (DNS failure, connection refused, timeout)
  if (error instanceof ApiRequestError) {
    return {
      kind: "transient",
      message: `Network error: ${error.requestError.message}`,
    };
  }

  // Partial response (connection dropped mid-response)
  if (error instanceof ApiPartialResponseError) {
    return {
      kind: "transient",
      message: `Partial response: ${error.responseError.message}`,
    };
  }

  // HTTP response errors with status codes
  if (error instanceof ApiResponseError) {
    const code = error.code;

    // Rate limit: use the API's retry-after hint if available
    if (code === 429) {
      let retryAfterMs = RETRY_BASE_DELAY_MS;
      if (error.rateLimit?.reset) {
        const resetMs = error.rateLimit.reset * 1000;
        const waitMs = resetMs - Date.now();
        if (waitMs > 0 && waitMs < RETRY_MAX_DELAY_MS) {
          retryAfterMs = waitMs;
        }
      }
      return {
        kind: "transient",
        message: `Rate limited (429)`,
        retryAfterMs,
      };
    }

    if (TRANSIENT_HTTP_CODES.has(code)) {
      return {
        kind: "transient",
        message: `HTTP ${code}: ${extractErrorMessage(error)}`,
      };
    }

    // Everything else (400, 401, 403, 404, 409, 422...) is permanent
    return {
      kind: "permanent",
      message: `HTTP ${code}: ${extractErrorMessage(error)}`,
    };
  }

  // Generic JS errors (e.g. file system errors during media upload)
  if (error instanceof Error) {
    // Node.js network-related error codes
    const networkCodes = ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE", "EAI_AGAIN"];
    const anyErr = error as any;
    if (anyErr.code && networkCodes.includes(anyErr.code)) {
      return {
        kind: "transient",
        message: `Network error (${anyErr.code}): ${error.message}`,
      };
    }
    return {
      kind: "permanent",
      message: error.message,
    };
  }

  return {
    kind: "permanent",
    message: String(error),
  };
}

/** Extract a human-readable message from an ApiResponseError */
function extractErrorMessage(error: ApiResponseError): string {
  if (error.data?.detail) return error.data.detail;
  if (error.data?.errors && Array.isArray(error.data.errors) && error.data.errors.length > 0) {
    const first = error.data.errors[0];
    return "message" in first ? (first as any).message : (first as any).detail ?? "Unknown API error";
  }
  if (error.data?.error) return error.data.error;
  return error.message || "Unknown error";
}

/** Calculate backoff delay: min(BASE * 2^retryCount, MAX) with ±20% jitter */
function calculateBackoff(retryCount: number, hintMs?: number): number {
  if (hintMs) return hintMs;
  const exponential = Math.min(RETRY_BASE_DELAY_MS * Math.pow(2, retryCount), RETRY_MAX_DELAY_MS);
  // Add jitter: ±20%
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
  return Math.round(exponential + jitter);
}

export class Processor {
  private db: DatabaseService;
  private clients: Map<number, TwitterApi> = new Map();

  constructor(db: DatabaseService) {
    this.db = db;
  }

  private getTwitterClient(accountId: number): TwitterApi {
    if (this.clients.has(accountId)) {
      return this.clients.get(accountId)!;
    }

    const account = this.db.getAccountById(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const client = new TwitterApi({
      appKey: account.app_key,
      appSecret: account.app_secret,
      accessToken: account.access_token,
      accessSecret: account.access_secret,
    });

    this.clients.set(accountId, client);
    return client;
  }

  async processQueue(): Promise<void> {
    // In manual mode, the processor is a no-op — posting is done by the user
    const postingMode = this.db.getSetting("posting_mode");
    if (postingMode === "manual") return;

    const now = Date.now();
    // getPendingTweets already filters out tweets whose next_retry_at is in the future
    const pendingTweets = this.db.getPendingTweets(
      now + 1000 * 60 * 60 * 24 * 365,
    );

    // Track threads that failed during this processing run so we skip
    // their children even before the DB state is visible in the next query.
    const failedThreads = new Set<string>();

    // 1. Process Scheduled Tweets
    const scheduledTweets = pendingTweets.filter(
      (t) => t.mode === "scheduled" && t.scheduled_at <= now,
    );
    for (const tweet of scheduledTweets) {
      if (this.isThreadBlocked(tweet, failedThreads)) continue;

      try {
        await this.sendTweet(tweet);
      } catch (error: unknown) {
        this.handleSendError(tweet, error, failedThreads);
      }
    }

    // 2. Process Queued Tweets
    const queuedTweets = pendingTweets.filter(
      (t) => t.mode === "queued" && t.scheduled_at <= now,
    );
    if (queuedTweets.length > 0) {
      const slots = this.db.getQueueSlots();
      const nowObj = new Date(now);
      const todayStr = nowObj.toISOString().split("T")[0];

      for (const slot of slots) {
        const [slotH, slotM] = slot.time_str.split(":").map(Number);
        const slotTimeToday = new Date(nowObj);
        slotTimeToday.setHours(slotH, slotM, 0, 0);

        if (now >= slotTimeToday.getTime()) {
          const lastSentDate = new Date(slot.last_sent_at)
            .toISOString()
            .split("T")[0];
          if (lastSentDate !== todayStr) {
            // Find the first queued tweet that isn't blocked by a failed thread
            const tweet = queuedTweets.find((t) => !this.isThreadBlocked(t, failedThreads));
            if (!tweet) break;

            try {
              await this.sendTweet(tweet);
              this.db.updateQueueSlotLastSent(slot.id!, now);
              break;
            } catch (error: unknown) {
              this.handleSendError(tweet, error, failedThreads);
            }
          }
        }
      }
    }
  }

  /**
   * Check if a tweet belongs to a thread where an earlier tweet has failed.
   * This prevents children from posting as standalone tweets when the parent
   * hasn't been sent yet.
   */
  private isThreadBlocked(tweet: TweetRecord, failedThreads: Set<string>): boolean {
    // Not a thread child — not blocked
    if (!tweet.parent_id) return false;

    // Thread already known-failed this run
    if (tweet.thread_id && failedThreads.has(tweet.thread_id)) return true;

    // Check the parent's actual state in the DB
    const parent = this.db.getTweetById(Number(tweet.parent_id));
    if (!parent) return true; // Parent doesn't exist — don't post orphan

    if (parent.status === "failed") {
      if (tweet.thread_id) failedThreads.add(tweet.thread_id);
      return true;
    }

    // Parent is still pending (not yet sent) — skip this child for now,
    // the parent will be processed first (ordered by scheduled_at/sequence_index)
    if (!parent.tweet_id) return true;

    return false;
  }

  private handleSendError(tweet: TweetRecord, error: unknown, failedThreads: Set<string>) {
    if (!tweet.id) return;

    const classified = classifyError(error);
    const retryCount = (tweet.retry_count || 0);

    if (classified.kind === "transient" && retryCount < MAX_RETRIES) {
      // Schedule for retry with exponential backoff
      const delay = calculateBackoff(retryCount, classified.retryAfterMs);
      const nextRetryAt = Date.now() + delay;
      const newRetryCount = retryCount + 1;

      this.db.setTweetRetryState(tweet.id, newRetryCount, nextRetryAt, classified.message);

      console.log(
        `[processor] Tweet ${tweet.id} transient error (attempt ${newRetryCount}/${MAX_RETRIES}), ` +
        `retry in ${Math.round(delay / 1000)}s: ${classified.message}`
      );

      // Log the retry attempt
      this.db.addSendLog({
        tweet_id: tweet.id,
        account_id: tweet.account_id,
        content: tweet.content,
        sent_at: Date.now(),
        status: "retry",
        error_message: `Attempt ${newRetryCount}/${MAX_RETRIES}: ${classified.message}`,
      });
    } else {
      // Permanent failure (or retries exhausted)
      const reason = classified.kind === "transient"
        ? `${classified.message} (retries exhausted after ${retryCount + 1} attempts)`
        : classified.message;

      this.db.updateTweetStatus(tweet.id, "failed", undefined, reason);

      this.db.addSendLog({
        tweet_id: tweet.id,
        account_id: tweet.account_id,
        content: tweet.content,
        sent_at: Date.now(),
        status: "failed",
        error_message: reason,
      });

      console.error(`[processor] Tweet ${tweet.id} permanently failed: ${reason}`);

      // Halt the rest of the thread
      if (tweet.thread_id) {
        failedThreads.add(tweet.thread_id);
        const halted = this.db.failThreadChildren(
          tweet.thread_id,
          tweet.sequence_index,
          `Thread halted: parent tweet ${tweet.id} failed — ${reason}`,
        );
        if (halted > 0) {
          console.log(`[processor] Halted ${halted} remaining tweet(s) in thread ${tweet.thread_id}`);
        }
      }
    }
  }

  private async sendTweet(tweet: TweetRecord): Promise<void> {
    const twitter = this.getTwitterClient(tweet.account_id);
    const options: any = {};

    // 1. Handle Media
    if (tweet.media_path && fs.existsSync(tweet.media_path)) {
      const mediaData = await fs.readFile(tweet.media_path);
      const mediaId = await twitter.v1.uploadMedia(mediaData, {
        mimeType: "image/jpeg",
      });
      options.media = { media_ids: [mediaId] };
    }

    // 2. Handle Threading (Reply)
    if (tweet.parent_id) {
      const parentTweet = this.db.getTweetById(Number(tweet.parent_id));
      if (parentTweet && parentTweet.tweet_id) {
        options.reply = { in_reply_to_tweet_id: parentTweet.tweet_id };
      } else {
        // Parent tweet was never sent — this should not happen because
        // isThreadBlocked should have caught it, but guard against it.
        throw new Error(
          `Cannot send thread reply: parent tweet ${tweet.parent_id} has no twitter ID (status: ${parentTweet?.status ?? "not found"})`,
        );
      }
    }

    // 3. Post to Twitter
    const response = await twitter.v2.tweet({
      text: tweet.content,
      ...options,
    });

    // 4. Update Database & Handle Recurrence
    if (tweet.id) {
      // Clear retry state on success
      this.db.addSendLog({
        tweet_id: tweet.id,
        account_id: tweet.account_id,
        content: tweet.content,
        sent_at: Date.now(),
        status: "sent",
        twitter_tweet_id: response.data.id,
      });

      if (tweet.is_recurring) {
        this.db.updateTweet(tweet.id, {
          status: "pending",
          mode: "queued",
          send_count: (tweet.send_count || 0) + 1,
          scheduled_at: Date.now() + (tweet.recurrence_interval || 15552000000),
          retry_count: 0,
          next_retry_at: null as any,
        });
      } else {
        this.db.updateTweetStatus(tweet.id, "sent", response.data.id);
      }
    }
  }
}

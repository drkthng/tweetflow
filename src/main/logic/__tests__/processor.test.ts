import { describe, it, expect, vi, beforeEach } from "vitest";
import { Processor } from "../processor";
import { TweetRecord } from "../../services/database";
import { TwitterApi, ApiResponseError, ApiRequestError, ETwitterApiError } from "twitter-api-v2";
import fs from "fs-extra";

// Mocking dependencies
vi.mock("../../services/database");
vi.mock("twitter-api-v2");
vi.mock("fs-extra");

/** Helper to build a TweetRecord with sensible defaults */
function makeTweet(overrides: Partial<TweetRecord> & { id: number; content: string }): TweetRecord {
  return {
    status: "pending",
    scheduled_at: Date.now() - 1000,
    media_path: null,
    thread_id: null,
    sequence_index: 0,
    parent_id: null,
    account_id: 1,
    mode: "scheduled",
    is_recurring: false,
    send_count: 0,
    recurrence_interval: 15552000000,
    retry_count: 0,
    ...overrides,
  };
}

/** Build a fake ApiResponseError with the given HTTP status code */
function makeApiResponseError(code: number, message = "API error"): ApiResponseError {
  const err = new Error(message) as any;
  // Mimic the ApiResponseError shape that classifyError inspects
  Object.setPrototypeOf(err, ApiResponseError.prototype);
  err.type = ETwitterApiError.Response;
  err.code = code;
  err.data = { detail: message };
  err.error = true;
  return err as ApiResponseError;
}

/** Build a fake ApiRequestError (network-level failure) */
function makeApiRequestError(message = "ECONNRESET"): ApiRequestError {
  const err = new Error(`Network failure: ${message}`) as any;
  Object.setPrototypeOf(err, ApiRequestError.prototype);
  err.type = ETwitterApiError.Request;
  err.error = true;
  // ApiRequestError exposes the underlying error via requestError getter
  Object.defineProperty(err, "requestError", { get: () => new Error(message) });
  return err as ApiRequestError;
}

const DUMMY_ACCOUNT = {
  id: 1,
  app_key: "k",
  app_secret: "s",
  access_token: "t",
  access_secret: "as",
};

describe("Processor", () => {
  let processor: Processor;
  let mockDb: any;
  let mockV1Client: any;
  let mockV2Client: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    mockDb = {
      getPendingTweets: vi.fn().mockReturnValue([]),
      updateTweetStatus: vi.fn(),
      updateTweet: vi.fn(),
      getTweetById: vi.fn(),
      getAccountById: vi.fn().mockReturnValue(DUMMY_ACCOUNT),
      addSendLog: vi.fn(),
      getQueueSlots: vi.fn().mockReturnValue([]),
      failThreadChildren: vi.fn().mockReturnValue(0),
      setTweetRetryState: vi.fn(),
      getSetting: vi.fn().mockReturnValue("auto"), // Default to auto mode for existing tests
    };

    mockV1Client = {
      uploadMedia: vi.fn().mockResolvedValue("media_id_123"),
    };

    mockV2Client = {
      tweet: vi.fn().mockResolvedValue({ data: { id: "tweet_id_456" } }),
    };

    const mockTwitter = { v1: mockV1Client, v2: mockV2Client };
    vi.mocked(TwitterApi).mockImplementation(() => mockTwitter as any);
    processor = new Processor(mockDb as any);
  });

  // ──────────────────────────────────────────────
  // Posting mode
  // ──────────────────────────────────────────────

  it("should skip processing entirely in manual mode", async () => {
    mockDb.getSetting.mockReturnValue("manual");
    const tweet = makeTweet({ id: 1, content: "Should not send" });
    mockDb.getPendingTweets.mockReturnValue([tweet]);

    await processor.processQueue();

    expect(mockDb.getPendingTweets).not.toHaveBeenCalled();
    expect(mockV2Client.tweet).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Basic sending
  // ──────────────────────────────────────────────

  it("should process a single tweet without media", async () => {
    const tweet = makeTweet({ id: 1, content: "Hello Twitter" });
    mockDb.getPendingTweets.mockReturnValue([tweet]);

    await processor.processQueue();

    expect(mockDb.getAccountById).toHaveBeenCalledWith(1);
    expect(mockV2Client.tweet).toHaveBeenCalledWith({ text: "Hello Twitter" });
    expect(mockDb.addSendLog).toHaveBeenCalled();
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(1, "sent", "tweet_id_456");
  });

  it("should process a tweet with media", async () => {
    const tweet = makeTweet({ id: 2, content: "Tweet with image", media_path: "path/to/image.jpg" });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFile as any).mockResolvedValue(Buffer.from("dummy-data"));

    await processor.processQueue();

    expect(mockV1Client.uploadMedia).toHaveBeenCalled();
    expect(mockV2Client.tweet).toHaveBeenCalledWith({
      text: "Tweet with image",
      media: { media_ids: ["media_id_123"] },
    });
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(2, "sent", "tweet_id_456");
  });

  // ──────────────────────────────────────────────
  // Threading
  // ──────────────────────────────────────────────

  it("should send threaded tweets with reply option when parent has tweet_id", async () => {
    const tweet1 = makeTweet({ id: 10, content: "Tweet 1", thread_id: "thread_1", sequence_index: 0 });
    const tweet2 = makeTweet({ id: 11, content: "Tweet 2", thread_id: "thread_1", sequence_index: 1, parent_id: "10" });

    mockDb.getPendingTweets.mockReturnValue([tweet1, tweet2]);
    // After tweet1 is sent, getTweetById for the parent returns the sent record
    mockDb.getTweetById.mockReturnValue({ id: 10, tweet_id: "tweet_id_10", status: "sent" });

    await processor.processQueue();

    expect(mockV2Client.tweet).toHaveBeenCalledWith({ text: "Tweet 1" });
    expect(mockV2Client.tweet).toHaveBeenCalledWith({
      text: "Tweet 2",
      reply: { in_reply_to_tweet_id: "tweet_id_10" },
    });
  });

  it("should skip thread children when parent has no tweet_id yet", async () => {
    const tweet2 = makeTweet({ id: 11, content: "Tweet 2", thread_id: "thread_1", sequence_index: 1, parent_id: "10" });
    mockDb.getPendingTweets.mockReturnValue([tweet2]);
    // Parent exists but hasn't been sent yet (no tweet_id)
    mockDb.getTweetById.mockReturnValue({ id: 10, tweet_id: null, status: "pending" });

    await processor.processQueue();

    expect(mockV2Client.tweet).not.toHaveBeenCalled();
  });

  it("should skip thread children when parent has failed", async () => {
    const tweet2 = makeTweet({ id: 11, content: "Tweet 2", thread_id: "thread_1", sequence_index: 1, parent_id: "10" });
    mockDb.getPendingTweets.mockReturnValue([tweet2]);
    mockDb.getTweetById.mockReturnValue({ id: 10, tweet_id: null, status: "failed" });

    await processor.processQueue();

    expect(mockV2Client.tweet).not.toHaveBeenCalled();
  });

  it("should halt thread children when a parent tweet fails permanently", async () => {
    const tweet1 = makeTweet({ id: 10, content: "Tweet 1", thread_id: "thread_1", sequence_index: 0 });
    const tweet2 = makeTweet({ id: 11, content: "Tweet 2", thread_id: "thread_1", sequence_index: 1, parent_id: "10" });

    mockDb.getPendingTweets.mockReturnValue([tweet1, tweet2]);
    mockDb.failThreadChildren.mockReturnValue(1);
    // Permanent error (403 Forbidden)
    mockV2Client.tweet.mockRejectedValueOnce(makeApiResponseError(403, "Forbidden"));

    await processor.processQueue();

    // tweet1 fails permanently
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(10, "failed", undefined, expect.stringContaining("403"));
    // Thread children are halted in DB
    expect(mockDb.failThreadChildren).toHaveBeenCalledWith(
      "thread_1",
      0, // sequence_index of the failed tweet
      expect.stringContaining("Thread halted"),
    );
    // tweet2 should NOT have been sent (blocked by in-memory failedThreads set)
    expect(mockV2Client.tweet).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────
  // Retry logic — transient errors
  // ──────────────────────────────────────────────

  it("should schedule retry for 503 Service Unavailable", async () => {
    const tweet = makeTweet({ id: 1, content: "test", retry_count: 0 });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(503, "Service Unavailable"));

    await processor.processQueue();

    // Should NOT be marked as failed
    expect(mockDb.updateTweetStatus).not.toHaveBeenCalled();
    // Should schedule a retry
    expect(mockDb.setTweetRetryState).toHaveBeenCalledWith(
      1,
      1, // retry_count incremented to 1
      expect.any(Number), // next_retry_at timestamp
      expect.stringContaining("503"),
    );
    // Should log the retry attempt
    expect(mockDb.addSendLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: "retry" }),
    );
  });

  it("should schedule retry for 429 Rate Limited", async () => {
    const tweet = makeTweet({ id: 1, content: "test", retry_count: 0 });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(429, "Too Many Requests"));

    await processor.processQueue();

    expect(mockDb.updateTweetStatus).not.toHaveBeenCalled();
    expect(mockDb.setTweetRetryState).toHaveBeenCalledWith(1, 1, expect.any(Number), expect.stringContaining("429"));
  });

  it("should schedule retry for network errors (ApiRequestError)", async () => {
    const tweet = makeTweet({ id: 1, content: "test", retry_count: 0 });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(makeApiRequestError("ECONNRESET"));

    await processor.processQueue();

    expect(mockDb.updateTweetStatus).not.toHaveBeenCalled();
    expect(mockDb.setTweetRetryState).toHaveBeenCalledWith(1, 1, expect.any(Number), expect.stringContaining("Network error"));
  });

  it("should fail permanently after MAX_RETRIES exhausted", async () => {
    const tweet = makeTweet({ id: 1, content: "test", retry_count: 5 }); // Already at max
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(503, "Service Unavailable"));

    await processor.processQueue();

    // Should be permanently failed now
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(
      1,
      "failed",
      undefined,
      expect.stringContaining("retries exhausted"),
    );
    // Should NOT schedule another retry
    expect(mockDb.setTweetRetryState).not.toHaveBeenCalled();
  });

  it("should increase backoff delay with each retry", async () => {
    // First retry
    const tweet1 = makeTweet({ id: 1, content: "test", retry_count: 0 });
    mockDb.getPendingTweets.mockReturnValue([tweet1]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(503));

    await processor.processQueue();
    const firstCall = mockDb.setTweetRetryState.mock.calls[0];
    const firstDelay = firstCall[2] - Date.now(); // next_retry_at - now

    vi.clearAllMocks();
    mockDb.getQueueSlots.mockReturnValue([]);
    mockDb.getAccountById.mockReturnValue(DUMMY_ACCOUNT);
    vi.mocked(TwitterApi).mockImplementation(() => ({ v1: mockV1Client, v2: mockV2Client } as any));

    // Third retry — should have longer backoff
    const tweet3 = makeTweet({ id: 1, content: "test", retry_count: 2 });
    mockDb.getPendingTweets.mockReturnValue([tweet3]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(503));

    await processor.processQueue();
    const thirdCall = mockDb.setTweetRetryState.mock.calls[0];
    const thirdDelay = thirdCall[2] - Date.now();

    // Third retry delay should be meaningfully longer than first
    // (4x base due to 2^2, but jitter means we check >2x)
    expect(thirdDelay).toBeGreaterThan(firstDelay * 1.5);
  });

  // ──────────────────────────────────────────────
  // Permanent errors — no retry
  // ──────────────────────────────────────────────

  it("should fail immediately for 401 Unauthorized (permanent)", async () => {
    const tweet = makeTweet({ id: 1, content: "test" });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(401, "Unauthorized"));

    await processor.processQueue();

    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(1, "failed", undefined, expect.stringContaining("401"));
    expect(mockDb.setTweetRetryState).not.toHaveBeenCalled();
  });

  it("should fail immediately for 403 Forbidden (permanent)", async () => {
    const tweet = makeTweet({ id: 1, content: "test" });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(403, "Forbidden"));

    await processor.processQueue();

    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(1, "failed", undefined, expect.stringContaining("403"));
    expect(mockDb.setTweetRetryState).not.toHaveBeenCalled();
  });

  it("should fail immediately for generic JS errors (permanent)", async () => {
    const tweet = makeTweet({ id: 1, content: "test" });
    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockV2Client.tweet.mockRejectedValue(new Error("Something unexpected"));

    await processor.processQueue();

    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(1, "failed", undefined, "Something unexpected");
    expect(mockDb.setTweetRetryState).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Thread halt + retry interaction
  // ──────────────────────────────────────────────

  it("should NOT halt thread children during transient retry", async () => {
    const tweet1 = makeTweet({ id: 10, content: "Tweet 1", thread_id: "thread_1", sequence_index: 0, retry_count: 0 });
    mockDb.getPendingTweets.mockReturnValue([tweet1]);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(503, "Service Unavailable"));

    await processor.processQueue();

    // Should retry, not fail permanently
    expect(mockDb.setTweetRetryState).toHaveBeenCalled();
    // Should NOT halt thread children — the parent might succeed on retry
    expect(mockDb.failThreadChildren).not.toHaveBeenCalled();
  });

  it("should halt thread children when transient retries are exhausted", async () => {
    const tweet1 = makeTweet({ id: 10, content: "Tweet 1", thread_id: "thread_1", sequence_index: 0, retry_count: 5 });
    mockDb.getPendingTweets.mockReturnValue([tweet1]);
    mockDb.failThreadChildren.mockReturnValue(3);
    mockV2Client.tweet.mockRejectedValue(makeApiResponseError(503, "Service Unavailable"));

    await processor.processQueue();

    // Now it's permanent — retries exhausted
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(10, "failed", undefined, expect.stringContaining("retries exhausted"));
    // And thread children should be halted
    expect(mockDb.failThreadChildren).toHaveBeenCalledWith("thread_1", 0, expect.stringContaining("Thread halted"));
  });

  // ──────────────────────────────────────────────
  // Recurring tweets
  // ──────────────────────────────────────────────

  it("should reset retry_count on successful recurring tweet", async () => {
    const tweet = makeTweet({ id: 1, content: "Recurring", is_recurring: true, retry_count: 3 });
    mockDb.getPendingTweets.mockReturnValue([tweet]);

    await processor.processQueue();

    expect(mockDb.updateTweet).toHaveBeenCalledWith(1, expect.objectContaining({
      status: "pending",
      retry_count: 0,
      next_retry_at: null,
    }));
  });
});

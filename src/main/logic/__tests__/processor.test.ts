import { describe, it, expect, vi, beforeEach } from "vitest";
import { Processor } from "../processor";
import { TweetRecord } from "../../services/database";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs-extra";

// Mocking dependencies
vi.mock("../../services/database");
vi.mock("twitter-api-v2");
vi.mock("fs-extra");

describe("Processor", () => {
  let processor: Processor;
  let mockDb: any;
  let mockTwitter: any;
  let mockV1Client: any;
  let mockV2Client: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const now = 1700000000000;
    vi.setSystemTime(now);

    mockDb = {
      getPendingTweets: vi.fn(),
      updateTweetStatus: vi.fn(),
      updateTweet: vi.fn(),
      getTweetById: vi.fn(),
      getAccountById: vi.fn(),
      addSendLog: vi.fn(),
      getQueueSlots: vi.fn().mockReturnValue([]),
    };

    mockV1Client = {
      uploadMedia: vi.fn().mockResolvedValue("media_id_123"),
    };

    mockV2Client = {
      tweet: vi.fn().mockResolvedValue({ data: { id: "tweet_id_456" } }),
    };

    mockTwitter = {
      v1: mockV1Client,
      v2: mockV2Client,
    };

    vi.mocked(TwitterApi).mockImplementation(() => mockTwitter);
    processor = new Processor(mockDb as any);
  });

  it("should process a single tweet without media using correct account", async () => {
    const now = Date.now();
    const account = {
      id: 1,
      app_key: "key",
      app_secret: "secret",
      access_token: "token",
      access_secret: "secret",
    };
    const tweet: TweetRecord = {
      id: 1,
      content: "Hello Twitter",
      status: "pending",
      scheduled_at: now - 1000,
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: 1,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    };

    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockDb.getAccountById.mockReturnValue(account);

    await processor.processQueue();

    expect(mockDb.getAccountById).toHaveBeenCalledWith(1);
    expect(mockV2Client.tweet).toHaveBeenCalledWith({ text: "Hello Twitter" });
    expect(mockDb.addSendLog).toHaveBeenCalled();
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(
      1,
      "sent",
      "tweet_id_456",
    );
  });

  it("should process a tweet with media", async () => {
    const now = Date.now();
    const tweet: TweetRecord = {
      id: 2,
      content: "Tweet with image",
      status: "pending",
      scheduled_at: now - 1000,
      media_path: "path/to/image.jpg",
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: 1,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    };

    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockDb.getAccountById.mockReturnValue({
      id: 1,
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFile as any).mockResolvedValue(Buffer.from("dummy-data"));

    await processor.processQueue();

    expect(mockV1Client.uploadMedia).toHaveBeenCalled();
    expect(mockV2Client.tweet).toHaveBeenCalledWith({
      text: "Tweet with image",
      media: { media_ids: ["media_id_123"] },
    });
    expect(mockDb.addSendLog).toHaveBeenCalled();
    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(
      2,
      "sent",
      "tweet_id_456",
    );
  });

  it("should handle threaded tweets using parent_id", async () => {
    const now = Date.now();
    const tweet1: TweetRecord = {
      id: 10,
      content: "Tweet 1",
      status: "pending",
      scheduled_at: now - 1000,
      media_path: null,
      thread_id: "thread_1",
      sequence_index: 0,
      parent_id: null,
      account_id: 1,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    };

    const tweet2: TweetRecord = {
      id: 11,
      content: "Tweet 2",
      status: "pending",
      scheduled_at: now - 500,
      media_path: null,
      thread_id: "thread_1",
      sequence_index: 1,
      parent_id: "10",
      account_id: 1,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    };

    mockDb.getPendingTweets
      .mockReturnValueOnce([tweet1, tweet2])
      .mockReturnValueOnce([tweet2]);
    mockDb.getAccountById.mockReturnValue({
      id: 1,
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    mockDb.getTweetById.mockReturnValue({ tweet_id: "tweet_id_10" });

    await processor.processQueue();

    // It processes all scheduled tweets in one go if they are due
    expect(mockV2Client.tweet).toHaveBeenCalledWith({ text: "Tweet 1" });
    expect(mockV2Client.tweet).toHaveBeenCalledWith({
      text: "Tweet 2",
      reply: { in_reply_to_tweet_id: "tweet_id_10" },
    });
  });

  it("should mark tweet as failed if posting fails", async () => {
    const now = Date.now();
    const tweet: TweetRecord = {
      id: 3,
      content: "Bad Tweet",
      status: "pending",
      scheduled_at: now - 1000,
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: 1,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    };

    mockDb.getPendingTweets.mockReturnValue([tweet]);
    mockDb.getAccountById.mockReturnValue({
      id: 1,
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    mockV2Client.tweet.mockRejectedValue(new Error("API Error"));

    await processor.processQueue();

    expect(mockDb.updateTweetStatus).toHaveBeenCalledWith(
      3,
      "failed",
      undefined,
      "API Error",
    );
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseService } from "../database";

describe("DatabaseService", () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    // Use in-memory database for tests to avoid file lock/permission issues
    dbService = new DatabaseService(":memory:");
    dbService.init();
  });

  afterEach(() => {
    if (dbService) {
      dbService.close();
    }
  });

  it("should create the tweets and accounts tables with correct columns", () => {
    const tweetTableInfo = dbService.getTableInfo("tweets") as any[];
    const tweetColumns = tweetTableInfo.map((col: any) => col.name);

    expect(tweetColumns).toContain("id");
    expect(tweetColumns).toContain("content");
    expect(tweetColumns).toContain("status");
    expect(tweetColumns).toContain("scheduled_at");
    expect(tweetColumns).toContain("account_id");

    const accountTableInfo = dbService.getTableInfo("accounts") as any[];
    const accountColumns = accountTableInfo.map((col: any) => col.name);

    expect(accountColumns).toContain("id");
    expect(accountColumns).toContain("name");
    expect(accountColumns).toContain("app_key");
    expect(accountColumns).toContain("app_secret");
    expect(accountColumns).toContain("access_token");
    expect(accountColumns).toContain("access_secret");
  });

  it("should create and retrieve an account", () => {
    const account = {
      name: "Test Account",
      app_key: "key",
      app_secret: "secret",
      access_token: "token",
      access_secret: "token_secret",
    };

    const id = dbService.createAccount(account);
    const retrieved = dbService.getAccountById(id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe(account.name);
    expect(retrieved?.app_key).toBe(account.app_key);
  });

  it("should insert and retrieve a tweet with account_id", () => {
    const accountId = dbService.createAccount({
      name: "Test Account",
      app_key: "key",
      app_secret: "secret",
      access_token: "token",
      access_secret: "token_secret",
    });

    const tweet: any = {
      content: "Hello World",
      status: "pending" as const,
      scheduled_at: Date.now(),
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: accountId,
      mode: "scheduled" as const,
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    };

    const id = dbService.createTweet(tweet);
    const retrieved = dbService.getTweetById(id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.content).toBe(tweet.content);
    expect(retrieved?.account_id).toBe(accountId);
  });

  it("should update tweet status and tweet_id", () => {
    const accountId = dbService.createAccount({
      name: "Test",
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    const id = dbService.createTweet({
      content: "Hello",
      status: "pending",
      scheduled_at: Date.now(),
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: accountId,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    });

    dbService.updateTweetStatus(id, "sent", "123456789");
    const updated = dbService.getTweetById(id);

    expect(updated?.status).toBe("sent");
    expect(updated?.tweet_id).toBe("123456789");
  });

  it("should retrieve pending tweets", () => {
    const accountId = dbService.createAccount({
      name: "Test",
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    const now = Date.now();
    dbService.createTweet({
      content: "Past",
      status: "pending",
      scheduled_at: now - 1000,
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: accountId,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    });
    dbService.createTweet({
      content: "Future",
      status: "pending",
      scheduled_at: now + 1000,
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: accountId,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    });
    dbService.createTweet({
      content: "Sent",
      status: "sent",
      scheduled_at: now - 1000,
      media_path: null,
      thread_id: null,
      sequence_index: 0,
      parent_id: null,
      account_id: accountId,
      mode: "scheduled",
      is_recurring: false,
      send_count: 0,
      recurrence_interval: 15552000000,
    });

    const pending = dbService.getPendingTweets(now);
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe("Past");
  });

  it("should return table names", () => {
    const tables = dbService.getTableNames();
    expect(tables).toContain("accounts");
    expect(tables).toContain("tweets");
    expect(tables).toContain("queue_slots");
    expect(tables).toContain("send_logs");
  });

  it("should get all rows from a valid table", () => {
    dbService.createAccount({
      name: "Test",
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    const rows = dbService.getAllRows("accounts");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test");
  });

  it("should reject getAllRows for invalid table", () => {
    expect(() => dbService.getAllRows("evil_table")).toThrow("not allowed");
  });

  it("should insert, update, and delete a row generically", () => {
    const id = dbService.insertRow("accounts", {
      name: "Generic",
      app_key: "gk",
      app_secret: "gs",
      access_token: "gt",
      access_secret: "gas",
    });
    expect(id).toBeGreaterThan(0);

    dbService.updateRow("accounts", id, { name: "Updated" });
    const rows = dbService.getAllRows("accounts");
    const updated = rows.find((r: any) => r.id === id);
    expect(updated.name).toBe("Updated");

    dbService.deleteRow("accounts", id);
    const afterDelete = dbService.getAllRows("accounts");
    expect(afterDelete.find((r: any) => r.id === id)).toBeUndefined();
  });

  it("should soft delete a send log and hide it from history", () => {
    const accountId = dbService.createAccount({
      name: "Acc",
      app_key: "k",
      app_secret: "s",
      access_token: "t",
      access_secret: "as",
    });
    const logId = dbService.addSendLog({
      tweet_id: 1,
      account_id: accountId,
      content: "Test Log",
      sent_at: Date.now(),
      status: "sent",
    });

    // Verify it shows up in history
    let history = dbService.getHistory();
    expect(history.some((h) => h.id === logId)).toBe(true);

    // Soft delete
    dbService.softDeleteSendLog(logId);

    // Verify it is hidden from history
    history = dbService.getHistory();
    expect(history.some((h) => h.id === logId)).toBe(false);

    // Verify it still exists in the database with is_deleted = 1
    const rows = dbService.getAllRows("send_logs");
    const log = rows.find((r: any) => r.id === logId);
    expect(log).toBeDefined();
    expect(log.is_deleted).toBe(1);
  });
});

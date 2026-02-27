export { }

declare global {
    interface Window {
        api: {
            scheduleTweet: (tweet: any) => Promise<number>;
            getPendingTweets: () => Promise<any[]>;
            saveDraft: (tweet: any) => Promise<number>;
            getDrafts: () => Promise<any[]>;
            getHistory: (limit: number) => Promise<any[]>;
            updateTweet: (id: number, tweet: any) => Promise<void>;
            deleteTweet: (id: number) => Promise<void>;
            softDeleteHistory: (id: number) => Promise<void>;
            handleMediaUpload: (path: string) => Promise<string>;
            // Account Management
            getAccounts: () => Promise<any[]>;
            addAccount: (account: any) => Promise<number>;
            updateAccount: (id: number, account: any) => Promise<void>;
            deleteAccount: (id: number) => Promise<void>;
            // Queue Slot Management
            getQueueSlots: () => Promise<any[]>;
            addQueueSlot: (timeStr: string) => Promise<number>;
            deleteQueueSlot: (id: number) => Promise<void>;
            // Database View (testing)
            dbGetTables: () => Promise<string[]>;
            dbGetRows: (table: string) => Promise<any[]>;
            dbInsertRow: (table: string, data: any) => Promise<number>;
            dbUpdateRow: (table: string, id: number, data: any) => Promise<void>;
            dbDeleteRow: (table: string, id: number) => Promise<void>;
            dbGetSchema: (table: string) => Promise<any[]>;
        };
    }
}

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
            handleMediaUpload: (path: string) => Promise<string>;
        };
    }
}

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', {
            scheduleTweet: (tweet: any) => ipcRenderer.invoke('schedule-tweet', tweet),
            saveDraft: (tweet: any) => ipcRenderer.invoke('save-draft', tweet),
            getPendingTweets: () => ipcRenderer.invoke('get-pending-tweets'),
            getDrafts: () => ipcRenderer.invoke('get-drafts'),
            getHistory: (limit: number) => ipcRenderer.invoke('get-history', limit),
            updateTweet: (id: number, tweet: any) => ipcRenderer.invoke('update-tweet', id, tweet),
            deleteTweet: (id: number) => ipcRenderer.invoke('delete-tweet', id),
            handleMediaUpload: (path: string) => ipcRenderer.invoke('handle-media-upload', path),
            // Account Management
            getAccounts: () => ipcRenderer.invoke('get-accounts'),
            addAccount: (account: any) => ipcRenderer.invoke('add-account', account),
            updateAccount: (id: number, account: any) => ipcRenderer.invoke('update-account', id, account),
            deleteAccount: (id: number) => ipcRenderer.invoke('delete-account', id),
            // Queue Slot Management
            getQueueSlots: () => ipcRenderer.invoke('get-queue-slots'),
            addQueueSlot: (timeStr: string) => ipcRenderer.invoke('add-queue-slot', timeStr),
            deleteQueueSlot: (id: number) => ipcRenderer.invoke('delete-queue-slot', id)
        })
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore
    window.api = {
        scheduleTweet: (tweet: any) => ipcRenderer.invoke('schedule-tweet', tweet),
        saveDraft: (tweet: any) => ipcRenderer.invoke('save-draft', tweet),
        getPendingTweets: () => ipcRenderer.invoke('get-pending-tweets'),
        getDrafts: () => ipcRenderer.invoke('get-drafts'),
        getHistory: (limit: number) => ipcRenderer.invoke('get-history', limit),
        updateTweet: (id: number, tweet: any) => ipcRenderer.invoke('update-tweet', id, tweet),
        deleteTweet: (id: number) => ipcRenderer.invoke('delete-tweet', id),
        handleMediaUpload: (path: string) => ipcRenderer.invoke('handle-media-upload', path),
        // Account Management
        getAccounts: () => ipcRenderer.invoke('get-accounts'),
        addAccount: (account: any) => ipcRenderer.invoke('add-account', account),
        updateAccount: (id: number, account: any) => ipcRenderer.invoke('update-account', id, account),
        deleteAccount: (id: number) => ipcRenderer.invoke('delete-account', id),
        // Queue Slot Management
        getQueueSlots: () => ipcRenderer.invoke('get-queue-slots'),
        addQueueSlot: (timeStr: string) => ipcRenderer.invoke('add-queue-slot', timeStr),
        deleteQueueSlot: (id: number) => ipcRenderer.invoke('delete-queue-slot', id)
    }
}

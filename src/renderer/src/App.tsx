import React, { useState, useEffect } from 'react'
import TweetBlock from './components/TweetBlock'

interface Tweet {
    id: number
    content: string
    status: string
    scheduled_at: number
    thread_id?: string | null
    parent_id?: string | null
}

interface Account {
    id: number
    name: string
    app_key: string
    app_secret: string
    access_token: string
    access_secret: string
}

interface Tweet {
    id: number
    content: string
    status: string
    scheduled_at: number
    thread_id?: string | null
    parent_id?: string | null
    account_id: number
    error_message?: string | null
}

const App: React.FC = () => {
    const [blocks, setBlocks] = useState<{ content: string; mediaPath: string | null }[]>([{ content: '', mediaPath: null }])
    const [activeIndex, setActiveIndex] = useState(0)
    const [scheduledAt, setScheduledAt] = useState('')
    const [tweets, setTweets] = useState<Tweet[]>([])
    const [drafts, setDrafts] = useState<Tweet[]>([])
    const [loading, setLoading] = useState(false)
    const [textToSplit, setTextToSplit] = useState('')
    const [threadDelay, setThreadDelay] = useState(20)
    const [history, setHistory] = useState<Tweet[]>([])
    const [historyLimit] = useState(50)
    const [activeTab, setActiveTab] = useState<'queue' | 'drafts' | 'history' | 'accounts'>('queue')
    const [customSeparator, setCustomSeparator] = useState('||')

    // Account States
    const [accounts, setAccounts] = useState<Account[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('')
    const [editingAccountId, setEditingAccountId] = useState<number | null>(null)
    const [newAccount, setNewAccount] = useState({
        name: '',
        app_key: '',
        app_secret: '',
        access_token: '',
        access_secret: ''
    })

    const fetchTweets = async () => {
        if (window.api && window.api.getPendingTweets) {
            const queueData = await window.api.getPendingTweets()
            setTweets(queueData)
            const draftData = await window.api.getDrafts()
            setDrafts(draftData)
            const historyData = await window.api.getHistory(historyLimit)
            setHistory(historyData)
        }
    }

    const fetchAccounts = async () => {
        if (window.api && window.api.getAccounts) {
            const data = await window.api.getAccounts()
            setAccounts(data)
            if (data.length > 0 && selectedAccountId === '') {
                setSelectedAccountId(data[0].id)
            }
        }
    }

    useEffect(() => {
        fetchTweets()
        fetchAccounts()
        const interval = setInterval(fetchTweets, 10000)
        return () => clearInterval(interval)
    }, [])

    const handleAction = async (isDraft: boolean) => {
        if (selectedAccountId === '') {
            alert('Please select or add an account first.')
            return
        }

        if (blocks.some(b => !b.content.trim())) {
            alert('Please fill in all tweet blocks or remove empty ones.')
            return
        }

        const getSuffix = (index: number) => {
            if (blocks.length <= 1) return ''
            return `\n${index + 1}/${blocks.length}`
        }

        const getMaxChars = (index: number) => {
            return 280 - getSuffix(index).length
        }

        if (blocks.some((b, i) => b.content.length > getMaxChars(i))) {
            alert('One or more tweets exceed the character limit (including numbering).')
            return
        }

        setLoading(true)
        try {
            const scheduleTime = scheduledAt ? new Date(scheduledAt).getTime() : Date.now()
            const threadId = blocks.length > 1 ? crypto.randomUUID() : null

            let lastId: number | null = null

            for (let i = 0; i < blocks.length; i++) {
                const contentWithSuffix = blocks[i].content + getSuffix(i)
                const delayMs = i * threadDelay * 1000
                // @ts-ignore
                const newId = await window.api[isDraft ? 'saveDraft' : 'scheduleTweet']({
                    content: contentWithSuffix,
                    scheduled_at: scheduleTime + delayMs,
                    media_path: blocks[i].mediaPath,
                    thread_id: threadId,
                    sequence_index: i,
                    parent_id: lastId,
                    account_id: selectedAccountId
                })
                lastId = newId
            }

            setBlocks([{ content: '', mediaPath: null }])
            setActiveIndex(0)
            setScheduledAt('')
            await fetchTweets()
        } catch (error) {
            console.error('Action failed:', error)
            alert('Error processing request')
        } finally {
            setLoading(false)
        }
    }

    const handleAddAccount = async () => {
        if (!newAccount.name || !newAccount.app_key || !newAccount.access_token) {
            alert('Please fill in all account fields.')
            return
        }

        if (editingAccountId !== null) {
            await window.api.updateAccount(editingAccountId, newAccount)
            setEditingAccountId(null)
        } else {
            await window.api.addAccount(newAccount)
        }

        setNewAccount({ name: '', app_key: '', app_secret: '', access_token: '', access_secret: '' })
        await fetchAccounts()
    }

    const handleEditAccount = (account: Account) => {
        setEditingAccountId(account.id)
        setNewAccount({
            name: account.name,
            app_key: account.app_key,
            app_secret: account.app_secret,
            access_token: account.access_token,
            access_secret: account.access_secret
        })
    }

    const handleCancelEdit = () => {
        setEditingAccountId(null)
        setNewAccount({ name: '', app_key: '', app_secret: '', access_token: '', access_secret: '' })
    }

    const handleDeleteAccount = async (id: number) => {
        if (!confirm('Are you sure? This will NOT delete tweets associated with this account but they will fail to post.')) return
        await window.api.deleteAccount(id)
        await fetchAccounts()
    }

    const handleUpdateTweetAccount = async (tweetId: number, accountId: number) => {
        await window.api.updateTweet(tweetId, { account_id: accountId })
        await fetchTweets()
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this tweet?')) return
        await window.api.deleteTweet(id)
        await fetchTweets()
    }

    const handleEdit = (tweet: Tweet) => {
        setBlocks([{ content: tweet.content, mediaPath: null }])
        setScheduledAt(new Date(tweet.scheduled_at).toISOString().slice(0, 16))
        setSelectedAccountId(tweet.account_id)
        setActiveIndex(0)
    }

    const addBlock = () => {
        setBlocks([...blocks, { content: '', mediaPath: null }])
        setActiveIndex(blocks.length)
    }

    const removeBlock = (index: number) => {
        const newBlocks = blocks.filter((_, i) => i !== index)
        setBlocks(newBlocks)
        if (activeIndex >= newBlocks.length) {
            setActiveIndex(newBlocks.length - 1)
        }
    }

    const updateBlock = (val: string) => {
        const newBlocks = [...blocks]
        newBlocks[activeIndex].content = val
        setBlocks(newBlocks)
    }

    const updateMedia = (path: string | null) => {
        const newBlocks = [...blocks]
        newBlocks[activeIndex].mediaPath = path
        setBlocks(newBlocks)
    }

    const smartSplit = () => {
        if (!textToSplit.trim()) return
        let chunks: string[] = []
        const parts = textToSplit.split(customSeparator).map(p => p.trim()).filter(p => p)
        for (const part of parts) {
            if (part.length <= 270) {
                chunks.push(part)
            } else {
                const sentences = part.split(/(?<=[.?!])\s+/)
                let current = ''
                for (const sentence of sentences) {
                    const potential = current ? `${current} ${sentence}` : sentence
                    if (potential.length <= 270) {
                        current = potential
                    } else {
                        if (current) chunks.push(current)
                        if (sentence.length > 270) {
                            const words = sentence.split(/\s+/)
                            current = ''
                            for (const word of words) {
                                const wordPotential = current ? `${current} ${word}` : word
                                if (wordPotential.length <= 270) {
                                    current = wordPotential
                                } else {
                                    chunks.push(current)
                                    current = word
                                }
                            }
                        } else {
                            current = sentence
                        }
                    }
                }
                if (current) chunks.push(current)
            }
        }
        setBlocks(chunks.map(content => ({ content, mediaPath: null })))
        setActiveIndex(0)
        setTextToSplit('')
    }

    const setQuickTime = (minutes: number) => {
        const date = new Date(Date.now() + minutes * 60000)
        setScheduledAt(date.toISOString().slice(0, 16))
    }

    return (
        <div className="container">
            <h1>TweetFlow Scheduler</h1>

            <div className="composer-layout">
                <div className="composer-sidebar">
                    <div className="account-selector" style={{ marginBottom: '1rem', padding: '0 0.5rem' }}>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}
                        >
                            <option value="" disabled>Select Account</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="sidebar-items">
                        {blocks.map((block, idx) => (
                            <div
                                key={idx}
                                className={`sidebar-item ${activeIndex === idx ? 'active' : ''}`}
                                onClick={() => setActiveIndex(idx)}
                            >
                                <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>{idx + 1}.</span>
                                {block.content || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>Empty tweet...</span>}
                            </div>
                        ))}
                    </div>
                    <div className="sidebar-footer">
                        <button
                            onClick={addBlock}
                            className="btn-secondary"
                            style={{ width: '100%' }}
                        >
                            + Add Tweet
                        </button>
                    </div>
                </div>

                <div className="composer-stage">
                    <TweetBlock
                        content={blocks[activeIndex].content}
                        mediaPath={blocks[activeIndex].mediaPath}
                        onContentChange={updateBlock}
                        onMediaChange={updateMedia}
                        maxChars={280 - (blocks.length > 1 ? `\n${activeIndex + 1}/${blocks.length}`.length : 0)}
                        suffix={blocks.length > 1 ? `\n${activeIndex + 1}/${blocks.length}` : ''}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', alignItems: 'center' }}>
                        {blocks.length > 1 && (
                            <button
                                onClick={() => removeBlock(activeIndex)}
                                className="btn-danger"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                                Remove Current Tweet
                            </button>
                        )}
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Thread progress: {activeIndex + 1} of {blocks.length}
                        </span>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="actions" style={{ marginTop: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Delay (s):</span>
                        <input
                            type="number"
                            min="1"
                            max="3600"
                            value={threadDelay}
                            onChange={(e) => setThreadDelay(parseInt(e.target.value) || 1)}
                            style={{
                                width: '60px',
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
                                padding: '0.5rem',
                                borderRadius: '8px'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {[
                                { label: '+5m', mins: 5 },
                                { label: '+15m', mins: 15 },
                                { label: '+1h', mins: 60 },
                                { label: '+12h', mins: 720 },
                                { label: '+1d', mins: 1440 }
                            ].map(btn => (
                                <button
                                    key={btn.label}
                                    onClick={() => setQuickTime(btn.mins)}
                                    className="btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', minWidth: '45px' }}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                width: '100%'
                            }}
                        />
                    </div>
                    <button onClick={() => handleAction(true)} className="btn-secondary" disabled={loading}>
                        Save Draft
                    </button>
                    <button onClick={() => handleAction(false)} disabled={loading}>
                        {loading ? 'Scheduling...' : 'Schedule Thread'}
                    </button>
                </div>

                <div className="smart-split-area">
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Smart Text Splitter</h3>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Separator:</span>
                        <input
                            type="text"
                            value={customSeparator}
                            onChange={(e) => setCustomSeparator(e.target.value)}
                            style={{ width: '80px', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
                        />
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Splits text at every "{customSeparator}"</span>
                    </div>
                    <textarea
                        placeholder={`Paste long text here. Use ${customSeparator} to force splits...`}
                        value={textToSplit}
                        onChange={(e) => setTextToSplit(e.target.value)}
                        style={{ minHeight: '80px', fontSize: '0.9rem' }}
                    />
                    <button
                        onClick={smartSplit}
                        className="btn-secondary"
                        style={{ marginTop: '0.5rem', width: '100%' }}
                        disabled={!textToSplit.trim()}
                    >
                        Split into Thread
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="tabs">
                    {['queue', 'drafts', 'history', 'accounts'].map((t) => (
                        <div
                            key={t}
                            className={`tab ${activeTab === t ? 'active' : ''}`}
                            onClick={() => setActiveTab(t as any)}
                        >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                            {t !== 'accounts' && ` (${t === 'queue' ? tweets.length : t === 'drafts' ? drafts.length : history.length})`}
                        </div>
                    ))}
                </div>

                <div className="tab-content">
                    {activeTab === 'accounts' ? (
                        <div style={{ padding: '1rem' }}>
                            <h3>Manage Twitter Accounts</h3>
                            <div className="account-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                <input placeholder="Account name (e.g. English)" value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} />
                                <input placeholder="API Key" value={newAccount.app_key} onChange={e => setNewAccount({ ...newAccount, app_key: e.target.value })} />
                                <input placeholder="API Secret" value={newAccount.app_secret} onChange={e => setNewAccount({ ...newAccount, app_secret: e.target.value })} />
                                <input placeholder="Access Token" value={newAccount.access_token} onChange={e => setNewAccount({ ...newAccount, access_token: e.target.value })} />
                                <input placeholder="Access Secret" value={newAccount.access_secret} onChange={e => setNewAccount({ ...newAccount, access_secret: e.target.value })} />
                                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem' }}>
                                    <button onClick={handleAddAccount} style={{ flex: 1 }}>{editingAccountId !== null ? 'Update Account' : 'Add Account'}</button>
                                    {editingAccountId !== null && (
                                        <button onClick={handleCancelEdit} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                                    )}
                                </div>
                            </div>
                            <div className="account-list">
                                {accounts.map(acc => (
                                    <div key={acc.id} className="queue-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>{acc.name}</strong>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{acc.app_key.slice(0, 8)}...</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleEditAccount(acc)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }}>Edit</button>
                                            <button onClick={() => handleDeleteAccount(acc.id)} className="btn-danger" style={{ padding: '0.2rem 0.5rem' }}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (activeTab === 'queue' ? tweets : activeTab === 'drafts' ? drafts : history).length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                            {activeTab === 'queue' ? 'No pending tweets.' : activeTab === 'drafts' ? 'No drafts saved.' : 'No history found.'}
                        </p>
                    ) : (
                        (activeTab === 'queue' ? tweets : activeTab === 'drafts' ? drafts : history).map((tweet) => (
                            <div key={tweet.id} className="queue-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <span className={`status status-${tweet.status.toLowerCase()}`}>
                                            {tweet.status}
                                        </span>
                                        <select
                                            value={tweet.account_id}
                                            onChange={(e) => handleUpdateTweetAccount(tweet.id, Number(e.target.value))}
                                            disabled={activeTab === 'history'}
                                            style={{ fontSize: '0.7rem', padding: '0.1rem', borderRadius: '4px', background: 'var(--border)', border: 'none', color: 'var(--text)', opacity: activeTab === 'history' ? 0.6 : 1, cursor: activeTab === 'history' ? 'not-allowed' : 'pointer' }}
                                        >
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="tweet-actions">
                                        <button onClick={() => handleEdit(tweet)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Edit</button>
                                        <button onClick={() => handleDelete(tweet.id)} className="btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>Delete</button>
                                    </div>
                                </div>
                                <div className="tweet-content">{tweet.content}</div>
                                {tweet.status === 'failed' && tweet.error_message && (
                                    <div style={{ color: 'var(--status-failed)', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255, 75, 75, 0.1)', borderRadius: '4px', marginTop: '0.5rem' }}>
                                        Error: {tweet.error_message}
                                    </div>
                                )}
                                <div className="tweet-meta">
                                    {activeTab === 'queue'
                                        ? `Scheduled for: ${new Date(tweet.scheduled_at).toLocaleString()}`
                                        : activeTab === 'drafts' ? 'Saved as draft' : `Sent at: ${new Date(tweet.scheduled_at).toLocaleString()}`}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

export default App

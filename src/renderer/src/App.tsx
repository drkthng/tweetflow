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
    const [historyLimit, setHistoryLimit] = useState(50)
    const [activeTab, setActiveTab] = useState<'queue' | 'drafts' | 'history'>('queue')
    const [customSeparator, setCustomSeparator] = useState('||')

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

    useEffect(() => {
        fetchTweets()
        const interval = setInterval(fetchTweets, 10000)
        return () => clearInterval(interval)
    }, [])

    const getSuffix = (index: number) => {
        if (blocks.length <= 1) return ''
        return `\n${index + 1}/${blocks.length}`
    }

    const getMaxChars = (index: number) => {
        return 280 - getSuffix(index).length
    }

    const handleAction = async (isDraft: boolean) => {
        if (blocks.some(b => !b.content.trim())) {
            alert('Please fill in all tweet blocks or remove empty ones.')
            return
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
                    parent_id: lastId
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

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this tweet?')) return
        await window.api.deleteTweet(id)
        await fetchTweets()
    }

    const handleEdit = (tweet: Tweet) => {
        setBlocks([{ content: tweet.content, mediaPath: null }]) // Media path might need to be fetched/stored more robustly
        setScheduledAt(new Date(tweet.scheduled_at).toISOString().slice(0, 16))
        setActiveIndex(0)
        // Actually the composer is always visible at the top.
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

        // 1. Split by custom separator first
        const parts = textToSplit.split(customSeparator).map(p => p.trim()).filter(p => p)

        for (const part of parts) {
            // Check if part needs further splitting (if it's over the limit)
            if (part.length <= 270) {
                chunks.push(part)
            } else {
                // Semantic splitting for parts that are still too long
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
                        maxChars={getMaxChars(activeIndex)}
                        suffix={getSuffix(activeIndex)}
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
                    <div
                        className={`tab ${activeTab === 'queue' ? 'active' : ''}`}
                        onClick={() => setActiveTab('queue')}
                    >
                        Queue ({tweets.length})
                    </div>
                    <div
                        className={`tab ${activeTab === 'drafts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('drafts')}
                    >
                        Drafts ({drafts.length})
                    </div>
                    <div
                        className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History ({history.length})
                    </div>
                </div>

                {activeTab === 'history' && (
                    <div style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Show last:</span>
                        <input
                            type="number"
                            value={historyLimit}
                            onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 50)}
                            style={{ width: '60px', padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)' }}
                        />
                    </div>
                )}

                <div className="tab-content">
                    {(activeTab === 'queue' ? tweets : activeTab === 'drafts' ? drafts : history).length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {activeTab === 'queue' ? 'No pending tweets.' : activeTab === 'drafts' ? 'No drafts saved.' : 'No history found.'}
                        </p>
                    ) : (
                        (activeTab === 'queue' ? tweets : activeTab === 'drafts' ? drafts : history).map((tweet) => (
                            <div key={tweet.id} className="queue-item">
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className={`status status-${tweet.status.toLowerCase()}`}>
                                        {tweet.status}
                                    </span>
                                    <div className="tweet-actions">
                                        <button
                                            onClick={() => handleEdit(tweet)}
                                            className="btn-secondary"
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tweet.id)}
                                            className="btn-danger"
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <div className="tweet-content">{tweet.content}</div>
                                <div className="tweet-meta">
                                    {activeTab === 'queue'
                                        ? `Scheduled for: ${new Date(tweet.scheduled_at).toLocaleString()}`
                                        : 'Saved as draft'}
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

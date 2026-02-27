import React, { useState, useEffect, useCallback } from 'react'

const DatabaseView: React.FC = () => {
    const [tables, setTables] = useState<string[]>([])
    const [selectedTable, setSelectedTable] = useState('')
    const [rows, setRows] = useState<any[]>([])
    const [columns, setColumns] = useState<string[]>([])
    const [editingCell, setEditingCell] = useState<{ rowId: number; col: string } | null>(null)
    const [editValue, setEditValue] = useState('')
    const [showAddRow, setShowAddRow] = useState(false)
    const [newRowData, setNewRowData] = useState<Record<string, string>>({})

    useEffect(() => {
        window.api.dbGetTables().then(t => {
            setTables(t)
            if (t.length > 0) {
                const defaultTable = t.includes('tweets') ? 'tweets' : t[0]
                setSelectedTable(defaultTable)
            }
        })
    }, [])

    const loadRows = useCallback(async () => {
        if (!selectedTable) return
        const data = await window.api.dbGetRows(selectedTable)
        setRows(data)
        if (data.length > 0) {
            setColumns(Object.keys(data[0]))
        } else {
            setColumns([])
        }
        setShowAddRow(false)
        setEditingCell(null)
    }, [selectedTable])

    useEffect(() => {
        loadRows()
    }, [loadRows])

    const handleCellDoubleClick = (rowId: number, col: string, currentValue: any) => {
        if (col === 'id') return // don't allow editing the id column
        setEditingCell({ rowId, col })
        setEditValue(currentValue === null ? '' : String(currentValue))
    }

    const handleCellSave = async () => {
        if (!editingCell) return
        // Try to convert to number if it looks like one
        let value: any = editValue
        if (editValue === '') {
            value = null
        } else if (!isNaN(Number(editValue))) {
            value = Number(editValue)
        }
        await window.api.dbUpdateRow(selectedTable, editingCell.rowId, { [editingCell.col]: value })
        setEditingCell(null)
        await loadRows()
    }

    const handleCellKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCellSave()
        if (e.key === 'Escape') setEditingCell(null)
    }

    const handleDeleteRow = async (id: number) => {
        if (!confirm(`Delete row ${id} from ${selectedTable}?`)) return
        await window.api.dbDeleteRow(selectedTable, id)
        await loadRows()
    }

    const handleAddRow = async () => {
        const data: Record<string, any> = {}
        for (const [key, val] of Object.entries(newRowData)) {
            if (key === 'id') continue
            if (val === '') {
                data[key] = null
            } else if (!isNaN(Number(val))) {
                data[key] = Number(val)
            } else {
                data[key] = val
            }
        }
        if (Object.keys(data).length === 0) return
        await window.api.dbInsertRow(selectedTable, data)
        setNewRowData({})
        await loadRows()
    }

    const formatCellValue = (val: any): string => {
        if (val === null || val === undefined) return '∅'
        if (typeof val === 'string' && val.length > 60) return val.slice(0, 57) + '...'
        return String(val)
    }

    return (
        <div className="db-view">
            <div className="db-view-toolbar">
                <select
                    value={selectedTable}
                    onChange={e => setSelectedTable(e.target.value)}
                    className="db-view-select"
                >
                    {tables.map(t => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
                <button onClick={loadRows} className="btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>
                    ↻ Refresh
                </button>
                <button
                    onClick={() => {
                        setShowAddRow(!showAddRow)
                        setNewRowData({})
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.8rem' }}
                >
                    + Add Row
                </button>
                <span className="db-view-count">{rows.length} rows</span>
            </div>

            <div className="db-view-table-wrapper">
                <table className="db-view-table">
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th key={col}>{col}</th>
                            ))}
                            <th style={{ width: '60px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {showAddRow && (
                            <tr className="db-view-add-row">
                                {columns.map(col => (
                                    <td key={col}>
                                        {col === 'id' ? (
                                            <span style={{ opacity: 0.3 }}>auto</span>
                                        ) : (
                                            <input
                                                type="text"
                                                placeholder={col}
                                                value={newRowData[col] || ''}
                                                onChange={e => setNewRowData({ ...newRowData, [col]: e.target.value })}
                                                className="db-view-input"
                                            />
                                        )}
                                    </td>
                                ))}
                                <td>
                                    <button
                                        onClick={handleAddRow}
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                    >
                                        Save
                                    </button>
                                </td>
                            </tr>
                        )}
                        {rows.map(row => (
                            <tr key={row.id}>
                                {columns.map(col => (
                                    <td
                                        key={col}
                                        onDoubleClick={() => handleCellDoubleClick(row.id, col, row[col])}
                                        className={`db-view-cell ${col === 'id' ? 'db-view-cell-id' : ''}`}
                                        title={row[col] === null ? 'NULL' : String(row[col])}
                                    >
                                        {editingCell?.rowId === row.id && editingCell?.col === col ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={handleCellSave}
                                                onKeyDown={handleCellKeyDown}
                                                className="db-view-input"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className={row[col] === null ? 'db-view-null' : ''}>
                                                {formatCellValue(row[col])}
                                            </span>
                                        )}
                                    </td>
                                ))}
                                <td>
                                    <button
                                        onClick={() => handleDeleteRow(row.id)}
                                        className="btn-danger"
                                        style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No rows in this table.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default DatabaseView

'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

type Stats = { total: number; sorted: number; pending: number }
type SortResult = { name: string; house: string; source: string }
type SortResponse = { sorted: number; skipped: number; newCharacters: SortResult[]; message?: string; error?: string }

const HOUSE_COLOR: Record<string, string> = {
  Gryffindor: '#c84b11',
  Slytherin: '#2d6a4f',
  Ravenclaw: '#1d4e89',
  Hufflepuff: '#c9a000',
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [log, setLog] = useState<SortResult[]>([])
  const [status, setStatus] = useState('')
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoStats, setAutoStats] = useState({ calls: 0, total: 0 })
  const stopRef = useRef(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/sort')
      if (res.ok) setStats(await res.json())
    } catch {}
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  async function sortBatch(count: number): Promise<SortResponse | null> {
    const res = await fetch('/api/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    })
    if (!res.ok) return null
    return res.json()
  }

  async function sortOnce(count: number) {
    setStatus(`Sorting ${count} characters…`)
    try {
      const data = await sortBatch(count)
      if (!data) { setStatus('Request failed'); return }
      if (data.error) { setStatus(`Error: ${data.error}`); return }
      if (data.message) { setStatus(data.message); return }
      setStatus(`Done — sorted ${data.sorted}, skipped ${data.skipped ?? 0}`)
      setLog(prev => [...(data.newCharacters ?? []), ...prev].slice(0, 50))
      await fetchStats()
    } catch (e: any) {
      setStatus(`Network error: ${e.message}`)
    }
  }

  async function startAutoSort() {
    setAutoRunning(true)
    stopRef.current = false
    setAutoStats({ calls: 0, total: 0 })
    setStatus('Auto-sort started…')

    let totalSorted = 0
    let calls = 0

    while (!stopRef.current) {
      setStatus(`Auto-sorting… ${totalSorted} sorted so far (${calls} batches)`)
      try {
        const data = await sortBatch(10)
        if (!data || data.error) { setStatus(`Stopped: ${data?.error ?? 'request failed'}`); break }
        if (data.message?.includes('All candidates')) { setStatus(`Finished! All ${totalSorted} characters sorted.`); break }
        // sorted:0 with no error means genuinely nothing pending (not an AI failure)
        if ((data.sorted ?? 0) === 0 && !data.error) { setStatus(`Finished — nothing left to sort.`); break }

        totalSorted += data.sorted
        calls++
        setAutoStats({ calls, total: totalSorted })
        setLog(prev => [...(data.newCharacters ?? []), ...prev].slice(0, 100))
        await fetchStats()

        // Small pause between calls to avoid hammering the API
        await new Promise(r => setTimeout(r, 1500))
      } catch (e: any) {
        setStatus(`Error: ${e.message}`)
        break
      }
    }

    setAutoRunning(false)
  }

  function stopAutoSort() {
    stopRef.current = true
    setStatus('Stopping after current batch…')
  }

  const pct = stats ? Math.round((stats.sorted / Math.max(stats.total, 1)) * 100) : 0

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Sorting Register — Admin</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Trigger the AI sorter to classify characters into Hogwarts houses and save them to the database.
      </p>

      {stats ? (
        <div style={{ background: '#f7f7f7', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <span><strong>{stats.sorted.toLocaleString()}</strong> sorted</span>
            <span><strong>{stats.pending.toLocaleString()}</strong> pending</span>
            <span><strong>{stats.total.toLocaleString()}</strong> total candidates</span>
          </div>
          <div style={{ background: '#ddd', borderRadius: 4, height: 10 }}>
            <div style={{
              background: 'linear-gradient(90deg, #7b2d8b, #c84b11)',
              borderRadius: 4, height: 10,
              width: `${pct}%`, transition: 'width 0.5s',
            }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.4rem', textAlign: 'right' }}>{pct}% complete</p>
        </div>
      ) : (
        <p style={{ color: '#999', marginBottom: '1.5rem' }}>Loading stats…</p>
      )}

      {/* Auto-sort (big button) */}
      <div style={{ background: '#f0eaf7', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Auto-sort all pending characters</h2>
        <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 0.9rem' }}>
          Sorts 10 at a time, automatically, until everything is done. Keep this tab open.
        </p>
        {!autoRunning ? (
          <button
            onClick={startAutoSort}
            style={{
              padding: '0.7rem 1.5rem', borderRadius: 7, border: 'none',
              background: '#7b2d8b', color: '#fff',
              cursor: 'pointer', fontSize: '1rem', fontWeight: 700,
            }}
          >
            Start sorting all →
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <span style={{ fontWeight: 600 }}>{autoStats.total} sorted in {autoStats.calls} batches</span>
            </div>
            <button
              onClick={stopAutoSort}
              style={{
                padding: '0.5rem 1rem', borderRadius: 6, border: '2px solid #c00',
                background: 'transparent', color: '#c00',
                cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
              }}
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Manual sort */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[5, 10, 25].map(n => (
          <button
            key={n}
            onClick={() => sortOnce(n)}
            disabled={autoRunning}
            style={{
              padding: '0.55rem 1.1rem', borderRadius: 6, border: '1px solid #ccc',
              background: autoRunning ? '#eee' : '#fff', color: autoRunning ? '#aaa' : '#333',
              cursor: autoRunning ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
            }}
          >
            Sort {n}
          </button>
        ))}
      </div>

      {status && (
        <p style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '0.6rem 0.9rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {autoRunning ? '⚡ ' : '✓ '}{status}
        </p>
      )}

      {log.length > 0 && (
        <div>
          <h2 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: '#555' }}>Recently sorted</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: 400, overflowY: 'auto' }}>
            {log.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: '#fafafa', borderRadius: 6, padding: '0.35rem 0.8rem',
                borderLeft: `3px solid ${HOUSE_COLOR[c.house] ?? '#999'}`,
                fontSize: '0.88rem',
              }}>
                <span style={{ fontWeight: 600, minWidth: 140 }}>{c.name}</span>
                <span style={{ color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.source}</span>
                <span style={{ color: HOUSE_COLOR[c.house] ?? '#999', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{c.house}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

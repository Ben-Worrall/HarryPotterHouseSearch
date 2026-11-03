'use client'
import { useState, useEffect, useCallback } from 'react'

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
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/sort')
    if (res.ok) setStats(await res.json())
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  async function sort(count: number) {
    setLoading(true)
    setStatus(`Sorting ${count} characters…`)
    try {
      const res = await fetch('/api/sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })
      const data: SortResponse = await res.json()
      if (data.error) {
        setStatus(`Error: ${data.error}`)
      } else if (data.message) {
        setStatus(data.message)
      } else {
        setStatus(`Done — sorted ${data.sorted}, skipped ${data.skipped ?? 0}`)
        setLog(prev => [...(data.newCharacters ?? []), ...prev].slice(0, 50))
        await fetchStats()
      }
    } catch (e: any) {
      setStatus(`Network error: ${e.message}`)
    }
    setLoading(false)
  }

  const pct = stats ? Math.round((stats.sorted / Math.max(stats.total, 1)) * 100) : 0

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Sorting Register — Admin</h1>
      <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Trigger the AI sorter to classify more characters into Hogwarts houses.
      </p>

      {stats ? (
        <div style={{ background: '#f7f7f7', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            <span><strong>{stats.sorted}</strong> sorted</span>
            <span><strong>{stats.pending}</strong> pending</span>
            <span><strong>{stats.total}</strong> total</span>
          </div>
          <div style={{ background: '#ddd', borderRadius: 4, height: 8 }}>
            <div style={{ background: '#7b2d8b', borderRadius: 4, height: 8, width: `${pct}%`, transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.4rem', textAlign: 'right' }}>{pct}% complete</p>
        </div>
      ) : (
        <p style={{ color: '#999', marginBottom: '1.5rem' }}>Loading stats…</p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[5, 10, 25].map(n => (
          <button
            key={n}
            onClick={() => sort(n)}
            disabled={loading}
            style={{
              padding: '0.6rem 1.2rem', borderRadius: 6, border: 'none',
              background: loading ? '#ccc' : '#7b2d8b', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem', fontWeight: 600,
            }}
          >
            Sort {n} more
          </button>
        ))}
      </div>

      {status && (
        <p style={{ background: '#f0eaf7', borderRadius: 6, padding: '0.6rem 0.9rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {loading ? '⏳ ' : '✓ '}{status}
        </p>
      )}

      {log.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Recently sorted</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {log.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: '#fafafa', borderRadius: 6, padding: '0.4rem 0.8rem',
                borderLeft: `3px solid ${HOUSE_COLOR[c.house] ?? '#999'}`,
                fontSize: '0.9rem',
              }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <span style={{ color: '#666', flex: 1 }}>{c.source}</span>
                <span style={{ color: HOUSE_COLOR[c.house] ?? '#999', fontWeight: 500, fontSize: '0.8rem' }}>{c.house}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#fffbe6', borderRadius: 8, fontSize: '0.85rem', color: '#555' }}>
        <strong>To add more candidates:</strong> run <code>node scripts/fetch-candidates.mjs</code> locally,
        commit <code>data/candidates.json</code>, and redeploy. The sorter reads from the bundled file.
      </div>
    </main>
  )
}

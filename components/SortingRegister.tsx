'use client'

import { useState, useEffect, useRef } from 'react'
import type { Character, House } from '@/types/character'

export const HOUSES: Record<House, { c: string; bg: string; virtue: string }> = {
  Gryffindor: { c: 'var(--gry)', bg: 'var(--gry-bg)', virtue: 'courage and nerve' },
  Slytherin:  { c: 'var(--sly)', bg: 'var(--sly-bg)', virtue: 'ambition and cunning' },
  Ravenclaw:  { c: 'var(--rav)', bg: 'var(--rav-bg)', virtue: 'intellect and curiosity' },
  Hufflepuff: { c: 'var(--huf)', bg: 'var(--huf-bg)', virtue: 'loyalty and hard work' },
}
export const ORDER: House[] = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff']
const HOUSE_CLASS: Record<House, string> = { Gryffindor: 'gry', Slytherin: 'sly', Ravenclaw: 'rav', Hufflepuff: 'huf' }

export function confOf(d: Character) { return Math.max(...ORDER.map(h => d.scores[h])) }
export function runnerUp(d: Character): [House, number] {
  return ORDER.map(h => [h, d.scores[h]] as [House, number]).sort((a, b) => b[1] - a[1])[1]
}

function applySort(arr: Character[], sort: 'name' | 'conf' | 'year'): Character[] {
  const a = [...arr]
  if (sort === 'conf') a.sort((x, y) => confOf(y) - confOf(x))
  else if (sort === 'year') a.sort((x, y) => (x.year ?? 0) - (y.year ?? 0))
  else a.sort((x, y) => x.name.localeCompare(y.name))
  return a
}

function applyFilter(arr: Character[], q: string, medium: string, house: string): Character[] {
  return arr.filter(d => {
    const lq = q.trim().toLowerCase()
    if (lq && !(d.name + ' ' + d.source + ' ' + d.creator).toLowerCase().includes(lq)) return false
    if (medium !== 'all' && !d.medium.includes(medium)) return false
    if (house !== 'all' && d.house !== house) return false
    return true
  })
}

function Avatar({ char }: { char: Character }) {
  const H = HOUSES[char.house]
  if (char.image_url) {
    return (
      <span className="avatar-wrap">
        <img className="avatar" src={char.image_url} alt="" loading="lazy" />
      </span>
    )
  }
  return (
    <span className="avatar-wrap">
      <span className="avatar-init" style={{ background: H.c }}>{char.name[0]}</span>
    </span>
  )
}

function CharacterCard({ character: d, onClose }: { character: Character; onClose: () => void }) {
  const H = HOUSES[d.house]
  const [ruH, ruV] = runnerUp(d)
  const conf = confOf(d)
  const gap = conf - ruV
  const fit = gap >= 30 ? 'Clear fit' : gap >= 12 ? 'Solid fit' : 'Close call'
  const [barsReady, setBarsReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setBarsReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <div className="card-hero card-hero-crest" style={{ background: `linear-gradient(160deg, ${H.c}1a, ${H.c}06)` }}>
        <div className="house-crest">
          <img src={`/house-crests/${d.house.toLowerCase()}.svg`} alt={d.house} />
        </div>
        <div className="crest-label" style={{ color: H.c }}>{d.house}</div>
      </div>
      <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="card-body">
        <div className="meta">{d.source} · {d.creator}{d.year ? ` · ${d.year}` : ''} · {d.medium}</div>
        <h2>{d.name}</h2>
        <div className="verdict">
          <span className="house" style={{ color: H.c }}>{d.house}</span>
          <span className="conf">{fit} · {conf}% on {H.virtue}</span>
        </div>
        <div className="bars">
          {ORDER.map(h => (
            <div className="bar" key={h}>
              <span style={{ color: HOUSES[h].c, fontWeight: h === d.house ? 600 : 400 }}>{h}</span>
              <span className="track">
                <span
                  className="fill"
                  style={{
                    background: HOUSES[h].c,
                    opacity: h === d.house ? 1 : 0.4,
                    width: barsReady ? `${d.scores[h]}%` : '0%',
                  }}
                />
              </span>
              <span className="v">{d.scores[h]}%</span>
            </div>
          ))}
        </div>
        <ul className="traits">{d.traits.map(t => <li key={t}>{t}</li>)}</ul>
        <h3>Why {d.house}</h3>
        <p>{d.reasoning}</p>
        <p className="runner">Second choice: {ruH} at {ruV}%.</p>
        <h3>Background</h3>
        <p>{d.background}</p>
      </div>
    </>
  )
}

export default function SortingRegister({ initialData }: { initialData: Character[] }) {
  const [q, setQ] = useState('')
  const [medium, setMedium] = useState('all')
  const [house, setHouse] = useState('all')
  const [sort, setSort] = useState<'name' | 'conf' | 'year'>('name')
  const [sel, setSel] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = sel ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sel])

  function handleSelect(id: string) {
    setSel(prev => prev === id ? null : id)
    history.replaceState(null, '', '#' + id)
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setSel(null)
  }

  const filtered = applySort(applyFilter(initialData, q, medium, house), sort)
  const selected = initialData.find(d => d.id === sel) ?? null

  const houseCounts = ORDER.map(h => ({ h, n: initialData.filter(d => d.house === h).length }))
  const maxCount = Math.max(...houseCounts.map(x => x.n), 1)

  return (
    <div className="wrap">
      <header>
        <h1>The Sorting <em>Register</em></h1>
        <div className="tag">{initialData.length} characters on file</div>
      </header>

      <div className="controls">
        <input
          className="search" type="search"
          placeholder="Search characters, books, films…"
          autoComplete="off" aria-label="Search" value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="row" aria-label="Filter by medium">
          {(['all', 'Book', 'Film'] as const).map(m => (
            <button key={m} className="chip" aria-pressed={medium === m} onClick={() => setMedium(m)}>
              {m === 'all' ? 'All sources' : m + 's'}
            </button>
          ))}
        </div>
        <div className="row" aria-label="Filter by house">
          <button className="chip" aria-pressed={house === 'all'} onClick={() => setHouse('all')}>Every house</button>
          {ORDER.map(h => (
            <button key={h} className={`chip ${HOUSE_CLASS[h]}`} aria-pressed={house === h} onClick={() => setHouse(h)}>
              <span className="dot" style={{ background: HOUSES[h].c }} />{h}
            </button>
          ))}
          <span className="spacer" />
          <label className="tag" htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={e => setSort(e.target.value as 'name' | 'conf' | 'year')}>
            <option value="name">Name</option>
            <option value="conf">Strongest fit</option>
            <option value="year">Year</option>
          </select>
        </div>
      </div>

      <div className="tally">
        {houseCounts.map(({ h, n }) => (
          <div key={h} className="tally-card" style={{ '--hc': HOUSES[h].c } as React.CSSProperties}>
            <b>{h}</b>
            <div className="tally-bar"><div className="tally-fill" style={{ width: `${(n / maxCount) * 100}%` }} /></div>
            <span className="tally-count">{n} sorted</span>
          </div>
        ))}
      </div>

      <ul className="list">
        <div className="list-inner">
          {filtered.length === 0 ? (
            <li className="empty">No characters match. Try clearing the filters.</li>
          ) : filtered.map(d => (
            <li key={d.id}>
              <button
                aria-expanded={sel === d.id ? 'true' : 'false'}
                style={{ '--active-bg': HOUSES[d.house].bg } as React.CSSProperties}
                onClick={() => handleSelect(d.id)}
              >
                <span className="stripe" style={{ background: HOUSES[d.house].c }} />
                <Avatar char={d} />
                <span style={{ minWidth: 0, padding: '2px 0' }}>
                  <span className="nm">{d.name}</span>
                  <span className="src">{d.source}{d.year ? ` · ${d.year}` : ''}</span>
                </span>
                <span className="pct" style={{ color: HOUSES[d.house].c }}>
                  {d.house.slice(0, 3).toUpperCase()} {confOf(d)}%
                </span>
              </button>
            </li>
          ))}
        </div>
      </ul>

      {/* Modal */}
      {selected && (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
          <div className="modal-wrap" ref={modalRef} role="dialog" aria-modal="true" aria-label={selected.name}>
            <article className="card">
              <CharacterCard character={selected} onClose={() => setSel(null)} />
            </article>
          </div>
        </div>
      )}
    </div>
  )
}

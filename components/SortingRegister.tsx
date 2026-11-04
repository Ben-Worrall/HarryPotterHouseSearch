'use client'

import { useState, useEffect, useRef } from 'react'
import type { Character, House } from '@/types/character'

const HOUSE_CRESTS: Record<string, React.ReactElement> = {
  Gryffindor: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <ellipse cx="50" cy="54" rx="32" ry="30" opacity=".3"/>
      <circle cx="50" cy="48" r="20"/>
      <polygon points="32,34 26,20 40,28"/>
      <polygon points="68,34 74,20 60,28"/>
      <circle cx="43" cy="44" r="3.5" fill="white" opacity=".9"/>
      <circle cx="57" cy="44" r="3.5" fill="white" opacity=".9"/>
      <circle cx="43.5" cy="44.5" r="2" opacity=".5" fill="white"/>
      <circle cx="57.5" cy="44.5" r="2" opacity=".5" fill="white"/>
      <ellipse cx="50" cy="54" rx="4" ry="2.5" fill="white" opacity=".6"/>
      <path d="M46 57 Q50 61 54 57" stroke="white" strokeWidth="1.5" fill="none" opacity=".6" strokeLinecap="round"/>
      <path d="M20 56 Q22 49 29 44" stroke="currentColor" strokeWidth="3" fill="none" opacity=".45" strokeLinecap="round"/>
      <path d="M80 56 Q78 49 71 44" stroke="currentColor" strokeWidth="3" fill="none" opacity=".45" strokeLinecap="round"/>
      <path d="M24 66 Q28 57 36 55" stroke="currentColor" strokeWidth="3" fill="none" opacity=".45" strokeLinecap="round"/>
      <path d="M76 66 Q72 57 64 55" stroke="currentColor" strokeWidth="3" fill="none" opacity=".45" strokeLinecap="round"/>
      <path d="M33 72 Q50 80 67 72 L64 62 Q50 68 36 62 Z" opacity=".25"/>
    </svg>
  ),
  Slytherin: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M50 85 C30 85 15 70 20 55 C25 40 42 38 48 50 C52 58 45 68 35 65 C25 62 22 50 30 42 C38 34 52 36 60 45 C68 54 65 68 55 72 C45 76 32 72 28 62"
        fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity=".9"/>
      <ellipse cx="62" cy="30" rx="12" ry="8" transform="rotate(30 62 30)"/>
      <ellipse cx="66" cy="26" rx="2" ry="3" fill="white" opacity=".9" transform="rotate(30 66 26)"/>
      <path d="M72 32 L80 26 M80 26 L84 22 M80 26 L84 29" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".8"/>
    </svg>
  ),
  Ravenclaw: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M50 55 C45 50 30 40 15 42 C10 43 12 50 20 48 C28 46 38 52 42 58 Z" opacity=".9"/>
      <path d="M50 55 C55 50 70 40 85 42 C90 43 88 50 80 48 C72 46 62 52 58 58 Z" opacity=".9"/>
      <path d="M15 42 C20 36 30 32 40 38" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
      <path d="M20 44 C26 38 34 36 40 40" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
      <path d="M85 42 C80 36 70 32 60 38" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
      <path d="M80 44 C74 38 66 36 60 40" stroke="white" strokeWidth="1" fill="none" opacity=".35"/>
      <ellipse cx="50" cy="63" rx="8" ry="14" opacity=".8"/>
      <circle cx="50" cy="40" r="11"/>
      <path d="M57 39 L67 42 L57 45 Z" fill="white" opacity=".8"/>
      <circle cx="54" cy="39" r="3" fill="white" opacity=".9"/>
      <circle cx="54.5" cy="39.5" r="1.5" fill="currentColor" opacity=".5"/>
      <path d="M44 76 L50 93 L56 76" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M42 74 L46 91" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".55"/>
      <path d="M58 74 L54 91" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".55"/>
    </svg>
  ),
  Hufflepuff: (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <ellipse cx="50" cy="78" rx="24" ry="16" opacity=".55"/>
      <ellipse cx="50" cy="52" rx="26" ry="22"/>
      <ellipse cx="30" cy="34" rx="8" ry="6"/>
      <ellipse cx="70" cy="34" rx="8" ry="6"/>
      <ellipse cx="30" cy="34" rx="4" ry="3" fill="white" opacity=".45"/>
      <ellipse cx="70" cy="34" rx="4" ry="3" fill="white" opacity=".45"/>
      <path d="M50 30 Q50 52 50 68" stroke="white" strokeWidth="10" strokeLinecap="round" opacity=".65"/>
      <ellipse cx="38" cy="50" rx="10" ry="12" opacity=".3"/>
      <ellipse cx="62" cy="50" rx="10" ry="12" opacity=".3"/>
      <circle cx="38" cy="48" r="4" fill="white" opacity=".9"/>
      <circle cx="62" cy="48" r="4" fill="white" opacity=".9"/>
      <circle cx="38.5" cy="48.5" r="2.2" fill="currentColor" opacity=".5"/>
      <circle cx="62.5" cy="48.5" r="2.2" fill="currentColor" opacity=".5"/>
      <ellipse cx="50" cy="60" rx="5" ry="3.5" fill="white" opacity=".65"/>
      <path d="M45 64 Q50 68 55 64" stroke="white" strokeWidth="1.5" fill="none" opacity=".6" strokeLinecap="round"/>
      <path d="M28 92 L26 100 M34 93 L33 100 M66 93 L67 100 M72 92 L74 100" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".45"/>
    </svg>
  ),
}

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

  return (
    <>
      {d.image_url ? (
        <div className="card-hero">
          <img src={d.image_url} alt={d.name} />
          <div className="card-hero-fade" />
        </div>
      ) : (
        <div className="card-hero card-hero-crest" style={{ background: `linear-gradient(160deg, ${H.c}1a, ${H.c}06)` }}>
          <div className="house-crest" style={{ color: H.c }}>
            {HOUSE_CRESTS[d.house]}
          </div>
          <div className="crest-label" style={{ color: H.c }}>{d.house}</div>
        </div>
      )}
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
                <span className="fill" style={{ '--bar-w': `${d.scores[h]}%`, background: HOUSES[h].c, opacity: h === d.house ? 1 : 0.4 } as React.CSSProperties} />
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

'use client'

import { useState, useEffect } from 'react'
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

function CharacterCard({ character: d }: { character: Character }) {
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
        <div className="card-hero" style={{ background: `linear-gradient(135deg, ${H.c}33, ${H.c}08)` }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--f-display)', fontSize: '5rem', color: H.c, opacity: 0.25, fontStyle: 'italic' }}>
              {d.name[0]}
            </span>
          </div>
        </div>
      )}
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
                <span className="fill" style={{ width: `${d.scores[h]}%`, background: HOUSES[h].c, opacity: h === d.house ? 1 : 0.4 }} />
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
  const [mobileView, setMobileView] = useState<'list' | 'card'>('list')

  useEffect(() => {
    const id = window.location.hash.slice(1)
    const sorted = applySort(initialData, 'name')
    setSel(initialData.find(d => d.id === id)?.id ?? sorted[0]?.id ?? null)
    const onHash = () => {
      const hid = window.location.hash.slice(1)
      if (initialData.find(d => d.id === hid)) setSel(hid)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [initialData])

  const filtered = applySort(applyFilter(initialData, q, medium, house), sort)
  const effectiveSel = filtered.find(d => d.id === sel)?.id ?? filtered[0]?.id ?? null
  const selected = initialData.find(d => d.id === effectiveSel) ?? null

  function handleSelect(id: string) {
    setSel(id)
    setMobileView('card')
    history.replaceState(null, '', '#' + id)
  }

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

      <div className="main">
        {/* List panel */}
        <div style={{ display: mobileView === 'card' ? 'none' : undefined }} id="list-panel">
          <ul className="list">
            <div className="list-inner">
              {filtered.length === 0 ? (
                <li className="empty">No characters match. Try clearing the filters.</li>
              ) : filtered.map(d => (
                <li key={d.id}>
                  <button
                    aria-current={effectiveSel === d.id ? 'true' : undefined}
                    style={{
                      '--active-bg': HOUSES[d.house].bg,
                    } as React.CSSProperties}
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
        </div>

        {/* Card panel */}
        <article
          className="card" id="card" aria-live="polite"
          style={{ display: mobileView === 'list' ? undefined : undefined }}
        >
          {selected
            ? <CharacterCard character={selected} />
            : <div className="card-empty"><p>Select a character to see their sorting.</p></div>
          }
        </article>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav" aria-label="View switcher">
        <button className={mobileView === 'list' ? 'active' : ''} onClick={() => setMobileView('list')}>
          ☰ List ({filtered.length})
        </button>
        <button className={mobileView === 'card' ? 'active' : ''} onClick={() => setMobileView('card')} disabled={!selected}>
          ✦ {selected ? selected.name : 'Select a character'}
        </button>
      </nav>
    </div>
  )
}

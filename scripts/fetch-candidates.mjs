/**
 * Comprehensive candidate fetch: Wikidata + TMDB + Wikipedia enrichment.
 * Produces data/candidates.json compatible with sort_characters.py.
 *
 * Run: node scripts/fetch-candidates.mjs
 * Options:
 *   --wikidata-limit 2000   (default 2000)
 *   --tmdb-pages    20      (default 20, ~400 films)
 *   --min-links     5       (min Wikipedia sitelinks for Wikidata chars)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CANDS_PATH  = join(__dirname, '../data/candidates.json')
const CHARS_PATH  = join(__dirname, '../public/data/characters.json')

// ── helpers ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    for (const line of readFileSync(join(__dirname, '../.env'), 'utf-8').split('\n')) {
      const t = line.trim()
      if (t && !t.startsWith('#') && t.includes('=')) {
        const eq = t.indexOf('='); process.env[t.slice(0,eq).trim()] ??= t.slice(eq+1).trim()
      }
    }
  } catch {}
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (k, def) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i+1]) : def }
  return { wikidataLimit: get('--wikidata-limit', 2000), tmdbPages: get('--tmdb-pages', 20), minLinks: get('--min-links', 5) }
}

// ── Wikidata ──────────────────────────────────────────────────────────
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const EXCLUDE = /harry potter|fantastic beasts/i

function buildQuery(limit, offset, minLinks) {
  return `
SELECT ?char ?charLabel ?work ?workLabel ?kind (MIN(YEAR(?date)) AS ?year)
       (SAMPLE(?creatorLabel) AS ?creator) ?links WHERE {
  ?char wdt:P31/wdt:P279* wd:Q95074 ;
        wdt:P1441 ?work ;
        wikibase:sitelinks ?links .
  { ?work wdt:P31/wdt:P279* wd:Q7725634 . BIND("Book" AS ?kind) }
  UNION
  { ?work wdt:P31/wdt:P279* wd:Q11424 . BIND("Film" AS ?kind) }
  OPTIONAL { ?work wdt:P577 ?date }
  OPTIONAL { ?work wdt:P50|wdt:P57 ?c . ?c rdfs:label ?creatorLabel FILTER(LANG(?creatorLabel)="en") }
  FILTER(?links >= ${minLinks})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?char ?charLabel ?work ?workLabel ?kind ?links
ORDER BY DESC(?links)
LIMIT ${limit} OFFSET ${offset}`
}

async function fetchWikidata(limit, offset, minLinks) {
  const query = buildQuery(limit, offset, minLinks)
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SortingRegister/1.0 (character list builder)', Accept: 'application/sparql-results+json' },
      })
      if (res.ok) return await res.json()
      console.warn(`  Wikidata ${res.status}, retrying...`)
    } catch (e) { console.warn(`  Wikidata error: ${e.message}, retrying...`) }
    await sleep(8000 * (attempt + 1))
  }
  return null
}

function parseWikidataRow(row, existing) {
  const name = row.charLabel?.value
  const work = row.workLabel?.value
  if (!name || !work) return null
  if (/^Q\d+$/.test(name)) return null           // no English label
  if (EXCLUDE.test(work)) return null              // canon HP chars
  const id = slug(name)
  if (existing.has(id)) return null
  return {
    id, name,
    source: work,
    creator: row.creator?.value || '',
    year: row.year?.value ? parseInt(row.year.value) : null,
    medium: row.kind?.value || 'Book',
    wikidata: row.char?.value?.split('/').pop() || '',
    fame: parseInt(row.links?.value || '0'),
  }
}

// ── TMDB ──────────────────────────────────────────────────────────────
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w500'

async function tmdbGet(path) {
  const key = process.env.TMDB_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${TMDB_BASE}${path}&api_key=${key}`)
    return res.ok ? res.json() : null
  } catch { return null }
}

async function fetchTMDBCharacters(pages) {
  const key = process.env.TMDB_API_KEY
  if (!key) { console.log('  No TMDB_API_KEY, skipping TMDB.'); return [] }

  const chars = []
  for (let page = 1; page <= pages; page++) {
    process.stdout.write(`  TMDB page ${page}/${pages}...\r`)
    const data = await tmdbGet(`/movie/popular?language=en-US&page=${page}`)
    if (!data?.results) break
    for (const movie of data.results) {
      if (!movie.release_date || parseInt(movie.release_date) < 1950) continue
      const credits = await tmdbGet(`/movie/${movie.id}/credits?language=en-US`)
      if (!credits?.cast) continue
      for (const actor of credits.cast.slice(0, 8)) {  // top 8 billed chars per film
        if (!actor.character || actor.character.includes('/') || actor.character.includes('|')) continue
        // Skip if name looks like a placeholder
        if (/^(man|woman|doctor|officer|guard|soldier)\b/i.test(actor.character)) continue
        chars.push({
          id: slug(actor.character),
          name: actor.character,
          source: movie.title,
          creator: '',
          year: movie.release_date ? parseInt(movie.release_date) : null,
          medium: 'Film',
          wikidata: '',
          fame: Math.round(movie.popularity || 0),
          image_url: actor.profile_path ? `${TMDB_IMG}${actor.profile_path}` : null,
          tmdb_movie_id: movie.id,
        })
      }
      await sleep(50)
    }
    await sleep(300)
  }
  console.log(`\n  TMDB: found ${chars.length} characters from ${pages * 20} films`)
  return chars
}

// ── Wikipedia enrichment ───────────────────────────────────────────────
async function fetchWikiSummary(name, source) {
  const queries = [name, `${name} (character)`, `${name} (${source})`]
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'SortingRegister/1.0' } }
      )
      if (res.ok) {
        const d = await res.json()
        if (d.type !== 'disambiguation' && d.extract) {
          return {
            image_url: d.thumbnail?.source ?? null,
            wikipedia_summary: d.extract.slice(0, 600),
          }
        }
      }
    } catch {}
    await sleep(150)
  }
  return {}
}

// ── Main ──────────────────────────────────────────────────────────────
loadEnv()
const { wikidataLimit, tmdbPages, minLinks } = parseArgs()

mkdirSync(join(__dirname, '../data'), { recursive: true })

const existing = existsSync(CANDS_PATH) ? JSON.parse(readFileSync(CANDS_PATH, 'utf-8')) : []
const sorted   = existsSync(CHARS_PATH) ? JSON.parse(readFileSync(CHARS_PATH, 'utf-8')) : []
const existingIds = new Map(existing.map(c => [c.id, c]))
const sortedIds   = new Set(sorted.map(c => c.id))

console.log(`\nCurrent state: ${existing.length} candidates, ${sorted.length} sorted\n`)

// 1. Wikidata
console.log(`Fetching up to ${wikidataLimit} characters from Wikidata (min ${minLinks} sitelinks)...`)
let wikidataAdded = 0
for (let offset = 0; offset < wikidataLimit; offset += 500) {
  const limit = Math.min(500, wikidataLimit - offset)
  process.stdout.write(`  offset ${offset}...`)
  const data = await fetchWikidata(limit, offset, minLinks)
  if (!data) { console.log(' failed'); break }
  let batch = 0
  for (const row of data.results.bindings) {
    const c = parseWikidataRow(row, existingIds)
    if (c) { existingIds.set(c.id, c); wikidataAdded++; batch++ }
    // Update medium if already exists (Book+Film → "Book & film")
    else if (existingIds.has(slug(row.charLabel?.value || ''))) {
      const cur = existingIds.get(slug(row.charLabel?.value))
      if (cur && row.kind?.value && !cur.medium.includes(row.kind.value)) {
        cur.medium = 'Book & film'
      }
    }
  }
  console.log(` +${batch}`)
  if (data.results.bindings.length < limit) break
  await sleep(1000)
}
console.log(`Wikidata: added ${wikidataAdded} new candidates\n`)

// 2. TMDB
console.log(`Fetching film characters from TMDB (${tmdbPages} pages of popular films)...`)
const tmdbChars = await fetchTMDBCharacters(tmdbPages)
let tmdbAdded = 0
for (const c of tmdbChars) {
  if (!existingIds.has(c.id)) { existingIds.set(c.id, c); tmdbAdded++ }
  else if (c.image_url && !existingIds.get(c.id).image_url) {
    existingIds.get(c.id).image_url = c.image_url
  }
}
console.log(`TMDB: added ${tmdbAdded} new candidates\n`)

// 3. Wikipedia enrichment for unsorted chars without images
const needsWiki = [...existingIds.values()].filter(c => !sortedIds.has(c.id) && !c.image_url && !c.wikipedia_summary)
const sampleSize = Math.min(needsWiki.length, 300)
if (sampleSize > 0) {
  console.log(`Fetching Wikipedia summaries for ${sampleSize} new candidates...`)
  let done = 0
  for (const c of needsWiki.slice(0, sampleSize)) {
    const wiki = await fetchWikiSummary(c.name, c.source)
    if (wiki.image_url) c.image_url = wiki.image_url
    if (wiki.wikipedia_summary) c.wikipedia_summary = wiki.wikipedia_summary
    done++
    if (done % 50 === 0) process.stdout.write(`  ${done}/${sampleSize}...\r`)
  }
  console.log(`  Done.`)
}

// 4. Save
const allCandidates = [...existingIds.values()].sort((a, b) => (b.fame || 0) - (a.fame || 0))
writeFileSync(CANDS_PATH, JSON.stringify(allCandidates, null, 2))

const unsorted = allCandidates.filter(c => !sortedIds.has(c.id))
console.log(`\n✓ Saved ${allCandidates.length} candidates to data/candidates.json`)
console.log(`  ${sorted.length} already sorted`)
console.log(`  ${unsorted.length} ready to sort`)
console.log(`\nNext: run  python3 scripts/sort_characters.py --count 100  on your Linux laptop`)

/**
 * Fetch book characters from Wikidata using a simple, fast query.
 * Run: node scripts/fetch-book-chars.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CANDS_PATH = join(__dirname, '../data/candidates.json')

function loadEnv() {
  try {
    for (const line of readFileSync(join(__dirname, '../.env'), 'utf-8').split('\n')) {
      const t = line.trim()
      if (t && !t.startsWith('#') && t.includes('=')) {
        const eq = t.indexOf('=')
        process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim()
      }
    }
  } catch {}
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const EXCLUDE = /harry potter|fantastic beasts/i

// Simpler query: just book characters with high fame, no complex joins
const QUERIES = [
  // Well-known literary characters
  `SELECT ?char ?charLabel ?work ?workLabel ?fame WHERE {
    ?char wdt:P31 wd:Q95074 ; wdt:P1441 ?work ; wikibase:sitelinks ?fame .
    ?work wdt:P31/wdt:P279* wd:Q7725634 .
    FILTER(?fame >= 25)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?fame) LIMIT 400`,
  // Characters from films as well (Book & film)
  `SELECT ?char ?charLabel ?work ?workLabel ?fame WHERE {
    ?char wdt:P31 wd:Q95074 ; wdt:P1441 ?work ; wikibase:sitelinks ?fame .
    ?work wdt:P31/wdt:P279* wd:Q11424 .
    FILTER(?fame >= 30)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } ORDER BY DESC(?fame) LIMIT 400`,
]

async function runQuery(sparql) {
  const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql) + '&format=json'
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SortingRegister/1.0', Accept: 'application/sparql-results+json' },
        signal: AbortSignal.timeout(45000),
      })
      if (res.ok) return await res.json()
      console.warn(`  ${res.status} - retrying in ${(attempt + 1) * 5}s...`)
    } catch (e) {
      console.warn(`  Error: ${e.message} - retrying...`)
    }
    await sleep(5000 * (attempt + 1))
  }
  return null
}

loadEnv()
mkdirSync(join(__dirname, '../data'), { recursive: true })

const existing = existsSync(CANDS_PATH) ? JSON.parse(readFileSync(CANDS_PATH, 'utf-8')) : []
const existingIds = new Map(existing.map(c => [c.id, c]))
const startCount = existing.length

console.log(`\nStarting with ${existing.length} candidates. Fetching book characters from Wikidata...\n`)

let totalAdded = 0
for (let i = 0; i < QUERIES.length; i++) {
  console.log(`Running query ${i + 1}/${QUERIES.length}...`)
  const data = await runQuery(QUERIES[i])
  if (!data) { console.log('  Failed, skipping.'); continue }

  let added = 0
  for (const row of data.results.bindings) {
    const name = row.charLabel?.value
    const work = row.workLabel?.value
    if (!name || !work || /^Q\d+$/.test(name)) continue
    if (EXCLUDE.test(work)) continue
    const id = slug(name)
    if (existingIds.has(id)) {
      // Upgrade to "Book & film" if needed
      const cur = existingIds.get(id)
      if (cur.medium === 'Film' && QUERIES[i].includes('Q7725634')) cur.medium = 'Book & film'
      else if (cur.medium === 'Book' && QUERIES[i].includes('Q11424')) cur.medium = 'Book & film'
      continue
    }
    const isBook = QUERIES[i].includes('Q7725634')
    existingIds.set(id, {
      id, name, source: work,
      creator: '', year: null,
      medium: isBook ? 'Book' : 'Film',
      wikidata: row.char?.value?.split('/').pop() || '',
      fame: parseInt(row.fame?.value || '0'),
    })
    added++
  }
  totalAdded += added
  console.log(`  Added ${added} new characters (${data.results.bindings.length} returned)`)
  await sleep(2000)
}

const allCandidates = [...existingIds.values()].sort((a, b) => (b.fame || 0) - (a.fame || 0))
writeFileSync(CANDS_PATH, JSON.stringify(allCandidates, null, 2))

console.log(`\n✓ Done. Added ${totalAdded} book characters.`)
console.log(`  Total candidates: ${allCandidates.length} (was ${startCount})`)

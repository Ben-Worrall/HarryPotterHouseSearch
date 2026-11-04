/**
 * Fetch Wikipedia summaries for all candidates that don't have one yet.
 * Writes results back into data/candidates.json.
 * No API key needed — Wikipedia's REST API is free.
 *
 * Usage:
 *   node scripts/enrich-candidates.mjs              # all missing
 *   node scripts/enrich-candidates.mjs --count 200  # do at most 200 this run
 *   node scripts/enrich-candidates.mjs --medium Book # only book characters
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CANDS_PATH = join(__dirname, '../data/candidates.json')

function getArg(name, def) {
  const i = process.argv.indexOf(name)
  if (i < 0) return def
  return process.argv[i + 1]
}

const COUNT  = parseInt(getArg('--count', '99999'))
const MEDIUM = getArg('--medium', null)  // e.g. "Book" to only do book chars

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchWikiSummary(name, source) {
  // Try three title variants, most specific first
  const queries = [
    name,
    `${name} (character)`,
    `${name} (${source})`,
  ]

  for (const q of queries) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SortingRegister/1.0 (educational project)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue
      const d = await res.json()
      if (d.type === 'disambiguation' || !d.extract || d.extract.length < 40) continue
      // Skip articles that are clearly about the actor/author, not the character
      if (/born \d{4}|is an? (actor|author|director|writer|singer)/i.test(d.extract.slice(0, 120))) continue
      return d.extract.slice(0, 600)
    } catch {}
    await sleep(150)
  }
  return null
}

const candidates = JSON.parse(readFileSync(CANDS_PATH, 'utf-8'))

const toEnrich = candidates.filter(c => {
  if (c.wikipedia_summary) return false
  if (MEDIUM && c.medium !== MEDIUM) return false
  return true
}).slice(0, COUNT)

console.log(`\n${candidates.length} total candidates.`)
console.log(`${toEnrich.length} need Wikipedia summaries${MEDIUM ? ` (${MEDIUM} only)` : ''}.`)
if (toEnrich.length === 0) { console.log('Nothing to do.'); process.exit(0) }
console.log()

let found = 0
let notFound = 0

for (let i = 0; i < toEnrich.length; i++) {
  const c = toEnrich[i]
  process.stdout.write(`[${i + 1}/${toEnrich.length}] ${c.name} (${c.source})... `)

  const summary = await fetchWikiSummary(c.name, c.source)

  // Update the candidate in the main array
  const idx = candidates.findIndex(x => x.id === c.id)
  if (idx >= 0) {
    candidates[idx].wikipedia_summary = summary ?? ''
  }

  if (summary) {
    found++
    console.log(`✓ (${summary.length} chars)`)
  } else {
    notFound++
    console.log(`—`)
  }

  // Save every 25 characters so progress isn't lost on interruption
  if ((i + 1) % 25 === 0) {
    writeFileSync(CANDS_PATH, JSON.stringify(candidates, null, 2))
    console.log(`  [saved progress — ${i + 1}/${toEnrich.length}]`)
  }

  await sleep(200)
}

writeFileSync(CANDS_PATH, JSON.stringify(candidates, null, 2))
console.log(`\n✓ Done. Found summaries for ${found}/${toEnrich.length} characters (${notFound} not found).`)
console.log(`  Run sort-local.mjs next to sort them with the enriched context.`)

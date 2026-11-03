/**
 * Local sorter — uses the `claude` CLI already authenticated on this machine.
 * Reads data/candidates.json, sorts in batches, upserts to Supabase.
 *
 * Usage: node scripts/sort-local.mjs [--count 50] [--batch 5]
 */
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CANDS_PATH = join(ROOT, 'data', 'candidates.json')
const CHARS_PATH = join(ROOT, 'public', 'data', 'characters.json')

// ── load .env ─────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf-8').split('\n')) {
      const t = line.trim()
      if (t && !t.startsWith('#') && t.includes('=')) {
        const eq = t.indexOf('=')
        process.env[t.slice(0, eq).trim()] ??= t.slice(eq + 1).trim()
      }
    }
  } catch {}
}

// ── args ──────────────────────────────────────────────────────────────────
function getArg(name, def) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? parseInt(process.argv[i + 1]) : def
}

const COUNT = getArg('--count', 50)   // total to sort this run
const BATCH = getArg('--batch', 5)    // characters per claude call

// ── Supabase ──────────────────────────────────────────────────────────────
async function supabaseGet(url, key, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabaseUpsert(url, key, records) {
  const res = await fetch(`${url}/rest/v1/characters`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(records),
  })
  if (!res.ok) throw new Error(`Supabase upsert failed: ${res.status} ${await res.text()}`)
}

// ── rubric ────────────────────────────────────────────────────────────────
const SYSTEM = `You are the Sorting Hat for characters from all of fiction. Judge each character on who they are across their story, not one scene.

House criteria:
- Gryffindor: courage, nerve, chivalry, acting boldly on principle.
- Slytherin: ambition, cunning, resourcefulness, self-preservation, pride.
- Ravenclaw: intellect, curiosity, wit, creativity, love of learning.
- Hufflepuff: loyalty, patience, hard work, fairness, kindness.

For EACH character return one JSON object on a single line with these keys:
  "id": the character's id as given
  "scores": {Gryffindor, Slytherin, Ravenclaw, Hufflepuff} integer percentages summing to 100
  "house": the house with the highest score
  "traits": array of 3 short trait labels (1-3 words each)
  "background": 2 sentences of spoiler-light background
  "reasoning": 3-4 sentences on why they belong in that house, citing specific actions, naming the runner-up house

Return ONLY a JSON array — no markdown, no commentary. If you don't know a character well enough, use {"id":"...","unknown":true}.`

const HOUSES = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff']

function normalise(raw) {
  try {
    let total = 0
    const scores = {}
    for (const h of HOUSES) { scores[h] = parseInt(raw[h] ?? 0); total += scores[h] }
    if (!total) return null
    for (const h of HOUSES) scores[h] = Math.round(scores[h] * 100 / total)
    return scores
  } catch { return null }
}

const TMP_PROMPT = join(ROOT, 'data', '_sort_prompt.txt')
const TMP_OUT    = join(ROOT, 'data', '_sort_out.txt')

function sortBatch(candidates) {
  const prompt = `Sort these ${candidates.length} characters. Return ONLY a JSON array, no markdown:\n` +
    candidates.map(c =>
      JSON.stringify({
        id: c.id, name: c.name, from: c.source,
        ...(c.year ? { year: c.year } : {}),
        ...(c.wikipedia_summary ? { background: c.wikipedia_summary.slice(0, 200) } : {}),
      })
    ).join('\n')

  // Write prompt to file to avoid shell escaping issues
  writeFileSync(TMP_PROMPT, `${SYSTEM}\n\n${prompt}`, 'utf-8')

  let raw
  try {
    const out = execSync(
      `claude -p --output-format json < "${TMP_PROMPT}"`,
      { timeout: 120000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf-8', shell: true }
    )
    const parsed = JSON.parse(out)
    raw = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed)
  } catch (e) {
    throw new Error(`claude -p failed: ${e.message.slice(0, 300)}`)
  }

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in response. Got: ${raw.slice(0, 300)}`)
  return JSON.parse(match[0])
}

// ── main ──────────────────────────────────────────────────────────────────
loadEnv()

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const candidates = JSON.parse(readFileSync(CANDS_PATH, 'utf-8'))
console.log(`\nLoaded ${candidates.length} candidates.`)

// Get already-sorted IDs from Supabase
process.stdout.write('Fetching sorted IDs from Supabase... ')
const existing = await supabaseGet(SUPA_URL, SUPA_KEY, 'characters?select=id')
const sortedIds = new Set(existing.map(c => c.id))
console.log(`${sortedIds.size} already sorted.`)

const pending = candidates.filter(c => !sortedIds.has(c.id))
console.log(`${pending.length} remaining. Will sort up to ${COUNT} this run.\n`)

const toSort = pending.slice(0, COUNT)
let totalSorted = 0
let totalSkipped = 0

for (let i = 0; i < toSort.length; i += BATCH) {
  const batch = toSort.slice(i, i + BATCH)
  process.stdout.write(`[${i + 1}–${Math.min(i + BATCH, toSort.length)}/${toSort.length}] Sorting ${batch.map(c => c.name).join(', ')}... `)

  try {
    const results = sortBatch(batch)
    const records = []

    for (const item of results) {
      if (item.unknown) { totalSkipped++; continue }
      const cand = batch.find(c => c.id === item.id)
      if (!cand) continue
      const scores = normalise(item.scores)
      if (!scores) { totalSkipped++; continue }
      const house = HOUSES.reduce((a, b) => scores[a] >= scores[b] ? a : b)
      records.push({
        id: cand.id, name: cand.name, source: cand.source,
        creator: cand.creator || '', year: cand.year ?? null, medium: cand.medium,
        house, scores,
        traits: (item.traits ?? []).slice(0, 3),
        background: String(item.background ?? '').trim(),
        reasoning: String(item.reasoning ?? '').trim(),
        image_url: cand.image_url ?? null,
        wikipedia_summary: cand.wikipedia_summary ?? null,
      })
    }

    if (records.length > 0) {
      await supabaseUpsert(SUPA_URL, SUPA_KEY, records)
      totalSorted += records.length
      console.log(`✓ ${records.length} saved`)
    } else {
      console.log(`⚠ all skipped`)
      totalSkipped += batch.length
    }
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 120)}`)
    totalSkipped += batch.length
  }

  // Brief pause between batches
  await new Promise(r => setTimeout(r, 800))
}

console.log(`\n✓ Done. Sorted ${totalSorted}, skipped ${totalSkipped}.`)
console.log(`  Total in Supabase now: ~${sortedIds.size + totalSorted}`)
console.log(`  Remaining: ~${pending.length - totalSorted}`)
if (pending.length - totalSorted > 0) {
  console.log(`  Run again to continue: node scripts/sort-local.mjs --count ${COUNT}`)
}

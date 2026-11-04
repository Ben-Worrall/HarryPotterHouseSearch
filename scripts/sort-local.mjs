/**
 * Local sorter — calls the Google Gemini API directly.
 * No claude -p, no session limits, completely free.
 *
 * Usage: node scripts/sort-local.mjs [--count 500] [--batch 15]
 * Requires GOOGLE_API_KEY in .env (free from aistudio.google.com)
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CANDS_PATH = join(ROOT, 'data', 'candidates.json')

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

const COUNT = getArg('--count', 500)
const BATCH = getArg('--batch', 15)

// ── Supabase ──────────────────────────────────────────────────────────────
async function supabaseGet(url, key, path) {
  // Paginate to get all rows (Supabase default limit is 1000)
  const all = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${url}/rest/v1/${path}${sep}offset=${from}&limit=${pageSize}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' },
    })
    if (!res.ok) throw new Error(`Supabase GET failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    all.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }
  return all
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

// ── Gemini ────────────────────────────────────────────────────────────────
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
]

async function callGemini(promptText, apiKey, modelIdx = 0, attempt = 0) {
  const model = GEMINI_MODELS[modelIdx % GEMINI_MODELS.length]
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(60000),
    }
  )

  // Rate limited — try next model immediately
  if (res.status === 429) {
    if (modelIdx + 1 < GEMINI_MODELS.length) {
      await sleep(1000)
      return callGemini(promptText, apiKey, modelIdx + 1, 0)
    }
    throw new Error(`Rate limited on all models`)
  }

  // Model overloaded/unavailable — try next model
  if (res.status === 503 || res.status === 404) {
    if (modelIdx + 1 < GEMINI_MODELS.length) {
      await sleep(1000)
      return callGemini(promptText, apiKey, modelIdx + 1, 0)
    }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${model} ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function sortBatch(candidates, apiKey) {
  const prompt = `Sort these ${candidates.length} characters. Return ONLY a JSON array, no markdown:\n` +
    candidates.map(c =>
      JSON.stringify({
        id: c.id, name: c.name, from: c.source,
        ...(c.year ? { year: c.year } : {}),
        ...(c.wikipedia_summary ? { background: c.wikipedia_summary.slice(0, 200) } : {}),
      })
    ).join('\n')

  const text = await callGemini(prompt, apiKey)
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`No JSON array in response: ${text.slice(0, 200)}`)
  return JSON.parse(match[0])
}

// ── main ──────────────────────────────────────────────────────────────────
loadEnv()

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = process.env.GOOGLE_API_KEY

if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
if (!GOOGLE_KEY) {
  console.error('\nMissing GOOGLE_API_KEY in .env')
  console.error('Get a free key in 30 seconds at https://aistudio.google.com/app/apikey')
  console.error('Then add:  GOOGLE_API_KEY=your-key-here  to your .env file\n')
  process.exit(1)
}

const candidates = JSON.parse(readFileSync(CANDS_PATH, 'utf-8'))
console.log(`\nLoaded ${candidates.length} candidates.`)

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
  const names = batch.map(c => c.name).join(', ')
  process.stdout.write(`[${i + 1}–${Math.min(i + BATCH, toSort.length)}/${toSort.length}] ${names.slice(0, 80)}... `)

  try {
    const results = await sortBatch(batch, GOOGLE_KEY)
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
      totalSkipped += batch.length
      console.log(`⚠ all skipped`)
    }
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 120)}`)
    totalSkipped += batch.length
  }

  await sleep(500)
}

console.log(`\n✓ Done. Sorted ${totalSorted}, skipped ${totalSkipped}.`)
console.log(`  Total in Supabase now: ~${sortedIds.size + totalSorted}`)
console.log(`  Remaining: ~${pending.length - totalSorted}`)
if (pending.length - totalSorted > 0) {
  console.log(`  Run again to continue: node scripts/sort-local.mjs --count ${COUNT}`)
}

/**
 * Fetch Wikipedia images + summaries for all characters and sync to Supabase.
 * Run with: node scripts/enrich-characters.mjs
 * Skips characters that already have image_url set.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHARS_PATH = join(__dirname, '../public/data/characters.json')

function loadEnv() {
  try {
    const lines = readFileSync(join(__dirname, '../.env'), 'utf-8').split('\n')
    for (const line of lines) {
      const t = line.trim()
      if (t && !t.startsWith('#') && t.includes('=')) {
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim()
        process.env[k] ??= v
      }
    }
  } catch {}
}

async function fetchWiki(name, source) {
  const queries = [name, `${name} (character)`, `${name} (${source})`]
  for (const q of queries) {
    try {
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'SortingRegister/0.1' } }
      )
      if (r.ok) {
        const d = await r.json()
        if (d.type !== 'disambiguation' && d.extract) {
          return {
            image_url: d.thumbnail?.source ?? null,
            wikipedia_summary: d.extract.slice(0, 600),
          }
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  return { image_url: null, wikipedia_summary: null }
}

async function fetchTMDB(name, source) {
  const key = process.env.TMDB_API_KEY
  if (!key) return null
  try {
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(source)}&api_key=${key}`
    )
    const search = await searchRes.json()
    const movieId = search.results?.[0]?.id
    if (!movieId) return null
    const creditsRes = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${key}`
    )
    const credits = await creditsRes.json()
    const nl = name.toLowerCase()
    const match = credits.cast?.find(c =>
      c.character.toLowerCase().includes(nl) || nl.includes(c.character.toLowerCase().split(' ')[0])
    )
    return match?.profile_path ? `https://image.tmdb.org/t/p/w500${match.profile_path}` : null
  } catch {}
  return null
}

async function upsertSupabase(chars) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.log('  Supabase env vars not set, skipping sync.'); return }
  const res = await fetch(`${url}/rest/v1/characters`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(chars),
  })
  console.log(`  Supabase: ${res.status} ${res.ok ? 'OK' : await res.text()}`)
}

loadEnv()
const characters = JSON.parse(readFileSync(CHARS_PATH, 'utf-8'))
console.log(`Enriching ${characters.length} characters...\n`)

const updated = []
for (const char of characters) {
  if (char.image_url) {
    updated.push(char)
    console.log(`  ${char.name} — already has image, skipping`)
    continue
  }
  process.stdout.write(`  ${char.name}... `)
  const wiki = await fetchWiki(char.name, char.source)

  let image_url = wiki.image_url
  if (!image_url && char.medium.includes('Film')) {
    image_url = await fetchTMDB(char.name, char.source)
  }

  const enriched = { ...char, image_url, wikipedia_summary: wiki.wikipedia_summary }
  updated.push(enriched)
  console.log(image_url ? `✓ image` : `no image`)
}

writeFileSync(CHARS_PATH, JSON.stringify(updated, null, 2))
console.log('\nUpdated public/data/characters.json')

await upsertSupabase(updated)
console.log('Done.')

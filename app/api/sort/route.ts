import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const HOUSES = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'] as const
type House = typeof HOUSES[number]

const SYSTEM = `You are the Sorting Hat for characters from all of fiction. Judge each character on who they are across their story, not one scene.

House criteria:
- Gryffindor: courage, nerve, chivalry, acting boldly on principle.
- Slytherin: ambition, cunning, resourcefulness, self-preservation, pride.
- Ravenclaw: intellect, curiosity, wit, creativity, love of learning.
- Hufflepuff: loyalty, patience, hard work, fairness, kindness.

Return ONLY a JSON object with these keys:
  "scores": integer percentages for Gryffindor, Slytherin, Ravenclaw, Hufflepuff, summing to 100
  "house": the house with the highest score
  "traits": 3 short trait labels (1-3 words each)
  "background": 2 sentences of spoiler-light background on the character and their story
  "reasoning": 3-4 sentences on why they belong in that house, citing specific actions from the story, and naming the runner-up house and why it came close

Write in plain, direct English. If you do not know the character well enough, return {"unknown": true}.`

// Read-only client using anon key (always available)
function getSupabaseRead() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Write client using service role key (needed for upserts)
function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in Vercel env vars')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

function getAI() {
  const vercel = createOpenAI({
    baseURL: 'https://api.vercel.ai/v1',
    apiKey: process.env.VERCEL_AI_API_KEY!,
  })
  return vercel('anthropic/claude-3-5-haiku-20241022')
}

function loadCandidates() {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'data/candidates.json'), 'utf-8')) as any[]
  } catch {
    return []
  }
}

function normalise(data: any): Record<House, number> | null {
  try {
    const raw: Record<House, number> = {} as any
    let total = 0
    for (const h of HOUSES) {
      raw[h] = parseInt(data?.scores?.[h] ?? 0)
      total += raw[h]
    }
    if (total === 0) return null
    const scores = {} as Record<House, number>
    for (const h of HOUSES) scores[h] = Math.round(raw[h] * 100 / total)
    return scores
  } catch {
    return null
  }
}

// GET /api/sort — return stats + env diagnostics
export async function GET() {
  const supabase = getSupabaseRead()
  const candidates = loadCandidates()

  const { data: existing, error } = await supabase.from('characters').select('id')
  if (error) {
    return NextResponse.json({
      error: `Supabase error: ${error.message}`,
      hint: 'Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel and the characters table exists.',
    }, { status: 500 })
  }

  const sortedIds = new Set(existing?.map((c: any) => c.id) ?? [])
  return NextResponse.json({
    total: candidates.length,
    sorted: sortedIds.size,
    pending: candidates.filter((c: any) => !sortedIds.has(c.id)).length,
    envCheck: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseAdmin: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      vercelAI: !!process.env.VERCEL_AI_API_KEY,
    },
  })
}

// POST /api/sort — sort next batch
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const batchSize = Math.min(parseInt(body.count ?? 5), 20)

  let supabase: ReturnType<typeof getSupabaseAdmin>
  try { supabase = getSupabaseAdmin() }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }

  const vercelAIKey = process.env.VERCEL_AI_API_KEY
  if (!vercelAIKey) {
    return NextResponse.json({ error: 'VERCEL_AI_API_KEY is not set in Vercel env vars' }, { status: 500 })
  }

  const candidates = loadCandidates()

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No candidates found. candidates.json missing from deployment.' }, { status: 500 })
  }

  const { data: existing, error: fetchErr } = await supabase.from('characters').select('id')
  if (fetchErr) return NextResponse.json({ error: `Supabase read error: ${fetchErr.message}` }, { status: 500 })
  const sortedIds = new Set(existing?.map((c: any) => c.id) ?? [])

  const pending = candidates.filter((c: any) => !sortedIds.has(c.id)).slice(0, batchSize)
  if (pending.length === 0) {
    return NextResponse.json({ message: 'All candidates already sorted!', sorted: 0, newCharacters: [] })
  }

  const model = getAI()
  const results: any[] = []
  const skipped: string[] = []
  let firstError: string | null = null
  let firstRawText: string | null = null

  for (const c of pending) {
    try {
      const prompt = [
        `Character: ${c.name}`,
        `From: ${c.source}`,
        c.creator ? `Creator: ${c.creator}` : null,
        c.year ? `Year: ${c.year}` : null,
        c.wikipedia_summary ? `\nBackground: ${c.wikipedia_summary}` : null,
      ].filter(Boolean).join('\n')

      const { text } = await generateText({ model, system: SYSTEM, prompt, maxOutputTokens: 500 })

      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        if (!firstRawText) firstRawText = text.slice(0, 300)
        skipped.push(c.name)
        break // stop after first bad response — almost certainly a config issue
      }

      const data = JSON.parse(match[0])
      if (data.unknown) { skipped.push(c.name); continue }

      // If the response looks like an API error rather than sorting output, surface it
      if (!data.scores) {
        if (!firstRawText) firstRawText = `No "scores" in response. Got: ${JSON.stringify(data).slice(0, 300)}`
        skipped.push(c.name)
        break
      }

      const scores = normalise(data)
      if (!scores) {
        if (!firstRawText) firstRawText = `Bad scores. Raw: ${JSON.stringify(data).slice(0, 300)}`
        skipped.push(c.name)
        break
      }

      const house = HOUSES.reduce((a, b) => scores[a] >= scores[b] ? a : b)

      results.push({
        id: c.id,
        name: c.name,
        source: c.source,
        creator: c.creator || '',
        year: c.year ?? null,
        medium: c.medium,
        house,
        scores,
        traits: (data.traits ?? []).slice(0, 3),
        background: String(data.background ?? '').trim(),
        reasoning: String(data.reasoning ?? '').trim(),
        image_url: c.image_url ?? null,
        wikipedia_summary: c.wikipedia_summary ?? null,
      })
    } catch (e: any) {
      console.error(`Sort error for ${c.name}:`, e)
      if (!firstError) firstError = e.message ?? String(e)
      skipped.push(c.name)
      // If the very first character fails, it's almost certainly an AI config error — stop early
      if (results.length === 0 && skipped.length === 1) break
    }
  }

  // Surface any failure immediately so the admin page can show it
  if (results.length === 0) {
    if (firstError) return NextResponse.json({ error: `AI call failed: ${firstError}` }, { status: 500 })
    if (firstRawText !== null) return NextResponse.json({ error: `AI returned unexpected response (not JSON). Raw response: "${firstRawText}"` }, { status: 500 })
  }

  if (results.length > 0) {
    const { error } = await supabase!.from('characters').upsert(results, { onConflict: 'id' })
    if (error) return NextResponse.json({ error: `Supabase write error: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({
    sorted: results.length,
    skipped: skipped.length,
    newCharacters: results.map(r => ({ name: r.name, house: r.house, source: r.source })),
  })
}

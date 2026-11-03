import { NextResponse } from 'next/server'

// Called nightly by Vercel cron — sorts 10 characters automatically
export async function GET(req: Request) {
  // Verify this is from Vercel cron (not a random public call)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://harrypotter-search.vercel.app'
  const res = await fetch(`${base}/api/sort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 10 }),
  })
  const data = await res.json()
  return NextResponse.json(data)
}

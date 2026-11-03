export interface WikiResult {
  summary: string
  image_url: string | null
  url: string | null
}

export async function fetchWikipedia(name: string, source?: string): Promise<WikiResult | null> {
  const queries = [name, `${name} (character)`, source ? `${name} (${source})` : null].filter(Boolean) as string[]
  for (const query of queries) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        {
          headers: { 'User-Agent': 'SortingRegister/0.1 (educational project)' },
          next: { revalidate: 86400 },
        }
      )
      if (res.ok) {
        const data = await res.json()
        if (data.type !== 'disambiguation' && data.extract) {
          return {
            summary: data.extract.slice(0, 600),
            image_url: data.thumbnail?.source ?? null,
            url: data.content_urls?.desktop?.page ?? null,
          }
        }
      }
    } catch {}
  }
  return null
}

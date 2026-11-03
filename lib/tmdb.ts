const BASE = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p/w500'

export async function fetchTMDBCharacterImage(characterName: string, movieTitle: string): Promise<string | null> {
  const key = process.env.TMDB_API_KEY
  if (!key) return null
  try {
    const searchRes = await fetch(
      `${BASE}/search/movie?query=${encodeURIComponent(movieTitle)}&api_key=${key}`,
      { next: { revalidate: 86400 } }
    )
    const search = await searchRes.json()
    const movieId = search.results?.[0]?.id
    if (!movieId) return null

    const creditsRes = await fetch(`${BASE}/movie/${movieId}/credits?api_key=${key}`, {
      next: { revalidate: 86400 },
    })
    const credits = await creditsRes.json()
    const nameLower = characterName.toLowerCase()
    const match = credits.cast?.find((c: { character: string; profile_path: string | null }) =>
      c.character.toLowerCase().includes(nameLower) ||
      nameLower.includes(c.character.toLowerCase().split(' ')[0])
    )
    if (match?.profile_path) return `${IMG}${match.profile_path}`
  } catch {}
  return null
}

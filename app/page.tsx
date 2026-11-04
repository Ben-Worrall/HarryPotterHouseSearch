import { supabase } from '@/lib/supabase'
import type { Character } from '@/types/character'
import SortingRegister from '@/components/SortingRegister'

// Revalidate every 60s so newly sorted characters appear quickly
export const revalidate = 60

export default async function Home() {
  // Supabase default limit is 1000 — paginate to get all characters
  const all: Character[] = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from('characters')
      .select('id,name,source,creator,year,medium,house,scores,traits,background,reasoning,image_url')
      .order('name')
      .range(from, from + pageSize - 1)

    if (error) { console.error('Supabase fetch error:', error.message); break }
    if (!data || data.length === 0) break
    all.push(...(data as Character[]))
    if (data.length < pageSize) break
    from += pageSize
  }

  return <SortingRegister initialData={all} />
}

import { supabase } from '@/lib/supabase'
import type { Character } from '@/types/character'
import SortingRegister from '@/components/SortingRegister'

// Revalidate every 60s so newly sorted characters appear quickly
export const revalidate = 60

export default async function Home() {
  const { data, error } = await supabase
    .from('characters')
    .select('id,name,source,creator,year,medium,house,scores,traits,background,reasoning,image_url')
    .order('name')

  if (error) {
    console.error('Supabase fetch error:', error.message)
  }

  const characters = (data ?? []) as Character[]
  return <SortingRegister initialData={characters} />
}

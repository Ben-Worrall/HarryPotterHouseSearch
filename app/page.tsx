import { supabase } from '@/lib/supabase'
import type { Character } from '@/types/character'
import SortingRegister from '@/components/SortingRegister'

// Revalidate every hour so nightly additions appear without a manual redeploy
export const revalidate = 3600

export default async function Home() {
  const { data, error } = await supabase
    .from('characters')
    .select('id,name,source,creator,year,medium,house,scores,traits,background,reasoning')
    .order('name')

  if (error) {
    console.error('Supabase fetch error:', error.message)
  }

  const characters = (data ?? []) as Character[]
  return <SortingRegister initialData={characters} />
}

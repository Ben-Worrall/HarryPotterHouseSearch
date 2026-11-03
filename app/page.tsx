import characters from '@/public/data/characters.json'
import type { Character } from '@/types/character'
import SortingRegister from '@/components/SortingRegister'

export default function Home() {
  return <SortingRegister initialData={characters as Character[]} />
}

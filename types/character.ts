export type House = 'Gryffindor' | 'Slytherin' | 'Ravenclaw' | 'Hufflepuff'

export interface Character {
  id: string
  name: string
  source: string
  creator: string
  year: number | null
  medium: string
  house: House
  scores: Record<House, number>
  traits: string[]
  background: string
  reasoning: string
  image_url?: string | null
  wikipedia_summary?: string | null
}

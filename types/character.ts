export type House = 'Gryffindor' | 'Slytherin' | 'Ravenclaw' | 'Hufflepuff'

export interface Character {
  id: string
  name: string
  source: string
  creator: string
  year: number
  medium: string
  house: House
  scores: Record<House, number>
  traits: string[]
  background: string
  reasoning: string
}

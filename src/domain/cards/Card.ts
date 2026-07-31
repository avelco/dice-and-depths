import cardsData from '../../data/cards.json'

export type CardRarity = 'common' | 'rare' | 'legendary'
export type CardEffectType = 'damage' | 'poison' | 'shield' | 'heal'

export interface CardEffect {
  type: CardEffectType
  value: number
}

export interface CardDef {
  id: string
  rarity: CardRarity
  effects: CardEffect[]
}

export interface RunCard {
  id: string
  defId: string
}

const DEFS = cardsData as CardDef[]
const BY_ID = new Map(DEFS.map(d => [d.id, d]))

let nextId = 1

export function allCardDefs(): CardDef[] {
  return DEFS
}

export function cardDef(id: string): CardDef | undefined {
  return BY_ID.get(id)
}

export function makeRunCard(defId: string): RunCard {
  return { id: `c${nextId++}`, defId }
}

export function makeRunCards(defIds: string[]): RunCard[] {
  return defIds.map(makeRunCard)
}

export function effectsOf(card: RunCard): CardEffect[] {
  return cardDef(card.defId)?.effects ?? []
}

export function sumEffect(cards: RunCard[], type: CardEffectType): number {
  let total = 0
  for (const c of cards) {
    for (const e of effectsOf(c)) {
      if (e.type === type) total += e.value
    }
  }
  return total
}

/** Reset id counter (tests). */
export function resetCardIds(start = 1) {
  nextId = start
}

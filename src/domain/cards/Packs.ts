import { allCardDefs, type CardDef, type CardRarity } from './Card'

const RARITY_WEIGHT: Record<CardRarity, number> = {
  common: 70,
  rare: 25,
  legendary: 5,
}

export const PACK_SIZE = 5
export const STARTER_PACK_COUNT = 2
export const DECK_SIZE = 10

function pickWeighted(defs: CardDef[], rng: () => number): CardDef {
  let total = 0
  for (const d of defs) total += RARITY_WEIGHT[d.rarity]
  let roll = rng() * total
  for (const d of defs) {
    roll -= RARITY_WEIGHT[d.rarity]
    if (roll <= 0) return d
  }
  return defs[defs.length - 1]!
}

/** Open one pack → PACK_SIZE card def ids. */
export function openPack(rng: () => number = Math.random): string[] {
  const pool = allCardDefs()
  const out: string[] = []
  for (let i = 0; i < PACK_SIZE; i++) {
    out.push(pickWeighted(pool, rng).id)
  }
  return out
}

export function openPacks(
  count: number,
  rng: () => number = Math.random,
): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(...openPack(rng))
  return out
}

/** Prefer class signature cards when building the first active deck. */
export function buildActiveDeck(
  collection: string[],
  signatureIds: string[] = [],
  size = DECK_SIZE,
): string[] {
  const deck: string[] = []
  for (const id of signatureIds) {
    if (collection.includes(id) && !deck.includes(id) && deck.length < size) {
      deck.push(id)
    }
  }
  for (const id of collection) {
    if (deck.length >= size) break
    // Allow duplicates from collection multiplicity
    const used = deck.filter(x => x === id).length
    const owned = collection.filter(x => x === id).length
    if (used < owned) deck.push(id)
  }
  // Pad with strikes if somehow short
  while (deck.length < size) deck.push('strike')
  return deck.slice(0, size)
}

/** End-of-run pack count: 2 on victory, 1 on defeat. */
export function endRunPackCount(victory: boolean): number {
  return victory ? 2 : 1
}

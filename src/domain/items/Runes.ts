import runesData from '../../data/runes.json'
import type { Rarity, StatMod } from './Item'

export interface RuneDef {
  id: string
  name: string
  rarity: Rarity
  mods: StatMod[]
}

export const RUNES: RuneDef[] = runesData as RuneDef[]

export function runeDef(id: string): RuneDef | undefined {
  return RUNES.find(r => r.id === id)
}

/** Starter bag runes. */
export const STARTER_RUNE_IDS: string[] = [
  'rune_die_I',
  'rune_reroll_I',
  'rune_edge',
]

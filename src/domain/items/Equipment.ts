import gearData from '../../data/gear.json'
import type { GearSlot, Rarity, StatMod } from './Item'

export interface GearDef {
  id: string
  name: string
  slot: GearSlot
  rarity: Rarity
  mods: StatMod[]
}

export const GEAR: GearDef[] = gearData as GearDef[]

export function gearDef(id: string): GearDef | undefined {
  return GEAR.find(g => g.id === id)
}

export function gearForSlot(slot: GearSlot): GearDef[] {
  return GEAR.filter(g => g.slot === slot)
}

/** One common piece per slot for starter bag. */
export const STARTER_GEAR_IDS: string[] = [
  'hat_cloth',
  'cape_rag',
  'belt_rope',
  'ring_copper',
  'boots_worn',
]

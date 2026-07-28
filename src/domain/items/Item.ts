export type Rarity = 'common' | 'rare' | 'legendary'

export type GearStat = 'maxHp' | 'defFlat' | 'dmgFlat' | 'startGold'
export type RuneStat = 'diceAtk' | 'rerollAtk' | 'dmgFlat'
export type ModStat = GearStat | RuneStat

export interface StatMod {
  stat: ModStat
  value: number
}

export type GearSlot = 'hat' | 'cape' | 'belt' | 'ring' | 'boots'

export const GEAR_SLOTS: GearSlot[] = ['hat', 'cape', 'belt', 'ring', 'boots']

export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  hat: 'Sombrero',
  cape: 'Capa',
  belt: 'Cinturón',
  ring: 'Anillo',
  boots: 'Botas',
}

export const GEAR_SLOT_ROLES: Record<GearSlot, string> = {
  hat: 'Vida',
  cape: 'Defensa',
  belt: 'Vida',
  ring: 'Daño',
  boots: 'Almas iniciales',
}

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Raro',
  legendary: 'Legendario',
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#bbbbbb',
  rare: '#66aaff',
  legendary: '#ffcc44',
}

export const RUNE_SLOT_COUNT = 3

export function formatMod(mod: StatMod): string {
  const sign = mod.value >= 0 ? '+' : ''
  switch (mod.stat) {
    case 'maxHp':
      return `${sign}${mod.value} HP`
    case 'defFlat':
      return `${sign}${mod.value} DEF`
    case 'dmgFlat':
      return `${sign}${mod.value} DMG`
    case 'startGold':
      return `${sign}${mod.value}a`
    case 'diceAtk':
      return `${sign}${mod.value} dado`
    case 'rerollAtk':
      return `${sign}${mod.value} reroll`
    default:
      return `${sign}${mod.value}`
  }
}

export function formatMods(mods: StatMod[]): string[] {
  return mods.map(formatMod)
}
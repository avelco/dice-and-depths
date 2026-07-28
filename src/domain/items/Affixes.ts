import affixesData from '../../data/affixes.json'
import type { ModStat, StatMod } from './Item'

export type AffixTier = 'common' | 'blue' | 'purple' | 'gold'

export interface AffixDef {
  id: string
  tier: AffixTier
  stat: ModStat
  value: number
}

const AFFIXES: AffixDef[] = (affixesData as { affixes: AffixDef[] }).affixes

/** Roll weights: common 69%, blue 20%, purple 10%, gold 1%. */
const TIER_WEIGHTS: { tier: AffixTier; weight: number }[] = [
  { tier: 'common', weight: 69 },
  { tier: 'blue', weight: 20 },
  { tier: 'purple', weight: 10 },
  { tier: 'gold', weight: 1 },
]

export const AFFIX_TIER_COLORS: Record<AffixTier, string> = {
  common: '#bbbbbb',
  blue: '#66aaff',
  purple: '#cc66ff',
  gold: '#ffcc44',
}

export const FORGE_REROLL_COST = 3

export function affixDef(id: string): AffixDef | undefined {
  return AFFIXES.find(a => a.id === id)
}

export function affixAsMod(affix: AffixDef): StatMod {
  return { stat: affix.stat, value: affix.value }
}

function pickTier(rng: () => number): AffixTier {
  let r = rng() * 100
  for (const { tier, weight } of TIER_WEIGHTS) {
    r -= weight
    if (r <= 0) return tier
  }
  return 'common'
}

export function rollAffix(rng: () => number = Math.random): AffixDef {
  const tier = pickTier(rng)
  const pool = AFFIXES.filter(a => a.tier === tier)
  const list = pool.length > 0 ? pool : AFFIXES.filter(a => a.tier === 'common')
  return list[Math.floor(rng() * list.length)] ?? AFFIXES[0]
}

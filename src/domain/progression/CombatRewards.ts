import type { RewardTier } from './RunState'

/**
 * Souls granted on combat win (not boss).
 * base(tier) + floor*3 + rng swing so payouts feel dice-y.
 * Normal avg ≈ 15–22 on F1; elite ≈ 24–34.
 */
export function rollCombatSouls(
  tier: RewardTier,
  floor: number,
  rng: () => number = Math.random,
): number {
  if (tier === 'boss') return 0
  const base = tier === 'elite' ? 18 : 11
  const floorBonus = Math.max(1, floor) * 3
  const swingMax = tier === 'elite' ? 8 + floor : 5 + floor
  const swing = Math.floor(rng() * (swingMax + 1))
  return base + floorBonus + swing
}

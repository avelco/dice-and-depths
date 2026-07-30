import {
  dieAverage,
  makeDie,
  nextDieId,
  type RunDie,
} from './Die'

const MAX_DICE = 6

export function canAddDie(dice: RunDie[]): boolean {
  return dice.length < MAX_DICE
}

/** Append a basic (or ability-bearing) die. Returns null if at cap. */
export function addDie(
  dice: RunDie[],
  abilityId: string | null = null,
): RunDie | null {
  if (!canAddDie(dice)) return null
  const die = makeDie(nextDieId(dice), abilityId)
  dice.push(die)
  return die
}

/**
 * Replace the lowest face of the weakest die with a 6.
 * Returns the die that was engraved, or null if nothing to change.
 */
export function engraveWeakestFace(dice: RunDie[]): RunDie | null {
  if (dice.length === 0) return null

  let best: RunDie | null = null
  let bestAvg = Infinity
  let bestLow = Infinity
  for (const d of dice) {
    const avg = dieAverage(d)
    const low = Math.min(...d.faces)
    if (low >= 6) continue
    if (avg < bestAvg || (avg === bestAvg && low < bestLow)) {
      best = d
      bestAvg = avg
      bestLow = low
    }
  }
  if (!best) return null

  const idx = best.faces.indexOf(bestLow)
  if (idx < 0) return null
  best.faces[idx] = 6
  return best
}

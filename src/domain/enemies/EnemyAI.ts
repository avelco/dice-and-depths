import { effectsOf, sumEffect, type RunCard } from '../cards/Card'
import type { CombatActor } from '../cards/CardEffects'
import { previewCards } from '../cards/CardEffects'

export interface EnemyPlayChoice {
  cardIds: string[]
}

/**
 * Pick up to `slots` cards from hand.
 * Priority: lethal damage > damage > poison > shield > heal.
 */
export class EnemyAI {
  static choosePlays(
    hand: RunCard[],
    slots: number,
    self: CombatActor,
    target: CombatActor,
  ): RunCard[] {
    if (slots <= 0 || hand.length === 0) return []

    const remaining = [...hand]
    const chosen: RunCard[] = []

    while (chosen.length < slots && remaining.length > 0) {
      const dmgSoFar = sumEffect(chosen, 'damage')
      const lethal = remaining.find(c => {
        const d = sumEffect([c], 'damage')
        return dmgSoFar + d >= target.hp + target.shield
      })
      if (lethal) {
        chosen.push(lethal)
        remaining.splice(remaining.indexOf(lethal), 1)
        continue
      }

      remaining.sort((a, b) => scoreCard(b, self) - scoreCard(a, self))
      const next = remaining.shift()!
      chosen.push(next)
    }

    return chosen
  }

  static previewChoice(cards: RunCard[]) {
    return previewCards(cards)
  }
}

function scoreCard(card: RunCard, self: CombatActor): number {
  let score = 0
  for (const e of effectsOf(card)) {
    switch (e.type) {
      case 'damage':
        score += e.value * 10
        break
      case 'poison':
        score += e.value * 8
        break
      case 'shield':
        score += e.value * (self.shield < 4 ? 6 : 3)
        break
      case 'heal':
        score += e.value * (self.hp < self.maxHp * 0.5 ? 7 : 2)
        break
    }
  }
  return score
}

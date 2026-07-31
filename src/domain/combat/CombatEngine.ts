import {
  previewCards,
  resolveCardPlays,
  tickPoison,
  type CombatActor,
  type TurnPreview,
} from '../cards/CardEffects'
import type { RunCard } from '../cards/Card'
import type { RunState } from '../progression/RunState'
import { hasPassive } from '../progression/Passives'

export type { CombatActor, TurnPreview }

export interface CombatFighter extends CombatActor {
  bonusDmgFlat: number
}

export interface TurnResolveResult {
  preview: TurnPreview
  applied: TurnPreview
  targetDead: boolean
  selfDead: boolean
}

export function toFighter(
  hp: number,
  maxHp: number,
  shield: number,
  poison: number,
  bonusDmgFlat = 0,
): CombatFighter {
  return { hp, maxHp, shield, poison, bonusDmgFlat }
}

export class CombatEngine {
  static preview(cards: RunCard[]): TurnPreview {
    return previewCards(cards)
  }

  /**
   * Tick poison on actor at start of their turn.
   * Returns damage taken from poison.
   */
  static startTurnPoison(actor: CombatActor): number {
    return tickPoison(actor)
  }

  /**
   * Resolve slotted cards. Flat bonus damage from loadout is added once
   * after card damage if any damage card was played.
   */
  static resolveTurn(
    cards: RunCard[],
    self: CombatFighter,
    target: CombatFighter,
    opts?: { heavyHit?: boolean },
  ): TurnResolveResult {
    const preview = previewCards(cards)
    const applied = resolveCardPlays(cards, self, target)

    if (preview.damage > 0 && self.bonusDmgFlat > 0) {
      const extra = applyFlat(target, self.bonusDmgFlat)
      applied.damage += extra
    }
    if (preview.damage > 0 && opts?.heavyHit) {
      applied.damage += applyFlat(target, 2)
    }

    return {
      preview,
      applied,
      targetDead: target.hp <= 0,
      selfDead: self.hp <= 0,
    }
  }

  static resolvePlayerTurn(
    cards: RunCard[],
    state: RunState,
    hero: CombatFighter,
    enemy: CombatFighter,
  ): TurnResolveResult {
    hero.bonusDmgFlat = state.bonusDmgFlat
    return CombatEngine.resolveTurn(cards, hero, enemy, {
      heavyHit: hasPassive(state, 'heavy_hit'),
    })
  }
}

function applyFlat(target: CombatActor, amount: number): number {
  if (amount <= 0) return 0
  const absorbed = Math.min(target.shield, amount)
  target.shield -= absorbed
  const hpLoss = amount - absorbed
  target.hp = Math.max(0, target.hp - hpLoss)
  return hpLoss
}

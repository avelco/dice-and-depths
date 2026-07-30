import rawAbilities from '../../data/dieAbilities.json'
import type { RunDie } from './Die'

export type DieTrigger =
  | 'onRoll'
  | 'onReroll'
  | 'onKeep'
  | 'onLastReroll'
  | 'onCombo'
  | 'onAttack'
  | 'onKill'

export type DieEffect =
  | 'dmg'
  | 'shield'
  | 'heal'
  | 'reroll'
  | 'atkMultPct'
  | 'overkillHealPct'
  | 'defTierUp'
  | 'highFaceDouble'

export interface DieAbility {
  id: string
  trigger: DieTrigger
  effect: DieEffect
  value: number
  cond?: { face?: number; noRerolls?: boolean }
  maxPerTurn?: number
}

export interface TriggerOutcome {
  bonusDamage: number
  bonusShield: number
  heal: number
  bonusRerolls: number
  atkMultPct: number
  overkillHealPct: number
  defTierUp: boolean
  highFaceDouble: boolean
}

export interface TriggerContext {
  rerolledIds: string[]
  rerollsSpent: number
  used: Map<string, number>
  /** Soft cap on total ability fires this turn. */
  maxActivations?: number
  activationsThisTurn?: number
}

const GLOBAL_MAX_ACTIVATIONS = 8

const ABILITIES: DieAbility[] = rawAbilities as DieAbility[]
const BY_ID = new Map(ABILITIES.map(a => [a.id, a]))

export function abilityById(id: string): DieAbility | undefined {
  return BY_ID.get(id)
}

export function emptyOutcome(): TriggerOutcome {
  return {
    bonusDamage: 0,
    bonusShield: 0,
    heal: 0,
    bonusRerolls: 0,
    atkMultPct: 0,
    overkillHealPct: 0,
    defTierUp: false,
    highFaceDouble: false,
  }
}

export function mergeOutcomes(a: TriggerOutcome, b: TriggerOutcome): TriggerOutcome {
  return {
    bonusDamage: a.bonusDamage + b.bonusDamage,
    bonusShield: a.bonusShield + b.bonusShield,
    heal: a.heal + b.heal,
    bonusRerolls: a.bonusRerolls + b.bonusRerolls,
    // Take the strongest single multiplier — never compound.
    atkMultPct: Math.max(a.atkMultPct, b.atkMultPct),
    overkillHealPct: Math.max(a.overkillHealPct, b.overkillHealPct),
    defTierUp: a.defTierUp || b.defTierUp,
    highFaceDouble: a.highFaceDouble || b.highFaceDouble,
  }
}

function abilityApplies(
  ability: DieAbility,
  die: RunDie,
  values: number[],
  dieIndex: number,
  trigger: DieTrigger,
  ctx: TriggerContext,
): boolean {
  if (ability.trigger !== trigger) return false

  const max = ability.maxPerTurn ?? 1
  const used = ctx.used.get(ability.id) ?? 0
  if (used >= max) return false

  const activations = ctx.activationsThisTurn ?? 0
  const cap = ctx.maxActivations ?? GLOBAL_MAX_ACTIVATIONS
  if (activations >= cap) return false

  if (ability.cond?.noRerolls && ctx.rerollsSpent > 0) return false

  if (ability.cond?.face != null) {
    const face = values[dieIndex]
    if (face !== ability.cond.face) return false
  }

  if (trigger === 'onReroll' && !ctx.rerolledIds.includes(die.id)) return false
  if (trigger === 'onKeep' && ctx.rerolledIds.includes(die.id)) return false

  return true
}

function applyEffect(
  ability: DieAbility,
  outcome: TriggerOutcome,
): void {
  switch (ability.effect) {
    case 'dmg':
      outcome.bonusDamage += ability.value
      break
    case 'shield':
      outcome.bonusShield += ability.value
      break
    case 'heal':
      outcome.heal += ability.value
      break
    case 'reroll':
      outcome.bonusRerolls += ability.value
      break
    case 'atkMultPct':
      outcome.atkMultPct = Math.max(outcome.atkMultPct, ability.value)
      break
    case 'overkillHealPct':
      outcome.overkillHealPct = Math.max(
        outcome.overkillHealPct,
        ability.value,
      )
      break
    case 'defTierUp':
      outcome.defTierUp = true
      break
    case 'highFaceDouble':
      outcome.highFaceDouble = true
      break
  }
}

/**
 * Resolve all die abilities matching `trigger`.
 * Mutates `ctx.used` and `ctx.activationsThisTurn`.
 */
export function resolveTriggers(
  trigger: DieTrigger,
  dice: RunDie[],
  values: number[],
  ctx: TriggerContext,
): TriggerOutcome {
  const outcome = emptyOutcome()

  for (let i = 0; i < dice.length; i++) {
    const die = dice[i]!
    if (!die.abilityId) continue
    const ability = BY_ID.get(die.abilityId)
    if (!ability) continue
    if (!abilityApplies(ability, die, values, i, trigger, ctx)) continue

    applyEffect(ability, outcome)
    ctx.used.set(ability.id, (ctx.used.get(ability.id) ?? 0) + 1)
    ctx.activationsThisTurn = (ctx.activationsThisTurn ?? 0) + 1
  }

  return outcome
}

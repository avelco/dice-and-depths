import { describe, expect, it } from 'vitest'
import { CombatEngine } from '../src/domain/combat/CombatEngine'
import { Enemy } from '../src/domain/enemies/Enemy'
import {
  emptyOutcome,
  resolveTriggers,
  type TriggerContext,
} from '../src/domain/dice/DiceAbilities'
import { makeState } from './helpers'

function attackOutcome(state: ReturnType<typeof makeState>, values: number[]) {
  const ctx: TriggerContext = {
    rerolledIds: [],
    rerollsSpent: 0,
    used: new Map(),
  }
  // Class passives fire onRoll (bulwark/swift) or onAttack (arcane/rage/mercy)
  const roll = resolveTriggers('onRoll', state.dice, values, ctx)
  const atk = resolveTriggers('onAttack', state.dice, values, {
    ...ctx,
    used: new Map(ctx.used),
    activationsThisTurn: ctx.activationsThisTurn,
  })
  return {
    ...emptyOutcome(),
    defTierUp: roll.defTierUp || atk.defTierUp,
    bonusRerolls: roll.bonusRerolls + atk.bonusRerolls,
    bonusDamage: roll.bonusDamage + atk.bonusDamage,
    bonusShield: roll.bonusShield + atk.bonusShield,
    heal: roll.heal + atk.heal,
    atkMultPct: Math.max(roll.atkMultPct, atk.atkMultPct),
    overkillHealPct: Math.max(roll.overkillHealPct, atk.overkillHealPct),
    highFaceDouble: roll.highFaceDouble || atk.highFaceDouble,
  }
}

describe('CombatEngine.computePower', () => {
  it('adds count×face combo for matching dice', () => {
    const p = CombatEngine.computePower([4, 6, 6, 4])
    expect(p.combo).toBe(20) // 4×2 + 6×2
    expect(p.total).toBe(40)
  })

  it('has zero combo when all faces unique', () => {
    const p = CombatEngine.computePower([1, 2, 3])
    expect(p.combo).toBe(0)
    expect(p.total).toBe(6)
  })
})

describe('CombatEngine.computeDefense / Paladín', () => {
  it('pair of 4 is ×1 for normal DEF', () => {
    const def = CombatEngine.computeDefense([4, 4, 1])
    expect(def.total).toBe(4)
  })

  it('Paladín bumps pair DEF one tier (×3) via bulwark', () => {
    const state = makeState('Paladín')
    const outcome = attackOutcome(state, [4, 4, 1])
    expect(outcome.defTierUp).toBe(true)
    expect(CombatEngine.heroDefTotal([4, 4, 1], state, outcome)).toBe(12)
  })
})

describe('class kits via die abilities', () => {
  it('Mago doubles combo contribution of best 5–6 pair', () => {
    const state = makeState('Mago')
    const values = [6, 6, 1]
    const outcome = attackOutcome(state, values)
    const atk = CombatEngine.heroAtkTotal(values, state, outcome)
    expect(atk.bonusDamage).toBe(12)
    expect(atk.total).toBe(atk.power.total + 12)
  })

  it('Mago doubles a lone high face', () => {
    const state = makeState('Mago')
    const values = [6, 1, 2]
    const outcome = attackOutcome(state, values)
    const atk = CombatEngine.heroAtkTotal(values, state, outcome)
    expect(atk.bonusDamage).toBe(6)
  })

  it('Bárbaro adds 20% when no rerolls spent', () => {
    const state = makeState('Bárbaro')
    const dice = [3, 3, 3, 2, 1]
    const power = CombatEngine.computePower(dice)
    const outcome = attackOutcome(state, dice)
    // rage checks rerollsSpent on ctx — attackOutcome uses 0
    const atk = CombatEngine.heroAtkTotal(dice, state, outcome)
    expect(atk.atkMultPct).toBe(20)
    expect(atk.total).toBe(power.total + Math.floor(power.total * 0.2))
  })

  it('Bárbaro loses bonus after a reroll', () => {
    const state = makeState('Bárbaro')
    const values = [3, 3, 3, 2, 1]
    const ctx: TriggerContext = {
      rerolledIds: [],
      rerollsSpent: 1,
      used: new Map(),
    }
    const outcome = resolveTriggers('onAttack', state.dice, values, ctx)
    const atk = CombatEngine.heroAtkTotal(values, state, outcome)
    expect(atk.atkMultPct).toBe(0)
    expect(atk.bonusDamage).toBe(0)
  })
})

describe('CombatEngine.resolve', () => {
  it('subtracts enemy DEF from attack power', () => {
    const state = makeState('Paladín')
    const enemy = new Enemy('slime', 'Slime', 100, 3, 'split', 2, 1)
    const values = [4, 6, 6, 4]
    const outcome = attackOutcome(state, values)
    const result = CombatEngine.resolve(values, enemy, state, 0, outcome)
    // power 40 − DEF 3 = 37
    expect(result.finalDamage).toBe(37)
    expect(enemy.hp).toBe(63)
  })

  it('Clérigo heals half of overkill via mercy', () => {
    const state = makeState('Clérigo')
    state.hp = 10
    const enemy = new Enemy('slime', 'Slime', 5, 0, 'split', 2, 1)
    const values = [4, 6, 6, 4]
    const outcome = attackOutcome(state, values)
    const result = CombatEngine.resolve(values, enemy, state, 0, outcome)
    // power 40, DEF 0 → 40 dmg; overkill 35 → heal 17
    expect(result.finalDamage).toBe(40)
    expect(result.heal).toBe(17)
    expect(state.hp).toBe(Math.min(state.maxHp, 10 + 17))
    expect(result.killed).toBe(true)
  })

  it('Pícaro starting die grants +1 reroll on roll', () => {
    const state = makeState('Pícaro')
    const values = [1, 2, 3]
    const outcome = attackOutcome(state, values)
    expect(outcome.bonusRerolls).toBe(1)
  })
})

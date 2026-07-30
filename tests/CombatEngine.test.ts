import { describe, expect, it } from 'vitest'
import { CombatEngine } from '../src/domain/combat/CombatEngine'
import { Enemy } from '../src/domain/enemies/Enemy'
import { makeState } from './helpers'

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

  it('Paladín bumps pair DEF one tier (×3)', () => {
    const state = makeState('Paladín')
    expect(CombatEngine.heroDefTotal([4, 4, 1], state)).toBe(12)
  })
})

describe('class kits via heroAtkTotal', () => {
  it('Mago doubles combo contribution of best 5–6 pair', () => {
    const state = makeState('Mago')
    const atk = CombatEngine.heroAtkTotal([6, 6, 1], state)
    expect(atk.mageBonus).toBe(12)
    expect(atk.total).toBe(atk.power.total + 12)
  })

  it('Mago doubles a lone high face', () => {
    const state = makeState('Mago')
    const atk = CombatEngine.heroAtkTotal([6, 1, 2], state)
    expect(atk.mageBonus).toBe(6)
  })

  it('Bárbaro adds 20% when no rerolls spent', () => {
    const state = makeState('Bárbaro')
    const dice = [3, 3, 3, 2, 1]
    const power = CombatEngine.computePower(dice)
    const atk = CombatEngine.heroAtkTotal(dice, state, 0)
    expect(atk.barbBonus).toBe(Math.floor(power.total * 0.2))
    expect(atk.total).toBe(power.total + atk.barbBonus)
  })

  it('Bárbaro loses bonus after a reroll', () => {
    const state = makeState('Bárbaro')
    const atk = CombatEngine.heroAtkTotal([3, 3, 3, 2, 1], state, 1)
    expect(atk.barbBonus).toBe(0)
  })
})

describe('CombatEngine.resolve', () => {
  it('subtracts enemy DEF from attack power', () => {
    const state = makeState('Paladín')
    const enemy = new Enemy('slime', 'Slime', 100, 3, 'split', 2, 1)
    const result = CombatEngine.resolve([4, 6, 6, 4], enemy, state, 0, 0)
    // power 40 − DEF 3 = 37
    expect(result.finalDamage).toBe(37)
    expect(enemy.hp).toBe(63)
  })

  it('Clérigo heals half of overkill', () => {
    const state = makeState('Clérigo')
    state.hp = 10
    const enemy = new Enemy('slime', 'Slime', 5, 0, 'split', 2, 1)
    const result = CombatEngine.resolve([4, 6, 6, 4], enemy, state, 0, 0)
    // power 40, DEF 0 → 40 dmg; overkill 35 → heal 17
    expect(result.finalDamage).toBe(40)
    expect(result.heal).toBe(17)
    expect(state.hp).toBe(Math.min(state.maxHp, 10 + 17))
    expect(result.killed).toBe(true)
  })
})

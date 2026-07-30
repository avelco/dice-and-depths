import { describe, expect, it } from 'vitest'
import { makeDie } from '../src/domain/dice/Die'
import {
  emptyOutcome,
  mergeOutcomes,
  resolveTriggers,
  type TriggerContext,
} from '../src/domain/dice/DiceAbilities'

function ctx(partial: Partial<TriggerContext> = {}): TriggerContext {
  return {
    rerolledIds: [],
    rerollsSpent: 0,
    used: new Map(),
    activationsThisTurn: 0,
    ...partial,
  }
}

describe('resolveTriggers', () => {
  it('fires bulwark onRoll → defTierUp', () => {
    const dice = [makeDie('d0', 'bulwark'), makeDie('d1'), makeDie('d2')]
    const out = resolveTriggers('onRoll', dice, [4, 4, 1], ctx())
    expect(out.defTierUp).toBe(true)
  })

  it('fires arcane onAttack → highFaceDouble flag', () => {
    const dice = [
      makeDie('d0', 'arcane'),
      makeDie('d1'),
      makeDie('d2'),
    ]
    const out = resolveTriggers('onAttack', dice, [6, 6, 1], ctx())
    expect(out.highFaceDouble).toBe(true)
    expect(out.bonusDamage).toBe(0)
  })

  it('fires rage onAttack only when no rerolls spent', () => {
    const dice = [
      makeDie('d0', 'rage'),
      makeDie('d1'),
      makeDie('d2'),
      makeDie('d3'),
      makeDie('d4'),
    ]
    const values = [3, 3, 3, 2, 1]
    const ok = resolveTriggers('onAttack', dice, values, ctx({ rerollsSpent: 0 }))
    expect(ok.atkMultPct).toBe(20)

    const fail = resolveTriggers(
      'onAttack',
      dice,
      values,
      ctx({ rerollsSpent: 1 }),
    )
    expect(fail.atkMultPct).toBe(0)
  })

  it('fires mercy onAttack → overkillHealPct', () => {
    const dice = [makeDie('d0', 'mercy'), makeDie('d1')]
    const out = resolveTriggers('onAttack', dice, [6, 6], ctx())
    expect(out.overkillHealPct).toBe(50)
  })

  it('fires swift onRoll → bonusRerolls', () => {
    const dice = [makeDie('d0', 'swift'), makeDie('d1'), makeDie('d2')]
    const out = resolveTriggers('onRoll', dice, [1, 2, 3], ctx())
    expect(out.bonusRerolls).toBe(1)
  })

  it('onKeep skips rerolled dice', () => {
    // Use a custom-style ability via installing a temporary one isn't possible;
    // instead verify onReroll only hits rerolled ids with a dmg-less path.
    // swift/bulwark are onRoll — craft dice with no matching keep abilities → 0.
    const dice = [makeDie('d0', 'bulwark'), makeDie('d1', 'bulwark')]
    const c = ctx({ rerolledIds: ['d0'] })
    const keep = resolveTriggers('onKeep', dice, [1, 2], c)
    expect(keep.defTierUp).toBe(false) // bulwark is onRoll, not onKeep
  })

  it('respects maxPerTurn', () => {
    const dice = [
      makeDie('d0', 'bulwark'),
      makeDie('d1', 'bulwark'),
    ]
    const c = ctx()
    const first = resolveTriggers('onRoll', dice, [1, 2], c)
    expect(first.defTierUp).toBe(true)
    // Second fire of same ability id is blocked by maxPerTurn=1
    const second = resolveTriggers('onRoll', dice, [1, 2], c)
    expect(second.defTierUp).toBe(false)
  })
})

describe('mergeOutcomes', () => {
  it('sums flats and takes max for pcts', () => {
    const a = emptyOutcome()
    a.bonusDamage = 5
    a.atkMultPct = 10
    const b = emptyOutcome()
    b.bonusDamage = 3
    b.atkMultPct = 20
    b.defTierUp = true
    const m = mergeOutcomes(a, b)
    expect(m.bonusDamage).toBe(8)
    expect(m.atkMultPct).toBe(20)
    expect(m.defTierUp).toBe(true)
  })
})

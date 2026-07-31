import { describe, expect, it } from 'vitest'
import {
  applyDamage,
  previewCards,
  resolveCardPlays,
  tickPoison,
  type CombatActor,
} from '../src/domain/cards/CardEffects'
import { makeRunCard, resetCardIds } from '../src/domain/cards/Card'

function actor(hp = 20, maxHp = 20): CombatActor {
  return { hp, maxHp, shield: 0, poison: 0 }
}

describe('CardEffects', () => {
  it('preview sums slotted effects', () => {
    resetCardIds()
    const cards = [makeRunCard('bash'), makeRunCard('toxin')]
    expect(previewCards(cards)).toEqual({
      damage: 6,
      poison: 2,
      shield: 0,
      heal: 0,
    })
  })

  it('damage absorbs into shield then HP', () => {
    const t = actor()
    t.shield = 3
    expect(applyDamage(t, 5)).toBe(2)
    expect(t.shield).toBe(0)
    expect(t.hp).toBe(18)
  })

  it('resolveCardPlays applies damage poison shield heal', () => {
    resetCardIds()
    const self = actor(10)
    const target = actor(20)
    const cards = [
      makeRunCard('bash'),
      makeRunCard('guard'),
      makeRunCard('salve'),
      makeRunCard('toxin'),
    ]
    const applied = resolveCardPlays(cards, self, target)
    expect(applied.damage).toBe(6)
    expect(target.hp).toBe(14)
    expect(target.poison).toBe(2)
    expect(self.shield).toBe(4)
    expect(self.hp).toBe(13) // 10+3
  })

  it('tickPoison deals stacks then decays', () => {
    const a = actor(20)
    a.poison = 3
    expect(tickPoison(a)).toBe(3)
    expect(a.hp).toBe(17)
    expect(a.poison).toBe(2)
  })
})

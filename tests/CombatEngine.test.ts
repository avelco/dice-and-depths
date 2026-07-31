import { describe, expect, it } from 'vitest'
import { CombatEngine, toFighter } from '../src/domain/combat/CombatEngine'
import { makeRunCard, resetCardIds } from '../src/domain/cards/Card'
import { makeState } from './helpers'
import { EnemyAI } from '../src/domain/enemies/EnemyAI'

describe('CombatEngine card resolve', () => {
  it('applies damage through shield then HP', () => {
    resetCardIds()
    const self = toFighter(20, 20, 0, 0)
    const target = toFighter(20, 20, 3, 0)
    const cards = [makeRunCard('bash')] // 6 dmg
    const result = CombatEngine.resolveTurn(cards, self, target)
    expect(result.applied.damage).toBe(3) // 3 absorbed, 3 to hp
    expect(target.hp).toBe(17)
    expect(target.shield).toBe(0)
  })

  it('heals and shields self', () => {
    resetCardIds()
    const self = toFighter(10, 20, 0, 0)
    const target = toFighter(20, 20, 0, 0)
    const cards = [makeRunCard('guard'), makeRunCard('salve')]
    CombatEngine.resolveTurn(cards, self, target)
    expect(self.shield).toBe(4)
    expect(self.hp).toBe(13)
  })

  it('applies heavy_hit bonus via player turn', () => {
    resetCardIds()
    const state = makeState('Paladín')
    state.passives.push('heavy_hit')
    state.bonusDmgFlat = 0
    const hero = toFighter(30, 30, 0, 0)
    const enemy = toFighter(50, 50, 0, 0)
    const cards = [makeRunCard('strike')] // 4
    const result = CombatEngine.resolvePlayerTurn(cards, state, hero, enemy)
    expect(result.applied.damage).toBe(6) // 4 + 2 heavy
  })
})

describe('EnemyAI', () => {
  it('prefers lethal damage', () => {
    resetCardIds()
    const hand = [
      makeRunCard('toxin'),
      makeRunCard('crush'), // 14
      makeRunCard('guard'),
    ]
    const self = { hp: 20, maxHp: 20, shield: 0, poison: 0 }
    const target = { hp: 10, maxHp: 20, shield: 0, poison: 0 }
    const plays = EnemyAI.choosePlays(hand, 1, self, target)
    expect(plays[0]!.defId).toBe('crush')
  })
})

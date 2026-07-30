import { describe, expect, it } from 'vitest'
import { SaveSystem } from '../src/systems/SaveSystem'
import { makeState } from './helpers'
import { makeBasicDice } from '../src/domain/dice/Die'

describe('SaveSystem', () => {
  it('roundtrips quicksave floor, character, and hp', () => {
    const state = makeState('Mago')
    state.floor = 3
    state.hp = 12
    SaveSystem.save('quicksave', state)

    const loaded = SaveSystem.load('quicksave')
    expect(loaded).not.toBeNull()
    expect(loaded!.floor).toBe(3)
    expect(loaded!.characterName).toBe('Mago')
    expect(loaded!.hp).toBe(12)
    expect(loaded!.dice).toHaveLength(5)
    expect(loaded!.dice[0]!.abilityId).toBe('arcane')
  })

  it('abandonQuicksave clears the run so it cannot be resumed', () => {
    const state = makeState('Paladín')
    SaveSystem.save('quicksave', state)
    expect(SaveSystem.load('quicksave')).not.toBeNull()

    SaveSystem.abandonQuicksave()
    expect(SaveSystem.load('quicksave')).toBeNull()
  })

  it('migrates legacy v4 diceLoadout into RunDie[]', () => {
    const raw = {
      floor: 2,
      coins: 10,
      maxHp: 30,
      hp: 20,
      characterName: 'Guerrero',
      seed: 1,
      passives: [],
      diceLoadout: { atk: 3 },
      rerollMax: { atk: 4 },
      version: 4,
      savedAt: Date.now(),
    }
    localStorage.setItem('dnd_save_legacy', JSON.stringify(raw))
    const loaded = SaveSystem.load('legacy')
    expect(loaded).not.toBeNull()
    expect(loaded!.characterName).toBe('Paladín')
    expect(loaded!.dice).toHaveLength(3)
    expect(loaded!.dice[0]!.faces).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('roundtrips modified faces', () => {
    const state = makeState('Paladín')
    state.dice = makeBasicDice(2)
    state.dice[0]!.faces[0] = 6
    SaveSystem.save('faces', state)
    const loaded = SaveSystem.load('faces')
    expect(loaded!.dice[0]!.faces[0]).toBe(6)
  })
})

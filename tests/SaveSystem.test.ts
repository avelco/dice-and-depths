import { describe, expect, it } from 'vitest'
import { SaveSystem } from '../src/systems/SaveSystem'
import { makeState } from './helpers'

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
  })

  it('abandonQuicksave clears the run so it cannot be resumed', () => {
    const state = makeState('Paladín')
    SaveSystem.save('quicksave', state)
    expect(SaveSystem.load('quicksave')).not.toBeNull()

    SaveSystem.abandonQuicksave()
    expect(SaveSystem.load('quicksave')).toBeNull()
  })
})

import { describe, expect, it, vi, afterEach } from 'vitest'
import { makeDie, rollDie, STANDARD_FACES, type DieFaces } from '../src/domain/dice/Die'
import { addDie, canAddDie, engraveWeakestFace } from '../src/domain/dice/DicePool'

describe('rollDie', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('samples from standard faces', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // index 3 → 4
    expect(rollDie(makeDie('d0'))).toBe(4)
  })

  it('respects modified faces', () => {
    const faces: DieFaces = [6, 6, 6, 6, 6, 6]
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    expect(rollDie(makeDie('d0', null, faces))).toBe(6)
  })

  it('can roll a loaded 1→6 die', () => {
    const faces: DieFaces = [6, 2, 3, 4, 5, 6]
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    expect(rollDie(makeDie('d0', null, faces))).toBe(6)
  })
})

describe('DicePool', () => {
  it('addDie appends with next id', () => {
    const dice = [makeDie('d0'), makeDie('d2')]
    const added = addDie(dice)
    expect(added?.id).toBe('d3')
    expect(dice).toHaveLength(3)
  })

  it('caps at 6 dice', () => {
    const dice = Array.from({ length: 6 }, (_, i) => makeDie(`d${i}`))
    expect(canAddDie(dice)).toBe(false)
    expect(addDie(dice)).toBeNull()
  })

  it('engraveWeakestFace replaces lowest face with 6', () => {
    const weak = makeDie('d0', null, [...STANDARD_FACES] as DieFaces)
    const strong = makeDie('d1', null, [6, 6, 6, 6, 6, 6])
    const result = engraveWeakestFace([strong, weak])
    expect(result?.id).toBe('d0')
    expect(weak.faces[0]).toBe(6) // was 1
    expect(weak.faces.slice(1)).toEqual([2, 3, 4, 5, 6])
  })
})

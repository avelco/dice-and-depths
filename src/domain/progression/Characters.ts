import type { RunState } from './RunState'
import { makeDie, type RunDie } from '../dice/Die'

export interface CharacterKit {
  name: string
  lore: string
  /** Cosmetic lock in select UI. */
  locked: boolean
  buff: string
  handicap: string
  maxHp: number
  startingDice: RunDie[]
  rerollAtk: number
  startGold: number
}

/** Baseline: 30 HP · 4 ATK · 4 rerolls · 0g. DEF comes from ATK combos. */
export const CHARACTERS: CharacterKit[] = [
  {
    name: 'Paladín',
    lore: 'Escudo sagrado del frente.',
    locked: false,
    buff: 'Los combos suben un nivel de defensa',
    handicap: 'Solo 3 dados de ataque',
    maxHp: 50,
    startingDice: [
      makeDie('d0', 'bulwark'),
      makeDie('d1'),
      makeDie('d2'),
    ],
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Mago',
    lore: 'Domina las artes arcanas.',
    locked: false,
    buff: 'La mejor cara 5 o 6 cuenta doble en combo',
    handicap: 'Muy poca vida',
    maxHp: 20,
    startingDice: [
      makeDie('d0', 'arcane'),
      makeDie('d1'),
      makeDie('d2'),
      makeDie('d3'),
      makeDie('d4'),
    ],
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Pícaro',
    lore: 'Veloz y letal desde las sombras.',
    locked: false,
    buff: 'Al tirar: +1 reintento',
    handicap: 'Poca vida y pocos dados',
    maxHp: 25,
    startingDice: [
      makeDie('d0', 'swift'),
      makeDie('d1'),
      makeDie('d2'),
    ],
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Clérigo',
    lore: 'Sanador y protector divino.',
    locked: false,
    buff: 'La mitad del dano sobrante cura vida',
    handicap: 'Poca vida',
    maxHp: 25,
    startingDice: [
      makeDie('d0', 'mercy'),
      makeDie('d1'),
      makeDie('d2'),
      makeDie('d3'),
      makeDie('d4'),
    ],
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Bárbaro',
    lore: 'Furia imparable en batalla.',
    locked: false,
    buff: 'Sin reintentos: +20% de dano',
    handicap: 'Solo 2 reintentos por turno',
    maxHp: 40,
    startingDice: [
      makeDie('d0', 'rage'),
      makeDie('d1'),
      makeDie('d2'),
      makeDie('d3'),
      makeDie('d4'),
    ],
    rerollAtk: 2,
    startGold: 0,
  },
]

export function characterByName(name: string): CharacterKit | undefined {
  return CHARACTERS.find(c => c.name === name)
}

export function applyCharacterKit(state: RunState, kit: CharacterKit) {
  state.characterName = kit.name
  state.maxHp = kit.maxHp
  state.hp = kit.maxHp
  state.coins = kit.startGold
  // Deep-copy so run mutations don't leak into CHARACTERS definitions.
  state.dice = kit.startingDice.map(d =>
    makeDie(d.id, d.abilityId, [...d.faces] as RunDie['faces']),
  )
  state.rerollMax = { atk: kit.rerollAtk }
}

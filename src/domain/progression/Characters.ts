import type { RunState } from './RunState'

export interface CharacterKit {
  name: string
  lore: string
  /** Cosmetic lock in select UI. */
  locked: boolean
  buff: string
  handicap: string
  maxHp: number
  diceAtk: number
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
    diceAtk: 3,
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
    diceAtk: 5,
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Pícaro',
    lore: 'Veloz y letal desde las sombras.',
    locked: false,
    buff: 'El primer reintento del turno es gratis',
    handicap: 'Poca vida y pocos dados',
    maxHp: 25,
    diceAtk: 3,
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
    diceAtk: 5,
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
    diceAtk: 5,
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
  state.diceLoadout = { atk: kit.diceAtk }
  state.rerollMax = { atk: kit.rerollAtk }
}

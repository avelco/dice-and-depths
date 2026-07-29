import type { RunState } from './RunState'

export interface CharacterKit {
  name: string
  lore: string
  /** Cosmetic lock in select UI; Pícaro also checks meta unlock. */
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
    buff: '+20 HP · DEF de combo +1 nivel',
    handicap: '3 dados ATK',
    maxHp: 50,
    diceAtk: 3,
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Mago',
    lore: 'Domina las artes arcanas.',
    locked: false,
    buff: '5 dados · combo 5-6 x2',
    handicap: '20 HP',
    maxHp: 20,
    diceAtk: 5,
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Pícaro',
    lore: 'Veloz y letal desde las sombras.',
    locked: true,
    buff: '1er reroll gratis',
    handicap: '25 HP y 3 dados ATK',
    maxHp: 25,
    diceAtk: 3,
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Clérigo',
    lore: 'Sanador y protector divino.',
    locked: false,
    buff: '5 dados · overkill cura',
    handicap: '25 HP',
    maxHp: 25,
    diceAtk: 5,
    rerollAtk: 4,
    startGold: 0,
  },
  {
    name: 'Bárbaro',
    lore: 'Furia imparable en batalla.',
    locked: false,
    buff: 'sin reroll +20% daño',
    handicap: '2 rerolls ATK',
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

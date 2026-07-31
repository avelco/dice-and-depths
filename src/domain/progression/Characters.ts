import type { RunState } from './RunState'

export interface CharacterKit {
  name: string
  lore: string
  locked: boolean
  buff: string
  handicap: string
  maxHp: number
  /** Signature card def ids preferred when building first deck. */
  signatureCards: string[]
  startGold: number
}

export const CHARACTERS: CharacterKit[] = [
  {
    name: 'Paladín',
    lore: 'Escudo sagrado del frente.',
    locked: false,
    buff: 'Firma: Barrier y Fortify',
    handicap: 'Menos daño inicial',
    maxHp: 50,
    signatureCards: ['barrier', 'fortify', 'guard'],
    startGold: 0,
  },
  {
    name: 'Mago',
    lore: 'Domina las artes arcanas.',
    locked: false,
    buff: 'Firma: Plague y Blight',
    handicap: 'Muy poca vida',
    maxHp: 20,
    signatureCards: ['plague', 'blight', 'toxin'],
    startGold: 0,
  },
  {
    name: 'Pícaro',
    lore: 'Veloz y letal desde las sombras.',
    locked: false,
    buff: 'Firma: Poison Stab y Venom',
    handicap: 'Poca vida',
    maxHp: 25,
    signatureCards: ['poison_stab', 'venom', 'slash'],
    startGold: 0,
  },
  {
    name: 'Clérigo',
    lore: 'Sanador y protector divino.',
    locked: false,
    buff: 'Firma: Restore y Mend',
    handicap: 'Poca vida',
    maxHp: 25,
    signatureCards: ['restore', 'mend', 'salve'],
    startGold: 0,
  },
  {
    name: 'Bárbaro',
    lore: 'Furia imparable en batalla.',
    locked: false,
    buff: 'Firma: Crush y Bash',
    handicap: 'Sin curación firma',
    maxHp: 40,
    signatureCards: ['crush', 'bash', 'slash'],
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
}

import enemiesData from '../../data/enemies.json'
import type { MapNodeKind } from '../map/NodeTypes'
import type { RewardTier } from '../progression/RunState'

export type EnemySkill = 'split' | 'bone_toss' | 'steal' | 'phase' | 'slam'

interface EnemyTemplate {
  id: string
  name: string
  roles: string[]
  baseHp: number
  baseDef: number
  skill: EnemySkill
}

const TEMPLATES = enemiesData as EnemyTemplate[]

const ENEMY_DECKS: Record<string, string[]> = {
  normal: [
    'strike', 'strike', 'bash', 'guard', 'toxin',
    'salve', 'venom', 'barrier', 'slash', 'mend',
  ],
  elite: [
    'bash', 'slash', 'venom', 'plague', 'barrier',
    'fortify', 'poison_stab', 'shield_bash', 'mend', 'strike',
  ],
  boss: [
    'crush', 'slash', 'plague', 'blight', 'aegis',
    'fortify', 'poison_stab', 'shield_bash', 'restore', 'bash',
  ],
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Enemy {
  templateId: string
  name: string
  maxHp: number
  hp: number
  defense: number
  skill: EnemySkill
  /** Card def ids for this enemy's combat deck. */
  deckDefs: string[]
  actionSlots: number
  turnCount = 0
  bonusDef = 0
  shield = 0
  poison = 0

  constructor(
    templateId: string,
    name: string,
    hp: number,
    defense: number,
    skill: EnemySkill,
    deckDefs: string[],
    actionSlots: number,
  ) {
    this.templateId = templateId
    this.name = name
    this.maxHp = hp
    this.hp = hp
    this.defense = defense
    this.skill = skill
    this.deckDefs = deckDefs
    this.actionSlots = actionSlots
  }

  get totalDefense(): number {
    return this.defense + this.bonusDef
  }

  get alive(): boolean {
    return this.hp > 0
  }

  static forNode(
    kind: MapNodeKind,
    floor: number,
    seed: number,
    index = 0,
  ): Enemy {
    const rng = mulberry32(seed + floor * 131 + index * 97)
    let role = 'combat'
    if (kind === 'elite') role = 'elite'
    if (kind === 'boss') role = 'boss'

    const pool = TEMPLATES.filter(t => t.roles.includes(role))
    const tpl = pool[Math.floor(rng() * pool.length)] ?? TEMPLATES[0]

    const scale = kind === 'boss' ? 1.55 : kind === 'elite' ? 1.15 : 1
    const baseHp = 28 + Math.floor(rng() * 10)
    const hp = Math.floor((baseHp + floor * 6) * scale + rng() * 3)
    const def = Math.floor((tpl.baseDef + floor * 0.5) * scale)
    const deckKey = kind === 'boss' ? 'boss' : kind === 'elite' ? 'elite' : 'normal'
    const actionSlots = kind === 'boss' ? 3 : 2

    return new Enemy(
      tpl.id,
      tpl.name,
      hp,
      def,
      tpl.skill,
      [...ENEMY_DECKS[deckKey]!],
      actionSlots,
    )
  }

  static waveForNode(
    kind: MapNodeKind,
    floor: number,
    seed: number,
  ): Enemy[] {
    const rng = mulberry32(seed + floor * 131 + 17)
    let count = 2
    if (kind === 'boss') {
      count = 1
    } else if (kind === 'elite') {
      count = 2 + (rng() < 0.5 ? 1 : 0)
    } else {
      count = 2 + (rng() < 0.55 ? 1 : 0)
    }
    return Array.from({ length: count }, (_, i) =>
      Enemy.forNode(kind, floor, seed, i),
    )
  }

  static tierForKind(kind: MapNodeKind): RewardTier {
    if (kind === 'boss') return 'boss'
    if (kind === 'elite') return 'elite'
    return 'normal'
  }
}

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
  turnCount = 0
  bonusDef = 0

  constructor(
    templateId: string,
    name: string,
    hp: number,
    defense: number,
    skill: EnemySkill,
  ) {
    this.templateId = templateId
    this.name = name
    this.maxHp = hp
    this.hp = hp
    this.defense = defense
    this.skill = skill
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

    const scale = kind === 'boss' ? 1.4 : kind === 'elite' ? 1.15 : 1
    const baseHp = 80 + Math.floor(rng() * 21) // 80–100
    const hp = Math.floor((baseHp + floor * 2.5) * scale + rng() * 4)
    const def = Math.floor((tpl.baseDef + floor * 0.8) * scale)

    return new Enemy(tpl.id, tpl.name, hp, def, tpl.skill)
  }

  /** Combat/elite: 3–4 foes. Boss: single fight. */
  static waveForNode(
    kind: MapNodeKind,
    floor: number,
    seed: number,
  ): Enemy[] {
    const rng = mulberry32(seed + floor * 131 + 17)
    const count =
      kind === 'boss' ? 1 : 3 + (rng() < 0.5 ? 0 : 1)
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

import type { MapNodeKind } from '../map/NodeTypes'

export interface MapNodeSnapshot {
  id: number
  col: number
  kind: MapNodeKind
  x: number
  y: number
  cleared: boolean
}

export interface MapEdgeSnapshot {
  from: number
  to: number
}

export interface MapSnapshot {
  nodes: MapNodeSnapshot[]
  edges: MapEdgeSnapshot[]
}

export type RewardTier = 'normal' | 'elite' | 'boss'

export class RunState {
  floor = 1
  /** Run-only currency (almas). Lost when the run ends. */
  coins = 0
  maxHp = 30
  hp = 30
  characterName = 'Paladín'
  seed = 0
  passives: string[] = []
  /** Copy of meta active deck for this run (defIds as RunCards built at start). */
  deckDefs: string[] = []
  /** Action slots for this run (from meta). */
  actionSlots = 2
  currentNodeId: number | null = null
  map: MapSnapshot | null = null
  secondWindUsedThisFloor = false
  pendingNodeKind: MapNodeKind | null = null
  pendingRewardTier: RewardTier = 'normal'

  /** Flat DEF from meta gear — remapped as start shield bonus. */
  bonusDefFlat = 0
  /** Flat DMG from meta gear/runes. */
  bonusDmgFlat = 0

  /** Combat-persistent statuses (survive between enemies in a wave). */
  heroShield = 0
  heroPoison = 0
}

export function syncRunStateDerived(_state: RunState) {
  // No-op kept for call-site compatibility.
}

export function createNewRun(characterName: string, seed = Date.now()): RunState {
  const state = new RunState()
  state.characterName = characterName
  state.seed = seed
  state.hp = state.maxHp
  syncRunStateDerived(state)
  return state
}

import type { MapNodeKind } from '../map/NodeTypes'

export interface DiceLoadout {
  atk: number
  def: number
  mul: number
}

export interface RerollMax {
  atk: number
  def: number
  mul: number
}

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
  gold = 0
  maxHp = 30
  hp = 30
  characterName = 'Guerrero'
  seed = 0
  passives: string[] = []
  diceLoadout: DiceLoadout = { atk: 4, def: 3, mul: 1 }
  rerollMax: RerollMax = { atk: 4, def: 3, mul: 1 }
  currentNodeId: number | null = null
  map: MapSnapshot | null = null
  secondWindUsedThisFloor = false
  pendingNodeKind: MapNodeKind | null = null
  pendingRewardTier: RewardTier = 'normal'
  lastDustEarned = 0

  /** @deprecated debug header only */
  dice = 8
  /** @deprecated debug header only */
  rerolls = 8
}

export function syncRunStateDerived(state: RunState) {
  state.dice = state.diceLoadout.atk + state.diceLoadout.def + state.diceLoadout.mul
  state.rerolls = state.rerollMax.atk + state.rerollMax.def + state.rerollMax.mul
}

export function createNewRun(characterName: string, seed = Date.now()): RunState {
  const state = new RunState()
  state.characterName = characterName
  state.seed = seed
  state.hp = state.maxHp
  syncRunStateDerived(state)
  return state
}

import type { MapNodeKind } from '../map/NodeTypes'

export interface DiceLoadout {
  atk: number
}

export interface RerollMax {
  atk: number
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
  /** Run-only currency (almas). Lost when the run ends. */
  coins = 0
  maxHp = 30
  hp = 30
  characterName = 'Paladín'
  seed = 0
  passives: string[] = []
  diceLoadout: DiceLoadout = { atk: 4 }
  rerollMax: RerollMax = { atk: 4 }
  currentNodeId: number | null = null
  map: MapSnapshot | null = null
  secondWindUsedThisFloor = false
  pendingNodeKind: MapNodeKind | null = null
  pendingRewardTier: RewardTier = 'normal'
  lastDustEarned = 0

  /** Flat DEF from meta gear loadout (frozen at run start). */
  bonusDefFlat = 0
  /** Flat DMG from meta gear/runes (frozen at run start). */
  bonusDmgFlat = 0

  /** @deprecated debug header only */
  dice = 4
  /** @deprecated debug header only */
  rerolls = 4
}

export function syncRunStateDerived(state: RunState) {
  state.dice = state.diceLoadout.atk
  state.rerolls = state.rerollMax.atk
}

export function createNewRun(characterName: string, seed = Date.now()): RunState {
  const state = new RunState()
  state.characterName = characterName
  state.seed = seed
  state.hp = state.maxHp
  syncRunStateDerived(state)
  return state
}

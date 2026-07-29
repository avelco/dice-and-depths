import Phaser from 'phaser'
import { RunState, createNewRun, syncRunStateDerived } from './domain/progression/RunState'
import { MetaProgression } from './domain/progression/MetaProgression'
import { loadDungeonMap } from './domain/map/DungeonMap'
import { addPixelText } from './ui/pixelText'

export function renderDebugHeader(scene: Phaser.Scene, rs: RunState) {
  syncRunStateDerived(rs)
  const gold = MetaProgression.getGold()
  const header = `P${rs.floor} | ${rs.characterName} | HP ${rs.hp}/${rs.maxHp} | ${rs.coins}a | ${gold}g | D${rs.dice}`
  addPixelText(scene, 4, 2, header, {
    fontSize: '8px',
    color: '#88ff88',
  }).setDepth(100).setScrollFactor(0)
}

export function createDebugState(floor = 5): RunState {
  const state = createNewRun('Paladín', 42)
  state.floor = floor
  state.coins = 100 + floor * 30
  state.maxHp = 30 + Math.floor(floor * 3)
  state.hp = state.maxHp
  MetaProgression.applyStartBonuses(state)
  state.map = loadDungeonMap(state.floor, state.seed)
  state.currentNodeId = state.map.nodes.find(n => n.kind === 'start')?.id ?? null
  state.pendingNodeKind = 'combat'
  syncRunStateDerived(state)
  return state
}

export interface SceneData {
  runState?: RunState
  /** After normal/elite combat: open shop sink before returning to map. */
  postCombat?: boolean
  /** Souls just granted (display only). */
  soulsGained?: number
}

export function getRunState(scene: Phaser.Scene): RunState | undefined {
  return (scene.scene.settings.data as SceneData | undefined)?.runState
}

export function getSceneData(scene: Phaser.Scene): SceneData {
  return (scene.scene.settings.data as SceneData | undefined) ?? {}
}

export function applyPassiveOnKill(state: RunState) {
  if (state.passives.includes('vampiric')) {
    state.hp = Math.min(state.maxHp, state.hp + 1)
  }
}

export function trySecondWind(state: RunState) {
  if (state.passives.includes('second_wind') && !state.secondWindUsedThisFloor) {
    if (state.hp <= state.maxHp * 0.5) {
      state.secondWindUsedThisFloor = true
      state.hp = Math.min(state.maxHp, state.hp + 5)
    }
  }
}

export function effectiveRerollMax(state: RunState) {
  const max = { ...state.rerollMax }
  if (state.passives.includes('lucky_roll')) max.atk += 1
  return max
}

export function shopDiscount(state: RunState): number {
  return state.passives.includes('merchant_friend') ? 0.8 : 1
}

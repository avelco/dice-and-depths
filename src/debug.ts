import Phaser from 'phaser'
import { RunState } from './domain/progression/RunState'

export function renderDebugHeader(scene: Phaser.Scene, rs: RunState) {
  const header = `P${rs.floor} | ${rs.characterName} | HP ${rs.hp}/${rs.maxHp} | ${rs.gold}g | D${rs.dice}`
  scene.add.text(4, 2, header, {
    fontSize: '7px',
    color: '#88ff88',
    fontFamily: 'monospace',
  }).setDepth(100)
}

export function createDebugState(floor = 5): RunState {
  const state = new RunState()
  state.floor = floor
  state.gold = 100 + floor * 30
  state.maxHp = 30 + Math.floor(floor * 3)
  state.hp = state.maxHp
  state.dice = 3 + Math.floor(floor / 8)
  state.rerolls = 1 + Math.floor(floor / 15)
  state.characterName = 'Guerrero'
  state.seed = 42
  return state
}

export interface SceneData {
  runState?: RunState
}

export function getRunState(scene: Phaser.Scene): RunState | undefined {
  return (scene.scene.settings.data as SceneData | undefined)?.runState
}

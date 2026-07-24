import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { MenuScene } from './scenes/MenuScene'
import { CharacterSelectScene } from './scenes/CharacterSelectScene'
import { MapScene } from './scenes/MapScene'
import { CombatScene } from './scenes/CombatScene'
import { RewardScene } from './scenes/RewardScene'
import { EventScene } from './scenes/EventScene'
import { ShopScene } from './scenes/ShopScene'
import { ForgeScene } from './scenes/ForgeScene'
import { GameOverScene } from './scenes/GameOverScene'
import { createDebugState } from './debug'
import { SaveSystem } from './systems/SaveSystem'
import type { RunState } from './domain/progression/RunState'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: 480,
  height: 270,
  pixelArt: true,
  parent: 'app',
  backgroundColor: '#1a1a2e',
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    CharacterSelectScene,
    MapScene,
    CombatScene,
    RewardScene,
    EventScene,
    ShopScene,
    ForgeScene,
    GameOverScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})

const SHORTCUTS: ReadonlyArray<readonly [string, string, number]> = [
  ['1', 'MapScene', 5],
  ['2', 'CombatScene', 5],
  ['3', 'RewardScene', 5],
  ['4', 'ShopScene', 12],
  ['5', 'EventScene', 5],
  ['6', 'ForgeScene', 5],
  ['7', 'GameOverScene', 5],
  ['8', 'CharacterSelectScene', 5],
]

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (!e.ctrlKey && !e.metaKey) return

  if (e.key === '0' || e.key === 'r' || e.key === 'R') {
    e.preventDefault()
    game.scene.start('MenuScene')
    return
  }

  if (e.key === 's' || e.key === 'S') {
    e.preventDefault()
    // quicksave is auto-written by MapScene on each node click
    const existing = SaveSystem.load('quicksave')
    if (existing) {
      existing.floor = 5
      existing.gold = 200
      SaveSystem.save('quicksave', existing)
      console.log('[quicksave] saved manual snapshot')
    } else {
      SaveSystem.save('quicksave', createDebugState(1))
      console.log('[quicksave] created new save')
    }
    return
  }

  if (e.key === 'l' || e.key === 'L') {
    e.preventDefault()
    const loaded = SaveSystem.load('quicksave')
    if (loaded) {
      game.scene.start('MapScene', { runState: loaded })
      console.log('[quicksave] loaded → MapScene')
    }
    return
  }

  for (const [key, sceneName, floor] of SHORTCUTS) {
    if (e.key === key) {
      e.preventDefault()
      const state: RunState = createDebugState(floor)
      SaveSystem.save('quicksave', state)
      game.scene.start(sceneName, { runState: state })
      return
    }
  }
})

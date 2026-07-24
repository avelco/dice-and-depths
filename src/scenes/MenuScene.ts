import Phaser from 'phaser'
import { createDebugState } from '../debug'

const SCENE_KEYS = [
  'BootScene',
  'PreloadScene',
  'MenuScene',
  'CharacterSelectScene',
  'MapScene',
  'CombatScene',
  'RewardScene',
  'EventScene',
  'ShopScene',
  'ForgeScene',
  'GameOverScene',
]

interface MenuItem {
  label: string
  sceneKey: string
  text: Phaser.GameObjects.Text
}

export class MenuScene extends Phaser.Scene {
  private items: MenuItem[] = []
  private cursor!: Phaser.GameObjects.Text
  private selectedIndex = 0
  private inputLocked = false

  constructor() {
    super('MenuScene')
  }

  create() {
    const { width } = this.cameras.main
    const cx = width / 2
    const startY = 110
    const spacing = 22

    this.add.text(cx, 36, 'DICE & DEPTHS', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    const entries: ReadonlyArray<readonly [string, string]> = [
      ['Descender', 'MapScene'],
      ['Opciones', 'EventScene'],
    ]

    this.items = entries.map(([label, sceneKey], i) => {
      const text = this.add.text(cx, startY + i * spacing, label, {
        fontSize: '10px',
        color: '#888888',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      text.on('pointerover', () => this.select(i))
      text.on('pointerdown', () => this.confirm(i))
      return { label, sceneKey, text }
    })

    this.cursor = this.add.text(cx - 80, startY, '>', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.select(0)

    this.add.text(cx, 250, 'arrow keys / enter | 1-9: debug scenes', {
      fontSize: '6px',
      color: '#444444',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.input.keyboard!.on('keydown-UP', () => this.move(-1))
    this.input.keyboard!.on('keydown-DOWN', () => this.move(1))
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm(this.selectedIndex))

    const debugKeys = SCENE_KEYS as readonly string[]
    this.input.keyboard!.on('keydown-ONE', () => this.scene.start(debugKeys[0]))
    this.input.keyboard!.on('keydown-TWO', () => this.scene.start(debugKeys[1]))
    this.input.keyboard!.on('keydown-THREE', () => this.scene.start(debugKeys[2]))
    this.input.keyboard!.on('keydown-FOUR', () => this.scene.start(debugKeys[3]))
    this.input.keyboard!.on('keydown-FIVE', () => this.scene.start(debugKeys[4]))
    this.input.keyboard!.on('keydown-SIX', () => this.scene.start(debugKeys[5]))
    this.input.keyboard!.on('keydown-SEVEN', () => this.scene.start(debugKeys[6]))
    this.input.keyboard!.on('keydown-EIGHT', () => this.scene.start(debugKeys[7]))
    this.input.keyboard!.on('keydown-NINE', () => this.scene.start(debugKeys[8]))
    this.input.keyboard!.on('keydown-BACKSPACE', () => this.scene.start(debugKeys[9]))
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start(debugKeys[10]))
  }

  private move(dir: number) {
    const next = (this.selectedIndex + dir + this.items.length) % this.items.length
    this.select(next)
  }

  private select(index: number) {
    if (index === this.selectedIndex) return
    const prev = this.items[this.selectedIndex]
    if (prev) prev.text.setColor('#888888')
    this.selectedIndex = index
    const next = this.items[index]
    if (next) {
      next.text.setColor('#ffffff')
      this.cursor.setY(next.text.y)
    }
  }

  private confirm(index: number) {
    if (this.inputLocked) return
    this.inputLocked = true
    const item = this.items[index]
    if (!item) return
    const data =
      item.sceneKey === 'MapScene' ? { runState: createDebugState(1) } : undefined
    this.time.delayedCall(150, () => this.scene.start(item.sceneKey, data))
  }
}

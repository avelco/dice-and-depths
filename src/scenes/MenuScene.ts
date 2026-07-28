import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { t } from '../i18n/I18n'
import { enableTouchTarget } from '../ui/touchTarget'
import { syncRotateHintLocale } from '../ui/rotateHint'

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
  'InventoryScene',
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

  init() {
    this.inputLocked = false
    this.selectedIndex = 0
    this.items = []
  }

  create() {
    MetaProgression.load()
    syncRotateHintLocale()
    const { width } = this.cameras.main
    const cx = width / 2
    const startY = 100
    const spacing = 24

    const unlock = () => AudioSystem.unlock()
    this.input.on('pointerdown', unlock)

    addPixelText(this, cx, 36, 'DICE & DEPTHS', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    addPixelText(this, cx, 58, t('menu.gold', { n: MetaProgression.getGold() }), {
      fontSize: '8px',
      color: '#ffcc66',
    }).setOrigin(0.5)

    const floor = MetaProgression.getCampaignFloor()
    const entries: ReadonlyArray<readonly [string, string]> = [
      [t('menu.descendFloor', { n: floor }), 'CharacterSelectScene'],
      [t('menu.inventory'), 'InventoryScene'],
      [t('menu.forge'), 'ForgeScene'],
      [t('menu.tree'), 'SkillTreeScene'],
      [t('menu.options'), 'OptionsScene'],
    ]

    this.items = entries.map(([label, sceneKey], i) => {
      const text = addPixelText(this, cx, startY + i * spacing, label, {
        fontSize: '16px',
        color: '#888888',
      }).setOrigin(0.5)
      enableTouchTarget(text)
      text.on('pointerover', () => this.select(i))
      text.on('pointerdown', () => this.confirm(i))
      return { label, sceneKey, text }
    })

    this.cursor = addPixelText(this, cx - 80, startY, '>', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.select(0)

    addPixelText(this, cx, 250, t('menu.hint'), {
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5)

    const debugKeys = SCENE_KEYS as readonly string[]
    bindSceneKeys(this, {
      keydown: unlock,
      'keydown-UP': () => this.move(-1),
      'keydown-DOWN': () => this.move(1),
      'keydown-ENTER': () => this.confirm(this.selectedIndex),
      'keydown-ONE': () => this.scene.start(debugKeys[0]),
      'keydown-TWO': () => this.scene.start(debugKeys[1]),
      'keydown-THREE': () => this.scene.start(debugKeys[2]),
      'keydown-FOUR': () => this.scene.start(debugKeys[3]),
      'keydown-FIVE': () => this.scene.start(debugKeys[4]),
      'keydown-SIX': () => this.scene.start(debugKeys[5]),
      'keydown-SEVEN': () => this.scene.start(debugKeys[6]),
      'keydown-EIGHT': () => this.scene.start(debugKeys[7]),
      'keydown-NINE': () => this.scene.start(debugKeys[8]),
      'keydown-BACKSPACE': () => this.scene.start(debugKeys[9]),
      'keydown-ESC': () => this.scene.start(debugKeys[10]),
    })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', unlock)
    })
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
    AudioSystem.play('ui')
  }

  private confirm(index: number) {
    if (this.inputLocked) return
    this.inputLocked = true
    const item = this.items[index]
    if (!item) return
    AudioSystem.unlock()
    AudioSystem.play('select')
    this.time.delayedCall(150, () => this.scene.start(item.sceneKey))
  }
}

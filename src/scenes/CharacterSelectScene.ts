import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { createNewRun } from '../domain/progression/RunState'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { generateFloorMap } from '../domain/map/FloorGenerator'
import { SaveSystem } from '../systems/SaveSystem'

interface CharacterEntry {
  name: string
  lore: string
  locked: boolean
}

const CHARACTERS: CharacterEntry[] = [
  { name: 'Guerrero', lore: 'Maestro del combate cuerpo a cuerpo.', locked: false },
  { name: 'Mago', lore: 'Domina las artes arcanas.', locked: false },
  { name: 'Pícaro', lore: 'Veloz y letal desde las sombras.', locked: true },
  { name: 'Clérigo', lore: 'Sanador y protector divino.', locked: true },
  { name: 'Bárbaro', lore: 'Furia imparable en batalla.', locked: true },
  { name: 'Explorador', lore: 'Rastreador experto en supervivencia.', locked: true },
]

function isLocked(char: CharacterEntry): boolean {
  if (char.name === 'Pícaro') return !MetaProgression.isRogueUnlocked()
  return char.locked
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0
  private inputLocked = false
  private nameText!: Phaser.GameObjects.Text
  private loreText!: Phaser.GameObjects.Text
  private lockedText!: Phaser.GameObjects.Text
  private leftArrow!: Phaser.GameObjects.Text
  private rightArrow!: Phaser.GameObjects.Text
  private confirmPrompt!: Phaser.GameObjects.Text

  constructor() {
    super('CharacterSelectScene')
  }

  create() {
    const { width, height } = this.cameras.main
    const cx = width / 2

    addPixelText(this, cx, 24, 'SELECCIONA PERSONAJE', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.leftArrow = addPixelText(this, cx - 120, height / 2, '<', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    this.rightArrow = addPixelText(this, cx + 120, height / 2, '>', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    this.leftArrow.on('pointerdown', () => this.navigate(-1))
    this.rightArrow.on('pointerdown', () => this.navigate(1))

    this.nameText = addPixelText(this, cx, height / 2 - 8, '', {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.loreText = addPixelText(this, cx, height / 2 + 14, '', {
      fontSize: '8px',
      color: '#aaaaaa',
      wordWrap: { width: 220 },
      align: 'center',
    }).setOrigin(0.5)

    this.lockedText = addPixelText(this, cx, height / 2 + 36, '', {
      fontSize: '8px',
      color: '#cc6666',
    }).setOrigin(0.5)

    this.confirmPrompt = addPixelText(this, cx, height - 24, 'Enter: seleccionar', {
      fontSize: '8px',
      color: '#777777',
    }).setOrigin(0.5)

    addPixelText(this, cx, height - 12, 'ESC: volver', {
      fontSize: '8px',
      color: '#777777',
    }).setOrigin(0.5)

    this.refresh()

    this.input.keyboard!.on('keydown-LEFT', () => this.navigate(-1))
    this.input.keyboard!.on('keydown-RIGHT', () => this.navigate(1))
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm())
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MenuScene'))
  }

  private navigate(dir: number) {
    const next = (this.selectedIndex + dir + CHARACTERS.length) % CHARACTERS.length
    this.selectedIndex = next
    this.refresh()
  }

  private refresh() {
    const char = CHARACTERS[this.selectedIndex]
    const locked = isLocked(char)
    this.nameText.setText(char.name)
    this.loreText.setText(char.lore)
    this.lockedText.setText(locked ? 'BLOQUEADO' : '')
    this.confirmPrompt.setText(locked ? 'Requiere polvo meta (Game Over)' : 'Enter: seleccionar')
  }

  private confirm() {
    if (this.inputLocked) return
    const char = CHARACTERS[this.selectedIndex]
    if (isLocked(char)) return
    this.inputLocked = true

    const state = createNewRun(char.name)
    MetaProgression.applyStartBonuses(state)
    state.map = generateFloorMap(state.seed, state.floor)
    const start = state.map.nodes.find(n => n.kind === 'start')
    state.currentNodeId = start?.id ?? null
    SaveSystem.save('quicksave', state)

    this.time.delayedCall(150, () => this.scene.start('MapScene', { runState: state }))
  }
}

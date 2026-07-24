import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import type { RunState } from '../domain/progression/RunState'

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

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex = 0
  private inputLocked = false
  private runState?: RunState
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

    const rs = getRunState(this)
    if (rs) {
      this.runState = rs
      renderDebugHeader(this, rs)
    }

    this.add.text(cx, 24, 'SELECCIONA PERSONAJE', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.leftArrow = this.add.text(cx - 120, height / 2, '<', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    this.rightArrow = this.add.text(cx + 120, height / 2, '>', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    this.leftArrow.on('pointerdown', () => this.navigate(-1))
    this.rightArrow.on('pointerdown', () => this.navigate(1))

    this.nameText = this.add.text(cx, height / 2 - 8, '', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.loreText = this.add.text(cx, height / 2 + 10, '', {
      fontSize: '7px',
      color: '#888888',
      fontFamily: 'monospace',
      wordWrap: { width: 200 },
      align: 'center',
    }).setOrigin(0.5)

    this.lockedText = this.add.text(cx, height / 2 + 32, '', {
      fontSize: '8px',
      color: '#cc4444',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.confirmPrompt = this.add.text(cx, height - 24, 'Enter: seleccionar', {
      fontSize: '6px',
      color: '#555555',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.add.text(cx, height - 12, 'ESC: volver', {
      fontSize: '6px',
      color: '#555555',
      fontFamily: 'monospace',
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
    this.nameText.setText(char.name)
    this.loreText.setText(char.lore)
    this.lockedText.setText(char.locked ? 'BLOQUEADO' : '')
    this.confirmPrompt.setText(char.locked ? 'Requiere desbloqueo en la Forja' : 'Enter: seleccionar')
  }

  private confirm() {
    if (this.inputLocked) return
    const char = CHARACTERS[this.selectedIndex]
    if (char.locked) return
    this.inputLocked = true
    const data: { runState?: RunState } = {}
    if (this.runState) {
      this.runState.characterName = char.name
      data.runState = this.runState
    }
    this.time.delayedCall(150, () => this.scene.start('MapScene', data))
  }
}

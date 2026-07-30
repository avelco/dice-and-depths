import Phaser from 'phaser'
import { pixelTextStyle, applyPixelTextSharpness } from './pixelText'
import { combatTextStyle, applyCombatTextSharpness } from './combatText'
import type { UiFont } from './HealthBar'
import { STANDARD_FACES, type DieFaces } from '../domain/dice/Die'

const DIE_SIZE = 14
const DOT = 4

export class DieSprite extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text
  private abilityGfx: Phaser.GameObjects.Graphics
  private hitZone: Phaser.GameObjects.Zone
  private _value = 0
  private _size: number
  private comboColor: number | null = null
  private abilityColor: number | null = null
  private faces: DieFaces = [...STANDARD_FACES] as DieFaces
  /** Index into RunState.dice */
  runIndex = -1

  onReroll: (() => void) | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, size = DIE_SIZE, uiFont: UiFont = 'pixel') {
    super(scene, x, y)
    this._size = size

    this.bg = scene.add.graphics()
    this.add(this.bg)

    const dieStyle = uiFont === 'combat'
      ? combatTextStyle({ fontSize: '20px', color: '#ffffff' })
      : pixelTextStyle({
          fontSize: size >= 20 ? '16px' : '8px',
          color: '#ffffff',
        })
    this.label = scene.add.text(0, 0, '1', dieStyle)
    this.label.setOrigin(0.5)
    if (uiFont === 'combat') applyCombatTextSharpness(this.label)
    else applyPixelTextSharpness(this.label)
    this.add(this.label)

    this.abilityGfx = scene.add.graphics()
    this.add(this.abilityGfx)

    this.hitZone = scene.add
      .zone(0, 0, size + 2, size + 2)
      .setInteractive({ useHandCursor: true })
    this.add(this.hitZone)
    this.hitZone.on('pointerdown', () => this.onReroll?.())

    this.setValue(1)
    scene.add.existing(this)
  }

  get value(): number {
    return this._value
  }

  setFaces(faces: DieFaces) {
    this.faces = [...faces] as DieFaces
  }

  setAbility(color: number | null) {
    this.abilityColor = color
    this.drawAbilityDot(1)
  }

  flashAbility() {
    if (this.abilityColor == null) return
    this.drawAbilityDot(1)
    this.scene.tweens.add({
      targets: this.abilityGfx,
      alpha: { from: 1, to: 0.2 },
      duration: 120,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        this.abilityGfx.setAlpha(1)
      },
    })
  }

  setValue(v: number) {
    this._value = v
    this.label.setText(String(v))
    this.redraw(0x3a3a4a)
  }

  setDiceInteractive(on: boolean) {
    if (on) {
      this.hitZone.setInteractive({ useHandCursor: true })
    } else {
      this.hitZone.disableInteractive()
    }
  }

  setComboBorder(color: number | null) {
    this.comboColor = color
    this.redraw(0x3a3a4a)
  }

  roll(finalValue: number, onComplete?: () => void) {
    this.comboColor = null
    this.angle = 0
    this.scene.tweens.killTweensOf(this)
    this.scene.tweens.add({
      targets: this,
      angle: 360,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.angle = 0
      },
    })

    let ticks = 0
    const totalTicks = 10
    this.scene.time.addEvent({
      delay: 35,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++
        if (ticks >= totalTicks) {
          this.setValue(finalValue)
          onComplete?.()
        } else {
          const rnd = this.faces[Math.floor(Math.random() * this.faces.length)]!
          this._value = rnd
          this.label.setText(String(rnd))
          this.redraw(0x444444)
        }
      },
    })
  }

  highlight(on: boolean) {
    this.redraw(on ? 0x555566 : 0x3a3a4a)
  }

  private drawAbilityDot(alpha: number) {
    this.abilityGfx.clear()
    this.abilityGfx.setAlpha(alpha)
    if (this.abilityColor == null) return
    const x = this._size / 2 - DOT / 2 - 1
    const y = -this._size / 2 + 1
    this.abilityGfx.fillStyle(this.abilityColor, 1)
    this.abilityGfx.fillRect(x, y, DOT, DOT)
  }

  private redraw(bgColor: number) {
    this.bg.clear()
    this.bg.fillStyle(bgColor, 1)
    this.bg.fillRoundedRect(
      -this._size / 2,
      -this._size / 2,
      this._size,
      this._size,
      2,
    )
    const border = this.comboColor ?? 0x999999
    this.bg.lineStyle(this.comboColor ? 2 : 1, border, 1)
    this.bg.strokeRoundedRect(
      -this._size / 2,
      -this._size / 2,
      this._size,
      this._size,
      2,
    )
    this.drawAbilityDot(1)
  }
}

/** Color for ability corner glyph. */
export function abilityColor(abilityId: string | null): number | null {
  switch (abilityId) {
    case 'bulwark': return 0x4488ff
    case 'arcane': return 0xaa66ff
    case 'rage': return 0xff4444
    case 'mercy': return 0x66ff99
    case 'swift': return 0x88ffcc
    default: return null
  }
}

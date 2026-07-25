import Phaser from 'phaser'
import { pixelTextStyle, applyPixelTextSharpness } from './pixelText'
import { combatTextStyle, applyCombatTextSharpness } from './combatText'

export type UiFont = 'pixel' | 'combat'

function labelStyle(font: UiFont, size: string, color: string) {
  return font === 'combat'
    ? combatTextStyle({ fontSize: size, color })
    : pixelTextStyle({ fontSize: size, color })
}

function sharpen(txt: Phaser.GameObjects.Text, font: UiFont) {
  if (font === 'combat') applyCombatTextSharpness(txt)
  else applyPixelTextSharpness(txt)
}

export class HealthBar extends Phaser.GameObjects.Container {
  private bgGfx: Phaser.GameObjects.Graphics
  private fillGfx: Phaser.GameObjects.Graphics
  private hpText: Phaser.GameObjects.Text
  private nameText: Phaser.GameObjects.Text
  private defText: Phaser.GameObjects.Text

  private _maxValue: number
  private _value: number
  private barW: number
  private barH: number
  private color: number

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    maxValue: number,
    color: number,
    label: string,
    uiFont: UiFont = 'pixel',
  ) {
    super(scene, x, y)

    this.barW = w
    this.barH = h
    this._maxValue = maxValue
    this._value = maxValue
    this.color = color

    this.bgGfx = scene.add.graphics()
    this.add(this.bgGfx)

    this.fillGfx = scene.add.graphics()
    this.add(this.fillGfx)

    this.nameText = scene.add.text(0, -14, label, labelStyle(uiFont, uiFont === 'combat' ? '20px' : '8px', '#eeeeee'))
    this.nameText.setOrigin(0, 0.5)
    sharpen(this.nameText, uiFont)
    this.add(this.nameText)

    this.hpText = scene.add.text(w / 2, h / 2, '', labelStyle(uiFont, uiFont === 'combat' ? '20px' : '8px', '#ffffff'))
    this.hpText.setOrigin(0.5)
    sharpen(this.hpText, uiFont)
    this.add(this.hpText)

    this.defText = scene.add.text(0, h + 4, '', labelStyle(uiFont, uiFont === 'combat' ? '20px' : '8px', '#99ddff'))
    this.defText.setOrigin(0, 0)
    sharpen(this.defText, uiFont)
    this.add(this.defText)

    this.redraw()
    scene.add.existing(this)
  }

  setValue(value: number) {
    this._value = Phaser.Math.Clamp(value, 0, this._maxValue)
    this.redraw()
  }

  setMax(max: number) {
    this._maxValue = max
    this._value = Math.min(this._value, max)
    this.redraw()
  }

  setDefense(def: number) {
    this.defText.setText(def > 0 ? `DEF ${def}` : '')
    this.redraw()
  }

  get value(): number {
    return this._value
  }

  private redraw() {
    const pct = this._maxValue > 0 ? this._value / this._maxValue : 0

    this.bgGfx.clear()
    this.bgGfx.fillStyle(0x222222, 1)
    this.bgGfx.fillRoundedRect(0, 0, this.barW, this.barH, 2)

    this.fillGfx.clear()
    this.fillGfx.fillStyle(this.color, 1)
    this.fillGfx.fillRoundedRect(0, 0, Math.round(this.barW * pct), this.barH, 2)

    this.hpText.setText(`${this._value}/${this._maxValue}`)
  }
}

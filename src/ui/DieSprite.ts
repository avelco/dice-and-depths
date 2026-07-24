import Phaser from 'phaser'

const DIE_SIZE = 14

export class DieSprite extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics
  private label: Phaser.GameObjects.Text
  private hitZone: Phaser.GameObjects.Zone
  private _value = 0
  private _size: number
  private comboColor: number | null = null

  onReroll: (() => void) | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, size = DIE_SIZE) {
    super(scene, x, y)
    this._size = size

    this.bg = scene.add.graphics()
    this.add(this.bg)

    this.label = scene.add.text(0, 0, '1', {
      fontSize: `${Math.round(size * 0.75)}px`,
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.label.setOrigin(0.5)
    this.add(this.label)

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

  setValue(v: number) {
    this._value = v
    this.label.setText(String(v))
    this.redraw(0x333333)
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
    this.redraw(0x333333)
  }

  roll(finalValue: number, onComplete?: () => void) {
    this.comboColor = null
    let ticks = 0
    const totalTicks = 8
    this.scene.time.addEvent({
      delay: 40,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++
        if (ticks >= totalTicks) {
          this.setValue(finalValue)
          onComplete?.()
        } else {
          const rnd = Math.floor(Math.random() * 6) + 1
          this._value = rnd
          this.label.setText(String(rnd))
          this.redraw(0x333333)
        }
      },
    })
  }

  highlight(on: boolean) {
    this.redraw(on ? 0x555555 : 0x333333)
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
    const border = this.comboColor ?? 0x666666
    this.bg.lineStyle(this.comboColor ? 2 : 1, border, 1)
    this.bg.strokeRoundedRect(
      -this._size / 2,
      -this._size / 2,
      this._size,
      this._size,
      2,
    )
  }
}

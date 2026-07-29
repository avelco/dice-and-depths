import Phaser from 'phaser'
import { addPixelText } from './pixelText'
import { t, type TranslationKey } from '../i18n/I18n'

/**
 * Centered tip banner: tap anywhere or wait to continue.
 */
export class TutorialBanner {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private bg: Phaser.GameObjects.Graphics
  private text: Phaser.GameObjects.Text | null = null
  private hint: Phaser.GameObjects.Text | null = null
  private hit: Phaser.GameObjects.Zone | null = null
  private timer: Phaser.Time.TimerEvent | null = null
  private onDone: (() => void) | null = null
  private open = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setDepth(120).setScrollFactor(0)
    this.bg = scene.add.graphics()
    this.root.add(this.bg)
    this.root.setVisible(false)
  }

  show(messageKey: TranslationKey, onDone?: () => void) {
    this.dismiss(false)
    this.onDone = onDone ?? null
    this.open = true

    const { width, height } = this.scene.cameras.main
    const y = Math.round(height * 0.42)

    this.text = addPixelText(this.scene, width / 2, y, t(messageKey), {
      fontSize: '8px',
      color: '#ffeeaa',
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5)

    this.hint = addPixelText(
      this.scene,
      width / 2,
      y + Math.max(18, Math.ceil(this.text.height) + 10),
      t('tutorial.tap'),
      { fontSize: '8px', color: '#888888' },
    ).setOrigin(0.5)

    const boxW = Math.min(width - 24, Math.max(180, this.text.width + 24))
    const boxH = Math.ceil(this.text.height) + 36
    const boxX = (width - boxW) / 2
    const boxY = y - Math.ceil(this.text.height) / 2 - 10

    this.bg.clear()
    this.bg.fillStyle(0x12121c, 0.92)
    this.bg.fillRoundedRect(boxX, boxY, boxW, boxH, 4)
    this.bg.lineStyle(1, 0x556688, 1)
    this.bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 4)

    this.root.add([this.text, this.hint])
    this.root.setVisible(true)

    this.hit = this.scene.add
      .zone(width / 2, height / 2, width, height)
      .setScrollFactor(0)
      .setDepth(119)
      .setInteractive()
    this.hit.once('pointerdown', () => this.dismiss(true))

    this.timer = this.scene.time.delayedCall(5500, () => this.dismiss(true))
  }

  dismiss(advance: boolean) {
    if (!this.open) return
    this.open = false
    this.timer?.remove(false)
    this.timer = null
    this.hit?.destroy()
    this.hit = null
    this.text?.destroy()
    this.hint?.destroy()
    this.text = null
    this.hint = null
    this.bg.clear()
    this.root.removeAll(false)
    this.root.add(this.bg)
    this.root.setVisible(false)
    const cb = this.onDone
    this.onDone = null
    if (advance) cb?.()
  }

  destroy() {
    this.dismiss(false)
    this.root.destroy(true)
  }
}

import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { getLocale, t, type Locale } from '../i18n/I18n'
import { addBackButton } from '../ui/BackButton'
import { enableTouchTarget, minZoneSize } from '../ui/touchTarget'
import { syncRotateHintLocale } from '../ui/rotateHint'

const FLAG_W = 36
const FLAG_H = 22

export class OptionsScene extends Phaser.Scene {
  constructor() {
    super('OptionsScene')
  }

  create() {
    MetaProgression.load()
    syncRotateHintLocale()
    const { width, height } = this.cameras.main
    const cx = width / 2

    const goMenu = () => {
      AudioSystem.play('ui')
      this.scene.start('MenuScene')
    }
    addBackButton(this, goMenu)

    addPixelText(this, cx, 36, t('options.title'), {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    addPixelText(this, cx, 70, t('options.language'), {
      fontSize: '8px',
      color: '#aaaaaa',
    }).setOrigin(0.5)

    const active = getLocale()
    this.drawFlag(cx - 50, 110, 'es', active === 'es')
    this.drawFlag(cx + 50, 110, 'en', active === 'en')

    addPixelText(this, cx - 50, 140, 'ES', {
      fontSize: '8px',
      color: active === 'es' ? '#ffffaa' : '#888888',
    }).setOrigin(0.5)

    addPixelText(this, cx + 50, 140, 'EN', {
      fontSize: '8px',
      color: active === 'en' ? '#ffffaa' : '#888888',
    }).setOrigin(0.5)

    const fsLabel = this.isFullscreen()
      ? t('options.fullscreenExit')
      : t('options.fullscreen')
    const fsBtn = addPixelText(this, cx, 180, fsLabel, {
      fontSize: '8px',
      color: '#88ccff',
    }).setOrigin(0.5)
    enableTouchTarget(fsBtn, { min: 28 })
    fsBtn.on('pointerover', () => fsBtn.setColor('#cceeff'))
    fsBtn.on('pointerout', () => fsBtn.setColor('#88ccff'))
    fsBtn.on('pointerdown', () => this.toggleFullscreen(fsBtn))

    addPixelText(this, cx, height - 12, t('options.hint'), {
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5)

    bindSceneKeys(this, {
      'keydown-ESC': goMenu,
    })
  }

  private isFullscreen(): boolean {
    return !!(document.fullscreenElement || this.scale.isFullscreen)
  }

  private toggleFullscreen(btn: Phaser.GameObjects.Text) {
    AudioSystem.play('select')
    try {
      if (this.isFullscreen()) {
        if (document.fullscreenElement) void document.exitFullscreen()
        else if (this.scale.isFullscreen) this.scale.stopFullscreen()
      } else {
        if (this.scale.startFullscreen) this.scale.startFullscreen()
        else void document.documentElement.requestFullscreen?.()
      }
    } catch {
      // Fullscreen may be blocked by the browser
    }
    this.time.delayedCall(200, () => {
      btn.setText(
        this.isFullscreen()
          ? t('options.fullscreenExit')
          : t('options.fullscreen'),
      )
    })
  }

  private drawFlag(cx: number, cy: number, locale: Locale, selected: boolean) {
    const x = cx - FLAG_W / 2
    const y = cy - FLAG_H / 2
    const g = this.add.graphics()

    if (locale === 'es') {
      g.fillStyle(0xc60b1e, 1)
      g.fillRect(x, y, FLAG_W, FLAG_H)
      g.fillStyle(0xffc400, 1)
      g.fillRect(x, y + FLAG_H * 0.25, FLAG_W, FLAG_H * 0.5)
    } else {
      g.fillStyle(0x012169, 1)
      g.fillRect(x, y, FLAG_W, FLAG_H)
      g.lineStyle(3, 0xffffff, 1)
      g.lineBetween(x, y, x + FLAG_W, y + FLAG_H)
      g.lineBetween(x + FLAG_W, y, x, y + FLAG_H)
      g.lineStyle(5, 0xffffff, 1)
      g.lineBetween(x + FLAG_W / 2, y, x + FLAG_W / 2, y + FLAG_H)
      g.lineBetween(x, y + FLAG_H / 2, x + FLAG_W, y + FLAG_H / 2)
      g.lineStyle(2, 0xc8102e, 1)
      g.lineBetween(x, y, x + FLAG_W, y + FLAG_H)
      g.lineBetween(x + FLAG_W, y, x, y + FLAG_H)
      g.lineStyle(3, 0xc8102e, 1)
      g.lineBetween(x + FLAG_W / 2, y, x + FLAG_W / 2, y + FLAG_H)
      g.lineBetween(x, y + FLAG_H / 2, x + FLAG_W, y + FLAG_H / 2)
    }

    if (selected) {
      g.lineStyle(2, 0xffffaa, 1)
      g.strokeRect(x - 3, y - 3, FLAG_W + 6, FLAG_H + 6)
    } else {
      g.lineStyle(1, 0x555555, 1)
      g.strokeRect(x - 1, y - 1, FLAG_W + 2, FLAG_H + 2)
    }

    const size = minZoneSize(FLAG_W + 16, FLAG_H + 16, 32)
    const zone = this.add
      .zone(cx, cy, size.w, size.h)
      .setInteractive({ useHandCursor: true })
    zone.on('pointerdown', () => this.pickLocale(locale))
  }

  private pickLocale(locale: Locale) {
    if (locale === getLocale()) return
    AudioSystem.play('select')
    MetaProgression.setLocale(locale)
    syncRotateHintLocale()
    this.scene.restart()
  }
}

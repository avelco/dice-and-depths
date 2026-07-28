import type Phaser from 'phaser'
import { addPixelText } from './pixelText'
import { enableTouchTarget } from './touchTarget'
import { t } from '../i18n/I18n'
import { AudioSystem } from '../systems/AudioSystem'

/** Top-left back control for scenes that previously relied on ESC only. */
export function addBackButton(
  scene: Phaser.Scene,
  onBack: () => void,
  opts: { x?: number; y?: number; labelKey?: 'ui.back' | 'combat.esc' } = {},
) {
  const x = opts.x ?? 28
  const y = opts.y ?? 14
  const key = opts.labelKey ?? 'ui.back'
  const txt = addPixelText(scene, x, y, t(key), {
    fontSize: '8px',
    color: '#aaaaaa',
  })
    .setOrigin(0.5)
    .setDepth(50)
    .setScrollFactor(0)

  enableTouchTarget(txt)
  txt.on('pointerover', () => txt.setColor('#ffffff'))
  txt.on('pointerout', () => txt.setColor('#aaaaaa'))
  txt.on('pointerdown', () => {
    AudioSystem.play('ui')
    onBack()
  })
  return txt
}

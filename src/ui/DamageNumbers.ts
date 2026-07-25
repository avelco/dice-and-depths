import Phaser from 'phaser'
import { addPixelText } from './pixelText'
import { addCombatText } from './combatText'
import type { UiFont } from './HealthBar'

export class DamageNumbers {
  static show(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: number,
    color = '#ff4444',
    uiFont: UiFont = 'pixel',
  ) {
    const style = { fontSize: uiFont === 'combat' ? '28px' : '12px', color }
    const txt = uiFont === 'combat'
      ? addCombatText(scene, x, y, String(value), style)
      : addPixelText(scene, x, y, String(value), style)
    txt.setOrigin(0.5)
    txt.setDepth(50)

    scene.tweens.add({
      targets: txt,
      y: y - 18,
      alpha: 0,
      duration: 700,
      ease: 'Power2',
      onComplete: () => txt.destroy(),
    })
  }
}

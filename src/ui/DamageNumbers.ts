import Phaser from 'phaser'

export class DamageNumbers {
  static show(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: number,
    color = '#ff4444',
  ) {
    const txt = scene.add.text(x, y, String(value), {
      fontSize: '14px',
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    })
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

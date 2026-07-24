import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene')
  }

  create() {
    const { width, height } = this.cameras.main
    const cx = width / 2

    const rs = getRunState(this)
    if (rs) renderDebugHeader(this, rs)

    this.add.text(cx, height / 2 - 8, 'Tienda', {
      fontSize: '12px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.add.text(cx, height - 16, 'ESC: menu', {
      fontSize: '6px',
      color: '#555555',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MenuScene'))
  }
}

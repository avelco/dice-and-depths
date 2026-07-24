import Phaser from 'phaser'

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics
  private progressBox!: Phaser.GameObjects.Graphics

  constructor() {
    super('PreloadScene')
  }

  create() {
    const { width, height } = this.cameras.main
    const barW = 240
    const barH = 16
    const x = (width - barW) / 2
    const y = height / 2 - barH / 2

    this.progressBox = this.add.graphics()
    this.progressBox.fillStyle(0x333333, 1)
    this.progressBox.fillRoundedRect(x - 2, y - 2, barW + 4, barH + 4, 4)

    this.progressBar = this.add.graphics()

    this.add.text(width / 2, y - 16, 'LOADING...', {
      fontSize: '8px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10)

    const fill = (pct: number) => {
      this.progressBar.clear()
      this.progressBar.fillStyle(0xffffff, 1)
      this.progressBar.fillRoundedRect(x, y, barW * pct, barH, 3)
    }

    fill(0)

    if (this.load.totalToLoad === 0) {
      let t = 0
      this.time.addEvent({
        delay: 30,
        repeat: 20,
        callback: () => {
          t++
          fill(t / 20)
          if (t >= 20) this.scene.start('MenuScene')
        },
      })
      return
    }

    this.load.on('progress', (value: number) => fill(value))
    this.load.on('complete', () => this.scene.start('MenuScene'))
    this.load.start()
  }
}

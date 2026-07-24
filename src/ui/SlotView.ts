import Phaser from 'phaser'
import { DieSprite } from './DieSprite'

const DIE_GAP = 4
const DIE_SIZE = 14

export class SlotView extends Phaser.GameObjects.Container {
  private dice: DieSprite[] = []
  private label: Phaser.GameObjects.Text
  private values: number[] = []

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    title: string,
    count: number,
  ) {
    super(scene, x, y)

    this.label = scene.add.text(0, 0, title, {
      fontSize: '7px',
      color: '#888888',
      fontFamily: 'monospace',
    })
    this.label.setOrigin(0.5, 0.5)
    this.add(this.label)

    const totalW = count * DIE_SIZE + (count - 1) * DIE_GAP
    const startX = -totalW / 2 + DIE_SIZE / 2

    for (let i = 0; i < count; i++) {
      const die = new DieSprite(
        scene,
        startX + i * (DIE_SIZE + DIE_GAP),
        DIE_SIZE * 0.8,
        DIE_SIZE,
      )
      this.dice.push(die)
      this.add(die)
    }

    scene.add.existing(this)
  }

  getDiceValues(): number[] {
    return this.dice.map(d => d.value)
  }

  rollAll(onAllComplete?: () => void) {
    this.values = this.dice.map(() => Math.floor(Math.random() * 6) + 1)
    let completed = 0

    this.dice.forEach((die, i) => {
      die.roll(this.values[i], () => {
        completed++
        if (completed === this.dice.length) {
          onAllComplete?.()
        }
      })
    })
  }

  highlightAll(on: boolean) {
    this.dice.forEach(d => d.highlight(on))
  }
}

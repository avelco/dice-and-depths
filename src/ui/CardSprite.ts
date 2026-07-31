import Phaser from 'phaser'
import { cardDef, effectsOf, type RunCard } from '../domain/cards/Card'
import { tKey } from '../i18n/I18n'

const W = 44
const H = 58

const EFFECT_COLOR: Record<string, string> = {
  damage: '#ff6666',
  poison: '#88cc44',
  shield: '#66aaff',
  heal: '#66ff99',
}

export class CardSprite extends Phaser.GameObjects.Container {
  readonly runCard: RunCard
  private bg: Phaser.GameObjects.Graphics
  private selected = false
  onTap: (() => void) | null = null

  constructor(scene: Phaser.Scene, x: number, y: number, card: RunCard) {
    super(scene, x, y)
    this.runCard = card

    this.bg = scene.add.graphics()
    this.add(this.bg)
    this.redraw()

    const def = cardDef(card.defId)
    const name = tKey(`card.${card.defId}.name`, card.defId)
    const title = scene.add.text(0, -H / 2 + 6, name.slice(0, 8), {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#ffffff',
    }).setOrigin(0.5, 0)
    this.add(title)

    const effects = effectsOf(card)
    effects.slice(0, 3).forEach((e, i) => {
      const label = `${e.type[0]!.toUpperCase()}${e.value}`
      const txt = scene.add.text(0, -4 + i * 12, label, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: EFFECT_COLOR[e.type] ?? '#cccccc',
      }).setOrigin(0.5)
      this.add(txt)
    })

    const rarity = def?.rarity ?? 'common'
    const rarityColor =
      rarity === 'legendary' ? '#ffcc44' : rarity === 'rare' ? '#66aaff' : '#888888'
    const rTxt = scene.add.text(0, H / 2 - 10, rarity[0]!.toUpperCase(), {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: rarityColor,
    }).setOrigin(0.5)
    this.add(rTxt)

    const zone = scene.add.zone(0, 0, W + 4, H + 4).setInteractive({ useHandCursor: true })
    this.add(zone)
    zone.on('pointerdown', () => this.onTap?.())

    scene.add.existing(this)
  }

  setSelected(on: boolean) {
    this.selected = on
    this.redraw()
    this.y += on ? 0 : 0
  }

  private redraw() {
    this.bg.clear()
    this.bg.fillStyle(0x222233, 1)
    this.bg.fillRoundedRect(-W / 2, -H / 2, W, H, 3)
    this.bg.lineStyle(this.selected ? 2 : 1, this.selected ? 0xffee88 : 0x888899, 1)
    this.bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 3)
  }

  static get WIDTH() {
    return W
  }

  static get HEIGHT() {
    return H
  }
}

export function describeCard(defId: string): string {
  const def = cardDef(defId)
  if (!def) return defId
  return def.effects.map(e => `${e.type} ${e.value}`).join(', ')
}

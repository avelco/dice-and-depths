import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { addPixelText } from '../ui/pixelText'

interface GameOverData {
  runState?: import('../domain/progression/RunState').RunState
  victory?: boolean
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene')
  }

  create() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    const data = this.scene.settings.data as GameOverData
    const rs = data.runState ?? getRunState(this)
    const victory = !!data.victory

    if (rs) renderDebugHeader(this, rs)

    if (victory) {
      addPixelText(this, cx, 48, 'VICTORIA', {
        fontSize: '14px', color: '#ffcc44', fontStyle: 'bold',
      }).setOrigin(0.5)
      addPixelText(this, cx, 72, 'Completaste 3 pisos', {
        fontSize: '8px', color: '#aaaaaa',
      }).setOrigin(0.5)
    } else if (rs) {
      const dust = MetaProgression.dustForRun(rs.floor, rs.gold)
      rs.lastDustEarned = dust
      const meta = MetaProgression.load()
      meta.metaDust += dust
      MetaProgression.save(meta)

      addPixelText(this, cx, 40, 'FIN DE PARTIDA', {
        fontSize: '14px', color: '#ff6666', fontStyle: 'bold',
      }).setOrigin(0.5)
      addPixelText(this, cx, 64, `+${dust} polvo meta`, {
        fontSize: '9px', color: '#ccaa44',
      }).setOrigin(0.5)
      addPixelText(this, cx, 80, `Total: ${meta.metaDust}`, {
        fontSize: '8px', color: '#888888',
      }).setOrigin(0.5)

      this.drawUnlocks(cx, 110, meta.metaDust)
    }

    const menuBtn = addPixelText(this, cx, height - 40, '[M] Menu', {
      fontSize: '9px', color: '#cccccc',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'))
    this.input.keyboard!.on('keydown-M', () => this.scene.start('MenuScene'))
  }

  private drawUnlocks(cx: number, y: number, dust: number) {
    const items: { key: 'extraMaxHp' | 'extraGold' | 'unlockRogue'; label: string }[] = [
      { key: 'extraMaxHp', label: '+5 HP inicio' },
      { key: 'extraGold', label: '+10 oro inicio' },
      { key: 'unlockRogue', label: 'Desbloquear Pícaro' },
    ]

    items.forEach((item, i) => {
      const cost = MetaProgression.getUnlockCost(item.key)
      const txt = addPixelText(this, cx, y + i * 22, `[${i + 1}] ${item.label} (${cost})`, {
        fontSize: '7px',
        color: dust >= cost ? '#aaffaa' : '#666666',
      }).setOrigin(0.5).setInteractive({ useHandCursor: dust >= cost })

      txt.on('pointerdown', () => {
        if (MetaProgression.tryPurchase(item.key)) {
          txt.setColor('#888888')
          txt.disableInteractive()
        }
      })

      const key = ['ONE', 'TWO', 'THREE'][i] as 'ONE' | 'TWO' | 'THREE'
      this.input.keyboard!.on(`keydown-${key}`, () => MetaProgression.tryPurchase(item.key))
    })
  }
}

import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { addPixelText } from '../ui/pixelText'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { t } from '../i18n/I18n'

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
      addPixelText(this, cx, 48, t('gameover.victory'), {
        fontSize: '14px', color: '#ffcc44', fontStyle: 'bold',
      }).setOrigin(0.5)
      addPixelText(this, cx, 72, t('gameover.victorySub'), {
        fontSize: '8px', color: '#aaaaaa',
      }).setOrigin(0.5)
    } else if (rs) {
      const dust = MetaProgression.dustForRun(rs.floor, rs.coins)
      rs.lastDustEarned = dust
      const meta = MetaProgression.load()
      meta.metaDust += dust
      MetaProgression.save(meta)

      addPixelText(this, cx, 40, t('gameover.defeat'), {
        fontSize: '14px', color: '#ff6666', fontStyle: 'bold',
      }).setOrigin(0.5)
      addPixelText(this, cx, 64, t('gameover.dust', { n: dust }), {
        fontSize: '9px', color: '#ccaa44',
      }).setOrigin(0.5)
      addPixelText(this, cx, 80, t('gameover.total', { n: meta.metaDust }), {
        fontSize: '8px', color: '#888888',
      }).setOrigin(0.5)

      this.drawUnlocks(cx, 110, meta.metaDust)
    }

    const menuBtn = addPixelText(this, cx, height - 40, t('gameover.menu'), {
      fontSize: '9px', color: '#cccccc',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'))
    bindSceneKeys(this, {
      'keydown-M': () => this.scene.start('MenuScene'),
      'keydown-ONE': () => MetaProgression.tryPurchase('extraMaxHp'),
      'keydown-TWO': () => MetaProgression.tryPurchase('extraGold'),
      'keydown-THREE': () => MetaProgression.tryPurchase('unlockRogue'),
    })
  }

  private drawUnlocks(cx: number, y: number, dust: number) {
    const items: { key: 'extraMaxHp' | 'extraGold' | 'unlockRogue'; labelKey: 'gameover.unlockHp' | 'gameover.unlockGold' | 'gameover.unlockRogue' }[] = [
      { key: 'extraMaxHp', labelKey: 'gameover.unlockHp' },
      { key: 'extraGold', labelKey: 'gameover.unlockGold' },
      { key: 'unlockRogue', labelKey: 'gameover.unlockRogue' },
    ]

    items.forEach((item, i) => {
      const cost = MetaProgression.getUnlockCost(item.key)
      const txt = addPixelText(this, cx, y + i * 22, `[${i + 1}] ${t(item.labelKey)} (${cost})`, {
        fontSize: '7px',
        color: dust >= cost ? '#aaffaa' : '#666666',
      }).setOrigin(0.5).setInteractive({ useHandCursor: dust >= cost })

      txt.on('pointerdown', () => {
        if (MetaProgression.tryPurchase(item.key)) {
          txt.setColor('#888888')
          txt.disableInteractive()
        }
      })
    })
  }
}

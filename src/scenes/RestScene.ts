import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { addPixelText } from '../ui/pixelText'
import { markCurrentNodeCleared } from './MapScene'
import { t } from '../i18n/I18n'

export class RestScene extends Phaser.Scene {
  private locked = false

  constructor() {
    super('RestScene')
  }

  create() {
    const { width } = this.cameras.main
    const cx = width / 2
    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }

    renderDebugHeader(this, rs)

    addPixelText(this, cx, 40, t('rest.title'), {
      fontSize: '12px', color: '#66cccc', fontStyle: 'bold',
    }).setOrigin(0.5)

    const choices = [
      {
        label: t('rest.sleep', { n: Math.floor(rs.maxHp * 0.4) }),
        apply: () => {
          rs.hp = Math.min(rs.maxHp, rs.hp + Math.floor(rs.maxHp * 0.4))
        },
      },
      {
        label: t('rest.train'),
        apply: () => {
          rs.rerollMax.atk = Math.min(8, rs.rerollMax.atk + 1)
        },
      },
    ]

    choices.forEach((c, i) => {
      addPixelText(this, cx, 100 + i * 32, `[${i + 1}] ${c.label}`, {
        fontSize: '8px', color: '#dddddd',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.pick(rs, c.apply))
    })
  }

  private pick(rs: import('../domain/progression/RunState').RunState, apply: () => void) {
    if (this.locked) return
    this.locked = true
    apply()
    markCurrentNodeCleared(rs)
    SaveSystem.save('quicksave', rs)
    this.scene.start('MapScene', { runState: rs })
  }
}

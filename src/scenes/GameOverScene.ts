import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { addPixelText } from '../ui/pixelText'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { t } from '../i18n/I18n'
import { enableTouchTarget } from '../ui/touchTarget'
import { AudioSystem } from '../systems/AudioSystem'

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
    } else {
      addPixelText(this, cx, 48, t('gameover.defeat'), {
        fontSize: '14px', color: '#ff6666', fontStyle: 'bold',
      }).setOrigin(0.5)
    }

    const menuBtn = addPixelText(this, cx, height - 40, t('gameover.menu'), {
      fontSize: '10px', color: '#dddddd',
    }).setOrigin(0.5)
    enableTouchTarget(menuBtn, { min: 36 })
    menuBtn.on('pointerover', () => menuBtn.setColor('#ffffff'))
    menuBtn.on('pointerout', () => menuBtn.setColor('#dddddd'))
    menuBtn.on('pointerdown', () => {
      AudioSystem.play('ui')
      this.scene.start('MenuScene')
    })
    bindSceneKeys(this, {
      'keydown-M': () => this.scene.start('MenuScene'),
    })
  }
}

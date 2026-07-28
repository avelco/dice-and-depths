import Phaser from 'phaser'
import { getRunState, renderDebugHeader, shopDiscount } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { addPixelText } from '../ui/pixelText'
import { pickRandomPassiveIds } from '../domain/progression/Passives'
import { markCurrentNodeCleared } from './MapScene'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { passiveName, t } from '../i18n/I18n'
import { enableTouchTarget } from '../ui/touchTarget'

export class ShopScene extends Phaser.Scene {
  private locked = false

  constructor() {
    super('ShopScene')
  }

  init() {
    this.locked = false
  }

  create() {
    const { width } = this.cameras.main
    const cx = width / 2
    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }
    const disc = shopDiscount(rs)

    renderDebugHeader(this, rs)

    addPixelText(this, cx, 36, t('shop.title'), {
      fontSize: '12px', color: '#ffcc66', fontStyle: 'bold',
    }).setOrigin(0.5)

    const healCost = Math.floor(20 * disc)
    const rerollCost = Math.floor(35 * disc)
    const passiveCost = Math.floor(50 * disc)

    const rng = () => Math.random()
    const [pid] = pickRandomPassiveIds(1, rs.passives, rng)

    const offers = [
      { label: t('shop.heal', { n: healCost }), cost: healCost, apply: () => {
        rs.hp = Math.min(rs.maxHp, rs.hp + Math.floor(rs.maxHp * 0.25))
      }},
      { label: t('shop.rerollAtk', { n: rerollCost }), cost: rerollCost, apply: () => {
        rs.rerollMax.atk = Math.min(8, rs.rerollMax.atk + 1)
      }},
      { label: `${pid ? passiveName(pid) : t('reward.passive')} (${passiveCost}g)`, cost: passiveCost, apply: () => {
        if (pid && !rs.passives.includes(pid)) rs.passives.push(pid)
      }},
    ]

    offers.forEach((o, i) => {
      const y = 90 + i * 32
      const offer = addPixelText(this, cx, y, `[${i + 1}] ${o.label}`, {
        fontSize: '8px', color: rs.coins >= o.cost ? '#dddddd' : '#555555',
      }).setOrigin(0.5)
      if (rs.coins >= o.cost) {
        enableTouchTarget(offer)
        offer.on('pointerdown', () => this.buy(rs, o.cost, o.apply))
      }
    })

    const exit = addPixelText(this, cx, 200, t('shop.exit'), {
      fontSize: '8px', color: '#aaaaaa',
    }).setOrigin(0.5)
    enableTouchTarget(exit)
    exit.on('pointerdown', () => this.leave(rs))

    bindSceneKeys(this, {
      'keydown-ZERO': () => this.leave(rs),
    })
  }

  private buy(rs: import('../domain/progression/RunState').RunState, cost: number, apply: () => void) {
    if (this.locked || rs.coins < cost) return
    rs.coins -= cost
    apply()
    SaveSystem.save('quicksave', rs)
    this.scene.restart({ runState: rs })
  }

  private leave(rs: import('../domain/progression/RunState').RunState) {
    if (this.locked) return
    this.locked = true
    markCurrentNodeCleared(rs)
    SaveSystem.save('quicksave', rs)
    this.scene.start('MapScene', { runState: rs })
  }
}

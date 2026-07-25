import Phaser from 'phaser'
import { getRunState, renderDebugHeader, shopDiscount } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { addPixelText } from '../ui/pixelText'
import { pickRandomPassiveIds, passiveDef } from '../domain/progression/Passives'
import { markCurrentNodeCleared } from './MapScene'

export class ShopScene extends Phaser.Scene {
  private locked = false

  constructor() {
    super('ShopScene')
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

    addPixelText(this, cx, 36, 'TIENDA', {
      fontSize: '12px', color: '#ffcc66', fontStyle: 'bold',
    }).setOrigin(0.5)

    const healCost = Math.floor(20 * disc)
    const rerollCost = Math.floor(35 * disc)
    const passiveCost = Math.floor(50 * disc)

    const rng = () => Math.random()
    const [pid] = pickRandomPassiveIds(1, rs.passives, rng)
    const pdef = passiveDef(pid)

    const offers = [
      { label: `Cura 25% HP (${healCost}g)`, cost: healCost, apply: () => {
        rs.hp = Math.min(rs.maxHp, rs.hp + Math.floor(rs.maxHp * 0.25))
      }},
      { label: `+1 reroll DEF (${rerollCost}g)`, cost: rerollCost, apply: () => {
        rs.rerollMax.def = Math.min(5, rs.rerollMax.def + 1)
      }},
      { label: `${pdef?.name ?? 'Passive'} (${passiveCost}g)`, cost: passiveCost, apply: () => {
        if (pid && !rs.passives.includes(pid)) rs.passives.push(pid)
      }},
    ]

    offers.forEach((o, i) => {
      const y = 90 + i * 32
      addPixelText(this, cx, y, `[${i + 1}] ${o.label}`, {
        fontSize: '8px', color: rs.gold >= o.cost ? '#dddddd' : '#555555',
      }).setOrigin(0.5).setInteractive({ useHandCursor: rs.gold >= o.cost })
        .on('pointerdown', () => this.buy(rs, o.cost, o.apply))
    })

    addPixelText(this, cx, 200, '[0] Salir', {
      fontSize: '8px', color: '#aaaaaa',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.leave(rs))

    this.input.keyboard!.on('keydown-ZERO', () => this.leave(rs))
  }

  private buy(rs: import('../domain/progression/RunState').RunState, cost: number, apply: () => void) {
    if (this.locked || rs.gold < cost) return
    rs.gold -= cost
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

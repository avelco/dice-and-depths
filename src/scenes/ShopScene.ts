import Phaser from 'phaser'
import { getRunState, getSceneData, renderDebugHeader, shopDiscount } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { addPixelText } from '../ui/pixelText'
import { pickRandomPassiveIds } from '../domain/progression/Passives'
import { markCurrentNodeCleared } from './MapScene'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { passiveName, t } from '../i18n/I18n'
import { enableTouchTarget } from '../ui/touchTarget'
import type { RunState } from '../domain/progression/RunState'
import { syncRunStateDerived } from '../domain/progression/RunState'
import { AudioSystem } from '../systems/AudioSystem'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { TutorialBanner } from '../ui/TutorialBanner'

interface ShopOffer {
  label: string
  cost: number
  enabled: boolean
  apply: () => void
}

export class ShopScene extends Phaser.Scene {
  private locked = false
  private postCombat = false
  private soulsGained = 0

  constructor() {
    super('ShopScene')
  }

  init() {
    this.locked = false
  }

  create() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    const data = getSceneData(this)
    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }
    this.postCombat = !!data.postCombat
    this.soulsGained = data.soulsGained ?? 0
    const disc = shopDiscount(rs)

    renderDebugHeader(this, rs)

    addPixelText(this, cx, 28, t(this.postCombat ? 'shop.postTitle' : 'shop.title'), {
      fontSize: '12px',
      color: '#ffcc66',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    if (this.postCombat && this.soulsGained > 0) {
      addPixelText(this, cx, 46, t('shop.soulsGained', { n: this.soulsGained }), {
        fontSize: '8px',
        color: '#88ffaa',
      }).setOrigin(0.5)
    }

    addPixelText(this, cx, this.postCombat && this.soulsGained > 0 ? 60 : 48, t('shop.almas', { n: rs.coins }), {
      fontSize: '8px',
      color: '#ffcc66',
    }).setOrigin(0.5)

    const offers = this.postCombat
      ? this.postCombatOffers(rs, disc)
      : this.mapShopOffers(rs, disc)

    offers.forEach((o, i) => {
      const y = 84 + i * 28
      const canBuy = o.enabled && rs.coins >= o.cost
      const offer = addPixelText(this, cx, y, `[${i + 1}] ${o.label}`, {
        fontSize: '8px',
        color: canBuy ? '#dddddd' : '#555555',
        wordWrap: { width: width - 40 },
        align: 'center',
      }).setOrigin(0.5)
      if (canBuy) {
        enableTouchTarget(offer, { min: 24 })
        offer.on('pointerdown', () => this.buy(rs, o.cost, o.apply))
      }
    })

    const exit = addPixelText(this, cx, height - 28, t('shop.exit'), {
      fontSize: '8px',
      color: '#aaaaaa',
    }).setOrigin(0.5)
    enableTouchTarget(exit, { min: 24 })
    exit.on('pointerdown', () => this.leave(rs))

    const keys: Record<string, () => void> = {
      'keydown-ZERO': () => this.leave(rs),
    }
    offers.forEach((o, i) => {
      if (i >= 9) return
      const key = `keydown-${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'][i]}`
      keys[key] = () => {
        if (o.enabled && rs.coins >= o.cost) this.buy(rs, o.cost, o.apply)
      }
    })
    bindSceneKeys(this, keys)

    if (this.postCombat && !MetaProgression.isTutorialDone()) {
      const tip = new TutorialBanner(this)
      tip.show('tutorial.souls', () => {
        MetaProgression.completeTutorial()
        tip.destroy()
      })
    }
  }

  private postCombatOffers(rs: RunState, disc: number): ShopOffer[] {
    const healCost = Math.floor(18 * disc)
    const defCost = Math.floor(22 * disc)
    const rerollCost = Math.floor(30 * disc)
    const diceCost = Math.floor(40 * disc)
    const healAmt = Math.max(1, Math.floor(rs.maxHp * 0.25))

    return [
      {
        label: t('shop.heal', { n: healCost }),
        cost: healCost,
        enabled: rs.hp < rs.maxHp,
        apply: () => {
          rs.hp = Math.min(rs.maxHp, rs.hp + healAmt)
        },
      },
      {
        label: t('shop.def', { n: defCost }),
        cost: defCost,
        enabled: true,
        apply: () => {
          rs.bonusDefFlat += 1
        },
      },
      {
        label: t('shop.rerollAtk', { n: rerollCost }),
        cost: rerollCost,
        enabled: rs.rerollMax.atk < 8,
        apply: () => {
          rs.rerollMax.atk = Math.min(8, rs.rerollMax.atk + 1)
        },
      },
      {
        label: t('shop.diceAtk', { n: diceCost }),
        cost: diceCost,
        enabled: rs.diceLoadout.atk < 6,
        apply: () => {
          rs.diceLoadout.atk = Math.min(6, rs.diceLoadout.atk + 1)
        },
      },
    ]
  }

  private mapShopOffers(rs: RunState, disc: number): ShopOffer[] {
    const healCost = Math.floor(20 * disc)
    const rerollCost = Math.floor(35 * disc)
    const passiveCost = Math.floor(50 * disc)
    const [pid] = pickRandomPassiveIds(1, rs.passives, () => Math.random())

    return [
      {
        label: t('shop.heal', { n: healCost }),
        cost: healCost,
        enabled: rs.hp < rs.maxHp,
        apply: () => {
          rs.hp = Math.min(rs.maxHp, rs.hp + Math.floor(rs.maxHp * 0.25))
        },
      },
      {
        label: t('shop.rerollAtk', { n: rerollCost }),
        cost: rerollCost,
        enabled: rs.rerollMax.atk < 8,
        apply: () => {
          rs.rerollMax.atk = Math.min(8, rs.rerollMax.atk + 1)
        },
      },
      {
        label: `${pid ? passiveName(pid) : t('reward.passive')} (${passiveCost}a)`,
        cost: passiveCost,
        enabled: !!pid,
        apply: () => {
          if (pid && !rs.passives.includes(pid)) rs.passives.push(pid)
        },
      },
    ]
  }

  private buy(rs: RunState, cost: number, apply: () => void) {
    if (this.locked || rs.coins < cost) return
    rs.coins -= cost
    apply()
    syncRunStateDerived(rs)
    AudioSystem.play('coin')
    SaveSystem.save('quicksave', rs)
    this.scene.restart({
      runState: rs,
      postCombat: this.postCombat,
      soulsGained: this.soulsGained,
    })
  }

  private leave(rs: RunState) {
    if (this.locked) return
    this.locked = true
    markCurrentNodeCleared(rs)
    rs.pendingNodeKind = null
    SaveSystem.save('quicksave', rs)
    AudioSystem.play('ui')
    this.scene.start('MapScene', { runState: rs })
  }
}

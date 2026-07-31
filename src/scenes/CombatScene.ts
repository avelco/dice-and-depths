import Phaser from 'phaser'
import { getRunState, applyPassiveOnKill, trySecondWind } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { HealthBar } from '../ui/HealthBar'
import { CardSprite } from '../ui/CardSprite'
import { DamageNumbers } from '../ui/DamageNumbers'
import { addPixelText } from '../ui/pixelText'
import { Enemy } from '../domain/enemies/Enemy'
import { EnemyAI } from '../domain/enemies/EnemyAI'
import { CombatEngine, toFighter } from '../domain/combat/CombatEngine'
import type { RunState } from '../domain/progression/RunState'
import { rollCombatSouls } from '../domain/progression/CombatRewards'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { charName, enemyName, t } from '../i18n/I18n'
import { minZoneSize } from '../ui/touchTarget'
import { addBackButton } from '../ui/BackButton'
import { showConfirmModal } from '../ui/ConfirmModal'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { TutorialBanner } from '../ui/TutorialBanner'
import {
  createCombatDeck,
  endTurnDraw,
  fillHand,
  playFromHand,
  slottedCards,
  unplaySlot,
  type CombatDeck,
} from '../domain/cards/Deck'
import { previewCards } from '../domain/cards/CardEffects'

const DEF_MAX = 18
const ENEMY_ARENA_Y = 72
const HERO_ARENA_Y = 158
const ENEMY_SCALE = 0.7
const HERO_SCALE = 1.2
const QUEUE_X = 22
const QUEUE_STEP_Y = 18
const ENEMY_BAR_W = 100
const HERO_BAR_W = 130
const BAR_H = 9

export class CombatScene extends Phaser.Scene {
  private state!: RunState
  private enemy!: Enemy
  private wave: Enemy[] = []

  private heroHpBar!: HealthBar
  private heroDefBar!: HealthBar
  private enemyHpBar!: HealthBar

  private deck!: CombatDeck
  private handSprites: CardSprite[] = []
  private slotSprites: (CardSprite | null)[] = []
  private slotZones: Phaser.GameObjects.Rectangle[] = []

  private endTurnBtn!: Phaser.GameObjects.Zone
  private endTurnTxt!: Phaser.GameObjects.Text
  private previewTxt!: Phaser.GameObjects.Text
  private attacking = false

  private heroGfx!: Phaser.GameObjects.Graphics
  private enemyGfx!: Phaser.GameObjects.Graphics
  private enemyNameText!: Phaser.GameObjects.Text
  private enemyIntentTxt!: Phaser.GameObjects.Text
  private queueGfx: Phaser.GameObjects.Graphics[] = []
  private pathGfx!: Phaser.GameObjects.Graphics
  private shakeTimers = new Map<object, Phaser.Time.TimerEvent>()
  private shakeRests = new Map<object, { x: number; y: number }>()

  private heroArenaX = 135
  private enemyArenaX = 135
  private abandonOpen = false
  private enemyDeck!: CombatDeck
  private statusTxt!: Phaser.GameObjects.Text

  constructor() {
    super('CombatScene')
  }

  init() {
    this.handSprites = []
    this.slotSprites = []
    this.slotZones = []
    this.wave = []
    this.queueGfx = []
    this.attacking = false
    this.abandonOpen = false
    this.shakeTimers.clear()
    this.shakeRests.clear()
    this.children.removeAll(true)
  }

  create() {
    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }
    this.state = rs

    const kind = this.state.pendingNodeKind ?? 'combat'
    this.wave = Enemy.waveForNode(kind, this.state.floor, this.state.seed)
    this.enemy = this.wave[0]!

    this.deck = createCombatDeck(this.state.deckDefs, this.state.actionSlots)
    fillHand(this.deck)
    this.enemyDeck = createCombatDeck(this.enemy.deckDefs, this.enemy.actionSlots)
    fillHand(this.enemyDeck)

    this.drawArena()
    this.drawBars()
    this.drawCardUi()
    this.bindEnemyBars()
    this.refreshHandUi()
    this.updatePreview()
    this.previewEnemyIntent()
    this.enableInput()

    // Start-of-combat poison tick (none yet)
    this.applyHeroShieldBar()

    addBackButton(this, () => this.promptAbandonFight(), { labelKey: 'combat.esc' })

    bindSceneKeys(this, {
      'keydown-ESC': () => this.promptAbandonFight(),
      'keydown-ENTER': () => this.onEndTurn(),
      'keydown-SPACE': () => this.onEndTurn(),
    })

    if (!MetaProgression.isTutorialDone() && this.state.floor === 1) {
      const tip = new TutorialBanner(this)
      tip.show('tutorial.combat', () => tip.destroy())
    }
  }

  private promptAbandonFight() {
    if (this.abandonOpen || this.attacking) return
    this.abandonOpen = true
    showConfirmModal(this, {
      title: t('combat.abandonTitle'),
      body: t('combat.abandonBody'),
      confirmLabel: t('combat.abandonConfirm'),
      cancelLabel: t('combat.abandonCancel'),
      onConfirm: () => {
        SaveSystem.abandonQuicksave()
        this.scene.start('GameOverScene', { runState: this.state, victory: false })
      },
      onCancel: () => {
        this.abandonOpen = false
      },
    })
  }

  private drawArena() {
    const { width } = this.cameras.main
    this.heroArenaX = width * 0.35
    this.enemyArenaX = width * 0.65
    this.pathGfx = this.add.graphics().setDepth(0)
    this.drawPerspectivePath(width / 2, 40, 200)

    this.heroGfx = this.drawCharacter(this.heroArenaX, HERO_ARENA_Y, HERO_SCALE, 0x6688cc)
    this.enemyGfx = this.drawCharacter(this.enemyArenaX, ENEMY_ARENA_Y, ENEMY_SCALE, 0xcc6666)

    this.enemyNameText = addPixelText(
      this,
      this.enemyArenaX,
      ENEMY_ARENA_Y - 34 * ENEMY_SCALE,
      enemyName(this.enemy.templateId),
      { fontSize: '8px', color: '#ffaaaa' },
    ).setOrigin(0.5).setDepth(5)

    this.enemyIntentTxt = addPixelText(
      this,
      this.enemyArenaX,
      ENEMY_ARENA_Y - 18 * ENEMY_SCALE,
      '',
      { fontSize: '8px', color: '#ffcc66' },
    ).setOrigin(0.5).setDepth(5)

    this.redrawEnemyQueue()
  }

  private drawPerspectivePath(cx: number, topY: number, botY: number) {
    this.pathGfx.clear()
    this.pathGfx.fillStyle(0x2a2a3a, 1)
    this.pathGfx.fillTriangle(cx - 20, topY, cx + 20, topY, cx + 80, botY)
    this.pathGfx.fillTriangle(cx - 20, topY, cx - 80, botY, cx + 80, botY)
  }

  private drawCharacter(
    x: number,
    y: number,
    scale: number,
    color: number,
  ): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(3)
    g.fillStyle(color, 1)
    g.fillCircle(x, y - 10 * scale, 10 * scale)
    g.fillRoundedRect(x - 8 * scale, y, 16 * scale, 20 * scale, 2)
    return g
  }

  private redrawEnemyQueue() {
    for (const g of this.queueGfx) g.destroy()
    this.queueGfx = []
    for (let i = 1; i < this.wave.length; i++) {
      const g = this.add.graphics().setDepth(2)
      g.fillStyle(0x884444, 0.8)
      g.fillCircle(QUEUE_X, ENEMY_ARENA_Y + (i - 1) * QUEUE_STEP_Y, 6)
      this.queueGfx.push(g)
    }
  }

  private drawBars() {
    const { width } = this.cameras.main
    this.heroHpBar = new HealthBar(
      this,
      this.heroArenaX - HERO_BAR_W / 2,
      HERO_ARENA_Y - 48,
      HERO_BAR_W,
      BAR_H,
      this.state.maxHp,
      0x44cc66,
      charName(this.state.characterName),
    )
    this.heroHpBar.setValue(this.state.hp)

    this.heroDefBar = new HealthBar(
      this,
      this.heroArenaX - HERO_BAR_W / 2,
      HERO_ARENA_Y - 36,
      HERO_BAR_W,
      6,
      DEF_MAX,
      0x4488cc,
      t('combat.defense'),
    )
    this.heroDefBar.setValue(this.state.heroShield)

    this.enemyHpBar = new HealthBar(
      this,
      this.enemyArenaX - ENEMY_BAR_W / 2,
      ENEMY_ARENA_Y - 48,
      ENEMY_BAR_W,
      BAR_H,
      this.enemy.maxHp,
      0xcc4444,
      enemyName(this.enemy.templateId),
    )

    this.statusTxt = addPixelText(this, width / 2, 28, '', {
      fontSize: '8px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(8)
    this.updateStatusTxt()
  }

  private bindEnemyBars() {
    this.enemyHpBar.setMax(this.enemy.maxHp)
    this.enemyHpBar.setValue(this.enemy.hp)
    this.enemyHpBar.setDefense(this.enemy.shield)
  }

  private applyHeroShieldBar() {
    if (this.state.heroShield > DEF_MAX) this.heroDefBar.setMax(this.state.heroShield)
    this.heroDefBar.setValue(this.state.heroShield)
    this.heroHpBar.setValue(this.state.hp)
  }

  private updateStatusTxt() {
    const parts: string[] = []
    if (this.state.heroPoison > 0) parts.push(`P${this.state.heroPoison}`)
    if (this.enemy.poison > 0) parts.push(`eP${this.enemy.poison}`)
    this.statusTxt.setText(parts.join(' · '))
  }

  private drawCardUi() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    const slotY = height - 168
    const handY = height - 70

    addPixelText(this, cx, slotY - 28, t('combat.slots'), {
      fontSize: '8px',
      color: '#aaaaaa',
    }).setOrigin(0.5)

    const n = this.state.actionSlots
    const gap = 8
    const totalW = n * CardSprite.WIDTH + (n - 1) * gap
    const startX = cx - totalW / 2 + CardSprite.WIDTH / 2
    this.slotSprites = Array.from({ length: n }, () => null)
    this.slotZones = []
    for (let i = 0; i < n; i++) {
      const x = startX + i * (CardSprite.WIDTH + gap)
      const rect = this.add
        .rectangle(x, slotY, CardSprite.WIDTH, CardSprite.HEIGHT, 0x1a1a28, 0.9)
        .setStrokeStyle(1, 0x555566)
        .setDepth(4)
        .setInteractive({ useHandCursor: true })
      rect.on('pointerdown', () => this.onSlotTap(i))
      this.slotZones.push(rect)
    }

    this.previewTxt = addPixelText(this, cx, slotY + CardSprite.HEIGHT / 2 + 14, '', {
      fontSize: '8px',
      color: '#dddddd',
    }).setOrigin(0.5).setDepth(8)

    const btnY = handY - CardSprite.HEIGHT / 2 - 18
    this.endTurnTxt = addPixelText(this, cx, btnY, t('combat.endTurn'), {
      fontSize: '12px',
      color: '#88cc88',
    }).setOrigin(0.5).setDepth(8)
    const zone = minZoneSize(80, 20, 28)
    this.endTurnBtn = this.add
      .zone(cx, btnY, zone.w, zone.h)
      .setInteractive({ useHandCursor: true })
      .setDepth(8)
    this.endTurnBtn.on('pointerdown', () => this.onEndTurn())

    addPixelText(this, 8, handY - CardSprite.HEIGHT / 2 - 14, charName(this.state.characterName), {
      fontSize: '8px',
      color: '#88aacc',
    }).setDepth(8)
  }

  private refreshHandUi() {
    for (const s of this.handSprites) s.destroy()
    this.handSprites = []
    const { width, height } = this.cameras.main
    const handY = height - 70
    const n = this.deck.hand.length
    if (n === 0) return
    const gap = 4
    const totalW = n * CardSprite.WIDTH + (n - 1) * gap
    const startX = width / 2 - totalW / 2 + CardSprite.WIDTH / 2
    this.deck.hand.forEach((card, i) => {
      const sprite = new CardSprite(
        this,
        startX + i * (CardSprite.WIDTH + gap),
        handY,
        card,
      )
      sprite.setDepth(10)
      sprite.onTap = () => this.onHandTap(card.id)
      this.handSprites.push(sprite)
    })
  }

  private refreshSlotUi() {
    for (let i = 0; i < this.slotSprites.length; i++) {
      this.slotSprites[i]?.destroy()
      this.slotSprites[i] = null
    }
    const { width, height } = this.cameras.main
    const slotY = height - 168
    const n = this.state.actionSlots
    const gap = 8
    const totalW = n * CardSprite.WIDTH + (n - 1) * gap
    const startX = width / 2 - totalW / 2 + CardSprite.WIDTH / 2
    for (let i = 0; i < n; i++) {
      const card = this.deck.slots[i]
      if (!card) continue
      const sprite = new CardSprite(
        this,
        startX + i * (CardSprite.WIDTH + gap),
        slotY,
        card,
      )
      sprite.setDepth(12)
      sprite.setSelected(true)
      sprite.onTap = () => this.onSlotTap(i)
      this.slotSprites[i] = sprite
    }
  }

  private onHandTap(cardId: string) {
    if (this.attacking) return
    if (!playFromHand(this.deck, cardId)) return
    AudioSystem.play('select')
    this.refreshHandUi()
    this.refreshSlotUi()
    this.updatePreview()
  }

  private onSlotTap(index: number) {
    if (this.attacking) return
    if (!unplaySlot(this.deck, index)) return
    AudioSystem.play('ui')
    this.refreshHandUi()
    this.refreshSlotUi()
    this.updatePreview()
  }

  private updatePreview() {
    const cards = slottedCards(this.deck)
    const p = previewCards(cards)
    const parts: string[] = []
    if (p.damage) parts.push(`ATK ${p.damage}`)
    if (p.poison) parts.push(`VEN ${p.poison}`)
    if (p.shield) parts.push(`ESC ${p.shield}`)
    if (p.heal) parts.push(`CUR ${p.heal}`)
    this.previewTxt.setText(parts.length ? parts.join(' · ') : t('combat.pickCards'))
  }

  private previewEnemyIntent() {
    const choice = EnemyAI.choosePlays(
      this.enemyDeck.hand,
      this.enemy.actionSlots,
      {
        hp: this.enemy.hp,
        maxHp: this.enemy.maxHp,
        shield: this.enemy.shield,
        poison: this.enemy.poison,
      },
      {
        hp: this.state.hp,
        maxHp: this.state.maxHp,
        shield: this.state.heroShield,
        poison: this.state.heroPoison,
      },
    )
    const p = EnemyAI.previewChoice(choice)
    const parts: string[] = []
    if (p.damage) parts.push(`${p.damage}`)
    if (p.poison) parts.push(`P${p.poison}`)
    this.enemyIntentTxt.setText(parts.length ? parts.join('/') : '…')
  }

  private enableInput() {
    this.attacking = false
    this.endTurnBtn.setInteractive({ useHandCursor: true })
    this.endTurnTxt.setColor('#88cc88')
    this.endTurnTxt.setText(t('combat.endTurn'))
  }

  private disableInput() {
    this.attacking = true
    this.endTurnBtn.disableInteractive()
    this.endTurnTxt.setColor('#666666')
  }

  private onEndTurn() {
    if (this.attacking) return
    const played = slottedCards(this.deck)
    if (played.length === 0) return
    this.disableInput()
    AudioSystem.play('attack')

    // Poison tick on enemy at start of our resolve (their start-of-turn already done)
    const hero = toFighter(
      this.state.hp,
      this.state.maxHp,
      this.state.heroShield,
      this.state.heroPoison,
      this.state.bonusDmgFlat,
    )
    const foe = toFighter(
      this.enemy.hp,
      this.enemy.maxHp,
      this.enemy.shield,
      this.enemy.poison,
    )

    const result = CombatEngine.resolvePlayerTurn(played, this.state, hero, foe)
    this.state.hp = hero.hp
    this.state.heroShield = hero.shield
    this.state.heroPoison = hero.poison
    this.enemy.hp = foe.hp
    this.enemy.shield = foe.shield
    this.enemy.poison = foe.poison

    if (result.applied.damage > 0) {
      DamageNumbers.show(this, this.enemyArenaX, ENEMY_ARENA_Y - 48, result.applied.damage, '#ff4444')
      this.shakeTarget(this.enemyGfx)
      AudioSystem.play('hit')
    }
    if (result.applied.heal > 0) {
      DamageNumbers.show(this, this.heroArenaX, HERO_ARENA_Y - 48, result.applied.heal, '#66ff99')
    }
    this.applyHeroShieldBar()
    this.bindEnemyBars()
    this.updateStatusTxt()

    endTurnDraw(this.deck)
    this.refreshHandUi()
    this.refreshSlotUi()
    this.updatePreview()

    if (!this.enemy.alive) {
      this.time.delayedCall(400, () => this.onEnemyKilled())
      return
    }

    if (this.enemy.skill === 'split') {
      this.enemy.bonusDef += 2
    }

    this.time.delayedCall(450, () => this.runEnemyTurn())
  }

  private runEnemyTurn() {
    this.endTurnTxt.setText(t('combat.enemyTurn'))

    const enemyActor = {
      hp: this.enemy.hp,
      maxHp: this.enemy.maxHp,
      shield: this.enemy.shield,
      poison: this.enemy.poison,
    }
    const pDmg = CombatEngine.startTurnPoison(enemyActor)
    this.enemy.hp = enemyActor.hp
    this.enemy.poison = enemyActor.poison
    if (pDmg > 0) {
      DamageNumbers.show(this, this.enemyArenaX, ENEMY_ARENA_Y - 40, pDmg, '#88cc44')
      this.bindEnemyBars()
    }
    if (!this.enemy.alive) {
      this.time.delayedCall(300, () => this.onEnemyKilled())
      return
    }

    const choice = EnemyAI.choosePlays(
      this.enemyDeck.hand,
      this.enemy.actionSlots,
      {
        hp: this.enemy.hp,
        maxHp: this.enemy.maxHp,
        shield: this.enemy.shield,
        poison: this.enemy.poison,
      },
      {
        hp: this.state.hp,
        maxHp: this.state.maxHp,
        shield: this.state.heroShield,
        poison: this.state.heroPoison,
      },
    )

    // Visually move chosen cards into "slots" briefly
    for (const c of choice) {
      playFromHand(this.enemyDeck, c.id)
    }

    this.time.delayedCall(500, () => {
      const hero = toFighter(
        this.state.hp,
        this.state.maxHp,
        this.state.heroShield,
        this.state.heroPoison,
      )
      const foe = toFighter(
        this.enemy.hp,
        this.enemy.maxHp,
        this.enemy.shield,
        this.enemy.poison,
      )
      const result = CombatEngine.resolveTurn(choice, foe, hero)

      this.state.hp = hero.hp
      this.state.heroShield = hero.shield
      this.state.heroPoison = hero.poison
      this.enemy.hp = foe.hp
      this.enemy.shield = foe.shield
      this.enemy.poison = foe.poison

      if (result.applied.damage > 0) {
        DamageNumbers.show(this, this.heroArenaX, HERO_ARENA_Y - 48, result.applied.damage, '#ff4444')
        this.shakeTarget(this.heroGfx)
        AudioSystem.play('hit')
      }
      this.applyHeroShieldBar()
      this.bindEnemyBars()
      this.updateStatusTxt()

      if (this.enemy.skill === 'steal' && result.applied.damage > 0) {
        const stolen = Math.min(5, this.state.coins)
        this.state.coins -= stolen
      }

      endTurnDraw(this.enemyDeck)

      if (this.state.hp <= 0) {
        trySecondWind(this.state)
        this.applyHeroShieldBar()
        if (this.state.hp <= 0) {
          this.time.delayedCall(300, () => this.onHeroKilled())
          return
        }
      }

      // Hero poison tick at start of next player turn
      const heroActor = {
        hp: this.state.hp,
        maxHp: this.state.maxHp,
        shield: this.state.heroShield,
        poison: this.state.heroPoison,
      }
      const hPoison = CombatEngine.startTurnPoison(heroActor)
      this.state.hp = heroActor.hp
      this.state.heroPoison = heroActor.poison
      if (hPoison > 0) {
        DamageNumbers.show(this, this.heroArenaX, HERO_ARENA_Y - 40, hPoison, '#88cc44')
        this.applyHeroShieldBar()
      }
      this.updateStatusTxt()

      if (this.state.hp <= 0) {
        this.time.delayedCall(300, () => this.onHeroKilled())
        return
      }

      SaveSystem.save('quicksave', this.state)
      this.previewEnemyIntent()
      this.enableInput()
    })
  }

  private onHeroKilled() {
    SaveSystem.abandonQuicksave()
    AudioSystem.play('ko')
    this.time.delayedCall(400, () => {
      this.scene.start('GameOverScene', { runState: this.state, victory: false })
    })
  }

  private onEnemyKilled() {
    applyPassiveOnKill(this.state)
    this.applyHeroShieldBar()
    SaveSystem.save('quicksave', this.state)
    AudioSystem.play('ko')

    const koTxt = addPixelText(this, this.enemyArenaX, ENEMY_ARENA_Y - 48, t('combat.ko'), {
      fontSize: '16px',
      color: '#ffcc44',
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: [this.enemyGfx, this.enemyNameText, this.enemyIntentTxt, koTxt],
      alpha: 0,
      y: '-=24',
      duration: 320,
      onComplete: () => {
        koTxt.destroy()
        this.wave.shift()
        if (this.wave.length === 0) {
          if (this.state.pendingRewardTier === 'boss') {
            this.scene.start('RewardScene', { runState: this.state })
            return
          }
          const souls = rollCombatSouls(
            this.state.pendingRewardTier,
            this.state.floor,
          )
          this.state.coins += souls
          SaveSystem.save('quicksave', this.state)
          this.scene.start('ShopScene', {
            runState: this.state,
            postCombat: true,
            soulsGained: souls,
          })
          return
        }
        this.enemy = this.wave[0]!
        this.spawnNextEnemy()
      },
    })
  }

  private spawnNextEnemy() {
    this.enemyDeck = createCombatDeck(this.enemy.deckDefs, this.enemy.actionSlots)
    fillHand(this.enemyDeck)
    this.enemyGfx.destroy()
    this.enemyGfx = this.drawCharacter(this.enemyArenaX, ENEMY_ARENA_Y, ENEMY_SCALE, 0xcc6666)
    this.enemyNameText.setText(enemyName(this.enemy.templateId))
    this.enemyNameText.setAlpha(1)
    this.enemyIntentTxt.setAlpha(1)
    this.bindEnemyBars()
    this.redrawEnemyQueue()
    this.previewEnemyIntent()
    this.enableInput()
  }

  private shakeTarget(target: Phaser.GameObjects.Graphics) {
    const rest = this.shakeRests.get(target) ?? { x: target.x, y: target.y }
    this.shakeRests.set(target, rest)
    this.shakeTimers.get(target)?.remove(false)
    const start = this.time.now
    const duration = 180
    const intensity = 3
    const event = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = this.time.now - start
        if (t >= duration) {
          target.x = rest.x
          target.y = rest.y
          this.shakeRests.delete(target)
          this.shakeTimers.delete(target)
          event.remove()
          return
        }
        const damp = 1 - t / duration
        target.x = rest.x + (Math.random() * 2 - 1) * intensity * damp
        target.y = rest.y + (Math.random() * 2 - 1) * intensity * damp
      },
    })
    this.shakeTimers.set(target, event)
  }
}

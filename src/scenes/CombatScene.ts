import Phaser from 'phaser'
import { getRunState, effectiveRerollMax, applyPassiveOnKill, trySecondWind } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { HealthBar } from '../ui/HealthBar'
import { DieSprite, abilityColor } from '../ui/DieSprite'
import { DamageNumbers } from '../ui/DamageNumbers'
import { addPixelText } from '../ui/pixelText'
import {
  CombatPowerCard,
  formulaTokensFromParts,
  type FormulaToken,
} from '../ui/CombatPowerCard'
import { Enemy } from '../domain/enemies/Enemy'
import { EnemyAI } from '../domain/enemies/EnemyAI'
import { CombatEngine, type ComboCalloutKey } from '../domain/combat/CombatEngine'
import type { RunState } from '../domain/progression/RunState'
import { rollCombatSouls } from '../domain/progression/CombatRewards'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { charName, enemyName, t, type TranslationKey } from '../i18n/I18n'
import { minZoneSize } from '../ui/touchTarget'
import { addBackButton } from '../ui/BackButton'
import { showConfirmModal } from '../ui/ConfirmModal'
import { preferReducedMotion } from '../systems/Device'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { TutorialBanner } from '../ui/TutorialBanner'
import { rollDie } from '../domain/dice/Die'
import {
  emptyOutcome,
  mergeOutcomes,
  resolveTriggers,
  type TriggerOutcome,
  type TriggerContext,
  type DieTrigger,
} from '../domain/dice/DiceAbilities'

const DIE_SIZE = 24
const DIE_GAP = 6
const DEF_COLOR = 0x4488cc
const DEF_MAX = 18
/** Arena: enemy far (small/high), hero near (large/low). Bars sit above heads. */
const ENEMY_ARENA_Y = 72
const HERO_ARENA_Y = 158
const ENEMY_SCALE = 0.7
const HERO_SCALE = 1.2
const QUEUE_X = 22
const QUEUE_STEP_Y = 18
const ENEMY_BAR_W = 100
const HERO_BAR_W = 130
const BAR_H = 9
const DODGE_CHANCE = 0.01

type DiceGroup = 'atk'

/** h: 0–360, s/v: 0–1 → 0xRRGGBB */
function hsvToRgb(h: number, s: number, v: number): number {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const R = Math.round((r + m) * 255)
  const G = Math.round((g + m) * 255)
  const B = Math.round((b + m) * 255)
  return (R << 16) | (G << 8) | B
}

function comboSfx(key: ComboCalloutKey): Parameters<typeof AudioSystem.play>[0] {
  switch (key) {
    case 'combat.combo.awesome': return 'combo2'
    case 'combat.combo.triple': return 'combo3'
    case 'combat.combo.super': return 'combo4'
    case 'combat.combo.hyper': return 'combo5'
    case 'combat.combo.brutal': return 'combo6'
    case 'combat.combo.master': return 'combo7'
    case 'combat.combo.killer': return 'combo8'
    case 'combat.combo.king': return 'combo9'
    case 'combat.combo.monster': return 'comboMonster'
  }
}

export class CombatScene extends Phaser.Scene {
  private state!: RunState
  private enemy!: Enemy
  private wave: Enemy[] = []

  private heroHpBar!: HealthBar
  private heroDefBar!: HealthBar
  private enemyHpBar!: HealthBar

  private atkDice: DieSprite[] = []

  private atkRerollBtn!: Phaser.GameObjects.Zone
  private atkRerollTxt!: Phaser.GameObjects.Text

  private attackBtnBg!: Phaser.GameObjects.Graphics
  private attackBtnTxt!: Phaser.GameObjects.Text
  private attackBtnZone!: Phaser.GameObjects.Zone
  private attacking = false
  private powerCard!: CombatPowerCard

  private heroGfx!: Phaser.GameObjects.Graphics
  private enemyGfx!: Phaser.GameObjects.Graphics
  private enemyNameText!: Phaser.GameObjects.Text
  private enemyNextDmgTxt!: Phaser.GameObjects.Text
  private queueGfx: Phaser.GameObjects.Graphics[] = []
  private pathGfx!: Phaser.GameObjects.Graphics
  private shakeTimers = new Map<object, Phaser.Time.TimerEvent>()
  private shakeRests = new Map<object, { x: number; y: number }>()

  private btnX = 0
  private btnY = 0
  private btnW = 0
  private btnH = 0

  private rerolls = { atk: 4 }
  private rerollsSpentThisTurn = 0
  private turnOutcome: TriggerOutcome = emptyOutcome()
  private triggerCtx: TriggerContext = {
    rerolledIds: [],
    rerollsSpent: 0,
    used: new Map(),
    activationsThisTurn: 0,
  }
  private heroArenaX = 135
  private enemyArenaX = 135
  private pendingHeroDef = 0
  private pendingEnemyAtk: number[] = []
  private rerollHintShown = false
  private rerollHintTxt: Phaser.GameObjects.Text | null = null
  private rerollHintTimer: Phaser.Time.TimerEvent | null = null
  private lastCalloutKey: ComboCalloutKey | null = null
  private calloutTxt: Phaser.GameObjects.Text | null = null
  private diceRowY = 0
  private rainbowTimer: Phaser.Time.TimerEvent | null = null
  private rainbowHue = 0
  private abandonOpen = false

  constructor() {
    super('CombatScene')
  }

  init() {
    this.atkDice = []
    this.wave = []
    this.queueGfx = []
    this.attacking = false
    this.rerollsSpentThisTurn = 0
    this.turnOutcome = emptyOutcome()
    this.triggerCtx = {
      rerolledIds: [],
      rerollsSpent: 0,
      used: new Map(),
      activationsThisTurn: 0,
    }
    this.pendingHeroDef = 0
    this.pendingEnemyAtk = []
    this.rerollHintShown = false
    this.rerollHintTxt = null
    this.rerollHintTimer = null
    this.lastCalloutKey = null
    this.calloutTxt = null
    this.diceRowY = 0
    this.rainbowTimer?.remove(false)
    this.rainbowTimer = null
    this.rainbowHue = 0
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
    this.enemy = this.wave[0]
    this.rerolls = { ...effectiveRerollMax(this.state) }
    this.rerollsSpentThisTurn = 0
    this.resetTriggerState()

    this.drawSection1()
    this.drawSection2()
    this.drawSection3()
    this.preRollAll(() => this.enableAttack())

    addBackButton(this, () => this.promptAbandonFight(), { labelKey: 'combat.esc' })

    bindSceneKeys(this, {
      'keydown-ESC': () => this.promptAbandonFight(),
    })
  }

  /** Leaving mid-fight ends the run: wipe quicksave and go to defeat. */
  private promptAbandonFight() {
    if (this.abandonOpen) return
    this.abandonOpen = true
    showConfirmModal(this, {
      title: t('combat.abandonTitle'),
      body: t('combat.abandonBody'),
      confirmLabel: t('combat.abandonConfirm'),
      cancelLabel: t('combat.abandonCancel'),
      onCancel: () => {
        this.abandonOpen = false
      },
      onConfirm: () => {
        this.abandonOpen = false
        SaveSystem.abandonQuicksave()
        this.scene.start('GameOverScene', { runState: this.state, victory: false })
      },
    })
  }

  // ── Section 1: Camino (vertical, perspectiva) ─────────────

  private drawSection1() {
    const { width } = this.cameras.main
    const cx = width / 2
    this.heroArenaX = cx
    this.enemyArenaX = cx
    const enemyY = ENEMY_ARENA_Y
    const heroY = HERO_ARENA_Y

    const sky = this.add.graphics()
    sky.fillStyle(0x1a1a2e, 1)
    sky.fillRect(0, 0, width, heroY + 20)

    this.pathGfx = this.add.graphics()
    this.drawPerspectivePath(cx, enemyY - 4, heroY + 6)

    this.heroGfx = this.add.graphics().setDepth(3)
    this.drawCharacter(this.heroGfx, cx, heroY, 0x4488cc, HERO_SCALE)
    addPixelText(this, cx, heroY - 34 * HERO_SCALE, charName(this.state.characterName), {
      fontSize: '8px', color: '#cceeff',
    }).setOrigin(0.5).setDepth(4)

    this.redrawEnemyQueue()

    this.enemyGfx = this.add.graphics()
    this.enemyGfx.setDepth(2)
    this.drawCharacter(this.enemyGfx, cx, enemyY, 0xcc4444, ENEMY_SCALE)
    this.enemyNameText = addPixelText(
      this, cx, enemyY - 34 * ENEMY_SCALE, enemyName(this.enemy.templateId), {
        fontSize: '8px', color: '#ffcccc',
      },
    ).setOrigin(0.5).setDepth(4)

    this.enemyNextDmgTxt = addPixelText(this, cx + 28, enemyY - 18 * ENEMY_SCALE, '', {
      fontSize: '16px', color: '#ff8866',
    }).setOrigin(0, 0.5).setDepth(4)
  }

  /** Trapezoid path: narrow far (enemy) → wide near (hero). */
  private drawPerspectivePath(cx: number, topY: number, botY: number) {
    const topHalf = 7
    const botHalf = 18
    this.pathGfx.fillStyle(0x2a2a1e, 1)
    this.pathGfx.beginPath()
    this.pathGfx.moveTo(cx - topHalf, topY)
    this.pathGfx.lineTo(cx + topHalf, topY)
    this.pathGfx.lineTo(cx + botHalf, botY)
    this.pathGfx.lineTo(cx - botHalf, botY)
    this.pathGfx.closePath()
    this.pathGfx.fillPath()
    this.pathGfx.fillStyle(0x1a1a12, 1)
    this.pathGfx.fillRect(cx - botHalf - 4, botY, (botHalf + 4) * 2, 8)

    this.pathGfx.lineStyle(1, 0x333322, 0.45)
    const steps = 5
    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const y = topY + (botY - topY) * t
      const half = topHalf + (botHalf - topHalf) * t
      this.pathGfx.beginPath()
      this.pathGfx.moveTo(cx - half + 2, y)
      this.pathGfx.lineTo(cx + half - 2, y)
      this.pathGfx.strokePath()
    }
  }

  /** Upcoming foes stacked vertically on the left (smaller = farther). */
  private redrawEnemyQueue() {
    for (const g of this.queueGfx) g.destroy()
    this.queueGfx = []

    const upcoming = this.wave.slice(1)
    for (let i = 0; i < upcoming.length; i++) {
      const g = this.add.graphics()
      g.setAlpha(Math.max(0.35, 0.85 - i * 0.15))
      g.setDepth(1)
      const scale = Math.max(0.45, ENEMY_SCALE - i * 0.08)
      this.drawCharacter(
        g,
        QUEUE_X,
        ENEMY_ARENA_Y + 8 + i * QUEUE_STEP_Y,
        0xaa5555,
        scale,
      )
      this.queueGfx.push(g)
    }
  }

  private bindEnemyBars() {
    this.enemyHpBar.setMax(this.enemy.maxHp)
    this.enemyHpBar.setValue(this.enemy.hp)
    this.enemyHpBar.setDefense(this.enemy.totalDefense)
    this.enemyNameText.setText(enemyName(this.enemy.templateId))
  }

  private drawCharacter(
    g: Phaser.GameObjects.Graphics,
    x: number,
    baseY: number,
    color: number,
    scale = 1,
  ) {
    const bodyW = 10 * scale
    const bodyH = 14 * scale
    const headR = 4 * scale
    g.fillStyle(color, 1)
    g.fillRoundedRect(x - bodyW / 2, baseY - bodyH, bodyW, bodyH, 2 * scale)
    g.fillStyle(color, 0.8)
    g.fillCircle(x, baseY - bodyH - headR * 0.4, headR)
  }

  // ── Section 2: enemy bars above head; hero bars below feet ─

  private drawSection2() {
    const cx = this.cameras.main.width / 2
    const barH = BAR_H

    // Enemy HP above the far fighter; DEF is flat armor (label), not a shield bar.
    const enemyBarX = cx - ENEMY_BAR_W / 2
    let y = 8
    this.enemyHpBar = new HealthBar(
      this, enemyBarX, y, ENEMY_BAR_W, barH,
      this.enemy.maxHp, 0xcc4444, '',
    )
    this.enemyHpBar.setDepth(5)
    this.enemyHpBar.setValue(this.enemy.hp)
    this.enemyHpBar.setDefense(this.enemy.totalDefense)

    // Hero bars where ATACAR used to sit (under the hero)
    const heroBarX = cx - HERO_BAR_W / 2
    y = HERO_ARENA_Y + 14
    this.heroHpBar = new HealthBar(
      this, heroBarX, y, HERO_BAR_W, barH,
      this.state.maxHp, 0x44aa44, '',
    )
    this.heroHpBar.setDepth(5)
    this.heroHpBar.setValue(this.state.hp)

    y += barH + 3
    this.heroDefBar = new HealthBar(
      this, heroBarX, y, HERO_BAR_W, barH, DEF_MAX, DEF_COLOR, '',
    )
    this.heroDefBar.setDepth(5)
    this.heroDefBar.setValue(0)

    // Attack button is created inside the dice panel (drawSection3).
    this.btnW = 72
    this.btnH = 18
    this.btnX = cx - this.btnW / 2
    this.btnY = y + barH + 10
  }

  private redrawAttackBtnDefault() {
    this.attackBtnBg.clear()
    this.attackBtnBg.fillStyle(0x333344, 1)
    this.attackBtnBg.fillRoundedRect(this.btnX, this.btnY, this.btnW, this.btnH, 3)
    this.attackBtnBg.lineStyle(1, 0x555577, 1)
    this.attackBtnBg.strokeRoundedRect(this.btnX, this.btnY, this.btnW, this.btnH, 3)
  }

  private redrawAttackBtnHover() {
    this.attackBtnBg.clear()
    this.attackBtnBg.fillStyle(0x444466, 1)
    this.attackBtnBg.fillRoundedRect(this.btnX, this.btnY, this.btnW, this.btnH, 3)
    this.attackBtnBg.lineStyle(1, 0x666688, 1)
    this.attackBtnBg.strokeRoundedRect(this.btnX, this.btnY, this.btnW, this.btnH, 3)
  }

  // ── Section 3: Panel with ATACAR + compact DAÑO/DEF + dice ──

  private drawSection3() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    const panelY = this.btnY
    const panelH = Math.max(150, height - panelY - 16)
    const panel = this.add.graphics().setDepth(4)
    panel.fillStyle(0x12121c, 0.85)
    panel.fillRoundedRect(8, panelY, width - 16, panelH, 4)
    panel.lineStyle(1, 0x333344, 1)
    panel.strokeRoundedRect(8, panelY, width - 16, panelH, 4)

    // ATACAR sits at the top of the card
    this.btnY = panelY + 6
    this.btnX = cx - this.btnW / 2

    this.attackBtnBg = this.add.graphics().setDepth(6)
    this.redrawAttackBtnDefault()

    this.attackBtnTxt = addPixelText(this, cx, this.btnY + this.btnH / 2, t('combat.attack'), {
      fontSize: '8px', color: '#ffffff',
    }).setOrigin(0.5).setDepth(6)

    const atkZone = minZoneSize(this.btnW, this.btnH, 28)
    this.attackBtnZone = this.add
      .zone(cx, this.btnY + this.btnH / 2, atkZone.w, atkZone.h)
      .setInteractive({ useHandCursor: true })
      .setDepth(6)

    this.attackBtnZone.on('pointerover', () => this.redrawAttackBtnHover())
    this.attackBtnZone.on('pointerout', () => {
      if (!this.attacking) this.redrawAttackBtnDefault()
    })
    this.attackBtnZone.on('pointerdown', () => this.onAttack())

    const cardTop = this.btnY + this.btnH + 12
    this.powerCard = new CombatPowerCard(
      this,
      cx,
      cardTop,
      width - 32,
      t('combat.damage'),
      t('combat.defense'),
    )

    this.diceRowY = cardTop + CombatPowerCard.HEIGHT + 46
    const labelY = cardTop + CombatPowerCard.HEIGHT + 8
    const rerollY = this.diceRowY + DIE_SIZE + 2

    addPixelText(this, cx, labelY, 'ATK', {
      fontSize: '8px', color: '#bbbbbb',
    }).setOrigin(0.5, 0).setDepth(7)

    const atkCount = this.state.dice.length
    this.atkDice = this.createDiceRow(cx, this.diceRowY, atkCount)
    this.atkDice.forEach((d, i) => {
      d.setDepth(6)
      d.setAlpha(1)
      d.runIndex = i
      const runDie = this.state.dice[i]!
      d.setFaces(runDie.faces)
      d.setAbility(abilityColor(runDie.abilityId))
      d.onReroll = () => this.rerollSingleDie(d, 'atk')
    })

    this.atkRerollTxt = addPixelText(this, cx, rerollY, `[R] x${this.rerolls.atk}`, {
      fontSize: '8px', color: '#888888',
    }).setOrigin(0.5, 0).setDepth(6)

    const rZone = minZoneSize(40, 16, 28)
    this.atkRerollBtn = this.add
      .zone(cx, rerollY + 4, rZone.w, rZone.h)
      .setInteractive({ useHandCursor: true })
      .setDepth(5)
    this.atkRerollBtn.on('pointerdown', () => this.rerollGroup('atk'))
  }

  /** Roll + silent AI rerolls; show next-turn damage beside the enemy. */
  private precalculateEnemyAttack() {
    const count = this.enemy.atkDiceCount
    let values = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
    let left = this.enemy.rerollMax
    while (left > 0) {
      const idx = EnemyAI.chooseRerollIndex(values)
      if (idx === null) break
      values = values.map((v, i) => (i === idx ? Math.floor(Math.random() * 6) + 1 : v))
      left--
    }
    this.pendingEnemyAtk = values

    const power = CombatEngine.computePower(values)
    let dmg = power.total
    const nextTurn = this.enemy.turnCount + 1
    if (this.enemy.skill === 'slam' && nextTurn % 2 === 0) dmg *= 2
    this.enemyNextDmgTxt.setText(`${dmg}`)
    this.enemyNextDmgTxt.setAlpha(1)
  }

  private createDiceRow(cx: number, y: number, count: number): DieSprite[] {
    const totalW = count * DIE_SIZE + (count - 1) * DIE_GAP
    const startX = cx - totalW / 2 + DIE_SIZE / 2
    const dice: DieSprite[] = []
    for (let i = 0; i < count; i++) {
      dice.push(new DieSprite(this, startX + i * (DIE_SIZE + DIE_GAP), y, DIE_SIZE))
    }
    return dice
  }

  // ── Reroll system ─────────────────────────────────────────

  private resetTriggerState() {
    this.turnOutcome = emptyOutcome()
    this.triggerCtx = {
      rerolledIds: [],
      rerollsSpent: 0,
      used: new Map(),
      activationsThisTurn: 0,
    }
  }

  private fireTrigger(
    trigger: DieTrigger,
    rerolledIds: string[] = [],
  ): TriggerOutcome {
    this.triggerCtx.rerolledIds = rerolledIds
    this.triggerCtx.rerollsSpent = this.rerollsSpentThisTurn
    const values = this.atkDice.map(d => d.value)
    const out = resolveTriggers(
      trigger,
      this.state.dice,
      values,
      this.triggerCtx,
    )
    this.turnOutcome = mergeOutcomes(this.turnOutcome, out)
    if (out.bonusRerolls > 0) {
      this.rerolls.atk += out.bonusRerolls
    }
    // Flat heal outside of attack resolution applies immediately and must not
    // be re-applied by CombatEngine.resolve.
    if (out.heal > 0 && trigger !== 'onAttack' && trigger !== 'onCombo') {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + out.heal)
      this.heroHpBar?.setValue(this.state.hp)
      this.turnOutcome.heal -= out.heal
    }
    // Flash dice that just fired
    if (
      out.bonusDamage > 0 ||
      out.bonusShield > 0 ||
      out.heal > 0 ||
      out.bonusRerolls > 0 ||
      out.atkMultPct > 0 ||
      out.overkillHealPct > 0 ||
      out.defTierUp ||
      out.highFaceDouble
    ) {
      this.atkDice.forEach((sprite, i) => {
        const die = this.state.dice[i]
        if (die?.abilityId) sprite.flashAbility()
      })
    }
    return out
  }

  private preRollAll(onDone?: () => void) {
    this.attacking = true
    this.setRerollButtonsEnabled(false)
    this.attackBtnZone?.disableInteractive()
    this.attackBtnTxt?.setText('...')

    const all = [...this.atkDice]
    if (all.length === 0) {
      this.precalculateEnemyAttack()
      onDone?.()
      return
    }

    const finals = this.state.dice.map(d => rollDie(d))
    AudioSystem.play('dice')
    let done = 0
    all.forEach((d, i) => {
      this.time.delayedCall(i * 35, () => {
        d.roll(finals[i]!, () => {
          done++
          if (done >= all.length) {
            this.fireTrigger('onRoll')
            this.updateCombos()
            this.precalculateEnemyAttack()
            this.updateRerollLabels()
            onDone?.()
          }
        })
      })
    })
  }

  /** Spend a reroll charge. */
  private trySpendReroll(group: DiceGroup): boolean {
    if (this.rerolls[group] <= 0) return false
    this.rerolls[group]--
    this.rerollsSpentThisTurn++
    this.triggerCtx.rerollsSpent = this.rerollsSpentThisTurn
    if (this.rerolls[group] === 0) {
      this.fireTrigger('onLastReroll')
    }
    return true
  }

  private rerollGroup(group: DiceGroup) {
    if (this.attacking) return
    if (!this.trySpendReroll(group)) return

    this.stopRainbowBorders()
    this.dismissRerollHint()
    this.updateRerollLabels()
    this.updatePreviews()
    AudioSystem.play('reroll')

    const dice = this.atkDice
    const rerolledIds = this.state.dice.map(d => d.id)
    const finals = this.state.dice.map(d => rollDie(d))
    let done = 0
    dice.forEach((d, i) => {
      d.roll(finals[i]!, () => {
        done++
        if (done >= dice.length) {
          this.fireTrigger('onReroll', rerolledIds)
          this.fireTrigger('onKeep', rerolledIds)
          this.updateCombos()
        }
      })
    })
  }

  private rerollSingleDie(die: DieSprite, group: DiceGroup) {
    if (this.attacking) return
    if (!this.trySpendReroll(group)) return

    this.stopRainbowBorders()
    this.dismissRerollHint()
    this.updateRerollLabels()
    this.updatePreviews()
    AudioSystem.play('reroll')

    const runDie = this.state.dice[die.runIndex]
    if (!runDie) return
    const finalValue = rollDie(runDie)
    const rerolledIds = [runDie.id]
    die.roll(finalValue, () => {
      this.fireTrigger('onReroll', rerolledIds)
      this.fireTrigger('onKeep', rerolledIds)
      this.updateCombos()
    })
  }

  private updateCombos() {
    this.highlightCombos(this.atkDice)
    this.updatePreviews()
    this.maybeShowComboCallout()
  }

  private maybeShowComboCallout() {
    const vals = this.atkDice.map(d => d.value)
    const tier = CombatEngine.comboTier(vals)
    if (!tier.calloutKey) {
      this.lastCalloutKey = null
      return
    }
    if (tier.calloutKey === this.lastCalloutKey) return
    this.lastCalloutKey = tier.calloutKey
    this.showComboCallout(tier.calloutKey, tier.bestMatch, tier.isMonster)
  }

  private showComboCallout(
    key: ComboCalloutKey,
    bestMatch: number,
    isMonster: boolean,
  ) {
    this.calloutTxt?.destroy()
    const { width } = this.cameras.main
    const intensity = isMonster ? 7 : Math.min(6, 2 + bestMatch)
    // Sit just above the dice row.
    const calloutY = this.diceRowY - DIE_SIZE / 2 - 10
    const txt = addPixelText(
      this,
      width / 2,
      calloutY,
      t(key as TranslationKey),
      { fontSize: '16px', color: isMonster ? '#ffcc44' : '#ffeeaa' },
    ).setOrigin(0.5).setDepth(60).setAlpha(0)

    this.calloutTxt = txt
    AudioSystem.play(comboSfx(key))

    for (const d of this.atkDice) this.shakeTarget(d, intensity, 280)

    this.tweens.add({
      targets: txt,
      alpha: 1,
      y: calloutY - 6,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: txt,
          alpha: 0,
          y: txt.y - 8,
          delay: 900,
          duration: 320,
          onComplete: () => {
            txt.destroy()
            if (this.calloutTxt === txt) this.calloutTxt = null
          },
        })
      },
    })
  }

  private updatePreviews() {
    const atkVals = this.atkDice.map(d => d.value)

    const atk = CombatEngine.heroAtkTotal(
      atkVals,
      this.state,
      this.turnOutcome,
    )
    const defInfo = CombatEngine.computeDefense(atkVals, {
      defTierUp: this.turnOutcome.defTierUp,
    })
    const rollDef = CombatEngine.heroDefTotal(
      atkVals,
      this.state,
      this.turnOutcome,
    )
    const defTotal = this.pendingHeroDef + rollDef
    const enemyDef = this.enemy.totalDefense
    const rawDamage = Math.max(1, atk.total - enemyDef)
    const heavy = this.state.passives.includes('heavy_hit')
    const finalDamage = rawDamage + (heavy ? 2 : 0) + this.state.bonusDmgFlat

    const atkSum = atkVals.reduce((a, b) => a + b, 0)
    const dicePower = atk.power.total
    const atkTokens: FormulaToken[] = []
    // Dice value × combo multiplier (honest: sum × (power/sum) = power)
    atkTokens.push({ text: String(atkSum), color: '#cccccc' })
    if (atkSum > 0 && dicePower > atkSum) {
      const mult = dicePower / atkSum
      const multStr = Number.isInteger(mult)
        ? String(mult)
        : (Math.round(mult * 10) / 10).toFixed(1)
      atkTokens.push({ text: ' × ', color: '#99aacc' })
      atkTokens.push({ text: multStr, color: '#cccccc' })
    }
    if (atk.bonusDamage > 0) {
      atkTokens.push({ text: ' + ', color: '#66cc66' })
      atkTokens.push({ text: String(atk.bonusDamage), color: '#cccccc' })
    }
    if (atk.atkMultPct > 0) {
      const multBonus = Math.floor(atk.power.total * (atk.atkMultPct / 100))
      if (multBonus > 0) {
        atkTokens.push({ text: ' + ', color: '#66cc66' })
        atkTokens.push({ text: String(multBonus), color: '#cccccc' })
      }
    }
    if (enemyDef > 0) {
      atkTokens.push({ text: ' - ', color: '#cc6666' })
      atkTokens.push({ text: String(enemyDef), color: '#cccccc' })
    }
    if (heavy) {
      atkTokens.push({ text: ' + ', color: '#66cc66' })
      atkTokens.push({ text: '2', color: '#cccccc' })
    }
    if (this.state.bonusDmgFlat > 0) {
      atkTokens.push({ text: ' + ', color: '#66cc66' })
      atkTokens.push({ text: String(this.state.bonusDmgFlat), color: '#cccccc' })
    }

    const defParts: string[] = []
    if (this.pendingHeroDef > 0) defParts.push(`${this.pendingHeroDef}`)
    defParts.push(...defInfo.parts)
    if (this.state.passives.includes('iron_skin')) defParts.push('+2')
    if (this.state.bonusDefFlat > 0) defParts.push(`+${this.state.bonusDefFlat}`)
    if (this.turnOutcome.bonusShield > 0) {
      defParts.push(`+${this.turnOutcome.bonusShield}`)
    }

    this.powerCard.setDamage(finalDamage, atkTokens)
    this.powerCard.setDefense(defTotal, formulaTokensFromParts(defParts))
  }

  private setHeroDef(value: number) {
    if (value > DEF_MAX) this.heroDefBar.setMax(value)
    this.heroDefBar.setValue(value)
  }

  private highlightCombos(dice: DieSprite[]) {
    // One distinct color per face that forms a combo (pair+).
    const FACE_COLORS: Record<number, number> = {
      1: 0x66ccff,
      2: 0x66ee88,
      3: 0xffee66,
      4: 0xff9944,
      5: 0xee66cc,
      6: 0x7788ff,
    }
    const counts = new Map<number, number>()
    for (const d of dice) {
      counts.set(d.value, (counts.get(d.value) ?? 0) + 1)
    }

    const allSame =
      dice.length >= 2 &&
      counts.size === 1 &&
      (counts.values().next().value ?? 0) >= 2

    if (allSame) {
      this.startRainbowBorders(dice)
      return
    }

    this.stopRainbowBorders()
    for (const d of dice) {
      const count = counts.get(d.value) ?? 1
      if (count >= 2) d.setComboBorder(FACE_COLORS[d.value] ?? 0xccaa44)
      else d.setComboBorder(null)
    }
  }

  private startRainbowBorders(dice: DieSprite[]) {
    if (!this.rainbowTimer) {
      this.rainbowHue = 0
      this.rainbowTimer = this.time.addEvent({
        delay: 70,
        loop: true,
        callback: () => {
          this.rainbowHue = (this.rainbowHue + 18) % 360
          const color = hsvToRgb(this.rainbowHue, 0.85, 1)
          for (const d of this.atkDice) d.setComboBorder(color)
        },
      })
    }
    const color = hsvToRgb(this.rainbowHue, 0.85, 1)
    for (const d of dice) d.setComboBorder(color)
  }

  private stopRainbowBorders() {
    this.rainbowTimer?.remove(false)
    this.rainbowTimer = null
  }

  private setDiceInteractive(_group: DiceGroup, on: boolean) {
    for (const d of this.atkDice) d.setDiceInteractive(on)
  }

  private updateRerollLabels() {
    const count = this.rerolls.atk
    const canReroll = count > 0
    this.atkRerollTxt.setText(`[R] x${count}`)
    if (!canReroll) {
      this.atkRerollTxt.setColor('#555555')
      this.atkRerollBtn.disableInteractive()
    } else {
      this.atkRerollTxt.setColor('#dddddd')
      this.atkRerollBtn.setInteractive({ useHandCursor: true })
    }

    this.setDiceInteractive('atk', canReroll && !this.attacking)
  }

  // ── Combat flow ───────────────────────────────────────────

  private onAttack() {
    if (this.attacking) return
    this.attacking = true
    this.dismissRerollHint()
    this.attackBtnTxt.setText('...')
    this.attackBtnZone.disableInteractive()
    this.setRerollButtonsEnabled(false)
    AudioSystem.play('attack')

    const atkVals = this.atkDice.map(d => d.value)
    const tier = CombatEngine.comboTier(atkVals)
    if (tier.calloutKey) this.fireTrigger('onCombo')
    this.fireTrigger('onAttack')

    this.atkDice.forEach(d => d.highlight(true))
    this.time.delayedCall(200, () => {
      this.atkDice.forEach(d => d.highlight(false))
      this.resolveCombatValues(atkVals)
    })
  }

  private resolveCombatValues(atkVals: number[]) {
    const result = CombatEngine.resolve(
      atkVals,
      this.enemy,
      this.state,
      this.pendingHeroDef,
      this.turnOutcome,
    )
    this.pendingHeroDef = result.defTotal
    this.setHeroDef(result.defTotal)
    this.enemyHpBar.setDefense(this.enemy.totalDefense)
    this.updatePreviews()

    const enemyX = this.enemyArenaX
    const floatY = ENEMY_ARENA_Y - 48

    if (result.phaseBlocked) {
      AudioSystem.play('block')
      addPixelText(this, enemyX, floatY, t('combat.phase'), {
        fontSize: '16px', color: '#aa88ff',
      }).setOrigin(0.5).setDepth(50)
    } else {
      AudioSystem.play('hit')
      if (result.atkCombo > 0) {
        DamageNumbers.show(this, enemyX, floatY - 10, result.atkCombo, '#ffaa00')
      }
      DamageNumbers.show(this, enemyX, floatY + 4, result.finalDamage, '#ff4444')
      if (result.heal > 0) {
        DamageNumbers.show(
          this,
          this.heroArenaX,
          HERO_ARENA_Y - 48,
          result.heal,
          '#66ff99',
        )
        this.heroHpBar.setValue(this.state.hp)
      }
      this.tweens.add({
        targets: this.enemyGfx,
        alpha: 0.3, yoyo: true, duration: 80, repeat: 2,
      })
      this.shakeTarget(this.enemyGfx)
    }

    this.enemyHpBar.setValue(this.enemy.hp)

    if (result.killed) {
      this.time.delayedCall(500, () => this.onEnemyKilled())
      return
    }

    this.time.delayedCall(500, () => this.runEnemyTurn())
  }

  private runEnemyTurn() {
    this.attackBtnTxt.setText(t('combat.enemyTurn'))
    AudioSystem.play('dice')
    this.time.delayedCall(450, () => {
      if (Math.random() < DODGE_CHANCE) {
        this.playDodgeRoll()
      } else {
        this.resolveEnemyAttack()
      }
    })
  }

  /** 1% chance: player rolls a die; 4–6 negates the enemy hit. */
  private playDodgeRoll() {
    const die = new DieSprite(
      this,
      this.heroArenaX + 36,
      HERO_ARENA_Y - 24,
      DIE_SIZE,
    )
    die.setDepth(45)
    die.setDiceInteractive(false)
    die.setAlpha(1)

    const face = Math.floor(Math.random() * 6) + 1
    AudioSystem.play('dice')
    die.roll(face, () => {
      this.time.delayedCall(180, () => {
        if (face >= 4) {
          AudioSystem.play('dodge')
          const label = addPixelText(
            this,
            this.heroArenaX,
            HERO_ARENA_Y - 56,
            t('combat.dodge'),
            { fontSize: '16px', color: '#88ffcc' },
          ).setOrigin(0.5).setDepth(50)
          this.shakeTarget(this.heroGfx, 3, 200)
          this.tweens.add({
            targets: [die, label],
            alpha: 0,
            y: '-=12',
            delay: 320,
            duration: 260,
            onComplete: () => {
              die.destroy()
              label.destroy()
              this.resetPlayerTurn()
            },
          })
        } else {
          const label = addPixelText(
            this,
            this.heroArenaX,
            HERO_ARENA_Y - 56,
            t('combat.dodgeFail'),
            { fontSize: '8px', color: '#aaaaaa' },
          ).setOrigin(0.5).setDepth(50)
          this.tweens.add({
            targets: [die, label],
            alpha: 0,
            duration: 200,
            delay: 160,
            onComplete: () => {
              die.destroy()
              label.destroy()
              this.resolveEnemyAttack()
            },
          })
        }
      })
    })
  }

  private resolveEnemyAttack() {
    const atkVals = this.pendingEnemyAtk
    const eResult = CombatEngine.enemyAttack(
      atkVals,
      this.pendingHeroDef,
      this.enemy,
    )

    const heroX = this.heroArenaX
    const floatY = HERO_ARENA_Y - 56

    DamageNumbers.show(
      this,
      heroX,
      floatY + 4,
      eResult.damage,
      eResult.blocked >= eResult.damage ? '#88aacc' : '#ff8844',
    )

    AudioSystem.play(eResult.overflow > 0 ? 'hurt' : 'block')

    this.tweens.add({
      targets: this.heroGfx,
      alpha: 0.3, yoyo: true, duration: 80, repeat: 2,
    })
    this.shakeTarget(this.heroGfx)

    this.pendingHeroDef = eResult.remainingDef
    this.setHeroDef(eResult.remainingDef)
    this.updatePreviews()

    const applyHp = () => {
      if (eResult.overflow > 0) {
        this.state.hp = Math.max(0, this.state.hp - eResult.overflow)
        this.heroHpBar.setValue(this.state.hp)
        if (this.enemy.skill === 'steal') {
          const stolen = CombatEngine.applySteal(this.state, eResult.overflow)
          if (stolen > 0) {
            addPixelText(this, heroX, floatY - 8, `-${stolen}g`, {
              fontSize: '8px', color: '#ffcc44',
            }).setOrigin(0.5).setDepth(50)
          }
        }
        trySecondWind(this.state)
        this.heroHpBar.setValue(this.state.hp)
      }

      this.time.delayedCall(450, () => {
        if (this.state.hp <= 0) {
          this.onHeroKilled()
        } else {
          this.resetPlayerTurn()
        }
      })
    }

    if (eResult.overflow > 0) {
      this.time.delayedCall(220, applyHp)
    } else {
      applyHp()
    }
  }

  private onHeroKilled() {
    SaveSystem.save('quicksave', this.state)
    this.time.delayedCall(400, () => {
      this.scene.start('GameOverScene', { runState: this.state })
    })
  }

  private onEnemyKilled() {
    const enemyRestX = this.enemyArenaX

    this.fireTrigger('onKill')
    applyPassiveOnKill(this.state)
    this.heroHpBar.setValue(this.state.hp)
    SaveSystem.save('quicksave', this.state)
    AudioSystem.play('ko')

    const koTxt = addPixelText(this, enemyRestX, ENEMY_ARENA_Y - 48, t('combat.ko'), {
      fontSize: '16px', color: '#ffcc44',
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: [this.enemyGfx, this.enemyNameText, this.enemyNextDmgTxt, koTxt],
      alpha: 0,
      y: '-=24',
      duration: 320,
      ease: 'Cubic.easeIn',
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
        this.enemy = this.wave[0]
        this.spawnNextEnemy()
      },
    })
  }

  private spawnNextEnemy() {
    const enemyX = this.enemyArenaX
    const baseY = ENEMY_ARENA_Y

    this.enemyGfx.clear()
    this.enemyGfx.setAlpha(1)
    this.enemyGfx.setDepth(2)
    this.enemyGfx.x = 0
    this.enemyGfx.y = -24
    this.drawCharacter(this.enemyGfx, enemyX, baseY, 0xcc4444, ENEMY_SCALE)

    this.enemyNameText.setText(enemyName(this.enemy.templateId))
    this.enemyNameText.setAlpha(1)
    this.enemyNameText.setPosition(enemyX, ENEMY_ARENA_Y - 34 * ENEMY_SCALE - 20)

    this.enemyNextDmgTxt.setAlpha(1)
    this.enemyNextDmgTxt.setPosition(enemyX + 28, ENEMY_ARENA_Y - 18 * ENEMY_SCALE - 20)

    this.bindEnemyBars()
    this.redrawEnemyQueue()
    this.updatePreviews()

    this.tweens.add({
      targets: this.enemyGfx,
      y: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
    })
    this.tweens.add({
      targets: this.enemyNameText,
      y: ENEMY_ARENA_Y - 34 * ENEMY_SCALE,
      duration: 280,
      ease: 'Cubic.easeOut',
    })
    this.tweens.add({
      targets: this.enemyNextDmgTxt,
      y: ENEMY_ARENA_Y - 18 * ENEMY_SCALE,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => this.resetPlayerTurn(),
    })
  }

  private resetPlayerTurn() {
    this.rerolls = { ...effectiveRerollMax(this.state) }
    this.rerollsSpentThisTurn = 0
    this.resetTriggerState()
    this.setHeroDef(this.pendingHeroDef)
    this.enemyHpBar.setDefense(this.enemy.totalDefense)
    this.lastCalloutKey = null
    this.preRollAll(() => this.enableAttack())
  }

  private enableAttack() {
    this.attacking = false
    this.attackBtnTxt.setText(t('combat.attack'))
    this.attackBtnZone.setInteractive({ useHandCursor: true })
    this.redrawAttackBtnDefault()
    this.setRerollButtonsEnabled(true)
    if (!this.rerollHintShown) {
      this.rerollHintShown = true
      if (!MetaProgression.isTutorialDone() && this.state.floor === 1) {
        const tip = new TutorialBanner(this)
        tip.show('tutorial.combat', () => {
          tip.destroy()
          this.showRerollHint()
        })
      } else {
        this.showRerollHint()
      }
    }
  }

  private showRerollHint() {
    const { width } = this.cameras.main
    this.rerollHintTxt = addPixelText(
      this,
      width / 2,
      this.btnY + this.btnH + 4,
      t('combat.rerollHint'),
      { fontSize: '8px', color: '#ffeeaa' },
    ).setOrigin(0.5).setDepth(30)

    if (!preferReducedMotion()) {
      this.tweens.add({
        targets: [this.atkRerollTxt],
        alpha: 0.3,
        yoyo: true,
        repeat: 5,
        duration: 220,
      })

      const demo = this.atkDice[0]
      if (demo) {
        demo.setComboBorder(0xffcc44)
        this.tweens.add({
          targets: demo,
          scaleX: 1.18,
          scaleY: 1.18,
          yoyo: true,
          repeat: 4,
          duration: 220,
          onComplete: () => {
            demo.setScale(1)
            if (!this.attacking) this.updateCombos()
          },
        })
      }
    }

    this.rerollHintTimer = this.time.delayedCall(
      preferReducedMotion() ? 1800 : 3200,
      () => this.dismissRerollHint(),
    )
  }

  private dismissRerollHint() {
    this.rerollHintTimer?.remove(false)
    this.rerollHintTimer = null
    this.tweens.killTweensOf([this.atkRerollTxt])
    this.atkRerollTxt?.setAlpha(1)
    if (this.atkDice[0]) {
      this.tweens.killTweensOf(this.atkDice[0])
      this.atkDice[0].setScale(1)
    }
    const txt = this.rerollHintTxt
    this.rerollHintTxt = null
    if (txt) {
      this.tweens.add({
        targets: txt,
        alpha: 0,
        duration: 180,
        onComplete: () => txt.destroy(),
      })
    }
  }

  private shakeTarget(
    target: Phaser.GameObjects.GameObject & { x: number; y: number },
    intensity = 4,
    duration = 220,
  ) {
    if (preferReducedMotion()) {
      intensity = Math.min(intensity, 2)
      duration = Math.min(duration, 120)
    }
    this.shakeTimers.get(target)?.remove(false)
    // Keep the first rest position if a shake is restarted mid-flight.
    let rest = this.shakeRests.get(target)
    if (!rest) {
      rest = { x: target.x, y: target.y }
      this.shakeRests.set(target, rest)
    }

    const start = this.time.now
    const event = this.time.addEvent({
      delay: preferReducedMotion() ? 40 : 28,
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

  private setRerollButtonsEnabled(on: boolean) {
    if (!on) this.atkRerollBtn.disableInteractive()
    if (on) {
      this.updateRerollLabels()
    } else {
      this.setDiceInteractive('atk', false)
    }
  }
}

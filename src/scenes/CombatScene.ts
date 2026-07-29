import Phaser from 'phaser'
import { getRunState, effectiveRerollMax, applyPassiveOnKill, trySecondWind } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { HealthBar } from '../ui/HealthBar'
import { DieSprite } from '../ui/DieSprite'
import { DamageNumbers } from '../ui/DamageNumbers'
import { addPixelText } from '../ui/pixelText'
import { Enemy } from '../domain/enemies/Enemy'
import { EnemyAI } from '../domain/enemies/EnemyAI'
import { CombatEngine } from '../domain/combat/CombatEngine'
import type { RunState } from '../domain/progression/RunState'
import { rollCombatSouls } from '../domain/progression/CombatRewards'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { charName, enemyName, t } from '../i18n/I18n'
import { enableTouchTarget, minZoneSize } from '../ui/touchTarget'
import { preferReducedMotion } from '../systems/Device'

const DIE_SIZE = 16
const DIE_GAP = 5
const DEF_COLOR = 0x4488cc
const DEF_MAX = 18
/** Path band Y — kept above HP bars (sectY ≈ 110). */
const GROUND_Y = 84
const ENEMY_X_OFFSET = 60
const QUEUE_STEP_X = 10
const QUEUE_STEP_Y = -7

type DiceGroup = 'atk'

export class CombatScene extends Phaser.Scene {
  private state!: RunState
  private enemy!: Enemy
  private wave: Enemy[] = []

  private heroHpBar!: HealthBar
  private heroDefBar!: HealthBar
  private enemyHpBar!: HealthBar
  private enemyDefBar!: HealthBar

  private atkDice: DieSprite[] = []
  private enemyAtkDice: DieSprite[] = []

  private atkRerollBtn!: Phaser.GameObjects.Zone
  private atkRerollTxt!: Phaser.GameObjects.Text
  private enemyRerollTxt!: Phaser.GameObjects.Text
  private enemyDmgTxt!: Phaser.GameObjects.Text
  private enemyComboTxt!: Phaser.GameObjects.Text
  private enemyLabelTxt!: Phaser.GameObjects.Text

  private attackBtnBg!: Phaser.GameObjects.Graphics
  private attackBtnTxt!: Phaser.GameObjects.Text
  private attackBtnZone!: Phaser.GameObjects.Zone
  private attacking = false
  private dmgPreviewTxt!: Phaser.GameObjects.Text
  private defPreviewTxt!: Phaser.GameObjects.Text
  private atkComboTxt!: Phaser.GameObjects.Text
  private defComboTxt!: Phaser.GameObjects.Text

  private heroGfx!: Phaser.GameObjects.Graphics
  private enemyGfx!: Phaser.GameObjects.Graphics
  private enemyNameText!: Phaser.GameObjects.Text
  private queueGfx: Phaser.GameObjects.Graphics[] = []
  private pathGfx!: Phaser.GameObjects.Graphics
  private shakeTimers = new Map<object, Phaser.Time.TimerEvent>()

  private btnX = 0
  private btnY = 0
  private btnW = 0
  private btnH = 0

  private rerolls = { atk: 4 }
  private enemyRerollsLeft = 0
  private enemyDiceX = 390
  private diceRowY = 214
  private pendingHeroDef = 0
  private rerollHintShown = false
  private rerollHintTxt: Phaser.GameObjects.Text | null = null
  private rerollHintTimer: Phaser.Time.TimerEvent | null = null

  constructor() {
    super('CombatScene')
  }

  init() {
    this.atkDice = []
    this.enemyAtkDice = []
    this.wave = []
    this.queueGfx = []
    this.attacking = false
    this.pendingHeroDef = 0
    this.rerollHintShown = false
    this.rerollHintTxt = null
    this.rerollHintTimer = null
    this.shakeTimers.clear()
    this.children.removeAll(true)
  }

  create() {
    const { width, height } = this.cameras.main

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

    this.drawSection1()
    this.drawSection2()
    this.drawSection3()
    this.preRollAll(() => this.enableAttack())

    const escTxt = addPixelText(this, width / 2, height - 8, t('combat.esc'), {
      fontSize: '8px', color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(10)
    enableTouchTarget(escTxt, { min: 28 })
    escTxt.on('pointerover', () => escTxt.setColor('#ffffff'))
    escTxt.on('pointerout', () => escTxt.setColor('#aaaaaa'))
    escTxt.on('pointerdown', () =>
      this.scene.start('MapScene', { runState: this.state }),
    )

    bindSceneKeys(this, {
      'keydown-ESC': () =>
        this.scene.start('MapScene', { runState: this.state }),
    })
  }

  // ── Section 1: Camino ─────────────────────────────────────

  private drawSection1() {
    const { width } = this.cameras.main
    const groundY = GROUND_Y
    const enemyX = width - ENEMY_X_OFFSET

    const sky = this.add.graphics()
    sky.fillStyle(0x1a1a2e, 1)
    sky.fillRect(0, 0, width, groundY - 4)

    this.pathGfx = this.add.graphics()
    this.pathGfx.fillStyle(0x2a2a1e, 1)
    this.pathGfx.fillRect(0, groundY - 4, width, 4)
    this.pathGfx.fillStyle(0x1a1a12, 1)
    this.pathGfx.fillRect(0, groundY, width, 16)

    this.pathGfx.lineStyle(1, 0x333322, 0.5)
    for (let x = 40; x < width - 40; x += 60) {
      this.pathGfx.beginPath()
      this.pathGfx.moveTo(x, groundY)
      this.pathGfx.lineTo(x, groundY + 6)
      this.pathGfx.strokePath()
    }

    this.heroGfx = this.add.graphics()
    this.drawCharacter(this.heroGfx, 60, groundY - 14, 0x4488cc)
    addPixelText(this, 60, groundY - 22, charName(this.state.characterName), {
      fontSize: '8px', color: '#cceeff',
    }).setOrigin(0.5)

    this.redrawEnemyQueue()

    this.enemyGfx = this.add.graphics()
    this.enemyGfx.setDepth(2)
    this.drawCharacter(this.enemyGfx, enemyX, groundY - 14, 0xcc4444)
    this.enemyNameText = addPixelText(this, enemyX, groundY - 22, enemyName(this.enemy.templateId), {
      fontSize: '8px', color: '#ffcccc',
    }).setOrigin(0.5).setDepth(2)
  }

  /** Upcoming foes stacked behind current: next → last, offset up/right. */
  private redrawEnemyQueue() {
    for (const g of this.queueGfx) g.destroy()
    this.queueGfx = []

    const { width } = this.cameras.main
    const enemyX = width - ENEMY_X_OFFSET
    const baseY = GROUND_Y - 14
    const upcoming = this.wave.slice(1)

    // Draw last → next so next sits on top of the stack
    for (let i = upcoming.length - 1; i >= 0; i--) {
      const step = i + 1
      const g = this.add.graphics()
      g.setAlpha(0.75 - i * 0.15)
      g.setDepth(1)
      this.drawCharacter(
        g,
        enemyX + step * QUEUE_STEP_X,
        baseY + step * QUEUE_STEP_Y,
        0xaa5555,
      )
      this.queueGfx.push(g)
    }
  }

  private bindEnemyBars() {
    this.enemyHpBar.setMax(this.enemy.maxHp)
    this.enemyHpBar.setValue(this.enemy.hp)
    this.enemyDefBar.setMax(Math.max(this.enemy.defense + 4, 8))
    this.enemyDefBar.setValue(this.enemy.totalDefense)
    this.enemyNameText.setText(enemyName(this.enemy.templateId))
  }

  private drawCharacter(
    g: Phaser.GameObjects.Graphics,
    x: number,
    baseY: number,
    color: number,
  ) {
    g.fillStyle(color, 1)
    g.fillRoundedRect(x - 5, baseY - 14, 10, 14, 2)
    g.fillStyle(color, 0.8)
    g.fillCircle(x, baseY - 17, 4)
  }

  // ── Section 2: HP + DEF bars + attack ─────────────────────

  private drawSection2() {
    const { width } = this.cameras.main
    const sectY = 110
    const cx = width / 2
    const barW = 140
    const barH = 14

    const hpY = sectY + 4
    this.heroHpBar = new HealthBar(
      this, 12, hpY, barW, barH,
      this.state.maxHp, 0x44aa44, '',
    )
    this.heroHpBar.setValue(this.state.hp)

    this.enemyHpBar = new HealthBar(
      this, width - 152, hpY, barW, barH,
      this.enemy.maxHp, 0xcc4444, '',
    )
    this.enemyHpBar.setValue(this.enemy.hp)

    const defY = hpY + barH + 6
    this.heroDefBar = new HealthBar(
      this, 12, defY, barW, barH, DEF_MAX, DEF_COLOR, '',
    )
    this.heroDefBar.setValue(0)

    this.enemyDefBar = new HealthBar(
      this, width - 152, defY, barW, barH,
      Math.max(this.enemy.defense + 4, 8), DEF_COLOR, '',
    )
    this.enemyDefBar.setValue(this.enemy.totalDefense)

    // Attack button centered between HP and DEF rows
    this.btnW = 56
    this.btnH = 18
    this.btnX = cx - this.btnW / 2
    this.btnY = hpY + (defY + barH - hpY - this.btnH) / 2

    this.attackBtnBg = this.add.graphics()
    this.redrawAttackBtnDefault()

    this.attackBtnTxt = addPixelText(this, cx, this.btnY + this.btnH / 2, t('combat.attack'), {
      fontSize: '8px', color: '#ffffff',
    }).setOrigin(0.5)

    const atkZone = minZoneSize(this.btnW, this.btnH, 28)
    this.attackBtnZone = this.add
      .zone(cx, this.btnY + this.btnH / 2, atkZone.w, atkZone.h)
      .setInteractive({ useHandCursor: true })

    this.attackBtnZone.on('pointerover', () => this.redrawAttackBtnHover())
    this.attackBtnZone.on('pointerout', () => {
      if (!this.attacking) this.redrawAttackBtnDefault()
    })
    this.attackBtnZone.on('pointerdown', () => this.onAttack())
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

  // ── Section 3: Dice ───────────────────────────────────────

  private drawSection3() {
    const { width } = this.cameras.main
    const panelY = 150
    const panelH = 108
    const panel = this.add.graphics()
    panel.fillStyle(0x12121c, 0.85)
    panel.fillRoundedRect(8, panelY, width - 16, panelH, 4)
    panel.lineStyle(1, 0x333344, 1)
    panel.strokeRoundedRect(8, panelY, width - 16, panelH, 4)

    // Player dice left, enemy right — DEF comes from ATK combos
    const PLAYER_X = 140
    const ENEMY_X = 380
    this.enemyDiceX = ENEMY_X

    const statY = 154
    const breakdownY = 172
    const labelY = 190
    const diceRowY = 214
    const rerollY = 236
    this.diceRowY = diceRowY

    this.dmgPreviewTxt = addPixelText(this, PLAYER_X - 40, statY, 'DMG 0', {
      fontSize: '16px', color: '#ff9999',
    }).setOrigin(0.5, 0)

    this.defPreviewTxt = addPixelText(this, PLAYER_X + 40, statY, 'DEF 0', {
      fontSize: '16px', color: '#99ccff',
    }).setOrigin(0.5, 0)

    this.enemyDmgTxt = addPixelText(this, ENEMY_X, statY, 'DMG -', {
      fontSize: '16px', color: '#ff8866',
    }).setOrigin(0.5, 0)

    this.atkComboTxt = addPixelText(this, PLAYER_X - 40, breakdownY, '', {
      fontSize: '8px', color: '#aa9944',
    }).setOrigin(0.5, 0)

    this.defComboTxt = addPixelText(this, PLAYER_X + 40, breakdownY, '', {
      fontSize: '8px', color: '#8899bb',
    }).setOrigin(0.5, 0)

    this.enemyComboTxt = addPixelText(this, ENEMY_X, breakdownY, '', {
      fontSize: '8px', color: '#aa6644',
    }).setOrigin(0.5, 0)

    const atkCount = this.state.diceLoadout.atk

    addPixelText(this, PLAYER_X, labelY, 'ATK', {
      fontSize: '8px', color: '#bbbbbb',
    }).setOrigin(0.5, 0)

    this.atkDice = this.createDiceRow(PLAYER_X, diceRowY, atkCount)
    this.atkDice.forEach(d => {
      d.onReroll = () => this.rerollSingleDie(d, 'atk')
    })

    this.atkRerollTxt = addPixelText(this, PLAYER_X, rerollY, `[R] x${this.rerolls.atk}`, {
      fontSize: '8px', color: '#888888',
    }).setOrigin(0.5, 0)

    const rZone = minZoneSize(40, 16, 28)
    this.atkRerollBtn = this.add
      .zone(PLAYER_X, rerollY + 4, rZone.w, rZone.h)
      .setInteractive({ useHandCursor: true })
    this.atkRerollBtn.on('pointerdown', () => this.rerollGroup('atk'))

    this.enemyLabelTxt = addPixelText(this, ENEMY_X, labelY, enemyName(this.enemy.templateId), {
      fontSize: '8px', color: '#ffaa88',
    }).setOrigin(0.5, 0)

    this.buildEnemyDice()
    this.enemyRerollsLeft = this.enemy.rerollMax
    this.enemyRerollTxt = addPixelText(
      this, ENEMY_X, rerollY, `[R] x${this.enemyRerollsLeft}`, {
        fontSize: '8px', color: '#886666',
      },
    ).setOrigin(0.5, 0)
    this.setEnemyDiceDimmed(true)
  }

  private buildEnemyDice() {
    for (const d of this.enemyAtkDice) d.destroy()
    this.enemyAtkDice = this.createDiceRow(
      this.enemyDiceX,
      this.diceRowY,
      this.enemy.atkDiceCount,
    )
    for (const d of this.enemyAtkDice) {
      d.onReroll = null
      d.setDiceInteractive(false)
      d.setValue(1)
    }
  }

  private setEnemyDiceDimmed(dim: boolean) {
    const a = dim ? 0.45 : 1
    for (const d of this.enemyAtkDice) d.setAlpha(a)
    this.enemyDmgTxt.setAlpha(a)
    this.enemyComboTxt.setAlpha(a)
    this.enemyLabelTxt.setAlpha(dim ? 0.55 : 1)
    this.enemyRerollTxt.setAlpha(dim ? 0.55 : 1)
    if (dim) {
      this.enemyDmgTxt.setText('DMG -')
      this.enemyComboTxt.setText('')
      this.enemyRerollTxt.setColor('#886666')
    } else {
      this.enemyRerollTxt.setColor('#ffccaa')
    }
  }

  private updateEnemyPreview() {
    const vals = this.enemyAtkDice.map(d => d.value)
    const power = CombatEngine.computePower(vals)
    let dmg = power.total
    const nextTurn = this.enemy.turnCount + 1
    const slam = this.enemy.skill === 'slam' && nextTurn % 2 === 0
    if (slam) dmg *= 2

    this.enemyDmgTxt.setText(`DMG ${dmg}`)
    const sum = vals.reduce((a, b) => a + b, 0)
    const parts = [`${sum}`]
    if (power.combo > 0) parts.push(`+${power.combo}`)
    if (slam) parts.push('x2')
    this.enemyComboTxt.setText(parts.length > 1 || slam ? parts.join('') : '')
  }

  private updateEnemyRerollLabel() {
    this.enemyRerollTxt.setText(`[R] x${this.enemyRerollsLeft}`)
    this.enemyRerollTxt.setColor(this.enemyRerollsLeft > 0 ? '#ffccaa' : '#555555')
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

  private preRollAll(onDone?: () => void) {
    this.attacking = true
    this.setRerollButtonsEnabled(false)
    this.attackBtnZone?.disableInteractive()
    this.attackBtnTxt?.setText('...')

    const all = [...this.atkDice]
    if (all.length === 0) {
      onDone?.()
      return
    }

    const finals = all.map(() => Math.floor(Math.random() * 6) + 1)
    AudioSystem.play('dice')
    let done = 0
    all.forEach((d, i) => {
      this.time.delayedCall(i * 35, () => {
        d.roll(finals[i], () => {
          done++
          if (done >= all.length) {
            this.updateCombos()
            onDone?.()
          }
        })
      })
    })
  }

  private rerollGroup(group: DiceGroup) {
    if (this.attacking) return
    const r = this.rerolls[group]
    if (r <= 0) return

    this.dismissRerollHint()
    this.rerolls[group]--
    this.updateRerollLabels()
    AudioSystem.play('reroll')

    const dice = this.atkDice
    const finals = dice.map(() => Math.floor(Math.random() * 6) + 1)
    let done = 0
    dice.forEach((d, i) => {
      d.roll(finals[i], () => {
        done++
        if (done >= dice.length) this.updateCombos()
      })
    })
  }

  private rerollSingleDie(die: DieSprite, group: DiceGroup) {
    if (this.attacking) return
    if (this.rerolls[group] <= 0) return

    this.dismissRerollHint()
    this.rerolls[group]--
    this.updateRerollLabels()
    AudioSystem.play('reroll')

    const finalValue = Math.floor(Math.random() * 6) + 1
    die.roll(finalValue, () => this.updateCombos())
  }

  private updateCombos() {
    this.highlightCombos(this.atkDice)
    this.updatePreviews()
  }

  private updatePreviews() {
    const atkVals = this.atkDice.map(d => d.value)

    const atk = CombatEngine.computePower(atkVals)
    const defInfo = CombatEngine.computeDefense(atkVals)
    const rollDef = CombatEngine.heroDefTotal(atkVals, this.state)
    const defTotal = this.pendingHeroDef + rollDef
    const enemyDef = this.enemy.totalDefense
    const rawDamage = Math.max(1, atk.total - enemyDef)
    const finalDamage =
      rawDamage +
      (this.state.passives.includes('heavy_hit') ? 2 : 0) +
      this.state.bonusDmgFlat

    const atkSum = atkVals.reduce((a, b) => a + b, 0)

    this.dmgPreviewTxt.setText(`DMG ${finalDamage}`)
    this.defPreviewTxt.setText(`DEF ${defTotal}`)

    const atkParts = [`${atkSum}`]
    if (atk.combo > 0) atkParts.push(`+${atk.combo}`)
    if (enemyDef > 0) atkParts.push(`-${enemyDef}`)
    if (this.state.bonusDmgFlat > 0) atkParts.push(`+${this.state.bonusDmgFlat}`)
    this.atkComboTxt.setText(atkParts.join(''))

    const defParts: string[] = []
    if (this.pendingHeroDef > 0) defParts.push(`${this.pendingHeroDef}`)
    defParts.push(...defInfo.parts)
    if (this.state.passives.includes('iron_skin')) defParts.push('+2')
    if (this.state.bonusDefFlat > 0) defParts.push(`+${this.state.bonusDefFlat}`)
    this.defComboTxt.setText(defParts.join('+'))
  }

  private setHeroDef(value: number) {
    if (value > DEF_MAX) this.heroDefBar.setMax(value)
    this.heroDefBar.setValue(value)
  }

  private highlightCombos(dice: DieSprite[]) {
    const counts = new Map<number, number>()
    for (const d of dice) {
      counts.set(d.value, (counts.get(d.value) ?? 0) + 1)
    }
    for (const d of dice) {
      const count = counts.get(d.value) ?? 1
      if (count >= 4) d.setComboBorder(0xffaa00)
      else if (count >= 3) d.setComboBorder(0xcc6622)
      else if (count >= 2) d.setComboBorder(0xccaa44)
      else d.setComboBorder(null)
    }
  }

  private setDiceInteractive(_group: DiceGroup, on: boolean) {
    for (const d of this.atkDice) d.setDiceInteractive(on)
  }

  private updateRerollLabels() {
    const count = this.rerolls.atk
    this.atkRerollTxt.setText(`[R] x${count}`)
    if (count <= 0) {
      this.atkRerollTxt.setColor('#555555')
      this.atkRerollBtn.disableInteractive()
    } else {
      this.atkRerollTxt.setColor('#dddddd')
      this.atkRerollBtn.setInteractive({ useHandCursor: true })
    }

    this.setDiceInteractive('atk', count > 0 && !this.attacking)
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
    )
    this.pendingHeroDef = result.defTotal
    this.setHeroDef(result.defTotal)
    this.defPreviewTxt.setText(`DEF ${result.defTotal}`)
    this.enemyDefBar.setValue(this.enemy.totalDefense)

    const enemyX = this.cameras.main.width - ENEMY_X_OFFSET
    const floatY = 100

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
      this.tweens.add({
        targets: this.enemyGfx,
        alpha: 0.3, yoyo: true, duration: 80, repeat: 2,
      })
      this.shakeTarget(this.enemyGfx)
    }

    this.dmgPreviewTxt.setText(`DMG ${result.finalDamage}`)
    this.enemyHpBar.setValue(this.enemy.hp)

    if (result.killed) {
      this.time.delayedCall(500, () => this.onEnemyKilled())
      return
    }

    this.time.delayedCall(500, () => this.runEnemyTurn())
  }

  private runEnemyTurn() {
    this.setEnemyDiceDimmed(false)
    this.enemyRerollsLeft = this.enemy.rerollMax
    this.updateEnemyRerollLabel()
    this.attackBtnTxt.setText(t('combat.enemyTurn'))
    AudioSystem.play('dice')

    const finals = this.enemyAtkDice.map(() => Math.floor(Math.random() * 6) + 1)
    let done = 0
    this.enemyAtkDice.forEach((d, i) => {
      d.roll(finals[i], () => {
        done++
        if (done >= this.enemyAtkDice.length) {
          this.highlightCombos(this.enemyAtkDice)
          this.updateEnemyPreview()
          this.time.delayedCall(400, () => this.enemyAiRerollStep())
        }
      })
    })
  }

  private enemyAiRerollStep() {
    const values = this.enemyAtkDice.map(d => d.value)
    const idx =
      this.enemyRerollsLeft > 0 ? EnemyAI.chooseRerollIndex(values) : null

    if (idx === null) {
      this.time.delayedCall(350, () => this.resolveEnemyAttack())
      return
    }

    this.enemyRerollsLeft--
    this.updateEnemyRerollLabel()
    AudioSystem.play('reroll')
    const next = Math.floor(Math.random() * 6) + 1
    this.enemyAtkDice[idx].roll(next, () => {
      this.highlightCombos(this.enemyAtkDice)
      this.updateEnemyPreview()
      this.time.delayedCall(350, () => this.enemyAiRerollStep())
    })
  }

  private resolveEnemyAttack() {
    const atkVals = this.enemyAtkDice.map(d => d.value)
    const eResult = CombatEngine.enemyAttack(
      atkVals,
      this.pendingHeroDef,
      this.enemy,
    )

    const heroX = 60
    const floatY = 100

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

    // Shield updates first, then HP — never looks like HP before DEF
    this.pendingHeroDef = eResult.remainingDef
    this.setHeroDef(eResult.remainingDef)
    this.defPreviewTxt.setText(`DEF ${eResult.remainingDef}`)

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
    const { width } = this.cameras.main
    const enemyRestX = width - ENEMY_X_OFFSET

    applyPassiveOnKill(this.state)
    SaveSystem.save('quicksave', this.state)
    AudioSystem.play('ko')

    const koTxt = addPixelText(this, enemyRestX, 100, t('combat.ko'), {
      fontSize: '16px', color: '#ffcc44',
    }).setOrigin(0.5).setDepth(50)

    this.tweens.add({
      targets: [this.enemyGfx, this.enemyNameText, koTxt],
      alpha: 0,
      x: '+=24',
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
    const { width } = this.cameras.main
    const enemyX = width - ENEMY_X_OFFSET
    const baseY = GROUND_Y - 14

    this.enemyGfx.clear()
    this.enemyGfx.setAlpha(1)
    this.enemyGfx.setDepth(2)
    this.enemyGfx.x = 40
    this.enemyGfx.y = 0
    this.drawCharacter(this.enemyGfx, enemyX, baseY, 0xcc4444)

    this.enemyNameText.setText(enemyName(this.enemy.templateId))
    this.enemyNameText.setAlpha(1)
    this.enemyNameText.setPosition(enemyX + 40, GROUND_Y - 22)

    this.bindEnemyBars()
    this.redrawEnemyQueue()
    this.enemyLabelTxt.setText(enemyName(this.enemy.templateId))
    this.buildEnemyDice()
    this.enemyRerollsLeft = this.enemy.rerollMax
    this.enemyRerollTxt.setText(`[R] x${this.enemyRerollsLeft}`)
    this.setEnemyDiceDimmed(true)
    this.updatePreviews()

    this.tweens.add({
      targets: this.enemyGfx,
      x: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
    })
    this.tweens.add({
      targets: this.enemyNameText,
      x: enemyX,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => this.resetPlayerTurn(),
    })
  }

  private resetPlayerTurn() {
    this.rerolls = { ...effectiveRerollMax(this.state) }
    this.setHeroDef(this.pendingHeroDef)
    this.enemyDefBar.setValue(this.enemy.totalDefense)
    this.enemyRerollsLeft = this.enemy.rerollMax
    this.enemyRerollTxt.setText(`[R] x${this.enemyRerollsLeft}`)
    this.setEnemyDiceDimmed(true)
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
      this.showRerollHint()
    }
  }

  private showRerollHint() {
    const { width } = this.cameras.main
    this.rerollHintTxt = addPixelText(
      this,
      width / 2,
      148,
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
    target.x = 0
    target.y = 0

    const start = this.time.now
    const event = this.time.addEvent({
      delay: preferReducedMotion() ? 40 : 28,
      loop: true,
      callback: () => {
        const t = this.time.now - start
        if (t >= duration) {
          target.x = 0
          target.y = 0
          this.shakeTimers.delete(target)
          event.remove()
          return
        }
        const damp = 1 - t / duration
        target.x = (Math.random() * 2 - 1) * intensity * damp
        target.y = (Math.random() * 2 - 1) * intensity * damp
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

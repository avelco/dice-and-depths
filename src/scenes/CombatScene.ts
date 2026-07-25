import Phaser from 'phaser'
import { getRunState, effectiveRerollMax, applyPassiveOnKill, trySecondWind } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { HealthBar } from '../ui/HealthBar'
import { DieSprite } from '../ui/DieSprite'
import { DamageNumbers } from '../ui/DamageNumbers'
import { addPixelText } from '../ui/pixelText'
import { Enemy } from '../domain/enemies/Enemy'
import { CombatEngine } from '../domain/combat/CombatEngine'
import type { RunState } from '../domain/progression/RunState'

const DIE_SIZE = 14
const DIE_GAP = 4
const DEF_COLOR = 0x4488cc
const DEF_MAX = 18
/** Path band Y — kept above HP bars (sectY ≈ 110). */
const GROUND_Y = 84
const ENEMY_X_OFFSET = 60
const QUEUE_STEP_X = 10
const QUEUE_STEP_Y = -7

type DiceGroup = 'atk' | 'def' | 'mul'

export class CombatScene extends Phaser.Scene {
  private state!: RunState
  private enemy!: Enemy
  private wave: Enemy[] = []

  private heroHpBar!: HealthBar
  private heroDefBar!: HealthBar
  private enemyHpBar!: HealthBar
  private enemyDefBar!: HealthBar

  private atkDice: DieSprite[] = []
  private defDice: DieSprite[] = []
  private mulDice!: DieSprite

  private atkRerollBtn!: Phaser.GameObjects.Zone
  private defRerollBtn!: Phaser.GameObjects.Zone
  private mulRerollBtn!: Phaser.GameObjects.Zone
  private atkRerollTxt!: Phaser.GameObjects.Text
  private defRerollTxt!: Phaser.GameObjects.Text
  private mulRerollTxt!: Phaser.GameObjects.Text

  private attackBtnBg!: Phaser.GameObjects.Graphics
  private attackBtnTxt!: Phaser.GameObjects.Text
  private attackBtnZone!: Phaser.GameObjects.Zone
  private attacking = false
  private dmgPreviewTxt!: Phaser.GameObjects.Text
  private defPreviewTxt!: Phaser.GameObjects.Text
  private atkComboTxt!: Phaser.GameObjects.Text
  private defComboTxt!: Phaser.GameObjects.Text
  private mulPreviewTxt!: Phaser.GameObjects.Text

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

  private rerolls = { atk: 4, def: 3, mul: 1 }

  constructor() {
    super('CombatScene')
  }

  init() {
    this.atkDice = []
    this.defDice = []
    this.wave = []
    this.queueGfx = []
    this.attacking = false
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
    this.preRollAll()

    addPixelText(this, width / 2, height - 8, 'ESC: mapa', {
        fontSize: '8px', color: '#aaaaaa', 
      })
      .setOrigin(0.5).setDepth(10)

    this.input.keyboard!.on('keydown-ESC', () =>
      this.scene.start('MapScene', { runState: this.state }),
    )
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
    addPixelText(this, 60, groundY - 22, this.state.characterName, {
      fontSize: '8px', color: '#cceeff',
    }).setOrigin(0.5)

    this.redrawEnemyQueue()

    this.enemyGfx = this.add.graphics()
    this.enemyGfx.setDepth(2)
    this.drawCharacter(this.enemyGfx, enemyX, groundY - 14, 0xcc4444)
    this.enemyNameText = addPixelText(this, enemyX, groundY - 22, this.enemy.name, {
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
    this.enemyNameText.setText(this.enemy.name)
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

    this.attackBtnTxt = addPixelText(this, cx, this.btnY + this.btnH / 2, 'ATACAR', {
      fontSize: '8px', color: '#ffffff',
    }).setOrigin(0.5)

    this.attackBtnZone = this.add
      .zone(cx, this.btnY + this.btnH / 2, this.btnW, this.btnH)
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

    const ATK_X = 100
    const DEF_X = 240
    const MUL_X = 380

    // Rows with clear gaps — Silkscreen needs ~14px between lines
    const statY = 154
    const breakdownY = 172
    const labelY = 190
    const diceRowY = 212
    const rerollY = 232

    this.dmgPreviewTxt = addPixelText(this, ATK_X, statY, 'DMG 0', {
      fontSize: '16px', color: '#ff9999',
    }).setOrigin(0.5, 0)

    this.defPreviewTxt = addPixelText(this, DEF_X, statY, 'DEF 0', {
      fontSize: '16px', color: '#99ccff',
    }).setOrigin(0.5, 0)

    this.mulPreviewTxt = addPixelText(this, MUL_X, statY, 'x1', {
      fontSize: '16px', color: '#ddcc66',
    }).setOrigin(0.5, 0)

    this.atkComboTxt = addPixelText(this, ATK_X, breakdownY, '', {
      fontSize: '8px', color: '#aa9944',
    }).setOrigin(0.5, 0)

    this.defComboTxt = addPixelText(this, DEF_X, breakdownY, '', {
      fontSize: '8px', color: '#aa9944',
    }).setOrigin(0.5, 0)

    const atkCount = this.state.diceLoadout.atk
    const defCount = this.state.diceLoadout.def

    addPixelText(this, ATK_X, labelY, 'ATK', {
      fontSize: '8px', color: '#bbbbbb',
    }).setOrigin(0.5, 0)

    this.atkDice = this.createDiceRow(ATK_X, diceRowY, atkCount)
    this.atkDice.forEach(d => {
      d.onReroll = () => this.rerollSingleDie(d, 'atk')
    })

    this.atkRerollTxt = addPixelText(this, ATK_X, rerollY, `[R] x${this.rerolls.atk}`, {
      fontSize: '8px', color: '#888888',
    }).setOrigin(0.5, 0)

    this.atkRerollBtn = this.add
      .zone(ATK_X, rerollY + 4, 28, 14)
      .setInteractive({ useHandCursor: true })
    this.atkRerollBtn.on('pointerdown', () => this.rerollGroup('atk'))

    addPixelText(this, DEF_X, labelY, 'DEF', {
      fontSize: '8px', color: '#bbbbbb',
    }).setOrigin(0.5, 0)

    this.defDice = this.createDiceRow(DEF_X, diceRowY, defCount)
    this.defDice.forEach(d => {
      d.onReroll = () => this.rerollSingleDie(d, 'def')
    })

    this.defRerollTxt = addPixelText(this, DEF_X, rerollY, `[R] x${this.rerolls.def}`, {
      fontSize: '8px', color: '#888888',
    }).setOrigin(0.5, 0)

    this.defRerollBtn = this.add
      .zone(DEF_X, rerollY + 4, 28, 14)
      .setInteractive({ useHandCursor: true })
    this.defRerollBtn.on('pointerdown', () => this.rerollGroup('def'))

    addPixelText(this, MUL_X, labelY, 'MUL', {
      fontSize: '8px', color: '#ddcc66',
    }).setOrigin(0.5, 0)

    this.mulDice = this.createDiceRow(MUL_X, diceRowY, 1)[0]
    this.mulDice.onReroll = () => this.rerollSingleDie(this.mulDice, 'mul')

    this.mulRerollTxt = addPixelText(this, MUL_X, rerollY, `[R] x${this.rerolls.mul}`, {
      fontSize: '8px', color: '#888888',
    }).setOrigin(0.5, 0)

    this.mulRerollBtn = this.add
      .zone(MUL_X, rerollY + 4, 28, 14)
      .setInteractive({ useHandCursor: true })
    this.mulRerollBtn.on('pointerdown', () => this.rerollGroup('mul'))
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

  private preRollAll() {
    const all = [...this.atkDice, ...this.defDice, this.mulDice]
    all.forEach(d => d.setValue(Math.floor(Math.random() * 6) + 1))
    this.updateCombos()
  }

  private rerollGroup(group: DiceGroup) {
    if (this.attacking) return
    const r = this.rerolls[group]
    if (r <= 0) return

    this.rerolls[group]--
    this.updateRerollLabels()

    const dice = group === 'atk' ? this.atkDice
      : group === 'def' ? this.defDice : [this.mulDice]
    const finalValues = dice.map(() => Math.floor(Math.random() * 6) + 1)

    let ticks = 0
    const totalTicks = 8
    this.time.addEvent({
      delay: 40,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++
        if (ticks >= totalTicks) {
          dice.forEach((d, i) => d.setValue(finalValues[i]))
          this.updateCombos()
        } else {
          dice.forEach(d => d.setValue(Math.floor(Math.random() * 6) + 1))
        }
      },
    })
  }

  private rerollSingleDie(die: DieSprite, group: DiceGroup) {
    if (this.attacking) return
    if (this.rerolls[group] <= 0) return

    this.rerolls[group]--
    this.updateRerollLabels()

    const finalValue = Math.floor(Math.random() * 6) + 1

    let ticks = 0
    const totalTicks = 8
    this.time.addEvent({
      delay: 40,
      repeat: totalTicks - 1,
      callback: () => {
        ticks++
        if (ticks >= totalTicks) {
          die.setValue(finalValue)
          this.updateCombos()
        } else {
          die.setValue(Math.floor(Math.random() * 6) + 1)
        }
      },
    })
  }

  private updateCombos() {
    this.highlightCombos(this.atkDice)
    this.highlightCombos(this.defDice)
    // mul is a single die, no combos
    this.mulDice.setComboBorder(null)
    this.updatePreviews()
  }

  private updatePreviews() {
    const atkVals = this.atkDice.map(d => d.value)
    const defVals = this.defDice.map(d => d.value)
    const mulVal = this.mulDice.value

    const atk = CombatEngine.computePower(atkVals)
    const defTotal = CombatEngine.heroDefTotal(defVals, this.state)
    const def = CombatEngine.computePower(defVals)
    const enemyDef = this.enemy.totalDefense
    const rawDamage = Math.max(1, atk.total - enemyDef)
    const finalDamage = rawDamage * mulVal + (this.state.passives.includes('heavy_hit') ? 2 : 0)

    const atkSum = atkVals.reduce((a, b) => a + b, 0)
    const defSum = defVals.reduce((a, b) => a + b, 0)

    this.dmgPreviewTxt.setText(`DMG ${finalDamage}`)
    this.defPreviewTxt.setText(`DEF ${defTotal}`)
    this.mulPreviewTxt.setText(`x${mulVal}`)

    // Desglose: suma + combo - def [= raw] (x mul)
    const atkParts = [`${atkSum}`]
    if (atk.combo > 0) atkParts.push(`+${atk.combo}`)
    if (enemyDef > 0) atkParts.push(`-${enemyDef}`)
    let atkBreakdown = atkParts.join('')
    if (mulVal > 1) atkBreakdown = `(${atkBreakdown}) x${mulVal}`
    this.atkComboTxt.setText(atkBreakdown)

    const defParts = [`${defSum}`]
    if (def.combo > 0) defParts.push(`+${def.combo}`)
    if (this.state.passives.includes('iron_skin')) defParts.push('+2')
    this.defComboTxt.setText(defParts.length > 1 ? defParts.join('') : '')
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

  private setDiceInteractive(group: DiceGroup, on: boolean) {
    const dice = group === 'atk' ? this.atkDice
      : group === 'def' ? this.defDice : [this.mulDice]
    for (const d of dice) d.setDiceInteractive(on)
  }

  private updateRerollLabels() {
    const update = (
      txt: Phaser.GameObjects.Text,
      btn: Phaser.GameObjects.Zone,
      count: number,
    ) => {
      txt.setText(`[R] x${count}`)
      if (count <= 0) {
        txt.setColor('#555555')
        btn.disableInteractive()
      } else {
        txt.setColor('#dddddd')
        btn.setInteractive({ useHandCursor: true })
      }
    }

    update(this.atkRerollTxt, this.atkRerollBtn, this.rerolls.atk)
    update(this.defRerollTxt, this.defRerollBtn, this.rerolls.def)
    update(this.mulRerollTxt, this.mulRerollBtn, this.rerolls.mul)

    this.setDiceInteractive('atk', this.rerolls.atk > 0 && !this.attacking)
    this.setDiceInteractive('def', this.rerolls.def > 0 && !this.attacking)
    this.setDiceInteractive('mul', this.rerolls.mul > 0 && !this.attacking)
  }

  // ── Combat flow ───────────────────────────────────────────

  private onAttack() {
    if (this.attacking) return
    this.attacking = true
    this.attackBtnTxt.setText('...')
    this.attackBtnZone.disableInteractive()
    this.setRerollButtonsEnabled(false)

    const atkVals = this.atkDice.map(d => d.value)
    const defVals = this.defDice.map(d => d.value)
    const mulVal = this.mulDice.value

    // brief flash on dice
    const allDice = [...this.atkDice, ...this.defDice, this.mulDice]
    allDice.forEach(d => d.highlight(true))
    this.time.delayedCall(200, () => {
      allDice.forEach(d => d.highlight(false))
      this.resolveCombatValues(atkVals, defVals, mulVal)
    })
  }

  private resolveCombatValues(
    atkVals: number[],
    defVals: number[],
    mulVal: number,
  ) {
    const result = CombatEngine.resolve(atkVals, defVals, mulVal, this.enemy, this.state)
    this.heroDefBar.setValue(result.defTotal)
    this.defPreviewTxt.setText(`DEF ${result.defTotal}`)
    this.enemyDefBar.setValue(this.enemy.totalDefense)

    const enemyX = this.cameras.main.width - ENEMY_X_OFFSET
    const heroX = 60
    const floatY = 100

    if (result.phaseBlocked) {
      addPixelText(this, enemyX, floatY, 'FASE', {
        fontSize: '16px', color: '#aa88ff',
      }).setOrigin(0.5).setDepth(50)
    } else {
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

    this.time.delayedCall(700, () => {
      const eResult = CombatEngine.enemyAttack(
        this.state.floor,
        result.defTotal,
        this.enemy,
      )

      DamageNumbers.show(
        this,
        heroX,
        floatY + 4,
        eResult.damage,
        eResult.blocked >= eResult.damage ? '#88aacc' : '#ff8844',
      )

      this.tweens.add({
        targets: this.heroGfx,
        alpha: 0.3, yoyo: true, duration: 80, repeat: 2,
      })
      this.shakeTarget(this.heroGfx)

      const remainingDef = Math.max(0, result.defTotal - eResult.blocked)
      this.heroDefBar.setValue(remainingDef)
      this.defPreviewTxt.setText(`DEF ${remainingDef}`)

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

      this.time.delayedCall(500, () => {
        if (this.state.hp <= 0) {
          this.onHeroKilled()
        } else {
          this.resetPlayerTurn()
        }
      })
    })
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

    const koTxt = addPixelText(this, enemyRestX, 100, 'KO!', {
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
          this.scene.start('RewardScene', { runState: this.state })
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

    this.enemyNameText.setText(this.enemy.name)
    this.enemyNameText.setAlpha(1)
    this.enemyNameText.setPosition(enemyX + 40, GROUND_Y - 22)

    this.bindEnemyBars()
    this.redrawEnemyQueue()
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
    this.attacking = false
    this.rerolls = { ...effectiveRerollMax(this.state) }
    this.preRollAll()
    this.heroDefBar.setValue(0)
    this.enemyDefBar.setValue(this.enemy.totalDefense)
    this.enableAttack()
  }

  private enableAttack() {
    this.attacking = false
    this.attackBtnTxt.setText('ATACAR')
    this.attackBtnZone.setInteractive({ useHandCursor: true })
    this.redrawAttackBtnDefault()
    this.setRerollButtonsEnabled(true)
  }

  private shakeTarget(
    target: Phaser.GameObjects.GameObject & { x: number; y: number },
    intensity = 4,
    duration = 220,
  ) {
    this.shakeTimers.get(target)?.remove(false)
    target.x = 0
    target.y = 0

    const start = this.time.now
    const event = this.time.addEvent({
      delay: 28,
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
    const btns = [this.atkRerollBtn, this.defRerollBtn, this.mulRerollBtn]
    for (const b of btns) {
      if (!on) b.disableInteractive()
    }
    if (on) {
      this.updateRerollLabels()
    } else {
      this.setDiceInteractive('atk', false)
      this.setDiceInteractive('def', false)
      this.setDiceInteractive('mul', false)
    }
  }
}

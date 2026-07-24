import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { HealthBar } from '../ui/HealthBar'
import { DieSprite } from '../ui/DieSprite'
import { DamageNumbers } from '../ui/DamageNumbers'
import { Enemy } from '../domain/enemies/Enemy'
import { CombatEngine } from '../domain/combat/CombatEngine'
import type { RunState } from '../domain/progression/RunState'

const DIE_SIZE = 14
const DIE_GAP = 4
const DEF_COLOR = 0x4488cc
const DEF_MAX = 18

const FONT = 'monospace'
const STROKE = { stroke: '#000000', strokeThickness: 2 } as const

type DiceGroup = 'atk' | 'def' | 'mul'

export class CombatScene extends Phaser.Scene {
  private state!: RunState
  private enemy!: Enemy

  private heroHpBar!: HealthBar
  private heroDefBar!: HealthBar
  private enemyHpBar!: HealthBar
  private enemyDefBar!: HealthBar

  private atkDice: DieSprite[] = []
  private defDice: DieSprite[] = []
  private mulDice!: DieSprite

  private atkLabel!: Phaser.GameObjects.Text
  private defLabel!: Phaser.GameObjects.Text
  private mulLabel!: Phaser.GameObjects.Text

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
    this.attacking = false
    this.shakeTimers.clear()
    this.children.removeAll(true)
  }

  create() {
    const { width, height } = this.cameras.main

    const rs = getRunState(this)
    if (rs) this.state = rs
    else {
      this.state = {
        floor: 1, gold: 0, maxHp: 30, hp: 30,
        dice: 3, rerolls: 1, characterName: '???', seed: 0,
      } as RunState
    }
    renderDebugHeader(this, this.state)

    this.enemy = Enemy.forFloor(this.state.floor)
    this.rerolls = { atk: 4, def: 3, mul: 1 }

    this.drawSection1()
    this.drawSection2()
    this.drawSection3()
    this.preRollAll()

    this.add
      .text(width / 2, height - 8, 'ESC: mapa', {
        fontSize: '8px', color: '#aaaaaa', fontFamily: FONT, ...STROKE,
      })
      .setOrigin(0.5).setDepth(10)

    this.input.keyboard!.on('keydown-ESC', () =>
      this.scene.start('MapScene', { runState: this.state }),
    )
  }

  // ── Section 1: Camino ─────────────────────────────────────

  private drawSection1() {
    const { width } = this.cameras.main
    const groundY = 100

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
    this.add
      .text(60, groundY - 22, this.state.characterName, {
        fontSize: '9px', color: '#cceeff', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.enemyGfx = this.add.graphics()
    this.drawCharacter(this.enemyGfx, width - 60, groundY - 14, 0xcc4444)
    this.enemyNameText = this.add
      .text(width - 60, groundY - 22, this.enemy.name, {
        fontSize: '9px', color: '#ffcccc', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)
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
      this.state.maxHp, 0x44aa44, this.state.characterName,
    )
    this.heroHpBar.setValue(this.state.hp)

    this.enemyHpBar = new HealthBar(
      this, width - 152, hpY, barW, barH,
      this.enemy.maxHp, 0xcc4444, this.enemy.name,
    )
    this.enemyHpBar.setValue(this.enemy.hp)

    const defY = hpY + barH + 6
    this.heroDefBar = new HealthBar(
      this, 12, defY, barW, barH, DEF_MAX, DEF_COLOR, '',
    )
    this.heroDefBar.setValue(0)

    this.enemyDefBar = new HealthBar(
      this, width - 152, defY, barW, barH,
      this.enemy.defense, DEF_COLOR, '',
    )
    this.enemyDefBar.setValue(this.enemy.defense)

    // Attack button centered between HP and DEF rows
    this.btnW = 56
    this.btnH = 18
    this.btnX = cx - this.btnW / 2
    this.btnY = hpY + (defY + barH - hpY - this.btnH) / 2

    this.attackBtnBg = this.add.graphics()
    this.redrawAttackBtnDefault()

    this.attackBtnTxt = this.add
      .text(cx, this.btnY + this.btnH / 2, 'ATACAR', {
        fontSize: '10px', color: '#ffffff', fontFamily: FONT, ...STROKE,
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
    const baseY = 190
    const previewY = baseY - 28
    const comboY = baseY - 18
    const diceRowY = baseY + DIE_SIZE * 0.8
    const rerollBtnY = diceRowY + DIE_SIZE * 0.9

    // Previews aligned above each dice group
    this.dmgPreviewTxt = this.add
      .text(100, previewY, 'DMG 0', {
        fontSize: '12px', color: '#ff8888', fontFamily: FONT, fontStyle: 'bold', ...STROKE,
      }).setOrigin(0.5)

    this.defPreviewTxt = this.add
      .text(240, previewY, 'DEF 0', {
        fontSize: '12px', color: '#99ccff', fontFamily: FONT, fontStyle: 'bold', ...STROKE,
      }).setOrigin(0.5)

    this.mulPreviewTxt = this.add
      .text(380, previewY, '×1', {
        fontSize: '12px', color: '#ffdd66', fontFamily: FONT, fontStyle: 'bold', ...STROKE,
      }).setOrigin(0.5)

    this.atkComboTxt = this.add
      .text(100, comboY, '', {
        fontSize: '8px', color: '#ffcc66', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.defComboTxt = this.add
      .text(240, comboY, '', {
        fontSize: '8px', color: '#ffcc66', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    // ── ATK ──
    this.atkLabel = this.add
      .text(100, baseY - 8, 'ATK x4', {
        fontSize: '9px', color: '#eeeeee', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.atkDice = this.createDiceRow(100, diceRowY, 4)
    this.atkDice.forEach(d => {
      d.onReroll = () => this.rerollSingleDie(d, 'atk')
    })

    this.atkRerollTxt = this.add
      .text(100, rerollBtnY, '[R]', {
        fontSize: '8px', color: '#cccccc', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.atkRerollBtn = this.add
      .zone(100, rerollBtnY, 24, 12)
      .setInteractive({ useHandCursor: true })

    this.atkRerollBtn.on('pointerdown', () => this.rerollGroup('atk'))

    // ── DEF ──
    this.defLabel = this.add
      .text(240, baseY - 8, 'DEF x3', {
        fontSize: '9px', color: '#eeeeee', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.defDice = this.createDiceRow(240, diceRowY, 3)
    this.defDice.forEach(d => {
      d.onReroll = () => this.rerollSingleDie(d, 'def')
    })

    this.defRerollTxt = this.add
      .text(240, rerollBtnY, '[R]', {
        fontSize: '8px', color: '#cccccc', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.defRerollBtn = this.add
      .zone(240, rerollBtnY, 24, 12)
      .setInteractive({ useHandCursor: true })

    this.defRerollBtn.on('pointerdown', () => this.rerollGroup('def'))

    // ── MUL ──
    this.mulLabel = this.add
      .text(380, baseY - 8, 'MUL x1', {
        fontSize: '9px', color: '#ffdd66', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.mulDice = this.createDiceRow(380, diceRowY, 1)[0]
    this.mulDice.onReroll = () => this.rerollSingleDie(this.mulDice, 'mul')

    this.mulRerollTxt = this.add
      .text(380, rerollBtnY, '[R]', {
        fontSize: '8px', color: '#cccccc', fontFamily: FONT, ...STROKE,
      }).setOrigin(0.5)

    this.mulRerollBtn = this.add
      .zone(380, rerollBtnY, 24, 12)
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

    const atkSum = atkVals.reduce((a, b) => a + b, 0)
    const defSum = defVals.reduce((a, b) => a + b, 0)
    const atk = CombatEngine.computePower(atkVals)
    const def = CombatEngine.computePower(defVals)
    const enemyDef = this.enemy.defense
    const rawDamage = Math.max(1, atk.total - enemyDef)
    const finalDamage = rawDamage * mulVal

    this.dmgPreviewTxt.setText(`DMG ${finalDamage}`)
    this.defPreviewTxt.setText(`DEF ${def.total}`)
    this.mulPreviewTxt.setText(`×${mulVal}`)

    // Desglose: suma + bonus iguales − def enemigo [= raw] (× mul si aplica)
    const atkParts = [`${atkSum}`]
    if (atk.combo > 0) atkParts.push(`+${atk.combo}`)
    if (enemyDef > 0) atkParts.push(`−${enemyDef}`)
    let atkBreakdown = atkParts.join('')
    if (mulVal > 1) atkBreakdown = `(${atkBreakdown})×${mulVal}`
    this.atkComboTxt.setText(atkBreakdown)

    const defParts = [`${defSum}`]
    if (def.combo > 0) defParts.push(`+${def.combo}`)
    this.defComboTxt.setText(def.combo > 0 ? defParts.join('') : '')
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
      label: Phaser.GameObjects.Text,
      txt: Phaser.GameObjects.Text,
      btn: Phaser.GameObjects.Zone,
      key: string,
      count: number,
    ) => {
      label.setText(`${key} x${count}`)
      if (count <= 0) {
        txt.setColor('#555555')
        btn.disableInteractive()
      } else {
        txt.setColor('#dddddd')
        btn.setInteractive({ useHandCursor: true })
      }
    }

    update(this.atkLabel, this.atkRerollTxt, this.atkRerollBtn, 'ATK', this.rerolls.atk)
    update(this.defLabel, this.defRerollTxt, this.defRerollBtn, 'DEF', this.rerolls.def)
    update(this.mulLabel, this.mulRerollTxt, this.mulRerollBtn, 'MUL', this.rerolls.mul)

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
    const result = CombatEngine.resolve(atkVals, defVals, mulVal, this.enemy)
    this.heroDefBar.setValue(result.defTotal)
    this.defPreviewTxt.setText(`DEF ${result.defTotal}`)
    this.dmgPreviewTxt.setText(`DMG ${result.finalDamage}`)

    const enemyX = this.cameras.main.width - 60
    const heroX = 60

    // ── Phase 1: Hero → Enemy ──────────────────────────────

    if (result.atkCombo > 0) {
      DamageNumbers.show(this, enemyX, 55, result.atkCombo, '#ffaa00')
    }
    DamageNumbers.show(this, enemyX, 70, result.finalDamage, '#ff4444')

    this.tweens.add({
      targets: this.enemyGfx,
      alpha: 0.3, yoyo: true, duration: 80, repeat: 2,
    })
    this.shakeTarget(this.enemyGfx)
    this.enemyHpBar.setValue(this.enemy.hp)

    if (result.killed) {
      this.time.delayedCall(500, () => this.onEnemyKilled())
      return
    }

    // ── Phase 2: Enemy → Hero (sequential) ─────────────────

    this.time.delayedCall(700, () => {
      const eResult = CombatEngine.enemyAttack(
        this.state.floor,
        result.defTotal,
      )

      // enemy damage number on hero
      DamageNumbers.show(
        this,
        heroX,
        70,
        eResult.damage,
        eResult.blocked >= eResult.damage ? '#88aacc' : '#ff8844',
      )

      // flash + shake hero
      this.tweens.add({
        targets: this.heroGfx,
        alpha: 0.3, yoyo: true, duration: 80, repeat: 2,
      })
      this.shakeTarget(this.heroGfx)

      // apply damage to hero
      const remainingDef = Math.max(0, result.defTotal - eResult.blocked)
      this.heroDefBar.setValue(remainingDef)
      this.defPreviewTxt.setText(`DEF ${remainingDef}`)

      if (eResult.overflow > 0) {
        this.state.hp = Math.max(0, this.state.hp - eResult.overflow)
        this.heroHpBar.setValue(this.state.hp)
      }

      this.time.delayedCall(500, () => {
        if (this.state.hp <= 0) {
          this.onHeroKilled()
        } else {
          this.enableAttack()
        }
      })
    })
  }

  private onHeroKilled() {
    this.add
      .text(this.cameras.main.width / 2, 130, 'DERROTADO', {
        fontSize: '14px',
        color: '#ff6666',
        fontFamily: FONT,
        fontStyle: 'bold',
        ...STROKE,
      })
      .setOrigin(0.5)
      .setDepth(50)

    this.time.delayedCall(1500, () => {
      this.scene.start('MapScene', { runState: this.state })
    })
  }

  private onEnemyKilled() {
    DamageNumbers.show(this, this.cameras.main.width - 60, 70, 0, '#ffaa00')

    this.add
      .text(this.cameras.main.width - 60, 65, 'KO!', {
        fontSize: '14px', color: '#ffcc44', fontFamily: FONT, fontStyle: 'bold', ...STROKE,
      }).setOrigin(0.5).setDepth(50)

    this.time.delayedCall(900, () => {
      this.state.floor += 1
      this.enemy = Enemy.forFloor(this.state.floor)

      this.enemyGfx.clear()
      this.drawCharacter(
        this.enemyGfx, this.cameras.main.width - 60, 86, 0xcc4444,
      )
      this.enemyNameText.setText(this.enemy.name)

      this.enemyHpBar.setMax(this.enemy.maxHp)
      this.enemyHpBar.setValue(this.enemy.hp)
      this.enemyDefBar.setMax(this.enemy.defense)
      this.enemyDefBar.setValue(this.enemy.defense)

      this.heroDefBar.setValue(0)

      // reset rerolls & pre-roll dice
      this.rerolls = { atk: 4, def: 3, mul: 1 }
      this.updateRerollLabels()
      this.preRollAll()

      this.enableAttack()
    })
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

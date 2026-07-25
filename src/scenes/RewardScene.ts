import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { addPixelText } from '../ui/pixelText'
import type { RunState, RewardTier } from '../domain/progression/RunState'
import { pickRandomPassiveIds, passiveDef } from '../domain/progression/Passives'
import { advanceFloorAfterBoss, markCurrentNodeCleared } from './MapScene'

type RewardKind = 'gold' | 'heal' | 'dice_atk' | 'dice_def' | 'passive'

interface RewardOption {
  kind: RewardKind
  label: string
  gold?: number
  heal?: number
  passiveId?: string
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildOptions(state: RunState, tier: RewardTier): RewardOption[] {
  const rng = mulberry32(state.seed + state.floor * 17 + Date.now() % 1000)
  const goldBase = tier === 'boss' ? 45 : tier === 'elite' ? 28 : 15
  const options: RewardOption[] = [
    { kind: 'gold', label: `+${goldBase + state.floor * 3} oro`, gold: goldBase + state.floor * 3 },
    { kind: 'heal', label: `Cura ${Math.floor(state.maxHp * 0.3)} HP`, heal: Math.floor(state.maxHp * 0.3) },
  ]

  if (state.diceLoadout.atk < 6 && rng() > 0.4) {
    options.push({ kind: 'dice_atk', label: '+1 dado ATK' })
  } else if (state.diceLoadout.def < 5 && rng() > 0.3) {
    options.push({ kind: 'dice_def', label: '+1 dado DEF' })
  } else {
    const [pid] = pickRandomPassiveIds(1, state.passives, rng)
    const def = passiveDef(pid)
    options.push({
      kind: 'passive',
      label: def?.name ?? 'Passive',
      passiveId: pid,
    })
  }

  while (options.length < 3) {
    const [pid] = pickRandomPassiveIds(1, state.passives, rng)
    if (!pid) {
      options.push({
        kind: 'gold',
        label: `+${Math.floor(goldBase / 2)} oro`,
        gold: Math.floor(goldBase / 2),
      })
      continue
    }
    const def = passiveDef(pid)
    options.push({ kind: 'passive', label: def?.name ?? 'Passive', passiveId: pid })
  }

  return options.slice(0, 3)
}

export class RewardScene extends Phaser.Scene {
  private state!: RunState
  private options: RewardOption[] = []
  private locked = false

  constructor() {
    super('RewardScene')
  }

  init() {
    this.options = []
    this.locked = false
  }

  create() {
    const { width, height } = this.cameras.main
    const cx = width / 2
    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }
    this.state = rs
    renderDebugHeader(this, this.state)

    this.options = buildOptions(this.state, this.state.pendingRewardTier)

    addPixelText(this, cx, 32, 'RECOMPENSA', {
      fontSize: '16px',
      color: '#ffdd88',
    }).setOrigin(0.5)

    this.options.forEach((opt, i) => {
      const y = 96 + i * 40
      const txt = addPixelText(this, cx, y, `[${i + 1}] ${opt.label}`, {
        fontSize: '16px',
        color: '#eeeeee',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      txt.on('pointerover', () => txt.setColor('#ffffff'))
      txt.on('pointerout', () => txt.setColor('#eeeeee'))
      txt.on('pointerdown', () => this.pick(i))
    })

    addPixelText(this, cx, height - 14, '1-3 elegir', {
      fontSize: '8px',
      color: '#999999',
    }).setOrigin(0.5)

    this.input.keyboard!.once('keydown-ONE', () => this.pick(0))
    this.input.keyboard!.once('keydown-TWO', () => this.pick(1))
    this.input.keyboard!.once('keydown-THREE', () => this.pick(2))
  }

  private pick(index: number) {
    if (this.locked) return
    const opt = this.options[index]
    if (!opt) return
    this.locked = true

    switch (opt.kind) {
      case 'gold':
        this.state.gold += opt.gold ?? 0
        break
      case 'heal':
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + (opt.heal ?? 0))
        break
      case 'dice_atk':
        this.state.diceLoadout.atk = Math.min(6, this.state.diceLoadout.atk + 1)
        break
      case 'dice_def':
        this.state.diceLoadout.def = Math.min(5, this.state.diceLoadout.def + 1)
        break
      case 'passive':
        if (opt.passiveId && !this.state.passives.includes(opt.passiveId)) {
          this.state.passives.push(opt.passiveId)
        }
        break
    }

    markCurrentNodeCleared(this.state)

    let nextScene = 'MapScene'
    if (this.state.pendingRewardTier === 'boss') {
      const result = advanceFloorAfterBoss(this.state)
      if (result === 'victory') {
        nextScene = 'GameOverScene'
        this.state.lastDustEarned = 0
        SaveSystem.save('quicksave', this.state)
        this.scene.start(nextScene, { runState: this.state, victory: true })
        return
      }
    }

    this.state.pendingNodeKind = null
    SaveSystem.save('quicksave', this.state)
    this.scene.start(nextScene, { runState: this.state })
  }
}

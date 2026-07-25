import Phaser from 'phaser'
import { getRunState, renderDebugHeader } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { addPixelText } from '../ui/pixelText'
import type { RunState } from '../domain/progression/RunState'
import { markCurrentNodeCleared } from './MapScene'

const EVENTS = [
  {
    title: 'Santuario olvidado',
    choices: [
      { label: 'Rezar (+15% HP)', apply: (rs: RunState) => {
        rs.hp = Math.min(rs.maxHp, rs.hp + Math.floor(rs.maxHp * 0.15))
      }},
      { label: 'Saquear (+12 oro, -3 HP)', apply: (rs: RunState) => {
        rs.gold += 12
        rs.hp = Math.max(1, rs.hp - 3)
      }},
    ],
  },
  {
    title: 'Mercader errante',
    choices: [
      { label: 'Comprar dado ATK (-20g)', apply: (rs: RunState) => {
        if (rs.gold >= 20) {
          rs.gold -= 20
          rs.diceLoadout.atk = Math.min(6, rs.diceLoadout.atk + 1)
        }
      }},
      { label: 'Ignorar (+5 oro)', apply: (rs: RunState) => { rs.gold += 5 }},
    ],
  },
  {
    title: 'Trampa',
    choices: [
      { label: 'Desactivar (50% -5 HP)', apply: (rs: RunState) => {
        if (Math.random() < 0.5) rs.hp = Math.max(1, rs.hp - 5)
      }},
      { label: 'Huir (+8 oro)', apply: (rs: RunState) => { rs.gold += 8 }},
    ],
  },
]

export class EventScene extends Phaser.Scene {
  private locked = false

  constructor() {
    super('EventScene')
  }

  create() {
    const { width } = this.cameras.main
    const cx = width / 2
    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }

    renderDebugHeader(this, rs)
    const ev = EVENTS[(rs.floor + (rs.currentNodeId ?? 0)) % EVENTS.length]

    addPixelText(this, cx, 40, ev.title, {
      fontSize: '10px', color: '#ccaaee', fontStyle: 'bold',
    }).setOrigin(0.5)

    ev.choices.forEach((c, i) => {
      addPixelText(this, cx, 100 + i * 28, `[${i + 1}] ${c.label}`, {
        fontSize: '8px', color: '#dddddd',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.choose(rs, c.apply))
    })
  }

  private choose(rs: RunState, apply: (rs: RunState) => void) {
    if (this.locked) return
    this.locked = true
    apply(rs)
    markCurrentNodeCleared(rs)
    SaveSystem.save('quicksave', rs)
    this.scene.start('MapScene', { runState: rs })
  }
}

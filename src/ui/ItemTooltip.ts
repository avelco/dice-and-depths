import Phaser from 'phaser'
import { addPixelText } from './pixelText'
import {
  formatMods,
  type GearSlot,
  type Rarity,
  type StatMod,
} from '../domain/items/Item'
import {
  rarityLabel,
  roleLabel,
  slotLabel,
  t,
} from '../i18n/I18n'

export type TooltipLine = string | { text: string; color: string }

export interface TooltipContent {
  title: string
  subtitle?: string
  rarity?: Rarity
  lines: TooltipLine[]
}

const PAD = 6
const LINE_H = 11
const MAX_W = 160

export class ItemTooltip extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics
  private texts: Phaser.GameObjects.Text[] = []

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)
    this.bg = scene.add.graphics()
    this.add(this.bg)
    this.setDepth(200)
    this.setVisible(false)
    scene.add.existing(this)
  }

  showAt(x: number, y: number, content: TooltipContent) {
    this.clearTexts()

    const rarityColor = content.rarity
      ? content.rarity === 'legendary'
        ? '#ffcc44'
        : content.rarity === 'rare'
          ? '#66aaff'
          : '#bbbbbb'
      : '#ffffff'

    const blocks: { text: string; color: string }[] = [
      { text: content.title, color: rarityColor },
    ]
    if (content.subtitle) {
      blocks.push({ text: content.subtitle, color: '#999999' })
    }
    if (content.rarity) {
      blocks.push({ text: rarityLabel(content.rarity), color: rarityColor })
    }
    for (const line of content.lines) {
      if (typeof line === 'string') {
        blocks.push({ text: line, color: '#ccffcc' })
      } else {
        blocks.push({ text: line.text, color: line.color })
      }
    }

    let maxLineW = 40
    let ty = PAD
    for (const b of blocks) {
      const txt = addPixelText(this.scene, PAD, ty, b.text, {
        fontSize: '8px',
        color: b.color,
        wordWrap: { width: MAX_W - PAD * 2 },
      })
      this.add(txt)
      this.texts.push(txt)
      maxLineW = Math.max(maxLineW, Math.ceil(txt.width))
      ty += Math.max(LINE_H, Math.ceil(txt.height) + 2)
    }

    const boxW = Math.min(MAX_W, maxLineW + PAD * 2)
    const boxH = ty + PAD - 2

    this.bg.clear()
    this.bg.fillStyle(0x12121c, 0.95)
    this.bg.fillRoundedRect(0, 0, boxW, boxH, 3)
    this.bg.lineStyle(1, 0x556688, 1)
    this.bg.strokeRoundedRect(0, 0, boxW, boxH, 3)

    const cam = this.scene.cameras.main
    let px = x + 10
    let py = y - 4
    if (px + boxW > cam.width - 4) px = x - boxW - 8
    if (py + boxH > cam.height - 4) py = cam.height - boxH - 4
    if (py < 4) py = 4
    if (px < 4) px = 4

    this.setPosition(px, py)
    this.setVisible(true)
  }

  hide() {
    this.setVisible(false)
    this.clearTexts()
    this.bg.clear()
  }

  private clearTexts() {
    for (const txt of this.texts) txt.destroy()
    this.texts = []
  }
}

export function gearTooltipContent(opts: {
  name: string
  slot: GearSlot
  rarity: Rarity
  mods: StatMod[]
  forgeLines?: TooltipLine[]
}): TooltipContent {
  return {
    title: opts.name,
    subtitle: `${slotLabel(opts.slot)} · ${roleLabel(opts.slot)}`,
    rarity: opts.rarity,
    lines: [...formatMods(opts.mods), ...(opts.forgeLines ?? [])],
  }
}

export function runeTooltipContent(opts: {
  name: string
  rarity: Rarity
  mods: StatMod[]
}): TooltipContent {
  return {
    title: opts.name,
    subtitle: t('inv.runeKind'),
    rarity: opts.rarity,
    lines: formatMods(opts.mods),
  }
}

export function emptySlotTooltip(slot: GearSlot): TooltipContent {
  return {
    title: slotLabel(slot),
    subtitle: t('inv.emptyGearSub', { role: roleLabel(slot).toLowerCase() }),
    lines: [t('inv.emptyGearHint')],
  }
}

export function emptyRuneTooltip(index: number): TooltipContent {
  return {
    title: t('inv.runeSlot', { n: index + 1 }),
    subtitle: t('inv.emptyRuneSub'),
    lines: [t('inv.emptyRuneHint')],
  }
}

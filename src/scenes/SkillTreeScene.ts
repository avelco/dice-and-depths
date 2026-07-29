import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { addBackButton } from '../ui/BackButton'
import { enableTouchTarget } from '../ui/touchTarget'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { MetaProgression } from '../domain/progression/MetaProgression'
import {
  canUnlock,
  isNodeUnlocked,
  skillTreeNode,
  skillTreeNodes,
  type SkillTreeNodeDef,
} from '../domain/progression/SkillTree'
import { passiveDesc, passiveName, t } from '../i18n/I18n'

const PANEL_X = 24
const PANEL_TOP = 52
const PANEL_PAD = 20
const COL_W = 136
const ROW_H = 54
const CHIP_W = 120
const CHIP_H = 34
const ARROW = 5
const COST_GUTTER = 14

/** Wrap long passive names so they fit the chip. */
function chipNameLines(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  if (parts.length === 2) return `${parts[0]}\n${parts[1]}`
  // "Amigo del mercader" → "Amigo del" / "mercader"
  return `${parts.slice(0, -1).join(' ')}\n${parts[parts.length - 1]}`
}

type NodeState = 'owned' | 'available' | 'locked'

export class SkillTreeScene extends Phaser.Scene {
  private pointsTxt!: Phaser.GameObjects.Text
  private statusTxt!: Phaser.GameObjects.Text
  private edgeG!: Phaser.GameObjects.Graphics
  private chipG!: Phaser.GameObjects.Graphics
  private nodeLabels = new Map<string, Phaser.GameObjects.Text>()
  private costLabels = new Map<string, Phaser.GameObjects.Text>()
  private originX = 0
  private originY = 0

  constructor() {
    super('SkillTreeScene')
  }

  create() {
    MetaProgression.load()
    const { width, height } = this.cameras.main
    const cx = width / 2
    const panelW = width - PANEL_X * 2
    const panelH = height - PANEL_TOP - 40

    const panel = this.add.graphics().setDepth(0)
    panel.fillStyle(0x161625, 0.95)
    panel.fillRoundedRect(PANEL_X, PANEL_TOP, panelW, panelH, 6)
    panel.lineStyle(1, 0x3a3a58, 1)
    panel.strokeRoundedRect(PANEL_X, PANEL_TOP, panelW, panelH, 6)

    this.layoutTree(panelW, panelH)

    addBackButton(this, () => this.scene.start('MenuScene'))

    addPixelText(this, cx, 16, t('tree.title'), {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5)

    this.pointsTxt = addPixelText(this, cx, 36, '', {
      fontSize: '8px',
      color: '#ffcc66',
    }).setOrigin(0.5)

    this.statusTxt = addPixelText(this, cx, height - 28, '', {
      fontSize: '8px',
      color: '#aaaaaa',
      wordWrap: { width: 440 },
      align: 'center',
    }).setOrigin(0.5)

    addPixelText(this, cx, height - 12, t('tree.hint'), {
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0.5)

    this.edgeG = this.add.graphics().setDepth(1)
    this.chipG = this.add.graphics().setDepth(2)
    this.drawTree()
    this.refreshHud()

    bindSceneKeys(this, {
      'keydown-ESC': () => this.scene.start('MenuScene'),
    })
  }

  /** Center the node grid inside the panel with safe padding. */
  private layoutTree(panelW: number, panelH: number) {
    const nodes = skillTreeNodes()
    const maxCol = Math.max(...nodes.map(n => n.col), 0)
    const maxRow = Math.max(...nodes.map(n => n.row), 0)
    const treeW = maxCol * COL_W + CHIP_W
    const treeH = maxRow * ROW_H + CHIP_H
    const innerW = panelW - PANEL_PAD * 2
    const innerH = panelH - PANEL_PAD * 2
    this.originX =
      PANEL_X + PANEL_PAD + CHIP_W / 2 + Math.max(0, (innerW - treeW) / 2)
    this.originY =
      PANEL_TOP + PANEL_PAD + CHIP_H / 2 + Math.max(0, (innerH - treeH) / 2)
  }

  private nodePos(node: SkillTreeNodeDef): { x: number; y: number } {
    return {
      x: Math.round(this.originX + node.col * COL_W),
      y: Math.round(this.originY + node.row * ROW_H),
    }
  }

  private nodeState(node: SkillTreeNodeDef): NodeState {
    const meta = MetaProgression.load()
    if (isNodeUnlocked(meta, node.id)) return 'owned'
    if (canUnlock(meta, node.id)) return 'available'
    return 'locked'
  }

  private edgeColor(from: SkillTreeNodeDef, to: SkillTreeNodeDef): number {
    const a = this.nodeState(from)
    const b = this.nodeState(to)
    if (a === 'owned' && b === 'owned') return 0x66cc88
    if (a === 'owned' && b === 'available') return 0x88aacc
    return 0x3a3a55
  }

  private chipColors(state: NodeState): {
    fill: number
    stroke: number
    text: string
  } {
    if (state === 'owned') {
      return { fill: 0x1e3a2a, stroke: 0x66ffaa, text: '#88ffaa' }
    }
    if (state === 'available') {
      return { fill: 0x2a2a3a, stroke: 0xccddee, text: '#eeeeee' }
    }
    return { fill: 0x1a1a28, stroke: 0x444455, text: '#666677' }
  }

  private drawArrowHead(tipX: number, tipY: number, color: number) {
    // Pointing right into the child chip.
    this.edgeG.fillStyle(color, 1)
    this.edgeG.fillTriangle(
      tipX,
      tipY,
      tipX - ARROW,
      tipY - ARROW,
      tipX - ARROW,
      tipY + ARROW,
    )
  }

  private drawElbow(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number,
  ) {
    const startX = from.x + CHIP_W / 2 - 4
    const endX = to.x - CHIP_W / 2 + 4
    const midX = Math.round((startX + endX) / 2)
    this.edgeG.lineStyle(2, color, 0.95)
    this.edgeG.beginPath()
    this.edgeG.moveTo(startX, from.y)
    this.edgeG.lineTo(midX, from.y)
    this.edgeG.lineTo(midX, to.y)
    this.edgeG.lineTo(endX - ARROW, to.y)
    this.edgeG.strokePath()
    this.drawArrowHead(endX, to.y, color)
  }

  private drawTree() {
    this.edgeG.clear()
    this.chipG.clear()

    for (const node of skillTreeNodes()) {
      const to = this.nodePos(node)
      for (const reqId of node.requires) {
        const req = skillTreeNode(reqId)
        if (!req) continue
        this.drawElbow(this.nodePos(req), to, this.edgeColor(req, node))
      }
    }

    for (const node of skillTreeNodes()) {
      this.drawNodeChip(node)
    }
  }

  private drawNodeChip(node: SkillTreeNodeDef) {
    const { x, y } = this.nodePos(node)
    const state = this.nodeState(node)
    const colors = this.chipColors(state)
    const isRoot = node.requires.length === 0

    const left = x - CHIP_W / 2
    const top = y - CHIP_H / 2

    this.chipG.fillStyle(colors.fill, 1)
    this.chipG.fillRoundedRect(left, top, CHIP_W, CHIP_H, 4)
    this.chipG.lineStyle(isRoot ? 2 : 1, colors.stroke, 1)
    this.chipG.strokeRoundedRect(left, top, CHIP_W, CHIP_H, 4)

    if (state === 'available') {
      this.chipG.lineStyle(1, 0xffffff, 0.35)
      this.chipG.strokeRoundedRect(left + 1, top + 1, CHIP_W - 2, CHIP_H - 2, 3)
    }

    const name = chipNameLines(passiveName(node.passiveId))
    // Owned: full chip width (no cost glyph). Else leave gutter for cost digit.
    const nameX = state === 'owned' ? x : x - COST_GUTTER / 2
    let label = this.nodeLabels.get(node.id)
    if (!label) {
      label = addPixelText(this, nameX, y, name, {
        fontSize: '8px',
        color: colors.text,
        align: 'center',
        lineSpacing: 2,
      })
        .setOrigin(0.5)
        .setDepth(3)
      enableTouchTarget(label, { min: 28 })
      label.on('pointerover', () => {
        this.showNodeInfo(node)
        label?.setColor('#ffffff')
      })
      label.on('pointerout', () => {
        label?.setColor(this.chipColors(this.nodeState(node)).text)
      })
      label.on('pointerdown', () => this.onNode(node.id))
      this.nodeLabels.set(node.id, label)
    } else {
      label.setText(name)
      label.setColor(colors.text)
      label.setPosition(nameX, y)
    }

    let cost = this.costLabels.get(node.id)
    if (state === 'owned') {
      // Green border already marks owned — avoid "*" colliding with long names.
      cost?.setVisible(false)
    } else {
      const costX = left + CHIP_W - 8
      if (!cost) {
        cost = addPixelText(this, costX, y, `${node.cost}`, {
          fontSize: '8px',
          color: '#888899',
        })
          .setOrigin(1, 0.5)
          .setDepth(3)
        this.costLabels.set(node.id, cost)
      } else {
        cost.setText(`${node.cost}`)
        cost.setColor('#888899')
        cost.setPosition(costX, y)
      }
      cost.setVisible(true)
    }
  }

  private refreshNodes() {
    this.drawTree()
  }

  private showNodeInfo(node: SkillTreeNodeDef) {
    const desc = passiveDesc(node.passiveId)
    const state = this.nodeState(node)
    const stateLabel =
      state === 'owned'
        ? t('tree.owned')
        : state === 'available'
          ? t('tree.available')
          : t('tree.locked')
    this.statusTxt.setText(
      `${passiveName(node.passiveId)}: ${desc} (${stateLabel})`,
    )
  }

  private onNode(nodeId: string) {
    const node = skillTreeNode(nodeId)
    if (!node) return
    this.showNodeInfo(node)
    if (!MetaProgression.tryUnlockTreeNode(nodeId)) {
      AudioSystem.play('ui')
      return
    }
    AudioSystem.play('select')
    this.refreshHud()
    this.refreshNodes()
    this.showNodeInfo(node)
  }

  private refreshHud() {
    const meta = MetaProgression.load()
    this.pointsTxt.setText(
      t('tree.points', {
        n: meta.skillPoints,
        earned: meta.skillPointsEarned,
      }),
    )
  }
}

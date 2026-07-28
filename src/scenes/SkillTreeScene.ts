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

const ORIGIN_X = 90
const ORIGIN_Y = 70
const COL_W = 140
const ROW_H = 52

export class SkillTreeScene extends Phaser.Scene {
  private pointsTxt!: Phaser.GameObjects.Text
  private statusTxt!: Phaser.GameObjects.Text
  private edgeG!: Phaser.GameObjects.Graphics
  private nodeLabels = new Map<string, Phaser.GameObjects.Text>()

  constructor() {
    super('SkillTreeScene')
  }

  create() {
    MetaProgression.load()
    const { width, height } = this.cameras.main
    const cx = width / 2

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

    this.edgeG = this.add.graphics().setDepth(0)
    this.drawEdges()
    this.drawNodes()
    this.refreshHud()

    bindSceneKeys(this, {
      'keydown-ESC': () => this.scene.start('MenuScene'),
    })
  }

  private nodePos(node: SkillTreeNodeDef): { x: number; y: number } {
    return {
      x: ORIGIN_X + node.col * COL_W,
      y: ORIGIN_Y + node.row * ROW_H,
    }
  }

  private drawEdges() {
    this.edgeG.clear()
    for (const node of skillTreeNodes()) {
      const to = this.nodePos(node)
      for (const reqId of node.requires) {
        const req = skillTreeNode(reqId)
        if (!req) continue
        const from = this.nodePos(req)
        this.edgeG.lineStyle(1, 0x445566, 0.9)
        this.edgeG.beginPath()
        this.edgeG.moveTo(from.x, from.y)
        this.edgeG.lineTo(to.x, to.y)
        this.edgeG.strokePath()
      }
    }
  }

  private drawNodes() {
    const meta = MetaProgression.load()
    for (const node of skillTreeNodes()) {
      const { x, y } = this.nodePos(node)
      const unlocked = isNodeUnlocked(meta, node.id)
      const available = canUnlock(meta, node.id)
      const name = passiveName(node.passiveId)
      let color = '#555555'
      if (unlocked) color = '#88ffaa'
      else if (available) color = '#eeeeee'

      const label = addPixelText(
        this,
        x,
        y,
        unlocked ? `* ${name}` : `[${node.cost}] ${name}`,
        { fontSize: '8px', color },
      ).setOrigin(0.5).setDepth(2)
      enableTouchTarget(label)
      label.on('pointerover', () => this.showNodeInfo(node))
      label.on('pointerdown', () => this.onNode(node.id))
      this.nodeLabels.set(node.id, label)
    }
  }

  private refreshNodes() {
    const meta = MetaProgression.load()
    for (const node of skillTreeNodes()) {
      const txt = this.nodeLabels.get(node.id)
      if (!txt) continue
      const unlocked = isNodeUnlocked(meta, node.id)
      const available = canUnlock(meta, node.id)
      const name = passiveName(node.passiveId)
      txt.setText(unlocked ? `* ${name}` : `[${node.cost}] ${name}`)
      if (unlocked) txt.setColor('#88ffaa')
      else if (available) txt.setColor('#eeeeee')
      else txt.setColor('#555555')
    }
  }

  private showNodeInfo(node: SkillTreeNodeDef) {
    const desc = passiveDesc(node.passiveId)
    const meta = MetaProgression.load()
    let state = t('tree.locked')
    if (isNodeUnlocked(meta, node.id)) state = t('tree.owned')
    else if (canUnlock(meta, node.id)) state = t('tree.available')
    this.statusTxt.setText(`${passiveName(node.passiveId)} — ${desc} (${state})`)
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

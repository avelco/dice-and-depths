import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { getRunState, renderDebugHeader } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { nodeColor, nodeName, nodeIcon } from '../domain/map/FloorGenerator'
import { dungeonMapWidth, loadDungeonMap, MAX_CAMPAIGN_FLOOR } from '../domain/map/DungeonMap'
import type { MapNodeKind } from '../domain/map/NodeTypes'
import type { MapNodeSnapshot, RunState } from '../domain/progression/RunState'
import { Enemy } from '../domain/enemies/Enemy'
import { AudioSystem } from '../systems/AudioSystem'
import { bindSceneKeys } from '../systems/bindSceneKeys'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { addBackButton } from '../ui/BackButton'
import { t } from '../i18n/I18n'

const NODE_R = 8

export class MapScene extends Phaser.Scene {
  private nodes: MapNodeSnapshot[] = []
  private edges: { from: number; to: number }[] = []
  private hoveredNodeId: number | null = null
  private nodeG!: Phaser.GameObjects.Graphics
  private edgeG!: Phaser.GameObjects.Graphics
  private fogG!: Phaser.GameObjects.Graphics
  private runState!: RunState
  private labels = new Map<number, Phaser.GameObjects.Text>()
  private icons = new Map<number, Phaser.GameObjects.Text>()
  private fogLabels = new Map<number, Phaser.GameObjects.Text>()
  private mapWidth = 480
  private panning = false
  private panMoved = false
  private panLastX = 0

  constructor() {
    super('MapScene')
  }

  init() {
    this.children.removeAll(true)
    this.hoveredNodeId = null
    this.labels.clear()
    this.icons.clear()
    this.fogLabels.clear()
    this.panning = false
    this.panMoved = false
  }

  create() {
    const { width, height } = this.cameras.main

    const rs = getRunState(this)
    if (!rs) {
      this.scene.start('MenuScene')
      return
    }
    this.runState = rs

    if (!this.runState.map) {
      this.runState.map = loadDungeonMap(this.runState.floor)
      const start = this.runState.map.nodes.find(n => n.kind === 'start')
      this.runState.currentNodeId = start?.id ?? null
    }

    this.nodes = this.runState.map.nodes
    this.edges = this.runState.map.edges
    this.mapWidth = dungeonMapWidth(this.runState.floor)

    this.cameras.main.setBounds(0, 0, this.mapWidth, height)
    this.centerOnCurrentNode(false)

    renderDebugHeader(this, this.runState)

    this.edgeG = this.add.graphics()
    this.edgeG.setDepth(0)

    this.fogG = this.add.graphics()
    this.fogG.setDepth(0.5)

    this.nodeG = this.add.graphics()
    this.nodeG.setDepth(1)

    for (const node of this.nodes) {
      const icon = addPixelText(this, node.x, node.y, nodeIcon(node.kind), {
        fontSize: '8px',
        color: '#111111',
      }).setOrigin(0.5).setDepth(3)
      this.icons.set(node.id, icon)

      const label = addPixelText(this, node.x, node.y + NODE_R + 4, nodeName(node.kind), {
        fontSize: '8px',
        color: '#777777',
      }).setOrigin(0.5, 0).setDepth(2)
      this.labels.set(node.id, label)

      const fogLabel = addPixelText(this, node.x, node.y + NODE_R + 4, '???', {
        fontSize: '8px',
        color: '#556677',
      }).setOrigin(0.5, 0).setDepth(2).setVisible(false)
      this.fogLabels.set(node.id, fogLabel)
    }

    this.redrawMap()

    addBackButton(this, () => this.scene.start('MenuScene'))

    addPixelText(this, width / 2, height - 10, t('map.hint'), {
      fontSize: '8px',
      color: '#777777',
    }).setOrigin(0.5).setDepth(10).setScrollFactor(0)

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.panning = true
      this.panMoved = false
      this.panLastX = pointer.x
    })

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.panning && !this.panMoved) {
        const id = this.hitTest(pointer.worldX, pointer.worldY)
        if (id !== null) {
          const node = this.nodes.find(n => n.id === id)!
          this.selectNode(node)
        }
      }
      this.panning = false
      this.panMoved = false
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.panning && pointer.isDown) {
        const dx = pointer.x - this.panLastX
        if (Math.abs(dx) > 2) this.panMoved = true
        this.cameras.main.scrollX -= dx
        this.panLastX = pointer.x
      }

      const prev = this.hoveredNodeId
      this.hoveredNodeId = this.hitTest(pointer.worldX, pointer.worldY)
      if (prev !== this.hoveredNodeId) this.redrawMap()
    })

    bindSceneKeys(this, {
      'keydown-ESC': () => this.scene.start('MenuScene'),
      'keydown-LEFT': () => {
        this.cameras.main.scrollX -= 40
      },
      'keydown-RIGHT': () => {
        this.cameras.main.scrollX += 40
      },
    })
    SaveSystem.save('quicksave', this.runState)
  }

  private centerOnCurrentNode(smooth: boolean) {
    const cur = this.nodes.find(n => n.id === this.runState.currentNodeId)
      ?? this.nodes.find(n => n.kind === 'start')
    if (!cur) return
    const cam = this.cameras.main
    const target = Phaser.Math.Clamp(
      cur.x - cam.width / 2,
      0,
      Math.max(0, this.mapWidth - cam.width),
    )
    if (smooth) {
      this.tweens.add({
        targets: cam,
        scrollX: target,
        duration: 220,
        ease: 'Sine.easeOut',
      })
    } else {
      cam.scrollX = target
    }
  }

  private hitTest(wx: number, wy: number): number | null {
    const r = NODE_R + 10
    let best: number | null = null
    let bestDist = r * r
    for (const n of this.nodes) {
      if (!this.isNodeKnown(n)) continue
      const dx = wx - n.x
      const dy = wy - n.y
      const d = dx * dx + dy * dy
      if (d <= bestDist) {
        bestDist = d
        best = n.id
      }
    }
    return best
  }

  /** Edges appear only after the source node is cleared. */
  private isEdgeVisible(fromId: number): boolean {
    const from = this.nodes.find(n => n.id === fromId)
    return !!from?.cleared
  }

  /**
   * Nodes stay hidden until you clear a previous node that connects to them
   * (start / current always known). Prevents planning the whole route upfront.
   */
  private isNodeKnown(node: MapNodeSnapshot): boolean {
    if (node.kind === 'start') return true
    if (node.cleared) return true
    if (node.id === this.runState.currentNodeId) return true
    return this.edges.some(e => {
      if (e.to !== node.id) return false
      const from = this.nodes.find(n => n.id === e.from)
      return !!from?.cleared
    })
  }

  private redrawMap() {
    const curId = this.runState.currentNodeId
    this.edgeG.clear()
    this.fogG.clear()
    this.nodeG.clear()

    this.drawAmbientFog()

    for (const edge of this.edges) {
      if (!this.isEdgeVisible(edge.from)) continue
      const from = this.nodes.find(n => n.id === edge.from)!
      const to = this.nodes.find(n => n.id === edge.to)!
      if (!this.isNodeKnown(to)) continue

      const active =
        curId !== null &&
        edge.from === curId &&
        this.isReachable(to)
      this.edgeG.lineStyle(active ? 2 : 1, active ? 0x8899aa : 0x445566, active ? 1 : 0.7)
      this.edgeG.beginPath()
      this.edgeG.moveTo(from.x, from.y)
      this.edgeG.lineTo(to.x, to.y)
      this.edgeG.strokePath()
    }

    for (const node of this.nodes) {
      if (this.isNodeKnown(node)) continue
      this.drawFogNode(node)
    }

    for (const node of this.nodes) {
      const known = this.isNodeKnown(node)
      const label = this.labels.get(node.id)
      const icon = this.icons.get(node.id)
      const fogLabel = this.fogLabels.get(node.id)

      if (!known) {
        label?.setVisible(false)
        icon?.setVisible(false)
        fogLabel?.setVisible(true).setAlpha(0.55)
        continue
      }

      fogLabel?.setVisible(false)
      label?.setVisible(true)
      icon?.setVisible(true)

      const reachable = this.isReachable(node)
      const cleared = node.cleared
      let color = nodeColor(node.kind)

      if (node.id === this.hoveredNodeId && reachable) color = 0xffffff
      else if (node.id === curId && !cleared) color = 0xffffff
      if (cleared) color = dimColor(color)
      else if (!reachable) color = dimColor(color)

      const r = node.kind === 'boss' ? NODE_R + 2 : NODE_R

      if (reachable) {
        this.nodeG.lineStyle(2, 0xeeeeee, 0.95)
        this.nodeG.strokeCircle(node.x, node.y, r + 3)
      }

      this.nodeG.fillStyle(color, 1)
      this.nodeG.fillCircle(node.x, node.y, r)

      if (label) {
        label.setColor(reachable ? '#dddddd' : cleared ? '#555555' : '#888888')
        label.setAlpha(reachable || cleared ? 1 : 0.7)
      }
      if (icon) {
        icon.setColor(reachable || node.id === curId ? '#111111' : '#222222')
        icon.setAlpha(cleared ? 0.4 : 1)
      }
    }
  }

  private drawAmbientFog() {
    const unknown = this.nodes.filter(n => !this.isNodeKnown(n))
    if (unknown.length === 0) return

    for (const node of unknown) {
      const ox = ((node.id * 37) % 11) - 5
      const oy = ((node.id * 53) % 9) - 4
      this.fogG.fillStyle(0x2a2a44, 0.18)
      this.fogG.fillCircle(node.x + ox, node.y + oy, 22)
      this.fogG.fillStyle(0x343454, 0.12)
      this.fogG.fillCircle(node.x - ox * 0.6, node.y + 8, 16)
    }

    let maxKnownX = 0
    for (const n of this.nodes) {
      if (this.isNodeKnown(n)) maxKnownX = Math.max(maxKnownX, n.x)
    }
    const { height } = this.cameras.main
    for (let x = maxKnownX + 28; x < this.mapWidth - 12; x += 36) {
      for (let y = 48; y < height - 28; y += 40) {
        const wobble = ((x * 3 + y * 7) % 13) - 6
        this.fogG.fillStyle(0x22223a, 0.14)
        this.fogG.fillCircle(x + wobble, y, 20)
      }
    }
  }

  private drawFogNode(node: MapNodeSnapshot) {
    const r = NODE_R + 1
    this.fogG.fillStyle(0x3a3a58, 0.28)
    this.fogG.fillCircle(node.x, node.y, r + 8)
    this.fogG.fillStyle(0x2e2e48, 0.4)
    this.fogG.fillCircle(node.x, node.y, r + 4)
    this.nodeG.fillStyle(0x252538, 0.85)
    this.nodeG.fillCircle(node.x, node.y, r)
    this.nodeG.lineStyle(1, 0x4a4a66, 0.5)
    this.nodeG.strokeCircle(node.x, node.y, r)
  }

  private isReachable(node: MapNodeSnapshot): boolean {
    if (node.cleared) return false
    if (this.runState.currentNodeId === null) {
      return node.kind === 'start'
    }
    const cur = this.nodes.find(n => n.id === this.runState.currentNodeId)
    if (!cur) return node.kind === 'start'

    if (node.id === cur.id) return !cur.cleared
    if (!cur.cleared) return false
    if (node.col <= cur.col) return false
    return this.edges.some(e => e.from === cur.id && e.to === node.id)
  }

  private selectNode(node: MapNodeSnapshot) {
    if (!this.isReachable(node)) return

    AudioSystem.unlock()
    AudioSystem.play('map')
    this.runState.currentNodeId = node.id
    this.runState.pendingNodeKind = node.kind
    SaveSystem.save('quicksave', this.runState)
    this.centerOnCurrentNode(true)
    this.redrawMap()

    this.time.delayedCall(200, () => this.routeToNode(node.kind))
  }

  private routeToNode(kind: MapNodeKind) {
    switch (kind) {
      case 'start':
      case 'combat':
      case 'elite':
      case 'boss':
        this.runState.pendingRewardTier = Enemy.tierForKind(
          kind === 'start' ? 'combat' : kind,
        )
        this.scene.start('CombatScene', { runState: this.runState })
        break
      case 'shop':
        this.scene.start('ShopScene', { runState: this.runState })
        break
      case 'event':
        this.scene.start('EventScene', { runState: this.runState })
        break
      case 'rest':
        this.scene.start('RestScene', { runState: this.runState })
        break
    }
  }
}

function dimColor(c: number): number {
  const r = ((c >> 16) & 0xff) * 0.32
  const g = ((c >> 8) & 0xff) * 0.32
  const b = (c & 0xff) * 0.32
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

export function markCurrentNodeCleared(state: RunState) {
  if (!state.map || state.currentNodeId === null) return
  const node = state.map.nodes.find(n => n.id === state.currentNodeId)
  if (node) node.cleared = true
}

export function advanceFloorAfterBoss(state: RunState) {
  const clearedFloor = state.floor
  MetaProgression.unlockFloorAfterClear(clearedFloor)
  state.floor += 1
  state.secondWindUsedThisFloor = false
  if (state.floor > MAX_CAMPAIGN_FLOOR) {
    return 'victory'
  }
  state.map = loadDungeonMap(state.floor)
  const start = state.map.nodes.find(n => n.kind === 'start')
  state.currentNodeId = start?.id ?? null
  return 'continue'
}

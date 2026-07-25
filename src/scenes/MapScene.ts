import Phaser from 'phaser'
import { addPixelText } from '../ui/pixelText'
import { getRunState, renderDebugHeader } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'
import { generateFloorMap, nodeColor } from '../domain/map/FloorGenerator'
import type { MapNodeKind } from '../domain/map/NodeTypes'
import type { MapNodeSnapshot, RunState } from '../domain/progression/RunState'
import { Enemy } from '../domain/enemies/Enemy'

const NODE_R = 5

export class MapScene extends Phaser.Scene {
  private nodes: MapNodeSnapshot[] = []
  private edges: { from: number; to: number }[] = []
  private hoveredNodeId: number | null = null
  private nodeG!: Phaser.GameObjects.Graphics
  private runState!: RunState

  constructor() {
    super('MapScene')
  }

  init() {
    this.children.removeAll(true)
    this.hoveredNodeId = null
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
      this.runState.map = generateFloorMap(this.runState.seed, this.runState.floor)
      const start = this.runState.map.nodes.find(n => n.kind === 'start')
      this.runState.currentNodeId = start?.id ?? null
    }

    this.nodes = this.runState.map.nodes
    this.edges = this.runState.map.edges

    renderDebugHeader(this, this.runState)

    const lineG = this.add.graphics()
    lineG.lineStyle(1, 0x333333, 0.8)
    for (const edge of this.edges) {
      const from = this.nodes.find(n => n.id === edge.from)!
      const to = this.nodes.find(n => n.id === edge.to)!
      lineG.beginPath()
      lineG.moveTo(from.x, from.y)
      lineG.lineTo(to.x, to.y)
      lineG.strokePath()
    }
    lineG.setDepth(0)

    this.nodeG = this.add.graphics()
    this.nodeG.setDepth(1)
    this.drawNodes()

    addPixelText(this, width / 2, height - 10, 'click nodo | ESC menu', {
      fontSize: '8px',
      color: '#777777',
    }).setOrigin(0.5).setDepth(10)

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const prev = this.hoveredNodeId
      this.hoveredNodeId = this.hitTest(pointer.x, pointer.y)
      if (prev !== this.hoveredNodeId) this.drawNodes()
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const id = this.hitTest(pointer.x, pointer.y)
      if (id !== null) {
        const node = this.nodes.find(n => n.id === id)!
        this.selectNode(node)
      }
    })

    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MenuScene'))
    SaveSystem.save('quicksave', this.runState)
  }

  private hitTest(px: number, py: number): number | null {
    const r = NODE_R + 3
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i]
      const dx = px - n.x
      const dy = py - n.y
      if (dx * dx + dy * dy <= r * r) return n.id
    }
    return null
  }

  private drawNodes() {
    const curId = this.runState.currentNodeId
    this.nodeG.clear()
    for (const node of this.nodes) {
      let color = nodeColor(node.kind)
      if (node.id === this.hoveredNodeId) color = 0xcccccc
      else if (node.id === curId) color = 0xffffff
      if (node.cleared && node.kind !== 'start') color = dimColor(color)
      if (!this.isReachable(node)) color = dimColor(color)

      const r = node.kind === 'boss' ? NODE_R + 2 : NODE_R
      this.nodeG.fillStyle(color, 1)
      this.nodeG.fillCircle(node.x, node.y, r)
    }
  }

  private isReachable(node: MapNodeSnapshot): boolean {
    if (node.cleared && node.kind !== 'start') return false
    if (this.runState.currentNodeId === null) {
      return node.kind === 'start'
    }
    const cur = this.nodes.find(n => n.id === this.runState.currentNodeId)!
    if (node.col <= cur.col) return false
    return this.edges.some(e => e.from === cur.id && e.to === node.id)
  }

  private selectNode(node: MapNodeSnapshot) {
    if (!this.isReachable(node)) return

    this.runState.currentNodeId = node.id
    this.runState.pendingNodeKind = node.kind
    SaveSystem.save('quicksave', this.runState)
    this.drawNodes()

    this.time.delayedCall(200, () => this.routeToNode(node.kind))
  }

  private routeToNode(kind: MapNodeKind) {
    switch (kind) {
      case 'start':
        break
      case 'combat':
      case 'elite':
      case 'boss':
        this.runState.pendingRewardTier = Enemy.tierForKind(kind)
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
  const r = ((c >> 16) & 0xff) * 0.35
  const g = ((c >> 8) & 0xff) * 0.35
  const b = (c & 0xff) * 0.35
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

export function markCurrentNodeCleared(state: RunState) {
  if (!state.map || state.currentNodeId === null) return
  const node = state.map.nodes.find(n => n.id === state.currentNodeId)
  if (node) node.cleared = true
}

export function advanceFloorAfterBoss(state: RunState) {
  state.floor += 1
  state.secondWindUsedThisFloor = false
  if (state.floor > 3) {
    return 'victory'
  }
  state.map = generateFloorMap(state.seed, state.floor)
  const start = state.map.nodes.find(n => n.kind === 'start')
  state.currentNodeId = start?.id ?? null
  return 'continue'
}

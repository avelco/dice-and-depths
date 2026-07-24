import Phaser from 'phaser'
import { createDebugState, getRunState, renderDebugHeader } from '../debug'
import { SaveSystem } from '../systems/SaveSystem'

import type { RunState } from '../domain/progression/RunState'

// ── Map generation ────────────────────────────────────────────

interface MapNode {
  id: number
  col: number
  type: 'start' | 'normal' | 'boss'
  x: number
  y: number
}

interface MapEdge {
  from: number
  to: number
}

const COLS = 5 // 0=start (green), 1-3=levels of 3, 4=boss (red)
const START_X = 36
const END_X = 444
const COL_SPACING = Math.round((END_X - START_X) / (COLS - 1))
const NODE_R = 5
const TOP_Y = 28
const BOT_Y = 240

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function generateMap(): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = []
  const edges: MapEdge[] = []
  let id = 0

  // 1 start → 3 → 3 → 3 → 1 boss
  const counts = [1, 3, 3, 3, 1]

  for (let col = 0; col < COLS; col++) {
    const baseX = START_X + col * COL_SPACING
    const count = counts[col]
    let type: MapNode['type'] = 'normal'
    if (col === 0) type = 'start'
    else if (col === COLS - 1) type = 'boss'

    // Uneven vertical slots so rows don't line up across columns
    const slots: number[] = []
    if (count === 1) {
      slots.push((TOP_Y + BOT_Y) / 2 + rand(-12, 12))
    } else {
      const band = (BOT_Y - TOP_Y) / count
      for (let i = 0; i < count; i++) {
        const lo = TOP_Y + band * i + 8
        const hi = TOP_Y + band * (i + 1) - 8
        slots.push(rand(lo, hi))
      }
      slots.sort((a, b) => a - b)
    }

    for (let i = 0; i < count; i++) {
      const jitterX = type === 'normal' ? rand(-18, 18) : 0
      nodes.push({
        id: id++,
        col,
        type,
        x: baseX + jitterX,
        y: slots[i],
      })
    }
  }

  // Organic paths: each node links to 1–2 nearest in the next column
  for (let col = 0; col < COLS - 1; col++) {
    const froms = nodes.filter(n => n.col === col)
    const tos = nodes.filter(n => n.col === col + 1)
    const linked = new Set<number>()

    for (const from of froms) {
      const sorted = [...tos].sort(
        (a, b) => Math.abs(a.y - from.y) - Math.abs(b.y - from.y),
      )
      const targets = tos.length === 1 ? 1 : 1 + (Math.random() < 0.55 ? 1 : 0)
      for (let t = 0; t < targets && t < sorted.length; t++) {
        edges.push({ from: from.id, to: sorted[t].id })
        linked.add(sorted[t].id)
      }
    }

    // Ensure every next-column node is reachable from somewhere
    for (const to of tos) {
      if (linked.has(to.id)) continue
      const nearest = [...froms].sort(
        (a, b) => Math.abs(a.y - to.y) - Math.abs(b.y - to.y),
      )[0]
      edges.push({ from: nearest.id, to: to.id })
    }
  }

  return { nodes, edges }
}

// ── Scene ─────────────────────────────────────────────────────

export class MapScene extends Phaser.Scene {
  private nodes: MapNode[] = []
  private edges: MapEdge[] = []
  private currentNodeId: number | null = null
  private hoveredNodeId: number | null = null
  private nodeG!: Phaser.GameObjects.Graphics
  private runState!: RunState

  constructor() {
    super('MapScene')
  }

  init() {
    this.children.removeAll(true)
    this.currentNodeId = null
    this.hoveredNodeId = null
  }

  create() {
    const { width, height } = this.cameras.main

    let rs = getRunState(this)
    if (!rs) {
      rs = SaveSystem.load('quicksave') ?? createDebugState(1)
    }
    this.runState = rs
    renderDebugHeader(this, rs)

    const { nodes, edges } = generateMap()
    this.nodes = nodes
    this.edges = edges

    const lineG = this.add.graphics()
    lineG.lineStyle(1, 0x333333, 0.8)
    for (const edge of edges) {
      const from = nodes.find(n => n.id === edge.from)!
      const to = nodes.find(n => n.id === edge.to)!
      lineG.beginPath()
      lineG.moveTo(from.x, from.y)
      lineG.lineTo(to.x, to.y)
      lineG.strokePath()
    }
    lineG.setDepth(0)

    this.nodeG = this.add.graphics()
    this.nodeG.setDepth(1)
    this.drawNodes()

    this.add
      .text(width / 2, height - 10, 'click node | ESC: menu', {
        fontSize: '5px',
        color: '#444444',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(10)

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
  }

  // ── helpers ─────────────────────────────────────────────────

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
    this.nodeG.clear()
    for (const node of this.nodes) {
      let color: number
      if (node.id === this.hoveredNodeId) {
        color = 0xcccccc
      } else if (node.id === this.currentNodeId) {
        color = 0xffffff
      } else if (node.type === 'start') {
        color = 0x44aa44
      } else if (node.type === 'boss') {
        color = 0xcc3333
      } else {
        color = 0x888888
      }

      if (!this.isReachable(node)) {
        color = dimColor(color)
      }

      this.nodeG.fillStyle(color, 1)
      this.nodeG.fillCircle(node.x, node.y, node.type === 'boss' ? NODE_R + 2 : NODE_R)
    }
  }

  private isReachable(node: MapNode): boolean {
    if (this.currentNodeId === null) {
      return node.type === 'start'
    }
    const cur = this.nodes.find(n => n.id === this.currentNodeId)!
    if (node.col <= cur.col) return false
    return this.edges.some(e => e.from === cur.id && e.to === node.id)
  }

  private selectNode(node: MapNode) {
    if (!this.isReachable(node)) return

    this.currentNodeId = node.id
    this.drawNodes()

    this.runState.floor += 1
    SaveSystem.save('quicksave', this.runState)

    this.time.delayedCall(200, () => {
      this.scene.start('CombatScene', { runState: this.runState })
    })
  }
}

function dimColor(c: number): number {
  const r = ((c >> 16) & 0xff) * 0.35
  const g = ((c >> 8) & 0xff) * 0.35
  const b = (c & 0xff) * 0.35
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

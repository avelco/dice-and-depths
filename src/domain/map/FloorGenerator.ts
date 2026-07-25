import type { MapNodeKind } from './NodeTypes'
import type { MapEdgeSnapshot, MapNodeSnapshot, MapSnapshot } from '../progression/RunState'

const COLS = 5
const START_X = 36
const END_X = 444
const COL_SPACING = Math.round((END_X - START_X) / (COLS - 1))
const TOP_Y = 28
const BOT_Y = 240

const MID_TYPES: MapNodeKind[] = [
  'combat', 'combat', 'combat', 'combat',
  'elite', 'event', 'shop', 'rest',
]

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickMidType(rng: () => number, col: number, floor: number): MapNodeKind {
  const pool = [...MID_TYPES]
  if (floor === 1 && col === 1) return 'combat'
  const idx = Math.floor(rng() * pool.length)
  return pool[idx] ?? 'combat'
}

export function generateFloorMap(seed: number, floor: number): MapSnapshot {
  const rng = mulberry32(seed + floor * 997)
  const nodes: MapNodeSnapshot[] = []
  const edges: MapEdgeSnapshot[] = []
  let id = 0
  const counts = [1, 3, 3, 3, 1]

  for (let col = 0; col < COLS; col++) {
    const baseX = START_X + col * COL_SPACING
    const count = counts[col]
    const slots: number[] = []

    if (count === 1) {
      slots.push((TOP_Y + BOT_Y) / 2 + (rng() * 24 - 12))
    } else {
      const band = (BOT_Y - TOP_Y) / count
      for (let i = 0; i < count; i++) {
        const lo = TOP_Y + band * i + 8
        const hi = TOP_Y + band * (i + 1) - 8
        slots.push(lo + rng() * (hi - lo))
      }
      slots.sort((a, b) => a - b)
    }

    for (let i = 0; i < count; i++) {
      let kind: MapNodeKind = 'combat'
      if (col === 0) kind = 'start'
      else if (col === COLS - 1) kind = 'boss'
      else kind = pickMidType(rng, col, floor)

      const jitterX = col > 0 && col < COLS - 1 ? rng() * 36 - 18 : 0
      nodes.push({
        id: id++,
        col,
        kind,
        x: baseX + jitterX,
        y: slots[i],
        cleared: col === 0,
      })
    }
  }

  for (let col = 0; col < COLS - 1; col++) {
    const froms = nodes.filter(n => n.col === col)
    const tos = nodes.filter(n => n.col === col + 1)
    const linked = new Set<number>()

    for (const from of froms) {
      const sorted = [...tos].sort(
        (a, b) => Math.abs(a.y - from.y) - Math.abs(b.y - from.y),
      )
      const targets = tos.length === 1 ? 1 : 1 + (rng() < 0.55 ? 1 : 0)
      for (let t = 0; t < targets && t < sorted.length; t++) {
        edges.push({ from: from.id, to: sorted[t].id })
        linked.add(sorted[t].id)
      }
    }

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

export function nodeColor(kind: MapNodeKind): number {
  switch (kind) {
    case 'start': return 0x44aa44
    case 'boss': return 0xcc3333
    case 'combat': return 0x888888
    case 'elite': return 0xcc6622
    case 'event': return 0x8866cc
    case 'shop': return 0xccaa44
    case 'rest': return 0x44aaaa
    default: return 0x888888
  }
}

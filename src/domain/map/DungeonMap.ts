import dungeonsData from '../../data/dungeons.json'
import type { MapNodeKind } from './NodeTypes'
import type { MapEdgeSnapshot, MapNodeSnapshot, MapSnapshot } from '../progression/RunState'

export const MAX_CAMPAIGN_FLOOR = 5

const START_X = 40
const COL_SPACING = 56
const TOP_Y = 48
const BOT_Y = 210
const LANES = 3

export interface DungeonNodeDef {
  id: number
  col: number
  lane: number
  kind: MapNodeKind
}

export interface DungeonDef {
  id: string
  name: string
  floor: number
  nodes: DungeonNodeDef[]
  edges: MapEdgeSnapshot[]
}

const DUNGEONS = (dungeonsData as { dungeons: DungeonDef[] }).dungeons

function laneY(lane: number): number {
  const t = Math.min(LANES - 1, Math.max(0, lane)) / (LANES - 1)
  return Math.round(TOP_Y + t * (BOT_Y - TOP_Y))
}

function validateDungeon(d: DungeonDef) {
  const starts = d.nodes.filter(n => n.kind === 'start')
  const bosses = d.nodes.filter(n => n.kind === 'boss')
  if (starts.length !== 1) {
    throw new Error(`[dungeons] ${d.id}: expected 1 start, got ${starts.length}`)
  }
  if (bosses.length !== 1) {
    throw new Error(`[dungeons] ${d.id}: expected 1 boss, got ${bosses.length}`)
  }
  const ids = new Set(d.nodes.map(n => n.id))
  for (const e of d.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      throw new Error(`[dungeons] ${d.id}: edge ${e.from}->${e.to} references missing node`)
    }
    const from = d.nodes.find(n => n.id === e.from)!
    const to = d.nodes.find(n => n.id === e.to)!
    if (to.col !== from.col + 1) {
      throw new Error(
        `[dungeons] ${d.id}: edge ${e.from}->${e.to} must connect col→col+1`,
      )
    }
  }
}

/** Pixel width of the map world for camera bounds. */
export function dungeonMapWidth(floor: number): number {
  const d = getDungeonDef(floor)
  const maxCol = Math.max(...d.nodes.map(n => n.col))
  return START_X + maxCol * COL_SPACING + 40
}

export function getDungeonDef(floor: number): DungeonDef {
  const d = DUNGEONS.find(x => x.floor === floor)
  if (!d) {
    throw new Error(`[dungeons] no dungeon for floor ${floor}`)
  }
  return d
}

/** Load authored dungeon layout for campaign floor (1–5). */
export function loadDungeonMap(floor: number): MapSnapshot {
  const d = getDungeonDef(floor)
  validateDungeon(d)

  const nodes: MapNodeSnapshot[] = d.nodes.map(n => ({
    id: n.id,
    col: n.col,
    kind: n.kind,
    x: START_X + n.col * COL_SPACING,
    y: laneY(n.lane),
    cleared: false,
  }))

  const edges: MapEdgeSnapshot[] = d.edges.map(e => ({
    from: e.from,
    to: e.to,
  }))

  return { nodes, edges }
}

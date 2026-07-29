import type { MapSnapshot } from '../progression/RunState'
import {
  generateDungeonMap,
  mapWorldHeight,
  mapWorldWidth,
  MAX_CAMPAIGN_FLOOR,
} from './MazeGenerator'

export {
  MAX_CAMPAIGN_FLOOR,
  generateDungeonMap,
  mapWorldWidth,
  mapWorldHeight,
}
export { getDungeonRecipe } from './MazeGenerator'

/** Generate procedural maze for campaign floor (seeded). */
export function loadDungeonMap(floor: number, seed: number): MapSnapshot {
  return generateDungeonMap(floor, seed)
}

/** Camera / world width for a map snapshot. */
export function dungeonMapWidth(map: MapSnapshot): number {
  return mapWorldWidth(map)
}

/** Camera / world height for a map snapshot. */
export function dungeonMapHeight(map: MapSnapshot): number {
  return mapWorldHeight(map)
}

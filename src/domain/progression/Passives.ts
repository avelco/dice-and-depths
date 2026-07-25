import passivesData from '../../data/passives.json'
import type { RunState } from './RunState'

export interface PassiveDef {
  id: string
  name: string
  description: string
}

export const PASSIVES: PassiveDef[] = passivesData as PassiveDef[]

export function hasPassive(state: RunState, id: string): boolean {
  return state.passives.includes(id)
}

export function passiveDef(id: string): PassiveDef | undefined {
  return PASSIVES.find(p => p.id === id)
}

export function pickRandomPassiveIds(count: number, exclude: string[], rng: () => number): string[] {
  const pool = PASSIVES.map(p => p.id).filter(id => !exclude.includes(id))
  const out: string[] = []
  while (out.length < count && pool.length > 0) {
    const i = Math.floor(rng() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

export type DieFaces = [number, number, number, number, number, number]

export const STANDARD_FACES: DieFaces = [1, 2, 3, 4, 5, 6]

export interface RunDie {
  id: string
  faces: DieFaces
  abilityId: string | null
}

export function makeDie(
  id: string,
  abilityId: string | null = null,
  faces: DieFaces = STANDARD_FACES,
): RunDie {
  return { id, faces: [...faces] as DieFaces, abilityId }
}

export function makeBasicDice(count: number, idOffset = 0): RunDie[] {
  return Array.from({ length: count }, (_, i) =>
    makeDie(`d${idOffset + i}`),
  )
}

/** Roll a face from the die's face table. */
export function rollDie(die: RunDie): number {
  return die.faces[Math.floor(Math.random() * die.faces.length)]!
}

/** Average face value — used to pick the weakest die for engraving. */
export function dieAverage(die: RunDie): number {
  return die.faces.reduce((a, b) => a + b, 0) / die.faces.length
}

export function nextDieId(dice: RunDie[]): string {
  let max = -1
  for (const d of dice) {
    const m = /^d(\d+)$/.exec(d.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `d${max + 1}`
}

/** Visible AI: only reroll natural 1s (less optimized than the player). */
export class EnemyAI {
  static chooseRerollIndex(values: number[]): number | null {
    if (values.length === 0) return null
    let best = 0
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[best]) best = i
    }
    return values[best] <= 1 ? best : null
  }
}

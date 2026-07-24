import { Enemy } from '../enemies/Enemy'

export interface CombatResult {
  atkTotal: number
  atkCombo: number
  defTotal: number
  defCombo: number
  multiplier: number
  rawDamage: number
  finalDamage: number
  killed: boolean
}

export interface DicePower {
  total: number
  combo: number
}

export class CombatEngine {
  static computePower(dice: number[]): DicePower {
    const sum = dice.reduce((a, b) => a + b, 0)
    if (dice.length <= 1) return { total: sum, combo: 0 }

    const counts = new Map<number, number>()
    for (const v of dice) counts.set(v, (counts.get(v) ?? 0) + 1)

    let combo = 0
    for (const [value, count] of counts) {
      if (count >= 2) {
        combo += value * (count - 1)
      }
    }

    return { total: sum + combo, combo }
  }

  static resolve(
    atkDice: number[],
    defDice: number[],
    mulDie: number,
    enemy: Enemy,
  ): CombatResult {
    const atk = CombatEngine.computePower(atkDice)
    const def = CombatEngine.computePower(defDice)

    // (suma + combo − defensa) × multiplicador
    const rawDamage = Math.max(1, atk.total - enemy.defense)
    const finalDamage = rawDamage * mulDie
    enemy.hp = Math.max(0, enemy.hp - finalDamage)

    return {
      atkTotal: atk.total,
      atkCombo: atk.combo,
      defTotal: def.total,
      defCombo: def.combo,
      multiplier: mulDie,
      rawDamage,
      finalDamage,
      killed: !enemy.alive,
    }
  }

  static enemyAttack(
    floor: number,
    heroDefense: number,
  ): { damage: number; blocked: number; overflow: number } {
    const enemyAtk = floor * 2 + Math.floor(Math.random() * 5) + 1
    const blocked = Math.min(heroDefense, enemyAtk)
    const overflow = Math.max(0, enemyAtk - heroDefense)
    return { damage: enemyAtk, blocked, overflow }
  }
}

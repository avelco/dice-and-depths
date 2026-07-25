import { Enemy } from '../enemies/Enemy'
import type { RunState } from '../progression/RunState'
import { hasPassive } from '../progression/Passives'

export interface CombatResult {
  atkTotal: number
  atkCombo: number
  defTotal: number
  defCombo: number
  multiplier: number
  rawDamage: number
  finalDamage: number
  killed: boolean
  phaseBlocked: boolean
}

export interface DicePower {
  total: number
  combo: number
}

export interface EnemyTurnResult {
  damage: number
  blocked: number
  overflow: number
  goldStolen: number
}

export class CombatEngine {
  static computePower(dice: number[]): DicePower {
    const sum = dice.reduce((a, b) => a + b, 0)
    if (dice.length <= 1) return { total: sum, combo: 0 }

    const counts = new Map<number, number>()
    for (const v of dice) counts.set(v, (counts.get(v) ?? 0) + 1)

    let combo = 0
    for (const [value, count] of counts) {
      if (count >= 2) combo += value * (count - 1)
    }

    return { total: sum + combo, combo }
  }

  static heroDefTotal(defDice: number[], state: RunState): number {
    const def = CombatEngine.computePower(defDice)
    let total = def.total
    if (hasPassive(state, 'iron_skin')) total += 2
    return total
  }

  static resolve(
    atkDice: number[],
    defDice: number[],
    mulDie: number,
    enemy: Enemy,
    state: RunState,
  ): CombatResult {
    const atk = CombatEngine.computePower(atkDice)
    const defTotal = CombatEngine.heroDefTotal(defDice, state)

    if (enemy.skill === 'phase' && Math.random() < 0.25) {
      return {
        atkTotal: atk.total,
        atkCombo: atk.combo,
        defTotal,
        defCombo: CombatEngine.computePower(defDice).combo,
        multiplier: mulDie,
        rawDamage: 0,
        finalDamage: 0,
        killed: false,
        phaseBlocked: true,
      }
    }

    const rawDamage = Math.max(1, atk.total - enemy.totalDefense)
    let finalDamage = rawDamage * mulDie
    if (hasPassive(state, 'heavy_hit')) finalDamage += 2

    enemy.hp = Math.max(0, enemy.hp - finalDamage)

    if (enemy.skill === 'split' && enemy.alive) {
      enemy.bonusDef += 2
    }

    return {
      atkTotal: atk.total,
      atkCombo: atk.combo,
      defTotal,
      defCombo: CombatEngine.computePower(defDice).combo,
      multiplier: mulDie,
      rawDamage,
      finalDamage,
      killed: !enemy.alive,
      phaseBlocked: false,
    }
  }

  static enemyAttack(
    floor: number,
    heroDefense: number,
    enemy: Enemy,
  ): EnemyTurnResult {
    enemy.turnCount += 1
    let enemyAtk = floor * 2 + Math.floor(Math.random() * 5) + 1

    if (enemy.skill === 'slam' && enemy.turnCount % 2 === 0) {
      enemyAtk *= 2
    }

    let effectiveDef = heroDefense
    if (enemy.skill === 'bone_toss') {
      effectiveDef = Math.floor(heroDefense * 0.5)
    }

    const blocked = Math.min(effectiveDef, enemyAtk)
    const overflow = Math.max(0, enemyAtk - effectiveDef)
    let goldStolen = 0

    return { damage: enemyAtk, blocked, overflow, goldStolen }
  }

  static applySteal(state: RunState, overflow: number): number {
    if (overflow <= 0) return 0
    const stolen = Math.min(5, state.gold)
    state.gold -= stolen
    return stolen
  }
}

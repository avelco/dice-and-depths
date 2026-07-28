import { Enemy } from '../enemies/Enemy'
import type { RunState } from '../progression/RunState'
import { hasPassive } from '../progression/Passives'

export interface CombatResult {
  atkTotal: number
  atkCombo: number
  defTotal: number
  defCombo: number
  rawDamage: number
  finalDamage: number
  killed: boolean
  phaseBlocked: boolean
}

export interface DicePower {
  total: number
  combo: number
}

export interface DefensePower {
  total: number
  parts: string[]
}

export interface EnemyTurnResult {
  damage: number
  blocked: number
  overflow: number
  remainingDef: number
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

  /** DEF from matching dice only: pair×1, trio×3, quad+×6. */
  static computeDefense(dice: number[]): DefensePower {
    const counts = new Map<number, number>()
    for (const v of dice) counts.set(v, (counts.get(v) ?? 0) + 1)

    let total = 0
    const parts: string[] = []
    const values = [...counts.keys()].sort((a, b) => a - b)
    for (const value of values) {
      const count = counts.get(value) ?? 0
      if (count < 2) continue
      const mult = count >= 4 ? 6 : count === 3 ? 3 : 1
      total += value * mult
      parts.push(`${value}x${count >= 4 ? 4 : count}`)
    }
    return { total, parts }
  }

  static heroDefTotal(atkDice: number[], state: RunState): number {
    let total = CombatEngine.computeDefense(atkDice).total
    if (hasPassive(state, 'iron_skin')) total += 2
    total += state.bonusDefFlat
    return total
  }

  static resolve(
    atkDice: number[],
    enemy: Enemy,
    state: RunState,
    carriedDef = 0,
  ): CombatResult {
    const atk = CombatEngine.computePower(atkDice)
    const def = CombatEngine.computeDefense(atkDice)
    const rollDef = CombatEngine.heroDefTotal(atkDice, state)
    const defTotal = carriedDef + rollDef

    if (enemy.skill === 'phase' && Math.random() < 0.25) {
      return {
        atkTotal: atk.total,
        atkCombo: atk.combo,
        defTotal,
        defCombo: def.total,
        rawDamage: 0,
        finalDamage: 0,
        killed: false,
        phaseBlocked: true,
      }
    }

    const rawDamage = Math.max(1, atk.total - enemy.totalDefense)
    let finalDamage = rawDamage
    if (hasPassive(state, 'heavy_hit')) finalDamage += 2
    finalDamage += state.bonusDmgFlat

    enemy.hp = Math.max(0, enemy.hp - finalDamage)

    if (enemy.skill === 'split' && enemy.alive) {
      enemy.bonusDef += 2
    }

    return {
      atkTotal: atk.total,
      atkCombo: atk.combo,
      defTotal,
      defCombo: def.total,
      rawDamage,
      finalDamage,
      killed: !enemy.alive,
      phaseBlocked: false,
    }
  }

  static enemyAttack(
    atkDice: number[],
    heroDefense: number,
    enemy: Enemy,
  ): EnemyTurnResult {
    enemy.turnCount += 1
    const power = CombatEngine.computePower(atkDice)
    let enemyAtk = power.total

    if (enemy.skill === 'slam' && enemy.turnCount % 2 === 0) {
      enemyAtk *= 2
    }

    // bone_toss: only half the shield can absorb; the rest is pierce
    let absorbCap = heroDefense
    if (enemy.skill === 'bone_toss') {
      absorbCap = Math.floor(heroDefense * 0.5)
    }

    const blocked = Math.min(absorbCap, enemyAtk)
    const overflow = Math.max(0, enemyAtk - absorbCap)
    // Never leave shield up if HP was hit (pierce / break)
    const remainingDef = overflow > 0 ? 0 : Math.max(0, heroDefense - blocked)

    return { damage: enemyAtk, blocked, overflow, remainingDef, goldStolen: 0 }
  }

  static applySteal(state: RunState, overflow: number): number {
    if (overflow <= 0) return 0
    const stolen = Math.min(5, state.coins)
    state.coins -= stolen
    return stolen
  }
}

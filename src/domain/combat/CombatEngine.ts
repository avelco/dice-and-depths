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
  heal: number
  killed: boolean
  phaseBlocked: boolean
}

export interface DicePower {
  total: number
  combo: number
  bestMatch: number
  isMonster: boolean
}

export interface DefensePower {
  total: number
  parts: string[]
}

export interface HeroAtkBreakdown {
  power: DicePower
  mageBonus: number
  barbBonus: number
  total: number
}

export interface EnemyTurnResult {
  damage: number
  blocked: number
  overflow: number
  remainingDef: number
  goldStolen: number
}

export type ComboCalloutKey =
  | 'combat.combo.awesome'
  | 'combat.combo.triple'
  | 'combat.combo.super'
  | 'combat.combo.hyper'
  | 'combat.combo.brutal'
  | 'combat.combo.master'
  | 'combat.combo.killer'
  | 'combat.combo.king'
  | 'combat.combo.monster'

export interface ComboTier {
  bestMatch: number
  isMonster: boolean
  calloutKey: ComboCalloutKey | null
}

export class CombatEngine {
  /** ATK = sum + Σ (count × face) for each face with count ≥ 2. */
  static computePower(dice: number[]): DicePower {
    const sum = dice.reduce((a, b) => a + b, 0)
    if (dice.length <= 1) {
      return { total: sum, combo: 0, bestMatch: dice.length, isMonster: false }
    }

    const counts = new Map<number, number>()
    for (const v of dice) counts.set(v, (counts.get(v) ?? 0) + 1)

    let combo = 0
    let bestMatch = 1
    for (const [value, count] of counts) {
      if (count > bestMatch) bestMatch = count
      if (count >= 2) combo += value * count
    }

    const isMonster = bestMatch === dice.length && dice.length >= 2
    return { total: sum + combo, combo, bestMatch, isMonster }
  }

  /**
   * Mago: best face among 5–6 counts double.
   * If that face is in a combo, bonus = its combo term (value×count); else +face.
   */
  static mageHighFaceBonus(dice: number[]): number {
    const counts = new Map<number, number>()
    for (const v of dice) counts.set(v, (counts.get(v) ?? 0) + 1)
    let bestFace = 0
    for (const face of [6, 5]) {
      if ((counts.get(face) ?? 0) > 0) {
        bestFace = face
        break
      }
    }
    if (bestFace === 0) return 0
    const count = counts.get(bestFace) ?? 0
    return count >= 2 ? bestFace * count : bestFace
  }

  static heroAtkTotal(
    dice: number[],
    state: RunState,
    rerollsSpent = 0,
  ): HeroAtkBreakdown {
    const power = CombatEngine.computePower(dice)
    const mageBonus =
      state.characterName === 'Mago' ? CombatEngine.mageHighFaceBonus(dice) : 0
    const barbBonus =
      state.characterName === 'Bárbaro' && rerollsSpent === 0
        ? Math.floor(power.total * 0.2)
        : 0
    return {
      power,
      mageBonus,
      barbBonus,
      total: power.total + mageBonus + barbBonus,
    }
  }

  /** Callout tier from dice faces. Null if no match (bestMatch < 2). */
  static comboTier(dice: number[]): ComboTier {
    const { bestMatch, isMonster } = CombatEngine.computePower(dice)
    if (bestMatch < 2) {
      return { bestMatch, isMonster: false, calloutKey: null }
    }
    if (isMonster) {
      return { bestMatch, isMonster: true, calloutKey: 'combat.combo.monster' }
    }
    return {
      bestMatch,
      isMonster: false,
      calloutKey: CombatEngine.calloutForMatch(bestMatch),
    }
  }

  static calloutForMatch(bestMatch: number): ComboCalloutKey | null {
    if (bestMatch < 2) return null
    if (bestMatch === 2) return 'combat.combo.awesome'
    if (bestMatch === 3) return 'combat.combo.triple'
    if (bestMatch === 4) return 'combat.combo.super'
    if (bestMatch === 5) return 'combat.combo.hyper'
    if (bestMatch === 6) return 'combat.combo.brutal'
    if (bestMatch === 7) return 'combat.combo.master'
    if (bestMatch === 8) return 'combat.combo.killer'
    return 'combat.combo.king'
  }

  /**
   * DEF from matching dice only: pair×1, trio×3, quad+×6.
   * Paladín: one tier up → pair×3, trio×6, quad+×12.
   */
  static computeDefense(
    dice: number[],
    opts?: { defTierUp?: boolean },
  ): DefensePower {
    const counts = new Map<number, number>()
    for (const v of dice) counts.set(v, (counts.get(v) ?? 0) + 1)

    let total = 0
    const parts: string[] = []
    const values = [...counts.keys()].sort((a, b) => a - b)
    for (const value of values) {
      const count = counts.get(value) ?? 0
      if (count < 2) continue
      let mult = count >= 4 ? 6 : count === 3 ? 3 : 1
      if (opts?.defTierUp) mult = count >= 4 ? 12 : count === 3 ? 6 : 3
      total += value * mult
      parts.push(`${value}x${count >= 4 ? 4 : count}`)
    }
    return { total, parts }
  }

  static heroDefTotal(atkDice: number[], state: RunState): number {
    const defTierUp = state.characterName === 'Paladín'
    let total = CombatEngine.computeDefense(atkDice, { defTierUp }).total
    if (hasPassive(state, 'iron_skin')) total += 2
    total += state.bonusDefFlat
    return total
  }

  static resolve(
    atkDice: number[],
    enemy: Enemy,
    state: RunState,
    carriedDef = 0,
    rerollsSpent = 0,
  ): CombatResult {
    const atk = CombatEngine.heroAtkTotal(atkDice, state, rerollsSpent)
    const defTierUp = state.characterName === 'Paladín'
    const def = CombatEngine.computeDefense(atkDice, { defTierUp })
    const rollDef = CombatEngine.heroDefTotal(atkDice, state)
    const defTotal = carriedDef + rollDef

    if (enemy.skill === 'phase' && Math.random() < 0.25) {
      return {
        atkTotal: atk.total,
        atkCombo: atk.power.combo,
        defTotal,
        defCombo: def.total,
        rawDamage: 0,
        finalDamage: 0,
        heal: 0,
        killed: false,
        phaseBlocked: true,
      }
    }

    const rawDamage = Math.max(1, atk.total - enemy.totalDefense)
    let finalDamage = rawDamage
    if (hasPassive(state, 'heavy_hit')) finalDamage += 2
    finalDamage += state.bonusDmgFlat

    const hpBefore = enemy.hp
    enemy.hp = Math.max(0, enemy.hp - finalDamage)

    let heal = 0
    if (state.characterName === 'Clérigo') {
      const overkill = Math.max(0, finalDamage - hpBefore)
      heal = Math.floor(overkill / 2)
      if (heal > 0) {
        state.hp = Math.min(state.maxHp, state.hp + heal)
      }
    }

    if (enemy.skill === 'split' && enemy.alive) {
      enemy.bonusDef += 2
    }

    return {
      atkTotal: atk.total,
      atkCombo: atk.power.combo,
      defTotal,
      defCombo: def.total,
      rawDamage,
      finalDamage,
      heal,
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

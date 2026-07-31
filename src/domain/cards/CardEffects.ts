import { effectsOf, type RunCard } from './Card'

export interface CombatActor {
  hp: number
  maxHp: number
  shield: number
  poison: number
}

export interface TurnPreview {
  damage: number
  poison: number
  shield: number
  heal: number
}

export function previewCards(cards: RunCard[]): TurnPreview {
  const out: TurnPreview = { damage: 0, poison: 0, shield: 0, heal: 0 }
  for (const card of cards) {
    for (const e of effectsOf(card)) {
      out[e.type] += e.value
    }
  }
  return out
}

/** Apply damage through shield. Returns HP lost. */
export function applyDamage(target: CombatActor, amount: number): number {
  if (amount <= 0) return 0
  const absorbed = Math.min(target.shield, amount)
  target.shield -= absorbed
  const hpLoss = amount - absorbed
  target.hp = Math.max(0, target.hp - hpLoss)
  return hpLoss
}

export function applyHeal(target: CombatActor, amount: number): number {
  if (amount <= 0) return 0
  const before = target.hp
  target.hp = Math.min(target.maxHp, target.hp + amount)
  return target.hp - before
}

export function applyShield(target: CombatActor, amount: number): void {
  if (amount > 0) target.shield += amount
}

export function applyPoison(target: CombatActor, amount: number): void {
  if (amount > 0) target.poison += amount
}

/**
 * Resolve slotted cards in order against target (damage/poison)
 * and self (shield/heal).
 */
export function resolveCardPlays(
  cards: RunCard[],
  self: CombatActor,
  target: CombatActor,
): TurnPreview {
  const applied: TurnPreview = { damage: 0, poison: 0, shield: 0, heal: 0 }
  for (const card of cards) {
    for (const e of effectsOf(card)) {
      switch (e.type) {
        case 'damage':
          applied.damage += applyDamage(target, e.value)
          break
        case 'poison':
          applyPoison(target, e.value)
          applied.poison += e.value
          break
        case 'shield':
          applyShield(self, e.value)
          applied.shield += e.value
          break
        case 'heal':
          applied.heal += applyHeal(self, e.value)
          break
      }
    }
  }
  return applied
}

/** Poison tick at start of actor's turn: lose HP equal to stacks, then −1 stack. */
export function tickPoison(actor: CombatActor): number {
  if (actor.poison <= 0) return 0
  const dmg = actor.poison
  actor.hp = Math.max(0, actor.hp - dmg)
  actor.poison = Math.max(0, actor.poison - 1)
  return dmg
}

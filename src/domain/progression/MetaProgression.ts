export interface MetaSave {
  metaDust: number
  unlockExtraMaxHp: boolean
  unlockExtraGold: boolean
  unlockRogue: boolean
}

const META_KEY = 'dnd_meta_v1'

const UNLOCK_COST = {
  extraMaxHp: 50,
  extraGold: 40,
  unlockRogue: 80,
} as const

export class MetaProgression {
  static load(): MetaSave {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) {
      return {
        metaDust: 0,
        unlockExtraMaxHp: false,
        unlockExtraGold: false,
        unlockRogue: false,
      }
    }
    try {
      const data = JSON.parse(raw) as Partial<MetaSave>
      return {
        metaDust: data.metaDust ?? 0,
        unlockExtraMaxHp: !!data.unlockExtraMaxHp,
        unlockExtraGold: !!data.unlockExtraGold,
        unlockRogue: !!data.unlockRogue,
      }
    } catch {
      return {
        metaDust: 0,
        unlockExtraMaxHp: false,
        unlockExtraGold: false,
        unlockRogue: false,
      }
    }
  }

  static save(meta: MetaSave) {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  }

  static dustForRun(floor: number, gold: number): number {
    return Math.floor(floor * 3 + gold / 10)
  }

  static applyStartBonuses(state: import('./RunState').RunState) {
    const meta = MetaProgression.load()
    if (meta.unlockExtraMaxHp) {
      state.maxHp += 5
      state.hp = Math.min(state.hp + 5, state.maxHp)
    }
    if (meta.unlockExtraGold) state.gold += 10
  }

  static tryPurchase(unlock: keyof typeof UNLOCK_COST): boolean {
    const meta = MetaProgression.load()
    const cost = UNLOCK_COST[unlock]
    if (meta.metaDust < cost) return false

    if (unlock === 'extraMaxHp' && meta.unlockExtraMaxHp) return false
    if (unlock === 'extraGold' && meta.unlockExtraGold) return false
    if (unlock === 'unlockRogue' && meta.unlockRogue) return false

    meta.metaDust -= cost
    if (unlock === 'extraMaxHp') meta.unlockExtraMaxHp = true
    if (unlock === 'extraGold') meta.unlockExtraGold = true
    if (unlock === 'unlockRogue') meta.unlockRogue = true
    MetaProgression.save(meta)
    return true
  }

  static getUnlockCost(unlock: keyof typeof UNLOCK_COST): number {
    return UNLOCK_COST[unlock]
  }

  static isRogueUnlocked(): boolean {
    return MetaProgression.load().unlockRogue
  }
}

import { STARTER_GEAR_IDS } from '../items/Equipment'
import { STARTER_RUNE_IDS } from '../items/Runes'
import type { GearSlot } from '../items/Item'
import { GEAR_SLOTS, RUNE_SLOT_COUNT } from '../items/Item'
import { gearDef } from '../items/Equipment'
import { runeDef } from '../items/Runes'
import {
  FORGE_REROLL_COST,
  affixDef,
  rollAffix,
} from '../items/Affixes'
import { setLocale, type Locale } from '../../i18n/I18n'
import {
  canUnlock as skillTreeCanUnlock,
  skillTreeNode,
  unlockedPassiveIds,
} from './SkillTree'

export interface GearForgeState {
  appliedAffixId: string | null
  pendingAffixId: string | null
}

export type GearLoadoutMap = Record<GearSlot, string | null>
export type RuneLoadoutTuple = [string | null, string | null, string | null]

export interface MetaInventory {
  gear: string[]
  runes: string[]
}

export interface MetaLoadout {
  gear: GearLoadoutMap
  runes: RuneLoadoutTuple
}

export interface MetaSave {
  /** Global game currency (oro). Persists between runs. */
  gold: number
  /** Next floor to start when descending (1–5). */
  campaignFloor: number
  inventory: MetaInventory
  loadout: MetaLoadout
  locale: Locale
  /** Spendable skill-tree points (first clear per floor). */
  skillPoints: number
  /** Total depth points ever earned. */
  skillPointsEarned: number
  /** Floors whose boss already granted a skill point. */
  depthCleared: number[]
  /** Purchased skill-tree node ids. */
  unlockedTreeNodes: string[]
  /** Fragments per gear slot (forge + future set upgrades). */
  fragments: Record<GearSlot, number>
  /** Forge affix state keyed by gear id. */
  gearForge: Record<string, GearForgeState>
  /** First-run onboarding finished (veterans without flag load as true). */
  tutorialDone: boolean
}

const META_KEY = 'dnd_meta_v1'

function emptyGearLoadout(): GearLoadoutMap {
  return { hat: null, cape: null, belt: null, ring: null, boots: null }
}

function emptyRuneLoadout(): RuneLoadoutTuple {
  return [null, null, null]
}

function starterInventory(): MetaInventory {
  return {
    gear: [...STARTER_GEAR_IDS],
    runes: [...STARTER_RUNE_IDS],
  }
}

function normalizeDepthCleared(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const v of raw) {
    if (typeof v !== 'number') continue
    const n = Math.floor(v)
    if (n >= 1 && n <= 5 && !out.includes(n)) out.push(n)
  }
  return out.sort((a, b) => a - b)
}

function normalizeTreeNodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const id of raw) {
    if (typeof id === 'string' && skillTreeNode(id) && !out.includes(id)) {
      out.push(id)
    }
  }
  return out
}

function emptyFragments(): Record<GearSlot, number> {
  return { hat: 0, cape: 0, belt: 0, ring: 0, boots: 0 }
}

function normalizeFragments(raw: unknown): Record<GearSlot, number> {
  const out = emptyFragments()
  if (!raw || typeof raw !== 'object') return out
  const obj = raw as Partial<Record<GearSlot, number>>
  for (const slot of GEAR_SLOTS) {
    const n = obj[slot]
    out[slot] = typeof n === 'number' && n > 0 ? Math.floor(n) : 0
  }
  return out
}

function emptyForgeState(): GearForgeState {
  return { appliedAffixId: null, pendingAffixId: null }
}

function normalizeGearForge(raw: unknown): Record<string, GearForgeState> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, GearForgeState> = {}
  for (const [gearId, state] of Object.entries(raw as Record<string, unknown>)) {
    if (!gearDef(gearId) || !state || typeof state !== 'object') continue
    const s = state as Partial<GearForgeState>
    const applied =
      typeof s.appliedAffixId === 'string' && affixDef(s.appliedAffixId)
        ? s.appliedAffixId
        : null
    const pending =
      typeof s.pendingAffixId === 'string' && affixDef(s.pendingAffixId)
        ? s.pendingAffixId
        : null
    if (applied || pending) {
      out[gearId] = { appliedAffixId: applied, pendingAffixId: pending }
    }
  }
  return out
}

function defaultMeta(): MetaSave {
  return {
    gold: 0,
    campaignFloor: 1,
    inventory: starterInventory(),
    loadout: {
      gear: emptyGearLoadout(),
      runes: emptyRuneLoadout(),
    },
    locale: 'es',
    skillPoints: 0,
    skillPointsEarned: 0,
    depthCleared: [],
    unlockedTreeNodes: [],
    fragments: emptyFragments(),
    gearForge: {},
    tutorialDone: false,
  }
}

function normalizeCampaignFloor(raw: unknown): number {
  const n = typeof raw === 'number' ? Math.floor(raw) : 1
  return Math.min(5, Math.max(1, n))
}

function normalizeLocale(raw: unknown): Locale {
  return raw === 'en' ? 'en' : 'es'
}

function normalizeGearLoadout(raw: unknown): GearLoadoutMap {
  const g = (raw ?? {}) as Partial<Record<GearSlot, string | null>>
  const out = emptyGearLoadout()
  for (const slot of GEAR_SLOTS) {
    const id = g[slot]
    out[slot] = typeof id === 'string' && gearDef(id) ? id : null
  }
  return out
}

function normalizeRuneLoadout(raw: unknown): RuneLoadoutTuple {
  const arr = Array.isArray(raw) ? raw : []
  const out: RuneLoadoutTuple = emptyRuneLoadout()
  for (let i = 0; i < RUNE_SLOT_COUNT; i++) {
    const id = arr[i]
    out[i] = typeof id === 'string' && runeDef(id) ? id : null
  }
  return out
}

function normalizeInventory(raw: unknown, loadout: MetaLoadout): MetaInventory {
  const inv = (raw ?? {}) as Partial<MetaInventory>
  let gear = Array.isArray(inv.gear)
    ? inv.gear.filter((id): id is string => typeof id === 'string' && !!gearDef(id))
    : [...STARTER_GEAR_IDS]
  let runes = Array.isArray(inv.runes)
    ? inv.runes.filter((id): id is string => typeof id === 'string' && !!runeDef(id))
    : [...STARTER_RUNE_IDS]

  // Ensure equipped items exist in bag lists for UI listing of unequipped only
  // Bag = unequipped; equipped live in loadout. Migrate old saves that put all in bag.
  // Starter: if empty after filter and no loadout, reseed.
  const hasAny =
    gear.length > 0 ||
    runes.length > 0 ||
    GEAR_SLOTS.some(s => loadout.gear[s]) ||
    loadout.runes.some(Boolean)

  if (!hasAny) {
    gear = [...STARTER_GEAR_IDS]
    runes = [...STARTER_RUNE_IDS]
  }

  return { gear, runes }
}

export class MetaProgression {
  static load(): MetaSave {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) {
      const meta = defaultMeta()
      setLocale(meta.locale)
      return meta
    }
    try {
      const data = JSON.parse(raw) as Partial<MetaSave>
      const loadout: MetaLoadout = {
        gear: normalizeGearLoadout(data.loadout?.gear),
        runes: normalizeRuneLoadout(data.loadout?.runes),
      }
      const meta: MetaSave = {
        gold: typeof data.gold === 'number' ? data.gold : 0,
        campaignFloor: normalizeCampaignFloor(data.campaignFloor),
        inventory: normalizeInventory(data.inventory, loadout),
        loadout,
        locale: normalizeLocale(data.locale),
        skillPoints: typeof data.skillPoints === 'number' ? Math.max(0, data.skillPoints) : 0,
        skillPointsEarned:
          typeof data.skillPointsEarned === 'number'
            ? Math.max(0, data.skillPointsEarned)
            : 0,
        depthCleared: normalizeDepthCleared(data.depthCleared),
        unlockedTreeNodes: normalizeTreeNodes(data.unlockedTreeNodes),
        fragments: normalizeFragments(data.fragments),
        gearForge: normalizeGearForge(data.gearForge),
        // Existing saves without the field are treated as already onboarded.
        tutorialDone: data.tutorialDone === true || data.tutorialDone === undefined,
      }
      setLocale(meta.locale)
      return meta
    } catch {
      const meta = defaultMeta()
      setLocale(meta.locale)
      return meta
    }
  }

  static save(meta: MetaSave) {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  }

  static applyStartBonuses(state: import('./RunState').RunState) {
    const meta = MetaProgression.load()
    for (const pid of unlockedPassiveIds(meta)) {
      if (!state.passives.includes(pid)) state.passives.push(pid)
    }
  }

  /** First-time boss clear of floor F grants 1 skill point. */
  static grantDepthPoint(clearedFloor: number): boolean {
    const f = Math.floor(clearedFloor)
    if (f < 1 || f > 5) return false
    const meta = MetaProgression.load()
    if (meta.depthCleared.includes(f)) return false
    meta.depthCleared.push(f)
    meta.depthCleared.sort((a, b) => a - b)
    meta.skillPoints += 1
    meta.skillPointsEarned += 1
    MetaProgression.save(meta)
    return true
  }

  static getSkillPoints(): number {
    return MetaProgression.load().skillPoints
  }

  static tryUnlockTreeNode(nodeId: string): boolean {
    const meta = MetaProgression.load()
    if (!skillTreeCanUnlock(meta, nodeId)) return false
    const node = skillTreeNode(nodeId)
    if (!node) return false
    meta.skillPoints -= node.cost
    meta.unlockedTreeNodes.push(nodeId)
    MetaProgression.save(meta)
    return true
  }

  static getCampaignFloor(): number {
    return MetaProgression.load().campaignFloor
  }

  static isTutorialDone(): boolean {
    return MetaProgression.load().tutorialDone
  }

  static completeTutorial() {
    const meta = MetaProgression.load()
    if (meta.tutorialDone) return
    meta.tutorialDone = true
    MetaProgression.save(meta)
  }

  static getGold(): number {
    return MetaProgression.load().gold
  }

  /** Unlock next floor after clearing `clearedFloor` (boss beaten). */
  static unlockFloorAfterClear(clearedFloor: number) {
    MetaProgression.grantDepthPoint(clearedFloor)
    const meta = MetaProgression.load()
    const next = clearedFloor + 1
    if (next > 5) {
      meta.campaignFloor = 1
    } else {
      meta.campaignFloor = Math.max(meta.campaignFloor, next)
    }
    MetaProgression.save(meta)
  }

  static addGold(amount: number) {
    if (amount <= 0) return
    const meta = MetaProgression.load()
    meta.gold += amount
    MetaProgression.save(meta)
  }

  static getFragments(): Record<GearSlot, number> {
    return { ...MetaProgression.load().fragments }
  }

  static addFragments(slot: GearSlot, amount: number): boolean {
    if (!GEAR_SLOTS.includes(slot) || amount <= 0) return false
    const meta = MetaProgression.load()
    meta.fragments[slot] += Math.floor(amount)
    MetaProgression.save(meta)
    return true
  }

  static spendFragments(slot: GearSlot, amount: number): boolean {
    if (!GEAR_SLOTS.includes(slot) || amount <= 0) return false
    const meta = MetaProgression.load()
    if (meta.fragments[slot] < amount) return false
    meta.fragments[slot] -= Math.floor(amount)
    MetaProgression.save(meta)
    return true
  }

  static getForgeState(gearId: string): GearForgeState {
    const meta = MetaProgression.load()
    return meta.gearForge[gearId] ?? emptyForgeState()
  }

  static listOwnedGearIds(): string[] {
    return [...MetaProgression.ownedGearIds()]
  }

  /** Spend slot fragments and roll a new pending affix (does not change applied). */
  static rerollForge(gearId: string): GearForgeState | null {
    const def = gearDef(gearId)
    if (!def || !MetaProgression.ownedGearIds().has(gearId)) return null
    if (!MetaProgression.spendFragments(def.slot, FORGE_REROLL_COST)) return null
    const rolled = rollAffix()
    const meta = MetaProgression.load()
    const prev = meta.gearForge[gearId] ?? emptyForgeState()
    meta.gearForge[gearId] = {
      appliedAffixId: prev.appliedAffixId,
      pendingAffixId: rolled.id,
    }
    MetaProgression.save(meta)
    return meta.gearForge[gearId]
  }

  /** Move pending affix to applied. */
  static applyForge(gearId: string): boolean {
    const meta = MetaProgression.load()
    const state = meta.gearForge[gearId]
    if (!state?.pendingAffixId) return false
    meta.gearForge[gearId] = {
      appliedAffixId: state.pendingAffixId,
      pendingAffixId: null,
    }
    MetaProgression.save(meta)
    return true
  }

  static spendGold(amount: number): boolean {
    const meta = MetaProgression.load()
    if (meta.gold < amount) return false
    meta.gold -= amount
    MetaProgression.save(meta)
    return true
  }

  static setLocale(locale: Locale) {
    const meta = MetaProgression.load()
    meta.locale = locale === 'en' ? 'en' : 'es'
    setLocale(meta.locale)
    MetaProgression.save(meta)
  }

  /** Owned = bag + equipped loadout. */
  static ownedGearIds(): Set<string> {
    const meta = MetaProgression.load()
    const ids = new Set(meta.inventory.gear)
    for (const id of Object.values(meta.loadout.gear)) {
      if (id) ids.add(id)
    }
    return ids
  }

  static ownedRuneIds(): Set<string> {
    const meta = MetaProgression.load()
    const ids = new Set(meta.inventory.runes)
    for (const id of meta.loadout.runes) {
      if (id) ids.add(id)
    }
    return ids
  }

  static addGearToBag(itemId: string): boolean {
    if (!gearDef(itemId)) return false
    const meta = MetaProgression.load()
    if (MetaProgression.ownedGearIds().has(itemId)) return false
    meta.inventory.gear.push(itemId)
    MetaProgression.save(meta)
    return true
  }

  static addRuneToBag(itemId: string): boolean {
    if (!runeDef(itemId)) return false
    const meta = MetaProgression.load()
    if (MetaProgression.ownedRuneIds().has(itemId)) return false
    meta.inventory.runes.push(itemId)
    MetaProgression.save(meta)
    return true
  }

  static equipGear(slot: GearSlot, itemId: string): boolean {
    const meta = MetaProgression.load()
    const def = gearDef(itemId)
    if (!def || def.slot !== slot) return false
    const bagIdx = meta.inventory.gear.indexOf(itemId)
    if (bagIdx < 0) return false

    const prev = meta.loadout.gear[slot]
    meta.inventory.gear.splice(bagIdx, 1)
    if (prev) meta.inventory.gear.push(prev)
    meta.loadout.gear[slot] = itemId
    MetaProgression.save(meta)
    return true
  }

  static unequipGear(slot: GearSlot): boolean {
    const meta = MetaProgression.load()
    const prev = meta.loadout.gear[slot]
    if (!prev) return false
    meta.loadout.gear[slot] = null
    meta.inventory.gear.push(prev)
    MetaProgression.save(meta)
    return true
  }

  static equipRune(slotIndex: number, itemId: string): boolean {
    if (slotIndex < 0 || slotIndex >= RUNE_SLOT_COUNT) return false
    const meta = MetaProgression.load()
    if (!runeDef(itemId)) return false
    const bagIdx = meta.inventory.runes.indexOf(itemId)
    if (bagIdx < 0) return false

    const prev = meta.loadout.runes[slotIndex]
    meta.inventory.runes.splice(bagIdx, 1)
    if (prev) meta.inventory.runes.push(prev)
    meta.loadout.runes[slotIndex] = itemId
    MetaProgression.save(meta)
    return true
  }

  static unequipRune(slotIndex: number): boolean {
    if (slotIndex < 0 || slotIndex >= RUNE_SLOT_COUNT) return false
    const meta = MetaProgression.load()
    const prev = meta.loadout.runes[slotIndex]
    if (!prev) return false
    meta.loadout.runes[slotIndex] = null
    meta.inventory.runes.push(prev)
    MetaProgression.save(meta)
    return true
  }
}

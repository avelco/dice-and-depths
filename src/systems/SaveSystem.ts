import { RunState, syncRunStateDerived, type MapSnapshot } from '../domain/progression/RunState'
import { MetaProgression } from '../domain/progression/MetaProgression'
import { DEFAULT_ACTION_SLOTS } from '../domain/cards/Deck'

const PREFIX = 'dnd_save_'

export interface SaveSlot {
  key: string
  name: string
  timestamp: number
  floor: number
  characterName: string
}

function serialize(state: RunState) {
  return {
    floor: state.floor,
    coins: state.coins,
    maxHp: state.maxHp,
    hp: state.hp,
    characterName: state.characterName,
    seed: state.seed,
    passives: state.passives,
    deckDefs: state.deckDefs,
    actionSlots: state.actionSlots,
    currentNodeId: state.currentNodeId,
    map: state.map,
    secondWindUsedThisFloor: state.secondWindUsedThisFloor,
    pendingNodeKind: state.pendingNodeKind,
    pendingRewardTier: state.pendingRewardTier,
    bonusDefFlat: state.bonusDefFlat,
    bonusDmgFlat: state.bonusDmgFlat,
    heroShield: state.heroShield,
    heroPoison: state.heroPoison,
    savedAt: Date.now(),
    version: 6,
  }
}

function deserialize(data: Record<string, unknown>): RunState {
  const state = new RunState()
  state.floor = (data.floor as number) ?? 1
  state.coins =
    typeof data.coins === 'number'
      ? data.coins
      : typeof data.gold === 'number'
        ? data.gold
        : 0
  state.maxHp = (data.maxHp as number) ?? 30
  state.hp = (data.hp as number) ?? state.maxHp
  const loadedName = (data.characterName as string) ?? 'Paladín'
  state.characterName = loadedName === 'Guerrero' ? 'Paladín' : loadedName
  state.seed = (data.seed as number) ?? 0
  state.passives = (data.passives as string[]) ?? []

  // v6: deckDefs. Legacy v5 dice saves → fall back to meta active deck.
  if (Array.isArray(data.deckDefs) && data.deckDefs.length > 0) {
    state.deckDefs = data.deckDefs.filter((id): id is string => typeof id === 'string')
  } else {
    state.deckDefs = MetaProgression.getActiveDeck()
  }
  state.actionSlots =
    typeof data.actionSlots === 'number'
      ? Math.max(DEFAULT_ACTION_SLOTS, Math.floor(data.actionSlots))
      : MetaProgression.getActionSlots()

  state.currentNodeId = (data.currentNodeId as number | null) ?? null
  state.map = (data.map as MapSnapshot | null) ?? null
  state.secondWindUsedThisFloor = !!(data.secondWindUsedThisFloor)
  state.pendingNodeKind = (data.pendingNodeKind as RunState['pendingNodeKind']) ?? null
  state.pendingRewardTier = (data.pendingRewardTier as RunState['pendingRewardTier']) ?? 'normal'
  state.bonusDefFlat = (data.bonusDefFlat as number) ?? 0
  state.bonusDmgFlat = (data.bonusDmgFlat as number) ?? 0
  state.heroShield = (data.heroShield as number) ?? 0
  state.heroPoison = (data.heroPoison as number) ?? 0
  syncRunStateDerived(state)
  return state
}

export class SaveSystem {
  static save(key: string, state: RunState): void {
    localStorage.setItem(PREFIX + key, JSON.stringify(serialize(state)))
  }

  static load(key: string): RunState | null {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    try {
      return deserialize(JSON.parse(raw) as Record<string, unknown>)
    } catch {
      return null
    }
  }

  static list(): SaveSlot[] {
    const slots: SaveSlot[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(PREFIX)) continue
      try {
        const data = JSON.parse(localStorage.getItem(k)!)
        slots.push({
          key: k.slice(PREFIX.length),
          name: data.characterName ?? '?',
          timestamp: data.savedAt ?? 0,
          floor: data.floor ?? 1,
          characterName: data.characterName ?? '?',
        })
      } catch {
        // skip corrupted entries
      }
    }
    slots.sort((a, b) => b.timestamp - a.timestamp)
    return slots
  }

  static delete(key: string): void {
    localStorage.removeItem(PREFIX + key)
  }

  static abandonQuicksave(): void {
    SaveSystem.delete('quicksave')
  }

  static saveToSlot(slot: number, state: RunState): void {
    SaveSystem.save(`slot_${slot}`, state)
  }

  static loadFromSlot(slot: number): RunState | null {
    return SaveSystem.load(`slot_${slot}`)
  }
}

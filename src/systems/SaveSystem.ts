import { RunState, syncRunStateDerived, type MapSnapshot, type RerollMax } from '../domain/progression/RunState'
import { makeBasicDice, makeDie, STANDARD_FACES, type DieFaces, type RunDie } from '../domain/dice/Die'

const PREFIX = 'dnd_save_'

export interface SaveSlot {
  key: string
  name: string
  timestamp: number
  floor: number
  characterName: string
}

function normalizeRerolls(raw: unknown): RerollMax {
  const d = (raw ?? {}) as Partial<RerollMax>
  return {
    atk: typeof d.atk === 'number' ? d.atk : 4,
  }
}

function normalizeDie(raw: unknown, fallbackId: string): RunDie {
  const d = (raw ?? {}) as Partial<RunDie>
  const faces =
    Array.isArray(d.faces) && d.faces.length === 6
      ? ([...d.faces] as DieFaces)
      : ([...STANDARD_FACES] as DieFaces)
  return makeDie(
    typeof d.id === 'string' ? d.id : fallbackId,
    typeof d.abilityId === 'string' ? d.abilityId : null,
    faces,
  )
}

/** v5: `dice: RunDie[]`. Legacy v4: `diceLoadout: { atk: number }`. */
function normalizeDice(data: Record<string, unknown>): RunDie[] {
  if (Array.isArray(data.dice) && data.dice.length > 0) {
    return data.dice.map((d, i) => normalizeDie(d, `d${i}`))
  }
  const loadout = data.diceLoadout as { atk?: number } | undefined
  const count =
    typeof loadout?.atk === 'number' && loadout.atk > 0 ? loadout.atk : 4
  return makeBasicDice(count)
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
    dice: state.dice,
    rerollMax: state.rerollMax,
    currentNodeId: state.currentNodeId,
    map: state.map,
    secondWindUsedThisFloor: state.secondWindUsedThisFloor,
    pendingNodeKind: state.pendingNodeKind,
    pendingRewardTier: state.pendingRewardTier,
    bonusDefFlat: state.bonusDefFlat,
    bonusDmgFlat: state.bonusDmgFlat,
    savedAt: Date.now(),
    version: 5,
  }
}

function deserialize(data: Record<string, unknown>): RunState {
  const state = new RunState()
  state.floor = (data.floor as number) ?? 1
  // Migrate legacy run gold → coins
  state.coins =
    typeof data.coins === 'number'
      ? data.coins
      : typeof data.gold === 'number'
        ? data.gold
        : 0
  state.maxHp = (data.maxHp as number) ?? 30
  state.hp = (data.hp as number) ?? state.maxHp
  const loadedName = (data.characterName as string) ?? 'Paladín'
  // Legacy rename: Guerrero → Paladín
  state.characterName = loadedName === 'Guerrero' ? 'Paladín' : loadedName
  state.seed = (data.seed as number) ?? 0
  state.passives = (data.passives as string[]) ?? []
  state.dice = normalizeDice(data)
  state.rerollMax = normalizeRerolls(data.rerollMax)
  state.currentNodeId = (data.currentNodeId as number | null) ?? null
  state.map = (data.map as MapSnapshot | null) ?? null
  state.secondWindUsedThisFloor = !!(data.secondWindUsedThisFloor)
  state.pendingNodeKind = (data.pendingNodeKind as RunState['pendingNodeKind']) ?? null
  state.pendingRewardTier = (data.pendingRewardTier as RunState['pendingRewardTier']) ?? 'normal'
  state.bonusDefFlat = (data.bonusDefFlat as number) ?? 0
  state.bonusDmgFlat = (data.bonusDmgFlat as number) ?? 0
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

  /** End the current run permanently (no resume from quicksave). */
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

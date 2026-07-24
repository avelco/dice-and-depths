import { RunState } from '../domain/progression/RunState'

const PREFIX = 'dnd_save_'

export interface SaveSlot {
  key: string
  name: string
  timestamp: number
  floor: number
  characterName: string
}

export class SaveSystem {
  static save(key: string, state: RunState): void {
    const data = {
      ...state,
      savedAt: Date.now(),
      version: 1,
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  }

  static load(key: string): RunState | null {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    try {
      const data = JSON.parse(raw)
      const state = new RunState()
      state.floor = data.floor ?? 1
      state.gold = data.gold ?? 0
      state.maxHp = data.maxHp ?? 30
      state.hp = data.hp ?? state.maxHp
      state.dice = data.dice ?? 3
      state.rerolls = data.rerolls ?? 1
      state.characterName = data.characterName ?? 'Guerrero'
      state.seed = data.seed ?? 0
      return state
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

  static saveToSlot(slot: number, state: RunState): void {
    SaveSystem.save(`slot_${slot}`, state)
  }

  static loadFromSlot(slot: number): RunState | null {
    return SaveSystem.load(`slot_${slot}`)
  }
}

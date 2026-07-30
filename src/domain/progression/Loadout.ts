import { gearDef } from '../items/Equipment'
import { runeDef } from '../items/Runes'
import { affixAsMod, affixDef } from '../items/Affixes'
import { GEAR_SLOTS, RUNE_SLOT_COUNT, type GearSlot } from '../items/Item'
import { MetaProgression, type MetaLoadout } from './MetaProgression'
import { syncRunStateDerived, type RunState } from './RunState'
import { addDie } from '../dice/DicePool'

export type GearLoadout = Record<GearSlot, string | null>
export type RuneLoadout = [string | null, string | null, string | null]

export interface LoadoutMods {
  maxHp: number
  defFlat: number
  dmgFlat: number
  startGold: number
  diceAtk: number
  rerollAtk: number
}

export function emptyGearLoadout(): GearLoadout {
  return { hat: null, cape: null, belt: null, ring: null, boots: null }
}

export function emptyRuneLoadout(): RuneLoadout {
  return [null, null, null]
}

export function emptyLoadoutMods(): LoadoutMods {
  return {
    maxHp: 0,
    defFlat: 0,
    dmgFlat: 0,
    startGold: 0,
    diceAtk: 0,
    rerollAtk: 0,
  }
}

function addMods(target: LoadoutMods, mods: { stat: string; value: number }[]) {
  for (const m of mods) {
    if (m.stat === 'maxHp') target.maxHp += m.value
    else if (m.stat === 'defFlat') target.defFlat += m.value
    else if (m.stat === 'dmgFlat') target.dmgFlat += m.value
    else if (m.stat === 'startGold') target.startGold += m.value
    else if (m.stat === 'diceAtk') target.diceAtk += m.value
    else if (m.stat === 'rerollAtk') target.rerollAtk += m.value
  }
}

export function sumLoadoutMods(loadout: MetaLoadout): LoadoutMods {
  const total = emptyLoadoutMods()
  for (const slot of GEAR_SLOTS) {
    const id = loadout.gear[slot]
    if (!id) continue
    const def = gearDef(id)
    if (def) addMods(total, def.mods)
    const forge = MetaProgression.getForgeState(id)
    if (forge.appliedAffixId) {
      const affix = affixDef(forge.appliedAffixId)
      if (affix) addMods(total, [affixAsMod(affix)])
    }
  }
  for (let i = 0; i < RUNE_SLOT_COUNT; i++) {
    const id = loadout.runes[i]
    if (!id) continue
    const def = runeDef(id)
    if (def) addMods(total, def.mods)
  }
  return total
}

/** Bake current meta loadout into run (call after kit + meta unlocks). */
export function applyLoadoutToRun(state: RunState) {
  const meta = MetaProgression.load()
  const mods = sumLoadoutMods(meta.loadout)

  state.maxHp += mods.maxHp
  state.hp = state.maxHp
  state.coins += mods.startGold
  for (let i = 0; i < mods.diceAtk; i++) addDie(state.dice)
  state.rerollMax = { atk: state.rerollMax.atk + mods.rerollAtk }
  state.bonusDefFlat = mods.defFlat
  state.bonusDmgFlat = mods.dmgFlat
  syncRunStateDerived(state)
}

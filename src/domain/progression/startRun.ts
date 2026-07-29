import { CHARACTERS, applyCharacterKit } from './Characters'
import { createNewRun, syncRunStateDerived, type RunState } from './RunState'
import { MetaProgression } from './MetaProgression'
import { applyLoadoutToRun } from './Loadout'
import { loadDungeonMap } from '../map/DungeonMap'
import { SaveSystem } from '../../systems/SaveSystem'

/** Build a fresh campaign run and quicksave it. */
export function startCampaignRun(characterName: string, floor?: number): RunState {
  const char =
    CHARACTERS.find(c => c.name === characterName) ?? CHARACTERS[0]!
  const state = createNewRun(char.name)
  applyCharacterKit(state, char)
  MetaProgression.applyStartBonuses(state)
  applyLoadoutToRun(state)
  state.floor = floor ?? MetaProgression.getCampaignFloor()
  syncRunStateDerived(state)
  state.map = loadDungeonMap(state.floor, state.seed)
  const start = state.map.nodes.find(n => n.kind === 'start')
  state.currentNodeId = start?.id ?? null
  SaveSystem.save('quicksave', state)
  return state
}

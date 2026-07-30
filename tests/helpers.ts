import { createNewRun } from '../src/domain/progression/RunState'
import {
  applyCharacterKit,
  characterByName,
} from '../src/domain/progression/Characters'

export function makeState(characterName: string, seed = 1) {
  const kit = characterByName(characterName)
  if (!kit) throw new Error(`Unknown character: ${characterName}`)
  const state = createNewRun(characterName, seed)
  applyCharacterKit(state, kit)
  return state
}

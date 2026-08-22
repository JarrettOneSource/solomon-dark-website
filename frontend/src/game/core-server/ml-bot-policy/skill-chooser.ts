import { NATIVE_WELD_BUILDS } from '../../core-kernels/player-progression.ts'
import {
  getPlayerCharacter,
  getPlayerProgression,
  getPlayerSkillBook,
  selectGameSimulationPlayerSkill,
  type GameSimulationState,
} from '../game-simulation.ts'
import { describeMlBotPolicySkillOffer } from './skill-options.ts'

export interface MlBotPolicyScriptedChoiceEvent {
  readonly accepted: true
  readonly choiceMode: 'scripted'
  readonly generation: number
  readonly observation: Float32Array
  readonly optionDescriptors: Float32Array
  readonly optionIds: readonly number[]
  readonly optionMask: Uint8Array
  readonly participantId: string
  readonly selectedOption: number
  readonly simulationTick: number
  readonly trainable: false
}

export interface MlBotPolicySkillSelection {
  readonly choiceIndex: number
  readonly offerSequence: number
  readonly playerId: string
  readonly skillId: number
}

export interface MlBotPolicySkillResolution {
  readonly events: readonly MlBotPolicyScriptedChoiceEvent[]
  readonly selections: readonly MlBotPolicySkillSelection[]
  readonly state: GameSimulationState
}

const PRIMARY_SKILL_IDS = new Set([8, 16, 24, 32, 40])
const ELEMENT_BANDS = Object.freeze({
  air: [24, 31],
  earth: [40, 47],
  ether: [8, 15],
  fire: [16, 23],
  water: [32, 39],
} as const)

export function resolveMlBotPolicySkillOffers(
  source: GameSimulationState,
  playerIds: readonly string[],
  observations: Readonly<Record<string, Float32Array>> = {},
): MlBotPolicySkillResolution {
  let state = source
  const events: MlBotPolicyScriptedChoiceEvent[] = []
  const selections: MlBotPolicySkillSelection[] = []
  for (const playerId of [...playerIds].sort()) {
    const progression = getPlayerProgression(state, playerId)
    const offer = progression.pendingOffer
    if (!offer || offer.options.length === 0) continue
    const description = describeMlBotPolicySkillOffer(state, playerId)
    if (description === null) throw new Error(`ML bot policy could not describe offer for ${playerId}`)
    const skillBook = getPlayerSkillBook(state, playerId)
    const element = getPlayerCharacter(state, playerId).config.element
    const [bandStart, bandEnd] = ELEMENT_BANDS[element]
    let selectedIndex = -1
    let selectedPriority = Number.POSITIVE_INFINITY
    for (let index = 0; index < offer.options.length; index += 1) {
      const option = offer.options[index]!
      let priority = Number.POSITIVE_INFINITY
      if (option.skillId === 52 && option.weldBuildId !== undefined) {
        const weld = NATIVE_WELD_BUILDS.find(({ id }) => id === option.weldBuildId)
        priority = weld?.primarySkillIds.every((skillId) => (
          (skillBook.effectiveRanks[skillId] ?? 0) > 0
        )) ? 0 : Number.POSITIVE_INFINITY
      } else if (option.skillId >= bandStart && option.skillId <= bandEnd) {
        priority = option.skillId === bandStart ? 1 : 10 + option.skillId - bandStart
      } else if (option.skillId === 64) {
        priority = 30
      } else if (
        PRIMARY_SKILL_IDS.has(option.skillId)
        && (skillBook.effectiveRanks[option.skillId] ?? 0) === 0
      ) {
        priority = 50 + index
      } else if (!PRIMARY_SKILL_IDS.has(option.skillId)) {
        priority = 100 + index
      }
      if (priority < selectedPriority) {
        selectedIndex = index
        selectedPriority = priority
      }
    }
    if (selectedIndex < 0) throw new Error(`ML bot policy found no eligible skill for ${playerId}`)
    const option = offer.options[selectedIndex]!
    const selection = {
      choiceIndex: selectedIndex,
      offerSequence: offer.sequence,
      playerId,
      skillId: option.skillId,
    }
    const applied = selectGameSimulationPlayerSkill(state, playerId, selection)
    if (!applied) throw new Error(`ML bot policy skill selection was rejected for ${playerId}`)
    state = applied
    selections.push(selection)
    const observation = observations[playerId]
    if (observation !== undefined) {
      events.push(Object.freeze({
        accepted: true,
        choiceMode: 'scripted',
        generation: description.generation,
        observation: observation.slice(),
        optionDescriptors: description.descriptors.slice(),
        optionIds: description.optionIds,
        optionMask: description.mask.slice(),
        participantId: playerId,
        selectedOption: selectedIndex,
        simulationTick: state.tick,
        trainable: false,
      }))
    }
  }
  return { events: Object.freeze(events), selections: Object.freeze(selections), state }
}

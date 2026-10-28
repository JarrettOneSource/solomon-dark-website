import {
  type PlayerSkillOfferOption,
} from '../../core-kernels/player-progression.ts'
import {
  getPlayerProgression,
  getPlayerSkillBook,
  getPlayerStatBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import {
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
} from './spec.ts'
import {
  describeMlBotPolicySkill,
  mlBotPolicySkillCoverageKey,
} from './skill-descriptors.ts'

export interface MlBotPolicySkillOfferDescription {
  readonly coverageKeys: readonly string[]
  readonly descriptors: Float32Array
  readonly generation: number
  readonly mask: Uint8Array
  readonly optionIds: readonly number[]
}

export function describeMlBotPolicySkillOffer(
  state: GameSimulationState,
  playerId: string,
): MlBotPolicySkillOfferDescription | null {
  const progression = getPlayerProgression(state, playerId)
  const offer = progression.pendingOffer
  if (offer === null || offer.options.length === 0) return null
  const skillBook = getPlayerSkillBook(state, playerId)
  const statBook = getPlayerStatBook(state, playerId)
  const descriptors = new Float32Array(offer.options.length * ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length)
  const coverageKeys: string[] = []
  const optionIds: number[] = []
  for (let index = 0; index < offer.options.length; index += 1) {
    const option = offer.options[index]!
    const skillId = option.skillId
    const permanentRank = skillBook.permanentRanks[skillId] ?? 0
    const row = offerDescriptor(skillBook, statBook, option, permanentRank)
    const offset = index * ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
    descriptors.set(row, offset)
    optionIds.push(skillId)
    coverageKeys.push(mlBotPolicySkillCoverageKey(skillId, option.weldBuildId))
  }
  return Object.freeze({
    coverageKeys: Object.freeze(coverageKeys),
    descriptors,
    generation: offer.sequence,
    mask: new Uint8Array(offer.options.length).fill(1),
    optionIds: Object.freeze(optionIds),
  })
}

function offerDescriptor(
  skillBook: Parameters<typeof describeMlBotPolicySkill>[0],
  statBook: Parameters<typeof describeMlBotPolicySkill>[1],
  option: PlayerSkillOfferOption,
  permanentRank: number,
): Float32Array {
  return describeMlBotPolicySkill(skillBook, statBook, {
    applyCount: Math.max(0, option.targetRank - permanentRank),
    skillId: option.skillId,
    targetRank: option.targetRank,
    ...(option.weldBuildId === undefined ? {} : { weldBuildId: option.weldBuildId }),
  })
}

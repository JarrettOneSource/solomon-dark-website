import {
  getPlayerSkillBook,
  getPlayerStatBook,
  type GameSimulationState,
} from '../game-simulation.ts'
import { describeMlBotPolicySkill } from './skill-descriptors.ts'
import { ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES } from './spec.ts'

const EQUIPPED_ROW_COUNT = 9

export function observeMlBotPolicySkillLoadout(
  state: GameSimulationState,
  playerId: string,
): Float32Array {
  const skillBook = getPlayerSkillBook(state, playerId)
  const statBook = getPlayerStatBook(state, playerId)
  const width = ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
  const values = new Float32Array(EQUIPPED_ROW_COUNT * width)
  const primarySkillId = skillBook.primarySkillId
  values.set(describeMlBotPolicySkill(skillBook, statBook, {
    applyCount: 0,
    skillId: primarySkillId,
    targetRank: skillBook.effectiveRanks[primarySkillId] ?? 0,
    ...(primarySkillId === 52 && skillBook.weldBuildId !== null
      ? { weldBuildId: skillBook.weldBuildId }
      : {}),
  }))
  for (let slot = 0; slot < skillBook.skillQuickbar.length; slot += 1) {
    const skillId = skillBook.skillQuickbar[slot]
    if (skillId === null) continue
    values.set(describeMlBotPolicySkill(skillBook, statBook, {
      applyCount: 0,
      skillId,
      targetRank: skillBook.effectiveRanks[skillId] ?? 0,
      ...(skillId === 52 && skillBook.weldBuildId !== null
        ? { weldBuildId: skillBook.weldBuildId }
        : {}),
    }), (slot + 1) * width)
  }
  return values
}

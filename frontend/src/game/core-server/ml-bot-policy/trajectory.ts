import type { MlBotPolicyActionIndices, MlBotPolicyActionMasks } from './actions.ts'
import type { MlBotPolicyRewardTerms } from './reward.ts'

export interface MlBotPolicyMainTrajectoryRecord {
  readonly actions: MlBotPolicyActionIndices
  readonly done: boolean
  readonly episodeId: string
  readonly masks: MlBotPolicyActionMasks
  readonly observation: Float32Array
  readonly oldLogProbability: number
  readonly oldValue: number
  readonly participantId: string
  readonly reward: number
  readonly rewardTerms: MlBotPolicyRewardTerms
  readonly simulationTick: number
  readonly ticks: number
  readonly trajectoryVersion: 6
}

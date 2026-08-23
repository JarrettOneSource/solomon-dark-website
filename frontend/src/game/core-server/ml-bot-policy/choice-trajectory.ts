import { ML_BOT_POLICY_OBSERVATION_NAMES, ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES } from './spec.ts'

export type MlBotPolicyChoiceMode = 'learned' | 'scripted'

export interface MlBotPolicyChoiceEventSeed {
  readonly accepted: boolean
  readonly choiceMode: MlBotPolicyChoiceMode
  readonly generation: number
  readonly observation: Float32Array
  readonly oldLogProbability: number
  readonly oldValue: number
  readonly optionDescriptors: Float32Array
  readonly optionIds: readonly number[]
  readonly optionMask: Uint8Array
  readonly selectedOption: number
  readonly simulationTick: number
  readonly trainable: boolean
}

export interface MlBotPolicyChoiceTrajectoryRecord extends MlBotPolicyChoiceEventSeed {
  readonly choiceTrajectoryVersion: 6
  readonly done: boolean
  readonly durationSteps: number
  readonly durationTicks: number
  readonly episodeId: string
  readonly nextValue: number
  readonly participantId: string
  readonly rewards: readonly number[]
  readonly rewardTicks: readonly number[]
}

interface OpenChoiceInterval {
  readonly event: MlBotPolicyChoiceEventSeed
  readonly rewards: number[]
  readonly rewardTicks: number[]
}

export class MlBotPolicyChoiceTrajectoryTracker {
  private readonly completed: MlBotPolicyChoiceTrajectoryRecord[] = []
  private readonly episodeId: string
  private openInterval: OpenChoiceInterval | null = null
  private readonly participantId: string

  constructor(episodeId: string, participantId: string) {
    if (episodeId.length === 0 || participantId.length === 0) {
      throw new Error('ML bot policy choice trajectory identity must not be empty')
    }
    this.episodeId = episodeId
    this.participantId = participantId
  }

  open(event: MlBotPolicyChoiceEventSeed): void {
    validateEvent(event)
    if (this.openInterval !== null) this.close(false, event.oldValue)
    this.openInterval = {
      event: Object.freeze({
        ...event,
        observation: event.observation.slice(),
        optionDescriptors: event.optionDescriptors.slice(),
        optionIds: Object.freeze([...event.optionIds]),
        optionMask: event.optionMask.slice(),
      }),
      rewards: [],
      rewardTicks: [],
    }
  }

  accumulate(reward: number, ticks: number): void {
    if (!Number.isFinite(reward)) throw new RangeError('ML bot policy choice reward must be finite')
    if (!Number.isSafeInteger(ticks) || ticks < 1) {
      throw new RangeError('ML bot policy choice reward ticks must be a positive integer')
    }
    if (this.openInterval === null) return
    this.openInterval.rewards.push(reward)
    this.openInterval.rewardTicks.push(ticks)
  }

  finish(done: boolean, nextValue = 0): void {
    if (this.openInterval === null) return
    if (!done && !Number.isFinite(nextValue)) {
      throw new RangeError('ML bot policy choice next value must be finite')
    }
    this.close(done, done ? 0 : nextValue)
  }

  drain(): MlBotPolicyChoiceTrajectoryRecord[] {
    return this.completed.splice(0)
  }

  reset(): void {
    this.completed.length = 0
    this.openInterval = null
  }

  private close(done: boolean, nextValue: number): void {
    const interval = this.openInterval
    if (interval === null) return
    const durationTicks = interval.rewardTicks.reduce((sum, ticks) => sum + ticks, 0)
    this.completed.push(Object.freeze({
      ...interval.event,
      choiceTrajectoryVersion: 6,
      done,
      durationSteps: interval.rewards.length,
      durationTicks,
      episodeId: this.episodeId,
      nextValue,
      participantId: this.participantId,
      rewards: Object.freeze([...interval.rewards]),
      rewardTicks: Object.freeze([...interval.rewardTicks]),
    }))
    this.openInterval = null
  }
}

function validateEvent(event: MlBotPolicyChoiceEventSeed): void {
  if (event.observation.length !== ML_BOT_POLICY_OBSERVATION_NAMES.length) {
    throw new RangeError('ML bot policy choice observation has the wrong width')
  }
  if (
    event.optionDescriptors.length === 0
    || event.optionDescriptors.length % ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length !== 0
  ) throw new RangeError('ML bot policy choice descriptors have the wrong width')
  const optionCount = event.optionDescriptors.length / ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES.length
  if (event.optionMask.length !== optionCount || event.optionIds.length !== optionCount) {
    throw new RangeError('ML bot policy choice option rows disagree')
  }
  if (
    !Number.isInteger(event.selectedOption)
    || event.selectedOption < 0
    || event.selectedOption >= optionCount
    || event.optionMask[event.selectedOption] !== 1
  ) throw new RangeError('ML bot policy selected an illegal choice option')
  if (!Number.isSafeInteger(event.generation) || event.generation < 0) {
    throw new RangeError('ML bot policy choice generation must be nonnegative')
  }
  if (!Number.isSafeInteger(event.simulationTick) || event.simulationTick < 0) {
    throw new RangeError('ML bot policy choice simulation tick must be nonnegative')
  }
  if (!Number.isFinite(event.oldLogProbability) || !Number.isFinite(event.oldValue)) {
    throw new RangeError('ML bot policy choice inference values must be finite')
  }
  if (event.choiceMode === 'scripted' && event.trainable) {
    throw new Error('ML bot policy scripted choices cannot be trainable')
  }
}

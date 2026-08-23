import type {
  MlBotPolicyActionMaskPlan,
  MlBotPolicyActionMasks,
} from '../core-server/ml-bot-policy/actions.ts'
import type { MlBotPolicyChoiceTrajectoryRecord } from '../core-server/ml-bot-policy/choice-trajectory.ts'
import type { MlBotPolicyRewardTerms } from '../core-server/ml-bot-policy/reward.ts'
import type {
  MlBotPolicyScriptedChoiceEvent,
  MlBotPolicySkillSelection,
} from '../core-server/ml-bot-policy/skill-chooser.ts'
import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  BoneyardHeadlessEnvironment,
  type BoneyardHeadlessEnvironmentOptions,
  type BoneyardHeadlessEpisodeMetadata,
  type BoneyardHeadlessResetOptions,
} from './boneyard-headless-environment.ts'

export interface BoneyardHeadlessIndexedValue<Value> {
  readonly value: Value
  readonly worldIndex: number
}

export interface BoneyardHeadlessPackedRewardTerms {
  readonly death: Float64Array
  readonly ownDamage: Float64Array
  readonly selfHp: Float64Array
  readonly wave: Float64Array
  readonly xp: Float64Array
}

export interface BoneyardHeadlessPackedActionMaskPlan {
  readonly abilityByTarget: Uint8Array
  readonly aimByAbility: Uint8Array
  readonly movement: Uint8Array
  readonly target: Uint8Array
}

export interface BoneyardHeadlessBatchTransition {
  readonly actions: Uint8Array
  readonly choiceEvents: readonly BoneyardHeadlessIndexedValue<MlBotPolicyScriptedChoiceEvent>[]
  readonly choiceIntervals: readonly BoneyardHeadlessIndexedValue<MlBotPolicyChoiceTrajectoryRecord>[]
  readonly dones: Uint8Array
  readonly masks: MlBotPolicyActionMasks
  readonly nextObservations: Float32Array
  readonly nextSimulationTicks: Float64Array
  readonly nextStateHashes: readonly string[]
  readonly observations: Float32Array
  readonly rawRewards: Float64Array
  readonly rewardClamped: Uint8Array
  readonly rewards: Float64Array
  readonly rewardTerms: BoneyardHeadlessPackedRewardTerms
  readonly simulationTicks: Float64Array
  readonly skillSelections: readonly BoneyardHeadlessIndexedValue<MlBotPolicySkillSelection>[]
  readonly stateHashes: readonly string[]
  readonly ticks: Uint32Array
}

export class BoneyardHeadlessBatch {
  readonly observationLength: number
  readonly worldCount: number
  private readonly environments: BoneyardHeadlessEnvironment[]

  constructor(options: readonly BoneyardHeadlessEnvironmentOptions[]) {
    if (options.length === 0) throw new RangeError('Boneyard headless batch requires at least one world')
    this.environments = options.map((entry) => new BoneyardHeadlessEnvironment(entry))
    this.worldCount = this.environments.length
    this.observationLength = this.environments[0]!.observationLength
  }

  reset(options: readonly (BoneyardHeadlessResetOptions | null)[]): Float32Array {
    if (options.length !== this.worldCount) {
      throw new RangeError('reset options must match the Boneyard batch world count')
    }
    const observations = new Float32Array(this.worldCount * this.observationLength)
    for (let index = 0; index < this.worldCount; index += 1) {
      const reset = options[index]!
      if (reset !== null) this.environments[index]!.reset(reset)
      this.environments[index]!.observe(observations, index * this.observationLength)
    }
    return observations
  }

  expertActions(): Float32Array {
    const actions = new Float32Array(this.worldCount * BONEYARD_HEADLESS_ACTION_STRIDE)
    for (let index = 0; index < this.worldCount; index += 1) {
      const action = this.environments[index]!.expertAction()
      const offset = index * BONEYARD_HEADLESS_ACTION_STRIDE
      actions[offset] = action.movement
      actions[offset + 1] = action.target
      actions[offset + 2] = action.ability
      actions[offset + 3] = action.aim
    }
    return actions
  }

  actionMaskPlans(): BoneyardHeadlessPackedActionMaskPlan {
    const result = {
      abilityByTarget: new Uint8Array(this.worldCount * 9 * 22),
      aimByAbility: new Uint8Array(this.worldCount * 22 * 9),
      movement: new Uint8Array(this.worldCount * 9),
      target: new Uint8Array(this.worldCount * 9),
    }
    for (let index = 0; index < this.worldCount; index += 1) {
      setActionMaskPlan(result, index, this.environments[index]!.actionMaskPlan())
    }
    return result
  }

  episodeMetadata(): readonly BoneyardHeadlessEpisodeMetadata[] {
    return this.environments.map(environment => environment.episodeMetadata())
  }

  step(
    actions: Float32Array,
    ticks = 1,
    observations = new Float32Array(this.worldCount * this.observationLength),
  ): Float32Array {
    const transition = this.stepTransitions(actions, ticks, observations)
    return transition.nextObservations
  }

  stepTransitions(
    actions: Float32Array,
    ticks = 1,
    nextObservations = new Float32Array(this.worldCount * this.observationLength),
  ): BoneyardHeadlessBatchTransition {
    if (actions.length !== this.worldCount * BONEYARD_HEADLESS_ACTION_STRIDE) {
      throw new RangeError('packed actions must match the Boneyard batch world count')
    }
    if (nextObservations.length !== this.worldCount * this.observationLength) {
      throw new RangeError('packed observations must match the Boneyard batch world count')
    }
    const packedActions = new Uint8Array(actions.length)
    const observations = new Float32Array(nextObservations.length)
    const dones = new Uint8Array(this.worldCount)
    const nextSimulationTicks = new Float64Array(this.worldCount)
    const rawRewards = new Float64Array(this.worldCount)
    const rewardClamped = new Uint8Array(this.worldCount)
    const rewards = new Float64Array(this.worldCount)
    const rewardTerms = createPackedRewardTerms(this.worldCount)
    const simulationTicks = new Float64Array(this.worldCount)
    const stepTicks = new Uint32Array(this.worldCount)
    const ability = new Uint8Array(this.worldCount * 22)
    const aim = new Uint8Array(this.worldCount * 9)
    const movement = new Uint8Array(this.worldCount * 9)
    const target = new Uint8Array(this.worldCount * 9)
    const choiceEvents: BoneyardHeadlessIndexedValue<MlBotPolicyScriptedChoiceEvent>[] = []
    const choiceIntervals: BoneyardHeadlessIndexedValue<MlBotPolicyChoiceTrajectoryRecord>[] = []
    const skillSelections: BoneyardHeadlessIndexedValue<MlBotPolicySkillSelection>[] = []
    const stateHashes: string[] = []
    const nextStateHashes: string[] = []
    for (let index = 0; index < this.worldCount; index += 1) {
      const environment = this.environments[index]!
      const actionOffset = index * BONEYARD_HEADLESS_ACTION_STRIDE
      const observationOffset = index * this.observationLength
      const transition = environment.stepPackedTransition(actions, actionOffset, ticks)
      packedActions[actionOffset] = transition.actions.movement
      packedActions[actionOffset + 1] = transition.actions.target
      packedActions[actionOffset + 2] = transition.actions.ability
      packedActions[actionOffset + 3] = transition.actions.aim
      observations.set(transition.observation, observationOffset)
      nextObservations.set(transition.nextObservation, observationOffset)
      dones[index] = Number(transition.done)
      nextSimulationTicks[index] = transition.nextSimulationTick
      rawRewards[index] = transition.reward.raw
      rewardClamped[index] = Number(transition.reward.clamped)
      rewards[index] = transition.reward.reward
      setRewardTerms(rewardTerms, index, transition.reward.terms)
      simulationTicks[index] = transition.simulationTick
      stepTicks[index] = transition.ticks
      ability.set(transition.masks.ability, index * 22)
      aim.set(transition.masks.aim, index * 9)
      movement.set(transition.masks.movement, index * 9)
      target.set(transition.masks.target, index * 9)
      stateHashes.push(transition.stateHash)
      nextStateHashes.push(transition.nextStateHash)
      for (const value of transition.choiceEvents) choiceEvents.push({ value, worldIndex: index })
      for (const value of transition.choiceIntervals) choiceIntervals.push({ value, worldIndex: index })
      for (const value of transition.skillSelections) skillSelections.push({ value, worldIndex: index })
    }
    return {
      actions: packedActions,
      choiceEvents,
      choiceIntervals,
      dones,
      masks: { ability, aim, movement, target },
      nextObservations,
      nextSimulationTicks,
      nextStateHashes,
      observations,
      rawRewards,
      rewardClamped,
      rewards,
      rewardTerms,
      simulationTicks,
      skillSelections,
      stateHashes,
      ticks: stepTicks,
    }
  }

  stateHashes(): string[] {
    return this.environments.map((environment) => environment.stateHash())
  }

  lastActionMasks(): MlBotPolicyActionMasks {
    const movement = new Uint8Array(this.worldCount * 9)
    const target = new Uint8Array(this.worldCount * 9)
    const ability = new Uint8Array(this.worldCount * 22)
    const aim = new Uint8Array(this.worldCount * 9)
    for (let index = 0; index < this.worldCount; index += 1) {
      const masks = this.environments[index]!.lastActionMasks()
      movement.set(masks.movement, index * 9)
      target.set(masks.target, index * 9)
      ability.set(masks.ability, index * 22)
      aim.set(masks.aim, index * 9)
    }
    return { ability, aim, movement, target }
  }
}

function setActionMaskPlan(
  target: BoneyardHeadlessPackedActionMaskPlan,
  worldIndex: number,
  source: MlBotPolicyActionMaskPlan,
): void {
  target.movement.set(source.movement, worldIndex * 9)
  target.target.set(source.target, worldIndex * 9)
  for (let targetAction = 0; targetAction < 9; targetAction += 1) {
    target.abilityByTarget.set(
      source.abilityByTarget[targetAction]!,
      worldIndex * 9 * 22 + targetAction * 22,
    )
  }
  for (let abilityAction = 0; abilityAction < 22; abilityAction += 1) {
    target.aimByAbility.set(
      source.aimByAbility[abilityAction]!,
      worldIndex * 22 * 9 + abilityAction * 9,
    )
  }
}

function createPackedRewardTerms(worldCount: number): BoneyardHeadlessPackedRewardTerms {
  return {
    death: new Float64Array(worldCount),
    ownDamage: new Float64Array(worldCount),
    selfHp: new Float64Array(worldCount),
    wave: new Float64Array(worldCount),
    xp: new Float64Array(worldCount),
  }
}

function setRewardTerms(
  target: BoneyardHeadlessPackedRewardTerms,
  index: number,
  source: MlBotPolicyRewardTerms,
): void {
  target.death[index] = source.death
  target.ownDamage[index] = source.ownDamage
  target.selfHp[index] = source.selfHp
  target.wave[index] = source.wave
  target.xp[index] = source.xp
}

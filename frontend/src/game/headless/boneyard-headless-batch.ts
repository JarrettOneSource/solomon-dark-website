import type { MlBotPolicyActionMasks } from '../core-server/ml-bot-policy/actions.ts'
import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  BoneyardHeadlessEnvironment,
  type BoneyardHeadlessEnvironmentOptions,
  type BoneyardHeadlessResetOptions,
} from './boneyard-headless-environment.ts'

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

  reset(options: readonly BoneyardHeadlessResetOptions[]): Float32Array {
    if (options.length !== this.worldCount) {
      throw new RangeError('reset options must match the Boneyard batch world count')
    }
    const observations = new Float32Array(this.worldCount * this.observationLength)
    for (let index = 0; index < this.worldCount; index += 1) {
      this.environments[index]!.reset(options[index])
      this.environments[index]!.observe(observations, index * this.observationLength)
    }
    return observations
  }

  step(
    actions: Float32Array,
    ticks = 1,
    observations = new Float32Array(this.worldCount * this.observationLength),
  ): Float32Array {
    if (actions.length !== this.worldCount * BONEYARD_HEADLESS_ACTION_STRIDE) {
      throw new RangeError('packed actions must match the Boneyard batch world count')
    }
    if (observations.length !== this.worldCount * this.observationLength) {
      throw new RangeError('packed observations must match the Boneyard batch world count')
    }
    for (let index = 0; index < this.worldCount; index += 1) {
      const environment = this.environments[index]!
      environment.stepPacked(actions, index * BONEYARD_HEADLESS_ACTION_STRIDE, ticks)
      environment.observe(observations, index * this.observationLength)
    }
    return observations
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

import {
  HUB_HEADLESS_ACTION_STRIDE,
  HubHeadlessEnvironment,
  type HubHeadlessEnvironmentOptions,
  type HubHeadlessResetOptions,
} from './hub-headless-environment.ts'

export class HubHeadlessBatch {
  readonly observationLength: number
  readonly worldCount: number
  private readonly environments: HubHeadlessEnvironment[]

  constructor(options: readonly HubHeadlessEnvironmentOptions[]) {
    if (options.length === 0) throw new RangeError('headless batch requires at least one world')
    const maximumStudents = Math.max(...options.map((entry) => (
      entry.maximumStudents ?? entry.studentCount
    )))
    this.environments = options.map((entry) => new HubHeadlessEnvironment({
      ...entry,
      maximumStudents,
    }))
    this.worldCount = this.environments.length
    this.observationLength = this.environments[0].observationLength
  }

  reset(options: readonly HubHeadlessResetOptions[]): Float32Array {
    if (options.length !== this.worldCount) {
      throw new RangeError('reset options must match the batch world count')
    }
    const observations = new Float32Array(this.worldCount * this.observationLength)
    for (let index = 0; index < this.worldCount; index += 1) {
      this.environments[index].reset(options[index])
      this.environments[index].observe(observations, index * this.observationLength)
    }
    return observations
  }

  step(
    actions: Float32Array,
    ticks = 1,
    observations = new Float32Array(this.worldCount * this.observationLength),
  ): Float32Array {
    if (actions.length !== this.worldCount * HUB_HEADLESS_ACTION_STRIDE) {
      throw new RangeError('packed actions must match the batch world count')
    }
    if (observations.length !== this.worldCount * this.observationLength) {
      throw new RangeError('packed observations must match the batch world count')
    }
    for (let index = 0; index < this.worldCount; index += 1) {
      const environment = this.environments[index]
      environment.stepPacked(actions, index * HUB_HEADLESS_ACTION_STRIDE, ticks)
      environment.observe(observations, index * this.observationLength)
    }
    return observations
  }

  stateHashes(): string[] {
    return this.environments.map((environment) => environment.stateHash())
  }
}

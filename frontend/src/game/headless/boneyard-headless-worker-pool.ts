import { Worker } from 'node:worker_threads'

import type { MlBotPolicyActionMasks } from '../core-server/ml-bot-policy/actions.ts'
import type { MlBotPolicyChoiceTrajectoryRecord } from '../core-server/ml-bot-policy/choice-trajectory.ts'
import type {
  MlBotPolicyScriptedChoiceEvent,
  MlBotPolicySkillSelection,
} from '../core-server/ml-bot-policy/skill-chooser.ts'
import type {
  BoneyardHeadlessBatchTransition,
  BoneyardHeadlessIndexedValue,
  BoneyardHeadlessPackedActionMaskPlan,
  BoneyardHeadlessPackedRewardTerms,
} from './boneyard-headless-batch.ts'
import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  type BoneyardHeadlessEpisodeMetadata,
  type BoneyardHeadlessEnvironmentOptions,
  type BoneyardHeadlessResetOptions,
} from './boneyard-headless-environment.ts'

export interface BoneyardHeadlessWorkerPoolOptions {
  readonly environments: readonly BoneyardHeadlessEnvironmentOptions[]
  readonly workerCount?: number
}

export interface BoneyardHeadlessWorkerResult {
  readonly hashes: readonly string[]
  readonly masks: MlBotPolicyActionMasks
  readonly metadata: readonly BoneyardHeadlessEpisodeMetadata[]
  readonly observations: Float32Array
  readonly plans: BoneyardHeadlessPackedActionMaskPlan
}

export interface BoneyardHeadlessWorkerStepResult extends BoneyardHeadlessWorkerResult {
  readonly transition: BoneyardHeadlessBatchTransition
}

interface WorkerLane {
  readonly count: number
  readonly offset: number
  readonly rpc: WorkerRpc
}

export class BoneyardHeadlessWorkerPool {
  readonly observationLength: number
  readonly worldCount: number
  private readonly lanes: readonly WorkerLane[]

  private constructor(
    lanes: readonly WorkerLane[],
    observationLength: number,
    worldCount: number,
  ) {
    this.lanes = lanes
    this.observationLength = observationLength
    this.worldCount = worldCount
  }

  static async create(
    options: BoneyardHeadlessWorkerPoolOptions,
  ): Promise<BoneyardHeadlessWorkerPool> {
    if (options.environments.length === 0) {
      throw new RangeError('Boneyard headless worker pool requires at least one world')
    }
    const requestedWorkers = options.workerCount ?? Math.min(4, options.environments.length)
    if (!Number.isInteger(requestedWorkers) || requestedWorkers < 1) {
      throw new RangeError('workerCount must be a positive integer')
    }
    const workerCount = Math.min(requestedWorkers, options.environments.length)
    const lanes: WorkerLane[] = []
    let offset = 0
    let observationLength = 0
    try {
      for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
        const remainingWorlds = options.environments.length - offset
        const remainingWorkers = workerCount - workerIndex
        const count = Math.ceil(remainingWorlds / remainingWorkers)
        const rpc = new WorkerRpc()
        const response = await rpc.call({
          options: options.environments.slice(offset, offset + count),
          type: 'initialize',
        })
        const workerObservationLength = requiredNumber(
          response.observationLength,
          'observationLength',
        )
        observationLength ||= workerObservationLength
        if (workerObservationLength !== observationLength) {
          throw new Error('Boneyard headless worker observation strides disagree')
        }
        lanes.push({ count, offset, rpc })
        offset += count
      }
      return new BoneyardHeadlessWorkerPool(lanes, observationLength, options.environments.length)
    } catch (error) {
      await Promise.all(lanes.map(({ rpc }) => rpc.close()))
      throw error
    }
  }

  async step(actions: Float32Array, ticks = 1): Promise<BoneyardHeadlessWorkerStepResult> {
    if (actions.length !== this.worldCount * BONEYARD_HEADLESS_ACTION_STRIDE) {
      throw new RangeError('packed actions must match the Boneyard worker-pool world count')
    }
    const laneResults = await Promise.all(this.lanes.map(async (lane) => {
      const start = lane.offset * BONEYARD_HEADLESS_ACTION_STRIDE
      const end = start + lane.count * BONEYARD_HEADLESS_ACTION_STRIDE
      const laneActions = actions.slice(start, end)
      return lane.rpc.call({
        actions: laneActions.buffer,
        ticks,
        transfer: [laneActions.buffer],
        type: 'step',
      })
    }))
    return this.combineStep(laneResults)
  }

  async expertStep(ticks = 1): Promise<BoneyardHeadlessWorkerStepResult> {
    const laneResults = await Promise.all(this.lanes.map(lane => lane.rpc.call({
      ticks,
      type: 'expert-step',
    })))
    return this.combineStep(laneResults)
  }

  async reset(
    options: readonly (BoneyardHeadlessResetOptions | null)[],
  ): Promise<BoneyardHeadlessWorkerResult> {
    if (options.length !== this.worldCount) {
      throw new RangeError('reset options must match the Boneyard worker-pool world count')
    }
    const results = await Promise.all(this.lanes.map((lane) => lane.rpc.call({
      options: options.slice(lane.offset, lane.offset + lane.count),
      type: 'reset',
    })))
    return this.combine(results)
  }

  async close(): Promise<void> {
    await Promise.all(this.lanes.map(({ rpc }) => rpc.close()))
  }

  private combine(results: readonly Record<string, unknown>[]): BoneyardHeadlessWorkerResult {
    const observations = new Float32Array(this.worldCount * this.observationLength)
    const ability = new Uint8Array(this.worldCount * 22)
    const aim = new Uint8Array(this.worldCount * 9)
    const movement = new Uint8Array(this.worldCount * 9)
    const target = new Uint8Array(this.worldCount * 9)
    const abilityByTarget = new Uint8Array(this.worldCount * 9 * 22)
    const aimByAbility = new Uint8Array(this.worldCount * 22 * 9)
    const planMovement = new Uint8Array(this.worldCount * 9)
    const planTarget = new Uint8Array(this.worldCount * 9)
    const hashes: string[] = []
    const metadata: BoneyardHeadlessEpisodeMetadata[] = []
    let worldOffset = 0
    for (const result of results) {
      if (!(result.observations instanceof ArrayBuffer) || !Array.isArray(result.hashes)) {
        throw new Error('Boneyard headless worker returned an invalid result')
      }
      const masks = requiredMasks(result.masks)
      const laneWorldCount = result.hashes.length
      const laneMetadata = requiredEpisodeMetadata(result.metadata, laneWorldCount)
      const plans = requiredActionMaskPlan(result.plans, laneWorldCount)
      const laneObservations = new Float32Array(result.observations)
      observations.set(laneObservations, worldOffset * this.observationLength)
      ability.set(masks.ability, worldOffset * 22)
      aim.set(masks.aim, worldOffset * 9)
      movement.set(masks.movement, worldOffset * 9)
      target.set(masks.target, worldOffset * 9)
      abilityByTarget.set(plans.abilityByTarget, worldOffset * 9 * 22)
      aimByAbility.set(plans.aimByAbility, worldOffset * 22 * 9)
      planMovement.set(plans.movement, worldOffset * 9)
      planTarget.set(plans.target, worldOffset * 9)
      hashes.push(...result.hashes.map((hash) => String(hash)))
      metadata.push(...laneMetadata)
      worldOffset += result.hashes.length
    }
    return {
      hashes,
      metadata,
      masks: { ability, aim, movement, target },
      observations,
      plans: {
        abilityByTarget,
        aimByAbility,
        movement: planMovement,
        target: planTarget,
      },
    }
  }

  private combineStep(
    results: readonly Record<string, unknown>[],
  ): BoneyardHeadlessWorkerStepResult {
    const combined = this.combine(results)
    const actions = new Uint8Array(this.worldCount * BONEYARD_HEADLESS_ACTION_STRIDE)
    const choiceEvents: BoneyardHeadlessIndexedValue<MlBotPolicyScriptedChoiceEvent>[] = []
    const choiceIntervals: BoneyardHeadlessIndexedValue<MlBotPolicyChoiceTrajectoryRecord>[] = []
    const dones = new Uint8Array(this.worldCount)
    const nextSimulationTicks = new Float64Array(this.worldCount)
    const observations = new Float32Array(this.worldCount * this.observationLength)
    const rawRewards = new Float64Array(this.worldCount)
    const rewardClamped = new Uint8Array(this.worldCount)
    const rewards = new Float64Array(this.worldCount)
    const rewardTerms = createPackedRewardTerms(this.worldCount)
    const simulationTicks = new Float64Array(this.worldCount)
    const skillSelections: BoneyardHeadlessIndexedValue<MlBotPolicySkillSelection>[] = []
    const stateHashes: string[] = []
    const ticks = new Uint32Array(this.worldCount)
    let worldOffset = 0
    for (const result of results) {
      const source = requiredObject(result.transition, 'Boneyard headless worker transition')
      const laneWorldCount = requiredStringArray(source.nextStateHashes, 'nextStateHashes').length
      const actionOffset = worldOffset * BONEYARD_HEADLESS_ACTION_STRIDE
      const observationOffset = worldOffset * this.observationLength
      actions.set(uint8(source.actions, laneWorldCount * BONEYARD_HEADLESS_ACTION_STRIDE, 'actions'), actionOffset)
      dones.set(uint8(source.dones, laneWorldCount, 'dones'), worldOffset)
      nextSimulationTicks.set(float64(source.nextSimulationTicks, laneWorldCount, 'nextSimulationTicks'), worldOffset)
      observations.set(
        float32(source.observations, laneWorldCount * this.observationLength, 'observations'),
        observationOffset,
      )
      rawRewards.set(float64(source.rawRewards, laneWorldCount, 'rawRewards'), worldOffset)
      rewardClamped.set(uint8(source.rewardClamped, laneWorldCount, 'rewardClamped'), worldOffset)
      rewards.set(float64(source.rewards, laneWorldCount, 'rewards'), worldOffset)
      setPackedRewardTerms(
        rewardTerms,
        worldOffset,
        requiredPackedRewardTerms(source.rewardTerms, laneWorldCount),
      )
      simulationTicks.set(float64(source.simulationTicks, laneWorldCount, 'simulationTicks'), worldOffset)
      ticks.set(uint32(source.ticks, laneWorldCount, 'ticks'), worldOffset)
      stateHashes.push(...requiredStringArray(source.stateHashes, 'stateHashes'))
      appendIndexedValues(
        choiceEvents,
        source.choiceEvents,
        worldOffset,
        laneWorldCount,
        'choiceEvents',
      )
      appendIndexedValues(
        choiceIntervals,
        source.choiceIntervals,
        worldOffset,
        laneWorldCount,
        'choiceIntervals',
      )
      appendIndexedValues(
        skillSelections,
        source.skillSelections,
        worldOffset,
        laneWorldCount,
        'skillSelections',
      )
      worldOffset += laneWorldCount
    }
    if (worldOffset !== this.worldCount || stateHashes.length !== this.worldCount) {
      throw new Error('Boneyard headless worker transitions disagree with the pool world count')
    }
    return {
      ...combined,
      transition: {
        actions,
        choiceEvents,
        choiceIntervals,
        dones,
        masks: combined.masks,
        nextObservations: combined.observations,
        nextSimulationTicks,
        nextStateHashes: combined.hashes,
        observations,
        rawRewards,
        rewardClamped,
        rewards,
        rewardTerms,
        simulationTicks,
        skillSelections,
        stateHashes,
        ticks,
      },
    }
  }
}

class WorkerRpc {
  private nextId = 1
  private readonly pending = new Map<number, {
    reject: (error: Error) => void
    resolve: (response: Record<string, unknown>) => void
  }>()
  private readonly worker: Worker

  constructor() {
    this.worker = new Worker(new URL('./boneyard-headless-worker.ts', import.meta.url), {
      execArgv: process.execArgv.includes('--experimental-strip-types')
        ? process.execArgv
        : [...process.execArgv, '--experimental-strip-types'],
    })
    this.worker.on('message', (response: Record<string, unknown>) => {
      const id = requiredNumber(response.id, 'worker response id')
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      if (response.type === 'error') pending.reject(new Error(String(response.error)))
      else pending.resolve(response)
    })
    this.worker.on('error', (error) => this.rejectAll(error))
    this.worker.on('exit', (code) => {
      if (code !== 0) this.rejectAll(new Error(`Boneyard headless worker exited with code ${code}`))
    })
  }

  call(
    message: Record<string, unknown> & { transfer?: readonly ArrayBuffer[] },
  ): Promise<Record<string, unknown>> {
    const id = this.nextId
    this.nextId += 1
    const transfer = message.transfer ?? []
    const payload = { ...message, id }
    delete payload.transfer
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve })
      this.worker.postMessage(payload, transfer)
    })
  }

  async close(): Promise<void> {
    this.rejectAll(new Error('Boneyard headless worker pool closed'))
    await this.worker.terminate()
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

function requiredMasks(value: unknown): MlBotPolicyActionMasks {
  if (value === null || typeof value !== 'object') {
    throw new Error('Boneyard headless worker returned invalid masks')
  }
  const source = value as Record<string, unknown>
  const buffer = (name: string): Uint8Array => {
    const entry = source[name]
    if (!(entry instanceof ArrayBuffer)) {
      throw new Error(`Boneyard headless worker returned invalid ${name} mask`)
    }
    return new Uint8Array(entry)
  }
  return {
    ability: buffer('ability'),
    aim: buffer('aim'),
    movement: buffer('movement'),
    target: buffer('target'),
  }
}

function requiredActionMaskPlan(
  value: unknown,
  worldCount: number,
): BoneyardHeadlessPackedActionMaskPlan {
  const source = requiredObject(value, 'Boneyard headless worker action mask plan')
  return {
    abilityByTarget: uint8(source.abilityByTarget, worldCount * 9 * 22, 'abilityByTarget'),
    aimByAbility: uint8(source.aimByAbility, worldCount * 22 * 9, 'aimByAbility'),
    movement: uint8(source.movement, worldCount * 9, 'plan movement'),
    target: uint8(source.target, worldCount * 9, 'plan target'),
  }
}

function requiredObject(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object') throw new Error(`${name} is invalid`)
  return value as Record<string, unknown>
}

function requiredArrayBuffer(value: unknown, name: string): ArrayBuffer {
  if (!(value instanceof ArrayBuffer)) {
    throw new Error(`Boneyard headless worker returned invalid ${name}`)
  }
  return value
}

function float32(value: unknown, length: number, name: string): Float32Array {
  const result = new Float32Array(requiredArrayBuffer(value, name))
  if (result.length !== length) throw new Error(`Boneyard headless worker returned invalid ${name} length`)
  return result
}

function float64(value: unknown, length: number, name: string): Float64Array {
  const result = new Float64Array(requiredArrayBuffer(value, name))
  if (result.length !== length) throw new Error(`Boneyard headless worker returned invalid ${name} length`)
  return result
}

function uint8(value: unknown, length: number, name: string): Uint8Array {
  const result = new Uint8Array(requiredArrayBuffer(value, name))
  if (result.length !== length) throw new Error(`Boneyard headless worker returned invalid ${name} length`)
  return result
}

function uint32(value: unknown, length: number, name: string): Uint32Array {
  const result = new Uint32Array(requiredArrayBuffer(value, name))
  if (result.length !== length) throw new Error(`Boneyard headless worker returned invalid ${name} length`)
  return result
}

function requiredStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Boneyard headless worker returned invalid ${name}`)
  }
  return value
}

function requiredEpisodeMetadata(
  value: unknown,
  worldCount: number,
): BoneyardHeadlessEpisodeMetadata[] {
  if (!Array.isArray(value) || value.length !== worldCount) {
    throw new Error('Boneyard headless worker returned invalid episode metadata')
  }
  return value.map((entry): BoneyardHeadlessEpisodeMetadata => {
    const source = requiredObject(entry, 'Boneyard headless worker episode metadata')
    if (
      typeof source.geometrySha256 !== 'string'
      || source.geometrySha256.length === 0
      || typeof source.runId !== 'string'
      || source.runId.length === 0
      || !Number.isInteger(source.seed)
      || Number(source.seed) < 0
      || Number(source.seed) > 0xffff_ffff
    ) throw new Error('Boneyard headless worker returned invalid episode metadata')
    return {
      geometrySha256: source.geometrySha256,
      runId: source.runId,
      seed: Number(source.seed),
    }
  })
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

function requiredPackedRewardTerms(
  value: unknown,
  worldCount: number,
): BoneyardHeadlessPackedRewardTerms {
  const source = requiredObject(value, 'Boneyard headless worker reward terms')
  return {
    death: float64(source.death, worldCount, 'rewardTerms.death'),
    ownDamage: float64(source.ownDamage, worldCount, 'rewardTerms.ownDamage'),
    selfHp: float64(source.selfHp, worldCount, 'rewardTerms.selfHp'),
    wave: float64(source.wave, worldCount, 'rewardTerms.wave'),
    xp: float64(source.xp, worldCount, 'rewardTerms.xp'),
  }
}

function setPackedRewardTerms(
  target: BoneyardHeadlessPackedRewardTerms,
  offset: number,
  source: BoneyardHeadlessPackedRewardTerms,
): void {
  target.death.set(source.death, offset)
  target.ownDamage.set(source.ownDamage, offset)
  target.selfHp.set(source.selfHp, offset)
  target.wave.set(source.wave, offset)
  target.xp.set(source.xp, offset)
}

function appendIndexedValues<Value>(
  target: BoneyardHeadlessIndexedValue<Value>[],
  value: unknown,
  worldOffset: number,
  laneWorldCount: number,
  name: string,
): void {
  if (!Array.isArray(value)) throw new Error(`Boneyard headless worker returned invalid ${name}`)
  for (const entry of value) {
    const source = requiredObject(entry, `Boneyard headless worker ${name} entry`)
    const worldIndex = requiredNumber(source.worldIndex, `${name} worldIndex`)
    if (!Number.isInteger(worldIndex) || worldIndex < 0 || worldIndex >= laneWorldCount) {
      throw new Error(`Boneyard headless worker returned invalid ${name} worldIndex`)
    }
    target.push({ value: source.value as Value, worldIndex: worldOffset + worldIndex })
  }
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
  return value
}

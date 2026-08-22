import { Worker } from 'node:worker_threads'

import type { MlBotPolicyActionMasks } from '../core-server/ml-bot-policy/actions.ts'
import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
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
  readonly observations: Float32Array
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

  async step(actions: Float32Array, ticks = 1): Promise<BoneyardHeadlessWorkerResult> {
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
    return this.combine(laneResults)
  }

  async reset(
    options: readonly BoneyardHeadlessResetOptions[],
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
    const hashes: string[] = []
    let worldOffset = 0
    for (const result of results) {
      if (!(result.observations instanceof ArrayBuffer) || !Array.isArray(result.hashes)) {
        throw new Error('Boneyard headless worker returned an invalid result')
      }
      const masks = requiredMasks(result.masks)
      const laneObservations = new Float32Array(result.observations)
      observations.set(laneObservations, worldOffset * this.observationLength)
      ability.set(masks.ability, worldOffset * 22)
      aim.set(masks.aim, worldOffset * 9)
      movement.set(masks.movement, worldOffset * 9)
      target.set(masks.target, worldOffset * 9)
      hashes.push(...result.hashes.map((hash) => String(hash)))
      worldOffset += result.hashes.length
    }
    return { hashes, masks: { ability, aim, movement, target }, observations }
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

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
  return value
}

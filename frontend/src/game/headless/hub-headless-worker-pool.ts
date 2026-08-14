import { Worker } from 'node:worker_threads'

import {
  HUB_HEADLESS_ACTION_STRIDE,
  type HubHeadlessEnvironmentOptions,
  type HubHeadlessResetOptions,
} from './hub-headless-environment.ts'

export interface HubHeadlessWorkerPoolOptions {
  environments: readonly HubHeadlessEnvironmentOptions[]
  workerCount?: number
}

export interface HubHeadlessWorkerResult {
  hashes: readonly string[]
  observations: Float32Array
}

interface WorkerLane {
  count: number
  offset: number
  rpc: WorkerRpc
}

export class HubHeadlessWorkerPool {
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

  static async create(options: HubHeadlessWorkerPoolOptions): Promise<HubHeadlessWorkerPool> {
    if (options.environments.length === 0) {
      throw new RangeError('headless worker pool requires at least one world')
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
          throw new Error('headless worker observation strides disagree')
        }
        lanes.push({ count, offset, rpc })
        offset += count
      }
      return new HubHeadlessWorkerPool(lanes, observationLength, options.environments.length)
    } catch (error) {
      await Promise.all(lanes.map(({ rpc }) => rpc.close()))
      throw error
    }
  }

  async step(actions: Float32Array, ticks = 1): Promise<HubHeadlessWorkerResult> {
    if (actions.length !== this.worldCount * HUB_HEADLESS_ACTION_STRIDE) {
      throw new RangeError('packed actions must match the worker-pool world count')
    }
    const laneResults = await Promise.all(this.lanes.map(async (lane) => {
      const start = lane.offset * HUB_HEADLESS_ACTION_STRIDE
      const end = start + lane.count * HUB_HEADLESS_ACTION_STRIDE
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

  async reset(options: readonly HubHeadlessResetOptions[]): Promise<HubHeadlessWorkerResult> {
    if (options.length !== this.worldCount) {
      throw new RangeError('reset options must match the worker-pool world count')
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

  private combine(results: readonly Record<string, unknown>[]): HubHeadlessWorkerResult {
    const observations = new Float32Array(this.worldCount * this.observationLength)
    const hashes: string[] = []
    let worldOffset = 0
    for (const result of results) {
      if (!(result.observations instanceof ArrayBuffer) || !Array.isArray(result.hashes)) {
        throw new Error('headless worker returned an invalid result')
      }
      const laneObservations = new Float32Array(result.observations)
      observations.set(laneObservations, worldOffset * this.observationLength)
      hashes.push(...result.hashes.map((hash) => String(hash)))
      worldOffset += result.hashes.length
    }
    return { hashes, observations }
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
    this.worker = new Worker(new URL('./hub-headless-worker.ts', import.meta.url), {
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
      if (code !== 0) this.rejectAll(new Error(`Hub headless worker exited with code ${code}`))
    })
  }

  call(message: Record<string, unknown> & { transfer?: readonly ArrayBuffer[] }): Promise<Record<string, unknown>> {
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
    this.rejectAll(new Error('Hub headless worker pool closed'))
    await this.worker.terminate()
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

function requiredNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be finite`)
  }
  return value
}

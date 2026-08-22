import { parentPort } from 'node:worker_threads'

import { BoneyardHeadlessBatch } from './boneyard-headless-batch.ts'
import type {
  BoneyardHeadlessEnvironmentOptions,
  BoneyardHeadlessResetOptions,
} from './boneyard-headless-environment.ts'

type WorkerRequest =
  | { id: number; type: 'initialize'; options: readonly BoneyardHeadlessEnvironmentOptions[] }
  | { actions: ArrayBuffer; id: number; ticks: number; type: 'step' }
  | { id: number; options: readonly BoneyardHeadlessResetOptions[]; type: 'reset' }

if (!parentPort) throw new Error('Boneyard headless worker requires a parent port')

let batch: BoneyardHeadlessBatch | undefined
parentPort.on('message', (message: WorkerRequest) => {
  try {
    if (message.type === 'initialize') {
      batch = new BoneyardHeadlessBatch(message.options)
      parentPort!.postMessage({
        id: message.id,
        observationLength: batch.observationLength,
        type: 'initialized',
        worldCount: batch.worldCount,
      })
      return
    }
    if (!batch) throw new Error('Boneyard headless worker is not initialized')
    const observations = message.type === 'reset'
      ? batch.reset(message.options)
      : batch.step(new Float32Array(message.actions), message.ticks)
    const masks = batch.lastActionMasks()
    const observationBuffer = observations.buffer as ArrayBuffer
    const ability = masks.ability.buffer as ArrayBuffer
    const aim = masks.aim.buffer as ArrayBuffer
    const movement = masks.movement.buffer as ArrayBuffer
    const target = masks.target.buffer as ArrayBuffer
    parentPort!.postMessage({
      hashes: batch.stateHashes(),
      id: message.id,
      masks: { ability, aim, movement, target },
      observations: observationBuffer,
      type: 'result',
    }, [observationBuffer, ability, aim, movement, target])
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id: message.id,
      type: 'error',
    })
  }
})

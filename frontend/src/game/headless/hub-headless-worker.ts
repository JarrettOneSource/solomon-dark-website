import { parentPort } from 'node:worker_threads'

import { HubHeadlessBatch } from './hub-headless-batch.ts'
import type {
  HubHeadlessEnvironmentOptions,
  HubHeadlessResetOptions,
} from './hub-headless-environment.ts'

type WorkerRequest =
  | { id: number; type: 'initialize'; options: readonly HubHeadlessEnvironmentOptions[] }
  | { actions: ArrayBuffer; id: number; ticks: number; type: 'step' }
  | { id: number; options: readonly HubHeadlessResetOptions[]; type: 'reset' }

if (!parentPort) throw new Error('Hub headless worker requires a parent port')

let batch: HubHeadlessBatch | undefined
parentPort.on('message', (message: WorkerRequest) => {
  try {
    if (message.type === 'initialize') {
      batch = new HubHeadlessBatch(message.options)
      parentPort!.postMessage({
        id: message.id,
        observationLength: batch.observationLength,
        type: 'initialized',
        worldCount: batch.worldCount,
      })
      return
    }
    if (!batch) throw new Error('Hub headless worker is not initialized')
    if (message.type === 'reset') {
      const observations = batch.reset(message.options)
      const observationBuffer = observations.buffer as ArrayBuffer
      parentPort!.postMessage({
        hashes: batch.stateHashes(),
        id: message.id,
        observations: observationBuffer,
        type: 'result',
      }, [observationBuffer])
      return
    }
    const observations = batch.step(new Float32Array(message.actions), message.ticks)
    const observationBuffer = observations.buffer as ArrayBuffer
    parentPort!.postMessage({
      hashes: batch.stateHashes(),
      id: message.id,
      observations: observationBuffer,
      type: 'result',
    }, [observationBuffer])
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id: message.id,
      type: 'error',
    })
  }
})

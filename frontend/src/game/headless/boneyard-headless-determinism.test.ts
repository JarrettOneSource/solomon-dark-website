import assert from 'node:assert/strict'
import test from 'node:test'

import { BoneyardHeadlessBatch } from './boneyard-headless-batch.ts'
import {
  BoneyardHeadlessEnvironment,
  createBoneyardHeadlessActionBuffer,
} from './boneyard-headless-environment.ts'
import { BoneyardHeadlessWorkerPool } from './boneyard-headless-worker-pool.ts'

test('same seed and actions match across direct, batch, and worker-pool execution', async () => {
  const reset = { seed: 0x2468_ace0 }
  const actions = createBoneyardHeadlessActionBuffer()
  const first = new BoneyardHeadlessEnvironment(reset)
  const second = new BoneyardHeadlessEnvironment(reset)
  const firstObservation = first.step(actions, 37)
  const secondObservation = second.step(actions, 37)
  assert.equal(first.stateHash(), second.stateHash())
  assert.deepEqual(firstObservation, secondObservation)

  const batch = new BoneyardHeadlessBatch([reset])
  const batchObservation = batch.step(actions, 37)
  assert.equal(batch.stateHashes()[0], first.stateHash())
  assert.deepEqual(batchObservation, firstObservation)

  const pool = await BoneyardHeadlessWorkerPool.create({ environments: [reset], workerCount: 1 })
  try {
    const worker = await pool.step(actions, 37)
    assert.equal(worker.hashes[0], first.stateHash())
    assert.deepEqual(worker.observations, firstObservation)
  } finally {
    await pool.close()
  }
})

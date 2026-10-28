import assert from 'node:assert/strict'
import test from 'node:test'

import { HubHeadlessBatch } from './hub-headless-batch.ts'
import {
  HUB_HEADLESS_ACTION_STRIDE,
  HUB_HEADLESS_OBSERVATION_HEADER,
  HubHeadlessEnvironment,
  createHubHeadlessActionBuffer,
} from './hub-headless-environment.ts'
import { HubHeadlessWorkerPool } from './hub-headless-worker-pool.ts'

const RESET = { seed: 0x12345678, studentCount: 32 }

test('headless reset reproduces observations and authoritative hashes', () => {
  const environment = new HubHeadlessEnvironment(RESET)
  const initialObservation = environment.observe()
  const initialHash = environment.stateHash()
  const actions = createHubHeadlessActionBuffer()
  actions[0] = 1
  environment.step(actions, 60)
  assert.notEqual(environment.stateHash(), initialHash)
  assert.deepEqual(environment.reset(RESET), initialObservation)
  assert.equal(environment.stateHash(), initialHash)
  assert.equal(initialObservation[HUB_HEADLESS_OBSERVATION_HEADER - 1], 32)
})

test('packed batches isolate worlds and preserve fixed observation strides', () => {
  const batch = new HubHeadlessBatch([RESET, RESET])
  const initialHashes = batch.stateHashes()
  assert.equal(initialHashes[0], initialHashes[1])
  const actions = createHubHeadlessActionBuffer(2)
  actions[0] = 1
  actions[HUB_HEADLESS_ACTION_STRIDE] = -1
  const observations = batch.step(actions, 30)
  const hashes = batch.stateHashes()
  assert.notEqual(hashes[0], hashes[1])
  assert.equal(observations.length, batch.worldCount * batch.observationLength)
  assert.ok(observations[1] > observations[batch.observationLength + 1])
})

test('persistent workers reset independent worlds without leaking prior steps', async () => {
  const pool = await HubHeadlessWorkerPool.create({
    environments: [RESET, { ...RESET, seed: RESET.seed + 1 }],
    workerCount: 2,
  })
  try {
    const reset = await pool.reset([RESET, { ...RESET, seed: RESET.seed + 1 }])
    const actions = createHubHeadlessActionBuffer(2)
    actions[0] = 1
    actions[HUB_HEADLESS_ACTION_STRIDE + 1] = 1
    const stepped = await pool.step(actions, 40)
    assert.notDeepEqual(stepped.hashes, reset.hashes)
    const repeated = await pool.reset([RESET, { ...RESET, seed: RESET.seed + 1 }])
    assert.deepEqual(repeated.hashes, reset.hashes)
    assert.deepEqual(repeated.observations, reset.observations)
  } finally {
    await pool.close()
  }
})

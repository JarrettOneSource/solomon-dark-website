import assert from 'node:assert/strict'
import test from 'node:test'

import { createBoneyardHeadlessActionBuffer } from './boneyard-headless-environment.ts'
import { BoneyardHeadlessWorkerPool } from './boneyard-headless-worker-pool.ts'

test('persistent Boneyard workers are deterministic across reset and worker lanes', async () => {
  const resets = [{ seed: 0x1234_5678 }, { seed: 0x1234_5679 }]
  const pool = await BoneyardHeadlessWorkerPool.create({
    environments: resets,
    workerCount: 2,
  })
  try {
    const initial = await pool.reset(resets)
    const actions = createBoneyardHeadlessActionBuffer(2)
    const stepped = await pool.step(actions, 10)
    assert.notDeepEqual(stepped.hashes, initial.hashes)
    assert.equal(stepped.observations.length, 2 * 1_784)
    assert.equal(stepped.masks.ability.length, 2 * 22)
    assert.deepEqual(stepped.transition.observations, initial.observations)
    assert.deepEqual(stepped.transition.nextObservations, stepped.observations)
    assert.deepEqual(stepped.transition.stateHashes, initial.hashes)
    assert.deepEqual(stepped.transition.nextStateHashes, stepped.hashes)
    assert.deepEqual(stepped.transition.actions, Uint8Array.from(actions))
    assert.deepEqual(stepped.transition.ticks, Uint32Array.from([10, 10]))
    assert.deepEqual(stepped.transition.dones, Uint8Array.from([0, 0]))
    assert.equal(stepped.transition.rewards.length, 2)
    assert.equal(stepped.transition.rewardTerms.ownDamage.length, 2)
    const repeated = await pool.reset(resets)
    assert.deepEqual(repeated.hashes, initial.hashes)
    assert.deepEqual(repeated.observations, initial.observations)
  } finally {
    await pool.close()
  }
})

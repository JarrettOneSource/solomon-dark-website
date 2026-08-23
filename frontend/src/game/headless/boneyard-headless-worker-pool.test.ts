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
    assert.equal(initial.plans.abilityByTarget.length, 2 * 9 * 22)
    assert.equal(initial.plans.aimByAbility.length, 2 * 22 * 9)
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
    assert.equal(stepped.plans.movement.length, 2 * 9)
    assert.equal(stepped.plans.target.length, 2 * 9)
    const repeated = await pool.reset(resets)
    assert.deepEqual(repeated.hashes, initial.hashes)
    assert.deepEqual(repeated.observations, initial.observations)
  } finally {
    await pool.close()
  }
})

test('worker pool supports authoritative expert steps and selective terminal resets', async () => {
  const resets = [{ seed: 41 }, { seed: 42 }]
  const pool = await BoneyardHeadlessWorkerPool.create({
    environments: resets,
    workerCount: 2,
  })
  try {
    const initial = await pool.reset(resets)
    const expert = await pool.expertStep(3)
    assert.deepEqual(expert.transition.ticks, Uint32Array.from([3, 3]))
    assert.notDeepEqual(expert.hashes, initial.hashes)
    const selectivelyReset = await pool.reset([resets[0]!, null])
    assert.equal(selectivelyReset.hashes[0], initial.hashes[0])
    assert.equal(selectivelyReset.hashes[1], expert.hashes[1])
  } finally {
    await pool.close()
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { BoneyardHeadlessBatch } from './boneyard-headless-batch.ts'
import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  createBoneyardHeadlessActionBuffer,
} from './boneyard-headless-environment.ts'

test('packed Boneyard batches isolate worlds and preserve schema-v5 strides', () => {
  const first = { seed: 0x1234_5678 }
  const second = { seed: 0x1234_5679 }
  const batch = new BoneyardHeadlessBatch([first, second])
  const initial = batch.stateHashes()
  const actions = createBoneyardHeadlessActionBuffer(2)
  actions[2] = 1
  actions[3] = 1
  actions[BONEYARD_HEADLESS_ACTION_STRIDE + 2] = 0
  const transition = batch.stepTransitions(actions, 5)
  const observations = transition.nextObservations
  assert.equal(observations.length, 2 * 1_784)
  assert.equal(transition.observations.length, 2 * 1_784)
  assert.deepEqual(transition.actions, Uint8Array.from(actions))
  assert.deepEqual(transition.stateHashes, initial)
  assert.deepEqual(transition.nextStateHashes, batch.stateHashes())
  assert.deepEqual(transition.ticks, Uint32Array.from([5, 5]))
  assert.deepEqual(transition.dones, Uint8Array.from([0, 0]))
  assert.equal(transition.rewards.length, 2)
  assert.equal(transition.rawRewards.length, 2)
  assert.equal(transition.rewardTerms.xp.length, 2)
  assert.notDeepEqual(batch.stateHashes(), initial)
  assert.notEqual(batch.stateHashes()[0], batch.stateHashes()[1])
  const masks = batch.lastActionMasks()
  assert.equal(masks.movement.length, 2 * 9)
  assert.equal(masks.target.length, 2 * 9)
  assert.equal(masks.ability.length, 2 * 22)
  assert.equal(masks.aim.length, 2 * 9)
})

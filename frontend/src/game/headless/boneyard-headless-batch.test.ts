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
  const observations = batch.step(actions, 5)
  assert.equal(observations.length, 2 * 1_784)
  assert.notDeepEqual(batch.stateHashes(), initial)
  assert.notEqual(batch.stateHashes()[0], batch.stateHashes()[1])
  const masks = batch.lastActionMasks()
  assert.equal(masks.movement.length, 2 * 9)
  assert.equal(masks.target.length, 2 * 9)
  assert.equal(masks.ability.length, 2 * 22)
  assert.equal(masks.aim.length, 2 * 9)
})

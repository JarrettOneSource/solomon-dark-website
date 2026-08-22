import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BONEYARD_HEADLESS_ACTION_STRIDE,
  BoneyardHeadlessEnvironment,
  createBoneyardHeadlessActionBuffer,
} from './boneyard-headless-environment.ts'

const RESET = { seed: 0x1234_5678 }

test('Boneyard headless reset reproduces schema-v5 observations and authoritative hashes', () => {
  const environment = new BoneyardHeadlessEnvironment(RESET)
  const initialObservation = environment.observe()
  const initialHash = environment.stateHash()
  assert.equal(initialObservation.length, 1_784)
  assert.equal(initialObservation[25], 1)
  assert.equal(environment.state().world.kind, 'boneyard')
  if (environment.state().world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.notEqual(environment.state().world.waves?.phase, 'dormant')
  const actions = createBoneyardHeadlessActionBuffer()
  actions[2] = 1
  actions[3] = 1
  environment.step(actions, 10)
  assert.notEqual(environment.stateHash(), initialHash)
  assert.deepEqual(environment.reset(RESET), initialObservation)
  assert.equal(environment.stateHash(), initialHash)
})

test('Boneyard headless action buffers use four selected categorical heads per world', () => {
  const actions = createBoneyardHeadlessActionBuffer(3)
  assert.equal(BONEYARD_HEADLESS_ACTION_STRIDE, 4)
  assert.equal(actions.length, 12)
  assert.deepEqual([...actions], new Array(12).fill(0))
  assert.throws(() => createBoneyardHeadlessActionBuffer(0), /positive integer/)
})

test('Boneyard headless reset rejects seeds outside uint32', () => {
  assert.throws(() => new BoneyardHeadlessEnvironment({ seed: -1 }), /uint32/)
  assert.throws(() => new BoneyardHeadlessEnvironment({ seed: 0x1_0000_0000 }), /uint32/)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { BoneyardHeadlessEnvironment } from '../../headless/boneyard-headless-environment.ts'
import { createZeroMlBotPolicyCheckpoint } from './checkpoint.ts'
import { MlBotPolicyRuntime } from './runtime.ts'

test('policy-driven headless step emits one strict main trajectory-v7 record', () => {
  const checkpoint = createZeroMlBotPolicyCheckpoint(123)
  checkpoint.tensors.value_bias[0] = 0.5
  const runtime = new MlBotPolicyRuntime(checkpoint)
  const environment = new BoneyardHeadlessEnvironment({ seed: 0x1234_5678 })
  const rollout = environment.stepPolicy(runtime, { mode: 'argmax' }, 1)
  assert.equal(rollout.record.trajectoryVersion, 7)
  assert.equal(rollout.record.observation.length, 3_026)
  assert.deepEqual(rollout.record.actions, { ability: 0, aim: 0, movement: 0, target: 0 })
  assert.equal(rollout.record.oldValue, 0.5)
  assert.ok(Number.isFinite(rollout.record.oldLogProbability))
  assert.equal(rollout.record.reward, 0)
  assert.equal(rollout.record.done, false)
  assert.deepEqual(rollout.transition.observation, rollout.record.observation)
  assert.deepEqual(rollout.nextObservation, rollout.transition.nextObservation)
})

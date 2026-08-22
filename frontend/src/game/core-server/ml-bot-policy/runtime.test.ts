import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createZeroMlBotPolicyCheckpoint,
  decodeMlBotPolicyCheckpoint,
  encodeMlBotPolicyCheckpoint,
  validateMlBotPolicyCheckpoint,
} from './checkpoint.ts'
import { MlBotPolicyRuntime } from './runtime.ts'
import { ML_BOT_POLICY_OBSERVATION_NAMES } from './spec.ts'

test('strict v5 runtime applies all four masks and returns one composite action', () => {
  const checkpoint = createZeroMlBotPolicyCheckpoint(0x1234_5678)
  checkpoint.tensors.movement_bias[2] = 3
  checkpoint.tensors.target_bias[1] = 4
  checkpoint.tensors.ability_bias[5] = 5
  checkpoint.tensors.aim_bias[3] = 6
  checkpoint.tensors.value_bias[0] = 1.25
  const runtime = new MlBotPolicyRuntime(checkpoint)
  const result = runtime.infer(
    new Float32Array(ML_BOT_POLICY_OBSERVATION_NAMES.length),
    {
      ability: Uint8Array.from({ length: 22 }, (_, index) => Number(index === 0 || index === 5)),
      aim: Uint8Array.from({ length: 9 }, (_, index) => Number(index === 0 || index === 3)),
      movement: Uint8Array.from({ length: 9 }, (_, index) => Number(index === 0 || index === 2)),
      target: Uint8Array.from({ length: 9 }, (_, index) => Number(index === 0 || index === 1)),
    },
    { mode: 'argmax' },
  )
  assert.deepEqual(result.actions, { ability: 5, aim: 3, movement: 2, target: 1 })
  assert.equal(result.value, 1.25)
  assert.ok(Number.isFinite(result.logProbability))
  assert.equal(result.probabilities.movement[1], 0)
  assert.equal(result.probabilities.ability[4], 0)
})

test('choice scorer is permutation-equivariant and mask-aware', () => {
  const checkpoint = createZeroMlBotPolicyCheckpoint(17)
  checkpoint.tensors.choice_score_bias[0] = 0.5
  const runtime = new MlBotPolicyRuntime(checkpoint)
  const observation = new Float32Array(ML_BOT_POLICY_OBSERVATION_NAMES.length)
  const descriptors = new Float32Array(3 * 56)
  descriptors[0] = 1
  descriptors[56] = 1
  descriptors[112] = 1
  const result = runtime.choose(observation, descriptors, Uint8Array.from([1, 0, 1]), {
    mode: 'argmax',
  })
  assert.equal(result.selectedOption, 0)
  assert.equal(result.probabilities[1], 0)
  assert.equal(result.probabilities[0], result.probabilities[2])
})

test('autoregressive inference selects target before ability and ability before aim', () => {
  const checkpoint = createZeroMlBotPolicyCheckpoint(23)
  checkpoint.tensors.target_bias[2] = 3
  checkpoint.tensors.ability_bias[4] = 4
  checkpoint.tensors.aim_bias[5] = 5
  const runtime = new MlBotPolicyRuntime(checkpoint)
  const result = runtime.inferAutoregressive(
    new Float32Array(ML_BOT_POLICY_OBSERVATION_NAMES.length),
    {
      movement: Uint8Array.from([1, 1, 0, 0, 0, 0, 0, 0, 0]),
      target: Uint8Array.from([1, 0, 1, 0, 0, 0, 0, 0, 0]),
    },
    target => {
      assert.equal(target, 2)
      return Uint8Array.from({ length: 22 }, (_, index) => Number(index === 0 || index === 4))
    },
    (target, ability) => {
      assert.equal(target, 2)
      assert.equal(ability, 4)
      return Uint8Array.from({ length: 9 }, (_, index) => Number(index === 0 || index === 5))
    },
    { mode: 'argmax' },
  )
  assert.deepEqual(result.actions, { ability: 4, aim: 5, movement: 0, target: 2 })
  assert.equal(result.masks.ability[4], 1)
  assert.equal(result.masks.aim[5], 1)
})

test('compact checkpoint encoding round-trips every tensor and strict metadata field', () => {
  const checkpoint = createZeroMlBotPolicyCheckpoint(99)
  checkpoint.tensors.value_bias[0] = -0.75
  const encoded = encodeMlBotPolicyCheckpoint(checkpoint)
  const decoded = decodeMlBotPolicyCheckpoint(encoded)
  validateMlBotPolicyCheckpoint(decoded)
  assert.equal(decoded.metadata.seed, 99)
  assert.equal(decoded.tensors.value_bias[0], -0.75)
  assert.deepEqual(encodeMlBotPolicyCheckpoint(decoded), encoded)
})

test('runtime rejects legacy versions and ordered-name drift with no shim', () => {
  const checkpoint = createZeroMlBotPolicyCheckpoint(1)
  assert.throws(() => validateMlBotPolicyCheckpoint({
    ...checkpoint,
    metadata: { ...checkpoint.metadata, modelVersion: 4 },
  }), /model version 5/)
  assert.throws(() => validateMlBotPolicyCheckpoint({
    ...checkpoint,
    metadata: {
      ...checkpoint.metadata,
      observationNames: ['mutated', ...checkpoint.metadata.observationNames.slice(1)],
    },
  }), /observation names/)
})

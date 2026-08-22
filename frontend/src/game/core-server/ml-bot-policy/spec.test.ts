import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ML_BOT_POLICY_ACTION_HEADS,
  ML_BOT_POLICY_BLOCKS,
  ML_BOT_POLICY_OBSERVATION_NAMES,
  ML_BOT_POLICY_SPEC,
  validateMlBotPolicyContract,
} from './spec.ts'

const EXPECTED_BLOCKS = [
  ['A', 32], ['B', 11], ['C', 120], ['D', 88], ['E', 9], ['F', 56],
  ['G', 85], ['I', 41], ['H', 43], ['J', 3], ['K', 352], ['L', 4],
  ['M', 104], ['N', 289], ['O', 230], ['P', 105], ['Q', 9], ['R', 141],
  ['S', 62],
] as const

const EXPECTED_BOUNDARIES = [
  ['A', 0, 32], ['B', 32, 43], ['C', 43, 163], ['D', 163, 251],
  ['E', 251, 260], ['F', 260, 316], ['G', 316, 401], ['I', 401, 442],
  ['H', 442, 485], ['J', 485, 488], ['K', 488, 840], ['L', 840, 844],
  ['M', 844, 948], ['N', 948, 1_237], ['O', 1_237, 1_467],
  ['P', 1_467, 1_572], ['Q', 1_572, 1_581], ['R', 1_581, 1_722],
  ['S', 1_722, 1_784],
] as const

test('schema v5 exposes the exact 1,784-value policy contract', () => {
  assert.equal(ML_BOT_POLICY_SPEC.modelVersion, 5)
  assert.equal(ML_BOT_POLICY_SPEC.observationVersion, 5)
  assert.equal(ML_BOT_POLICY_SPEC.mainTrajectoryVersion, 5)
  assert.equal(ML_BOT_POLICY_SPEC.choiceTrajectoryVersion, 5)
  assert.deepEqual(ML_BOT_POLICY_SPEC.hiddenSizes, [512, 256])
  assert.deepEqual(ML_BOT_POLICY_BLOCKS.map(({ key, names }) => [key, names.length]), EXPECTED_BLOCKS)
  assert.deepEqual(
    ML_BOT_POLICY_BLOCKS.map(({ end, key, start }) => [key, start, end]),
    EXPECTED_BOUNDARIES,
  )
  assert.equal(ML_BOT_POLICY_OBSERVATION_NAMES.length, 1_784)
  assert.equal(new Set(ML_BOT_POLICY_OBSERVATION_NAMES).size, 1_784)
  assert.deepEqual(Object.fromEntries(Object.entries(ML_BOT_POLICY_ACTION_HEADS).map(
    ([head, actions]) => [head, actions.length],
  )), { ability: 22, aim: 9, movement: 9, target: 9 })
})

test('schema validation rejects an ordered-name mutation', () => {
  const names = [...ML_BOT_POLICY_OBSERVATION_NAMES]
  names[0] = 'mutated_self_hp_ratio'
  assert.throws(
    () => validateMlBotPolicyContract({ ...ML_BOT_POLICY_SPEC, observationNames: names }),
    /observation names/,
  )
})

test('schema validation rejects an action-head mutation', () => {
  assert.throws(
    () => validateMlBotPolicyContract({
      ...ML_BOT_POLICY_SPEC,
      actionHeads: {
        ...ML_BOT_POLICY_ACTION_HEADS,
        movement: ML_BOT_POLICY_ACTION_HEADS.movement.slice(1),
      },
    }),
    /movement actions/,
  )
})

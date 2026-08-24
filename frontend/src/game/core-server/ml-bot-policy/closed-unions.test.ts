import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ML_BOT_POLICY_ENEMY_PHASE_MAP,
  ML_BOT_POLICY_EQUIPMENT_MODIFIER_FAMILIES,
  ML_BOT_POLICY_SECONDARY_ACTOR_CLASSES,
  assertMlBotPolicyClosedUnion,
  validateMlBotPolicyClosedUnions,
} from './closed-unions.ts'

test('schema v7 closes every simulation union named by the policy contract', () => {
  assert.doesNotThrow(validateMlBotPolicyClosedUnions)
  assert.equal(Object.keys(ML_BOT_POLICY_ENEMY_PHASE_MAP).length, 8)
  assert.equal(Object.keys(ML_BOT_POLICY_SECONDARY_ACTOR_CLASSES).length, 58)
  assert.equal(Object.keys(ML_BOT_POLICY_EQUIPMENT_MODIFIER_FAMILIES).length, 30)
})

test('closed-union validation fails when a simulation member has no mapping row', () => {
  assert.throws(
    () => assertMlBotPolicyClosedUnion(
      'fixture kinds',
      ['known', 'new-member'],
      { known: true },
    ),
    /new-member/,
  )
})

import assert from 'node:assert/strict'
import test from 'node:test'

import artifact from './policy-spec-v7.json' with { type: 'json' }
import { ML_BOT_PRIMARY_CURRICULUM } from './primary-curriculum.ts'
import {
  ML_BOT_POLICY_ACTION_HEADS,
  ML_BOT_POLICY_BLOCKS,
  ML_BOT_POLICY_OBSERVATION_NAMES,
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  ML_BOT_POLICY_SCALES,
  ML_BOT_POLICY_SPEC,
} from './spec.ts'

test('trainer artifact is an exact deterministic projection of the TypeScript policy spec', () => {
  assert.deepEqual(artifact, {
    ...ML_BOT_POLICY_SPEC,
    actionHeads: ML_BOT_POLICY_ACTION_HEADS,
    blocks: ML_BOT_POLICY_BLOCKS,
    observationNames: ML_BOT_POLICY_OBSERVATION_NAMES,
    optionDescriptorNames: ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
    primaryCurriculum: ML_BOT_PRIMARY_CURRICULUM,
    scales: ML_BOT_POLICY_SCALES,
  })
})

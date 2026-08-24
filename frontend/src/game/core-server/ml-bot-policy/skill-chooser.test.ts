import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation, getPlayerProgression } from '../game-simulation.ts'
import { ML_BOT_POLICY_OBSERVATION_NAMES } from './spec.ts'
import { resolveMlBotPolicySkillOffers } from './skill-chooser.ts'

test('deterministic chooser clears pending offers through the production selection path', () => {
  const initial = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }, { initialPlayerExperience: 100 })
  assert.ok(getPlayerProgression(initial, 'agent').pendingOffer)
  const observation = new Float32Array(ML_BOT_POLICY_OBSERVATION_NAMES.length)
  const first = resolveMlBotPolicySkillOffers(initial, ['agent'], { agent: observation })
  const second = resolveMlBotPolicySkillOffers(initial, ['agent'], { agent: observation })
  assert.deepEqual(first.selections, second.selections)
  assert.equal(first.selections.length, 1)
  assert.equal(first.events.length, 1)
  assert.equal(first.events[0]?.choiceMode, 'scripted')
  assert.equal(first.events[0]?.trainable, false)
  assert.equal(first.events[0]?.optionDescriptors.length, 3 * 138)
  assert.deepEqual(first.events[0]?.observation, observation)
  assert.equal(getPlayerProgression(first.state, 'agent').pendingOffer, null)
  assert.equal(first.state.levelUpBarrier, null)
})

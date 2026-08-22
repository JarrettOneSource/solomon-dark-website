import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation, getPlayerProgression } from '../game-simulation.ts'
import { resolveMlBotPolicySkillOffers } from './skill-chooser.ts'

test('deterministic chooser clears pending offers through the production selection path', () => {
  const initial = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }, { initialPlayerExperience: 100 })
  assert.ok(getPlayerProgression(initial, 'agent').pendingOffer)
  const first = resolveMlBotPolicySkillOffers(initial, ['agent'])
  const second = resolveMlBotPolicySkillOffers(initial, ['agent'])
  assert.deepEqual(first.selections, second.selections)
  assert.equal(first.selections.length, 1)
  assert.equal(getPlayerProgression(first.state, 'agent').pendingOffer, null)
  assert.equal(first.state.levelUpBarrier, null)
})

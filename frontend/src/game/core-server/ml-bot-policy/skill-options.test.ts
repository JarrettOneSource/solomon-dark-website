import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation, getPlayerProgression } from '../game-simulation.ts'
import { describeMlBotPolicySkillOffer } from './skill-options.ts'

test('choice descriptors encode offered mechanics in exact 56-value rows', () => {
  const state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  }, { initialPlayerExperience: 100 })
  const offer = getPlayerProgression(state, 'agent').pendingOffer
  assert.ok(offer)
  const described = describeMlBotPolicySkillOffer(state, 'agent')
  assert.ok(described)
  assert.equal(described.generation, offer.sequence)
  assert.equal(described.descriptors.length, offer.options.length * 56)
  assert.deepEqual([...described.mask], new Array(offer.options.length).fill(1))
  for (let option = 0; option < offer.options.length; option += 1) {
    const start = option * 56
    assert.equal(described.descriptors[start], 1)
    assert.ok(described.descriptors[start + 1]! >= 0)
    assert.ok(described.descriptors[start + 1]! <= 1)
    assert.ok(described.coverageKeys[option]!.length > 0)
  }
})

test('no pending offer produces no choice event', () => {
  const state = createGameSimulation({
    agent: { discipline: 'arcane', displayName: 'Agent', element: 'fire' },
  })
  assert.equal(describeMlBotPolicySkillOffer(state, 'agent'), null)
})

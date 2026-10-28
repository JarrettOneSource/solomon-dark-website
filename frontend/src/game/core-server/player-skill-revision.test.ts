import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createGameSimulation } from './game-simulation.ts'
import { grantPlayerEntitySkillRanks } from './player-entity-store.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'

test('a skill acquisition refreshes retained UI even when combat values are unchanged', () => {
  const state = createGameSimulation({ owner: {
    discipline: 'arcane', displayName: 'Aurelia', element: 'ether',
  } })
  const id = state.playerEntities.identities[0]!.playerId
  const previous = createGameSnapshot(state, id).players[id]!.progression
  for (const rank of [1, 2]) {
    const grant = grantPlayerEntitySkillRanks(state.playerEntities, id, 16, 1, createNativeRng(1))
    Object.assign(state, { playerEntities: grant.store, gameRng: grant.rng })
    const next = createGameSnapshot(state, id).players[id]!.progression
    assert.equal(next.currentHealth, previous.currentHealth)
    assert.equal(next.maximumHealth, previous.maximumHealth)
    assert.equal(next.maximumMana, previous.maximumMana)
    assert.equal(next.selectedPrimarySkillId, previous.selectedPrimarySkillId)
    assert.ok(next.learnedSkillOrder.includes(16))
    assert.equal(next.learnedSkills.find(([skillId]) => skillId === 16)?.[1], rank)
    assert.equal(next.revision, previous.revision + rank)
  }
})

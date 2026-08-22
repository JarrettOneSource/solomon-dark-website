import assert from 'node:assert/strict'
import test from 'node:test'

import type { NativeSecondaryActorState, NativeSecondarySimulationState } from '../../core-kernels/native-secondary-abilities.ts'
import { observeMlBotPolicyMinions } from './minions.ts'

function golem(id: number, ownerId: string, x: number, targetId: number): NativeSecondaryActorState {
  return {
    ageTicks: 100,
    golem: {
      currentHealth: 80,
      damageMaximum: 10,
      iron: true,
      maximumHealth: 100,
      phase: 'attack',
      reflectFactor: 2,
    },
    id,
    kind: 'golem',
    ownerId,
    position: { x, y: 100 },
    skillId: 45,
    targetId,
    worldKey: 'run',
  } as NativeSecondaryActorState
}

test('friendly minions sort own before allied and expose target cross-links', () => {
  const secondaryAbilities = {
    actors: [golem(2, 'ally', 110, 8), golem(1, 'agent', 200, 7)],
  } as unknown as NativeSecondarySimulationState
  const observed = observeMlBotPolicyMinions(secondaryAbilities, {
    playerId: 'agent',
    position: { x: 100, y: 100 },
    quickbar: [null, 45, null, null, null, null, null, null],
    worldKey: 'run',
  })
  assert.equal(observed.blockS.length, 4 * 15 + 2)
  assert.equal(observed.blockS[0], 1)
  assert.equal(observed.blockS[1], 1)
  assert.equal(observed.blockS[10], 1)
  assert.equal(observed.blockS[12], 1)
  assert.equal(observed.blockS[15], 1)
  assert.equal(observed.blockS[16], 0)
  assert.deepEqual([...observed.ownTargetIds], [7])
  assert.deepEqual(observed.secondaryMinionActive, [false, true, false, false, false, false, false, false])
})

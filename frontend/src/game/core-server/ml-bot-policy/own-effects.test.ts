import assert from 'node:assert/strict'
import test from 'node:test'

import type { NativeSecondarySimulationState } from '../../core-kernels/native-secondary-abilities.ts'
import type { PrimarySpellSimulationState } from '../../core-kernels/primary-spells.ts'
import { observeMlBotPolicyOwnEffects } from './own-effects.ts'

test('own effects expose active primary and quickbar-sourced persistent areas', () => {
  const primarySpells = {
    projectiles: [{
      ageTicks: 3,
      damage: 20,
      flightTicks: 3,
      id: 1,
      kind: 'fire',
      ownerId: 'agent',
      phase: 'flight',
      position: { x: 200, y: 100 },
      targetId: null,
      velocity: { x: 50, y: 0 },
      worldKey: 'run',
    }],
    transients: [],
  } as unknown as PrimarySpellSimulationState
  const secondaryAbilities = {
    actors: [{
      ageTicks: 25,
      damage: 10,
      id: 2,
      kind: 'magic-circle',
      lifetimeTicks: 125,
      ownerId: 'agent',
      position: { x: 120, y: 100 },
      radius: 30,
      skillId: 49,
      targetId: null,
      velocity: { x: 0, y: 0 },
      worldKey: 'run',
    }],
  } as unknown as NativeSecondarySimulationState
  const observed = observeMlBotPolicyOwnEffects({ primarySpells, secondaryAbilities }, {
    playerId: 'agent',
    position: { x: 100, y: 100 },
    quickbar: [49, null, null, null, null, null, null, null],
    worldKey: 'run',
  })
  assert.equal(observed.blockR.length, 6 * 23 + 3)
  assert.equal(observed.blockR[0], 1)
  assert.equal(observed.blockR[2], 1)
  assert.equal(observed.blockR[11], 1)
  assert.ok(Math.abs(observed.blockR[15]! - 0) < 1e-6)
  assert.ok(Math.abs(observed.blockR[19]! - 1 / 60) < 1e-6)
  assert.equal(observed.blockR[23], 1)
  assert.equal(observed.blockR[24], 1)
  assert.equal(observed.blockR[23 + 10], 1)
  assert.equal(observed.primaryEffectActive, true)
  assert.deepEqual(observed.secondaryEffectActive, [true, false, false, false, false, false, false, false])
})

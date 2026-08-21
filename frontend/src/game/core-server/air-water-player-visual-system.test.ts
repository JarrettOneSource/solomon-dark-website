import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import {
  createNativeHurricanePresentation,
  stepNativeHurricanePresentation,
} from '../core-kernels/native-hurricane.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { synchronizeAirWaterPlayerVisualActors } from './air-water-player-visual-system.ts'

test('Hurricane is one player-owned ECS actor that follows charge, position, and teardown', () => {
  const empty: PrimarySpellSimulationState = { nextId: 4, projectiles: [], transients: [] }
  const initialRng = createNativeRng(29)
  const expectedBorn = createNativeHurricanePresentation(initialRng)
  const born = synchronizeAirWaterPlayerVisualActors(empty, [{
    hurricaneContactCharge: 0,
    hurricaneCharge: 0.25,
    hurricaneDamageMaximum: 20,
    hurricaneDamageMinimum: 10,
    ownerId: 'air',
    position: { x: 10, y: 20 },
    worldKey: 'boneyard:1',
  }], 30, initialRng)
  assert.equal(born.spells.nextId, 5)
  assert.deepEqual(born.rng, expectedBorn.rng)
  assert.deepEqual(born.spells.transients, [{
    ageTicks: 0,
    birthTick: 30,
    charge: 0.25,
    contactCharge: 0,
    damageMaximum: 20,
    damageMinimum: 10,
    enhancedEffects: true,
    id: 4,
    kind: 'air-hurricane',
    lanes: expectedBorn.program.lanes,
    ownerId: 'air',
    phaseDegrees: 0,
    position: { x: 10, y: 20 },
    worldKey: 'boneyard:1',
  }])

  const expectedMoved = stepNativeHurricanePresentation(
    expectedBorn.program,
    0.25,
    expectedBorn.rng,
  )
  const moved = synchronizeAirWaterPlayerVisualActors(born.spells, [{
    hurricaneContactCharge: 0.25,
    hurricaneCharge: 0.5,
    hurricaneDamageMaximum: 30,
    hurricaneDamageMinimum: 15,
    ownerId: 'air',
    position: { x: 30, y: 40 },
    worldKey: 'boneyard:1',
  }], 31, born.rng)
  assert.equal(moved.spells.nextId, 5)
  assert.deepEqual(moved.rng, expectedMoved.rng)
  assert.deepEqual(moved.spells.transients[0], {
    ...born.spells.transients[0],
    ageTicks: 1,
    charge: 0.5,
    contactCharge: 0.25,
    damageMaximum: 30,
    damageMinimum: 15,
    lanes: expectedMoved.program.lanes,
    phaseDegrees: expectedMoved.program.phaseDegrees,
    position: { x: 30, y: 40 },
  })

  const released = synchronizeAirWaterPlayerVisualActors(moved.spells, [{
    hurricaneContactCharge: 0,
    hurricaneCharge: 0,
    hurricaneDamageMaximum: 30,
    hurricaneDamageMinimum: 15,
    ownerId: 'air',
    position: { x: 30, y: 40 },
    worldKey: 'boneyard:1',
  }], 32, moved.rng)
  assert.equal(released.spells.transients.length, 0)
})

test('Air/Water player visual synchronization rejects ambiguous owner rows', () => {
  const source: PrimarySpellSimulationState = { nextId: 1, projectiles: [], transients: [] }
  const owner = {
    hurricaneContactCharge: 0,
    hurricaneCharge: 0,
    hurricaneDamageMaximum: 0,
    hurricaneDamageMinimum: 0,
    ownerId: 'air',
    position: { x: 0, y: 0 },
    worldKey: 'hub:courtyard',
  }
  const rng = createNativeRng(0)
  assert.throws(
    () => synchronizeAirWaterPlayerVisualActors(source, [owner, owner], 0, rng),
    /duplicated/,
  )
  assert.throws(
    () => synchronizeAirWaterPlayerVisualActors(
      source,
      [{ ...owner, hurricaneCharge: 2 }],
      0,
      rng,
    ),
    /within \[0,1\]/,
  )
})

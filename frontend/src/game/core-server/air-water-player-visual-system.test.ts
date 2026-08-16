import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import { synchronizeAirWaterPlayerVisualActors } from './air-water-player-visual-system.ts'

test('Hurricane is one player-owned ECS actor that follows charge, position, and teardown', () => {
  const empty: PrimarySpellSimulationState = { nextId: 4, projectiles: [], transients: [] }
  const born = synchronizeAirWaterPlayerVisualActors(empty, [{
    hurricaneCharge: 0.25,
    ownerId: 'air',
    position: { x: 10, y: 20 },
    worldKey: 'boneyard:1',
  }], 30)
  assert.equal(born.nextId, 5)
  assert.deepEqual(born.transients, [{
    ageTicks: 0,
    birthTick: 30,
    charge: 0.25,
    id: 4,
    kind: 'air-hurricane',
    ownerId: 'air',
    position: { x: 10, y: 20 },
    worldKey: 'boneyard:1',
  }])

  const moved = synchronizeAirWaterPlayerVisualActors(born, [{
    hurricaneCharge: 0.5,
    ownerId: 'air',
    position: { x: 30, y: 40 },
    worldKey: 'boneyard:1',
  }], 31)
  assert.equal(moved.nextId, 5)
  assert.deepEqual(moved.transients[0], {
    ...born.transients[0],
    ageTicks: 1,
    charge: 0.5,
    position: { x: 30, y: 40 },
  })

  const released = synchronizeAirWaterPlayerVisualActors(moved, [{
    hurricaneCharge: 0,
    ownerId: 'air',
    position: { x: 30, y: 40 },
    worldKey: 'boneyard:1',
  }], 32)
  assert.equal(released.transients.length, 0)
})

test('Air/Water player visual synchronization rejects ambiguous owner rows', () => {
  const source: PrimarySpellSimulationState = { nextId: 1, projectiles: [], transients: [] }
  const owner = {
    hurricaneCharge: 0,
    ownerId: 'air',
    position: { x: 0, y: 0 },
    worldKey: 'hub:courtyard',
  }
  assert.throws(
    () => synchronizeAirWaterPlayerVisualActors(source, [owner, owner], 0),
    /duplicated/,
  )
  assert.throws(
    () => synchronizeAirWaterPlayerVisualActors(source, [{ ...owner, hurricaneCharge: 2 }], 0),
    /within \[0,1\]/,
  )
})

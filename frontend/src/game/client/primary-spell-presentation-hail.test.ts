import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  PrimarySpellSimulationState,
  PrimarySpellWaterHailState,
} from '../core-kernels/primary-spells.ts'
import {
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'
import { createRetainedBoneyardPrimarySpellPresentation } from './primary-spell-retained-hail-presentation.ts'
import {
  createPrimarySpellSimulationFrame,
  materializePrimarySpellSimulationFrame,
} from '../protocol/primary-spell-hail-replication.ts'

const olderHail = hail({
  ageTicks: 20,
  bounceProgress: Math.fround(0.4),
  height: -12,
  horizontalVelocity: { x: 4, y: -2 },
  life: Math.fround(1.7),
  position: { x: 100, y: 200 },
  rotationDegrees: 40,
  verticalVelocity: 3,
})
const newerHail = hail({
  ageTicks: 25,
  bounceProgress: 0.5,
  bounceSoundIndex: 2,
  bounceSoundPitch: Math.fround(1.2),
  bounceSoundSequence: 1,
  height: -2,
  horizontalVelocity: { x: 2, y: -4 },
  life: Math.fround(1.625),
  position: { x: 120, y: 180 },
  rotationDegrees: 80,
  verticalVelocity: -1,
})

test('retained Boneyard Hail presentation is value-identical and reuses live actor storage', () => {
  const retained = createRetainedBoneyardPrimarySpellPresentation()
  const time = { newerTick: 125, olderTick: 120, targetTick: 122.5 }
  const olderFrame = createPrimarySpellSimulationFrame(spells(olderHail))
  const newerFrame = createPrimarySpellSimulationFrame(spells(newerHail))
  const expected = interpolatePrimarySpellState(
    materializePrimarySpellSimulationFrame(olderFrame, time.olderTick),
    materializePrimarySpellSimulationFrame(newerFrame, time.newerTick),
    0.5,
    time,
  )
  const first = retained.interpolateFrame(
    olderFrame,
    newerFrame,
    0.5,
    time,
  )
  assert.deepEqual(first, expected)
  const firstActor = first.transients[0]
  assert.ok(firstActor?.kind === 'water-hail')
  const firstPosition = firstActor.position
  const firstVelocity = firstActor.horizontalVelocity
  const firstTransientArray = first.transients

  const secondExpected = interpolatePrimarySpellState(
    materializePrimarySpellSimulationFrame(olderFrame, time.olderTick),
    materializePrimarySpellSimulationFrame(newerFrame, time.newerTick),
    0.75,
    { ...time, targetTick: 123.75 },
  )
  const second = retained.interpolateFrame(
    olderFrame,
    newerFrame,
    0.75,
    { ...time, targetTick: 123.75 },
  )
  assert.deepEqual(second, secondExpected)
  assert.equal(second.transients, firstTransientArray)
  assert.equal(second.transients[0], firstActor)
  assert.ok(second.transients[0]?.kind === 'water-hail')
  assert.equal(second.transients[0].position, firstPosition)
  assert.equal(second.transients[0].horizontalVelocity, firstVelocity)
})

test('retained Boneyard Hail presentation retires storage before an id can be reused', () => {
  const retained = createRetainedBoneyardPrimarySpellPresentation()
  const firstFrame = createPrimarySpellSimulationFrame(spells(olderHail))
  const first = retained.copyFrame(
    firstFrame,
    120,
  ).transients[0]
  assert.ok(first?.kind === 'water-hail')
  assert.deepEqual(
    first,
    materializePrimarySpellSimulationFrame(firstFrame, 120).transients[0],
  )

  const empty = retained.copyFrame(createPrimarySpellSimulationFrame(spells()), 120)
  assert.deepEqual(empty.transients, [])

  const replacement = retained.copyFrame(
    createPrimarySpellSimulationFrame(spells({
      ...olderHail,
      position: { x: -50, y: 90 },
    })),
    120,
  ).transients[0]
  assert.ok(replacement?.kind === 'water-hail')
  assert.notEqual(replacement, first)
  assert.deepEqual(replacement.position, { x: -50, y: 90 })
})

test('retained Hail reindexes replacement tables at the same tick, including reordered and removed rows', () => {
  const retained = createRetainedBoneyardPrimarySpellPresentation()
  const second = hail({
    id: 9,
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 56 }],
    position: { x: -100, y: -200 },
  })
  const older = createPrimarySpellSimulationFrame({
    nextId: 10, projectiles: [], transients: [olderHail, second],
  })
  for (const transients of [
    [newerHail, second],
    [second, newerHail],
    [newerHail],
    [],
    [second, newerHail],
  ]) {
    const newer = createPrimarySpellSimulationFrame({ nextId: 10, projectiles: [], transients })
    for (const blend of [0.25, 0.75, 1]) {
      const time = { olderTick: 120, newerTick: 125, targetTick: 120 + 5 * blend }
      assert.deepEqual(
        retained.interpolateFrame(older, newer, blend, time),
        interpolatePrimarySpellState(
          materializePrimarySpellSimulationFrame(older, 120),
          materializePrimarySpellSimulationFrame(newer, 125),
          blend,
          time,
        ),
      )
    }
  }
})

function hail(
  overrides: Partial<PrimarySpellWaterHailState> = {},
): PrimarySpellWaterHailState {
  return {
    ageTicks: 20,
    birthTick: 100,
    bounceProgress: Math.fround(0.4),
    bounceSoundIndex: null,
    bounceSoundPitch: null,
    bounceSoundSequence: 0,
    height: -12,
    horizontalVelocity: { x: 4, y: -2 },
    id: 2,
    kind: 'water-hail',
    life: Math.fround(1.7),
    ownerId: 'wizard',
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 55 }],
    position: { x: 100, y: 200 },
    rotationDegrees: 40,
    rotationStepDegrees: 4,
    savedBounceVelocity: -2,
    scale: 0.5,
    verticalVelocity: 3,
    worldKey: 'boneyard:run-1',
    ...overrides,
  }
}

function spells(
  hailActor?: PrimarySpellWaterHailState,
): PrimarySpellSimulationState {
  return {
    nextId: 3,
    projectiles: [],
    transients: hailActor ? [hailActor] : [],
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardMaggotSnapshot } from '../protocol/game-state.ts'
import { nativeMaggotPresentationPlan } from './native-maggot-presentation.ts'

test('Maggot crawl, bite, facing, and death select recovered native records', () => {
  assert.deepEqual(entries(maggot({ headingDeg: 0, pose: 0 })), [{
    atlas: 'BadGuys',
    entry: 202,
  }])
  assert.deepEqual(entries(maggot({ headingDeg: 180, state: 'bite' })), [{
    atlas: 'BadGuys',
    entry: 229,
  }])
  assert.deepEqual(entries(maggot({ state: 'death' })), [{
    atlas: 'DeadHawg',
    entry: 28,
  }])
})

test('Maggot hit presentation appends the same native red redraw as enemies', () => {
  const plan = nativeMaggotPresentationPlan(maggot({
    alpha: 0.8,
    hitFlash: 0.5,
  }))

  assert.deepEqual(plan.layers, [
    {
      alpha: 0.8,
      atlas: 'BadGuys',
      blendMode: 'normal',
      entry: 202,
      offset: { x: 0, y: 0 },
      role: 'maggot-body',
      rotationRadians: 0,
      scale: 1,
      tint: 0xffffff,
    },
    {
      alpha: 0.4,
      atlas: 'BadGuys',
      blendMode: 'normal',
      entry: 202,
      offset: { x: 0, y: 0 },
      role: 'hit:maggot-body',
      rotationRadians: 0,
      scale: 1,
      tint: 0xff0000,
    },
  ])
})

test('Maggot emergence consumes its authoritative launch height and trajectory', () => {
  const plan = nativeMaggotPresentationPlan(maggot({
    emergencePhase: 2.5,
    emergenceTick: 12,
    emergenceOrientation: 3,
    launchTrajectory: 'lid',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    state: 'emerging',
    verticalOffset: -20,
  }))

  assert.equal(plan.layers[0]?.role, 'maggot-body-emerging-lid')
  assert.equal(plan.layers[0]?.entry, 2036)
  assert.deepEqual(plan.layers[0]?.offset, { x: 0, y: -20 })
})

test('Maggot ballistic lane enumerates all five phases and ten orientations', () => {
  const entries = new Set<number>()
  for (let phase = 0; phase < 5; phase += 1) {
    for (let orientation = 0; orientation < 10; orientation += 1) {
      entries.add(nativeMaggotPresentationPlan(maggot({
        emergencePhase: phase,
        emergenceOrientation: orientation,
        state: 'emerging',
      })).layers[0]!.entry)
    }
  }
  assert.deepEqual([...entries].sort((left, right) => left - right),
    Array.from({ length: 50 }, (_, index) => 2013 + index))
})

function entries(snapshot: BoneyardMaggotSnapshot) {
  return nativeMaggotPresentationPlan(snapshot).layers.map(({ atlas, entry }) => ({
    atlas,
    entry,
  }))
}

function maggot(overrides: Partial<BoneyardMaggotSnapshot>): BoneyardMaggotSnapshot {
  return {
    alpha: 1,
    currentHealth: 2,
    deathEpoch: 0,
    deathTick: 0,
    emergencePhase: 0,
    headingDeg: 0,
    hitFlash: 0,
    id: 1,
    emergenceTick: 24,
    emergenceOrientation: 0,
    launchTrajectory: 'edge',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
    maximumHealth: 2,
    ownerCoffinActorId: 2,
    pose: 0,
    position: { x: 0, y: 0 },
    spawnTick: 0,
    state: 'crawl',
    verticalOffset: 0,
    visualScale: 1,
    ...overrides,
  }
}

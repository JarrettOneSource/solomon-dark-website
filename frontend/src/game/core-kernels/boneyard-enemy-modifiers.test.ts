import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BOUNDED_ARCHER_RANDOM_HALF_ANGLE_DEG,
  BOUNDED_ARCHER_RANGE_BANDS,
  BOUNDED_ARCHER_SCATTER_HALF_ANGLE_DEG,
  BOUNDED_MAGE_RANGE_BANDS,
  NATIVE_WRAITH_DAZZLE_TICKS,
  boundedArcherAimHeading,
  boundedMageShieldIntervalTicks,
  nativeDazzleMovementScale,
} from './boneyard-enemy-modifiers.ts'

test('all recovered range modes select distinct bounded Archer and Mage bands', () => {
  assert.deepEqual(BOUNDED_ARCHER_RANGE_BANDS, {
    0: { maximum: 240, minimum: 120 },
    1: { maximum: 180, minimum: 80 },
    2: { maximum: 320, minimum: 180 },
    3: { maximum: 320, minimum: 100 },
  })
  assert.deepEqual(BOUNDED_MAGE_RANGE_BANDS, {
    0: { maximum: 220, minimum: 100 },
    1: { maximum: 165, minimum: 70 },
    2: { maximum: 300, minimum: 150 },
    3: { maximum: 300, minimum: 80 },
  })
})

test('leading aim predicts bounded target motion and multi-arrow aim is symmetric', () => {
  const base = {
    accuracyMode: 1 as const,
    arrowType: 'normal' as const,
    origin: { x: 0, y: 0 },
    projectileSpeed: 5,
    randomUnit: 0.5,
    targetPosition: { x: 0, y: -100 },
    targetVelocityPerTick: { x: 1, y: 0 },
    totalArrows: 3,
  }
  const headings = [0, 1, 2].map((arrowIndex) => boundedArcherAimHeading({
    ...base,
    arrowIndex,
  }))
  assert.ok(headings[1]! > 0, 'leading aim must lead a right-moving target')
  assert.ok(Math.abs((headings[1]! - headings[0]!) - 4) < 1e-9)
  assert.ok(Math.abs((headings[2]! - headings[1]!) - 4) < 1e-9)
})

test('random/scatter aim is deterministic for an actor sample and rejects unbounded counts', () => {
  const request = {
    accuracyMode: 3 as const,
    arrowIndex: 0,
    arrowType: 'fire' as const,
    origin: { x: 2, y: 3 },
    projectileSpeed: 5,
    randomUnit: 0.25,
    targetPosition: { x: 2, y: -100 },
    targetVelocityPerTick: { x: 0, y: 0 },
    totalArrows: 1,
  }
  assert.equal(boundedArcherAimHeading(request), boundedArcherAimHeading(request))
  assert.equal(boundedArcherAimHeading({
    ...request,
    accuracyMode: 0,
    randomUnit: 1,
  }), 0)
  assert.equal(boundedArcherAimHeading({
    ...request,
    accuracyMode: 2,
    randomUnit: 1,
  }), BOUNDED_ARCHER_SCATTER_HALF_ANGLE_DEG)
  assert.equal(boundedArcherAimHeading({
    ...request,
    accuracyMode: 3,
    randomUnit: 1,
  }), BOUNDED_ARCHER_RANDOM_HALF_ANGLE_DEG)
  assert.throws(() => boundedArcherAimHeading({ ...request, totalArrows: 10 }), /bounded program/)
})

test('Mage shield config units map into the named bounded authoritative clock', () => {
  assert.equal(boundedMageShieldIntervalTicks(10), 1_000)
  assert.equal(boundedMageShieldIntervalTicks(5), 500)
  assert.throws(() => boundedMageShieldIntervalTicks(-1), /non-negative/)
})

test('Wraith Dazzle exposes every exact 50-tick native ramp edge', () => {
  assert.equal(NATIVE_WRAITH_DAZZLE_TICKS, 50)
  for (let ticksRemaining = 50; ticksRemaining >= 1; ticksRemaining -= 1) {
    assert.equal(
      nativeDazzleMovementScale(ticksRemaining),
      (51 - ticksRemaining) / 50,
    )
  }
  assert.equal(nativeDazzleMovementScale(0), 1)
})

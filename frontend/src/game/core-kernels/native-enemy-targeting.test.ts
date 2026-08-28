import assert from 'node:assert/strict'
import test from 'node:test'

import { actorHeadingFromVector } from './actor-heading.ts'
import {
  NATIVE_ARCHER_RANGE_BASE,
  NATIVE_ARCHER_RANGE_RANDOM_MAXIMUM,
  NATIVE_MAGE_RANGE_BASE,
  NATIVE_MAGE_RANGE_RANDOM_MAXIMUM,
  applyNativeRangedRangeMode,
  buildNativeArcherVolley,
  nativeArcherFanOffset,
  restoreNativeRangeEasyAfterVolley,
} from './native-enemy-targeting.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

test('Archer and Mage construction ranges use one exact native maximum', () => {
  assert.equal(NATIVE_ARCHER_RANGE_BASE, 280)
  assert.equal(NATIVE_ARCHER_RANGE_RANDOM_MAXIMUM, 170)
  assert.equal(NATIVE_MAGE_RANGE_BASE, 312)
  assert.equal(NATIVE_MAGE_RANGE_RANDOM_MAXIMUM, 150)

  for (const base of [280, 450, 312, 462]) {
    assert.equal(applyNativeRangedRangeMode(base, 0), Math.fround(base))
    assert.equal(
      applyNativeRangedRangeMode(base, 1),
      Math.fround(Math.fround(base) / 1.8),
    )
    assert.equal(
      applyNativeRangedRangeMode(base, 2),
      Math.fround(Math.fround(base) * Math.fround(1.5)),
    )
    assert.equal(
      applyNativeRangedRangeMode(base, 3),
      applyNativeRangedRangeMode(base, 1),
    )
  }

  const restored = restoreNativeRangeEasyAfterVolley(
    applyNativeRangedRangeMode(400, 3),
    true,
  )
  assert.equal(restored.pending, false)
  assert.equal(restored.range, Math.fround(
    applyNativeRangedRangeMode(400, 3) * 1.8,
  ))
  assert.deepEqual(
    restoreNativeRangeEasyAfterVolley(restored.range, restored.pending),
    restored,
  )
})

test('native Archer direct and leading aim track the current target point', () => {
  const direct = buildNativeArcherVolley({
    accuracyMode: 0,
    arrowType: 'normal',
    extraArrows: 0,
    multiArrowMode: 0,
    origin: { x: 0, y: 0 },
    privateSeed: 42,
    targetPosition: { x: 0, y: -120 },
    targetVelocityPerTick: { x: 1, y: 0 },
  }, createNativeRng(99))
  assert.equal(direct.arrows.length, 1)
  assert.equal(direct.arrows[0]!.headingDeg, 0)
  assert.deepEqual(direct.arrows[0]!.position, { x: 0, y: -30 })
  const expectedSpeed = drawNativeFloat(createNativeRng(42), Math.fround(0.6))
  assert.equal(
    direct.arrows[0]!.speed,
    Math.fround(5.7 + expectedSpeed.value),
  )
  assert.ok(direct.arrows[0]!.speed >= 5.7 && direct.arrows[0]!.speed <= 6.3)
  assert.ok(direct.arrows[0]!.lifetimeTicks > 0)

  const leading = buildNativeArcherVolley({
    accuracyMode: 1,
    arrowType: 'normal',
    extraArrows: 0,
    multiArrowMode: 0,
    origin: { x: 0, y: 0 },
    privateSeed: 42,
    targetPosition: { x: 0, y: -120 },
    targetVelocityPerTick: { x: 1, y: 0 },
  }, createNativeRng(99))
  assert.ok(Math.abs(
    leading.arrows[0]!.headingDeg - actorHeadingFromVector(20, -120),
  ) < 0.00001)
})

test('scatter, random-mode choice, and the complete native fan stay in their RNG domains', () => {
  assert.deepEqual(
    Array.from({ length: 9 }, (_, index) => nativeArcherFanOffset(index)),
    [0, -10, 10, -20, 20, -30, 30, -40, 40],
  )

  const scatter = buildNativeArcherVolley({
    accuracyMode: 2,
    arrowType: 'poison',
    extraArrows: 0,
    multiArrowMode: 0,
    origin: { x: 10, y: 20 },
    privateSeed: 13579,
    targetPosition: { x: 100, y: 120 },
    targetVelocityPerTick: { x: 0, y: 0 },
  }, createNativeRng(24680))
  assert.equal(scatter.effectiveAccuracyMode, 2)
  assert.ok(scatter.aimOffsetRadius >= 0 && scatter.aimOffsetRadius <= 75)

  const fan = buildNativeArcherVolley({
    accuracyMode: 0,
    arrowType: 'fire',
    extraArrows: 8,
    multiArrowMode: 3,
    origin: { x: 0, y: 0 },
    privateSeed: 97531,
    targetPosition: { x: 0, y: -200 },
    targetVelocityPerTick: { x: 0, y: 0 },
  }, createNativeRng(86420))
  assert.equal(fan.arrows.length, 9)
  for (const [index, arrow] of fan.arrows.entries()) {
    const offset = nativeArcherFanOffset(index)
    const low = Math.min(offset * 0.9, offset * 1.1)
    const high = Math.max(offset * 0.9, offset * 1.1)
    const signedHeading = arrow.headingDeg > 180
      ? arrow.headingDeg - 360
      : arrow.headingDeg
    assert.ok(signedHeading >= low - 0.0001 && signedHeading <= high + 0.0001)
  }

  const random = buildNativeArcherVolley({
    accuracyMode: 3,
    arrowType: 'normal',
    extraArrows: 0,
    multiArrowMode: 0,
    origin: { x: 0, y: 0 },
    privateSeed: 123,
    targetPosition: { x: 0, y: -100 },
    targetVelocityPerTick: { x: 1, y: 0 },
  }, createNativeRng(321))
  assert.ok([0, 1, 2].includes(random.effectiveAccuracyMode))
  assert.notDeepEqual(random.sharedRngState, createNativeRng(321))
})

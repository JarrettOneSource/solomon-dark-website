import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advanceNativeEarthBoulderCharge,
  consumeNativeEarthBoulderContact,
  nativeEarthBoulderRockHitPitch,
  nativeEarthBoulderReleasedDamage,
  nativeEarthBoulderStoneBreakPitch,
  nativePercentRollSucceeds,
} from './native-earth-boulder.ts'

test('Boulder charge keeps the recovered f32 recurrence and honors Hasten/Gargantuan', () => {
  let charge = Math.fround(0.18)
  for (let tick = 0; tick < 170; tick += 1) {
    charge = advanceNativeEarthBoulderCharge(charge, 1, 1)
  }
  assert.equal(charge, 0.39249980449676514)
  assert.equal(advanceNativeEarthBoulderCharge(1.199, 2, 1.2), 1.2)
  assert.equal(
    advanceNativeEarthBoulderCharge(Math.fround(0.18), 2, 2.2),
    Math.fround(Math.fround(0.18) + Math.fround(Math.fround(1) * 0.0025)),
  )
})

test('Boulder release preserves the measured quadratic curve, floor, and cap', () => {
  assert.equal(nativeEarthBoulderReleasedDamage(10, 0), 0.25)
  assert.equal(
    nativeEarthBoulderReleasedDamage(10, 0.39249980449676514),
    1.5405609607696533,
  )
  assert.equal(nativeEarthBoulderReleasedDamage(10, 1), 10)
  assert.equal(nativeEarthBoulderReleasedDamage(10, 2), 12.5)
  assert.equal(nativeEarthBoulderReleasedDamage(10, 1, 0.5), 5)
})

test('Boulder contact separates payload, pool spend, shrink, traversal, and retirement', () => {
  assert.deepEqual(consumeNativeEarthBoulderContact({
    releaseBaseDamage: 10,
    releaseCharge: 1,
    remainingPool: 10,
    targetHealth: 4,
    toughness: 1,
  }), {
    charge: 0.9300000071525574,
    continueTraversal: true,
    damage: 4,
    depleted: false,
    remainingPool: 8,
  })
  assert.deepEqual(consumeNativeEarthBoulderContact({
    releaseBaseDamage: 10,
    releaseCharge: 1,
    remainingPool: 10,
    targetHealth: 4,
    toughness: 5,
  }), {
    charge: 0.9860000014305115,
    continueTraversal: true,
    damage: 4,
    depleted: false,
    remainingPool: 9.600000381469727,
  })
  assert.deepEqual(consumeNativeEarthBoulderContact({
    releaseBaseDamage: 10,
    releaseCharge: 1,
    remainingPool: 3,
    targetHealth: 20,
    toughness: 5,
  }), {
    charge: 0.6499999761581421,
    continueTraversal: false,
    damage: 3,
    depleted: true,
    remainingPool: 0,
  })
})

test('Boulder same-tick threshold is distinct from its zero-pool retirement edge', () => {
  const result = consumeNativeEarthBoulderContact({
    releaseBaseDamage: 10,
    releaseCharge: 1,
    remainingPool: 0.0014,
    targetHealth: 0.001,
    toughness: 1,
  })
  assert.deepEqual(result, {
    charge: 0.6500315070152283,
    continueTraversal: false,
    damage: 0.001,
    depleted: false,
    remainingPool: 0.0008999999845400453,
  })
})

test('Boulder zero-base contact preserves native infinity and NaN branches', () => {
  const surviving = consumeNativeEarthBoulderContact({
    releaseBaseDamage: 0,
    releaseCharge: 0.3012498915195465,
    remainingPool: 0.25,
    targetHealth: 0.1,
    toughness: 1,
  })
  assert.equal(surviving.charge, 0.3012498915195465)
  assert.equal(surviving.depleted, false)

  const terminal = consumeNativeEarthBoulderContact({
    releaseBaseDamage: 0,
    releaseCharge: 0.3012498915195465,
    remainingPool: 0.25,
    targetHealth: 1,
    toughness: 1,
  })
  assert.equal(Number.isNaN(terminal.charge), true)
  assert.equal(terminal.depleted, true)
})

test('native percent rolls retain their strict boundary', () => {
  assert.equal(nativePercentRollSucceeds(25, 24.999), true)
  assert.equal(nativePercentRollSucceeds(25, 25), false)
  assert.equal(nativePercentRollSucceeds(0, 0), false)
})

test('Boulder terminal sound pitches consume the restored pre-contact charge', () => {
  assert.equal(nativeEarthBoulderRockHitPitch(1), Math.fround(1.05))
  assert.equal(nativeEarthBoulderStoneBreakPitch(1), Math.fround(0.5))
  assert.equal(nativeEarthBoulderRockHitPitch(0.5), Math.fround(1.1))
  assert.equal(nativeEarthBoulderStoneBreakPitch(2.2), Math.fround(-0.1))
})

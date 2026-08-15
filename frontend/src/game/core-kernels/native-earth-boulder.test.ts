import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advanceNativeEarthBoulderCharge,
  consumeNativeEarthBoulderContact,
  nativeEarthBoulderReleasedDamage,
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

test('Boulder contact separates outgoing payload from Bind Rocks pool consumption', () => {
  assert.deepEqual(consumeNativeEarthBoulderContact(10, 4, 1), {
    damage: 4,
    remainingPool: 8,
  })
  assert.deepEqual(consumeNativeEarthBoulderContact(10, 4, 5), {
    damage: 4,
    remainingPool: 9.6,
  })
  assert.deepEqual(consumeNativeEarthBoulderContact(3, 20, 5), {
    damage: 3,
    remainingPool: 0,
  })
  assert.deepEqual(consumeNativeEarthBoulderContact(0.0014, 0.001, 1), {
    damage: 0.001,
    remainingPool: 0,
  })
})

test('native percent rolls retain their strict boundary', () => {
  assert.equal(nativePercentRollSucceeds(25, 24.999), true)
  assert.equal(nativePercentRollSucceeds(25, 25), false)
  assert.equal(nativePercentRollSucceeds(0, 0), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeHurricanePresentation,
  drawNativeHurricaneDamage,
  nativeHurricaneChargeTick,
  nativeHurricaneMovementDue,
  nativeHurricaneOrbitForce,
  NATIVE_HURRICANE_CONTACT_RADIUS,
  stepNativeHurricanePresentation,
} from './native-hurricane.ts'
import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeFloatRange,
} from './native-rng.ts'

test('Hurricane refresh latch preserves the first release tick and reinitializes from zero', () => {
  const first = nativeHurricaneChargeTick(0, false, true, true)
  assert.deepEqual(first, {
    contactCharge: 0,
    nextCharge: Math.fround(0.001500000013038516),
    refreshed: true,
  })
  const held = nativeHurricaneChargeTick(first.nextCharge, first.refreshed, true, true)
  assert.equal(held.contactCharge, first.nextCharge)
  assert.equal(held.nextCharge, Math.fround(first.nextCharge + 0.001500000013038516))
  const firstRelease = nativeHurricaneChargeTick(held.nextCharge, held.refreshed, true, false)
  assert.equal(firstRelease.contactCharge, held.nextCharge)
  assert.equal(firstRelease.nextCharge, held.nextCharge)
  assert.equal(firstRelease.refreshed, false)
  const decayed = nativeHurricaneChargeTick(
    firstRelease.nextCharge,
    firstRelease.refreshed,
    true,
    false,
  )
  assert.equal(decayed.contactCharge, 0)
  assert.equal(decayed.nextCharge, 0)
  assert.deepEqual(nativeHurricaneChargeTick(1, true, false, true), {
    contactCharge: 0,
    nextCharge: 0,
    refreshed: false,
  })
})

test('Hurricane activation consumes 16 alternating lane words and active step consumes one', () => {
  const initial = createNativeRng(29)
  const created = createNativeHurricanePresentation(initial)
  assert.deepEqual(created.rng, advanceNativeRngWords(initial, 16))
  assert.equal(created.program.lanes.length, 8)

  const angle0 = drawNativeFloat(initial, 360)
  const vertical0 = drawNativeFloat(angle0.state, 15)
  const angle1 = drawNativeFloat(vertical0.state, 360)
  const vertical1 = drawNativeFloat(angle1.state, 15)
  assert.deepEqual(created.program.lanes.slice(0, 2), [{
    angleDegrees: angle0.value,
    angularVelocityDegrees: 10,
    radius: 1.5,
    verticalOffset: vertical0.value,
  }, {
    angleDegrees: angle1.value,
    angularVelocityDegrees: Math.fround(7.5),
    radius: Math.fround(1.5 * 1.2000000476837158),
    verticalOffset: vertical1.value,
  }])

  const phase = drawNativeFloatRange(created.rng, 2, 3)
  const stepped = stepNativeHurricanePresentation(created.program, 0.5, created.rng)
  assert.deepEqual(stepped.rng, phase.state)
  assert.equal(stepped.program.phaseDegrees, Math.fround(phase.value * 0.5))
  assert.equal(
    stepped.program.lanes[0]!.angleDegrees,
    Math.fround(angle0.value + 10 * 0.5 * 0.75),
  )
})

test('Hurricane uses strict radius, clockwise tangent, native cadence, and charge-cubed damage', () => {
  assert.equal(nativeHurricaneMovementDue(13, 23), true)
  assert.equal(nativeHurricaneMovementDue(13, 24), false)
  assert.equal(nativeHurricaneOrbitForce(
    { x: 0, y: 0 },
    { x: NATIVE_HURRICANE_CONTACT_RADIUS, y: 0 },
    1,
  ), null)
  assert.deepEqual(nativeHurricaneOrbitForce(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    1,
  ), { x: 0, y: 14.986320495605469 })
  const tapered = nativeHurricaneOrbitForce(
    { x: 0, y: 0 },
    { x: 190, y: 0 },
    1,
  )!
  assert.equal(tapered.x, 0)
  assert.ok(tapered.y > 0 && tapered.y < 15)

  const initial = createNativeRng(2900)
  const randomDamage = drawNativeFloatRange(initial, 10, 20)
  const damage = drawNativeHurricaneDamage(initial, 0.5, 10, 20)
  assert.equal(damage.damage, Math.fround(0.5 ** 3 * randomDamage.value))
  assert.equal(damage.suppressHitSound, false)
  assert.deepEqual(damage.rng, randomDamage.state)
  assert.equal(drawNativeHurricaneDamage(initial, 0.499, 10, 20).suppressHitSound, true)
})

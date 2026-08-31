import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_WRAITH_CONTACT_COOLDOWN_TICKS,
  NATIVE_WRAITH_CONTACT_DISTANCE,
  NATIVE_WRAITH_FLYBY_TICKS,
  createNativeWraithFlightState,
  nativeWraithContactActionProgress,
  nativeWraithContactContains,
  nativeWraithMovement,
  resetNativeWraithFlightAfterContact,
  stepNativeWraithFlightClock,
} from './native-wraith-flight.ts'

test('Wraith construction derives native retained and initial speed endpoints from evaluated chase', () => {
  assert.deepEqual(createNativeWraithFlightState(1, 0, 0, 0), {
    baseFlybySpeed: Math.fround(0.8),
    contactCooldownTicks: 0,
    currentSpeed: 20,
    currentTurnGain: 1.5,
    flybyTicksRemaining: NATIVE_WRAITH_FLYBY_TICKS.minimum,
    restingSpeed: 0,
    targetTurnGain: 3,
  })
  const maximum = createNativeWraithFlightState(
    1.5,
    1 - Number.EPSILON,
    1 - Number.EPSILON,
    NATIVE_WRAITH_FLYBY_TICKS.randomCount - 1,
  )
  assert.equal(maximum.baseFlybySpeed, Math.fround(1.2))
  assert.ok(maximum.restingSpeed <= 12)
  assert.ok(maximum.currentSpeed <= 90)
  assert.equal(maximum.flybyTicksRemaining, 800)
})

test('Wraith flight advances two sequential high-speed turn vectors', () => {
  const state = createNativeWraithFlightState(1, 0, 0, 0)
  const movement = nativeWraithMovement({
    actorAgeTicks: 2,
    actorHeadingDeg: 0,
    actorPosition: { x: 0, y: 0 },
    pathSpeedFactor: 1,
    pathTurnFactor: 1,
    state,
    statusFactor: 1,
    targetPosition: { x: 500, y: 0 },
  })
  assert.equal(movement.headingDeg, 3)
  assert.deepEqual(movement.delta, {
    x: Math.fround(
      Math.fround(Math.sin(1.5 * Math.PI / 180) * 5)
      + Math.fround(Math.sin(3 * Math.PI / 180) * 5),
    ),
    y: Math.fround(
      -Math.fround(Math.cos(1.5 * Math.PI / 180) * 5)
      - Math.fround(Math.cos(3 * Math.PI / 180) * 5),
    ),
  })
  assert.ok(Math.hypot(movement.delta.x, movement.delta.y) > 9.9)
})

test('Wraith target loss keeps flight state and follows the native rotating far goal', () => {
  const state = createNativeWraithFlightState(1, 0, 0, 0)
  const movement = nativeWraithMovement({
    actorAgeTicks: 1,
    actorHeadingDeg: 0,
    actorPosition: { x: 50, y: 75 },
    pathSpeedFactor: 1,
    pathTurnFactor: 1,
    state,
    statusFactor: 1,
    targetPosition: null,
  })
  assert.equal(movement.headingDeg, 357)
  assert.ok(Math.hypot(movement.delta.x, movement.delta.y) > 9.9)
  assert.deepEqual(state, createNativeWraithFlightState(1, 0, 0, 0))
})

test('Wraith clock preserves cooldown order then decays flyby speed and turn', () => {
  const source = {
    ...createNativeWraithFlightState(1, 0.5, 0.5, 100),
    contactCooldownTicks: 50,
    currentSpeed: 40,
    currentTurnGain: 1,
    targetTurnGain: 10,
  }
  const cooling = stepNativeWraithFlightClock(source)
  assert.deepEqual(cooling, {
    ...source,
    contactCooldownTicks: 49,
    currentSpeed: Math.fround(40 - 0.025),
    currentTurnGain: 3,
    flybyTicksRemaining: source.flybyTicksRemaining - 1,
  })
  const decaying = stepNativeWraithFlightClock({ ...cooling, contactCooldownTicks: 0 })
  assert.equal(decaying.currentSpeed, Math.fround(cooling.currentSpeed - 1 - 0.025))
  assert.equal(decaying.currentTurnGain, 5)
  assert.equal(decaying.targetTurnGain, 8)
})

test('Wraith strict contact resets flight on every overlap but arms damage only after cooldown', () => {
  const source = createNativeWraithFlightState(1, 0.5, 0.5, 0)
  assert.equal(nativeWraithContactContains({ x: 0, y: 0 }, { x: 39.999, y: 0 }), true)
  assert.equal(nativeWraithContactContains({ x: 0, y: 0 }, { x: 40, y: 0 }), false)
  assert.equal(NATIVE_WRAITH_CONTACT_DISTANCE, 40)

  const reset = resetNativeWraithFlightAfterContact(source, 600, 1 - Number.EPSILON)
  assert.equal(reset.contactCooldownTicks, NATIVE_WRAITH_CONTACT_COOLDOWN_TICKS)
  assert.equal(reset.currentSpeed, Math.fround(source.baseFlybySpeed * 50))
  assert.equal(reset.currentTurnGain, 1)
  assert.equal(reset.flybyTicksRemaining, 800)
  assert.ok(reset.targetTurnGain >= 7 && reset.targetTurnGain <= 12)
  assert.equal(nativeWraithContactActionProgress(50), 0)
  assert.equal(nativeWraithContactActionProgress(49), 1)
  assert.equal(nativeWraithContactActionProgress(1), 49)
  assert.equal(nativeWraithContactActionProgress(0), 0)
})

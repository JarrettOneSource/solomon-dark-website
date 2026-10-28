import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EARTH_BOULDER_IDENTITY_ORIENTATION,
  earthBoulderFlightOrientationStep,
  earthBoulderHeldOrientationStep,
  earthBoulderTransformPoint,
} from './primary-spell-earth-orientation.ts'

function close(actual: readonly number[], expected: readonly number[], tolerance = 2e-7): void {
  assert.equal(actual.length, expected.length)
  for (const [index, value] of actual.entries()) {
    assert.ok(
      Math.abs(value - expected[index]) <= tolerance,
      `entry ${index}: expected ${expected[index]}, received ${value}`,
    )
  }
}

test('Earth held rotation postmultiplies the native row-vector Rodrigues matrix', () => {
  const first = earthBoulderHeldOrientationStep(
    EARTH_BOULDER_IDENTITY_ORIENTATION,
    { x: 0, y: -1 },
  )
  close(first, [
    1, 0, 0,
    0, 0.9999143481, 0.01308959536,
    0, -0.01308959536, 0.9999143481,
  ])

  const second = earthBoulderHeldOrientationStep(first, { x: 1, y: 0 })
  close(second, [
    0.9999143481, 0.008177005686, -0.01022125687,
    -0.008042513393, 0.9998814464, 0.01313068997,
    0.01032741554, -0.01304737944, 0.999861598,
  ])

  const reversed = earthBoulderHeldOrientationStep(
    earthBoulderHeldOrientationStep(EARTH_BOULDER_IDENTITY_ORIENTATION, { x: 1, y: 0 }),
    { x: 0, y: -1 },
  )
  assert.notDeepEqual(second, reversed)
})

test('Earth flight rotation continues from the held matrix using stored movement and charge', () => {
  const held = earthBoulderHeldOrientationStep(
    EARTH_BOULDER_IDENTITY_ORIENTATION,
    { x: 0, y: -1 },
  )
  const minimum = Math.fround(0.3012498915195465)
  const firstFlight = earthBoulderFlightOrientationStep(
    held,
    { x: 1, y: 0 },
    { x: Math.fround(3), y: 0 },
    minimum,
  )
  const secondFlight = earthBoulderFlightOrientationStep(
    firstFlight,
    { x: 1, y: 0 },
    { x: Math.fround(3), y: 0 },
    minimum,
  )

  assert.notDeepEqual(firstFlight, held)
  assert.notDeepEqual(secondFlight, firstFlight)
  assert.ok(firstFlight.every((value) => Number.isFinite(value) && value === Math.fround(value)))
})

test('Earth draw transforms row vectors and projects only transformed X and Y', () => {
  const orientation = earthBoulderHeldOrientationStep(
    EARTH_BOULDER_IDENTITY_ORIENTATION,
    { x: 0, y: -1 },
  )
  const transformed = earthBoulderTransformPoint({ x: 2, y: 3, z: 4 }, orientation)

  close([transformed.x, transformed.y, transformed.z], [
    2,
    3 * orientation[4] + 4 * orientation[7],
    3 * orientation[5] + 4 * orientation[8],
  ])
})

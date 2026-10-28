import assert from 'node:assert/strict'
import test from 'node:test'

import {
  projectNativeStickAim,
  projectNativeWorldPointer,
} from './gameplay-pointer.ts'

test('projects transformed browser coordinates through the native view origin and scale', () => {
  assert.deepEqual(projectNativeWorldPointer(
    { x: 410, y: 245 },
    { left: 10, top: 20, width: 800, height: 450 },
    { width: 1600, height: 900 },
    { x: 100, y: -50 },
    2,
  ), { x: 500, y: 175 })
})

test('projects Hub and Boneyard cameras with the same native screen-to-world equation', () => {
  assert.deepEqual(projectNativeWorldPointer(
    { x: 220, y: 170 },
    { left: 20, top: 20, width: 400, height: 300 },
    { width: 1600, height: 1200 },
    { x: 1_000, y: 2_000 },
    1.2,
  ), { x: 1_666.6666666666667, y: 2_500 })

  assert.deepEqual(projectNativeWorldPointer(
    { x: 800, y: 450 },
    { left: 0, top: 0, width: 1600, height: 900 },
    { width: 1600, height: 900 },
    { x: -200, y: 300 },
    1.35,
  ), {
    x: 392.5925925925926,
    y: 633.3333333333333,
  })
})

test('rejects unavailable surfaces and invalid native view scales', () => {
  assert.equal(projectNativeWorldPointer(
    { x: 10, y: 10 },
    { left: 0, top: 0, width: 0, height: 100 },
    { width: 1600, height: 900 },
    { x: 0, y: 0 },
    1,
  ), null)
  assert.equal(projectNativeWorldPointer(
    { x: 10, y: 10 },
    { left: 0, top: 0, width: 100, height: 100 },
    { width: 1600, height: 900 },
    { x: 0, y: 0 },
    0,
  ), null)
})

test('projects stick direction from the native torso anchor to the visible viewport radius', () => {
  assert.deepEqual(projectNativeStickAim(
    { x: 1, y: 0 },
    { x: 100, y: 200 },
    { width: 1600, height: 900 },
    1.25,
  ), { x: 440, y: 180 })

  const diagonal = projectNativeStickAim(
    { x: 1, y: -1 },
    { x: 100, y: 200 },
    { width: 1600, height: 900 },
    1.25,
  )
  assert.ok(diagonal)
  assert.ok(Math.abs(diagonal.x - 340.41630560342617) < 1e-12)
  assert.ok(Math.abs(diagonal.y - -60.41630560342617) < 1e-12)
})

test('rejects idle or invalid stick aim geometry', () => {
  assert.equal(projectNativeStickAim(
    { x: 0, y: 0 },
    { x: 100, y: 200 },
    { width: 1600, height: 900 },
    1.25,
  ), null)
  assert.equal(projectNativeStickAim(
    { x: 1, y: 0 },
    { x: 100, y: 200 },
    { width: 40, height: 40 },
    1.25,
  ), null)
  assert.equal(projectNativeStickAim(
    { x: Number.NaN, y: 0 },
    { x: 100, y: 200 },
    { width: 1600, height: 900 },
    1.25,
  ), null)
})

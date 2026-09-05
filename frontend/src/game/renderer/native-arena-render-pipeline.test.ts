import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeArenaSaturateSample } from './native-arena-render-pipeline.ts'

function assertRgbaClose(
  actual: readonly number[],
  expected: readonly number[],
  epsilon = 1e-12,
): void {
  assert.equal(actual.length, 4)
  for (let index = 0; index < 4; index += 1) {
    assert.ok(
      Math.abs(actual[index]! - expected[index]!) <= epsilon,
      `channel ${index}: ${actual[index]} !== ${expected[index]}`,
    )
  }
}

test('mirrors the Arena HLSL separate texture and vertex grey product', () => {
  assertRgbaClose(
    nativeArenaSaturateSample(
      [1, 1, 1, 1],
      [0.41, 0.55, 0.32, 0.75],
    ),
    [0.41583333333333333, 0.5068333333333334, 0.35733333333333334, 0.75],
  )
  assertRgbaClose(
    nativeArenaSaturateSample(
      [1, 1, 1, 1],
      [0.7, 0.95, 0.75, 0.5],
    ),
    [0.735, 0.8975, 0.7675000000000001, 0.5],
  )
  assertRgbaClose(
    nativeArenaSaturateSample(
      [0.2, 0.6, 0.9, 0.4],
      [0.8, 0.3, 0.5, 0.25],
    ),
    [0.20977777777777776, 0.22277777777777777, 0.3982777777777778, 0.1],
  )
})

test('keeps identity saturation, grayscale invariants, and zero alpha finite', () => {
  assertRgbaClose(
    nativeArenaSaturateSample(
      [0.2, 0.6, 0.9, 0.4],
      [0.8, 0.3, 0.5, 0.25],
      1,
    ),
    [0.16000000000000003, 0.18, 0.45, 0.1],
  )
  assertRgbaClose(
    nativeArenaSaturateSample(
      [0.4, 0.4, 0.4, 0.5],
      [0.7, 0.7, 0.7, 0.25],
    ),
    [0.27999999999999997, 0.27999999999999997, 0.27999999999999997, 0.125],
  )
  const transparent = nativeArenaSaturateSample(
    [0.8, 0.1, 0.5, 0],
    [0.2, 0.9, 0.4, 0],
  )
  assert.equal(transparent.every(Number.isFinite), true)
  assert.equal(transparent[3], 0)
})

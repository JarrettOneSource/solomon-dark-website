import assert from 'node:assert/strict'
import test from 'node:test'

import { cropBoneyardStaticPixels } from './boneyard-static-pixels.ts'

test('returns no resident for an entirely transparent painter surface', () => {
  assert.equal(cropBoneyardStaticPixels(new Uint8ClampedArray(3 * 2 * 4), 3, 2), null)
})

test('detaches an already-tight painter surface from its ImageData owner', () => {
  const pixels = new Uint8ClampedArray([
    1, 2, 3, 4,
    5, 6, 7, 8,
  ])
  const cropped = cropBoneyardStaticPixels(pixels, 2, 1)
  assert.deepEqual(cropped, {
    height: 1,
    pixels: new Uint8ClampedArray(pixels),
    width: 2,
    x: 0,
    y: 0,
  })
  assert.notEqual(cropped?.pixels, pixels)
})

test('copies exact RGBA rows inside the nontransparent crop bounds', () => {
  const pixels = new Uint8ClampedArray([
    1, 2, 3, 0, 10, 11, 12, 13, 14, 15, 16, 0, 17, 18, 19, 0,
    20, 21, 22, 0, 30, 31, 32, 33, 40, 41, 42, 43, 44, 45, 46, 0,
    50, 51, 52, 0, 60, 61, 62, 0, 70, 71, 72, 0, 73, 74, 75, 0,
  ])
  const cropped = cropBoneyardStaticPixels(pixels, 4, 3)
  assert.deepEqual(cropped, {
    height: 2,
    pixels: new Uint8ClampedArray([
      10, 11, 12, 13, 14, 15, 16, 0,
      30, 31, 32, 33, 40, 41, 42, 43,
    ]),
    width: 2,
    x: 1,
    y: 0,
  })
})

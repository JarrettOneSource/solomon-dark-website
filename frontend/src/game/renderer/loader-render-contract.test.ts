import assert from 'node:assert/strict'
import test from 'node:test'

import {
  LOADER_FILL_CLIP,
  LOADER_FILL_SIZE,
  LOADER_FRAME_CENTER,
  LOADER_FRAME_SIZE,
  LOADER_LOGO_BOUNDS,
  LOADER_RENDER_HEIGHT,
  LOADER_RENDER_WIDTH,
  loaderFillWidth,
} from './loader-render-contract.ts'

test('loader retains the native virtual canvas and authored registrations', () => {
  assert.equal(LOADER_RENDER_WIDTH, 480)
  assert.equal(LOADER_RENDER_HEIGHT, 320)
  assert.deepEqual(LOADER_LOGO_BOUNDS, { height: 227, width: 388, x: 41, y: 13 })
  assert.deepEqual(LOADER_FRAME_CENTER, { x: 240, y: 290 })
  assert.deepEqual(LOADER_FRAME_SIZE, { height: 230, width: 54 })
  assert.deepEqual(LOADER_FILL_SIZE, { height: 192, width: 18 })
  assert.deepEqual(LOADER_FILL_CLIP, { height: 18, width: 192, x: 144, y: 282 })
})

test('loader clips the native fill from zero through its complete width', () => {
  assert.equal(loaderFillWidth(-1), 0)
  assert.equal(loaderFillWidth(Number.NaN), 0)
  assert.equal(loaderFillWidth(0.25), 48)
  assert.equal(loaderFillWidth(1), 192)
  assert.equal(loaderFillWidth(2), 192)
})

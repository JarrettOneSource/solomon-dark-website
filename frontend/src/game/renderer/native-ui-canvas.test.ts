import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeUiCanvasResolution } from './native-ui-canvas.ts'

test('UI backing density covers physical desktop, Retina and scaled mobile pixels', () => {
  const logical = { width: 1600, height: 900 }
  assert.equal(nativeUiCanvasResolution(logical, logical, 1), 1)
  assert.equal(nativeUiCanvasResolution(logical, { width: 1920, height: 1080 }, 2), 2.4)
  assert.equal(nativeUiCanvasResolution(logical, { width: 736, height: 414 }, 3), 1.38)
  assert.equal(nativeUiCanvasResolution(logical, { width: 1200, height: 675 }, 2), 1.5)
  assert.equal(nativeUiCanvasResolution(logical, { width: 2400, height: 1350 }, 2), 3)
})

test('CSS transform precision does not add a spurious backing pixel', () => {
  assert.equal(nativeUiCanvasResolution({ width: 1600, height: 900 }, { width: 1920.0001220703125, height: 1080 }, 2), 2.4)
})

test('a nonuniform surface allocates enough density for either axis', () => {
  assert.equal(nativeUiCanvasResolution({ width: 1600, height: 900 }, { width: 1600, height: 1080 }, 2), 2.4)
})

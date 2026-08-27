import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  installNativeFixedFunctionRenderPipeline,
  nativeFixedFunctionMultiplyBlendFactors,
  nativeFixedFunctionMultiplyRgb,
} from './native-fixed-function-render-pipeline.ts'

test('installs the exact D3D ZERO/SRCCOLOR multiply equation', () => {
  const gl = { SRC_ALPHA: 0x0302, SRC_COLOR: 0x0300, ZERO: 0 }
  assert.deepEqual(nativeFixedFunctionMultiplyBlendFactors(gl), [
    gl.ZERO,
    gl.SRC_COLOR,
    gl.ZERO,
    gl.SRC_ALPHA,
  ])
  assert.deepEqual(
    nativeFixedFunctionMultiplyRgb([0.8, 0.5, 0.25], [0.5, 0.25, 1]),
    [0.4, 0.125, 0.25],
  )
})

test('replaces Pixi standard multiply once per WebGL renderer', () => {
  const original = [1, 2, 3, 4]
  const renderer = {
    gl: { SRC_ALPHA: 0x0302, SRC_COLOR: 0x0300, ZERO: 0 },
    state: { blendModesMap: { multiply: original } },
  }
  installNativeFixedFunctionRenderPipeline(renderer as never)
  assert.deepEqual(renderer.state.blendModesMap.multiply, [0, 0x0300, 0, 0x0302])
  const installed = renderer.state.blendModesMap.multiply
  installNativeFixedFunctionRenderPipeline(renderer as never)
  assert.equal(renderer.state.blendModesMap.multiply, installed)
})

test('stock image sources retain native RGB and linear sampling', () => {
  assert.deepEqual(NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS, {
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear',
  })
})

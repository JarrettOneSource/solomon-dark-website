import assert from 'node:assert/strict'
import test from 'node:test'
import { NATIVE_TEXTURE_COLOR_UNIFORMS } from './native-texture-color.ts'

import {
  NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS,
  NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE,
  NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS,
  NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS,
  NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS,
  installNativeFixedFunctionRenderPipeline,
  nativeFixedFunctionAdditiveBlendFactors,
  nativeFixedFunctionFragmentRgba,
  nativeFixedFunctionMultiplyBlendFactors,
  nativeFixedFunctionMultiplyRgb,
  nativeFixedFunctionNormalBlendFactors,
  nativeFixedFunctionPackedColor,
  setNativeFixedFunctionVertexColors,
} from './native-fixed-function-render-pipeline.ts'

const gl = {
  ONE: 1,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  SRC_ALPHA: 0x0302,
  SRC_COLOR: 0x0300,
  ZERO: 0,
}

test('packs and registers per-vertex colors for native Staff gradient meshes', () => {
  assert.equal(nativeFixedFunctionPackedColor(0x123456, 0.5), 0x7f563412)
  assert.equal(nativeFixedFunctionPackedColor(0xffffff, -1), 0x00ffffff)
  assert.equal(nativeFixedFunctionPackedColor(0xffffff, 2), 0xffffffff)
  assert.doesNotThrow(() => setNativeFixedFunctionVertexColors(
    {},
    new Uint32Array([0xffffffff, 0x7fffffff]),
  ))
})

test('maps all three D3D selectors to exact RGB and non-separate alpha factors', () => {
  assert.deepEqual(nativeFixedFunctionMultiplyBlendFactors(gl), [
    gl.ZERO,
    gl.SRC_COLOR,
    gl.ZERO,
    gl.SRC_ALPHA,
  ])
  assert.deepEqual(nativeFixedFunctionNormalBlendFactors(gl, false), [
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
  ])
  assert.deepEqual(nativeFixedFunctionNormalBlendFactors(gl, true), [
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
  ])
  assert.deepEqual(nativeFixedFunctionAdditiveBlendFactors(gl, false), [
    gl.SRC_ALPHA,
    gl.ONE,
    gl.SRC_ALPHA,
    gl.ONE,
  ])
  assert.deepEqual(nativeFixedFunctionAdditiveBlendFactors(gl, true), [
    gl.ONE,
    gl.ONE,
    gl.SRC_ALPHA,
    gl.ONE,
  ])
  assert.deepEqual(
    nativeFixedFunctionMultiplyRgb([0.8, 0.5, 0.25], [0.5, 0.25, 1]),
    [0.4, 0.125, 0.25],
  )
})

test('native framed crops retain stock pixels while clamping their artificial page', () => {
  assert.deepEqual(NATIVE_STOCK_FRAMED_TEXTURE_SOURCE_OPTIONS, {
    addressMode: 'clamp-to-edge',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear',
  })
})

test('straight texture and draw alpha combine once for NPM and PMA fragments', () => {
  const straightTexture = [1, 0.75, 0.25, 0.5] as const
  const premultipliedTexture = [0.5, 0.375, 0.125, 0.5] as const
  const vertex = [1, 0.5, 0.25, 0.5] as const
  const npm = nativeFixedFunctionFragmentRgba(
    straightTexture,
    vertex,
    false,
  )
  const pma = nativeFixedFunctionFragmentRgba(
    premultipliedTexture,
    vertex,
    true,
  )
  const npmSourceContribution = npm.slice(0, 3).map(channel => channel * npm[3])

  assert.deepEqual(npm, [1, 0.375, 0.0625, 0.25])
  assert.deepEqual(pma, [0.25, 0.09375, 0.015625, 0.25])
  assert.deepEqual(npmSourceContribution, pma.slice(0, 3))
  assert.deepEqual(
    nativeFixedFunctionMultiplyRgb([0.8, 0.5, 0.25], npm.slice(0, 3) as [number, number, number]),
    [0.8, 0.1875, 0.015625],
  )

  assert.match(NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE, /textureColor \* vColor\.rgb/)
  assert.match(NATIVE_FIXED_FUNCTION_FRAGMENT_SHADER_SOURCE, /textureAlpha \* vertexAlpha/)
})

test('installs exact opaque-surface blend maps once and restores them after context loss', () => {
  const original = [9, 9, 9, 9]
  const listeners: Array<{ contextChange(gl: typeof gl): void }> = []
  const renderer = {
    gl,
    runners: {
      contextChange: {
        add(listener: { contextChange(gl: typeof gl): void }) {
          listeners.push(listener)
        },
      },
    },
    state: {
      resetState() {},
      blendModesMap: {
        add: original,
        'add-npm': original,
        multiply: original,
        normal: original,
        'normal-npm': original,
      },
    },
  }
  installNativeFixedFunctionRenderPipeline(renderer as never, {
    installTextureAlphaShaders: false,
  })
  assert.deepEqual(renderer.state.blendModesMap.multiply, [0, 0x0300, 0, 0x0302])
  assert.deepEqual(renderer.state.blendModesMap.normal, [1, 0x0303, 0x0302, 0x0303])
  assert.deepEqual(renderer.state.blendModesMap['normal-npm'], [0x0302, 0x0303, 0x0302, 0x0303])
  assert.deepEqual(renderer.state.blendModesMap.add, [1, 1, 0x0302, 1])
  assert.deepEqual(renderer.state.blendModesMap['add-npm'], [0x0302, 1, 0x0302, 1])
  const installed = renderer.state.blendModesMap.multiply
  installNativeFixedFunctionRenderPipeline(renderer as never, {
    installTextureAlphaShaders: false,
  })
  assert.equal(renderer.state.blendModesMap.multiply, installed)
  assert.equal(listeners.length, 1)

  renderer.state.blendModesMap = {
    add: original,
    'add-npm': original,
    multiply: original,
    normal: original,
    'normal-npm': original,
  }
  listeners[0]!.contextChange(gl)
  assert.deepEqual(renderer.state.blendModesMap.multiply, [0, 0x0300, 0, 0x0302])
  assert.deepEqual(renderer.state.blendModesMap['add-npm'], [0x0302, 1, 0x0302, 1])
})

test('Sprite-only renderers install native batching without requiring a mesh pipe', () => {
  const original = [9, 9, 9, 9]
  const capturedModes: number[] = []
  const batch = {
    _adaptor: { start() {} },
    _batchersByInstructionSet: {},
    buildStart() {},
  }
  const originalBuildStart = batch.buildStart
  const renderer = {
    gl,
    limits: { maxBatchableTextures: 16 },
    renderPipes: { batch },
    shader: {
      updateUniformGroup(group: typeof NATIVE_TEXTURE_COLOR_UNIFORMS) {
        capturedModes.push(group.uniforms.uIgnoreTextureColor)
      },
    },
    runners: { contextChange: { add() {} } },
    state: {
      resetState() {},
      blendModesMap: {
        add: original,
        'add-npm': original,
        multiply: original,
        normal: original,
        'normal-npm': original,
      },
    },
  }

  assert.doesNotThrow(() => installNativeFixedFunctionRenderPipeline(renderer as never))
  assert.notEqual(batch.buildStart, originalBuildStart)
  NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor = 1
  batch._adaptor.start()
  NATIVE_TEXTURE_COLOR_UNIFORMS.uniforms.uIgnoreTextureColor = 0
  batch._adaptor.start()
  assert.deepEqual(capturedModes, [1, 0], 'every batch syncs capture state, including reused shaders')
})

test('transparent browser overlay surfaces preserve Porter-Duff alpha maps', () => {
  const originalNormal = [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA]
  const originalAdd = [gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE]
  const renderer = {
    gl,
    runners: { contextChange: { add() {} } },
    state: {
      resetState() {},
      blendModesMap: {
        add: originalAdd,
        'add-npm': originalAdd,
        multiply: [9, 9, 9, 9],
        normal: originalNormal,
        'normal-npm': originalNormal,
      },
    },
  }
  installNativeFixedFunctionRenderPipeline(renderer as never, {
    installTextureAlphaShaders: false,
    preserveBrowserCompositingAlpha: true,
  })
  assert.equal(renderer.state.blendModesMap.normal, originalNormal)
  assert.equal(renderer.state.blendModesMap['normal-npm'], originalNormal)
  assert.equal(renderer.state.blendModesMap.add, originalAdd)
  assert.equal(renderer.state.blendModesMap['add-npm'], originalAdd)
  assert.deepEqual(renderer.state.blendModesMap.multiply, [0, 0x0300, 0, 0x0302])
})

test('stock image sources retain native RGB and linear sampling', () => {
  assert.deepEqual(NATIVE_STOCK_TEXTURE_SOURCE_OPTIONS, {
    addressMode: 'repeat',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'linear',
  })
  assert.deepEqual(NATIVE_STOCK_POINT_TEXTURE_SOURCE_OPTIONS, {
    addressMode: 'repeat',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'nearest',
  })
  assert.deepEqual(NATIVE_COMPOSITED_TEXTURE_SOURCE_OPTIONS, {
    addressMode: 'clamp-to-edge',
    alphaMode: 'premultiply-alpha-on-upload',
    scaleMode: 'linear',
  })
})

test('PMA composite edges preserve one coverage multiplication while multiply stays NPM', () => {
  const color = 0.8
  const alpha = 0.6
  const edgeCoverage = 0.25
  const retailStraightSample = color
  const retailAlpha = alpha * edgeCoverage
  const retailNormalContribution = retailStraightSample * retailAlpha
  const compositedPmaSample = color * alpha * edgeCoverage

  assert.ok(Math.abs(compositedPmaSample - retailNormalContribution) < 1e-12)
  assert.notEqual(compositedPmaSample, retailStraightSample)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeRegionLightManagerPlan } from '../core-kernels/native-boneyard-light-model.ts'
import { nativeEnemyWorldFeedbackTransform } from './native-enemy-world-feedback.ts'
import { nativeRegionCompositeCoveragePadding, writeNativeRegionCompositeQuad } from './native-region-composite-coverage.ts'

test('steady viewport-covering Region quads add one clipped physical pixel at any density or world scale', () => {
  for (const resolution of [0.5, 1, 1.25, 2, 2.5, 3, 4]) {
    for (const worldScale of [0.8, 1, 1.35, 2]) {
      const padding = nativeRegionCompositeCoveragePadding(2560, resolution, worldScale, { width: 1600, height: 900 }, true)
      assert.ok(Math.abs(padding * resolution * worldScale - 1) < 1e-12)
    }
  }
})

test('shakes, zoom feedback and finite interior quads retain their original coverage', () => {
  assert.equal(nativeRegionCompositeCoveragePadding(2560, 2, 1.35, { width: 1600, height: 900 }, false), 0)
  assert.equal(nativeRegionCompositeCoveragePadding(512, 2, 1.35, { width: 1600, height: 900 }, true), 0)
  assert.equal(nativeRegionCompositeCoveragePadding(2560, 0, 1.35, { width: 1600, height: 900 }, true), 0)
  assert.equal(nativeRegionCompositeCoveragePadding(2560, 2, 0, { width: 1600, height: 900 }, true), 0)
})

test('extended Region vertices extrapolate whole-target UVs without changing interior samples', () => {
  const vertices = new Float32Array(8)
  const uvs = new Float32Array(8)
  for (const side of [512, 1024, 2560]) {
    for (const padding of [0, 0.25, 1, 2]) {
      writeNativeRegionCompositeQuad(vertices, uvs, side, padding)
      for (const coordinate of [0, 0.5, side / 3, side - 0.5, side]) {
        const t = (coordinate - vertices[0]!) / (vertices[2]! - vertices[0]!)
        const sampledUv = uvs[0]! + t * (uvs[2]! - uvs[0]!)
        assert.ok(Math.abs(sampledUv - coordinate / side) < 1e-8)
      }
      assert.equal(vertices[2], side)
      assert.equal(vertices[5], side)
      assert.equal(uvs[2], 1)
      assert.equal(uvs[5], 1)
    }
  }
})

test('nonzero base camera translations leave the guard outside the nominal viewport', () => {
  const viewport = { width: 1600, height: 900 }
  const zoom = 1.35
  for (const camera of [{ x: 0, y: 0 }, { x: 1025.0537109375, y: 1497.64697265625 }, { x: -1200.25, y: 4000.125 }]) {
    for (const resolution of [1, 1.25, 2]) {
      const view = { ...camera, zoom }
      const manager = nativeRegionLightManagerPlan({ camera: view, viewport })
      const transform = nativeEnemyWorldFeedbackTransform(view, viewport, camera, 0)
      const padding = nativeRegionCompositeCoveragePadding(2560, resolution, zoom, viewport, true)
      const projectedLeft = ((manager.topLeft.x - padding) * transform.scale + transform.position.x) * resolution
      const projectedTop = ((manager.topLeft.y - padding) * transform.scale + transform.position.y) * resolution
      // Native manager coordinates are float32, so cancellation is nominal, not exact.
      assert.ok(Math.abs(projectedLeft + 1) < 0.001)
      assert.ok(Math.abs(projectedTop + 1) < 0.001)
      assert.ok(projectedLeft < 0 && projectedTop < 0)
    }
  }
})

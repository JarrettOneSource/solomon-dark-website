import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  HUB_DIAGNOSTIC_WINDOW_FRAMES,
  HUB_WORLD_LAYER_BOUNDS,
  HUB_STUDENT_VISIBILITY_HALF_EXTENT,
  hubStudentIntersectsView,
  hubStudentVisibilityDiagnosticsDue,
  initialHubResolution,
  spriteFrameIndex,
} from './hub-render-contract.ts'

test('Hub world atlas pages stay within the texture limit', () => {
  for (const page of [0, 1, 2]) {
    const png = readFileSync(new URL(
      `../../assets/game/hub-visual-atlas-${page}.png`,
      import.meta.url,
    ))
    assert.ok(png.readUInt32BE(16) <= 2_048)
    assert.ok(png.readUInt32BE(20) <= 2_048)
  }
})

test('world overlays submit only their authored alpha bounds', () => {
  const fullArea = 2000 * 1024
  for (const [name, bounds] of Object.entries(HUB_WORLD_LAYER_BOUNDS)) {
    if (name === 'courtyardForeground') continue
    assert.ok(bounds.width * bounds.height < fullArea * 0.2)
  }
  assert.deepEqual(HUB_WORLD_LAYER_BOUNDS.sealCore, {
    x: 1889, y: 234, width: 111, height: 270,
  })
})

test('resolution follows displayed device pixels without a frame-rate quality fallback', () => {
  assert.equal(initialHubResolution({ devicePixelRatio: 1, displayScale: 1 }), 1)
  assert.equal(initialHubResolution({ devicePixelRatio: 3, displayScale: 0.5 }), 1.5)
  assert.equal(initialHubResolution({ devicePixelRatio: 1, displayScale: 0.3 }), 0.5)
  assert.equal(initialHubResolution({ devicePixelRatio: Number.NaN, displayScale: 1 }), 1)
})

test('sprite frame indices wrap in both directions', () => {
  assert.equal(spriteFrameIndex(5.9, 5), 0)
  assert.equal(spriteFrameIndex(-1, 5), 4)
  assert.equal(spriteFrameIndex(Number.NaN, 5), 0)
})

test('Student visibility instrumentation uses conservative actor bounds without culling art', () => {
  const camera = { x: 100, y: 200 }
  const view = { width: 800, height: 450 }
  assert.equal(HUB_STUDENT_VISIBILITY_HALF_EXTENT, 120)
  assert.equal(hubStudentIntersectsView({
    position: { x: -20, y: 300 },
    scale: 1,
  }, camera, view), true)
  assert.equal(hubStudentIntersectsView({
    position: { x: -21, y: 300 },
    scale: 1,
  }, camera, view), false)
  assert.equal(hubStudentIntersectsView({
    position: { x: 950, y: 300 },
    scale: 1.5,
  }, camera, view), true)
  assert.equal(hubStudentIntersectsView({
    position: { x: Number.NaN, y: 300 },
    scale: 1,
  }, camera, view), false)
})

test('Student visibility diagnostics retain their low-rate window but refresh on population edges', () => {
  assert.equal(HUB_DIAGNOSTIC_WINDOW_FRAMES, 120)
  assert.equal(hubStudentVisibilityDiagnosticsDue(1, 14, -1), true)
  assert.equal(hubStudentVisibilityDiagnosticsDue(2, 14, 14), false)
  assert.equal(hubStudentVisibilityDiagnosticsDue(119, 14, 14), false)
  assert.equal(hubStudentVisibilityDiagnosticsDue(120, 14, 14), true)
  assert.equal(hubStudentVisibilityDiagnosticsDue(121, 15, 14), true)
  assert.equal(hubStudentVisibilityDiagnosticsDue(122, 14, 15), true)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  HUB_COURTYARD_DEPTH_PROP_FRAME,
  HUB_COURTYARD_DEPTH_PROPS,
  HUB_DIAGNOSTIC_WINDOW_FRAMES,
  HUB_WORLD_DEPTH,
  HUB_WORLD_LAYER_BOUNDS,
  HUB_STUDENT_VISIBILITY_HALF_EXTENT,
  hubWorldDepthForActor,
  hubStudentIntersectsView,
  hubStudentVisibilityDiagnosticsDue,
  initialHubResolution,
  spriteFrameIndex,
} from './hub-render-contract.ts'

const hubWorldScene = readFileSync(new URL('./hub-world-scene.ts', import.meta.url), 'utf8')

test('native painter boundaries sort actors around Courtyard props and tent faces', () => {
  assert.deepEqual(HUB_COURTYARD_DEPTH_PROP_FRAME, {
    height: 263, width: 508, x: 582, y: 0,
  })
  assert.deepEqual(HUB_COURTYARD_DEPTH_PROPS, [
    { actorY: 162.5, record: 23 },
    { actorY: 169, record: 24 },
    { actorY: 215, record: 20 },
    { actorY: 239.5, record: 25 },
  ])
  assert.ok(hubWorldDepthForActor(215) < hubWorldDepthForActor(243.011703))
  assert.ok(hubWorldDepthForActor(239.5) < hubWorldDepthForActor(243.011703))
  assert.ok(hubWorldDepthForActor(699) < HUB_WORLD_DEPTH.usefulThyngsFront)
  assert.ok(hubWorldDepthForActor(701) > HUB_WORLD_DEPTH.usefulThyngsFront)
  assert.ok(HUB_WORLD_DEPTH.usefulThyngsShadow < HUB_WORLD_DEPTH.courtyard + 1000)
})

test('Courtyard fountain transients keep the shared additive FadeScale painter', () => {
  assert.match(
    hubWorldScene,
    /new Sprite\(this\.textures\.base\[hub\.fountainParticle\]\)[\s\S]*?sprite\.blendMode = 'add'/,
  )
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

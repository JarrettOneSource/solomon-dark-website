import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HUB_WORLD_DEPTH,
  HUB_WORLD_LAYER_BOUNDS,
  hubWorldDepthForActor,
  initialHubResolution,
  spriteFrameIndex,
} from './hub-render-contract.ts'

test('native painter boundaries sort actors beneath roofs and tent faces', () => {
  assert.ok(hubWorldDepthForActor(300) < HUB_WORLD_DEPTH.spawnRoof)
  assert.ok(hubWorldDepthForActor(340) > HUB_WORLD_DEPTH.spawnRoof)
  assert.ok(hubWorldDepthForActor(699) < HUB_WORLD_DEPTH.usefulThyngsFront)
  assert.ok(hubWorldDepthForActor(701) > HUB_WORLD_DEPTH.usefulThyngsFront)
  assert.ok(HUB_WORLD_DEPTH.usefulThyngsShadow < HUB_WORLD_DEPTH.courtyard + 1000)
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

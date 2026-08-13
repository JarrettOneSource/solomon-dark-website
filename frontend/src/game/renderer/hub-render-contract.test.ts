import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HUB_COURTYARD_DEPTH_PROP_FRAME,
  HUB_COURTYARD_DEPTH_PROPS,
  HUB_WORLD_DEPTH,
  HUB_WORLD_LAYER_BOUNDS,
  hubWorldDepthForActor,
  initialHubResolution,
  spriteFrameIndex,
} from './hub-render-contract.ts'

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

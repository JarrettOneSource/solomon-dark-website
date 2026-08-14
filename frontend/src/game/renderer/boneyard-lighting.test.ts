import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_LANTERN_LIGHT_MIN_INTENSITY,
  NATIVE_LANTERN_LIGHT_FLICKER,
  NATIVE_REGION_LIGHT_ATLAS,
  NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX,
  NATIVE_REGION_LIGHT_ENTRY,
  nativeAcceptedBoneyardLightSources,
  nativeBoneyardLightScalar,
  nativeBoneyardLightTint,
  nativeLanternLightSource,
  nativePlayerLightSource,
  nativeRegionLightStamp,
  nativeSolomonSetPieceLighting,
} from './boneyard-lighting.ts'

test('anchors the ordinary player light fifteen units along native heading', () => {
  assert.deepEqual(nativePlayerLightSource({
    headingIndex: 0,
    position: { x: 100, y: 200 },
  }), {
    intensity: 1,
    multipleShadows: true,
    position: { x: 100, y: 185 },
    radius: 2.6,
  })
  const right = nativePlayerLightSource({
    headingIndex: 6,
    position: { x: 100, y: 200 },
  })
  assert.ok(Math.abs(right.position.x - 115) < 1e-12)
  assert.ok(Math.abs(right.position.y - 200) < 1e-12)
})

test('uses the recovered elliptical plateau, squared falloff, and outer edge', () => {
  const source = [{ intensity: 0.6, position: { x: 0, y: 0 }, radius: 1 }]
  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 0 }, source), 0.6)
  assert.equal(nativeBoneyardLightScalar({ x: 75, y: 0 }, source), 0.6)
  assert.equal(
    nativeBoneyardLightScalar({ x: 100, y: 0 }, source),
    0.6 * (1 - (10_000 - 5_625) / 15_400),
  )
  assert.equal(nativeBoneyardLightScalar({ x: 145, y: 0 }, source), 0)
  assert.ok(nativeBoneyardLightScalar({ x: 0, y: 123.249 }, source) > 0)
  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 123.25 }, source), 0)
})

test('takes the native maximum contribution and keeps Lantern flicker cosmetic', () => {
  const sources = [
    { intensity: 0.4, position: { x: 0, y: 0 }, radius: 1 },
    { intensity: 0.7, position: { x: 0, y: 0 }, radius: 1 },
  ]
  assert.equal(nativeBoneyardLightScalar({ x: 0, y: 0 }, sources), 0.7)
  const samples = Array.from({ length: 64 }, (_, frame) => (
    nativeLanternLightSource({ x: 4, y: 5 }, frame).intensity
  ))
  assert.ok(samples.every((sample) => (
    sample >= NATIVE_LANTERN_LIGHT_MIN_INTENSITY
    && sample < NATIVE_LANTERN_LIGHT_MIN_INTENSITY + NATIVE_LANTERN_LIGHT_FLICKER
  )))
  assert.ok(new Set(samples).size > 60)
  assert.equal(nativeLanternLightSource({ x: 4, y: 5 }, 0).multipleShadows, false)
})

test('preserves the native ordered containment gate for overlapping sources', () => {
  const dominant = {
    intensity: 1,
    multipleShadows: true,
    position: { x: 0, y: 0 },
    radius: 2,
  }
  const contained = {
    intensity: 0.8,
    multipleShadows: false,
    position: { x: 144, y: 0 },
    radius: 1,
  }
  const accepted = nativeAcceptedBoneyardLightSources([dominant, contained], [])
  assert.deepEqual(accepted, [dominant])

  const boundary = { ...contained, position: { x: 145, y: 0 } }
  assert.deepEqual(
    nativeAcceptedBoneyardLightSources([dominant, boundary], []),
    [dominant, boundary],
  )
  assert.deepEqual(
    nativeAcceptedBoneyardLightSources([
      dominant,
      { ...contained, intensity: 1.1 },
      { ...contained, multipleShadows: true },
    ], []),
    [
      dominant,
      { ...contained, intensity: 1.1 },
      { ...contained, multipleShadows: true },
    ],
  )
})

test('projects the scalar into the renderer grayscale tint lane', () => {
  assert.equal(nativeBoneyardLightTint(0), 0x000000)
  assert.equal(nativeBoneyardLightTint(0.5), 0x808080)
  assert.equal(nativeBoneyardLightTint(1), 0xffffff)
})

test('stamps the recovered Region light glyph before the native main queue', () => {
  assert.equal(NATIVE_REGION_LIGHT_ATLAS, 'DeadHawg')
  assert.equal(NATIVE_REGION_LIGHT_ENTRY, 18)
  assert.ok(0 < NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX)
  assert.ok(NATIVE_REGION_LIGHT_COMPOSITE_Z_INDEX < 1)
  assert.deepEqual(nativeRegionLightStamp(
    { intensity: 0.6, position: { x: 40, y: 50 }, radius: 0.65 },
    { x: 400, y: 300 },
    { anchorX: 168, anchorY: 153, h: 305, w: 336 },
    1.35,
  ), {
    alpha: 0.6,
    anchorX: 0.5,
    anchorY: 153 / 305,
    scale: 0.8775000000000001,
    x: 400,
    y: 300,
  })
})

test('lights Solomon Dig through the shared dirt-and-body Puppet root', () => {
  assert.deepEqual(nativeSolomonSetPieceLighting(
    { x: 0, y: 0 },
    { x: 300, y: 300 },
    [{ intensity: 1, position: { x: 0, y: 0 }, radius: 1 }],
  ), {
    digRootTint: 0xffffff,
    lanternTint: 0x000000,
  })
})

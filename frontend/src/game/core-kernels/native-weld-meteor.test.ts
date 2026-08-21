import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from './native-rng.ts'
import {
  NATIVE_WELD_METEOR_IMPACT_DEBRIS_COUNT,
  NATIVE_WELD_METEOR_MARKER_ALPHA_STEP,
  createNativeWeldMeteorImpactProgram,
  createNativeWeldMeteorSpawnProgram,
  nativeWeldMeteorCadenceTicks,
  nativeWeldMeteorTargetPoint,
  spawnNativeWeldMeteorMarker,
  stepNativeWeldMeteorMarker,
} from './native-weld-meteor.ts'

test('Meteor marker consumes its four native words and owns the Iceblast fade', () => {
  const rng = createNativeRng(17)
  const color = drawNativeFloat(rng, Math.fround(0.5))
  const rotation = drawNativeFloat(color.state, 360)
  const growth = drawNativeInteger(rotation.state, 2)
  const alpha = drawNativeFloat(growth.state, Math.fround(0.5))
  const spawned = spawnNativeWeldMeteorMarker({
    direction: { x: 1, y: 0 },
    id: 4,
    origin: { x: 160, y: 0 },
    ownerId: 'wizard',
    rng,
    tick: 10,
    vector: [8, 16, 20, 1, 1, 0, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  assert.equal(spawned.marker.colorGreen, color.value)
  assert.equal(spawned.marker.rotationDegrees, rotation.value)
  assert.equal(
    spawned.marker.growthFactor,
    growth.value === 1 ? Math.fround(0.99) : Math.fround(1.015),
  )
  assert.equal(spawned.marker.alpha, Math.fround(Math.fround(alpha.value + 0.5) * 0.5))
  assert.deepEqual(spawned.rng, alpha.state)
  const stepped = stepNativeWeldMeteorMarker(spawned.marker)
  assert.ok(stepped)
  assert.equal(
    stepped.alpha,
    Math.fround(spawned.marker.alpha - NATIVE_WELD_METEOR_MARKER_ALPHA_STEP),
  )
  assert.equal(stepped.scale, Math.fround(3.5 * spawned.marker.growthFactor))
})

test('Meteor selection-age cadence uses cast speed and the weak 35-tick branch', () => {
  assert.equal(nativeWeldMeteorCadenceTicks(1, false), 25)
  assert.equal(nativeWeldMeteorCadenceTicks(1, true), 35)
  assert.equal(nativeWeldMeteorCadenceTicks(2, false), 12)
  assert.equal(nativeWeldMeteorCadenceTicks(9, false), 5)
  assert.throws(() => nativeWeldMeteorCadenceTicks(0.4, false), /round above zero/)
  assert.deepEqual(nativeWeldMeteorTargetPoint(
    { x: 10, y: 20 },
    { x: 0, y: -1 },
  ), { x: 10, y: -140 })
})

test('Meteor spawn retains seven normal words but omits weak private fire state', () => {
  const rng = createNativeRng(31)
  const normal = createNativeWeldMeteorSpawnProgram({
    aimDirection: { x: 1, y: 0 },
    center: { x: 100, y: 200 },
    resolvePosition: (candidate) => candidate,
    rng,
    underpowered: false,
    vector: [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3],
  })
  assert.deepEqual(normal.rng, advanceNativeRngWords(rng, 7))
  assert.ok(normal.bodyScale >= 0.75 && normal.bodyScale <= 1)
  assert.ok(normal.fallHeight >= 5 && normal.fallHeight <= 6.25)
  assert.equal(normal.impactTicks, 275)
  assert.ok(normal.privateSeed >= 0 && normal.privateSeed < 10_000_000)

  const weak = createNativeWeldMeteorSpawnProgram({
    aimDirection: { x: -1, y: 0 },
    center: { x: 100, y: 200 },
    resolvePosition: () => ({ x: 5, y: 6 }),
    rng,
    underpowered: true,
    vector: [8, 16, 20, 1.1, 1.5, 3, 10, 2, 3],
  })
  assert.deepEqual(weak.rng, advanceNativeRngWords(rng, 6))
  assert.deepEqual(weak.position, { x: 5, y: 6 })
  assert.equal(weak.privateSeed, 0)
  assert.equal(weak.impactTicks, 200)
  assert.equal(weak.fallStep, Math.fround(Math.fround(0.02) * 2))
})

test('Meteor impact consumes 69 visual plus two sound words and five BoulderBit seeds', () => {
  const rng = createNativeRng(91)
  const impact = createNativeWeldMeteorImpactProgram({
    bodyScale: Math.fround(0.75),
    rng,
    underpowered: false,
  })
  assert.deepEqual(impact.rng, advanceNativeRngWords(rng, 71))
  assert.equal(impact.debris.length, NATIVE_WELD_METEOR_IMPACT_DEBRIS_COUNT)
  assert.deepEqual(impact.debris.map(({ index }) => index), [0, 1, 2, 3, 4])
  assert.ok(impact.debris.every(({ alpha, record, scale }) => (
    alpha === 2
    && record >= 2008 && record <= 2010
    && scale === Math.fround(0.45)
  )))
  assert.ok(Math.hypot(
    impact.cameraDisplacement.x,
    impact.cameraDisplacement.y,
  ) > 9.99)
  assert.ok(impact.impactSoundPitch >= 0.9 && impact.impactSoundPitch <= 1.1)
  assert.equal(impact.impactThrowFirePitch, Math.fround(0.8))

  const weak = createNativeWeldMeteorImpactProgram({
    bodyScale: Math.fround(0.75),
    rng,
    underpowered: true,
  })
  assert.deepEqual(weak.rng, advanceNativeRngWords(rng, 71))
  assert.ok(weak.impactSoundPitch! >= 0.8 && weak.impactSoundPitch! <= 1.2)
  assert.equal(weak.impactThrowFirePitch, null)
})

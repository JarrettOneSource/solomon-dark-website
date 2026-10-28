import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeWeldBlizzardContactGlow,
  createNativeWeldBlizzardSourceGlows,
  nativeWeldBlizzardBeamPlan,
  nativeWeldBlizzardContactPolygon,
} from './native-weld-blizzard.ts'
import { createNativeRng, drawNativeFloat } from './native-rng.ts'

test('Blizzard creates exactly two one-frame source glows in four-word order', () => {
  const sourceRng = createNativeRng(1204)
  const result = createNativeWeldBlizzardSourceGlows({
    direction: { x: 1, y: 0 },
    firstId: 30,
    origin: { x: 100, y: 200 },
    ownerId: 'wizard',
    rng: sourceRng,
    tick: 8,
    vector: [8, 2, 1, 0.8, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  assert.deepEqual(result.actors.map(({ id, variant }) => ({
    id,
    variant,
  })), [
    { id: 30, variant: 24 },
    { id: 31, variant: 24 },
  ])
  let expected = sourceRng
  for (let index = 0; index < 2; index += 1) {
    expected = drawNativeFloat(expected, Math.fround(0.5)).state
    expected = drawNativeFloat(expected, 360).state
  }
  assert.deepEqual(result.rng, expected)
  assert.equal(result.nextId, 32)
})

test('Blizzard uses its exact two-quad geometry and disables the record-6/31 branch', () => {
  const plan = nativeWeldBlizzardBeamPlan({
    birthTick: 9,
    endpoint: { x: 100, y: 0 },
    source: { x: 0, y: 0 },
    underpowered: false,
    widen: 0,
  })
  assert.equal(plan.width, Math.fround(0.75))
  assert.deepEqual(plan.quads.map(({ record }) => record), [43, 44])
  assert.equal(plan.quads.some(({ record }) => record === (6 as number) || record === 31), false)
  const cap = plan.quads[0]!.vertices
  const strip = plan.quads[1]!.vertices
  assert.equal(Math.fround(cap[0]! - plan.jitter.x), Math.fround(-22.5))
  assert.equal(Math.fround(cap[4]! - plan.jitter.x), Math.fround(22.5))
  assert.equal(Math.fround(strip[4]! - plan.jitter.x), 100)
  assert.equal(Math.fround(strip[6]! - plan.jitter.x), 100)

  const replay = nativeWeldBlizzardBeamPlan({
    birthTick: 9,
    endpoint: { x: 100, y: 0 },
    source: { x: 0, y: 0 },
    underpowered: false,
    widen: 0,
  })
  assert.deepEqual(replay, plan)
  const weak = nativeWeldBlizzardBeamPlan({
    birthTick: 9,
    endpoint: { x: 100, y: 0 },
    source: { x: 0, y: 0 },
    underpowered: true,
    widen: 0,
  })
  assert.equal(weak.width, Math.fround(0.375))
  assert.equal(weak.tint, 0x80bfff)
})

test('Blizzard contact uses the shifted, extended root polygon instead of Frost cone geometry', () => {
  const neutral = nativeWeldBlizzardContactPolygon({
    endpoint: { x: 100, y: 0 },
    source: { x: 0, y: 0 },
    underpowered: false,
    widen: 0,
  })
  assert.equal(neutral.beamWidth, Math.fround(0.75))
  assert.equal(neutral.halfWidth, 20)
  assert.deepEqual(neutral.points, [
    { x: 0, y: -5 },
    { x: 150, y: -5 },
    { x: 150, y: 35 },
    { x: 0, y: 35 },
  ])

  const widened = nativeWeldBlizzardContactPolygon({
    endpoint: { x: 100, y: 0 },
    source: { x: 0, y: 0 },
    underpowered: false,
    widen: 0.04,
  })
  assert.equal(widened.beamWidth, Math.fround(1.12))
  assert.equal(widened.halfWidth, 28)
  const weak = nativeWeldBlizzardContactPolygon({
    endpoint: { x: 100, y: 0 },
    source: { x: 0, y: 0 },
    underpowered: true,
    widen: 0.04,
  })
  assert.equal(weak.beamWidth, Math.fround(Math.fround(1.12) * 0.5))
  assert.equal(weak.halfWidth, 20)
})

test('Blizzard terrain and root glows are independent variant-three one-frame actors', () => {
  const sourceRng = createNativeRng(9)
  const result = createNativeWeldBlizzardContactGlow({
    direction: { x: 1, y: 0 },
    id: 41,
    ownerId: 'wizard',
    position: { x: 100, y: 30 },
    registerWorldPainter: (managerLane) => ({ managerLane, registrationOrdinal: 41 }),
    rng: sourceRng,
    tick: 8,
    vector: [8, 2, 1, 0.8, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  assert.deepEqual({
    painterRegistrations: result.actor.painterRegistrations,
    position: result.actor.origin,
    variant: result.actor.variant,
  }, {
    painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 41 }],
    position: { x: 100, y: 10 },
    variant: 3,
  })
  let expected = drawNativeFloat(sourceRng, Math.fround(0.5)).state
  expected = drawNativeFloat(expected, 360).state
  assert.deepEqual(result.rng, expected)

  const inclusiveEndpoint = createNativeWeldBlizzardContactGlow({
    direction: { x: 1, y: 0 },
    id: 42,
    ownerId: 'wizard',
    position: { x: 100, y: 30 },
    registerWorldPainter: (managerLane) => ({ managerLane, registrationOrdinal: 42 }),
    rng: createNativeRng(18827),
    tick: 8,
    vector: [8, 2, 1, 0.8, 0, 0, 0],
    worldKey: 'boneyard:1',
  })
  assert.equal(inclusiveEndpoint.actor.rotationDegrees, 360)
  assert.equal(inclusiveEndpoint.actor.scale, 1.3633599281311035)
})

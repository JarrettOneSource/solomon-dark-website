import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeWeldBlizzardSourceGlows,
  nativeWeldBlizzardBeamPlan,
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
  assert.deepEqual(result.actors.map(({ glowIndex, id, variant }) => ({
    glowIndex,
    id,
    variant,
  })), [
    { glowIndex: 0, id: 30, variant: 24 },
    { glowIndex: 1, id: 31, variant: 24 },
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

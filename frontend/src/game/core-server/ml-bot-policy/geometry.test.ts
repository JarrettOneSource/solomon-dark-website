import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardWorldState } from '../boneyard-world.ts'
import { observeMlBotPolicyGeometry } from './geometry.ts'

const WORLD = {
  bounds: { h: 1_000, w: 1_000, x: 0, y: 0 },
  collision: {
    circles: [{ center: { x: 585, y: 500 }, radius: 10, sourceId: 'scenery:grave' }],
    polygons: [],
    segments: [],
  },
  gateLeaves: [],
  scenerySpellTargets: [{ id: 'scenery:grave' }],
} as unknown as Pick<
  BoneyardWorldState,
  'bounds' | 'collision' | 'gateLeaves' | 'scenerySpellTargets'
>

test('policy geometry uses the exact movement predicate for rays and patch cells', () => {
  const observed = observeMlBotPolicyGeometry(WORLD, { x: 500, y: 500 })
  assert.equal(observed.patchAndRays.length, 56)
  assert.equal(observed.patchAndRays[0], 60 / 480)
  assert.equal(observed.patchAndRays[4], 1)
  // Row 4/column 5 is the first patch cell east of the omitted center.
  assert.equal(observed.patchAndRays[8 + 3 * 7 + 3], 0)
})

test('policy geometry emits deterministic nearest primitive semantics', () => {
  const observed = observeMlBotPolicyGeometry(WORLD, { x: 500, y: 500 })
  assert.equal(observed.obstacles.length, 8 * 13)
  assert.equal(observed.obstacles[0], 1)
  assert.ok(Math.abs(observed.obstacles[1]! - 0.075) < 1e-6)
  assert.equal(observed.obstacles[2], 0)
  assert.ok(Math.abs(observed.obstacles[3]! - 0.05) < 1e-6)
  assert.equal(observed.obstacles[4], -1)
  assert.equal(observed.obstacles[5], 0)
  assert.ok(Math.abs(observed.obstacles[6]! - 0.1) < 1e-6)
  assert.deepEqual([...observed.obstacles.slice(7, 13)], [0, 0, 1, 0, 0, 1])
})

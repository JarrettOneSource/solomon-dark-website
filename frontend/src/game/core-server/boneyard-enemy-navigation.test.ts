import assert from 'node:assert/strict'
import test from 'node:test'

import {
  firstBoneyardPathBlockProgress,
  type BoneyardCollisionPolygon,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import { findBoneyardEnemyRoute } from './boneyard-enemy-navigation.ts'

const BOUNDS = { h: 200, w: 200, x: 0, y: 0 }

test('enemy route A* clears a solid blocker and every retained segment is occupiable', () => {
  const world: BoneyardCollisionWorld = {
    circles: [],
    polygons: [rectangle(80, 70, 120, 130)],
    segments: [],
  }
  const route = findBoneyardEnemyRoute({
    bounds: BOUNDS,
    bodyRadius: 10,
    clearance: 10,
    end: { x: 180, y: 100 },
    start: { x: 20, y: 100 },
    world,
  })
  assert.ok(route && route.length >= 3)
  assert.deepEqual(route[0], { x: 20, y: 100 })
  for (let index = 1; index < route.length; index += 1) {
    assert.equal(firstBoneyardPathBlockProgress(
      route[index - 1]!,
      route[index]!,
      BOUNDS,
      world,
      10,
    ), null)
  }
})

test('ordinary clearance passes a native-width lane that Demon clearance rejects', () => {
  const world: BoneyardCollisionWorld = {
    circles: [],
    polygons: [
      rectangle(80, 0, 120, 65),
      rectangle(80, 135, 120, 200),
    ],
    segments: [],
  }
  assert.ok(findBoneyardEnemyRoute({
    bounds: BOUNDS,
    bodyRadius: 20,
    clearance: 25,
    end: { x: 180, y: 100 },
    start: { x: 20, y: 100 },
    world,
  }))
  assert.equal(findBoneyardEnemyRoute({
    bounds: BOUNDS,
    bodyRadius: 35,
    clearance: 50,
    end: { x: 180, y: 100 },
    start: { x: 20, y: 100 },
    world,
  }), null)
})

function rectangle(
  left: number,
  top: number,
  right: number,
  bottom: number,
): BoneyardCollisionPolygon {
  return {
    points: [
      { x: left, y: bottom },
      { x: left, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
    ],
  }
}

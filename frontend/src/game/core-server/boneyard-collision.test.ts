import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createBoneyardGateLeaves } from '../core-kernels/boneyard-gate.ts'
import {
  createBoneyardCollisionWorld,
  resolveBoneyardMovement,
  withBoneyardGateCollision,
} from './boneyard-collision.ts'

test('materializes native props and posts while moving gates remain world-owned', () => {
  const scene = makeScene()
  scene.objects = [
    {
      eid: 'tree', typeId: 2001, pos: { x: 0, y: 0 },
      variant: 1, secondaryVariant: 0, secondaryVisible: false,
    },
    { eid: 'monument', typeId: 2009, pos: { x: 500, y: 500 }, variant: 19 },
    { eid: 'grave', typeId: 2029, pos: { x: 700, y: 700 }, overlayVariant: 8 },
    { eid: 'building', typeId: 2040, pos: { x: 900, y: 900 }, variant: 2 },
    { eid: 'goodie', typeId: 2061, pos: { x: 1100, y: 1100 } },
  ]
  scene.fences = [
    {
      eid: 'grate', typeId: 3005, segmentCode: 0,
      points: [{ x: 100, y: 1200 }, { x: 300, y: 1200 }],
    },
    {
      eid: 'gate', typeId: 3005, segmentCode: 2,
      points: [{ x: 300, y: 1200 }, { x: 500, y: 1200 }],
    },
  ]

  const world = createBoneyardCollisionWorld(scene)
  assert.equal(world.polygons.length, 4)
  assert.equal(world.circles.length, 6)
  assert.deepEqual(world.circles.slice(0, 3), [
    { center: { x: 0, y: 0 }, radius: 12 },
    { center: { x: 700, y: 700 }, radius: 1 },
    { center: { x: 1100, y: 1100 }, radius: 8 },
  ])
  assert.equal(world.segments.length, 1)
  const gateLeaves = createBoneyardGateLeaves(scene.fences, 'gate-collision-seed')
  const dynamicWorld = withBoneyardGateCollision(world, gateLeaves)
  assert.equal(dynamicWorld.segments.length, 3)
  assert.deepEqual(dynamicWorld.segments.slice(1), gateLeaves.map((leaf) => ({
    start: leaf.hinge,
    end: leaf.tip,
    radius: 0,
  })))
})

test('sweeps to the last clear point and retains tangential movement along a fence', () => {
  const world = {
    circles: [],
    polygons: [],
    segments: [{ start: { x: 100, y: 0 }, end: { x: 100, y: 300 }, radius: 0 }],
  }
  const accepted = resolveBoneyardMovement(
    { x: 50, y: 100 },
    { x: 120, y: 140 },
    { x: 0, y: 0, w: 500, h: 500 },
    world,
    25,
  )
  assert.ok(accepted.x < 75.1)
  assert.ok(accepted.x > 74)
  assert.ok(accepted.y > 130)
})

test('blocks a radius-25 wizard against native polygon and circle primitives', () => {
  const bounds = { x: 0, y: 0, w: 500, h: 500 }
  const polygonAccepted = resolveBoneyardMovement(
    { x: 50, y: 150 },
    { x: 150, y: 150 },
    bounds,
    {
      circles: [],
      polygons: [{ points: [
        { x: 100, y: 100 }, { x: 200, y: 100 },
        { x: 200, y: 200 }, { x: 100, y: 200 },
      ] }],
      segments: [],
    },
    25,
  )
  assert.ok(polygonAccepted.x < 75.1)

  const circleAccepted = resolveBoneyardMovement(
    { x: 30, y: 300 },
    { x: 120, y: 300 },
    bounds,
    {
      circles: [{ center: { x: 100, y: 300 }, radius: 20 }],
      polygons: [],
      segments: [],
    },
    25,
  )
  assert.ok(circleAccepted.x < 55.1)
})

function makeScene(): BoneyardScene {
  return {
    name: 'collision-test',
    environmentMode: 2,
    bounds: { x: 0, y: 0, w: 1600, h: 1600 },
    spawn: { x: 50, y: 50, facingDeg: 180 },
    objects: [],
    sprites: [],
    roads: [],
    fences: [],
    terrain: [],
    solomonDig: null,
  }
}

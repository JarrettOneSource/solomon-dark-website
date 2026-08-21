import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createBoneyardGateLeaves } from '../core-kernels/boneyard-gate.ts'
import {
  canPlaceBoneyardBody,
  clipBoneyardSegment,
  createBoneyardCollisionWorld,
  firstBoneyardLineObstruction,
  firstBoneyardPathBlockProgress,
  NATIVE_FIREBALL_TERRAIN_EXCLUSION_MASK,
  nativeSpawnRingSampleCount,
  resolveBoneyardMovement,
  resolveBoneyardSpawnPosition,
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
    { center: { x: 0, y: 0 }, nativeLineMask: 0x700, radius: 12 },
    {
      center: { x: 700, y: 700 },
      nativeLineMask: 0x600,
      radius: 1,
      sourceId: 'scenery:grave',
    },
    { center: { x: 1100, y: 1100 }, nativeLineMask: 0x700, radius: 8 },
  ])
  assert.deepEqual(world.polygons.map(({ nativeLineMask }) => nativeLineMask ?? 0), [
    0, 0x600, 0, 0x700,
  ])
  assert.equal(world.segments.length, 1)
  assert.equal(world.segments[0]?.nativeLineMask, 0x100)
  const gateLeaves = createBoneyardGateLeaves(scene.fences, 'gate-collision-seed')
  const dynamicWorld = withBoneyardGateCollision(world, gateLeaves)
  assert.equal(dynamicWorld.segments.length, 3)
  assert.deepEqual(dynamicWorld.segments.slice(1), gateLeaves.map((leaf) => ({
    start: leaf.hinge,
    end: leaf.tip,
    nativeLineMask: 0x100,
    radius: 0,
  })))
})

test('Fireball terrain lookahead ignores grave, fence, post, tree, and Goodie masks', () => {
  assert.equal(NATIVE_FIREBALL_TERRAIN_EXCLUSION_MASK, 0x700)
  const bounds = { x: 0, y: 0, w: 500, h: 200 }
  const world = {
    circles: [{
      center: { x: 80, y: 100 },
      nativeLineMask: 0x700,
      radius: 10,
    }],
    polygons: [{
      nativeLineMask: 0x600,
      points: [
        { x: 120, y: 80 }, { x: 140, y: 80 },
        { x: 140, y: 120 }, { x: 120, y: 120 },
      ],
    }],
    segments: [
      {
        end: { x: 180, y: 180 },
        nativeLineMask: 0x100,
        radius: 0,
        start: { x: 180, y: 20 },
      },
      {
        end: { x: 300, y: 180 },
        nativeLineMask: 0,
        radius: 0,
        start: { x: 300, y: 20 },
      },
    ],
  }

  assert.deepEqual(firstBoneyardLineObstruction(
    { x: 20, y: 100 },
    { x: 400, y: 100 },
    bounds,
    world,
  ), { x: 70, y: 100 })
  assert.deepEqual(firstBoneyardLineObstruction(
    { x: 20, y: 100 },
    { x: 400, y: 100 },
    bounds,
    world,
    undefined,
    NATIVE_FIREBALL_TERRAIN_EXCLUSION_MASK,
  ), { x: 300, y: 100 })
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

test('full-candidate placement rejects authored collision and arena bounds', () => {
  const bounds = { x: 0, y: 0, w: 500, h: 500 }
  const world = {
    circles: [],
    polygons: [],
    segments: [{ start: { x: 220, y: 0 }, end: { x: 220, y: 500 }, radius: 0 }],
  }

  assert.equal(canPlaceBoneyardBody({ x: 180, y: 250 }, bounds, world, 25), true)
  assert.equal(canPlaceBoneyardBody({ x: 200, y: 250 }, bounds, world, 25), false)
  assert.equal(canPlaceBoneyardBody({ x: 24, y: 250 }, bounds, world, 25), false)
})

test('native spawn retries use actor-radius rings, compressed Y, and combat bounds', () => {
  const bounds = { x: 0, y: 0, w: 500, h: 400 }
  const empty = { circles: [], polygons: [], segments: [] }
  assert.equal(nativeSpawnRingSampleCount(25, 25), 6)
  assert.equal(nativeSpawnRingSampleCount(50, 25), 4)
  assert.deepEqual(resolveBoneyardSpawnPosition(
    { x: 250, y: 450 },
    bounds,
    empty,
    25,
    0,
  ), { x: 250, y: 370 })
  assert.equal(canPlaceBoneyardBody(
    resolveBoneyardSpawnPosition({ x: 250, y: 450 }, bounds, empty, 25, 0),
    bounds,
    empty,
    25,
  ), true)
})

test('clips spell rays against bounds and scenery while excluding the selected target', () => {
  const bounds = { x: 0, y: 0, w: 300, h: 200 }
  const collision = {
    circles: [{ center: { x: 200, y: 100 }, radius: 10, sourceId: 'grave:selected' }],
    polygons: [],
    segments: [{
      end: { x: 120, y: 180 },
      radius: 0,
      sourceId: 'fence:blocker',
      start: { x: 120, y: 20 },
    }],
  }
  assert.deepEqual(clipBoneyardSegment(
    { x: 50, y: 100 },
    { x: 250, y: 100 },
    bounds,
    collision,
    'grave:selected',
  ), { x: 120, y: 100 })
  assert.deepEqual(clipBoneyardSegment(
    { x: 150, y: 100 },
    { x: 400, y: 100 },
    bounds,
    { ...collision, segments: [] },
    'grave:selected',
  ), { x: 300, y: 100 })
  assert.deepEqual(clipBoneyardSegment(
    { x: 150, y: 100 },
    { x: 250, y: 100 },
    bounds,
    { ...collision, segments: [] },
  ), { x: 190, y: 100 })
})

test('clips Water prediction against the nearest Boneyard primitive and arena edge', () => {
  const bounds = { x: 0, y: 0, w: 500, h: 500 }
  const world = {
    circles: [{ center: { x: 150, y: 250 }, radius: 10 }],
    polygons: [{ points: [
      { x: 300, y: 200 }, { x: 350, y: 200 },
      { x: 350, y: 300 }, { x: 300, y: 300 },
    ] }],
    segments: [{ start: { x: 220, y: 200 }, end: { x: 220, y: 300 }, radius: 5 }],
  }
  assert.deepEqual(
    firstBoneyardLineObstruction(
      { x: 50, y: 250 },
      { x: 450, y: 250 },
      bounds,
      world,
    ),
    { x: 140, y: 250 },
  )
  assert.deepEqual(
    firstBoneyardLineObstruction(
      { x: 250, y: 100 },
      { x: 250, y: -100 },
      bounds,
      { circles: [], polygons: [], segments: [] },
    ),
    { x: 250, y: 0 },
  )
})

test('projectile sweeps report the first static-world contact along the path', () => {
  const progress = firstBoneyardPathBlockProgress(
    { x: 50, y: 250 },
    { x: 150, y: 250 },
    { x: 0, y: 0, w: 500, h: 500 },
    {
      circles: [],
      polygons: [],
      segments: [{ start: { x: 100, y: 0 }, end: { x: 100, y: 500 }, radius: 0 }],
    },
    5,
  )

  assert.ok(progress !== null)
  assert.ok(progress > 0.44 && progress < 0.46)
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

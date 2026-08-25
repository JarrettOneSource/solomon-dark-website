import assert from 'node:assert/strict'
import test from 'node:test'

import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import {
  boneyardActiveBounds,
  createBoneyardArenaTransition,
  startBoneyardArenaTransition,
  stepBoneyardArenaTransition,
} from '../core-kernels/boneyard-arena-transition.ts'
import { createBoneyardGateLeaves } from '../core-kernels/boneyard-gate.ts'
import { createNativeRng, drawNativeFloat } from '../core-kernels/native-rng.ts'
import { NATIVE_GENERATED_BONEYARDS } from '../host/native-generated-boneyards.ts'
import {
  boneyardBodyCollides,
  boneyardSpawnPositionIsOffscreen,
  canPlaceBoneyardBody,
  clipBoneyardSegment,
  createBoneyardCollisionWorld,
  firstBoneyardLineObstruction,
  firstBoneyardPathBlockProgress,
  NATIVE_FIREBALL_TERRAIN_EXCLUSION_MASK,
  nativeSpawnRingSampleCount,
  resolveBoneyardMovement,
  resolveNativeBoneyardSpawnPosition,
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

test('solid-spell capsules retain every authored blocker including both Gravestone shapes', () => {
  const scene = makeScene()
  scene.objects = [
    {
      eid: 'tree', typeId: 2001, pos: { x: 100, y: 100 },
      variant: 1, secondaryVariant: 0, secondaryVisible: false,
    },
    { eid: 'monument', typeId: 2009, pos: { x: 300, y: 100 }, variant: 18 },
    { eid: 'grave-root', typeId: 2029, pos: { x: 500, y: 100 }, variant: 0 },
    {
      eid: 'grave-promoted', typeId: 2029, pos: { x: 700, y: 100 },
      overlayVariant: 8, variant: 1,
    },
    { eid: 'building', typeId: 2040, pos: { x: 900, y: 100 }, variant: 3 },
    { eid: 'goodie', typeId: 2061, pos: { x: 1100, y: 100 } },
  ]
  scene.fences = [
    {
      eid: 'fence', typeId: 3005, segmentCode: 0,
      points: [{ x: 1300, y: 50 }, { x: 1300, y: 150 }],
    },
    {
      eid: 'gate', typeId: 3005, segmentCode: 2,
      points: [{ x: 1450, y: 50 }, { x: 1450, y: 150 }],
    },
  ]
  const bounds = { x: 0, y: 0, w: 1600, h: 400 }
  const base = createBoneyardCollisionWorld(scene)
  const gateLeaves = createBoneyardGateLeaves(scene.fences, 'solid-spell-gate')
  const world = withBoneyardGateCollision(base, gateLeaves)

  for (const point of [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 500, y: 100 },
    { x: 700, y: 150 },
    { x: 900, y: 120 },
    { x: 1100, y: 100 },
    { x: 1300, y: 100 },
    gateLeaves[0]!.hinge,
  ]) {
    assert.equal(canPlaceBoneyardBody(point, bounds, world, 5), false, JSON.stringify(point))
  }

  const graveRootContact = firstBoneyardPathBlockProgress(
    { x: 522.5, y: 100 },
    { x: 519.5, y: 100 },
    bounds,
    world,
    20,
  )
  assert.ok(graveRootContact !== null && graveRootContact > 0 && graveRootContact < 1)
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
  assert.equal(boneyardBodyCollides({ x: 24, y: 250 }, world, 25), false)
  assert.equal(boneyardBodyCollides({ x: 200, y: 250 }, world, 25), true)
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
  ), { x: 250, y: 375 })
  assert.equal(canPlaceBoneyardBody(
    resolveBoneyardSpawnPosition({ x: 250, y: 450 }, bounds, empty, 25, 0),
    bounds,
    empty,
    25,
  ), true)
})

test('native spawn policies preserve direct points and retry dark/light/offscreen/edge roots', () => {
  const bounds = { x: 0, y: 0, w: 500, h: 500 }
  const world = { circles: [], polygons: [], segments: [] }
  const origin = { x: 250, y: 250 }
  const source = createNativeRng(43)
  const direct = resolveNativeBoneyardSpawnPosition(
    origin, bounds, world, 25, 'direct', source, { lightAt: () => 1 },
  )
  assert.deepEqual(direct, { position: origin, rngState: source })

  const cases = [
    ['dark', { lightAt: (point: { x: number; y: number }) => point === origin ? 1 : (
      point.x === origin.x && point.y === origin.y ? 1 : 0
    ) }],
    ['light', { lightAt: (point: { x: number; y: number }) => (
      point.x === origin.x && point.y === origin.y ? 0 : 1
    ) }],
    ['offscreen', { isOffscreen: (point: { x: number; y: number }) => (
      point.x !== origin.x || point.y !== origin.y
    ), lightAt: () => 0 }],
    ['edge', { isOutsidePolicyBounds: (point: { x: number; y: number }) => (
      point.x !== origin.x || point.y !== origin.y
    ), lightAt: () => 0 }],
  ] as const
  const firstAngle = drawNativeFloat(source, 360)
  for (const [policy, context] of cases) {
    const placed = resolveNativeBoneyardSpawnPosition(
      origin, bounds, world, 25, policy, source, context,
    )
    assert.notDeepEqual(placed.position, origin)
    assert.deepEqual(placed.rngState, firstAngle.state)
    assert.equal(canPlaceBoneyardBody(placed.position, bounds, world, 25), true)
  }
})

test('non-dark retry rings use the locked camera target without rejecting a legal raw root', () => {
  const bounds = { x: 0, y: 0, w: 500, h: 500 }
  const retryBounds = { x: 100, y: 100, w: 300, h: 300 }
  const origin = { x: 50, y: 250 }
  const source = createNativeRng(73)
  const empty = { circles: [], polygons: [], segments: [] }
  assert.deepEqual(resolveNativeBoneyardSpawnPosition(
    origin,
    bounds,
    empty,
    25,
    'direct',
    source,
    { lightAt: () => 0, retryBounds },
  ).position, origin)

  const blocked = {
    circles: [{ center: origin, radius: 1 }],
    polygons: [],
    segments: [],
  }
  const direct = resolveNativeBoneyardSpawnPosition(
    origin,
    bounds,
    blocked,
    25,
    'direct',
    source,
    { lightAt: () => 0, retryBounds },
  ).position
  assert.ok(direct.x >= 125 && direct.x <= 375)
  assert.ok(direct.y >= 125 && direct.y <= 375)

  const dark = resolveNativeBoneyardSpawnPosition(
    origin,
    bounds,
    blocked,
    25,
    'dark',
    source,
    { lightAt: () => 0, retryBounds },
  ).position
  assert.ok(dark.x < 125, 'dark retry bypasses the camera-target rectangle')
})

test('native spawn placement draws a fresh retry angle for every radius ring', () => {
  const source = createNativeRng(59)
  const firstAngle = drawNativeFloat(source, 360)
  const secondAngle = drawNativeFloat(firstAngle.state, 360)
  const origin = { x: 250, y: 250 }
  const placed = resolveNativeBoneyardSpawnPosition(
    origin,
    { x: 0, y: 0, w: 500, h: 500 },
    { circles: [], polygons: [], segments: [] },
    25,
    'dark',
    source,
    {
      lightAt: (point) => Math.hypot(point.x - origin.x, point.y - origin.y) <= 25.1
        ? 1
        : 0,
    },
  )
  assert.deepEqual(placed.rngState, secondAngle.state)
  assert.ok(Math.hypot(placed.position.x - origin.x, placed.position.y - origin.y) > 25.1)
})

test('native offscreen policy views clamp strictly and reject a point visible to any player', () => {
  const bounds = { x: 0, y: 0, w: 2_000, h: 1_600 }
  const center = { x: 1_000, y: 800 }
  const second = { x: 1_400, y: 1_000 }
  const halfWidth = 800 / 1.35
  const halfHeight = 450 / 1.35

  assert.equal(boneyardSpawnPositionIsOffscreen(
    { x: center.x + halfWidth, y: center.y }, bounds, [center],
  ), false)
  assert.equal(boneyardSpawnPositionIsOffscreen(
    { x: center.x + halfWidth + 0.001, y: center.y }, bounds, [center],
  ), true)
  assert.equal(boneyardSpawnPositionIsOffscreen(
    { x: 390, y: center.y }, bounds, [center, second],
  ), true)
  assert.equal(boneyardSpawnPositionIsOffscreen(
    { x: 900, y: center.y + halfHeight + 0.001 }, bounds, [center, second],
  ), false)
  assert.equal(boneyardSpawnPositionIsOffscreen(
    { x: 1, y: 1 },
    { x: 0, y: 0, w: 500, h: 400 },
    [{ x: 0, y: 0 }],
  ), false)
  assert.throws(
    () => boneyardSpawnPositionIsOffscreen(center, bounds, []),
    /requires a camera focus/,
  )
})

test('finite generated-Arena placement resolves the exact production exterior spawn', () => {
  const position = { x: 4.738685131072998, y: 3483.47802734375 }
  const radius = 13.156531408429146
  for (const template of NATIVE_GENERATED_BONEYARDS) {
    const created = createBoneyardArenaTransition(template.scene.bounds, template.scene.spawn)
    assert.ok(created, template.sourceLabel)
    let transition = startBoneyardArenaTransition(created)
    for (let tick = 0; tick < 400; tick += 1) {
      transition = stepBoneyardArenaTransition(transition)
    }
    const bounds = boneyardActiveBounds(transition)
    const world = createBoneyardCollisionWorld(template.scene)
    const resolved = resolveBoneyardSpawnPosition(position, bounds, world, radius)
    assert.equal(canPlaceBoneyardBody(resolved, bounds, world, radius), true)
  }
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

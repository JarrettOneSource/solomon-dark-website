import assert from 'node:assert/strict'
import test from 'node:test'

import {
  firstBoneyardPathBlockProgress,
  type BoneyardCollisionCircle,
  type BoneyardCollisionPolygon,
  type BoneyardCollisionSegment,
  type BoneyardCollisionWorld,
} from './boneyard-collision.ts'
import {
  buildPreparedBoneyardNavigationMesh,
  type BoneyardNavigationMeshData,
  findBoneyardEnemyRoute,
  navigationCircleBlocks,
  navigationPolygonBlocks,
  navigationSegmentBlocks,
  navigationTriangleContainsPoint,
  selectNavigationBlockerCandidates,
  selectNavigationTriangleCandidates,
} from './boneyard-enemy-navigation.ts'

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

const ORACLE_BOUNDS = { h: 1500, w: 2000, x: -300, y: -200 }

test('triangle lookup candidates cover every epsilon-inclusive containing triangle', () => {
  const random = xorshift(0x5eed1234)
  let contained = 0
  for (let worldIndex = 0; worldIndex < 4; worldIndex += 1) {
    const world = randomWorld(random, worldIndex)
    const { mesh } = buildPreparedBoneyardNavigationMesh(ORACLE_BOUNDS, world, 25)
    assert.ok(mesh.triangles.length > 50)
    const points: { x: number; y: number }[] = []
    for (let sample = 0; sample < 1500; sample += 1) {
      points.push({
        x: ORACLE_BOUNDS.x - 400 + random() * (ORACLE_BOUNDS.w + 800),
        y: ORACLE_BOUNDS.y - 400 + random() * (ORACLE_BOUNDS.h + 800),
      })
    }
    for (const vertex of mesh.points) {
      points.push({ ...vertex })
      points.push({ x: vertex.x + 1e-9, y: vertex.y - 1e-9 })
      points.push({ x: vertex.x - 3e-8, y: vertex.y + 2e-8 })
    }
    for (const triangle of mesh.triangles) {
      points.push({ ...triangle.center })
      const [first, second] = triangle.vertices
      const start = mesh.points[first!]!
      const end = mesh.points[second!]!
      points.push({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 })
    }
    for (const point of points) {
      const candidates = new Set(selectNavigationTriangleCandidates(mesh, point))
      for (const triangle of mesh.triangles) {
        if (!navigationTriangleContainsPoint(mesh, triangle.id, point)) continue
        contained += 1
        assert.ok(
          candidates.has(triangle.id),
          `triangle ${triangle.id} contains (${point.x}, ${point.y}) but is not a candidate`,
        )
      }
    }
  }
  assert.ok(contained > 4000)
})

test('triangle lookup stays sparse across distant finite mesh regions', () => {
  const mesh: BoneyardNavigationMeshData = {
    points: [
      { x: -1_020_000_000_000, y: -20_000_000_000 },
      { x: -980_000_000_000, y: -20_000_000_000 },
      { x: -1_000_000_000_000, y: 20_000_000_000 },
      { x: 980_000_000_000, y: -20_000_000_000 },
      { x: 1_020_000_000_000, y: -20_000_000_000 },
      { x: 1_000_000_000_000, y: 20_000_000_000 },
    ],
    triangles: [
      {
        center: { x: -1_000_000_000_000, y: -20_000_000_000 / 3 },
        id: 0,
        neighbors: [],
        vertices: [0, 1, 2],
      },
      {
        center: { x: 1_000_000_000_000, y: -20_000_000_000 / 3 },
        id: 1,
        neighbors: [],
        vertices: [3, 4, 5],
      },
    ],
  }
  const point = { x: -1_000_000_000_000, y: 0 }
  assert.equal(navigationTriangleContainsPoint(mesh, 0, point), true)
  assert.deepEqual(selectNavigationTriangleCandidates(mesh, point), [0, 1])
})

test('blocker lookup candidates cover every primitive that blocks a padded segment', () => {
  const random = xorshift(0x0badf00d)
  let blocked = 0
  for (let worldIndex = 0; worldIndex < 4; worldIndex += 1) {
    const world = randomWorld(random, worldIndex)
    for (let sample = 0; sample < 1500; sample += 1) {
      const start = {
        x: ORACLE_BOUNDS.x - 100 + random() * (ORACLE_BOUNDS.w + 200),
        y: ORACLE_BOUNDS.y - 100 + random() * (ORACLE_BOUNDS.h + 200),
      }
      const reach = random() < 0.5 ? 60 : 600
      const end = {
        x: start.x + (random() - 0.5) * reach,
        y: start.y + (random() - 0.5) * reach,
      }
      const radius = [0, 10, 25, 50][sample % 4]!
      const candidates = selectNavigationBlockerCandidates(world, start, end, radius)
      for (const [index, polygon] of world.polygons.entries()) {
        if (!navigationPolygonBlocks(polygon, start, end, radius)) continue
        blocked += 1
        assert.ok(candidates.polygons.includes(index), `polygon ${index} blocks but is not a candidate`)
      }
      for (const [index, circle] of world.circles.entries()) {
        if (!navigationCircleBlocks(circle, start, end, radius)) continue
        blocked += 1
        assert.ok(candidates.circles.includes(index), `circle ${index} blocks but is not a candidate`)
      }
      for (const [index, segment] of world.segments.entries()) {
        if (!navigationSegmentBlocks(segment, start, end, radius)) continue
        blocked += 1
        assert.ok(candidates.segments.includes(index), `segment ${index} blocks but is not a candidate`)
      }
    }
  }
  assert.ok(blocked > 2000)
})

test('blocker lookup stays sparse across distant finite mod geometry', () => {
  const world: BoneyardCollisionWorld = {
    circles: [
      { center: { x: -1_000_000_000_000, y: 0 }, radius: 20 },
      { center: { x: 1_000_000_000_000, y: 0 }, radius: 20 },
    ],
    polygons: [],
    segments: [{
      end: { x: 1_000_000_000_000, y: 500 },
      radius: 0,
      start: { x: -1_000_000_000_000, y: 500 },
    }],
  }
  const candidates = selectNavigationBlockerCandidates(
    world,
    { x: -1_000_000_000_100, y: 0 },
    { x: -999_999_999_900, y: 0 },
    10,
  )
  assert.deepEqual(candidates.circles, [0])
  assert.deepEqual(candidates.segments, [0])
})

test('route endpoints outside the navigation bounds have no route', () => {
  const world: BoneyardCollisionWorld = {
    circles: [],
    polygons: [rectangle(80, 70, 120, 130)],
    segments: [],
  }
  assert.equal(findBoneyardEnemyRoute({
    bounds: BOUNDS,
    bodyRadius: 10,
    clearance: 10,
    end: { x: 180, y: 100 },
    start: { x: 5, y: 100 },
    world,
  }), null)
  assert.equal(findBoneyardEnemyRoute({
    bounds: BOUNDS,
    bodyRadius: 10,
    clearance: 10,
    end: { x: 180, y: 195 },
    start: { x: 20, y: 100 },
    world,
  }), null)
})

function randomWorld(random: () => number, variant: number): BoneyardCollisionWorld {
  const circles: BoneyardCollisionCircle[] = []
  const polygons: BoneyardCollisionPolygon[] = []
  const segments: BoneyardCollisionSegment[] = []
  const inside = () => ({
    x: ORACLE_BOUNDS.x + random() * ORACLE_BOUNDS.w,
    y: ORACLE_BOUNDS.y + random() * ORACLE_BOUNDS.h,
  })
  for (let index = 0; index < 60 + variant * 20; index += 1) {
    circles.push({ center: inside(), radius: 2 + random() * 40 })
  }
  for (let index = 0; index < 6 + variant * 2; index += 1) {
    const corner = inside()
    polygons.push(rectangle(
      corner.x,
      corner.y,
      corner.x + 20 + random() * 200,
      corner.y + 20 + random() * 200,
    ))
  }
  for (let index = 0; index < 10 + variant * 4; index += 1) {
    const start = inside()
    segments.push({
      end: { x: start.x + (random() - 0.5) * 400, y: start.y + (random() - 0.5) * 400 },
      radius: index % 3 === 0 ? 0 : random() * 12,
      start,
    })
  }
  return { circles, polygons, segments }
}

function xorshift(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { BoneyardRoad } from '../core-kernels/boneyard.ts'
import {
  NATIVE_ROAD_STYLE_PROGRAMS,
  nativeRoadEndpointAlphas,
  nativeRoadMeshPlan,
  webArenaGroundMeshPlan,
} from './native-boneyard-surface.ts'

const ROAD: BoneyardRoad = {
  eid: 'road-test',
  endWidthScale: 1,
  linkMask: 0,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  startWidthScale: 1,
  style: 0,
  typeId: 3004,
}

test('pins all five loose Road textures to retail bytes', () => {
  const assets = [
    ['../../assets/game/boneyard/textures/road.png', '8bf87b68ad14e4081162796d573409bac704eaed4da61dec4b78fda31d26350d'],
    ['../../assets/game/boneyard/textures/road2.png', 'fc09e29949d4e79d58102ac39ee40a4fe49164491c2d70ac45b5260cadbe5530'],
    ['../../assets/game/boneyard/textures/road3.png', '0ddd9547294db143fc8cae57f297feb87292b2bebc9bc2d7aa30897720339f21'],
    ['../../assets/game/boneyard/textures/road4.png', 'abdfeff588488dab80d560375042484dd4372365c0f74d0df2f81b0d0dd5e942'],
    ['../../assets/game/boneyard/textures/road5.png', '6a1fbae75ef0ba6266a149465b20f74ee28e172f4ede0e39a707f20de6f9e2d5'],
  ] as const
  for (const [path, expected] of assets) {
    assert.equal(
      createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex'),
      expected,
      path,
    )
  }
})

test('pins and world-anchors the restored known-good web ground field', () => {
  assert.equal(
    createHash('sha256').update(readFileSync(new URL(
      '../../assets/game/boneyard/textures/arena-ground.webp',
      import.meta.url,
    ))).digest('hex'),
    'dabc48e7af0220283889647f57cde6442aecc79629555ce9104815ebadbdb070',
  )
  const bounds = { h: 400, w: 600, x: -200, y: 100 }
  const plan = webArenaGroundMeshPlan(bounds)
  assert.deepEqual([...plan.positions], [-200, 100, 400, 100, -200, 500, 400, 500])
  assert.deepEqual([...plan.indices], [0, 1, 2, 1, 3, 2])
  assert.deepEqual([...plan.colors], new Array(16).fill(255))
  assert.deepEqual([...plan.uvs], [
    Math.fround(-200 / 512), Math.fround(100 / 512),
    Math.fround(400 / 512), Math.fround(100 / 512),
    Math.fround(-200 / 512), Math.fround(500 / 512),
    Math.fround(400 / 512), Math.fround(500 / 512),
  ])
  assert.throws(
    () => webArenaGroundMeshPlan({ ...bounds, w: 0 }),
    /requires positive bounds/,
  )
})

test('pins every Road style width, side fade, texture size, and vertical UV scale', () => {
  assert.deepEqual(NATIVE_ROAD_STYLE_PROGRAMS, [
    { edgeInset: 30, halfWidth: 55, textureSize: 128, verticalUvScale: 0.800000011920929 },
    { edgeInset: 20, halfWidth: 45, textureSize: 128, verticalUvScale: 0.800000011920929 },
    { edgeInset: 20, halfWidth: 55, textureSize: 256, verticalUvScale: 0.800000011920929 },
    { edgeInset: 10, halfWidth: 45, textureSize: 128, verticalUvScale: 0.800000011920929 },
    { edgeInset: 10, halfWidth: 55, textureSize: 128, verticalUvScale: 0.800000011920929 },
  ])
})

test('keeps isolated ends hard and fades only the two open ends of a linked run', () => {
  assert.deepEqual(nativeRoadEndpointAlphas(0), [1, 1])
  assert.deepEqual(nativeRoadEndpointAlphas(2), [0, 1])
  assert.deepEqual(nativeRoadEndpointAlphas(3), [1, 1])
  assert.deepEqual(nativeRoadEndpointAlphas(1), [1, 0])
})

test('reconstructs the native 18-record Road mesh without outlines or round caps', () => {
  const plan = nativeRoadMeshPlan(ROAD)
  assert.equal(plan.sourceVertexCount, 18)
  assert.equal(plan.positions.length / 2, 8)
  assert.equal(plan.indices.length, 18)
  assert.deepEqual([...plan.positions], [
    0, 25,
    0, -25,
    100, 25,
    100, -25,
    0, 55,
    100, 55,
    0, -55,
    100, -55,
  ])
  assert.deepEqual([...plan.indices], [
    0, 1, 2, 1, 2, 3,
    4, 0, 5, 0, 5, 2,
    1, 6, 3, 6, 3, 7,
  ])
  assert.deepEqual([...plan.colors.slice(4 * 4, 5 * 4)], [255, 255, 255, 0])
  assert.ok(Math.abs(plan.uvs[1]! - Math.fround(25 / 128 / 0.800000011920929)) < 1e-7)
})

test('applies the authored style widths even when a Road has no stored quad', () => {
  const widths = NATIVE_ROAD_STYLE_PROGRAMS.map((_, style) => {
    const plan = nativeRoadMeshPlan({ ...ROAD, style })
    const ys = [...plan.positions].filter((_, index) => index % 2 === 1)
    return Math.max(...ys) - Math.min(...ys)
  })
  assert.deepEqual(widths, [110, 90, 110, 90, 110])

  const tapered = nativeRoadMeshPlan({ ...ROAD, startWidthScale: 0 })
  const startYs = Array.from(
    { length: tapered.positions.length / 2 },
    (_, index) => ({ x: tapered.positions[index * 2], y: tapered.positions[index * 2 + 1] }),
  ).filter(({ x }) => x === 0).map(({ y }) => y)
  assert.ok(startYs.every(y => y === 0))
})

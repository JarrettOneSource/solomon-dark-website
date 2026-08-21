import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { HUB_PRIVATE_ROOM_LAYOUTS } from '../core-kernels/hub-private-room-layout.ts'
import {
  HUB_LIBRARY_EXIT_MASKS,
  HUB_MORTUARY_MEMORIAL_GLOW,
  HUB_PRIVATE_ROOM_FLAME_ANCHORS,
  hubMemoratorHeadingIndex,
  hubRoomFlameTransform,
} from './hub-private-room-presentation.ts'

test('locks the native late Library exit masks around the return corridor', () => {
  assert.deepEqual(HUB_LIBRARY_EXIT_MASKS, [
    { height: 121, width: 381, x: 16, y: 801 },
    { height: 121, width: 381, x: 627, y: 801 },
  ])
  assert.equal(HUB_LIBRARY_EXIT_MASKS[1].x - (
    HUB_LIBRARY_EXIT_MASKS[0].x + HUB_LIBRARY_EXIT_MASKS[0].width
  ), 230)
})

test('locks the ordinary visible Mortuary portrait and marker state', () => {
  assert.deepEqual(
    HUB_PRIVATE_ROOM_LAYOUTS.mortuary.props.map(({ visual }) => {
      assert.equal(visual?.kind, 'portrait')
      return [visual.frameIndex, visual.marker]
    }),
    [
      [0, false], [1, true], [2, true], [3, true], [4, false],
      [5, true], [6, true], [7, false], [8, false], [9, true],
    ],
  )
})

test('selects the recovered 16-heading Memorator bank toward the local player', () => {
  assert.equal(hubMemoratorHeadingIndex({ x: 628, y: 700 }), 0)
  assert.equal(hubMemoratorHeadingIndex({ x: 700, y: 700 }), 2)
  assert.equal(hubMemoratorHeadingIndex({ x: 700, y: 770 }), 4)
  assert.equal(hubMemoratorHeadingIndex({ x: 628, y: 840 }), 8)
  assert.equal(hubMemoratorHeadingIndex({ x: 558, y: 770 }), 12)
  assert.equal(hubMemoratorHeadingIndex({ x: 512, y: 793.974548 }), 11)
})

test('locks the reopened late triple memorial-glow pass', () => {
  assert.deepEqual(HUB_MORTUARY_MEMORIAL_GLOW, {
    count: 3,
    depth: 1_000_001,
    height: 54,
    position: { x: 512, y: 507 },
    width: 71,
  })
  const source = readFileSync(new URL('./hub-private-room-scene.ts', import.meta.url), 'utf8')
  assert.match(source, /length: HUB_MORTUARY_MEMORIAL_GLOW\.count/)
  assert.match(source, /hub\.rooms\.mortuary\.memorialGlow/)
  assert.match(source, /glow\.blendMode = 'add'/)
  assert.match(source, /glow\.zIndex = HUB_MORTUARY_MEMORIAL_GLOW\.depth/)
})

test('locks every captured private-room candle anchor', () => {
  const expected = {
    mortuary: [50, '5e1fadf76d8f6978abccdb09636d118e014f28233e06e3be5ca7873407b2f4b2'],
    storeroom: [9, '93c030c7155b0b198408b805ab5b0db78b0709b5209b00643fc2b7a0d703da31'],
    library: [17, '7fa402f06fda65187c74a3bd7c208431ac967bd7cc52d32664b0e478dc811206'],
    office: [7, '00c30871d1bd249793957b36417620407ab96ea5107723a3d3c0177f567f0b85'],
  } as const
  for (const [region, [count, digest]] of Object.entries(expected)) {
    const anchors = HUB_PRIVATE_ROOM_FLAME_ANCHORS[
      region as keyof typeof HUB_PRIVATE_ROOM_FLAME_ANCHORS
    ]
    assert.equal(anchors.length, count, region)
    assert.equal(
      createHash('sha256').update(JSON.stringify(anchors)).digest('hex'),
      digest,
      region,
    )
  }
})

test('uses the recovered per-room flame transform envelopes deterministically', () => {
  for (const region of Object.keys(HUB_PRIVATE_ROOM_FLAME_ANCHORS) as Array<
    keyof typeof HUB_PRIVATE_ROOM_FLAME_ANCHORS
  >) {
    const minimumScaleY = region === 'mortuary' ? 0.7 : 0.8
    const maximumScaleY = region === 'mortuary' ? 0.9 : 1.2
    for (let tick = 0; tick < 20; tick += 1) {
      const transform = hubRoomFlameTransform(region, tick, tick % 7)
      assert.equal(transform.scaleX, 0.8)
      assert.ok(transform.scaleY >= minimumScaleY)
      assert.ok(transform.scaleY < maximumScaleY)
      assert.ok(transform.rotation >= -5 * Math.PI / 180)
      assert.ok(transform.rotation < 5 * Math.PI / 180)
      assert.deepEqual(transform, hubRoomFlameTransform(region, tick, tick % 7))
    }
  }
})

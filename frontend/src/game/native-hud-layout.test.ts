import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudControlLayout,
  nativeHudModalSlideLayout,
  nativeHudModalSlideOffset,
  nativeHudRectCenter,
  type NativeHudControlLayout,
} from './native-hud-layout.ts'

const centers = (layout: NativeHudControlLayout) => ({
  backpack: nativeHudRectCenter(layout.backpack),
  belt: layout.belt.map(nativeHudRectCenter),
  tome: nativeHudRectCenter(layout.tome),
})

test('lays the resting bottom controls out from the 1600x900 back buffer (0x005D76C0)', () => {
  const layout = nativeHudControlLayout(NATIVE_HUD_BACKBUFFER.width, NATIVE_HUD_BACKBUFFER.height)
  assert.deepEqual(layout.backpack, { height: 62, width: 58, x: 730.5, y: 825 })
  assert.deepEqual(layout.tome, { height: 62, width: 58, x: 810.5, y: 825 })
  assert.deepEqual(layout.belt.map(({ x }) => x), [468, 528, 588, 648, 898, 958, 1018, 1078])
  assert.deepEqual(
    new Set(layout.belt.map(({ height, width, y }) => `${width}x${height}@${y}`)),
    new Set(['53x53@832.5']),
  )
  assert.deepEqual(centers(layout).belt.map(({ y }) => y), Array.from({ length: 8 }, () => 859))
  assert.deepEqual(centers(layout).backpack, { x: 759.5, y: 856 })
})

test('slides every bottom control with the modal progress (0x005C7200)', () => {
  assert.equal(nativeHudModalSlideOffset(0), 0)
  assert.equal(nativeHudModalSlideOffset(0.5), 7.5)
  assert.equal(nativeHudModalSlideOffset(1), 15)
  const open = nativeHudModalSlideLayout(1600, 900, 1)
  assert.deepEqual(centers(open), {
    backpack: { x: 759.5, y: 871 },
    belt: [494.5, 554.5, 614.5, 674.5, 924.5, 984.5, 1044.5, 1104.5].map((x) => ({ x, y: 874.5 })),
    tome: { x: 839.5, y: 871 },
  })
  assert.deepEqual(open.backpack, { height: 62, width: 58, x: 730.5, y: 840 })
  assert.deepEqual(open.tome, { height: 62, width: 58, x: 810.5, y: 840 })
  assert.deepEqual(open.belt[0], { height: 53, width: 53, x: 468, y: 848 })
  const half = nativeHudModalSlideLayout(1600, 900, 0.5)
  assert.equal(half.backpack.y, 832.5)
  assert.equal(half.tome.y, 832.5)
  assert.equal(half.belt[3]!.y, 840.5)
  const closed = nativeHudModalSlideLayout(1600, 900, 0)
  assert.equal(closed.backpack.y, 825)
  assert.equal(closed.belt[0]!.y, 833)
})

test('follows the back-buffer size instead of fixed coordinates', () => {
  const wide = nativeHudModalSlideLayout(2560, 1080, 1)
  assert.deepEqual(nativeHudRectCenter(wide.backpack), { x: 1239.5, y: 1051 })
  assert.deepEqual(nativeHudRectCenter(wide.tome), { x: 1319.5, y: 1051 })
  assert.deepEqual(
    wide.belt.map((slot) => nativeHudRectCenter(slot).x),
    [974.5, 1034.5, 1094.5, 1154.5, 1404.5, 1464.5, 1524.5, 1584.5],
  )
  assert.equal(wide.belt[0]!.y, 1028)
  const tall = nativeHudControlLayout(1200, 1000)
  assert.deepEqual(tall.backpack, { height: 62, width: 58, x: 530.5, y: 925 })
  assert.equal(tall.belt[7]!.y, 932.5)
})

test('rejects impossible back-buffer sizes and slide progress', () => {
  assert.throws(() => nativeHudControlLayout(0, 900), RangeError)
  assert.throws(() => nativeHudControlLayout(1600, Number.NaN), RangeError)
  assert.throws(() => nativeHudModalSlideLayout(1600, 900, 1.5), RangeError)
  assert.throws(() => nativeHudModalSlideLayout(1600, 900, -0.1), RangeError)
  assert.throws(() => nativeHudModalSlideLayout(1600, 900, Number.NaN), RangeError)
  assert.throws(() => nativeHudModalSlideOffset(Number.NaN), RangeError)
})

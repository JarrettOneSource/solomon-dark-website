import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createNativeInventoryStatsScroll,
  nativeInventoryStatsDragStep,
  nativeInventoryStatsScrollOffset,
  retargetNativeInventoryStatsScroll,
} from './native-inventory-stats-scroll.ts'

test('all Stats page directions use the native float32 recurrence and final snap', () => {
  for (const [from, to] of [[0, 1], [1, 2], [2, 1], [1, 0]] as const) {
    const scroll = retargetNativeInventoryStatsScroll(createNativeInventoryStatsScroll(from, 1_000), to, 1_000)
    const origin = from * 320
    const target = to * 320
    const direction = Math.sign(target - origin)
    assert.equal(nativeInventoryStatsScrollOffset(scroll, 1_000), origin)
    assert.equal(nativeInventoryStatsScrollOffset(scroll, 1_009), origin)
    assert.equal(nativeInventoryStatsScrollOffset(scroll, 1_010), origin + direction * 48)
    const beforeSnap = nativeInventoryStatsScrollOffset(scroll, 1_360)
    assert.notEqual(beforeSnap, target)
    assert.ok(Math.abs(target - beforeSnap) <= 1)
    assert.equal(nativeInventoryStatsScrollOffset(scroll, 1_370), target)
    assert.equal(nativeInventoryStatsScrollOffset(scroll, 60_000), target)
  }
})

test('retargeting preserves the displayed offset and equal-page refresh cannot restart motion', () => {
  const forward = retargetNativeInventoryStatsScroll(createNativeInventoryStatsScroll(0, 0), 1, 1_000)
  assert.equal(retargetNativeInventoryStatsScroll(forward, 1, 1_100), forward)
  const displayed = nativeInventoryStatsScrollOffset(forward, 1_100)
  const reverse = retargetNativeInventoryStatsScroll(forward, 0, 1_100)
  assert.equal(nativeInventoryStatsScrollOffset(reverse, 1_100), displayed)
  assert.ok(nativeInventoryStatsScrollOffset(reverse, 1_110) < displayed)
  assert.equal(nativeInventoryStatsScrollOffset(reverse, 2_000), 0)
  const replacement = createNativeInventoryStatsScroll(0, 2_000)
  assert.equal(nativeInventoryStatsScrollOffset(replacement, 2_000), 0)
  assert.throws(() => retargetNativeInventoryStatsScroll(reverse, 3, 2_000), RangeError)
})

test('SwipePages uses strict squared displacement three, including diagonal and horizontal presses', () => {
  const origin = { x: 100, y: 100 }
  assert.equal(nativeInventoryStatsDragStep(origin, { x: 99, y: 99 }), null)
  assert.equal(nativeInventoryStatsDragStep(origin, { x: 98, y: 99 }), 1)
  assert.equal(nativeInventoryStatsDragStep(origin, { x: 98, y: 101 }), -1)
  assert.equal(nativeInventoryStatsDragStep(origin, { x: 98, y: 100 }), 0)
  assert.equal(nativeInventoryStatsDragStep(origin, { x: 100, y: 98 }), 1)
  assert.equal(nativeInventoryStatsDragStep(origin, { x: 100, y: 102 }), -1)
})

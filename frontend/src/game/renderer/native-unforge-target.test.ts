import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeUnforgeTargetFrame } from './native-unforge-target.ts'

test('the inventory target scrolls the authored image through the exact multiply mask', () => {
  const frame = nativeUnforgeTargetFrame(0, 1, 1600, 900)
  assert.deepEqual(frame.anchor, [1562, 868])
  assert.deepEqual(frame.clip, [103, 109, 51, 39])
  assert.deepEqual(frame.imageCenters, [[128, 128], [128, 182]])
  assert.deepEqual(frame.records, { image: 77, marker: 75, mask: 76 })
  assert.equal(frame.markerTint, 0x99ffff)
})

test('the target advances every eight application ticks and wraps after the full 55-pixel image', () => {
  assert.deepEqual(nativeUnforgeTargetFrame(7, 1, 1600, 900).imageCenters, [[128, 128], [128, 182]])
  assert.deepEqual(nativeUnforgeTargetFrame(8, 1, 1600, 900).imageCenters, [[128, 127], [128, 181]])
  assert.deepEqual(nativeUnforgeTargetFrame(432, 1, 1600, 900).imageCenters, [[128, 74], [128, 128]])
  assert.deepEqual(nativeUnforgeTargetFrame(440, 1, 1600, 900).imageCenters, [[128, 128], [128, 182]])
  assert.deepEqual(nativeUnforgeTargetFrame(-8, 1, 1600, 900).imageCenters, [[128, 129], [128, 183]])
})

test('the full target follows native reveal and viewport geometry without restarting its phase', () => {
  const opening = nativeUnforgeTargetFrame(8, 0, 1600, 900)
  const partial = nativeUnforgeTargetFrame(8, 0.5, 1600, 900)
  const settled = nativeUnforgeTargetFrame(8, 1, 1600, 900)
  assert.deepEqual(opening.anchor, [1587, 868])
  assert.deepEqual(partial.anchor, [1574.5, 868])
  assert.deepEqual(settled.anchor, [1562, 868])
  assert.deepEqual(partial.imageCenters, settled.imageCenters)
  assert.deepEqual(nativeUnforgeTargetFrame(8, 1, 1200, 700).anchor, [1162, 668])
  assert.equal(nativeUnforgeTargetFrame(90, 1, 1600, 900).markerTint, 0xccffff)
  assert.equal(nativeUnforgeTargetFrame(270, 1, 1600, 900).markerTint, 0x66ffff)
})

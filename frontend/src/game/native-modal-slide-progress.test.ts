import assert from 'node:assert/strict'
import test from 'node:test'

import {
  initialNativeModalSlideProgressSnapshot,
  nativeModalSlideProgressSnapshot,
  setNativeModalSlideProgress,
  subscribeNativeModalSlideProgress,
} from './native-modal-slide-progress.ts'

test('publishes the live inventory and skill modal slide independently', () => {
  setNativeModalSlideProgress('inventory', 0)
  setNativeModalSlideProgress('skills', 0)
  let notifications = 0
  const unsubscribe = subscribeNativeModalSlideProgress(() => { notifications += 1 })
  setNativeModalSlideProgress('inventory', 0.25)
  setNativeModalSlideProgress('skills', 0.75)
  setNativeModalSlideProgress('skills', 0.75)
  assert.deepEqual(nativeModalSlideProgressSnapshot(), { inventory: 0.25, skills: 0.75 })
  assert.equal(notifications, 2)
  unsubscribe()
  setNativeModalSlideProgress('inventory', 0)
  setNativeModalSlideProgress('skills', 0)
  assert.deepEqual(initialNativeModalSlideProgressSnapshot(), { inventory: 0, skills: 0 })
})

test('rejects progress outside the native slide interval', () => {
  assert.throws(() => setNativeModalSlideProgress('inventory', -0.01), RangeError)
  assert.throws(() => setNativeModalSlideProgress('skills', 1.01), RangeError)
  assert.throws(() => setNativeModalSlideProgress('inventory', Number.NaN), RangeError)
})

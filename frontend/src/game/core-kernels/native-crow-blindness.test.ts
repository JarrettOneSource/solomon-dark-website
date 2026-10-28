import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeCrowBlindness, nativeCrowBlindnessOpacity } from './native-crow-blindness.ts'
import { createNativeRng } from './native-rng.ts'

test('Crow blindness respects the strict post-contact health and shield gates without drawing randomness', () => {
  const rng = createNativeRng(17)
  assert.deepEqual(nativeCrowBlindness(10, 0, 100, rng), { durationTicks: 0, rng })
  assert.deepEqual(nativeCrowBlindness(11, .01, 100, rng), { durationTicks: 0, rng })
  const brokenShield = nativeCrowBlindness(11, 0, 100, rng)
  assert.ok(brokenShield.durationTicks >= 200 && brokenShield.durationTicks <= 350)
  assert.notDeepEqual(brokenShield.rng, rng)
  const disabled = nativeCrowBlindness(11, 0, 0, rng)
  assert.equal(disabled.durationTicks, 0)
  assert.notDeepEqual(disabled.rng, rng)
})

test('blindness uses a full cover followed by a one-second fade with the native stamp curve', () => {
  assert.deepEqual(nativeCrowBlindnessOpacity(350), { cover: 1, stamp: 1 })
  assert.deepEqual(nativeCrowBlindnessOpacity(100), { cover: 1, stamp: 1 })
  assert.deepEqual(nativeCrowBlindnessOpacity(50), { cover: .5, stamp: .0625 })
  assert.deepEqual(nativeCrowBlindnessOpacity(0), { cover: 0, stamp: 0 })
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_WRAITH_DAZZLE_TICKS,
  boundedMageShieldIntervalTicks,
  nativeDazzleMovementScale,
} from './boneyard-enemy-modifiers.ts'

test('Mage shield config units map into the named bounded authoritative clock', () => {
  assert.equal(boundedMageShieldIntervalTicks(10), 1_000)
  assert.equal(boundedMageShieldIntervalTicks(5), 500)
  assert.throws(() => boundedMageShieldIntervalTicks(-1), /non-negative/)
})

test('Wraith Dazzle exposes every exact 50-tick native ramp edge', () => {
  assert.equal(NATIVE_WRAITH_DAZZLE_TICKS, 50)
  for (let ticksRemaining = 50; ticksRemaining >= 1; ticksRemaining -= 1) {
    assert.equal(
      nativeDazzleMovementScale(ticksRemaining),
      (51 - ticksRemaining) / 50,
    )
  }
  assert.equal(nativeDazzleMovementScale(0), 1)
})

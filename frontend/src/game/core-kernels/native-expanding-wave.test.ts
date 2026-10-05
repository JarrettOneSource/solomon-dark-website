import assert from 'node:assert/strict'
import test from 'node:test'
import { stepNativeExpandingWave } from './native-expanding-wave.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'

test('an expanding wave grows and proposes its current scalar even on its expiry tick', () => {
  const rng = createNativeRng(31)
  const result = stepNativeExpandingWave({ radius: 175, growth: 6, scalar: 2,
    life: Math.fround(.01), fadeThreshold: Math.fround(.0375) }, rng)
  assert.equal(result.radius, 181)
  assert.equal(result.life, 0)
  assert.equal(result.retain, false)
  assert.ok(Math.abs(Math.hypot(result.displacement.x, result.displacement.y) - 6) < .000001)
  assert.deepEqual(result.rng, advanceNativeRngWords(rng, 1))
})

test('wave fading affects the next proposal and preserves every float store', () => {
  const rng = createNativeRng(31)
  const first = stepNativeExpandingWave({ radius: 75, growth: 8, scalar: 1,
    life: Math.fround(.03), fadeThreshold: Math.fround(.0375) }, rng)
  assert.equal(first.scalar, Math.fround(.9))
  assert.equal(first.radius, 83)
  assert.equal(first.life, Math.fround(Math.fround(.03) - Math.fround(.01)))
  assert.ok(Math.abs(Math.hypot(first.displacement.x, first.displacement.y) - 3) < .000001)
  const second = stepNativeExpandingWave({ radius: first.radius, growth: 8, scalar: first.scalar,
    life: first.life, fadeThreshold: Math.fround(.0375) }, first.rng)
  assert.ok(Math.abs(Math.hypot(second.displacement.x, second.displacement.y) - 3 * Math.fround(.9)) < .000001)
})

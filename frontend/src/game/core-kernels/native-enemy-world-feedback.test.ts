import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyNativeEnemyWorldFeedback,
  createNativeEnemyWorldFeedbackState,
  nativeEnemyWorldFeedbackImpulses,
  NATIVE_ENEMY_WORLD_FEEDBACK,
  stepNativeEnemyWorldFeedback,
} from './native-enemy-world-feedback.ts'

test('covers every web death presenter and its exact native pulse requests', () => {
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('skeleton-shatter'), [0.1])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('archer-shatter'), [0.1])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('mage-shatter'), [0.1])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('imp-split', 2), [0.05])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('imp-split', 0), [0.1])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('zombie-collapse'), [0.1])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('wraith-fragments'), [0.1, 0.1])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('demon-split'), [0.2])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('coffin-break'), [0.2])
  assert.deepEqual(nativeEnemyWorldFeedbackImpulses('portal-break'), [0.2])
})

test('shares the exact float32 accumulator transition used by score and presentation', () => {
  const firstTick = stepNativeEnemyWorldFeedback(createNativeEnemyWorldFeedbackState())
  assert.deepEqual(firstTick, { accumulator: Math.fround(0.1), magnitude: 0 })
  const first = applyNativeEnemyWorldFeedback(firstTick, 0.1)
  assert.deepEqual(first, {
    accumulator: Math.fround(0.1 + NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorImpulse),
    magnitude: Math.fround(0.1 * 0.1),
  })
  const second = applyNativeEnemyWorldFeedback(first, 0.1)
  assert.deepEqual(second, {
    accumulator: Math.fround(
      Math.fround(0.1 + NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorImpulse)
        + NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorImpulse,
    ),
    magnitude: Math.fround(first.accumulator * 0.1),
  })
  assert.equal(
    stepNativeEnemyWorldFeedback(second, 10_000).accumulator,
    Math.fround(0.1),
  )
})

test('retains the exact float32 terminal magnitude maximum', () => {
  for (const output of ['coffin-break', 'demon-split', 'portal-break'] as const) {
    const [intensity] = nativeEnemyWorldFeedbackImpulses(output)
    const feedback = applyNativeEnemyWorldFeedback(
      { accumulator: 1, magnitude: 0 },
      intensity!,
    )
    assert.equal(feedback.magnitude, NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeCap)
  }
})

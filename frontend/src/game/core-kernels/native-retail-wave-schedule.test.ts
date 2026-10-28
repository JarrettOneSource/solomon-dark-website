import assert from 'node:assert/strict'
import test from 'node:test'

import { validateWaves } from '../../editor/waves.ts'
import { NATIVE_RETAIL_WAVES } from './native-retail-wave-schedule.ts'

test('generated retail wave schedule is valid', () => {
  assert.deepEqual(validateWaves([...NATIVE_RETAIL_WAVES]), [])
})

test('retail schedule keeps signed loop edges and declared population bounds', () => {
  assert.ok(NATIVE_RETAIL_WAVES.some((wave) => wave.next.some((offset) => offset < 0)))
  assert.equal(Math.min(...NATIVE_RETAIL_WAVES.map((wave) => wave.spawn)), 3)
  assert.equal(Math.max(...NATIVE_RETAIL_WAVES.map((wave) => wave.spawn)), 60)
  assert.equal(Math.min(...NATIVE_RETAIL_WAVES.map((wave) => wave.maxEnemies)), 40)
  assert.equal(Math.max(...NATIVE_RETAIL_WAVES.map((wave) => wave.maxEnemies)), 80)
})

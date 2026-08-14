import assert from 'node:assert/strict'
import test from 'node:test'

import { validateWaves } from '../../editor/waves.ts'
import {
  NATIVE_RETAIL_WAVES,
  NATIVE_RETAIL_WAVE_PROVENANCE,
} from './native-retail-wave-schedule.ts'

test('generated retail wave schedule is pinned to the untouched stock source', () => {
  assert.deepEqual(NATIVE_RETAIL_WAVE_PROVENANCE, {
    schema: 'solomon-dark-retail-wave-schedule-v1',
    sourceFilename: 'data/wave.txt',
    sourceBytes: 29147,
    sourceSha256: '363a985d79dc3ca28fb5ce519f56c436f5269a9bea1bedc7d1a825e8139499fc',
    waveCount: 42,
    spawnBudget: 918,
    groupCount: 205,
    enemyRowCount: 680,
    enemyRowCounts: {
      COFFIN: 15,
      DEMON: 14,
      IMP: 63,
      SKELETON: 344,
      SKELETONARCHER: 140,
      SKELETONMAGE: 58,
      WRAITH: 5,
      ZOMBIE: 41,
    },
  })
  assert.deepEqual(validateWaves([...NATIVE_RETAIL_WAVES]), [])
})

test('retail schedule keeps signed loop edges and declared population bounds', () => {
  assert.ok(NATIVE_RETAIL_WAVES.some((wave) => wave.next.some((offset) => offset < 0)))
  assert.equal(Math.min(...NATIVE_RETAIL_WAVES.map((wave) => wave.spawn)), 3)
  assert.equal(Math.max(...NATIVE_RETAIL_WAVES.map((wave) => wave.spawn)), 60)
  assert.equal(Math.min(...NATIVE_RETAIL_WAVES.map((wave) => wave.maxEnemies)), 40)
  assert.equal(Math.max(...NATIVE_RETAIL_WAVES.map((wave) => wave.maxEnemies)), 80)
})

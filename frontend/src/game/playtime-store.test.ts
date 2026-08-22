import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PLAYTIME_FLUSH_INTERVAL_MS,
  PLAYTIME_STORAGE_KEY,
  readTotalPlaytimeMs,
  trackPlaytime,
} from './playtime-store.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const backing = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
  }
}

test('playtime reads persisted totals and rejects corrupted values', () => {
  assert.equal(readTotalPlaytimeMs(memoryStorage()), 0)
  assert.equal(
    readTotalPlaytimeMs(memoryStorage({ [PLAYTIME_STORAGE_KEY]: '5400000' })),
    5_400_000,
  )
  for (const corrupted of ['', 'soon', '-20', '1.5', '9007199254740993']) {
    assert.equal(
      readTotalPlaytimeMs(memoryStorage({ [PLAYTIME_STORAGE_KEY]: corrupted })),
      0,
    )
  }
})

test('playtime accumulates across flushes and finishes on stop', () => {
  const storage = memoryStorage({ [PLAYTIME_STORAGE_KEY]: '1000' })
  let currentMs = 50_000
  let tick = () => {}
  const stop = trackPlaytime({
    now: () => currentMs,
    schedule: (callback, intervalMs) => {
      assert.equal(intervalMs, PLAYTIME_FLUSH_INTERVAL_MS)
      tick = callback
      return () => { tick = () => {} }
    },
    storage,
  })

  currentMs += 30_000
  tick()
  assert.equal(readTotalPlaytimeMs(storage), 31_000)

  tick()
  assert.equal(readTotalPlaytimeMs(storage), 31_000)

  currentMs += 4_500
  stop()
  assert.equal(readTotalPlaytimeMs(storage), 35_500)

  currentMs += 60_000
  tick()
  assert.equal(readTotalPlaytimeMs(storage), 35_500)
})

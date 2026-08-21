import assert from 'node:assert/strict'
import test from 'node:test'

import type { HallOfFameEntry } from './core-kernels/hall-of-fame.ts'
import {
  HALL_OF_FAME_STORAGE_KEY,
  readLocalHallOfFame,
  recordLocalHallOfFame,
} from './hall-of-fame-store.ts'

test('persists one local row per run and keeps native ranking order', () => {
  const storage = memoryStorage()
  recordLocalHallOfFame(entry('first', 10), storage)
  recordLocalHallOfFame(entry('second', 30), storage)
  recordLocalHallOfFame(entry('first', 40), storage)
  assert.deepEqual(
    readLocalHallOfFame(storage).map(({ runId, awesomeness }) => [runId, awesomeness]),
    [['first', 40], ['second', 30]],
  )
})

test('treats malformed local data as an empty Hall instead of inventing rows', () => {
  const storage = memoryStorage()
  storage.setItem(HALL_OF_FAME_STORAGE_KEY, '[{"runId":"broken"}]')
  assert.deepEqual(readLocalHallOfFame(storage), [])
})

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

function entry(runId: string, awesomeness: number): HallOfFameEntry {
  return {
    accountUsername: null,
    awesomeness,
    awesomestKill: null,
    completedAtUtc: '2026-08-20T00:00:00.000Z',
    discipline: 'mind',
    elapsedTicks: 1_000,
    element: 'fire',
    headingIndex: 4,
    highestSkills: [],
    level: 1,
    monstersKilled: 0,
    perksUsed: [],
    portraitScale: 1,
    runId,
    wave: 1,
    wizardName: 'Helvidius',
  }
}

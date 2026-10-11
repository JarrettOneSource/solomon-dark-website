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

const LEGACY_KEY = 'sdr.game.hall-of-fame.v2'

test('mixed-root Hall writes use v3 and keep late legacy writes independently readable', () => {
  assert.equal(HALL_OF_FAME_STORAGE_KEY, 'sdr.game.hall-of-fame.v3')
  const storage = memoryStorage()
  const legacy = JSON.stringify([entry('legacy', 20), entry('duplicate', 99)])
  storage.setItem(LEGACY_KEY, legacy)
  assert.equal(storage.getItem(HALL_OF_FAME_STORAGE_KEY), null)
  assert.equal(readLocalHallOfFame(storage).length, 2)
  const mixed = { ...entry('duplicate', 30), discipline: 'water' as const }
  recordLocalHallOfFame(mixed, storage)
  assert.equal(storage.getItem(LEGACY_KEY), legacy)
  assert.deepEqual(readLocalHallOfFame(storage).map(row => [row.runId, row.discipline, row.awesomeness]),
    [['duplicate', 'water', 30], ['legacy', 'mind', 20]])
  storage.setItem(LEGACY_KEY, JSON.stringify([entry('late', 40), entry('duplicate', 99)]))
  assert.deepEqual(readLocalHallOfFame(storage).map(row => row.runId), ['late', 'duplicate', 'legacy'])
  storage.setItem(LEGACY_KEY, '{broken')
  assert.deepEqual(readLocalHallOfFame(storage).map(row => row.runId), ['duplicate', 'legacy'])
  storage.setItem(HALL_OF_FAME_STORAGE_KEY, '{broken')
  storage.setItem(LEGACY_KEY, JSON.stringify([entry('rescue', 1)]))
  assert.deepEqual(readLocalHallOfFame(storage).map(row => row.runId), ['rescue'])
})

test('Hall migration deduplicates before stable ranking and top-100 truncation', () => {
  const storage = memoryStorage()
  const modern = Array.from({ length: 70 }, (_, i) => ({ ...entry(`modern-${i}`, 10), discipline: 'fire' as const }))
  const legacy = [...Array.from({ length: 50 }, (_, i) => entry(`modern-${i}`, 100)),
    ...Array.from({ length: 50 }, (_, i) => entry(`legacy-${i}`, 10))]
  storage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify(modern))
  storage.setItem(LEGACY_KEY, JSON.stringify(legacy))
  const actual = readLocalHallOfFame(storage)
  assert.equal(actual.length, 100)
  assert.deepEqual(actual.slice(0, 70), modern)
  assert.deepEqual(actual.slice(70).map(row => row.runId), Array.from({ length: 30 }, (_, i) => `legacy-${i}`))
})

test('local Hall accepts all eight roots and rejects unknown discipline values', () => {
  const storage = memoryStorage()
  for (const discipline of ['ether', 'fire', 'air', 'water', 'earth', 'body', 'mind', 'arcane'] as const) {
    recordLocalHallOfFame({ ...entry(discipline, 1), discipline }, storage)
  }
  assert.equal(readLocalHallOfFame(storage).length, 8)
  storage.setItem(HALL_OF_FAME_STORAGE_KEY, JSON.stringify([{ ...entry('invalid', 1), discipline: 'unknown' }]))
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

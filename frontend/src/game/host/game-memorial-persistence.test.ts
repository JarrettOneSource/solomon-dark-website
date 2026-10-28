import assert from 'node:assert/strict'
import {
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { archiveHubMemorialPortrait } from '../core-kernels/hub-memorial.ts'
import { openGameMemorialPersistence } from './game-memorial-persistence.ts'

test('atomically persists and reopens the exact shared-Hub memorial state', () => {
  const directory = mkdtempSync(join(tmpdir(), 'solomon-memorial-'))
  const path = join(directory, 'memoratorium.json')
  try {
    const persistence = openGameMemorialPersistence(path)
    assert.equal(persistence.initialState.nextAge, 1001)
    const completed = archiveHubMemorialPortrait(persistence.initialState, {
      accountUsername: 'AureliaAccount',
      awesomeness: 4_567,
      awesomestKill: 'Horned Skeleton Fire Archer',
      capturedAtTick: 30_000,
      config: { discipline: 'arcane', displayName: 'Aurelia', element: 'earth' },
      elapsedTicks: 12_345,
      equipment: { hat: null, robe: null, weapon: null },
      headingIndex: 12,
      level: 7,
      monstersKilled: 321,
      playerId: 'player-a',
      portraitScale: 0.925,
      runId: 'run-a',
      wave: 12,
    }, 0)

    persistence.persist(completed)

    assert.deepEqual(openGameMemorialPersistence(path).initialState, completed)
    // Windows exposes a shared read/write bit instead of POSIX owner permissions.
    assert.equal(statSync(path).mode & 0o777, process.platform === 'win32' ? 0o666 : 0o600)
    assert.deepEqual(readdirSync(directory), ['memoratorium.json'])
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('rejects malformed durable state instead of silently resetting it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'solomon-memorial-invalid-'))
  const path = join(directory, 'memoratorium.json')
  try {
    writeFileSync(path, JSON.stringify({ state: {} }))
    assert.throws(
      () => openGameMemorialPersistence(path),
      /nextAge/,
    )
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameSaveCoordinator,
  type GameSaveStore,
  type StoredGameSave,
} from './game-save-coordinator.ts'

class RecordingStore implements GameSaveStore {
  record: StoredGameSave | null
  readonly operations: string[] = []

  constructor(record: StoredGameSave | null = null) {
    this.record = record
  }

  async read(): Promise<StoredGameSave | null> {
    this.operations.push('read')
    return this.record
  }

  async write(document: string, expectedRevision: number): Promise<StoredGameSave> {
    this.operations.push(`write:${expectedRevision}:${document}`)
    if ((this.record?.revision ?? 0) !== expectedRevision) throw new Error('revision conflict')
    this.record = {
      document,
      formatVersion: 2,
      revision: expectedRevision + 1,
      sha256: String(expectedRevision + 1).padStart(64, '0'),
      slot: 0,
      updatedAtUtc: '2026-08-20T12:00:00Z',
    }
    return this.record
  }

}

test('save coordinator serializes progress before the Game Over profile checkpoint', async () => {
  const store = new RecordingStore()
  const changes: Array<StoredGameSave | null> = []
  const coordinator = new GameSaveCoordinator(store, (record) => changes.push(record))
  await coordinator.load()

  coordinator.accept({ document: 'checkpoint-one', reason: 'progress', sequence: 1 })
  coordinator.accept({ document: 'checkpoint-two', reason: 'progress', sequence: 2 })
  coordinator.accept({ document: 'profile-only', reason: 'game-over', sequence: 3 })
  await coordinator.idle()

  assert.deepEqual(store.operations, [
    'read',
    'write:0:checkpoint-one',
    'write:1:checkpoint-two',
    'write:2:profile-only',
  ])
  assert.equal(coordinator.current()?.document, 'profile-only')
  assert.equal(changes.at(-1)?.document, 'profile-only')
})

test('save coordinator ignores replayed and byte-identical checkpoints', async () => {
  const existing: StoredGameSave = {
    document: 'same-document',
    formatVersion: 2,
    revision: 4,
    sha256: '4'.repeat(64),
    slot: 0,
    updatedAtUtc: '2026-08-20T12:00:00Z',
  }
  const store = new RecordingStore(existing)
  const coordinator = new GameSaveCoordinator(store, () => {})
  await coordinator.load()

  coordinator.accept({ document: 'same-document', reason: 'progress', sequence: 7 })
  coordinator.accept({ document: 'stale', reason: 'progress', sequence: 6 })
  coordinator.accept({ document: 'new-document', reason: 'progress', sequence: 8 })
  await coordinator.idle()

  assert.deepEqual(store.operations, ['read', 'write:4:new-document'])
  assert.equal(coordinator.current()?.revision, 5)
})

test('save coordinator exposes exact checkpoint completion and failure to deployment drain', async () => {
  const store = new RecordingStore()
  const failures: Error[] = []
  const coordinator = new GameSaveCoordinator(store, () => {}, error => failures.push(error))
  await coordinator.load()

  coordinator.accept({ document: 'checkpoint-one', reason: 'progress', sequence: 1 })
  await coordinator.waitFor(1)
  assert.equal(coordinator.current()?.document, 'checkpoint-one')

  store.record = {
    ...store.record!,
    revision: 9,
  }
  coordinator.accept({ document: 'checkpoint-two', reason: 'progress', sequence: 2 })
  await assert.rejects(() => coordinator.waitFor(2), /revision conflict/)
  await assert.rejects(() => coordinator.waitFor(0), /revision conflict/)
  assert.match(failures.at(-1)?.message ?? '', /revision conflict/)
})

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

  async clear(expectedRevision: number): Promise<void> {
    this.operations.push(`clear:${expectedRevision}`)
    if ((this.record?.revision ?? 0) !== expectedRevision) throw new Error('revision conflict')
    this.record = null
  }
}

test('save coordinator serializes progress before Game Over deletion', async () => {
  const store = new RecordingStore()
  const changes: Array<StoredGameSave | null> = []
  const coordinator = new GameSaveCoordinator(store, (record) => changes.push(record))
  await coordinator.load()

  coordinator.accept({ document: 'checkpoint-one', reason: 'progress', sequence: 1 })
  coordinator.accept({ document: 'checkpoint-two', reason: 'progress', sequence: 2 })
  coordinator.accept({ document: null, reason: 'game-over', sequence: 3 })
  await coordinator.idle()

  assert.deepEqual(store.operations, [
    'read',
    'write:0:checkpoint-one',
    'write:1:checkpoint-two',
    'clear:2',
  ])
  assert.equal(coordinator.current(), null)
  assert.equal(changes.at(-1), null)
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

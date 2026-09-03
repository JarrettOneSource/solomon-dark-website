import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameSaveCoordinator,
  type GameSaveStore,
  type StoredGameSave,
} from './game-save-coordinator.ts'

class RecordingStore implements GameSaveStore {
  failNextWrite = false
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
    if (this.failNextWrite) {
      this.failNextWrite = false
      throw new Error('injected write failure')
    }
    if ((this.record?.revision ?? 0) !== expectedRevision) throw new Error('revision conflict')
    this.record = {
      document,
      revision: expectedRevision + 1,
      slot: 0,
    }
    return this.record
  }

}

test('save coordinator coalesces queued progress into the newest Game Over checkpoint', async () => {
  const store = new RecordingStore()
  const changes: Array<StoredGameSave | null> = []
  const coordinator = new GameSaveCoordinator(store, (record) => changes.push(record))
  await coordinator.load()

  const first = coordinator.accept({
    document: 'checkpoint-one',
    reason: 'progress',
    sequence: 1,
    streamId: 1,
  })
  const superseded = coordinator.accept({
    document: 'checkpoint-two',
    reason: 'progress',
    sequence: 2,
    streamId: 1,
  })
  const terminal = coordinator.accept({
    document: 'profile-only',
    reason: 'game-over',
    sequence: 3,
    streamId: 1,
  })
  await Promise.all([first, superseded, terminal])
  await coordinator.idle()

  assert.deepEqual(store.operations, [
    'read',
    'write:0:checkpoint-one',
    'write:1:profile-only',
  ])
  assert.equal(coordinator.current()?.document, 'profile-only')
  assert.equal(changes.at(-1)?.document, 'profile-only')
})

test('title replacement supersedes progress that has not started writing', async () => {
  const store = new RecordingStore()
  const coordinator = new GameSaveCoordinator(store, () => {})
  await coordinator.load()

  const first = coordinator.accept({
    document: 'active-one',
    reason: 'progress',
    sequence: 1,
    streamId: 7,
  })
  const superseded = coordinator.accept({
    document: 'active-two',
    reason: 'progress',
    sequence: 2,
    streamId: 7,
  })
  const replacement = coordinator.replace('profile-only')
  await Promise.all([first, superseded, replacement])

  assert.deepEqual(store.operations, [
    'read',
    'write:0:active-one',
    'write:1:profile-only',
  ])
  assert.equal(coordinator.current()?.document, 'profile-only')
})

test('save coordinator ignores replayed and byte-identical checkpoints', async () => {
  const existing: StoredGameSave = {
    document: 'same-document',
    revision: 4,
    slot: 0,
  }
  const store = new RecordingStore(existing)
  const coordinator = new GameSaveCoordinator(store, () => {})
  await coordinator.load()

  await coordinator.accept({ document: 'same-document', reason: 'progress', sequence: 7, streamId: 1 })
  await assert.rejects(
    coordinator.accept({ document: 'stale', reason: 'progress', sequence: 6, streamId: 1 }),
    /out of order/,
  )
  await coordinator.accept({ document: 'new-document', reason: 'progress', sequence: 8, streamId: 1 })
  await coordinator.idle()

  assert.deepEqual(store.operations, ['read', 'write:4:new-document'])
  assert.equal(coordinator.current()?.revision, 5)
})

test('save coordinator exposes exact checkpoint completion and failure to deployment drain', async () => {
  const store = new RecordingStore()
  const failures: Error[] = []
  const coordinator = new GameSaveCoordinator(store, () => {}, error => failures.push(error))
  await coordinator.load()

  await coordinator.accept({ document: 'checkpoint-one', reason: 'progress', sequence: 1, streamId: 1 })
  assert.equal(coordinator.current()?.document, 'checkpoint-one')

  store.record = {
    ...store.record!,
    revision: 9,
  }
  await assert.rejects(
    coordinator.accept({ document: 'checkpoint-two', reason: 'progress', sequence: 2, streamId: 1 }),
    /revision conflict/,
  )
  await assert.rejects(() => coordinator.idle(), /revision conflict/)
  assert.match(failures.at(-1)?.message ?? '', /revision conflict/)
})

test('a failed write does not poison a newer durable checkpoint or idle outcome', async () => {
  const store = new RecordingStore()
  const failures: Error[] = []
  const coordinator = new GameSaveCoordinator(store, () => {}, error => failures.push(error))
  await coordinator.load()

  store.failNextWrite = true
  const failed = coordinator.accept({
    document: 'failed-checkpoint',
    reason: 'progress',
    sequence: 1,
    streamId: 1,
  })
  const recovered = coordinator.accept({
    document: 'newest-checkpoint',
    reason: 'progress',
    sequence: 2,
    streamId: 1,
  })

  await assert.rejects(failed, /injected write failure/)
  await recovered
  await coordinator.idle()
  assert.equal(coordinator.current()?.document, 'newest-checkpoint')
  assert.deepEqual(store.operations, [
    'read',
    'write:0:failed-checkpoint',
    'write:0:newest-checkpoint',
  ])
  assert.equal(failures.length, 1)
})

test('save coordinator scopes sequences per session and exposes exact accepted outcomes', async () => {
  const store = new RecordingStore()
  const coordinator = new GameSaveCoordinator(store, () => {})
  await coordinator.load()

  const first = coordinator.accept({
    document: 'session-one-checkpoint-three',
    reason: 'progress',
    sequence: 3,
    streamId: 41,
  })
  const later = coordinator.accept({
    document: 'session-one-checkpoint-four',
    reason: 'progress',
    sequence: 4,
    streamId: 41,
  })
  assert.equal(coordinator.accept({
    document: 'session-one-checkpoint-three',
    reason: 'progress',
    sequence: 3,
    streamId: 41,
  }), first)
  await first
  await later
  assert.equal(coordinator.accept({
    document: 'session-one-checkpoint-four',
    reason: 'progress',
    sequence: 4,
    streamId: 41,
  }), later)

  await coordinator.accept({
    document: 'session-two-checkpoint-one',
    reason: 'progress',
    sequence: 1,
    streamId: 42,
  })
  assert.deepEqual(store.operations, [
    'read',
    'write:0:session-one-checkpoint-three',
    'write:1:session-one-checkpoint-four',
    'write:2:session-two-checkpoint-one',
  ])
})

test('title replacement persists profile-only state before a later session stream', async () => {
  const store = new RecordingStore()
  const coordinator = new GameSaveCoordinator(store, () => {})
  await coordinator.load()

  await coordinator.accept({
    document: 'active-wizard',
    reason: 'progress',
    sequence: 3,
    streamId: 41,
  })
  await coordinator.replace('profile-only')
  await assert.rejects(coordinator.accept({
    document: 'late-active-wizard',
    reason: 'progress',
    sequence: 4,
    streamId: 41,
  }), /stream 41 is retired/)
  await coordinator.accept({
    document: 'new-wizard',
    reason: 'progress',
    sequence: 1,
    streamId: 42,
  })
  await assert.rejects(coordinator.accept({
    document: 'stale-active-wizard',
    reason: 'progress',
    sequence: 5,
    streamId: 41,
  }), /stream 41 is stale/)

  assert.deepEqual(store.operations, [
    'read',
    'write:0:active-wizard',
    'write:1:profile-only',
    'write:2:new-wizard',
  ])
})

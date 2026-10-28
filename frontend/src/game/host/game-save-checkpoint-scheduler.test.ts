import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameSaveCheckpointScheduler,
  type GameSaveCheckpointBatchReceipt,
} from './game-save-checkpoint-scheduler.ts'

test('checkpoint scheduler coalesces per owner and yields between projections', async () => {
  const published: string[] = []
  const batches: GameSaveCheckpointBatchReceipt[] = []
  const scheduler = new GameSaveCheckpointScheduler({
    onBatch: receipt => batches.push(receipt),
    onError: (_playerId, error) => { throw error },
    publish: (playerId, source) => {
      published.push(`${playerId}:${source}`)
      return { documentBytes: 100, published: true }
    },
  })

  scheduler.enqueue(['player-1', 'player-2'], 'periodic')
  scheduler.enqueue(['player-1'], 'skill-picker-closed')
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.deepEqual(published, ['player-1:skill-picker-closed'])
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.deepEqual(published, [
    'player-1:skill-picker-closed',
    'player-2:periodic',
  ])
  assert.equal(batches.length, 1)
  assert.deepEqual(batches[0]?.sources, ['periodic', 'skill-picker-closed'])
  assert.equal(batches[0]?.requestCount, 2)
  assert.equal(batches[0]?.targetRequestCount, 3)
  assert.equal(batches[0]?.publishedCount, 2)
  assert.equal(batches[0]?.publishedBytes, 200)
})

test('checkpoint scheduler cancels disconnected owners and all work on close', async () => {
  const published: string[] = []
  const scheduler = new GameSaveCheckpointScheduler({
    onBatch: () => {},
    onError: (_playerId, error) => { throw error },
    publish: (playerId) => {
      published.push(playerId)
      return { documentBytes: 0, published: false }
    },
  })

  scheduler.enqueue(['departed'], 'participant-disconnected')
  scheduler.cancel('departed')
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.deepEqual(published, [])

  scheduler.enqueue(['closing'], 'periodic')
  scheduler.close()
  await new Promise<void>(resolve => setImmediate(resolve))
  assert.deepEqual(published, [])
})

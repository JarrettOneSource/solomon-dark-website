import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_WEB_GAME_SAVE_BYTES } from '../save/game-save-contract.ts'
import { decodeClientGameMessage, decodeServerGameMessage, encodeGameMessage } from './game-protocol.ts'
import {
  GameSaveCheckpointReceiver,
  GameSaveCheckpointSender,
  SAVE_CHECKPOINT_CHUNK_CHARACTERS,
  SAVE_CHECKPOINT_CHUNK_WINDOW,
  SAVE_CHECKPOINT_STREAM_THRESHOLD,
} from './game-save-checkpoint-transfer.ts'
import type { ServerSaveCheckpointChunkMessage, ServerSaveCheckpointMessage } from './game-server-messages.ts'

type TransferMessage = ServerSaveCheckpointMessage | ServerSaveCheckpointChunkMessage

function checkpoint(sequence: number, save = 'x'.repeat(SAVE_CHECKPOINT_STREAM_THRESHOLD + 1)): ServerSaveCheckpointMessage {
  return { type: 'server-save-checkpoint', sequence, save, reason: 'progress' }
}

function acknowledge(sender: GameSaveCheckpointSender, message: TransferMessage): void {
  assert.equal(message.type, 'server-save-checkpoint-chunk')
  if (message.type !== 'server-save-checkpoint-chunk') throw new Error('Expected a save fragment')
  sender.acknowledge({ type: 'client-save-checkpoint-chunk-ack', sequence: message.sequence,
    nextOffset: message.offset + message.data.length })
}

test('background checkpoints bound unacknowledged data and preserve Unicode through wire reassembly', () => {
  const wire: TransferMessage[] = []
  const sender = new GameSaveCheckpointSender(message => wire.push(message))
  const receiver = new GameSaveCheckpointReceiver()
  // Split the surrogate pair at the first fragment boundary.
  const original = checkpoint(1, 'x'.repeat(SAVE_CHECKPOINT_CHUNK_CHARACTERS - 1)
    + '😀雨'.repeat(SAVE_CHECKPOINT_STREAM_THRESHOLD))
  sender.publish(original, 'background')
  assert.equal(wire.length, SAVE_CHECKPOINT_CHUNK_WINDOW)
  const completed: ServerSaveCheckpointMessage[] = []
  let received = 0
  while (wire.length) {
    const message = wire.shift()!
    const decoded = decodeServerGameMessage(encodeGameMessage(message))
    assert.equal(decoded.type, 'server-save-checkpoint-chunk')
    if (decoded.type !== 'server-save-checkpoint-chunk') throw new Error('Expected a save fragment')
    received += decoded.data.length
    const result = receiver.acceptChunk(decoded)
    if (received < original.save.length) assert.equal(result, null)
    else completed.push(result!)
    acknowledge(sender, decoded)
    assert.ok(wire.length <= SAVE_CHECKPOINT_CHUNK_WINDOW)
  }
  assert.deepEqual(completed, [original])
})

test('background saves finish under repeated publication and retain only the latest waiting document', () => {
  const wire: TransferMessage[] = []
  const sender = new GameSaveCheckpointSender(message => wire.push(message))
  const receiver = new GameSaveCheckpointReceiver()
  sender.publish(checkpoint(1), 'background')
  sender.publish(checkpoint(2), 'background')
  sender.publish(checkpoint(3), 'background')
  assert.equal(wire.length, SAVE_CHECKPOINT_CHUNK_WINDOW)
  assert.throws(() => sender.acknowledge({ type: 'client-save-checkpoint-chunk-ack',
    sequence: 3, nextOffset: SAVE_CHECKPOINT_CHUNK_CHARACTERS }), /queued sequence/)
  const completed: ServerSaveCheckpointMessage[] = []
  while (wire.length) {
    const message = wire.shift()!
    assert.equal(message.type, 'server-save-checkpoint-chunk')
    if (message.type !== 'server-save-checkpoint-chunk') throw new Error('Expected a save fragment')
    const result = receiver.acceptChunk(message)
    if (result) completed.push(result)
    acknowledge(sender, message)
    assert.ok(wire.length <= SAVE_CHECKPOINT_CHUNK_WINDOW)
  }
  assert.deepEqual(completed, [checkpoint(1), checkpoint(3)])
})

test('atomic lifecycle checkpoints cancel active and queued transfers', () => {
  const wire: TransferMessage[] = []
  const sender = new GameSaveCheckpointSender(message => wire.push(message))
  const receiver = new GameSaveCheckpointReceiver()
  sender.publish(checkpoint(1), 'background')
  const oldChunk = wire[0]!
  assert.equal(oldChunk.type, 'server-save-checkpoint-chunk')
  if (oldChunk.type !== 'server-save-checkpoint-chunk') throw new Error('Expected a save fragment')
  assert.equal(receiver.acceptChunk(oldChunk), null)
  sender.publish(checkpoint(2), 'background')
  const final = checkpoint(3)
  wire.length = 0
  sender.publish(final, 'atomic')
  assert.deepEqual(wire, [final])
  receiver.acceptComplete(final)
  assert.equal(receiver.acceptChunk(oldChunk), null)
  acknowledge(sender, oldChunk)
  assert.deepEqual(wire, [final])
  assert.throws(() => sender.publish(final, 'atomic'), /sequence/)
  sender.publish(checkpoint(4, '{}'), 'background')
  assert.deepEqual(wire.at(-1), checkpoint(4, '{}'))
})

test('duplicate acknowledgments are harmless; future and unsent offsets cannot release the window', () => {
  const wire: TransferMessage[] = []
  const sender = new GameSaveCheckpointSender(message => wire.push(message))
  sender.publish(checkpoint(1), 'background')
  assert.throws(() => sender.acknowledge({ type: 'client-save-checkpoint-chunk-ack',
    sequence: 2, nextOffset: 1 }), /unsent sequence/)
  assert.throws(() => sender.acknowledge({ type: 'client-save-checkpoint-chunk-ack',
    sequence: 1, nextOffset: SAVE_CHECKPOINT_CHUNK_CHARACTERS * 5 }), /sent chunk/)
  assert.throws(() => sender.acknowledge({ type: 'client-save-checkpoint-chunk-ack',
    sequence: 1, nextOffset: 1 }), /sent chunk/)
  acknowledge(sender, wire[0]!)
  assert.equal(wire.length, SAVE_CHECKPOINT_CHUNK_WINDOW + 1)
  acknowledge(sender, wire[0]!)
  assert.equal(wire.length, SAVE_CHECKPOINT_CHUNK_WINDOW + 1)
  sender.close()
  acknowledge(sender, wire[1]!)
  assert.equal(wire.length, SAVE_CHECKPOINT_CHUNK_WINDOW + 1)
})

test('partial transfers reject missing, overlapping and inconsistent fragments and discard on close', () => {
  const first: ServerSaveCheckpointChunkMessage = { type: 'server-save-checkpoint-chunk',
    data: 'abc', offset: 0, totalLength: 6, sequence: 1, reason: 'progress' }
  for (const mismatch of [{ offset: 4 }, { offset: 2 }, { totalLength: 7 }, { reason: 'game-over' as const }]) {
    const receiver = new GameSaveCheckpointReceiver()
    receiver.acceptChunk(first)
    assert.throws(() => receiver.acceptChunk({ ...first, offset: 3, ...mismatch }), /pending transfer/)
  }
  const receiver = new GameSaveCheckpointReceiver()
  assert.throws(() => receiver.acceptChunk({ ...first, offset: 3 }), /first chunk/)
  receiver.acceptChunk(first)
  receiver.close()
  assert.throws(() => receiver.acceptChunk({ ...first, offset: 3 }), /first chunk/)
})

test('wire bounds fragments and acknowledgments; completed Unicode saves still obey the byte limit', () => {
  const first: ServerSaveCheckpointChunkMessage = { type: 'server-save-checkpoint-chunk',
    data: 'abc', offset: 0, totalLength: 6, sequence: 1, reason: 'progress' }
  for (const invalid of [{ data: '' }, { data: 'x'.repeat(SAVE_CHECKPOINT_CHUNK_CHARACTERS + 1) },
    { offset: -1 }, { offset: 4 }, { totalLength: MAX_WEB_GAME_SAVE_BYTES + 1 }, { sequence: 0 }]) {
    assert.throws(() => decodeServerGameMessage(JSON.stringify({ ...first, ...invalid })))
  }
  const ack = { type: 'client-save-checkpoint-chunk-ack', sequence: 1, nextOffset: 3 }
  assert.deepEqual(decodeClientGameMessage(JSON.stringify(ack)), ack)
  for (const invalid of [{ nextOffset: 0 }, { nextOffset: 1.5 },
    { nextOffset: MAX_WEB_GAME_SAVE_BYTES + 1 }, { sequence: 0 }, { unexpected: true }]) {
    assert.throws(() => decodeClientGameMessage(JSON.stringify({ ...ack, ...invalid })))
  }
  const receiver = new GameSaveCheckpointReceiver()
  const save = '雨'.repeat(Math.floor(MAX_WEB_GAME_SAVE_BYTES / 3) + 1)
  for (let offset = 0; offset < save.length; offset += SAVE_CHECKPOINT_CHUNK_CHARACTERS) {
    const chunk = { ...first, data: save.slice(offset, offset + SAVE_CHECKPOINT_CHUNK_CHARACTERS),
      offset, totalLength: save.length }
    if (offset + chunk.data.length < save.length) assert.equal(receiver.acceptChunk(chunk), null)
    else assert.throws(() => receiver.acceptChunk(chunk), /save/)
  }
})

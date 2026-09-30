import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { decodeClientGameMessage, decodeServerGameMessage, encodeGameMessage } from './game-protocol.ts'
import { GAME_PROTOCOL_VERSION, GAME_WEBSOCKET_MAX_PAYLOAD_BYTES } from './game-protocol-contract.ts'
import type { ServerWelcomeMessage } from './game-server-messages.ts'
import { GAME_STRING_CHUNK_CHARACTERS, GAME_STRING_CHUNK_WINDOW, GameStringReceiver, GameStringSender } from './game-string-transfer.ts'
import type { GameStringChunk } from './game-string-transfer.ts'
import { GAME_WELCOME_PROGRESS_TIMEOUT_MS, GameWelcomeReceiver, GameWelcomeSender } from './game-welcome-transfer.ts'

test('the shared string window preserves an exact Unicode message across acknowledgements', () => {
  const value = `${'a'.repeat(GAME_STRING_CHUNK_CHARACTERS - 1)}😀${'saved-world-水'.repeat(7000)}`
  const chunks: GameStringChunk[] = []
  const sender = new GameStringSender(value, chunk => chunks.push(chunk))
  const receiver = new GameStringReceiver(Buffer.byteLength(value))
  sender.start()
  assert.equal(chunks.length, GAME_STRING_CHUNK_WINDOW)
  assert.throws(() => sender.acknowledge(value.length), /exceeds a sent chunk/)
  let restored: string | null = null
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]!
    restored = receiver.accept(chunk)
    const end = chunk.offset + chunk.data.length
    const before = chunks.length
    sender.acknowledge(end)
    assert.equal(sender.acknowledge(end), 'stale')
    assert.ok(chunks.length <= before + 1)
  }
  assert.equal(restored, value)
  const beforeClose = chunks.length
  sender.close()
  sender.start()
  assert.equal(chunks.length, beforeClose)
})

test('partial strings reject gaps, changed lengths, oversized chunks and UTF-8 overflow', () => {
  const receiver = new GameStringReceiver(8)
  assert.throws(() => receiver.accept({ data: 'ab', offset: 1, totalLength: 4 }), /first chunk/)
  assert.equal(receiver.accept({ data: 'ab', offset: 0, totalLength: 4 }), null)
  assert.throws(() => receiver.accept({ data: 'c', offset: 3, totalLength: 4 }), /pending transfer/)
  assert.throws(() => receiver.accept({ data: 'c', offset: 2, totalLength: 5 }), /pending transfer/)
  assert.throws(() => receiver.accept({ data: '', offset: 2, totalLength: 4 }), /bounds/)
  receiver.close()
  const tiny = new GameStringReceiver(3)
  assert.throws(() => tiny.accept({ data: '水水', offset: 0, totalLength: 2 }), /at most/)
  assert.throws(() => new GameStringReceiver(2 * GAME_STRING_CHUNK_CHARACTERS).accept({ data: 'x'.repeat(GAME_STRING_CHUNK_CHARACTERS + 1),
    offset: 0, totalLength: GAME_STRING_CHUNK_CHARACTERS + 1 }), /bounds/)
})

test('welcome chunks expose one strictly decoded welcome and retain the ordered sideband prefix', () => {
  const welcome = welcomeMessage()
  const payload = encodeGameMessage(welcome)
  const receiver = new GameWelcomeReceiver()
  const wire: string[] = []
  const received: ServerWelcomeMessage[] = []
  let completed = 0
  const sender = new GameWelcomeSender(payload, value => wire.push(value), () => completed++,
    () => assert.fail('healthy welcome timed out'))
  const sideband = encodeGameMessage({ type: 'server-pong', nonce: 99 })
  try {
    sender.start()
    sender.defer(sideband)
    assert.equal(completed, 0)
    for (let index = 0; index < wire.length; index += 1) {
      const message = receiver.receivePayload(wire[index]!, payload => {
        const acknowledgement = decodeClientGameMessage(payload)
        assert.equal(acknowledgement.type, 'client-welcome-chunk-ack')
        if (acknowledgement.type === 'client-welcome-chunk-ack') {
          sender.acknowledge(acknowledgement.nextOffset)
        }
      })
      if (message === null) continue
      if (message.type === 'server-pong') {
        assert.equal(completed, 1)
        continue
      }
      assert.equal(message.type, 'server-welcome')
      if (message.type === 'server-welcome') received.push(message)
    }
    assert.deepEqual(received, [welcome])
    assert.equal(completed, 1)
    assert.equal(wire.at(-1), sideband)
    assert.throws(() => receiver.receive({ type: 'server-welcome-chunk', data: payload,
      offset: 0, totalLength: payload.length }), /after its welcome/)
  } finally {
    sender.close()
    receiver.close()
  }
})

test('only new acknowledged progress renews the five-second welcome deadline', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const wire: string[] = []
  let timedOut = 0
  let complete = 0
  const sender = new GameWelcomeSender('x'.repeat(10 * GAME_STRING_CHUNK_CHARACTERS),
    payload => wire.push(payload), () => complete++, () => timedOut++)
  sender.start()
  context.mock.timers.tick(GAME_WELCOME_PROGRESS_TIMEOUT_MS - 1000)
  sender.acknowledge(GAME_STRING_CHUNK_CHARACTERS)
  context.mock.timers.tick(GAME_WELCOME_PROGRESS_TIMEOUT_MS - 1000)
  sender.acknowledge(GAME_STRING_CHUNK_CHARACTERS)
  assert.equal(timedOut, 0)
  context.mock.timers.tick(1000)
  assert.equal(timedOut, 1)
  const count = wire.length
  sender.acknowledge(2 * GAME_STRING_CHUNK_CHARACTERS)
  assert.equal(wire.length, count)
  assert.equal(complete, 0)
})

test('cancelling a welcome releases its partial prefix and deadline without sending late state', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const wire: string[] = []
  const sender = new GameWelcomeSender('x'.repeat(8 * GAME_STRING_CHUNK_CHARACTERS),
    payload => wire.push(payload), () => assert.fail('cancelled welcome completed'),
    () => assert.fail('cancelled welcome timed out'))
  sender.start()
  sender.defer(encodeGameMessage({ type: 'server-pong', nonce: 4 }))
  sender.close()
  sender.acknowledge(GAME_STRING_CHUNK_CHARACTERS)
  context.mock.timers.tick(2 * GAME_WELCOME_PROGRESS_TIMEOUT_MS)
  assert.equal(wire.length, GAME_STRING_CHUNK_WINDOW)
  const receiver = new GameWelcomeReceiver()
  receiver.receive(decodeServerGameMessage(wire[0]!))
  receiver.close()
  assert.throws(() => receiver.receive(decodeServerGameMessage(wire[1]!)), /after its welcome/)
})

test('welcome envelopes reject malformed offsets, lengths, unknown fields and another logical message', () => {
  const valid = { type: 'server-welcome-chunk', data: '{', offset: 0, totalLength: 10 }
  for (const change of [{ data: '' }, { offset: -1 }, { offset: 10 }, { totalLength: 0 },
    { totalLength: GAME_WEBSOCKET_MAX_PAYLOAD_BYTES + 1 }, { extra: true },
    { data: 'x'.repeat(GAME_STRING_CHUNK_CHARACTERS + 1) }]) {
    assert.throws(() => decodeServerGameMessage(JSON.stringify({ ...valid, ...change })))
  }
  for (const nextOffset of [0, -1, 1.5, GAME_WEBSOCKET_MAX_PAYLOAD_BYTES + 1]) {
    assert.throws(() => decodeClientGameMessage(JSON.stringify({ type: 'client-welcome-chunk-ack', nextOffset })))
  }
  const receiver = new GameWelcomeReceiver()
  const wrong = encodeGameMessage({ type: 'server-pong', nonce: 1 })
  assert.throws(() => receiver.receive({ type: 'server-welcome-chunk', data: wrong,
    offset: 0, totalLength: wrong.length }), /another message/)
  const partial = new GameWelcomeReceiver()
  partial.receive({ ...valid, type: 'server-welcome-chunk' })
  assert.throws(() => partial.receive(welcomeMessage()), /interrupted/)
})

function welcomeMessage(): ServerWelcomeMessage {
  const character = { discipline: 'mind', displayName: 'Saved wizard', element: 'earth' } as const
  return {
    type: 'server-welcome', protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'owner', resumeToken: 'private-test-resume', serverTickRate: 100,
    snapshotRate: 20, sessionKind: 'standalone', cheatsEnabled: false,
    developerAccess: false, gameplayPause: null, gameplayResumeGrace: null,
    content: { manifestSha256: '0'.repeat(64), mods: [] }, modAssets: [], modCatalog: [],
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }], kernelParameters: { fixedTickSeconds: 0.01, movementAcceleration: 0.5,
      movementLaneCap: 5, movementRetention: 0.8, movementThresholdSquared: 0.01,
      playerRadius: 25 },
    snapshot: createGameSnapshot(createGameSimulation({ owner: character }), 'owner'),
    snapshotSequence: 1,
  }
}

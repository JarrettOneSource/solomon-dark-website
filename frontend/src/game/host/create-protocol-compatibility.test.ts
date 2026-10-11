import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { WebSocket } from 'ws'
import { failureFromServerDisconnect } from '../client/game-connection-failure.ts'
import { GAME_PROTOCOL_VERSION } from '../protocol/game-protocol-contract.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import type { ServerGameMessage } from '../protocol/game-server-messages.ts'
import { startGameHost } from './game-host.ts'

for (const type of ['client-hello', 'client-observer-hello'] as const) {
  test(`real host rejects protocol 151 ${type} before admission and requires refresh`, { timeout: 5000 }, async context => {
    assert.equal(GAME_PROTOCOL_VERSION, 152)
    let claimed = 0
    const host = await startGameHost({ authentication: { kind: 'tickets', claim: () => {
      claimed += 1
      return null
    } } })
    context.after(() => host.close())
    const socket = new WebSocket(host.address.url)
    context.after(() => socket.terminate())
    const received: ServerGameMessage[] = []
    socket.on('message', payload => received.push(decodeServerGameMessage(payload.toString())))
    await once(socket, 'open')
    const closed = once(socket, 'close')
    socket.send(encodeGameMessage(type === 'client-observer-hello'
      ? { type, credential: 'fixture-old-client', protocolVersion: 151 }
      : { type, credential: 'fixture-old-client', protocolVersion: 151,
          character: { discipline: 'arcane', displayName: 'OldMage', element: 'ether' },
          cheatsEnabled: false, enhancedEffects: true,
          profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
          onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
        }))
    const [closeCode, closeReason] = await closed
    assert.equal(closeCode, 1008)
    assert.equal(String(closeReason), 'Protocol 152 is required.')
    assert.deepEqual(received, [{ type: 'server-disconnect', code: 'protocol-mismatch', reason: 'Protocol 152 is required.' }])
    const disconnect = received[0]!
    assert.equal(disconnect.type, 'server-disconnect')
    if (disconnect.type !== 'server-disconnect') throw new Error('expected protocol rejection')
    const failure = failureFromServerDisconnect(disconnect.code, disconnect.reason)
    assert.equal(failure.code, 'protocol-mismatch')
    assert.match(failure.message, /Refresh the page and try again/)
    assert.equal(claimed, 0, 'old clients cannot consume even a one-use admission ticket')
    assert.equal(host.capacityParticipantCount(), 0)
    assert.equal(host.state().playerEntities.identities.length, 0)
    context.diagnostic(JSON.stringify({ type, sentVersion: 151, requiredVersion: 152,
      received, closeCode, closeReason: String(closeReason), claimed,
      participantCount: host.capacityParticipantCount(), explanation: failure.message }))
  })
}

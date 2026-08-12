import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
} from '../protocol/game-protocol.ts'
import { startHubHost } from './hub-host.ts'

test('authoritative Hub host authenticates two clients and owns their movement', async (context) => {
  const host = await startHubHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret')
  const second = await join(host.address.url, 'test-secret')
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  assert.notEqual(first.welcome.playerId, second.welcome.playerId)
  assert.equal(host.playerCount(), 2)
  const firstOrigin = first.welcome.snapshot.players[first.welcome.playerId].position.x
  const secondOrigin = second.welcome.snapshot.players[second.welcome.playerId].position.x
  assert.equal(firstOrigin, HUB_SPAWN.x)
  assert.equal(secondOrigin, HUB_SPAWN.x)
  first.socket.send(encodeGameMessage({
    type: 'client-input',
    input: { x: 1, y: 0 },
    sequence: 1,
    targetTick: first.welcome.snapshot.tick + 1,
  }))
  const snapshot = await nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.acknowledgedInputSequence === 1
    && message.snapshot.players[first.welcome.playerId].position.x > firstOrigin
  ))
  assert.equal(snapshot.type, 'server-snapshot')
  assert.ok(snapshot.snapshot.players[first.welcome.playerId].position.x > firstOrigin)
  assert.deepEqual(snapshot.snapshot.players[second.welcome.playerId].velocity, { x: 0, y: 0 })
  assert.equal(second.welcome.snapshot.players[second.welcome.playerId].position.x, secondOrigin)
})

test('Hub host reconnects the first active player at the authored spawn', async (context) => {
  const host = await startHubHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
  context.after(() => host.close())

  const first = await join(host.address.url, 'test-secret')
  assert.deepEqual(first.welcome.snapshot.players[first.welcome.playerId].position, HUB_SPAWN)
  await closeSocket(first.socket)
  assert.equal(host.playerCount(), 0)

  const reconnected = await join(host.address.url, 'test-secret')
  context.after(() => reconnected.socket.close())
  assert.notEqual(reconnected.welcome.playerId, first.welcome.playerId)
  assert.deepEqual(
    reconnected.welcome.snapshot.players[reconnected.welcome.playerId].position,
    HUB_SPAWN,
  )

  reconnected.socket.send(encodeGameMessage({
    type: 'client-input',
    input: { x: 1, y: 0 },
    sequence: 1,
    targetTick: reconnected.welcome.snapshot.tick + 1,
  }))
  const snapshot = await nextMessage(reconnected.socket, (message) => (
    message.type === 'server-snapshot'
    && message.acknowledgedInputSequence === 1
    && message.snapshot.players[reconnected.welcome.playerId].position.x > HUB_SPAWN.x
  ))
  assert.equal(snapshot.type, 'server-snapshot')
})

test('Hub host rejects arbitrary origins and invalid bootstrap credentials', async (context) => {
  const host = await startHubHost({ bootstrapCredential: 'test-secret' })
  context.after(() => host.close())

  await assert.rejects(() => openSocket(host.address.url, 'https://evil.example'))
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  socket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'wrong-secret',
  }))
  const message = await nextMessage(socket, (entry) => entry.type === 'server-disconnect')
  assert.deepEqual(message, {
    type: 'server-disconnect',
    code: 'authentication-failed',
    reason: 'The session credential is invalid.',
  })
})

test('Hub host is loopback-only by default and requires a trusted proxy plus origins', async () => {
  await assert.rejects(() => startHubHost({
    bootstrapCredential: 'test-secret',
    host: '0.0.0.0',
  }), /trusted secure proxy/)
  await assert.rejects(() => startHubHost({
    bootstrapCredential: 'test-secret',
    host: '0.0.0.0',
    trustedProxy: true,
  }), /nonempty allowedOrigins/)
})

test('Hub host rejects intent targeting implausibly far-future ticks', async (context) => {
  const host = await startHubHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret')
  context.after(() => client.socket.close())
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: { x: 1, y: 0 },
    sequence: 1,
    targetTick: client.welcome.snapshot.tick + 1000,
  }))
  const message = await nextMessage(client.socket, (entry) => entry.type === 'server-disconnect')
  assert.equal(message.type, 'server-disconnect')
  assert.equal(message.code, 'invalid-message')
})

test('Hub host applies only the newest intent queued for a simulation tick', async (context) => {
  const host = await startHubHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret')
  context.after(() => client.socket.close())
  const origin = client.welcome.snapshot.players[client.welcome.playerId].position
  const targetTick = client.welcome.snapshot.tick + 1
  client.socket.send(encodeGameMessage({
    type: 'client-input', input: { x: 1, y: 0 }, sequence: 1, targetTick,
  }))
  client.socket.send(encodeGameMessage({
    type: 'client-input', input: { x: 0, y: 1 }, sequence: 2, targetTick,
  }))
  const message = await nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 2
  ))
  assert.equal(message.type, 'server-snapshot')
  const player = message.snapshot.players[client.welcome.playerId]
  assert.equal(player.position.x, origin.x)
  assert.ok(player.position.y > origin.y)
})

async function join(url: string, credential: string) {
  const socket = await openSocket(url)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
  }))
  const welcome = await nextMessage(socket, (message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { socket, welcome }
}

function closeSocket(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve()
      return
    }
    socket.once('close', resolve)
    socket.close(1000, 'test disconnect')
  })
}

function openSocket(url: string, origin?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, origin ? { origin } : undefined)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
    socket.once('unexpected-response', (_request, response) => {
      reject(new Error(`upgrade rejected with ${response.statusCode}`))
    })
  })
}

function nextMessage(
  socket: WebSocket,
  predicate: (message: ServerGameMessage) => boolean,
): Promise<ServerGameMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game message'))
    }, 3000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (!predicate(message)) return
      cleanup()
      resolve(message)
    }
    const fail = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

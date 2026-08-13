import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameClientSessionOptions } from './client/game-client-session.ts'
import type { GameTransport } from './client/game-transport.ts'
import { bootGame } from './engine.ts'

const inertTransport: GameTransport = {
  readyState: 'open',
  close() {},
  onClose: () => () => {},
  onMessage: () => () => {},
  send() {},
}
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('bootGame accepts a separate localhost server and routes through the shared connector', async () => {
  let connected: GameClientSessionOptions | undefined
  const session = { playerId: 'p', resumeToken: 'r', destroy() {}, getSnapshot() { throw new Error() }, onSnapshot: () => () => {}, sendInput() {} }
  const result = await bootGame({
    character: CHARACTER,
    endpoint: {
      kind: 'localhost',
      url: 'ws://127.0.0.1:1234/game',
      credential: 'secret',
    },
    transportFactory: async () => inertTransport,
    sessionConnector: async (options) => {
      connected = options
      return session
    },
  })
  assert.equal(result, session)
  assert.equal(connected?.credential, 'secret')
  assert.deepEqual(connected?.character, CHARACTER)
})

test('bootGame bans website remote sessions from local and plaintext endpoints', async () => {
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    endpoint: { kind: 'remote', url: 'ws://127.0.0.1:1234/game', credential: 'x' },
  }), /private networks/)
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    endpoint: { kind: 'remote', url: 'ws://game.example.test/game', credential: 'x' },
  }), /must use wss/)
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    endpoint: { kind: 'remote', url: 'wss://127.12.34.56/game', credential: 'x' },
  }), /private networks/)
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    endpoint: { kind: 'remote', url: 'wss://game.local/game', credential: 'x' },
  }), /private networks/)
})

test('bootGame accepts any numeric IPv4 loopback address for a desktop-local server', async () => {
  const session = { playerId: 'p', resumeToken: 'r', destroy() {}, getSnapshot() { throw new Error() }, onSnapshot: () => () => {}, sendInput() {} }
  const result = await bootGame({
    character: CHARACTER,
    endpoint: { kind: 'localhost', url: 'ws://127.12.34.56:1234/game', credential: 'x' },
    transportFactory: async () => inertTransport,
    sessionConnector: async () => session,
  })
  assert.equal(result, session)
})

test('bootGame rejects non-loopback addresses presented as desktop-local servers', async () => {
  await assert.rejects(() => bootGame({
    character: CHARACTER,
    endpoint: { kind: 'localhost', url: 'ws://192.168.1.20:1234/game', credential: 'x' },
  }), /loopback/)
})

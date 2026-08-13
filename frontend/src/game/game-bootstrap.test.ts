import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cancelGameLobby,
  decodeCreatedGameLobby,
  decodeProvisionedGameEndpoint,
  parseGameLobbyId,
} from './game-bootstrap.ts'

test('browser provisioning accepts only a credentialed public WSS endpoint', () => {
  assert.deepEqual(decodeProvisionedGameEndpoint({
    kind: 'remote',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'private-session-credential',
  }), {
    kind: 'remote',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'private-session-credential',
  })

  assert.throws(() => decodeProvisionedGameEndpoint({
    kind: 'remote',
    url: 'ws://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'private-session-credential',
  }), /invalid endpoint/)
  assert.throws(() => decodeProvisionedGameEndpoint({
    kind: 'localhost',
    url: 'ws://127.0.0.1:5222/game',
    credential: 'private-session-credential',
  }), /invalid endpoint/)
  assert.throws(() => decodeProvisionedGameEndpoint({
    kind: 'remote',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: '',
  }), /invalid endpoint/)
})

test('browser lobby creation retains only an opaque id and credentialed endpoint', () => {
  assert.deepEqual(decodeCreatedGameLobby({
    lobbyId: '01234567890123456789012345678901',
    kind: 'remote',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'reserved-host-credential',
  }), {
    lobbyId: '01234567890123456789012345678901',
    endpoint: {
      kind: 'remote',
      url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
      credential: 'reserved-host-credential',
    },
  })

  assert.equal(parseGameLobbyId('01234567890123456789012345678901'),
    '01234567890123456789012345678901')
  assert.equal(parseGameLobbyId('../launcher-lobby'), null)
  assert.equal(parseGameLobbyId('short'), null)
  assert.throws(() => decodeCreatedGameLobby({
    lobbyId: '../launcher-lobby',
    kind: 'remote',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'reserved-host-credential',
  }), /invalid lobby/)
})

test('cancelling an already-expired browser lobby is complete', async () => {
  const lobbyId = '01234567890123456789012345678901'
  await cancelGameLobby({
    lobbyId,
    endpoint: {
      kind: 'remote',
      url: `wss://solomondarker.com/game-sessions/${lobbyId}`,
      credential: 'reserved-host-credential',
    },
  }, async (input, init) => {
    assert.equal(input, `/api/game/lobbies/${lobbyId}`)
    assert.ok(init)
    assert.equal(init.method, 'DELETE')
    assert.equal(
      (init.headers as Record<string, string>)['x-solomon-dark-host-credential'],
      'reserved-host-credential',
    )
    return new Response('{"error":"gone"}', {
      headers: { 'content-type': 'application/json' },
      status: 404,
    })
  })
})

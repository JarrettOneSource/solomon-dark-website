import assert from 'node:assert/strict'
import test from 'node:test'

import {
  admitSharedHubPlayer,
  decodeProvisionedGameEndpoint,
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

test('browser New Game requests a shared-Hub admission without lobby identity', async () => {
  const endpoint = await admitSharedHubPlayer(async (input, init) => {
    assert.equal(input, '/api/game/hub')
    assert.ok(init)
    assert.equal(init.method, 'POST')
    assert.equal(
      (init.headers as Record<string, string>)['x-solomon-dark-session'],
      'enter-hub',
    )
    return new Response(JSON.stringify({
      kind: 'remote',
      url: 'wss://solomondarker.com/game-hub',
      credential: 'single-use-hub-ticket',
    }), {
      headers: { 'content-type': 'application/json' },
      status: 201,
    })
  })
  assert.deepEqual(endpoint, {
    kind: 'remote',
    url: 'wss://solomondarker.com/game-hub',
    credential: 'single-use-hub-ticket',
  })
})

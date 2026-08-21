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

test('signed-in New Game carries account identity into its shared-Hub admission', async () => {
  const endpoint = await admitSharedHubPlayer('account-token', async (input, init) => {
    assert.equal(input, '/api/game/hub')
    assert.ok(init)
    assert.equal(init.method, 'POST')
    const headers = new Headers(init.headers)
    assert.equal(
      headers.get('x-solomon-dark-session'),
      'enter-hub',
    )
    assert.equal(headers.get('authorization'), 'Bearer account-token')
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

test('guest New Game keeps shared-Hub admission anonymous', async () => {
  await admitSharedHubPlayer(null, async (_input, init) => {
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('authorization'), null)
    return new Response(JSON.stringify({
      kind: 'remote',
      url: 'wss://solomondarker.com/game-hub',
      credential: 'anonymous-hub-ticket',
    }), {
      headers: { 'content-type': 'application/json' },
      status: 201,
    })
  })
})

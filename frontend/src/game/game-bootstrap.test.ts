import assert from 'node:assert/strict'
import test from 'node:test'

import {
  admitBrowserGame,
  admitGameObserver,
  admitPartyRejoin,
  admitPartyJoin,
  admitSharedHubPlayer,
  decodeProvisionedGameEndpoint,
} from './game-bootstrap.ts'

test('browser provisioning accepts only a credentialed public WSS endpoint', () => {
  assert.deepEqual(decodeProvisionedGameEndpoint({
    kind: 'remote',
    sessionKind: 'private-college',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'private-session-credential',
  }), {
    kind: 'remote',
    sessionKind: 'private-college',
    url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    credential: 'private-session-credential',
  })

  assert.throws(() => decodeProvisionedGameEndpoint({
    kind: 'remote',
    sessionKind: 'private-college',
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
    sessionKind: 'private-college',
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
      sessionKind: 'global-hub',
      url: 'wss://solomondarker.com/game-hub',
      credential: 'single-use-hub-ticket',
    }), {
      headers: { 'content-type': 'application/json' },
      status: 201,
    })
  })
  assert.deepEqual(endpoint, {
    kind: 'remote',
    sessionKind: 'global-hub',
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
      sessionKind: 'global-hub',
      url: 'wss://solomondarker.com/game-hub',
      credential: 'anonymous-hub-ticket',
    }), {
      headers: { 'content-type': 'application/json' },
      status: 201,
    })
  })
})

test('party admission is authenticated when available and preserves the resolved session kind', async () => {
  const endpoint = await admitPartyJoin('intent-12345678', 'account-token', async (input, init) => {
    assert.equal(input, '/api/game/join/admit')
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('authorization'), 'Bearer account-token')
    assert.deepEqual(JSON.parse(String(init?.body)), { intentId: 'intent-12345678' })
    return new Response(JSON.stringify({
      credential: 'party-ticket',
      kind: 'remote',
      sessionKind: 'private-college',
      url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    }), { status: 201 })
  })
  assert.equal(endpoint.sessionKind, 'private-college')
})

test('Last Game claims an active-party slot before ordinary admission and falls back only when inactive', async () => {
  const requests: string[] = []
  const endpoint = await admitBrowserGame({
    fallback: 'global-hub',
    kind: 'resume',
    partyRejoinToken: 'R'.repeat(43),
  }, 'account-token', async (input) => {
    requests.push(String(input))
    if (input === '/api/game/rejoin') {
      return new Response(JSON.stringify({ error: 'That active party run has ended.' }), {
        status: 404,
      })
    }
    return new Response(JSON.stringify({
      credential: 'ordinary-hub-ticket',
      kind: 'remote',
      sessionKind: 'global-hub',
      url: 'wss://solomondarker.com/game-hub',
    }), { status: 201 })
  })
  assert.deepEqual(requests, ['/api/game/rejoin', '/api/game/hub'])
  assert.equal(endpoint.sessionKind, 'global-hub')

  await assert.rejects(
    () => admitBrowserGame({
      fallback: 'private-college',
      kind: 'resume',
      partyRejoinToken: 'S'.repeat(43),
    }, null, async (input) => {
      assert.equal(input, '/api/game/rejoin')
      return new Response(JSON.stringify({ error: 'That rejoin is already being claimed.' }), {
        status: 409,
      })
    }),
    /already being claimed/i,
  )
})

test('active-party admission is authenticated and carries only the opaque saved capability', async () => {
  const token = 'T'.repeat(43)
  const endpoint = await admitPartyRejoin(token, 'account-token', async (input, init) => {
    assert.equal(input, '/api/game/rejoin')
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer account-token')
    assert.deepEqual(JSON.parse(String(init?.body)), { token })
    return new Response(JSON.stringify({
      credential: 'active-party-ticket',
      kind: 'remote',
      sessionKind: 'private-college',
      url: 'wss://solomondarker.com/game-sessions/01234567890123456789012345678901',
    }), { status: 201 })
  })
  assert.equal(endpoint.sessionKind, 'private-college')
})

test('developer observer admission is explicit, authenticated, and read-only typed', async () => {
  const endpoint = await admitGameObserver(
    'match-safe-observer-7',
    'developer-token',
    async (input, init) => {
      assert.equal(input, '/api/game/observe')
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('authorization'), 'Bearer developer-token')
      assert.deepEqual(JSON.parse(String(init?.body)), { matchId: 'match-safe-observer-7' })
      return new Response(JSON.stringify({
        credential: 'observer-ticket',
        kind: 'remote',
        observer: true,
        sessionKind: 'global-hub',
        url: 'wss://solomondarker.com/game-hub',
      }), { status: 201 })
    },
  )
  assert.deepEqual(endpoint, {
    credential: 'observer-ticket',
    kind: 'remote',
    observer: true,
    sessionKind: 'global-hub',
    url: 'wss://solomondarker.com/game-hub',
  })
})

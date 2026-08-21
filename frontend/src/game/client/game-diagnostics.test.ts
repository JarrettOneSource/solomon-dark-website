import assert from 'node:assert/strict'
import test from 'node:test'

import { GAME_PROTOCOL_VERSION } from '../protocol/game-protocol.ts'
import { GameConnectionFailure } from './game-connection-failure.ts'
import {
  createGameClientDiagnostics,
  submitBrowserGameDiagnostics,
} from './game-diagnostics.ts'

test('client diagnostics keep a bounded chronological log and a correlated failure', () => {
  let now = Date.parse('2026-08-15T20:00:00.000Z')
  const diagnostics = createGameClientDiagnostics({
    clientLogId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    maximumEntries: 3,
    now: () => new Date(now),
    writeToConsole: false,
  })

  diagnostics.info('connection.starting', 'Opening the game connection.')
  now += 1_000
  diagnostics.warning('network.slow', 'The last server reply was slow.', '1,250 ms')
  now += 1_000
  diagnostics.info('connection.ready', 'The game connection is ready.')
  now += 1_000
  diagnostics.error('connection.closed', 'The game connection closed.', 'close code 1006')

  const failure = new GameConnectionFailure({
    code: 'connection-lost',
    explanation: 'The network connection or the game server stopped responding.',
    technicalDetail: 'WebSocket closed with code 1006.',
    transport: { code: 1006, reason: '', wasClean: false },
  })
  const report = diagnostics.createReport(failure, {
    online: true,
    pageUrl: 'https://solomondarker.com/game',
    sessionId: '01234567890123456789012345678901',
    userAgent: 'Contract Browser',
  })

  assert.equal(report.protocolVersion, GAME_PROTOCOL_VERSION)
  assert.equal(report.droppedEntries, 1)
  assert.deepEqual(report.entries.map((entry) => entry.event), [
    'network.slow',
    'connection.ready',
    'connection.closed',
  ])
  assert.equal(report.failure?.code, 'connection-lost')
  assert.equal(report.failure?.transportCode, 1006)
  assert.equal(JSON.stringify(report).includes('credential'), false)
})

test('browser diagnostic submission is explicit and authenticated when possible', async () => {
  const report = createGameClientDiagnostics({
    clientLogId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    writeToConsole: false,
  }).createReport(null, {
    online: true,
    pageUrl: 'https://solomondarker.com/game',
    sessionId: null,
    userAgent: 'Contract Browser',
  })
  let requestedUrl = ''
  let requestedInit: RequestInit | undefined

  const receipt = await submitBrowserGameDiagnostics(report, {
    request: async (url, init) => {
      requestedUrl = String(url)
      requestedInit = init
      return new Response(JSON.stringify({
        logId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        submittedAtUtc: '2026-08-15T20:01:00Z',
      }), {
        headers: { 'content-type': 'application/json' },
        status: 201,
      })
    },
    token: 'website-token',
  })

  assert.equal(requestedUrl, '/api/game/diagnostics')
  assert.equal(requestedInit?.method, 'POST')
  const headers = new Headers(requestedInit?.headers)
  assert.equal(headers.get('authorization'), 'Bearer website-token')
  assert.equal(headers.get('x-solomon-dark-diagnostics'), 'browser-game')
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), report)
  assert.equal(receipt.logId, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
})

test('shared Hub diagnostics retain a stable noncredential session label', () => {
  const diagnostics = createGameClientDiagnostics({ writeToConsole: false })
  diagnostics.setEndpoint('wss://solomondarker.com/game-hub')
  const report = diagnostics.createReport(null)
  assert.equal(report.sessionId, 'shared-hub')
})

test('browser diagnostic submission surfaces the server explanation', async () => {
  const report = createGameClientDiagnostics({ writeToConsole: false }).createReport(null, {
    online: false,
    pageUrl: 'https://solomondarker.com/game',
    sessionId: null,
    userAgent: 'Contract Browser',
  })

  await assert.rejects(() => submitBrowserGameDiagnostics(report, {
    request: async () => new Response(
      JSON.stringify({ error: 'Too many log uploads; try again later.' }),
      { status: 429 },
    ),
  }), /Too many log uploads/)
})

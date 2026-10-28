import assert from 'node:assert/strict'
import test from 'node:test'

import {
  GameConnectionFailure,
  failureFromServerDisconnect,
  failureFromTransportAttempt,
  failureFromTransportClose,
} from './game-connection-failure.ts'
import {
  GAME_SESSION_REPLACED_CLOSE_CODE,
} from '../protocol/game-protocol-contract.ts'

test('server disconnects retain the authoritative detail and add a plain-English explanation', () => {
  const failure = failureFromServerDisconnect(
    'server-full',
    'The session is reserving its final seat for the host.',
  )

  assert.equal(failure.code, 'server-full')
  assert.equal(failure.message, 'This game session has no open player slots.')
  assert.equal(
    failure.technicalDetail,
    'The session is reserving its final seat for the host.',
  )
})

test('transport timeouts, restarts, and abnormal losses have distinct explanations', () => {
  const timeout = failureFromTransportClose({
    code: 4000,
    reason: 'connection timed out',
    wasClean: true,
  })
  assert.equal(timeout.code, 'connection-timeout')
  assert.match(timeout.message, /connection stopped responding.*main menu to reconnect/i)

  const restart = failureFromTransportClose({
    code: 1012,
    reason: 'server shutdown',
    wasClean: true,
  })
  assert.equal(restart.code, 'server-restart')
  assert.match(restart.message, /restarted|shut down/i)

  const updating = failureFromTransportClose({
    code: 1012,
    reason: 'game updating',
    wasClean: true,
  })
  assert.equal(updating.code, 'server-restart')
  assert.equal(
    updating.message,
    'Solomon Dark is updating. Your saved game will resume after the app restarts.',
  )

  const hostEnded = failureFromTransportClose({
    code: 4001,
    reason: 'host ended session',
    wasClean: true,
  })
  assert.equal(hostEnded.code, 'session-ended')
  assert.match(hostEnded.message, /hosting.*ended/i)

  const replaced = failureFromTransportClose({
    code: GAME_SESSION_REPLACED_CLOSE_CODE,
    reason: 'wizard resumed in another browser',
    wasClean: true,
  })
  assert.equal(replaced.code, 'session-ended')
  assert.equal(replaced.message, 'This wizard resumed in another browser tab.')

  const abnormal = failureFromTransportClose({
    code: 1006,
    reason: '',
    wasClean: false,
  })
  assert.equal(abnormal.code, 'connection-lost')
  assert.match(abnormal.message, /network connection.*server/i)
  assert.match(abnormal.technicalDetail ?? '', /1006/)
})

test('unknown client failures stay useful without inventing a server cause', () => {
  const failure = GameConnectionFailure.from(
    new Error('The welcome snapshot omitted player-7.'),
  )

  assert.equal(failure.code, 'client-error')
  assert.equal(failure.message, 'The welcome snapshot omitted player-7.')
  assert.equal(failure.technicalDetail, null)
})

test('a peer going away does not assert that the game server restarted', () => {
  for (const reason of ['', 'proxy reloaded']) {
    const closed = { code: 1001, reason, wasClean: true }
    for (const failure of [
      failureFromTransportClose(closed),
      failureFromTransportAttempt('wss://solomondarker.com/game-hub', closed),
    ]) {
      assert.equal(failure.code, 'connection-lost')
      assert.equal(failure.message, 'The connection to the game server ended unexpectedly.')
      assert.deepEqual(failure.transport, closed)
      assert.equal(failure.technicalDetail,
        `WebSocket closed with code 1001 (clean)${reason ? `: ${reason}` : '.'}`)
    }
  }
})

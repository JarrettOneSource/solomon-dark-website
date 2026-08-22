import assert from 'node:assert/strict'
import test from 'node:test'

import { directoryPartyAction } from './party-directory.ts'

test('directory action follows authoritative visibility and run state', () => {
  assert.equal(directoryPartyAction({ status: 'hub', visibility: 'public' }), 'join')
  assert.equal(directoryPartyAction({ status: 'hub', visibility: 'invite-only' }), 'request')
  assert.equal(directoryPartyAction({ status: 'playing', visibility: 'public' }), 'wait')
})

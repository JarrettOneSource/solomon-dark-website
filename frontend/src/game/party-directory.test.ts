import assert from 'node:assert/strict'
import test from 'node:test'

import {
  directoryPartyAction,
  directoryPartyPresentation,
} from './party-directory.ts'

test('directory action follows authoritative visibility and run state', () => {
  assert.equal(directoryPartyAction({ status: 'hub', visibility: 'public' }), 'join')
  assert.equal(directoryPartyAction({ status: 'hub', visibility: 'invite-only' }), 'request')
  assert.equal(directoryPartyAction({ status: 'playing', visibility: 'public' }), 'wait')
  assert.equal(directoryPartyAction({ status: 'playing', visibility: 'invite-only' }), 'wait')
})

test('directory presentation names the authoritative location and squad in every state', () => {
  assert.deepEqual(directoryPartyPresentation({
    boneyardName: null,
    maxMembers: 16,
    memberCount: 2,
    status: 'hub',
  }), {
    location: 'COLLEGE COURTYARD',
    squad: '2 / 16',
    status: 'IN HUB',
  })
  assert.deepEqual(directoryPartyPresentation({
    boneyardName: 'The Survival Grounds',
    maxMembers: 8,
    memberCount: 3,
    status: 'playing',
  }), {
    location: 'The Survival Grounds',
    squad: '3 / 8',
    status: 'IN GAME',
  })
})

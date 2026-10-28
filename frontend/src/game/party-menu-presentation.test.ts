import assert from 'node:assert/strict'
import test from 'node:test'

import { WIZARD_ELEMENTS } from './core-kernels/player-character.ts'
import { PLAYER_LIFE_STATES } from './core-kernels/player-combat.ts'
import {
  PARTY_MENU_VISIBILITY_OPTIONS,
  partyMenuLeaveLabel,
  partyMenuModel,
  partyMenuVisibility,
} from './party-menu-presentation.ts'
import type { LocalPartyState, PartyRosterPlayer } from './protocol/party-state.ts'

function rosterPlayer(playerId: string, displayName: string, connected = true): PartyRosterPlayer {
  return {
    connected,
    currentHealth: 10,
    displayName,
    element: WIZARD_ELEMENTS[0]!,
    lifeState: PLAYER_LIFE_STATES[0]!,
    maximumHealth: 10,
    playerId,
  }
}

function partyState(overrides: Partial<LocalPartyState> = {}): LocalPartyState {
  return {
    hubPlayers: [
      { accountUsername: 'ann', displayName: 'Ann', highestWave: null, playerId: 'p1', totalPlaytimeMs: null },
    ],
    invitations: [],
    joinRequests: [
      { id: 'r1', requester: { accountUsername: null, displayName: 'Zed', requesterId: 'p9' } },
    ],
    party: {
      id: 'party-1',
      joinCode: 'ABC123',
      leaderPlayerId: 'p1',
      listingId: 'listing-1',
      memberPlayerIds: ['p1', 'p2', 'p3'],
      visibility: 'invite-only',
    },
    partyRoster: [rosterPlayer('p1', 'Ann'), rosterPlayer('p2', 'Bob', false)],
    revision: 1,
    ...overrides,
  }
}

test('the leader sees the join code, the requests and kick controls for everyone else', () => {
  const model = partyMenuModel(partyState(), 'p1', 'global-hub')
  assert.equal(model.leader, true)
  assert.equal(model.code, 'ABC123')
  assert.equal(model.leaveLabel, 'LEAVE PARTY')
  assert.equal(model.visibility, 'invite-only')
  assert.equal(model.visibilityOptions, PARTY_MENU_VISIBILITY_OPTIONS)
  assert.deepEqual(model.requests, [{ id: 'r1', name: 'Zed' }])
  assert.deepEqual(model.members, [
    { id: 'p1', name: 'Ann', removable: false, tags: ['you', 'leader'] },
    { id: 'p2', name: 'Bob', removable: true, tags: ['offline'] },
    { id: 'p3', name: 'p3', removable: true, tags: [] },
  ])
})

test('a plain member sees no code, no requests and no kick controls', () => {
  const model = partyMenuModel(partyState(), 'p2', 'global-hub')
  assert.equal(model.leader, false)
  assert.equal(model.code, null)
  assert.deepEqual(model.requests, [])
  assert.deepEqual(model.members.map(member => member.removable), [false, false, false])
  assert.deepEqual(model.members.map(member => member.tags), [['leader'], ['you', 'offline'], []])
})

test('display names prefer the hub roster, then the party roster, then the id', () => {
  const state = partyState({
    hubPlayers: [
      { accountUsername: null, displayName: 'Hub Ann', highestWave: null, playerId: 'p1', totalPlaytimeMs: null },
    ],
  })
  const names = partyMenuModel(state, 'p1', 'global-hub').members.map(member => member.name)
  assert.deepEqual(names, ['Hub Ann', 'Bob', 'p3'])
})

test('the leave button follows the old dialog rule', () => {
  assert.equal(partyMenuLeaveLabel(1, 'global-hub'), null)
  assert.equal(partyMenuLeaveLabel(1, 'standalone'), null)
  assert.equal(partyMenuLeaveLabel(2, 'global-hub'), 'LEAVE PARTY')
  assert.equal(partyMenuLeaveLabel(1, 'private-college'), 'LEAVE COLLEGE')
  const solo = partyState({
    party: { ...partyState().party, memberPlayerIds: ['p1'] },
  })
  assert.equal(partyMenuModel(solo, 'p1', 'global-hub').leaveLabel, null)
  assert.equal(partyMenuModel(solo, 'p1', 'private-college').leaveLabel, 'LEAVE COLLEGE')
})

test('visibility options keep the protocol order and only protocol ids parse back', () => {
  assert.deepEqual(PARTY_MENU_VISIBILITY_OPTIONS, [
    { id: 'public', label: 'PUBLIC' },
    { id: 'invite-only', label: 'INVITE ONLY' },
    { id: 'private', label: 'PRIVATE' },
  ])
  assert.equal(partyMenuVisibility('public'), 'public')
  assert.equal(partyMenuVisibility('invite-only'), 'invite-only')
  assert.equal(partyMenuVisibility('friends'), null)
})

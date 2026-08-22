import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acceptPartyInvitation,
  createPartySystem,
  decidePartyJoinRequest,
  denyPartyInvitation,
  invitePartyPlayer,
  joinPartyPlayer,
  kickPartyPlayer,
  leaveParty,
  partyByJoinCode,
  partyByListingId,
  partyForPlayer,
  projectPartyState,
  registerPartyPlayer,
  removePartyPlayer,
  requestPartyJoin,
  rotatePartyJoinCode,
  setPartyVisibility,
  type PartyIdentity,
  type PartySystemState,
} from './party-system.ts'

test('every connected player starts as leader of an opaque private singleton', () => {
  let state = players('player-a', 'player-b')
  assert.deepEqual(partyForPlayer(state, 'player-a'), {
    ...identity('player-a'),
    leaderPlayerId: 'player-a',
    memberPlayerIds: ['player-a'],
    visibility: 'private',
  })
  assert.equal(partyByJoinCode(state, 'CODE-player-a')?.leaderPlayerId, 'player-a')
  assert.equal(partyByListingId(state, 'LIST-player-b')?.leaderPlayerId, 'player-b')
})

test('invite and recipient acceptance atomically replace the singleton party', () => {
  let state = players('player-a', 'player-b', 'player-c')
  const invited = invitePartyPlayer(state, 'player-a', 'player-b', 4)
  assert.equal(invited.accepted, true)
  state = invited.state
  assert.equal(invitePartyPlayer(state, 'player-a', 'player-b', 4).reason, 'already-invited')
  assert.equal(invitePartyPlayer(state, 'player-a', 'player-a', 4).reason, 'self-invite')
  const invitation = state.invitations[0]!
  assert.equal(acceptPartyInvitation(state, 'player-c', invitation.id, 4).reason, 'not-recipient')
  state = acceptPartyInvitation(state, 'player-b', invitation.id, 4).state
  assert.deepEqual(partyForPlayer(state, 'player-a')?.memberPlayerIds, ['player-a', 'player-b'])
  assert.equal(partyForPlayer(state, 'player-b')?.id, identity('player-a').id)
  assert.equal(state.parties.some(({ id }) => id === identity('player-b').id), false)
  assert.deepEqual(state.invitations, [])
  assert.equal(invitePartyPlayer(state, 'player-b', 'player-c', 4).reason, 'not-leader')
})

test('direct joins, leave, and leader kick create fresh private singletons', () => {
  let state = players('player-a', 'player-b', 'player-c')
  state = joinPartyPlayer(state, 'player-b', identity('player-a').id, 3).state
  assert.equal(joinPartyPlayer(state, 'player-c', identity('player-a').id, 2).reason, 'party-full')

  state = leaveParty(state, 'player-b', identity('player-b-left')).state
  assert.equal(partyForPlayer(state, 'player-b')?.id, identity('player-b-left').id)
  state = joinPartyPlayer(state, 'player-b', identity('player-a').id, 3).state
  state = kickPartyPlayer(
    state,
    'player-a',
    'player-b',
    identity('player-b-kicked'),
  ).state
  assert.equal(partyForPlayer(state, 'player-b')?.id, identity('player-b-kicked').id)
  assert.equal(kickPartyPlayer(state, 'player-a', 'player-a', identity('nope')).reason, 'self-kick')
})

test('disconnect retires access state and deterministically promotes the earliest member', () => {
  let state = players('player-a', 'player-b', 'player-c')
  state = joinPartyPlayer(state, 'player-b', identity('player-a').id, 4).state
  state = setPartyVisibility(state, 'player-a', 'invite-only').state
  state = requestPartyJoin(state, identity('player-a').id, {
    id: 'request-1',
    requester: requester('external'),
  }, 4).state
  state = removePartyPlayer(state, 'player-a')
  assert.equal(partyForPlayer(state, 'player-b')?.leaderPlayerId, 'player-b')
  assert.equal(state.joinRequests.length, 1)
  state = removePartyPlayer(state, 'player-b')
  assert.equal(state.joinRequests.length, 0)
})

test('visibility, join-code rotation, and requests are leader-owned and bounded', () => {
  let state = players('player-a', 'player-b')
  assert.equal(requestPartyJoin(state, identity('player-a').id, {
    id: 'request-private',
    requester: requester('guest'),
  }, 4).reason, 'party-private')
  assert.equal(setPartyVisibility(state, 'player-b', 'public').accepted, true)
  assert.equal(setPartyVisibility(state, 'player-b', 'public').state.parties[1]?.visibility, 'public')

  state = setPartyVisibility(state, 'player-a', 'invite-only').state
  const requested = requestPartyJoin(state, identity('player-a').id, {
    id: 'request-1',
    requester: requester('guest'),
  }, 4)
  assert.equal(requested.accepted, true)
  state = requested.state
  assert.equal(requestPartyJoin(state, identity('player-a').id, {
    id: 'request-2',
    requester: requester('guest'),
  }, 4).reason, 'already-requested')
  assert.equal(decidePartyJoinRequest(state, 'player-b', 'request-1').reason, 'not-leader')
  state = decidePartyJoinRequest(state, 'player-a', 'request-1').state
  assert.deepEqual(state.joinRequests, [])

  state = rotatePartyJoinCode(state, 'player-a', 'NEWW-CODE').state
  assert.equal(partyForPlayer(state, 'player-a')?.joinCode, 'NEWW-CODE')
  state = requestPartyJoin(state, identity('player-a').id, {
    id: 'request-3',
    requester: requester('guest-2'),
  }, 4).state
  state = setPartyVisibility(state, 'player-a', 'private').state
  assert.deepEqual(state.joinRequests, [])
})

test('pending requests have their own bound instead of consuming open member slots', () => {
  let state = players('player-a')
  state = setPartyVisibility(state, 'player-a', 'invite-only').state
  for (let index = 0; index < 16; index += 1) {
    const result = requestPartyJoin(state, identity('player-a').id, {
      id: `request-${index}`,
      requester: requester(`guest-${index}`),
    }, 2)
    assert.equal(result.accepted, true)
    state = result.state
  }
  assert.equal(requestPartyJoin(state, identity('player-a').id, {
    id: 'request-overflow',
    requester: requester('guest-overflow'),
  }, 2).reason, 'party-full')
})

test('only the recipient can deny one live invitation', () => {
  let state = players('player-a', 'player-b', 'player-c')
  state = invitePartyPlayer(state, 'player-a', 'player-b', 4).state
  state = invitePartyPlayer(state, 'player-c', 'player-b', 4).state
  const [first, second] = state.invitations
  assert.ok(first)
  assert.ok(second)
  assert.equal(denyPartyInvitation(state, 'player-c', first.id).reason, 'not-recipient')
  const denied = denyPartyInvitation(state, 'player-b', first.id)
  assert.equal(denied.accepted, true)
  assert.deepEqual(denied.state.invitations, [second])
})

test('party projection exposes member access and only leader join requests', () => {
  let state = players('player-a', 'player-b')
  state = invitePartyPlayer(state, 'player-a', 'player-b', 4).state
  state = setPartyVisibility(state, 'player-a', 'invite-only').state
  state = requestPartyJoin(state, identity('player-a').id, {
    id: 'request-1',
    requester: requester('guest'),
  }, 4).state
  const aurelia = {
    accountUsername: 'aurelia-prime',
    displayName: 'Aurelia',
    highestWave: 23,
    playerId: 'player-a',
    totalPlaytimeMs: 5_400_000,
  }
  const projected = projectPartyState(
    state,
    'player-a',
    new Map([['player-a', aurelia]]),
    new Set(['player-a', 'player-b']),
  )
  assert.equal(projected.party.joinCode, identity('player-a').joinCode)
  assert.deepEqual(projected.joinRequests, [{
    id: 'request-1',
    requester: requester('guest'),
  }])
  assert.equal(projectPartyState(
    state,
    'player-b',
    new Map([['player-a', aurelia]]),
    new Set(['player-a', 'player-b']),
  ).joinRequests.length, 0)
})

function players(...playerIds: string[]): PartySystemState {
  let state = createPartySystem()
  for (const playerId of playerIds) state = registerPartyPlayer(state, playerId, identity(playerId))
  return state
}

function identity(suffix: string): PartyIdentity {
  return {
    id: `opaque-${suffix}`,
    joinCode: `CODE-${suffix}`,
    listingId: `LIST-${suffix}`,
  }
}

function requester(suffix: string) {
  return {
    accountUsername: null,
    displayName: `Guest ${suffix}`,
    requesterId: `requester-${suffix}`,
  }
}

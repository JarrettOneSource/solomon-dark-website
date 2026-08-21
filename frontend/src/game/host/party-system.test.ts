import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acceptPartyInvitation,
  createPartySystem,
  invitePartyPlayer,
  partyForPlayer,
  projectPartyState,
  registerPartyPlayer,
  removePartyPlayer,
} from './party-system.ts'

test('every connected player starts as the leader of one singleton party', () => {
  let state = createPartySystem()
  state = registerPartyPlayer(state, 'player-a')
  state = registerPartyPlayer(state, 'player-b')

  assert.deepEqual(partyForPlayer(state, 'player-a'), {
    id: 'party-1',
    leaderPlayerId: 'player-a',
    memberPlayerIds: ['player-a'],
  })
  assert.deepEqual(partyForPlayer(state, 'player-b'), {
    id: 'party-2',
    leaderPlayerId: 'player-b',
    memberPlayerIds: ['player-b'],
  })
})

test('invite and recipient acceptance atomically replace the singleton party', () => {
  let state = createPartySystem()
  for (const playerId of ['player-a', 'player-b', 'player-c']) {
    state = registerPartyPlayer(state, playerId)
  }

  const invited = invitePartyPlayer(state, 'player-a', 'player-b', 4)
  assert.equal(invited.accepted, true)
  state = invited.state
  assert.equal(invitePartyPlayer(state, 'player-a', 'player-b', 4).reason, 'already-invited')
  assert.equal(invitePartyPlayer(state, 'player-a', 'player-a', 4).reason, 'self-invite')

  const invitation = state.invitations[0]!
  assert.equal(acceptPartyInvitation(state, 'player-c', invitation.id, 4).reason, 'not-recipient')
  const accepted = acceptPartyInvitation(state, 'player-b', invitation.id, 4)
  assert.equal(accepted.accepted, true)
  state = accepted.state

  assert.deepEqual(partyForPlayer(state, 'player-a')?.memberPlayerIds, [
    'player-a',
    'player-b',
  ])
  assert.equal(partyForPlayer(state, 'player-b')?.id, 'party-1')
  assert.equal(state.parties.some(({ id }) => id === 'party-2'), false)
  assert.deepEqual(state.invitations, [])
})

test('a multi-member party cannot be silently abandoned for another invite', () => {
  let state = createPartySystem()
  for (const playerId of ['player-a', 'player-b', 'player-c']) {
    state = registerPartyPlayer(state, playerId)
  }
  state = invitePartyPlayer(state, 'player-a', 'player-b', 4).state
  state = acceptPartyInvitation(state, 'player-b', state.invitations[0]!.id, 4).state
  assert.equal(invitePartyPlayer(state, 'player-c', 'player-b', 4).reason, 'already-in-party')
  assert.deepEqual(partyForPlayer(state, 'player-a')?.memberPlayerIds, [
    'player-a',
    'player-b',
  ])
})

test('disconnect retires invitations and deterministically promotes the earliest member', () => {
  let state = createPartySystem()
  for (const playerId of ['player-a', 'player-b', 'player-c']) {
    state = registerPartyPlayer(state, playerId)
  }
  state = invitePartyPlayer(state, 'player-a', 'player-b', 4).state
  state = acceptPartyInvitation(state, 'player-b', state.invitations[0]!.id, 4).state
  state = invitePartyPlayer(state, 'player-a', 'player-c', 4).state

  state = removePartyPlayer(state, 'player-a')

  assert.deepEqual(partyForPlayer(state, 'player-b'), {
    id: 'party-1',
    leaderPlayerId: 'player-b',
    memberPlayerIds: ['player-b'],
  })
  assert.deepEqual(state.invitations, [])
})

test('party projection exposes Hub profiles, local membership, and only received invites', () => {
  let state = createPartySystem()
  for (const playerId of ['player-a', 'player-b', 'player-c']) {
    state = registerPartyPlayer(state, playerId)
  }
  state = invitePartyPlayer(state, 'player-a', 'player-b', 4).state
  state = invitePartyPlayer(state, 'player-c', 'player-a', 4).state

  assert.deepEqual(projectPartyState(
    state,
    'player-b',
    new Map([
      ['player-a', 'Aurelia'],
      ['player-b', 'Basil'],
      ['player-c', 'Cassia'],
    ]),
    new Set(['player-a', 'player-b']),
  ), {
    hubPlayers: [
      { displayName: 'Aurelia', playerId: 'player-a' },
      { displayName: 'Basil', playerId: 'player-b' },
    ],
    invitations: [{
      id: 'invite-1',
      inviter: { displayName: 'Aurelia', playerId: 'player-a' },
      partyId: 'party-1',
    }],
    party: {
      id: 'party-2',
      leaderPlayerId: 'player-b',
      memberPlayerIds: ['player-b'],
    },
    revision: state.revision,
  })
})

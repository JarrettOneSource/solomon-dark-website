import assert from 'node:assert/strict'
import test from 'node:test'

import { projectPublicPartyDirectory } from './public-party-directory.ts'

test('projects complete opted-in singleton and grouped parties with safe display data', () => {
  const directory = projectPublicPartyDirectory({
    memberships: [
      membership('party-1', 'player-a', ['player-a'], 'public'),
      {
        ...membership('party-2', 'player-b', ['player-b', 'player-c'], 'invite-only'),
      },
      {
        ...membership('party-3', 'player-d', ['player-d', 'player-missing'], 'public'),
      },
    ],
    runs: [],
  }, new Map([
    ['player-a', 'Alone'],
    ['player-b', 'Hagatha'],
    ['player-c', 'Luthacus'],
    ['player-d', 'Incomplete'],
  ]), 16, {
    cheatsEnabled: false,
    modCount: 0,
    sessionKind: 'global-hub',
  })

  assert.deepEqual(directory, [{
    boneyardName: null,
    cheatsEnabled: false,
    id: 'listing-party-1',
    leader: 'Alone',
    maxMembers: 16,
    memberCount: 1,
    members: ['Alone'],
    modCount: 0,
    sessionKind: 'global-hub',
    status: 'hub',
    visibility: 'public',
  }, {
    boneyardName: null,
    cheatsEnabled: false,
    id: 'listing-party-2',
    leader: 'Hagatha',
    maxMembers: 16,
    memberCount: 2,
    members: ['Hagatha', 'Luthacus'],
    modCount: 0,
    sessionKind: 'global-hub',
    status: 'hub',
    visibility: 'invite-only',
  }])
  assert.doesNotMatch(JSON.stringify(directory), /player-|invitation|credential|manifest/i)
})

test('projects a running party with only its public Boneyard name', () => {
  const directory = projectPublicPartyDirectory({
    memberships: [membership(
      'party-4',
      'player-a',
      ['player-a', 'player-b', 'player-c'],
      'public',
    )],
    runs: [{ boneyardName: 'The Survival Grounds', partyId: 'party-4' }],
  }, new Map([
    ['player-a', 'Fomentius'],
    ['player-b', 'Hagatha'],
    ['player-c', 'Luthacus'],
  ]), 8, {
    cheatsEnabled: true,
    modCount: 2,
    sessionKind: 'private-college',
  })

  assert.deepEqual(directory, [{
    boneyardName: 'The Survival Grounds',
    cheatsEnabled: true,
    id: 'listing-party-4',
    leader: 'Fomentius',
    maxMembers: 8,
    memberCount: 3,
    members: ['Fomentius', 'Hagatha', 'Luthacus'],
    modCount: 2,
    sessionKind: 'private-college',
    status: 'playing',
    visibility: 'public',
  }])
})

function membership(
  id: string,
  leaderPlayerId: string,
  memberPlayerIds: readonly string[],
  visibility: 'invite-only' | 'private' | 'public',
) {
  return {
    id,
    joinCode: `CODE-${id}`,
    leaderPlayerId,
    listingId: `listing-${id}`,
    memberPlayerIds,
    visibility,
  }
}

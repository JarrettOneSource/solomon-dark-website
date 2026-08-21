import assert from 'node:assert/strict'
import test from 'node:test'

import { projectPublicPartyDirectory } from './public-party-directory.ts'

test('projects only complete multi-member parties with safe display data', () => {
  const directory = projectPublicPartyDirectory({
    memberships: [
      { id: 'party-1', leaderPlayerId: 'player-a', memberPlayerIds: ['player-a'] },
      {
        id: 'party-2',
        leaderPlayerId: 'player-b',
        memberPlayerIds: ['player-b', 'player-c'],
      },
      {
        id: 'party-3',
        leaderPlayerId: 'player-d',
        memberPlayerIds: ['player-d', 'player-missing'],
      },
    ],
    runs: [],
  }, new Map([
    ['player-a', 'Alone'],
    ['player-b', 'Hagatha'],
    ['player-c', 'Luthacus'],
    ['player-d', 'Incomplete'],
  ]), 16)

  assert.deepEqual(directory, [{
    boneyardName: null,
    id: 'party-2',
    leader: 'Hagatha',
    maxMembers: 16,
    memberCount: 2,
    members: ['Hagatha', 'Luthacus'],
    status: 'hub',
  }])
  assert.doesNotMatch(JSON.stringify(directory), /player-|invitation|credential|manifest/i)
})

test('projects a running party with only its public Boneyard name', () => {
  const directory = projectPublicPartyDirectory({
    memberships: [{
      id: 'party-4',
      leaderPlayerId: 'player-a',
      memberPlayerIds: ['player-a', 'player-b', 'player-c'],
    }],
    runs: [{ boneyardName: 'The Survival Grounds', partyId: 'party-4' }],
  }, new Map([
    ['player-a', 'Fomentius'],
    ['player-b', 'Hagatha'],
    ['player-c', 'Luthacus'],
  ]), 8)

  assert.deepEqual(directory, [{
    boneyardName: 'The Survival Grounds',
    id: 'party-4',
    leader: 'Fomentius',
    maxMembers: 8,
    memberCount: 3,
    members: ['Fomentius', 'Hagatha', 'Luthacus'],
    status: 'playing',
  }])
})

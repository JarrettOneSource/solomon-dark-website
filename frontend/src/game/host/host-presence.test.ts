import assert from 'node:assert/strict'
import test from 'node:test'

import { projectHostPresence, type HostPresenceParticipant } from './host-presence.ts'

test('projects hub and boneyard participants with wave numbers and party context', () => {
  const presence = projectHostPresence(
    [
      participant('player-a', 'Solomon', { accountUsername: 'solomon', developer: true }),
      participant('player-b', 'Hagatha', { accountUsername: null }),
      participant('player-c', 'Luthacus', { accountUsername: 'luth' }),
      participant('bot-1', 'ML Bot 1', { bot: true }),
    ],
    {
      hubPlayerIds: ['player-a', 'bot-1'],
      runs: [{
        boneyardName: 'The Survival Grounds',
        playerIds: ['player-b', 'player-c'],
        waveNumber: 4,
      }],
    },
    [
      membership('party-1', 'player-b', ['player-b', 'player-c']),
      membership('party-2', 'player-a', ['player-a']),
    ],
  )

  assert.deepEqual(presence, [{
    accountUsername: 'solomon',
    activity: 'hub',
    boneyardName: null,
    bot: false,
    developer: true,
    displayName: 'Solomon',
    partyLeader: null,
    partySize: null,
    waveNumber: null,
  }, {
    accountUsername: null,
    activity: 'boneyard',
    boneyardName: 'The Survival Grounds',
    bot: false,
    developer: false,
    displayName: 'Hagatha',
    partyLeader: 'Hagatha',
    partySize: 2,
    waveNumber: 4,
  }, {
    accountUsername: 'luth',
    activity: 'boneyard',
    boneyardName: 'The Survival Grounds',
    bot: false,
    developer: false,
    displayName: 'Luthacus',
    partyLeader: 'Hagatha',
    partySize: 2,
    waveNumber: 4,
  }, {
    accountUsername: null,
    activity: 'hub',
    boneyardName: null,
    bot: true,
    developer: false,
    displayName: 'ML Bot 1',
    partyLeader: null,
    partySize: null,
    waveNumber: null,
  }])
  assert.doesNotMatch(
    JSON.stringify(presence),
    /player-|bot-1|joinCode|listing|credential/i,
  )
})

test('skips participants absent from every world and leaders it cannot name', () => {
  const presence = projectHostPresence(
    [
      participant('player-a', 'Solomon', {}),
      participant('player-limbo', 'Limbo', {}),
    ],
    { hubPlayerIds: ['player-a'], runs: [] },
    [membership('party-1', 'player-gone', ['player-gone', 'player-a'])],
  )

  assert.deepEqual(presence, [{
    accountUsername: null,
    activity: 'hub',
    boneyardName: null,
    bot: false,
    developer: false,
    displayName: 'Solomon',
    partyLeader: null,
    partySize: null,
    waveNumber: null,
  }])
})

test('reports wave zero while a run is staged before its first wave', () => {
  const presence = projectHostPresence(
    [participant('player-a', 'Solomon', {})],
    {
      hubPlayerIds: [],
      runs: [{ boneyardName: 'West Boneyard', playerIds: ['player-a'], waveNumber: 0 }],
    },
    [],
  )

  assert.equal(presence.length, 1)
  assert.equal(presence[0]!.activity, 'boneyard')
  assert.equal(presence[0]!.boneyardName, 'West Boneyard')
  assert.equal(presence[0]!.waveNumber, 0)
})

function participant(
  playerId: string,
  displayName: string,
  overrides: Partial<Omit<HostPresenceParticipant, 'displayName' | 'playerId'>>,
): HostPresenceParticipant {
  return {
    accountUsername: null,
    bot: false,
    developer: false,
    displayName,
    playerId,
    ...overrides,
  }
}

function membership(
  id: string,
  leaderPlayerId: string,
  memberPlayerIds: readonly string[],
) {
  return {
    id,
    joinCode: `CODE-${id}`,
    leaderPlayerId,
    listingId: `listing-${id}`,
    memberPlayerIds,
    visibility: 'private' as const,
  }
}

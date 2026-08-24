import assert from 'node:assert/strict'
import test from 'node:test'

import { connectedPlayerPresentation } from './connected-players.ts'

test('presents hub players with their session and account identity', () => {
  assert.deepEqual(connectedPlayerPresentation({
    accountUsername: 'solomon',
    activity: 'hub',
    boneyardName: null,
    bot: false,
    developer: true,
    displayName: 'Solomon',
    partyLeader: null,
    partySize: null,
    session: 'global-hub',
    waveNumber: null,
  }), {
    detail: 'solomon',
    location: 'COLLEGE COURTYARD',
    party: null,
    session: 'GLOBAL HUB',
    status: 'IN HUB',
  })
})

test('presents boneyard players with their wave, place, and party', () => {
  assert.deepEqual(connectedPlayerPresentation({
    accountUsername: null,
    activity: 'boneyard',
    boneyardName: 'The Survival Grounds',
    bot: false,
    developer: false,
    displayName: 'Hagatha',
    partyLeader: 'Hagatha',
    partySize: 3,
    session: 'private-college',
    waveNumber: 5,
  }), {
    detail: 'GUEST WIZARD',
    location: 'The Survival Grounds',
    party: "Hagatha's party of 3",
    session: 'PRIVATE COLLEGE',
    status: 'WAVE 5',
  })
})

test('presents staged runs before wave one and names bots as bots', () => {
  const presentation = connectedPlayerPresentation({
    accountUsername: null,
    activity: 'boneyard',
    boneyardName: 'West Boneyard',
    bot: true,
    developer: false,
    displayName: 'ML Bot 1',
    partyLeader: null,
    partySize: null,
    session: 'global-hub',
    waveNumber: 0,
  })
  assert.equal(presentation.status, 'STAGING')
  assert.equal(presentation.detail, 'ML BOT')
  assert.equal(presentation.location, 'West Boneyard')
})

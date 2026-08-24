import assert from 'node:assert/strict'
import test from 'node:test'

import { connectedPlayerPresentation } from './connected-players.ts'
import {
  createGameSimulation,
  grantGameSimulationPlayerExperience,
  selectGameSimulationPlayerSkill,
} from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import { deriveObserverSkillEvents, observerSkillOffers } from './observer-activity.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

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

test('observer skill feed shows offers and the selected result without owning the picker', () => {
  const initialState = createGameSimulation({ 'player-1': CHARACTER })
  const initial = createGameSnapshot(initialState, 'player-1')
  const offeredState = grantGameSimulationPlayerExperience(initialState, 'player-1', 100)
  const offered = createGameSnapshot(offeredState, 'player-1')
  const currentOffer = offered.players['player-1']!.progression.pendingOffer!
  assert.equal(observerSkillOffers(offered)[0]?.playerName, 'Helvidius')
  assert.deepEqual(
    deriveObserverSkillEvents(initial, offered).map(event => event.title),
    ['LEVEL 2 CHOICES'],
  )

  const selectedState = selectGameSimulationPlayerSkill(offeredState, 'player-1', {
    choiceIndex: 0,
    offerSequence: currentOffer.sequence,
    skillId: currentOffer.options[0]!.skillId,
  })!
  const selected = createGameSnapshot(selectedState, 'player-1')
  const events = deriveObserverSkillEvents(offered, selected)
  assert.equal(events[0]?.title, 'SKILL SELECTED')
  assert.match(events[0]?.detail ?? '', /rank \d+/)
})

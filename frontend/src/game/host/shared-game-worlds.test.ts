import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import {
  GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import {
  createGameSimulation,
  detachGameSimulationPlayer,
} from '../core-server/game-simulation.ts'
import {
  playerCharacterAt,
  replacePlayerCharacter,
} from '../core-server/player-entity-store.ts'
import {
  acceptSharedPartyInvitation,
  addSharedHubPlayer,
  createSharedGameWorlds,
  denySharedPartyInvitation,
  confirmSharedPartyLoadout,
  inviteSharedPartyPlayer,
  removeSharedGamePlayer,
  detachSharedGamePlayer,
  rejoinSharedPartyRunPlayer,
  restoreSharedGamePlayer,
  joinSharedPartyPlayer,
  kickSharedPartyPlayer,
  leaveSharedParty,
  sharedGameStateForPlayer,
  startSharedPartyRun,
  stepSharedGameWorlds,
} from './shared-game-worlds.ts'

test('shared Hub restore preserves the saved character and participant state', () => {
  const playerId = 'saved-owner'
  let saved = createGameSimulation({ [playerId]: character('Aurelia') })
  const player = playerCharacterAt(saved.playerEntities, playerId)
  assert.ok(player)
  saved = {
    ...saved,
    playerEntities: replacePlayerCharacter(saved.playerEntities, playerId, {
      ...player,
      position: { x: 1_234, y: 567 },
      velocity: { x: 4, y: -3 },
    }),
  }
  if (saved.world.kind !== 'hub') assert.fail('expected saved Hub world')
  const savedParticipant = {
    region: 'library' as const,
    transition: {
      alpha: 0.4,
      destination: 'courtyard' as const,
      phase: 'outgoing' as const,
      scriptedSpeed: 1,
      scriptedTarget: { x: 445, y: 1_320 },
      sourceRegion: 'library' as const,
    },
  }
  saved = {
    ...saved,
    world: {
      ...saved.world,
      participants: {
        ...saved.world.participants,
        [playerId]: savedParticipant,
      },
    },
  }

  const worlds = restoreSharedGamePlayer(
    createSharedGameWorlds(),
    saved,
    null,
    playerId,
    partyIdentity('saved'),
  )
  const restored = sharedGameStateForPlayer(worlds, playerId)
  assert.ok(restored)
  assert.deepEqual(
    playerCharacterAt(restored.playerEntities, playerId)?.position,
    { x: 1_234, y: 567 },
  )
  assert.deepEqual(
    playerCharacterAt(restored.playerEntities, playerId)?.velocity,
    { x: 4, y: -3 },
  )
  assert.equal(restored.world.kind, 'hub')
  if (restored.world.kind !== 'hub') assert.fail('expected restored Hub world')
  assert.deepEqual(
    restored.world.participants[playerId],
    savedParticipant,
  )
  assert.notEqual(restored.world.participants[playerId], savedParticipant)
  assert.notEqual(
    restored.world.participants[playerId]?.transition?.scriptedTarget,
    savedParticipant.transition.scriptedTarget,
  )
})

test('shared Hub denial removes the recipient invitation without moving either party', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = inviteSharedPartyPlayer(worlds, 'player-a', 'player-b', 4).state
  const invitation = worlds.parties.invitations[0]!

  assert.equal(
    denySharedPartyInvitation(worlds, 'player-a', invitation.id).reason,
    'not-recipient',
  )
  const denied = denySharedPartyInvitation(worlds, 'player-b', invitation.id)
  assert.equal(denied.accepted, true)
  assert.deepEqual(denied.state.parties.invitations, [])
  assert.equal(denied.state.parties.parties.length, 2)
  assert.equal(denied.state.hub, worlds.hub)
})

const character = (displayName: string) => ({
  discipline: 'arcane' as const,
  displayName,
  element: 'ether' as const,
})

const partyIdentity = (suffix: string) => ({
  id: `opaque-${suffix}`,
  joinCode: `CODE-${suffix}`,
  listingId: `LIST-${suffix}`,
})

function loadedBoneyardFixture(runId: string): LoadedBoneyard {
  return {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    geometrySha256: '2'.repeat(64),
    runId,
    scene: {
      bounds: { h: 1_200, w: 1_600, x: 0, y: 0 },
      environmentMode: 2,
      fences: [],
      name: 'Party Arena',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 200, y: 150 },
      sprites: [],
      terrain: [],
    },
    seed: '0123456789abcdef',
    sourceSha256: '1'.repeat(64),
  }
}

test('direct admission, leave, and kick preserve Hub ownership while replacing singleton access', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'), partyIdentity('c'))

  worlds = joinSharedPartyPlayer(worlds, 'player-b', partyIdentity('a').id, 4).state
  assert.deepEqual(
    worlds.parties.parties.find(({ id }) => id === partyIdentity('a').id)?.memberPlayerIds,
    ['player-a', 'player-b'],
  )
  worlds = leaveSharedParty(worlds, 'player-b', partyIdentity('b-left')).state
  assert.equal(
    worlds.parties.parties.find(({ leaderPlayerId }) => leaderPlayerId === 'player-b')?.id,
    partyIdentity('b-left').id,
  )
  worlds = joinSharedPartyPlayer(worlds, 'player-b', partyIdentity('a').id, 4).state
  worlds = kickSharedPartyPlayer(
    worlds,
    'player-a',
    'player-b',
    partyIdentity('b-kicked'),
  ).state
  assert.equal(
    worlds.parties.parties.find(({ leaderPlayerId }) => leaderPlayerId === 'player-b')?.id,
    partyIdentity('b-kicked').id,
  )
  assert.equal(sharedGameStateForPlayer(worlds, 'player-b')?.world.kind, 'hub')
})

test('party launch partitions exactly its members while the shared Hub keeps ticking', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'), partyIdentity('c'))
  worlds = inviteSharedPartyPlayer(worlds, 'player-a', 'player-b', 4).state
  worlds = acceptSharedPartyInvitation(
    worlds,
    'player-b',
    worlds.parties.invitations[0]!.id,
    4,
  ).state

  const started = startSharedPartyRun(
    worlds,
    'player-a',
    loadedBoneyardFixture('party-run'),
  )
  assert.equal(started.accepted, true)
  worlds = started.state

  assert.equal(sharedGameStateForPlayer(worlds, 'player-a')?.world.kind, 'boneyard')
  assert.equal(sharedGameStateForPlayer(worlds, 'player-b')?.world.kind, 'boneyard')
  assert.equal(sharedGameStateForPlayer(worlds, 'player-c')?.world.kind, 'hub')
  assert.deepEqual(
    worlds.hub.playerEntities.identities.map(({ playerId }) => playerId),
    ['player-c'],
  )
  assert.deepEqual(
    worlds.runs[0]?.state.playerEntities.identities.map(({ playerId }) => playerId),
    ['player-a', 'player-b'],
  )

  const hubTick = worlds.hub.tick
  const runTick = worlds.runs[0]!.state.tick
  worlds = stepSharedGameWorlds(worlds, {})
  assert.equal(worlds.hub.tick, hubTick + 1)
  assert.equal(worlds.runs[0]!.state.tick, runTick + 1)
})

test('party pause can hold its Boneyard run but the shared Hub always ticks', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = inviteSharedPartyPlayer(worlds, 'player-a', 'player-b', 4).state
  worlds = acceptSharedPartyInvitation(
    worlds,
    'player-b',
    worlds.parties.invitations[0]!.id,
    4,
  ).state
  worlds = startSharedPartyRun(
    worlds,
    'player-a',
    loadedBoneyardFixture('party-run'),
  ).state
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'), partyIdentity('c'))

  const hubTick = worlds.hub.tick
  const runTick = worlds.runs[0]!.state.tick
  worlds = stepSharedGameWorlds(worlds, {}, new Set([worlds.runs[0]!.partyId]))

  assert.equal(worlds.hub.tick, hubTick + 1)
  assert.equal(worlds.runs[0]!.state.tick, runTick)
})

test('every completed party member enters the one live shared-Hub memorial', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'), partyIdentity('c'))
  worlds = inviteSharedPartyPlayer(worlds, 'player-a', 'player-b', 4).state
  worlds = acceptSharedPartyInvitation(
    worlds,
    'player-b',
    worlds.parties.invitations[0]!.id,
    4,
  ).state
  worlds = startSharedPartyRun(
    worlds,
    'player-a',
    loadedBoneyardFixture('memorial-party-run'),
  ).state
  Object.assign(worlds.runs[0]!.state.run, {
    gameOverEventId: 1,
    gameOverExitKind: null,
    gameOverExitTicks: null,
    gameOverTicks: 299,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })

  worlds = stepSharedGameWorlds(worlds, {})
  if (worlds.hub.world.kind !== 'hub') assert.fail('expected shared Hub world')
  const completed = worlds.hub.world.memorial.slots
    .filter(({ portrait }) => portrait !== null)
    .toSorted((left, right) => left.age - right.age)
  assert.deepEqual(
    completed.map(({ portrait }) => portrait?.config.displayName),
    ['Aurelia', 'Basil'],
  )
  assert.deepEqual(completed.map(({ portraitId }) => portraitId), [100, 101])
  assert.equal(completed[1]?.portrait?.playerId, 'player-b')

  worlds = addSharedHubPlayer(worlds, 'player-d', character('Daria'), partyIdentity('d'))
  if (worlds.hub.world.kind !== 'hub') assert.fail('expected shared Hub world')
  assert.deepEqual(
    worlds.hub.world.memorial.slots
      .filter(({ portrait }) => portrait !== null)
      .toSorted((left, right) => left.age - right.age)
      .map(({ portrait }) => portrait?.config.displayName),
    ['Aurelia', 'Basil'],
  )
})

test('only a Courtyard party leader can launch and a running member cannot be invited', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'), partyIdentity('c'))
  worlds = inviteSharedPartyPlayer(worlds, 'player-a', 'player-b', 4).state
  worlds = acceptSharedPartyInvitation(
    worlds,
    'player-b',
    worlds.parties.invitations[0]!.id,
    4,
  ).state

  assert.equal(
    startSharedPartyRun(worlds, 'player-b', loadedBoneyardFixture('denied')).reason,
    'not-leader',
  )
  worlds = startSharedPartyRun(
    worlds,
    'player-a',
    loadedBoneyardFixture('accepted'),
  ).state
  assert.equal(inviteSharedPartyPlayer(worlds, 'player-c', 'player-b', 4).reason, 'not-in-hub')
})

test('post-run confirmation merges the progressed party back into the shared Hub', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'), partyIdentity('b'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'), partyIdentity('c'))
  worlds = inviteSharedPartyPlayer(worlds, 'player-a', 'player-b', 4).state
  worlds = acceptSharedPartyInvitation(
    worlds,
    'player-b',
    worlds.parties.invitations[0]!.id,
    4,
  ).state
  worlds = startSharedPartyRun(
    worlds,
    'player-a',
    loadedBoneyardFixture('returning-party'),
  ).state
  Object.assign(worlds.runs[0]!.state.run, {
    gameOverEventId: 1,
    gameOverExitKind: 'automatic',
    gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
    gameOverTicks:
      GAME_OVER_AUTOMATIC_ACCEPT_TICK + GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS - 1,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
  worlds = stepSharedGameWorlds(worlds, {})
  assert.equal(worlds.runs[0]?.state.world.kind, 'hub')
  assert.equal(worlds.runs[0]?.state.run.phase, 'loadout')

  const firstReady = confirmSharedPartyLoadout(worlds, 'player-a', {
    discipline: 'body',
    element: 'air',
  })
  assert.equal(firstReady.accepted, true)
  assert.equal(firstReady.state.runs.length, 1)
  const returned = confirmSharedPartyLoadout(firstReady.state, 'player-b', {
    discipline: 'mind',
    element: 'water',
  })
  assert.equal(returned.accepted, true)
  worlds = returned.state
  assert.equal(worlds.runs.length, 0)
  assert.deepEqual(
    new Set(worlds.hub.playerEntities.identities.map(({ playerId }) => playerId)),
    new Set(['player-a', 'player-b', 'player-c']),
  )
  assert.deepEqual(
    worlds.parties.parties.find(({ leaderPlayerId }) => leaderPlayerId === 'player-a')
      ?.memberPlayerIds,
    ['player-a', 'player-b'],
  )

  worlds = startSharedPartyRun(
    worlds,
    'player-a',
    loadedBoneyardFixture('disconnecting-party'),
  ).state
  Object.assign(worlds.runs[0]!.state.run, {
    gameOverEventId: 2,
    gameOverExitKind: 'automatic',
    gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
    gameOverTicks:
      GAME_OVER_AUTOMATIC_ACCEPT_TICK + GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS - 1,
    nextGameOverEventId: 3,
    phase: 'game-over',
  })
  worlds = stepSharedGameWorlds(worlds, {})
  const waiting = confirmSharedPartyLoadout(worlds, 'player-a', {
    discipline: 'arcane',
    element: 'ether',
  })
  assert.equal(waiting.accepted, true)
  assert.equal(waiting.state.runs.length, 1)
  worlds = removeSharedGamePlayer(waiting.state, 'player-b')
  assert.equal(worlds.runs.length, 0)
  assert.deepEqual(
    new Set(worlds.hub.playerEntities.identities.map(({ playerId }) => playerId)),
    new Set(['player-a', 'player-c']),
  )
})

test('disconnected leader rejoins the same active run without losing leadership', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'leader', character('Aurelia'), partyIdentity('a'))
  worlds = addSharedHubPlayer(worlds, 'member', character('Basil'), partyIdentity('b'))
  worlds = inviteSharedPartyPlayer(worlds, 'leader', 'member', 4).state
  worlds = acceptSharedPartyInvitation(
    worlds,
    'member',
    worlds.parties.invitations[0]!.id,
    4,
  ).state
  const partyId = worlds.parties.parties.find(({ leaderPlayerId }) => (
    leaderPlayerId === 'leader'
  ))!.id
  worlds = startSharedPartyRun(worlds, 'leader', loadedBoneyardFixture('leader-rejoin')).state
  const detached = detachGameSimulationPlayer(worlds.runs[0]!.state, 'leader')
  worlds = detachSharedGamePlayer(worlds, 'leader')
  assert.equal(worlds.parties.parties.find(({ id }) => id === partyId)?.leaderPlayerId, 'leader')
  assert.deepEqual(
    worlds.parties.parties.find(({ id }) => id === partyId)?.memberPlayerIds,
    ['leader', 'member'],
  )

  const rejoined = rejoinSharedPartyRunPlayer(
    worlds,
    detached,
    'leader',
    partyId,
    partyIdentity('returning-leader'),
    4,
    null,
  )
  assert.equal(rejoined.accepted, true)
  worlds = rejoined.state
  assert.equal(worlds.runs[0]?.loadedBoneyard.runId, 'leader-rejoin')
  assert.deepEqual(
    worlds.parties.parties.find(({ id }) => id === partyId)?.memberPlayerIds,
    ['leader', 'member'],
  )
  assert.equal(worlds.parties.parties.find(({ id }) => id === partyId)?.leaderPlayerId, 'leader')
  assert.equal(sharedGameStateForPlayer(worlds, 'leader'), worlds.runs[0]?.state)
})

test('detaching the final actor retires its shared run without treating transport loss as party leave', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'owner', character('Aurelia'), partyIdentity('owner'))
  const partyId = worlds.parties.parties[0]!.id
  worlds = startSharedPartyRun(
    worlds,
    'owner',
    loadedBoneyardFixture('final-actor-detach'),
  ).state

  worlds = detachSharedGamePlayer(worlds, 'owner')

  assert.equal(worlds.runs.length, 0)
  assert.equal(sharedGameStateForPlayer(worlds, 'owner'), null)
  assert.deepEqual(
    worlds.parties.parties.find(({ id }) => id === partyId)?.memberPlayerIds,
    ['owner'],
  )
})

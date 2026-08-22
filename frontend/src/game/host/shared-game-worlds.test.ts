import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
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
  restoreSharedGamePlayer,
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

  const worlds = restoreSharedGamePlayer(createSharedGameWorlds(), saved, null, playerId)
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
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'))
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

test('party launch partitions exactly its members while the shared Hub keeps ticking', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'))
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

test('shared Hub pause freezes Hub residents while independent party runs keep ticking', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'))
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
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'))

  const hub = worlds.hub
  const runTick = worlds.runs[0]!.state.tick
  worlds = stepSharedGameWorlds(worlds, {}, new Set(), new Map(), true)

  assert.equal(worlds.hub, hub)
  assert.equal(worlds.runs[0]!.state.tick, runTick + 1)
})

test('only a Courtyard party leader can launch and a running member cannot be invited', () => {
  let worlds = createSharedGameWorlds()
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'))
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
  worlds = addSharedHubPlayer(worlds, 'player-a', character('Aurelia'))
  worlds = addSharedHubPlayer(worlds, 'player-b', character('Basil'))
  worlds = addSharedHubPlayer(worlds, 'player-c', character('Cassia'))
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
    gameOverExitTicks: 400,
    gameOverTicks: 1_399,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
  worlds = stepSharedGameWorlds(worlds, {})
  assert.equal(worlds.runs[0]?.state.world.kind, 'hub')
  assert.equal(worlds.runs[0]?.state.run.phase, 'loadout')

  const returned = confirmSharedPartyLoadout(worlds, 'player-a')
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
})

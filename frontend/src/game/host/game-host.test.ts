import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import { createGameSimulation } from '../core-server/game-simulation.ts'
import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
  type ServerSnapshotMessage,
} from '../protocol/game-protocol.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import { EntityReplicationReconstructor } from '../protocol/entity-replication.ts'
import type { BoneyardScene } from '../core-kernels/boneyard.ts'
import { createBoneyardCatalog, type ModBoneyardEntry } from './boneyard-catalog.ts'
import { startGameHost } from './game-host.ts'
import { SOLOMON_DIG_FRAME_PROGRAM } from './project-boneyard.ts'

const FIRST_CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const
const SECOND_CHARACTER = {
  discipline: 'mind',
  displayName: 'Vibia',
  element: 'water',
} as const
const SHARED_AUTHENTICATION = { kind: 'shared', credential: 'test-secret' } as const

type MaterializedServerSnapshotMessage = ServerSnapshotMessage & { snapshot: GameSnapshot }
type TestServerGameMessage =
  | Exclude<ServerGameMessage, ServerSnapshotMessage>
  | MaterializedServerSnapshotMessage

interface TestReplicationState {
  readonly frames: Map<number, MaterializedServerSnapshotMessage>
  readonly reconstructor: EntityReplicationReconstructor
}

const replicationBySocket = new WeakMap<WebSocket, TestReplicationState>()

function gameplayInput(
  movement: { x: number; y: number },
  aim: { x: number; y: number } | null = null,
  primary = false,
  secondary = false,
): PlayerCharacterInput {
  return {
    aim,
    cast: { primary, secondary },
    movement,
  }
}

test('authoritative game host owns two configured player characters and movement', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  assert.notEqual(first.welcome.playerId, second.welcome.playerId)
  assert.equal(host.playerCount(), 2)
  const firstState = first.welcome.snapshot.players[first.welcome.playerId]
  const secondState = second.welcome.snapshot.players[second.welcome.playerId]
  assert.deepEqual(firstState.config, FIRST_CHARACTER)
  assert.deepEqual(secondState.config, SECOND_CHARACTER)
  assert.equal(firstState.position.x, HUB_SPAWN.x)
  assert.equal(secondState.position.x, HUB_SPAWN.x)
  first.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: first.welcome.snapshot.tick + 1,
  }))
  const snapshot = await nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.acknowledgedInputSequence === 1
    && message.snapshot.players[first.welcome.playerId].position.x > firstState.position.x
  ))
  assert.equal(snapshot.type, 'server-snapshot')
  assert.ok(snapshot.snapshot.players[first.welcome.playerId].position.x > firstState.position.x)
  assert.deepEqual(
    snapshot.snapshot.players[second.welcome.playerId].velocity,
    { x: 0, y: 0 },
  )
})

test('game host pauses a leveling player and authoritatively books the offered skill', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    initialPlayerExperience: 100,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())

  const playerId = client.welcome.playerId
  const initial = client.welcome.snapshot.players[playerId]
  const offer = initial.progression.pendingOffer
  assert.equal(initial.progression.level, 2)
  assert.equal(initial.progression.experience, 100)
  assert.equal(offer?.level, 2)
  assert.equal(offer?.options.length, 3)
  assert.ok(offer)

  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: client.welcome.snapshot.tick + 1,
  }))
  const paused = await nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.acknowledgedInputSequence === 1
  ))
  assert.equal(paused.type, 'server-snapshot')
  assert.deepEqual(paused.snapshot.players[playerId].position, initial.position)
  assert.deepEqual(paused.snapshot.players[playerId].velocity, { x: 0, y: 0 })

  const choiceIndex = 0
  const skillId = offer.options[choiceIndex]!.skillId
  const previousRank = initial.progression.learnedSkills
    .find(([learnedSkillId]) => learnedSkillId === skillId)?.[1] ?? 0
  const selectedSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.pendingOffer === null
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex,
    offerSequence: offer.sequence,
    skillId,
  }))
  const selected = await selectedSnapshot
  assert.equal(selected.type, 'server-snapshot')
  const booked = selected.snapshot.players[playerId].progression
  assert.equal(booked.level, 2)
  assert.equal(booked.experience, 100)
  assert.deepEqual(
    booked.learnedSkills.find(([learnedSkillId]) => learnedSkillId === skillId),
    [skillId, previousRank + 1, previousRank + 1],
  )
})

test('game host accepts an empty deterministic Hub fixture factory', async (context) => {
  let factoryCalls = 0
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    createSimulation: () => {
      factoryCalls += 1
      return createGameSimulation({}, {
        hubStudentPopulation: createHubStudentFixturePopulation({
          count: 32,
          seed: 0x12345678,
        }),
      })
    },
    snapshotRate: 100,
  })
  context.after(() => host.close())
  assert.equal(factoryCalls, 1)
  const initialState = host.state()
  assert.equal(initialState.world.kind, 'hub')
  if (initialState.world.kind !== 'hub') throw new Error('expected Hub')
  assert.equal(initialState.world.studentPopulation.store.size, 32)

  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  assert.equal(client.welcome.snapshot.world.kind, 'hub')
  if (client.welcome.snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  assert.equal(client.welcome.snapshot.world.students.length, 32)
})

test('game host rejects pre-populated initial simulation factories', async () => {
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    createSimulation: () => createGameSimulation(),
  }), /must start without player characters/)
})

test('game host echoes authenticated ping outside the snapshot loop', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 1 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())

  const pong = nextMessage(client.socket, (message) => (
    message.type === 'server-pong' && message.nonce === 41
  ))
  client.socket.send(encodeGameMessage({ type: 'client-ping', nonce: 41 }))
  assert.deepEqual(await pong, { type: 'server-pong', nonce: 41 })
})

test('game host sends a complete keyframe when a client requests recovery', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const first = await nextMessage(client.socket, (message) => message.type === 'server-snapshot')
  assert.equal(first.type, 'server-snapshot')
  client.socket.send(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: true,
    sequence: first.sequence,
  }))
  const recovered = await nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.entities.keyframe
  ))
  assert.equal(recovered.type, 'server-snapshot')
  assert.equal(recovered.frame.world.kind, 'hub')
  if (recovered.frame.world.kind !== 'hub') throw new Error('expected Hub frame')
  assert.equal(recovered.frame.world.entities.baselineSequence, 0)
  assert.equal(
    recovered.frame.world.entities.spawned.length,
    recovered.snapshot.world.kind === 'hub' ? recovered.snapshot.world.students.length : -1,
  )
})

test('game host reconnects a new character at the active world spawn', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())

  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  assert.deepEqual(first.welcome.snapshot.players[first.welcome.playerId].position, HUB_SPAWN)
  await closeSocket(first.socket)
  assert.equal(host.playerCount(), 0)

  const reconnected = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => reconnected.socket.close())
  assert.notEqual(reconnected.welcome.playerId, first.welcome.playerId)
  assert.deepEqual(
    reconnected.welcome.snapshot.players[reconnected.welcome.playerId].position,
    HUB_SPAWN,
  )
  assert.deepEqual(
    reconnected.welcome.snapshot.players[reconnected.welcome.playerId].config,
    SECOND_CHARACTER,
  )
})

test('game host rejects arbitrary origins and invalid bootstrap credentials', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION })
  context.after(() => host.close())

  await assert.rejects(() => openSocket(host.address.url, 'https://evil.example'))
  const socket = await openSocket(host.address.url)
  context.after(() => socket.close())
  socket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'wrong-secret',
    character: FIRST_CHARACTER,
  }))
  const message = await nextMessage(socket, (entry) => entry.type === 'server-disconnect')
  assert.deepEqual(message, {
    type: 'server-disconnect',
    code: 'authentication-failed',
    reason: 'The session credential is invalid.',
  })
})

test('game host is loopback-only by default and requires trusted proxy origins', async () => {
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    host: '0.0.0.0',
  }), /trusted secure proxy/)
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    host: '0.0.0.0',
    trustedProxy: true,
  }), /nonempty allowedOrigins/)
})

test('game host rejects intent targeting implausibly far-future ticks', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick: client.welcome.snapshot.tick + 1000,
  }))
  const message = await nextMessage(client.socket, (entry) => entry.type === 'server-disconnect')
  assert.equal(message.type, 'server-disconnect')
  assert.equal(message.code, 'invalid-message')
})

test('game host applies only the newest character input for a simulation tick', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const origin = client.welcome.snapshot.players[client.welcome.playerId].position
  const targetTick = client.welcome.snapshot.tick + 1
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 1, y: 0 }),
    sequence: 1,
    targetTick,
  }))
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 0, y: 1 }),
    sequence: 2,
    targetTick,
  }))
  const message = await nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 2
  ))
  assert.equal(message.type, 'server-snapshot')
  const player = message.snapshot.players[client.welcome.playerId]
  assert.equal(player.position.x, origin.x)
  assert.ok(player.position.y > origin.y)
})

test('game host samples a press before a same-target-tick release', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const targetTick = client.welcome.snapshot.tick + 1
  const pressed = nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 1
  ))
  const released = nextMessage(client.socket, (entry) => (
    entry.type === 'server-snapshot' && entry.acknowledgedInputSequence === 2
  ))

  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 0, y: 0 }, { x: 300, y: 400 }, true),
    sequence: 1,
    targetTick,
  }))
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: gameplayInput({ x: 0, y: 0 }, { x: 300, y: 400 }),
    sequence: 2,
    targetTick,
  }))

  const [pressedSnapshot, releasedSnapshot] = await Promise.all([pressed, released])
  assert.equal(pressedSnapshot.type, 'server-snapshot')
  assert.equal(releasedSnapshot.type, 'server-snapshot')
  assert.equal(releasedSnapshot.snapshot.tick, pressedSnapshot.snapshot.tick + 1)
})

test('host starts one exact random Boneyard for every connected client', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  assert.equal(first.welcome.snapshot.hostPlayerId, first.welcome.playerId)
  assert.deepEqual(first.welcome.boneyards, [
    { id: 'default-random', name: 'Random Boneyard', source: 'default' },
  ])

  second.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(host.loadedBoneyard(), null)

  const firstLoaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const secondLoaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const firstSnapshot = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot' && message.snapshot.world.kind === 'boneyard'
  ))
  const secondSnapshot = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot' && message.snapshot.world.kind === 'boneyard'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))

  const [loadedA, loadedB, snapshotA, snapshotB] = await Promise.all([
    firstLoaded,
    secondLoaded,
    firstSnapshot,
    secondSnapshot,
  ])
  assert.equal(loadedA.type, 'server-boneyard-loaded')
  assert.equal(loadedB.type, 'server-boneyard-loaded')
  assert.equal(snapshotA.type, 'server-snapshot')
  assert.equal(snapshotB.type, 'server-snapshot')
  assert.equal(loadedA.boneyard.runId, loadedB.boneyard.runId)
  assert.equal(loadedA.boneyard.geometrySha256, loadedB.boneyard.geometrySha256)
  assert.equal(snapshotA.snapshot.world.kind, 'boneyard')
  assert.equal(snapshotB.snapshot.world.kind, 'boneyard')
  if (snapshotA.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  if (snapshotB.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshotA.snapshot.world.runId, loadedA.boneyard.runId)
  assert.equal(snapshotB.snapshot.world.runId, loadedA.boneyard.runId)
  assert.ok(snapshotA.snapshot.world.gateLeaves.length >= 2)
  assert.deepEqual(
    snapshotA.snapshot.world.gateLeaves,
    snapshotB.snapshot.world.gateLeaves,
  )
  assert.deepEqual(
    snapshotA.snapshot.players[first.welcome.playerId].position,
    { x: loadedA.boneyard.scene.spawn.x, y: loadedA.boneyard.scene.spawn.y },
  )
  assert.equal(loadedA.boneyard.scene.solomonDig?.frameProgram.length, 29)
})

test('standalone host resets its run after the final client leaves', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const firstLoaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const firstRun = await firstLoaded
  assert.equal(firstRun.type, 'server-boneyard-loaded')

  await closeSocket(first.socket)
  await waitFor(() => host.loadedBoneyard() === null)
  assert.equal(host.hostPlayerId(), null)
  assert.equal(host.state().world.kind, 'hub')

  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  assert.equal(second.welcome.playerId, 'player-1')
  assert.equal(second.welcome.snapshot.tick, 0)
  assert.equal(second.welcome.snapshot.world.kind, 'hub')
  const secondLoaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const secondRun = await secondLoaded
  assert.equal(secondRun.type, 'server-boneyard-loaded')
  assert.notEqual(secondRun.boneyard.runId, firstRun.boneyard.runId)
  assert.notEqual(secondRun.boneyard.seed, firstRun.boneyard.seed)
})

test('persistent host retains its loaded run across an empty interval', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const loaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const firstRun = await loaded
  assert.equal(firstRun.type, 'server-boneyard-loaded')
  await closeSocket(first.socket)
  await waitFor(() => host.playerCount() === 0)

  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  assert.equal(second.welcome.snapshot.world.kind, 'boneyard')
  if (second.welcome.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(second.welcome.snapshot.world.runId, firstRun.boneyard.runId)
  assert.equal(host.loadedBoneyard()?.runId, firstRun.boneyard.runId)
})

test('host exposes and authoritatively loads a selected mod Boneyard', async (context) => {
  const mod = modBoneyardEntry()
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    boneyards: createBoneyardCatalog([mod]),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())
  assert.deepEqual(first.welcome.boneyards, [
    { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    mod.choice,
  ])

  const firstLoaded = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const secondLoaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: mod.choice.id,
  }))
  const [loadedA, loadedB] = await Promise.all([firstLoaded, secondLoaded])
  assert.equal(loadedA.type, 'server-boneyard-loaded')
  assert.equal(loadedB.type, 'server-boneyard-loaded')
  assert.equal(loadedA.boneyard.choice.id, mod.choice.id)
  assert.deepEqual(loadedA.boneyard.scene, mod.scene)
  assert.equal(loadedB.boneyard.runId, loadedA.boneyard.runId)

  const lateSocket = await openSocket(host.address.url)
  context.after(() => lateSocket.close())
  const lateWelcome = nextMessage(lateSocket, (message) => message.type === 'server-welcome')
  const lateLoaded = nextMessage(lateSocket, (message) => message.type === 'server-boneyard-loaded')
  lateSocket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
  }))
  const [welcome, loaded] = await Promise.all([lateWelcome, lateLoaded])
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.equal(welcome.snapshot.world.kind, 'boneyard')
  if (welcome.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(welcome.snapshot.world.runId, loadedA.boneyard.runId)
  assert.equal(loaded.boneyard.runId, loadedA.boneyard.runId)
  assert.deepEqual(
    welcome.snapshot.players[welcome.playerId].position,
    { x: mod.scene.spawn.x, y: mod.scene.spawn.y },
  )
})

test('host authority transfers to the earliest remaining client', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  const transfer = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.hostPlayerId === second.welcome.playerId
  ))
  await closeSocket(first.socket)
  const transferred = await transfer
  assert.equal(transferred.type, 'server-snapshot')

  const loaded = nextMessage(second.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const result = await loaded
  assert.equal(result.type, 'server-boneyard-loaded')
  assert.equal(result.boneyard.choice.id, 'default-random')
})

test('reserved host authority does not depend on loadout completion order', async (context) => {
  const host = await startGameHost({
    authentication: {
      kind: 'reserved-host',
      guestCredential: 'guest-secret',
      hostCredential: 'host-secret',
    },
    snapshotRate: 100,
  })
  context.after(() => host.close())

  const guest = await join(host.address.url, 'guest-secret', SECOND_CHARACTER)
  context.after(() => guest.socket.close())
  assert.equal(guest.welcome.snapshot.hostPlayerId, null)
  assert.equal(host.hostPlayerId(), null)

  guest.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(host.loadedBoneyard(), null)

  const hostAssignment = nextMessage(guest.socket, (message) => (
    message.type === 'server-snapshot' && message.snapshot.hostPlayerId !== null
  ))
  const creator = await join(host.address.url, 'host-secret', FIRST_CHARACTER)
  context.after(() => creator.socket.close())
  assert.equal(creator.welcome.snapshot.hostPlayerId, creator.welcome.playerId)
  assert.equal(host.hostPlayerId(), creator.welcome.playerId)
  const assigned = await hostAssignment
  assert.equal(assigned.type, 'server-snapshot')
  assert.equal(assigned.snapshot.hostPlayerId, creator.welcome.playerId)
})

test('a later guest inherits authority after the reserved host has left', async (context) => {
  const host = await startGameHost({
    authentication: {
      kind: 'reserved-host',
      guestCredential: 'guest-secret',
      hostCredential: 'host-secret',
    },
    snapshotRate: 100,
  })
  context.after(() => host.close())

  const creator = await join(host.address.url, 'host-secret', FIRST_CHARACTER)
  await closeSocket(creator.socket)
  await waitFor(() => host.hostPlayerId() === null)

  const successor = await join(host.address.url, 'guest-secret', SECOND_CHARACTER)
  context.after(() => successor.socket.close())
  assert.equal(successor.welcome.snapshot.hostPlayerId, successor.welcome.playerId)
})

async function join(
  url: string,
  credential: string,
  character: PlayerCharacterConfig,
) {
  const socket = await openSocket(url)
  socket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character,
  }))
  const welcome = await nextMessage(socket, (message) => message.type === 'server-welcome')
  assert.equal(welcome.type, 'server-welcome')
  return { socket, welcome }
}

function closeSocket(socket: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve()
      return
    }
    socket.once('close', resolve)
    socket.close(1000, 'test disconnect')
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

function openSocket(url: string, origin?: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, origin ? { origin } : undefined)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
    socket.once('unexpected-response', (_request, response) => {
      reject(new Error(`upgrade rejected with ${response.statusCode}`))
    })
  })
}

function nextMessage(
  socket: WebSocket,
  predicate: (message: TestServerGameMessage) => boolean,
): Promise<TestServerGameMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game message'))
    }, 3000)
    const receive = (data: WebSocket.RawData) => {
      const message = materializeServerMessage(
        socket,
        decodeServerGameMessage(data.toString()),
      )
      if (!predicate(message)) return
      cleanup()
      resolve(message)
    }
    const fail = (error: Error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

function materializeServerMessage(
  socket: WebSocket,
  message: ServerGameMessage,
): TestServerGameMessage {
  if (message.type === 'server-welcome') {
    const state: TestReplicationState = {
      frames: new Map(),
      reconstructor: new EntityReplicationReconstructor(),
    }
    state.reconstructor.reset(message.snapshot, message.snapshotSequence)
    replicationBySocket.set(socket, state)
    return message
  }
  if (message.type !== 'server-snapshot') return message
  const state = replicationBySocket.get(socket)
  if (!state) throw new Error('test socket received a snapshot before its welcome')
  const cached = state.frames.get(message.sequence)
  if (cached) return cached
  const snapshot = state.reconstructor.apply(message.frame, message.sequence)
  const materialized = { ...message, snapshot }
  state.frames.set(message.sequence, materialized)
  while (state.frames.size > 64) state.frames.delete(state.frames.keys().next().value!)
  socket.send(encodeGameMessage({
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: message.sequence,
  }))
  return materialized
}

function modBoneyardEntry(): ModBoneyardEntry {
  const scene: BoneyardScene = {
    name: 'Contract Arena',
    environmentMode: 2,
    bounds: { x: 0, y: 0, w: 1800, h: 1200 },
    spawn: { x: 300, y: 200, facingDeg: 180 },
    objects: [{
      eid: 'solomon-grave',
      typeId: 2029,
      pos: { x: 290, y: 327 },
      variant: 0,
      overlayVariant: 8,
    }],
    sprites: [],
    roads: [],
    fences: [],
    terrain: [],
    solomonDig: {
      gravePosition: { x: 290, y: 327 },
      lanternPosition: { x: 235, y: 400 },
      position: { x: 300, y: 440 },
      frameProgram: SOLOMON_DIG_FRAME_PROGRAM,
      ticksPerFrame: 5,
    },
  }
  return {
    choice: {
      id: 'mod:tests.contract:contract-arena:111111111111',
      name: 'Contract Arena',
      source: 'mod',
      modId: 'tests.contract',
      modName: 'Contract Boneyard',
    },
    geometrySha256: '1'.repeat(64),
    scene,
    sourceSha256: '2'.repeat(64),
  }
}

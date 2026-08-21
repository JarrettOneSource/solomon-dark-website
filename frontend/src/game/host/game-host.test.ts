import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import {
  BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK,
  BONEYARD_GAME_OVER_EXIT_FADE_TICKS,
} from '../core-kernels/game-run.ts'
import {
  createGameSimulation,
  gameSimulationPlayerRecords,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
} from '../core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
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
import type { GameServerLogEntry } from './game-server-logger.ts'
import { SOLOMON_DIG_FRAME_PROGRAM } from './project-boneyard.ts'
import { GAME_WEBSOCKET_COMPRESSION } from './websocket-compression.ts'
import { createGameSaveDocument } from '../save/game-save-document.ts'

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
const require = createRequire(import.meta.url)
const luaWasmPath = require.resolve('wasmoon/dist/glue.wasm')

type MaterializedServerSnapshotMessage = ServerSnapshotMessage & { snapshot: GameSnapshot }
type TestServerGameMessage =
  | Exclude<ServerGameMessage, ServerSnapshotMessage>
  | MaterializedServerSnapshotMessage

interface TestReplicationState {
  readonly frames: Map<number, MaterializedServerSnapshotMessage>
  readonly reconstructor: EntityReplicationReconstructor
}

const replicationBySocket = new WeakMap<WebSocket, TestReplicationState>()

test('snapshot compression is bounded and skips sub-kilobyte control messages', () => {
  assert.deepEqual(GAME_WEBSOCKET_COMPRESSION, {
    clientNoContextTakeover: true,
    concurrencyLimit: 4,
    serverNoContextTakeover: true,
    threshold: 1_024,
    zlibDeflateOptions: { level: 3, memLevel: 7 },
  })
})

function gameplayInput(
  movement: { x: number; y: number },
  aim: { x: number; y: number } | null = null,
  primary = false,
  secondary: number | null = null,
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

  assert.equal(first.socket.extensions, 'permessage-deflate')
  assert.equal(second.socket.extensions, 'permessage-deflate')

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

test('Hub pause is first-request owned, survives late join, and releases on owner disconnect', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())

  const firstPaused = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  const secondPaused = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  first.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: true }))
  const [pauseA, pauseB] = await Promise.all([firstPaused, secondPaused])
  assert.equal(pauseA.type, 'server-gameplay-pause')
  assert.equal(pauseB.type, 'server-gameplay-pause')
  assert.deepEqual(pauseA.pause, {
    ownerDisplayName: FIRST_CHARACTER.displayName,
    ownerPlayerId: first.welcome.playerId,
  })
  assert.deepEqual(pauseB.pause, pauseA.pause)

  const heldTick = host.state().tick
  const heldPlayers = JSON.stringify(gameSimulationPlayerRecords(host.state()))
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(host.state().tick, heldTick)
  assert.equal(JSON.stringify(gameSimulationPlayerRecords(host.state())), heldPlayers)

  const pausedLuaResult = nextMessage(first.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 99
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'return 1',
    requestId: 99,
  }))
  const luaResult = await pausedLuaResult
  assert.equal(luaResult.type, 'server-lua-result')
  assert.equal(luaResult.ok, false)
  assert.match(luaResult.error ?? '', /paused/)
  assert.equal((await hostHealth(host.address.url)).lua, null)

  second.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: true }))
  second.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(host.state().tick, heldTick)

  const late = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => late.socket.close())
  assert.deepEqual(late.welcome.gameplayPause, pauseA.pause)
  assert.equal(late.welcome.snapshot.tick, heldTick)

  const releasedSecond = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  const releasedLate = nextMessage(late.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  await closeSocket(first.socket)
  const [releaseB, releaseLate] = await Promise.all([releasedSecond, releasedLate])
  assert.deepEqual(releaseB, { type: 'server-gameplay-pause', pause: null })
  assert.deepEqual(releaseLate, releaseB)
  assert.ok(host.state().tick - heldTick <= 10, 'Hub release must not replay paused wall time')
  await waitFor(() => host.state().tick > heldTick)
})

test('Boneyard pause holds the complete world and only its owner can resume', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedA = nextMessage(first.socket, (message) => message.type === 'server-boneyard-loaded')
  const loadedB = nextMessage(second.socket, (message) => message.type === 'server-boneyard-loaded')
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await Promise.all([loadedA, loadedB])
  assert.equal(host.state().world.kind, 'boneyard')

  const pausedA = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  const pausedB = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  second.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: true }))
  const [pauseA, pauseB] = await Promise.all([pausedA, pausedB])
  assert.equal(pauseA.type, 'server-gameplay-pause')
  assert.equal(pauseB.type, 'server-gameplay-pause')
  assert.deepEqual(pauseA.pause, {
    ownerDisplayName: SECOND_CHARACTER.displayName,
    ownerPlayerId: second.welcome.playerId,
  })

  const heldTick = host.state().tick
  const heldWorld = JSON.stringify(host.state().world)
  const heldPlayers = JSON.stringify(gameSimulationPlayerRecords(host.state()))
  await new Promise((resolve) => setTimeout(resolve, 100))
  assert.equal(host.state().tick, heldTick)
  assert.equal(JSON.stringify(host.state().world), heldWorld)
  assert.equal(JSON.stringify(gameSimulationPlayerRecords(host.state())), heldPlayers)

  first.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await new Promise((resolve) => setTimeout(resolve, 60))
  assert.equal(host.state().tick, heldTick)

  const releasedA = nextMessage(first.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  const releasedB = nextMessage(second.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  second.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await Promise.all([releasedA, releasedB])
  assert.ok(host.state().tick - heldTick <= 10, 'Boneyard release must not replay paused wall time')
  await waitFor(() => host.state().tick > heldTick)
})

test('game host routes inventory commands without disconnecting on a stale or unavailable offer', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId
  const initial = getPlayerEconomy(host.state(), playerId)
  const stockItemId = initial.fomentiusStock[0]!.id

  const reconciled = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].economy.revision === initial.revision
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-hub-action',
    action: { type: 'buy-fomentius', itemId: stockItemId },
  }))
  const snapshot = await reconciled
  assert.equal(snapshot.type, 'server-snapshot')
  assert.equal(snapshot.snapshot.players[playerId].economy.gold, 10_000)

  const rejected = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].economy.revision === initial.revision + 1
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-hub-action',
    action: { type: 'consume', itemId: 999_999 },
  }))
  const rejectedSnapshot = await rejected
  assert.equal(rejectedSnapshot.type, 'server-snapshot')
  assert.deepEqual(rejectedSnapshot.snapshot.players[playerId].economy.actionFeedback, {
    accepted: false,
    action: 'consume',
    dowsingPitch: null,
    reason: 'item-not-found',
    sequence: 1,
    transferDirection: null,
    transferGesture: null,
  })

  const pong = nextMessage(client.socket, (message) => (
    message.type === 'server-pong' && message.nonce === 73
  ))
  client.socket.send(encodeGameMessage({ type: 'client-ping', nonce: 73 }))
  assert.deepEqual(await pong, { type: 'server-pong', nonce: 73 })
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
  assert.deepEqual(client.welcome.snapshot.levelUpBarrier?.pendingPlayerIds, [playerId])

  let gameplayPauseMessages = 0
  const observePause = (data: WebSocket.RawData) => {
    if (decodeServerGameMessage(data.toString()).type === 'server-gameplay-pause') {
      gameplayPauseMessages += 1
    }
  }
  client.socket.on('message', observePause)
  client.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: true }))
  await new Promise((resolve) => setTimeout(resolve, 25))
  client.socket.off('message', observePause)
  assert.equal(gameplayPauseMessages, 0)

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
    && message.snapshot.levelUpBarrier === null
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
  assert.equal(selected.snapshot.levelUpBarrier, null)
  assert.deepEqual(
    booked.learnedSkills.find(([learnedSkillId]) => learnedSkillId === skillId),
    [skillId, previousRank + 1, previousRank + 1],
  )
})

test('game host validates and broadcasts the complete Sorceror action sequence', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const playerId = client.welcome.playerId

  const current = host.state()
  const withCharm = {
    ...current,
    playerEntities: replacePlayerEconomy(current.playerEntities, playerId, {
      ...getPlayerEconomy(current, playerId),
      ownedPerkSelectors: [17],
    }),
  }
  Object.assign(current, grantGameSimulationPlayerExperience(withCharm, playerId, 300))
  const firstOffer = getPlayerProgression(host.state(), playerId).pendingOffer!

  const rerolledSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.pendingOffer !== null
    && message.snapshot.players[playerId].progression.pendingOffer.sequence !== firstOffer.sequence
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-level-up-action',
    action: 'reroll',
    offerSequence: firstOffer.sequence,
  }))
  const rerolled = await rerolledSnapshot
  assert.equal(rerolled.type, 'server-snapshot')
  assert.equal(rerolled.snapshot.players[playerId].progression.sorcerorsCharmAvailable, false)
  const rerolledOffer = rerolled.snapshot.players[playerId].progression.pendingOffer!

  const selectedSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.pendingOffer !== null
    && message.snapshot.players[playerId].progression.pendingOffer.sequence !== rerolledOffer.sequence
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-select-skill',
    choiceIndex: 0,
    offerSequence: rerolledOffer.sequence,
    skillId: rerolledOffer.options[0]!.skillId,
  }))
  const selected = await selectedSnapshot
  assert.equal(selected.type, 'server-snapshot')
  assert.equal(selected.snapshot.players[playerId].progression.sorcerorsCharmAvailable, true)
  const saveOffer = selected.snapshot.players[playerId].progression.pendingOffer!

  const savedSnapshot = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[playerId].progression.deferredSkillChoices === 1
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-level-up-action',
    action: 'save',
    offerSequence: saveOffer.sequence,
  }))
  const saved = await savedSnapshot
  assert.equal(saved.type, 'server-snapshot')
  assert.equal(saved.snapshot.players[playerId].progression.deferredSkillChoices, 1)
  assert.ok(saved.snapshot.players[playerId].progression.pendingOffer)
  assert.equal(saved.snapshot.players[playerId].progression.sorcerorsCharmAvailable, true)
})

test('game host authoritatively projects each player skill belt and rejects unlearned selections', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const assigned = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.players[first.welcome.playerId].progression.secondaryBelt[7] === 11
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-assign-belt-skill',
    skillId: 11,
    slot: 7,
  }))
  const assignedSnapshot = await assigned
  assert.equal(assignedSnapshot.type, 'server-snapshot')
  assert.deepEqual(
    assignedSnapshot.snapshot.players[first.welcome.playerId].progression.secondaryBelt,
    [11, null, null, null, null, null, null, 11],
  )
  assert.deepEqual(
    assignedSnapshot.snapshot.players[second.welcome.playerId].progression.secondaryBelt,
    [35, null, null, null, null, null, null, null],
  )

  const rejected = nextMessage(second.socket, (message) => message.type === 'server-disconnect')
  second.socket.send(encodeGameMessage({
    type: 'client-select-concentration',
    skillId: 57,
  }))
  assert.deepEqual(await rejected, {
    type: 'server-disconnect',
    code: 'invalid-message',
    reason: 'The concentration skill is unavailable.',
  })
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

test('game host enforces the declared snapshot cadence range', async () => {
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 0.5,
  }), /snapshotRate must be within 1/)
  await assert.rejects(() => startGameHost({
    authentication: SHARED_AUTHENTICATION,
    snapshotRate: 101,
  }), /snapshotRate must be within 1/)
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

test('game host drops an authenticated player that misses its transport heartbeat', async (context) => {
  const logs: GameServerLogEntry[] = []
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    heartbeatIntervalMs: 50,
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER, false)
  context.after(() => closeSocket(client.socket))
  const closed = new Promise<{ code: number; reason: string }>((resolve) => {
    client.socket.once('close', (code, reason) => resolve({
      code,
      reason: reason.toString(),
    }))
  })

  assert.equal(host.playerCount(), 1)
  await waitFor(() => host.playerCount() === 0)
  assert.deepEqual(await closed, { code: 4000, reason: 'connection timed out' })
  assert.equal(client.socket.readyState, WebSocket.CLOSED)
  const disconnect = logs.find((entry) => entry.event === 'player.disconnected')
  assert.equal(disconnect?.details?.disconnectSource, 'heartbeat-timeout')
  assert.equal(disconnect?.details?.closeCode, 4000)
  assert.equal(disconnect?.details?.playerId, client.welcome.playerId)
})

test('game host records an abnormal player disconnect without inventing a cause', async (context) => {
  const logs: GameServerLogEntry[] = []
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    log: (entry) => logs.push(entry),
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)

  client.socket.terminate()
  await waitFor(() => host.playerCount() === 0)

  const disconnect = logs.find((entry) => entry.event === 'player.disconnected')
  assert.equal(disconnect?.level, 'warning')
  assert.equal(disconnect?.details?.disconnectSource, 'transport-lost')
  assert.equal(disconnect?.details?.closeCode, 1006)
  assert.equal(disconnect?.details?.closeReason, '')
})

test('game host tolerates one delayed transport pong before declaring the client dead', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    heartbeatIntervalMs: 50,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER, false)
  context.after(() => closeSocket(client.socket))
  client.socket.once('ping', () => {
    setTimeout(() => {
      if (client.socket.readyState === WebSocket.OPEN) client.socket.pong()
    }, 60)
  })

  await new Promise((resolve) => setTimeout(resolve, 170))
  assert.equal(host.playerCount(), 1)
  assert.equal(client.socket.readyState, WebSocket.OPEN)
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
  await waitFor(() => host.playerCount() === 0)

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

test('host accepts constructor-owned Boneyard entropy without reusing it as run identity', async (context) => {
  const seedBytes = Buffer.alloc(16, 0x5a)
  let seedRequests = 0
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    createBoneyardSeedBytes: () => {
      seedRequests += 1
      return seedBytes
    },
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const loaded = nextMessage(client.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))

  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))

  const message = await loaded
  assert.equal(message.type, 'server-boneyard-loaded')
  assert.equal(seedRequests, 1)
  assert.equal(message.boneyard.seed, seedBytes.toString('hex'))
  assert.match(message.boneyard.runId, /^[0-9a-f]{32}$/)
  assert.notEqual(message.boneyard.runId, message.boneyard.seed)
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
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(host.state().tick, 0)

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
  const emptyTick = host.state().tick
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.ok(host.state().tick > emptyTick)

  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  assert.equal(second.welcome.snapshot.world.kind, 'boneyard')
  if (second.welcome.snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(second.welcome.snapshot.world.runId, firstRun.boneyard.runId)
  assert.equal(host.loadedBoneyard()?.runId, firstRun.boneyard.runId)
})

test('host emits an owner checkpoint and revives it before a fresh welcome', async (context) => {
  const firstHost = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => firstHost.close())
  const firstSocket = await openSocket(firstHost.address.url)
  context.after(() => firstSocket.close())
  const firstWelcome = nextMessage(firstSocket, (message) => message.type === 'server-welcome')
  const firstCheckpoint = nextMessage(
    firstSocket,
    (message) => message.type === 'server-save-checkpoint' && message.save !== null,
  )
  firstSocket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
  }))
  const [welcomed, checkpoint] = await Promise.all([firstWelcome, firstCheckpoint])
  assert.equal(welcomed.type, 'server-welcome')
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  assert.equal(checkpoint.reason, 'progress')
  assert.ok(checkpoint.save)

  const secondHost = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => secondHost.close())
  const secondSocket = await openSocket(secondHost.address.url)
  context.after(() => secondSocket.close())
  const resumedMessage = nextMessage(secondSocket, (message) => (
    message.type === 'server-welcome' || message.type === 'server-disconnect'
  ))
  secondSocket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save: checkpoint.save,
  }))
  const resumed = await resumedMessage
  assert.equal(resumed.type, 'server-welcome', JSON.stringify(resumed))
  assert.equal(resumed.playerId, welcomed.playerId)
  assert.equal(resumed.snapshot.tick, welcomed.snapshot.tick)
  assert.deepEqual(resumed.snapshot.players[resumed.playerId].config, FIRST_CHARACTER)
  assert.equal(resumed.snapshot.world.kind, 'hub')
})

test('host rejects an unconfirmed save mod mismatch and accepts an explicit continuation', async (context) => {
  const savedMod = {
    contentSha256: 'a'.repeat(64),
    id: 'tests.saved-mod',
    version: '1.0.0',
  }
  const activeMod = {
    contentSha256: 'b'.repeat(64),
    id: 'tests.active-mod',
    version: '2.0.0',
  }
  const save = createGameSaveDocument({
    loadedBoneyard: null,
    mods: [savedMod],
    modState: { 'tests.saved-mod': { retained: true } },
    playerId: 'saved-owner',
    state: createGameSimulation({ 'saved-owner': FIRST_CHARACTER }),
  })
  const options = {
    authentication: SHARED_AUTHENTICATION,
    content: { manifestSha256: 'c'.repeat(64), mods: [activeMod] },
    snapshotRate: 100,
  } as const

  const rejectingHost = await startGameHost(options)
  context.after(() => rejectingHost.close())
  const rejectedSocket = await openSocket(rejectingHost.address.url)
  context.after(() => rejectedSocket.close())
  const rejectedMessage = nextMessage(
    rejectedSocket,
    message => message.type === 'server-disconnect',
  )
  rejectedSocket.send(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save,
  }))
  const rejected = await rejectedMessage
  assert.equal(rejected.type, 'server-disconnect')
  assert.match(rejected.reason, /Confirm the mismatch/)

  const continuingHost = await startGameHost(options)
  context.after(() => continuingHost.close())
  const continuedSocket = await openSocket(continuingHost.address.url)
  context.after(() => continuedSocket.close())
  const continuedMessage = nextMessage(
    continuedSocket,
    message => message.type === 'server-welcome',
  )
  continuedSocket.send(encodeGameMessage({
    type: 'client-hello',
    allowModMismatch: true,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'test-secret',
    character: FIRST_CHARACTER,
    save,
  }))
  const continued = await continuedMessage
  assert.equal(continued.type, 'server-welcome')
  assert.equal(continued.playerId, 'saved-owner')
  assert.deepEqual(continued.content.mods, [activeMod])
  assert.equal(continued.snapshot.world.kind, 'hub')
})

test('host clears the resumable document on the first authoritative Game Over edge', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const active = nextMessage(client.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'active'
  ))
  client.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  await active

  const cleared = nextMessage(client.socket, (message) => (
    message.type === 'server-save-checkpoint'
    && message.reason === 'game-over'
  ))
  Object.assign(host.state().playerEntities.progressions[0]!, {
    lifeState: 'spectating',
  })
  const checkpoint = await cleared
  assert.equal(checkpoint.type, 'server-save-checkpoint')
  assert.deepEqual(checkpoint, {
    type: 'server-save-checkpoint',
    save: null,
    reason: 'game-over',
    sequence: checkpoint.sequence,
  })
  assert.equal(host.state().run.phase, 'game-over')

  let laterProgress = 0
  const countProgress = (data: WebSocket.RawData) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-save-checkpoint' && message.reason === 'progress') {
      laterProgress += 1
    }
  }
  client.socket.on('message', countProgress)
  await new Promise((resolve) => setTimeout(resolve, 100))
  client.socket.off('message', countProgress)
  assert.equal(laterProgress, 0)
})

test('host returns the same multiplayer session from Game Over through loadout to Hub', async (context) => {
  const host = await startGameHost({ authentication: SHARED_AUTHENTICATION, snapshotRate: 100 })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => first.socket.close())
  context.after(() => second.socket.close())

  const loadedMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  const activeMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'active'
    && message.snapshot.world.kind === 'boneyard'
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [loaded, active] = await Promise.all([loadedMessage, activeMessage])
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.equal(active.type, 'server-snapshot')
  const runId = loaded.boneyard.runId
  assert.equal(active.snapshot.run.runId, runId)

  const automaticExitForFirst = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'game-over'
    && message.snapshot.run.gameOverExitTicks === 1
  ))
  const automaticExitForSecond = nextMessage(second.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'game-over'
    && message.snapshot.run.gameOverExitTicks === 1
  ))
  const gameOverState = host.state()
  if (gameOverState.world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  gameOverState.world = {
    ...gameOverState.world,
    hallOfFameRuns: Object.fromEntries(Object.entries(
      gameOverState.world.hallOfFameRuns,
    ).map(([playerId, hallRun]) => [playerId, {
      ...hallRun,
      elapsedTicks: 0,
      portraitHeadingIndex: 12,
      portraitScale: 0.925,
    }])),
  }
  Object.assign(host.state().run, {
    gameOverEventId: 1,
    gameOverTicks: BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK - 1,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })
  assert.equal(host.state().run.gameOverExitTicks, null)
  const [exiting, exitingForSecond] = await Promise.all([
    automaticExitForFirst,
    automaticExitForSecond,
  ])
  assert.equal(exiting.type, 'server-snapshot')
  assert.equal(exitingForSecond.type, 'server-snapshot')
  assert.equal(exiting.snapshot.run.runId, runId)
  assert.equal(exiting.snapshot.run.gameOverEventId, 1)
  assert.equal(exitingForSecond.snapshot.run.gameOverEventId, 1)
  assert.equal(exiting.snapshot.run.gameOverTicks, BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK)
  assert.equal(exiting.snapshot.world.kind, 'boneyard')
  assert.equal(host.loadedBoneyard()?.runId, runId)
  const blackMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'game-over'
    && message.snapshot.run.gameOverExitTicks === BONEYARD_GAME_OVER_EXIT_FADE_TICKS
    && message.snapshot.world.kind === 'boneyard'
  ))
  const loadoutMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'loadout'
    && message.snapshot.world.kind === 'hub'
  ))
  Object.assign(host.state().run, {
    gameOverExitTicks: BONEYARD_GAME_OVER_EXIT_FADE_TICKS - 1,
    gameOverTicks:
      BONEYARD_GAME_OVER_AUTOMATIC_ACCEPT_TICK
      + BONEYARD_GAME_OVER_EXIT_FADE_TICKS
      - 2,
  })
  const [black, loadout] = await Promise.all([blackMessage, loadoutMessage])
  assert.equal(black.type, 'server-snapshot')
  assert.equal(black.snapshot.world.kind, 'boneyard')
  assert.equal(loadout.type, 'server-snapshot')
  assert.equal(loadout.snapshot.run.lastCompletedRunId, runId)
  assert.ok(loadout.snapshot.players[first.welcome.playerId])
  assert.ok(loadout.snapshot.players[second.welcome.playerId])
  assert.equal(host.loadedBoneyard(), null)

  second.socket.send(encodeGameMessage({ type: 'client-confirm-loadout' }))
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(host.state().run.phase, 'loadout')

  const hubMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'hub'
  ))
  first.socket.send(encodeGameMessage({ type: 'client-confirm-loadout' }))
  const hub = await hubMessage
  assert.equal(hub.type, 'server-snapshot')
  assert.equal(hub.snapshot.run.lastCompletedRunId, runId)
  assert.equal(hub.snapshot.hostPlayerId, first.welcome.playerId)
  assert.ok(hub.snapshot.players[first.welcome.playerId])
  assert.ok(hub.snapshot.players[second.welcome.playerId])

  const secondLoadedMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-boneyard-loaded'
    && message.boneyard.runId !== runId
  ))
  const secondActiveMessage = nextMessage(first.socket, (message) => (
    message.type === 'server-snapshot'
    && message.snapshot.run.phase === 'active'
    && message.snapshot.run.runId !== runId
  ))
  first.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const [secondLoaded, secondActive] = await Promise.all([
    secondLoadedMessage,
    secondActiveMessage,
  ])
  assert.equal(secondLoaded.type, 'server-boneyard-loaded')
  assert.equal(secondActive.type, 'server-snapshot')
  assert.notEqual(secondLoaded.boneyard.runId, runId)
  assert.equal(secondActive.snapshot.run.lastCompletedRunId, runId)
  assert.equal(secondActive.snapshot.run.nextGameOverEventId, 2)
  assert.equal(host.playerCount(), 2)
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

test('host lazily executes bounded Lua for authority and applies semantic commands', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    luaWasmPath,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const authority = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const guest = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => authority.socket.close())
  context.after(() => guest.socket.close())
  assert.equal((await hostHealth(host.address.url)).lua, null)

  const guestRejected = nextMessage(guest.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 1
  ))
  guest.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'return 1',
    requestId: 1,
  }))
  const rejected = await guestRejected
  assert.equal(rejected.type, 'server-lua-result')
  assert.equal(rejected.ok, false)
  assert.match(rejected.error ?? '', /session host/)
  assert.equal((await hostHealth(host.address.url)).lua, null)

  const firstResult = nextMessage(authority.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 2
  ))
  authority.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: `
      print('authority', sd.runtime.get_multiplayer_state().is_authority)
      sd.player.set_gold(4321)
      sd.rng.set_seed(42)
      return sd.player.get_state().display_name, sd.runtime.api_version
    `,
    requestId: 2,
  }))
  const executed = await firstResult
  assert.equal(executed.type, 'server-lua-result')
  assert.equal(executed.ok, true)
  assert.deepEqual(executed.output, ['authority\ttrue'])
  assert.deepEqual(executed.values, ['Helvidius', '0.1.0'])
  await waitFor(() => getPlayerEconomy(host.state(), authority.welcome.playerId).gold === 4321)
  assert.notEqual((await hostHealth(host.address.url)).lua, null)

  const loadedMessage = nextMessage(authority.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  authority.socket.send(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  }))
  const loaded = await loadedMessage
  assert.equal(loaded.type, 'server-boneyard-loaded')
  assert.equal(loaded.boneyard.seed, `0000002a${'00'.repeat(12)}`)

  const spawnResult = nextMessage(authority.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 3
  ))
  authority.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'return sd.enemies.spawn("skeleton", {x = 250, y = 250}).request_id',
    requestId: 3,
  }))
  const spawned = await spawnResult
  assert.equal(spawned.type, 'server-lua-result')
  assert.deepEqual(spawned.values, [1])
  await waitFor(() => {
    const current = host.state()
    return current.world.kind === 'boneyard' && current.world.enemies.actors.length === 1
  })
  const current = host.state()
  if (current.world.kind !== 'boneyard') assert.fail('expected Boneyard')
  assert.equal(current.world.enemies.actors[0]?.config.enemyToken, 'SKELETON')
})

test('Lua authority migrates and reset-when-empty retires the VM', async (context) => {
  const host = await startGameHost({
    authentication: SHARED_AUTHENTICATION,
    luaWasmPath,
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  context.after(() => host.close())
  const first = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  const second = await join(host.address.url, 'test-secret', SECOND_CHARACTER)
  context.after(() => second.socket.close())
  await closeSocket(first.socket)
  await waitFor(() => host.hostPlayerId() === second.welcome.playerId)

  const resultMessage = nextMessage(second.socket, (message) => (
    message.type === 'server-lua-result' && message.requestId === 4
  ))
  second.socket.send(encodeGameMessage({
    type: 'client-lua-execute',
    code: 'persistent = 99; return persistent',
    requestId: 4,
  }))
  const result = await resultMessage
  assert.equal(result.type, 'server-lua-result')
  assert.deepEqual(result.values, [99])
  assert.notEqual((await hostHealth(host.address.url)).lua, null)
  await closeSocket(second.socket)
  await waitFor(() => host.playerCount() === 0)
  assert.equal((await hostHealth(host.address.url)).lua, null)
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

async function join(
  url: string,
  credential: string,
  character: PlayerCharacterConfig,
  autoPong = true,
) {
  const socket = await openSocket(url, undefined, autoPong)
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
  const deadline = performance.now() + 5000
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

async function hostHealth(url: string): Promise<{ lua: unknown }> {
  const endpoint = new URL(url)
  endpoint.protocol = endpoint.protocol === 'wss:' ? 'https:' : 'http:'
  endpoint.pathname = '/health'
  const response = await fetch(endpoint)
  assert.equal(response.status, 200)
  return response.json() as Promise<{ lua: unknown }>
}

function openSocket(url: string, origin?: string, autoPong = true): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { autoPong, ...(origin ? { origin } : {}) })
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

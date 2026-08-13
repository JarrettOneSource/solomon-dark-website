import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createGameSimulation,
  enterBoneyardWorld,
} from '../core-server/game-simulation.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerWelcomeMessage,
} from './game-protocol.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('client protocol validates character hello and tick-indexed input messages', () => {
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    resumeToken: 'reserved-token',
  })), {
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
    resumeToken: 'reserved-token',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-input',
    input: { movement: { x: 1, y: 0 } },
    sequence: 4,
    targetTick: 19,
  })), {
    type: 'client-input',
    input: { movement: { x: 1, y: 0 } },
    sequence: 4,
    targetTick: 19,
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-start-match',
    boneyardId: 'default-random',
  })), {
    type: 'client-start-match',
    boneyardId: 'default-random',
  })
})

test('server welcome round-trips content, kernel, character, and world ownership', () => {
  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: {
      manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256,
      mods: [],
    },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(
      createGameSimulation({ 'player-1': CHARACTER }),
      'player-1',
    ),
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)
  assert.deepEqual(welcome.snapshot.players['player-1'].config, CHARACTER)
  assert.equal(welcome.snapshot.world.kind, 'hub')
})

test('protocol rejects legacy, malformed, and unsupported discriminated payloads', () => {
  assert.throws(() => decodeClientGameMessage('{'), GameProtocolError)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    displayName: 'legacy',
  })), /displayName|character/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: { ...CHARACTER, element: 'void' },
  })), /element/)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: { movement: { x: 2, y: 0 } },
    sequence: 1,
    targetTick: 1,
  })), /magnitude/)

  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: { ...snapshot, world: { ...snapshot.world, kind: 'unknown' } },
  })), /kind/)
  const malformed = JSON.parse(JSON.stringify(snapshot))
  delete malformed.players['player-1'].config
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: malformed,
  })), /config/)
})

test('protocol rejects player ids reserved by ordinary JavaScript records', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: {
      ...snapshot,
      players: { ['__proto__']: snapshot.players['player-1'] },
    },
  })), /player id.*reserved/)
})

test('protocol validates participant ownership and the recovered Hub room graph', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const message = (world: unknown) => JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: { ...snapshot, world },
  })

  assert.throws(() => decodeServerGameMessage(message({
    ...snapshot.world,
    participants: {},
  })), /participants must match snapshot.players exactly/)

  assert.throws(() => decodeServerGameMessage(message({
    ...snapshot.world,
    participants: {
      'player-1': {
        region: 'mortuary',
        transition: {
          alpha: 0.5,
          destination: 'library',
          phase: 'outgoing',
          scriptedSpeed: 1,
          scriptedTarget: { x: 512, y: 2024 },
          sourceRegion: 'mortuary',
        },
      },
    },
  })), /transition is inconsistent/)

  assert.throws(() => decodeServerGameMessage(message({
    ...snapshot.world,
    participants: {
      'player-1': {
        region: 'courtyard',
        transition: {
          alpha: 1.1,
          destination: 'office',
          phase: 'outgoing',
          scriptedSpeed: 0.45,
          scriptedTarget: { x: 881.5, y: -1000 },
          sourceRegion: 'courtyard',
        },
      },
    },
  })), /alpha must be within/)
})

test('protocol bounds server-controlled world collections', () => {
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  assert.equal(snapshot.world.kind, 'hub')
  if (snapshot.world.kind !== 'hub') throw new Error('expected Hub snapshot')
  const hubWorld = snapshot.world
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      movementThresholdSquared: Math.fround(0.01),
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: {
      ...snapshot,
      world: {
        ...hubWorld,
        students: Array.from({ length: 257 }, () => hubWorld.students[0]),
      },
    },
  })), /at most 256/)
})

test('loaded Boneyard round-trips scene identity, geometry, and Solomon Dig', () => {
  const message = {
    type: 'server-boneyard-loaded' as const,
    boneyard: {
      choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' as const },
      runId: 'run-one',
      seed: '0123456789abcdef',
      sourceSha256: '1'.repeat(64),
      geometrySha256: '2'.repeat(64),
      scene: {
        name: 'Random Level',
        environmentMode: 2,
        bounds: { x: 0, y: 0, w: 1600, h: 1200 },
        spawn: { x: 200, y: 150, facingDeg: 180 },
        objects: [],
        sprites: [],
        roads: [],
        fences: [{
          eid: 'entry-gate',
          points: [{ x: 100, y: 300 }, { x: 300, y: 300 }],
          segmentCode: 2,
          typeId: 3005,
        }],
        terrain: [],
        solomonDig: {
          gravePosition: { x: 190, y: 277 },
          lanternPosition: { x: 135, y: 350 },
          position: { x: 200, y: 390 },
          frameProgram: [0, 3, 17, 3],
          ticksPerFrame: 5,
        },
      },
    },
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)

  const snapshot = createGameSnapshot(
    enterBoneyardWorld(
      createGameSimulation({ 'player-1': CHARACTER }),
      message.boneyard,
    ),
    'player-1',
  )
  assert.equal(snapshot.world.kind, 'boneyard')
  if (snapshot.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(snapshot.world.gateLeaves.length, 2)
  const snapshotMessage = {
    acknowledgedInputSequence: 0,
    snapshot,
    type: 'server-snapshot' as const,
  }
  assert.deepEqual(
    decodeServerGameMessage(encodeGameMessage(snapshotMessage)),
    snapshotMessage,
  )

  const malformed = JSON.parse(encodeGameMessage(snapshotMessage))
  delete malformed.snapshot.world.gateLeaves[0].tip
  assert.throws(
    () => decodeServerGameMessage(JSON.stringify(malformed)),
    /tip/,
  )
})

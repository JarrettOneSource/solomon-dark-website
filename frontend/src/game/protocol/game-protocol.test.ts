import assert from 'node:assert/strict'
import test from 'node:test'

import { createGameSimulation } from '../core-server/game-simulation.ts'
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
      playerRadius: 25,
    },
    content: {
      manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256,
      mods: [],
    },
    snapshot: createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER })),
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

  const snapshot = createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }))
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: { ...snapshot, world: { ...snapshot.world, kind: 'boneyard' } },
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
  const snapshot = createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }))
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: {
      ...snapshot,
      players: { ['__proto__']: snapshot.players['player-1'] },
    },
  })), /player id.*reserved/)
})

test('protocol bounds server-controlled world collections', () => {
  const snapshot = createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }))
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
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    snapshot: {
      ...snapshot,
      world: {
        ...snapshot.world,
        students: Array.from({ length: 257 }, () => snapshot.world.students[0]),
      },
    },
  })), /at most 256/)
})

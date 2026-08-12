import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubSimulation } from '../core-server/hub-simulation.ts'
import { createHubSnapshot } from '../host/hub-snapshot.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  HUB_KERNEL_VERSION,
  GameProtocolError,
  decodeClientGameMessage,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerWelcomeMessage,
} from './game-protocol.ts'

test('client protocol validates hello and tick-indexed input messages', () => {
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    displayName: 'Helvidius',
    resumeToken: 'reserved-token',
  })), {
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    displayName: 'Helvidius',
    resumeToken: 'reserved-token',
  })
  assert.deepEqual(decodeClientGameMessage(encodeGameMessage({
    type: 'client-input',
    input: { x: 1, y: 0 },
    sequence: 4,
    targetTick: 19,
  })), {
    type: 'client-input',
    input: { x: 1, y: 0 },
    sequence: 4,
    targetTick: 19,
  })
})

test('server welcome round-trips content, kernel, resume, and snapshot ownership', () => {
  const welcome: ServerWelcomeMessage = {
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: HUB_KERNEL_VERSION,
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
    snapshot: createHubSnapshot(createHubSimulation(['player-1'])),
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(welcome)), welcome)
})

test('protocol rejects malformed JSON, unbounded vectors, and malformed snapshots', () => {
  assert.throws(() => decodeClientGameMessage('{'), GameProtocolError)
  assert.throws(() => decodeClientGameMessage(JSON.stringify({
    type: 'client-input',
    input: { x: 2, y: 0 },
    sequence: 1,
    targetTick: 1,
  })), /magnitude/)
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: {},
  })), GameProtocolError)

  const snapshot = JSON.parse(JSON.stringify(
    createHubSnapshot(createHubSimulation(['player-1'])),
  ))
  delete snapshot.players['player-1'].walkCyclePrimary
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot,
  })), /walkCyclePrimary/)
})

test('protocol bounds server-controlled snapshot collections', () => {
  const snapshot = createHubSnapshot(createHubSimulation(['player-1']))
  assert.throws(() => decodeServerGameMessage(JSON.stringify({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-token',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: HUB_KERNEL_VERSION,
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    snapshot: { ...snapshot, students: Array.from({ length: 257 }, () => snapshot.students[0]) },
  })), /at most 256/)
})

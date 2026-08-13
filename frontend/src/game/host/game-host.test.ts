import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import type { PlayerCharacterConfig } from '../core-kernels/player-character.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerGameMessage,
} from '../protocol/game-protocol.ts'
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

test('authoritative game host owns two configured player characters and movement', async (context) => {
  const host = await startGameHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
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
    input: { movement: { x: 1, y: 0 } },
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

test('game host reconnects a new character at the active world spawn', async (context) => {
  const host = await startGameHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
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
  const host = await startGameHost({ bootstrapCredential: 'test-secret' })
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
    bootstrapCredential: 'test-secret',
    host: '0.0.0.0',
  }), /trusted secure proxy/)
  await assert.rejects(() => startGameHost({
    bootstrapCredential: 'test-secret',
    host: '0.0.0.0',
    trustedProxy: true,
  }), /nonempty allowedOrigins/)
})

test('game host rejects intent targeting implausibly far-future ticks', async (context) => {
  const host = await startGameHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: { movement: { x: 1, y: 0 } },
    sequence: 1,
    targetTick: client.welcome.snapshot.tick + 1000,
  }))
  const message = await nextMessage(client.socket, (entry) => entry.type === 'server-disconnect')
  assert.equal(message.type, 'server-disconnect')
  assert.equal(message.code, 'invalid-message')
})

test('game host applies only the newest character input for a simulation tick', async (context) => {
  const host = await startGameHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
  context.after(() => host.close())
  const client = await join(host.address.url, 'test-secret', FIRST_CHARACTER)
  context.after(() => client.socket.close())
  const origin = client.welcome.snapshot.players[client.welcome.playerId].position
  const targetTick = client.welcome.snapshot.tick + 1
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: { movement: { x: 1, y: 0 } },
    sequence: 1,
    targetTick,
  }))
  client.socket.send(encodeGameMessage({
    type: 'client-input',
    input: { movement: { x: 0, y: 1 } },
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

test('host starts one exact random Boneyard for every connected client', async (context) => {
  const host = await startGameHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
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

test('host exposes and authoritatively loads a selected mod Boneyard', async (context) => {
  const mod = modBoneyardEntry()
  const host = await startGameHost({
    bootstrapCredential: 'test-secret',
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
  const host = await startGameHost({ bootstrapCredential: 'test-secret', snapshotRate: 100 })
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
  predicate: (message: ServerGameMessage) => boolean,
): Promise<ServerGameMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for game message'))
    }, 3000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
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

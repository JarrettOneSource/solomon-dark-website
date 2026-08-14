import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createGameSimulation,
  enterBoneyardWorld,
} from '../core-server/game-simulation.ts'
import {
  createPlayerCharacter,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import {
  createGameSnapshotFrame,
  createReplicatedEntityBaseline,
} from '../protocol/entity-replication.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  PLAYER_CHARACTER_KERNEL_VERSION,
  decodeClientGameMessage,
  encodeGameMessage,
} from '../protocol/game-protocol.ts'
import { connectGameClientSession } from './game-client-session.ts'
import { predictPlayerCharacterInHub } from './hub-prediction.ts'
import type { GameTransport } from './game-transport.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

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

test('client carries character config, publishes authority, and tears down', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  assert.deepEqual(decodeClientGameMessage(transport.sent[0]), {
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    character: CHARACTER,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting
  assert.equal(session.isHost, true)
  assert.equal(session.boneyards[0].id, 'default-random')
  session.startMatch('default-random')
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-start-match',
    boneyardId: 'default-random',
  })
  let receivedRunId: string | null = null
  session.onBoneyard((boneyard) => { receivedRunId = boneyard.runId })
  transport.receive(encodeGameMessage({
    type: 'server-boneyard-loaded',
    boneyard: {
      choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
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
        fences: [],
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
  }))
  assert.equal(session.getBoneyard()?.runId, 'run-one')
  assert.equal(receivedRunId, 'run-one')
  const origin = session.getSnapshot().players['player-1'].position
  assert.deepEqual(session.getSnapshot().players['player-1'].config, CHARACTER)
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  const firstInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(firstInput.type, 'client-input')
  session.sendInput(gameplayInput({ x: 0, y: 1 }))
  const replacementInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(replacementInput.type, 'client-input')
  assert.equal(
    replacementInput.targetTick,
    firstInput.type === 'client-input' ? firstInput.targetTick : -1,
  )
  receiveSnapshot(transport, createGameSnapshot(serverState, 'player-1'), 0)
  assert.deepEqual(presented.players['player-1'].position, origin)
  receiveSnapshot(transport, createGameSnapshot(serverState, 'player-1'), 2)
  assert.deepEqual(presented.players['player-1'].position, origin)

  const loadedBoneyard = session.getBoneyard()
  assert.ok(loadedBoneyard)
  receiveSnapshot(
    transport,
    createGameSnapshot(
      enterBoneyardWorld(serverState, loadedBoneyard),
      'player-1',
    ),
    2,
  )
  assert.equal(session.getSnapshot().world.kind, 'boneyard')
  assert.equal(session.samplePresentation().world.kind, 'hub')
  assert.equal(session.sampleBoneyardPresentation().world.kind, 'boneyard')

  session.destroy()
  assert.equal(decodeClientGameMessage(transport.sent.at(-1)!).type, 'client-disconnect')
  assert.equal(transport.readyState, 'closed')
})

test('client schedules every cast-level transition on a distinct fixed tick', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting

  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 100, y: 200 }, true))
  const pressed = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(pressed.type, 'client-input')

  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 110, y: 210 }))
  const released = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(released.type, 'client-input')
  if (pressed.type !== 'client-input' || released.type !== 'client-input') {
    assert.fail('expected client input messages')
  }
  assert.equal(released.targetTick, pressed.targetTick + 1)

  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 120, y: 220 }))
  const moved = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(moved.type, 'client-input')
  if (moved.type !== 'client-input') assert.fail('expected client input message')
  assert.equal(moved.targetTick, released.targetTick)
  assert.deepEqual(moved.input, gameplayInput({ x: 0, y: 0 }, { x: 120, y: 220 }))

  const messageCount = transport.sent.length
  session.sendInput(gameplayInput({ x: 0, y: 0 }, { x: 120, y: 220 }))
  assert.equal(transport.sent.length, messageCount)
  session.destroy()
})

test('client measures authenticated WebSocket round trips with its monotonic clock', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  receiveWelcome(
    transport,
    createGameSnapshot(createGameSimulation({ 'player-1': CHARACTER }), 'player-1'),
  )
  const session = await connecting
  const ping = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.deepEqual(ping, { type: 'client-ping', nonce: 1 })
  assert.equal(session.getPingMs(), null)

  const samples: number[] = []
  const removePing = session.onPing((pingMs) => samples.push(pingMs))
  nowMs += 38
  transport.receive(encodeGameMessage({ type: 'server-pong', nonce: 2 }))
  assert.equal(session.getPingMs(), null)
  assert.deepEqual(samples, [])

  transport.receive(encodeGameMessage({ type: 'server-pong', nonce: 1 }))
  assert.equal(session.getPingMs(), 38)
  assert.deepEqual(samples, [38])

  removePing()
  session.destroy()
  nowMs += 10
  transport.receive(encodeGameMessage({ type: 'server-pong', nonce: 1 }))
  assert.deepEqual(samples, [38])
})

test('client disables prediction when the shared character kernel does not match', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: 'future-player-character-kernel',
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  receiveSnapshot(transport, createGameSnapshot(serverState, 'player-1'), 0)
  assert.equal(presented.players['player-1'].position.x, origin)
  session.destroy()
})

test('client presents bounded display-rate movement without resending unchanged input', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(serverState, 'player-1'),
    snapshotSequence: 1,
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x

  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  const messagesAfterChange = transport.sent.length
  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  assert.equal(transport.sent.length, messagesAfterChange)

  nowMs += 20
  const early = session.samplePresentation()
  nowMs += 30
  const atSnapshotBoundary = session.samplePresentation()
  nowMs += 500
  const bounded = session.samplePresentation()
  assert.ok(early.players['player-1'].position.x > origin)
  assert.ok(atSnapshotBoundary.players['player-1'].position.x > early.players['player-1'].position.x)
  assert.equal(
    bounded.players['player-1'].position.x,
    atSnapshotBoundary.players['player-1'].position.x,
  )
  session.destroy()
})

test('client applies direction changes only to future presentation ticks', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  receiveWelcome(transport, createGameSnapshot(serverState, 'player-1'))
  const session = await connecting

  session.sendInput(gameplayInput({ x: 1, y: 0 }))
  nowMs += 40
  const beforeTurn = session.samplePresentation()
  session.sendInput(gameplayInput({ x: 0, y: 1 }))
  const atTurn = session.samplePresentation()

  assert.deepEqual(
    atTurn.players['player-1'].position,
    beforeTurn.players['player-1'].position,
  )
  assert.equal(
    atTurn.players['player-1'].headingIndex,
    beforeTurn.players['player-1'].headingIndex,
  )
  session.destroy()
})

test('client does not rewind a locally presented turn while acknowledgement is delayed', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  const source = createGameSnapshot(serverState, 'player-1')
  const sourcePlayer = source.players['player-1']
  const eastboundPlayer = {
    ...sourcePlayer,
    headingIndex: 6,
    velocity: { x: 90, y: 0 },
  }
  const initialSnapshot = {
    ...source,
    players: { ...source.players, 'player-1': eastboundPlayer },
    tick: 100,
  }
  receiveWelcome(transport, initialSnapshot)
  const session = await connecting
  session.samplePresentation()

  session.sendInput(gameplayInput({ x: 0, y: 1 }))
  nowMs += 50
  const beforeSnapshot = session.samplePresentation()
  assert.ok(beforeSnapshot.players['player-1'].headingIndex > eastboundPlayer.headingIndex)

  let authoritativePlayer = eastboundPlayer
  let collisionRngState = initialSnapshot.world.kind === 'hub'
    ? initialSnapshot.world.collisionRngState
    : 0
  for (let tick = 0; tick < 5; tick += 1) {
    const predicted = predictPlayerCharacterInHub(
      authoritativePlayer,
      gameplayInput({ x: 1, y: 0 }),
      collisionRngState,
      initialSnapshot.world.kind === 'hub'
        ? initialSnapshot.world.participants['player-1']
        : undefined,
    )
    authoritativePlayer = predicted.player
    collisionRngState = predicted.collisionRngState
  }
  receiveSnapshot(transport, {
      ...initialSnapshot,
      players: { ...initialSnapshot.players, 'player-1': authoritativePlayer },
      tick: 105,
      world: initialSnapshot.world.kind === 'hub'
        ? { ...initialSnapshot.world, collisionRngState }
        : initialSnapshot.world,
  }, 0)
  const afterSnapshot = session.samplePresentation()

  assert.equal(
    afterSnapshot.players['player-1'].headingIndex,
    beforeSnapshot.players['player-1'].headingIndex,
  )
  assert.deepEqual(
    afterSnapshot.players['player-1'].position,
    beforeSnapshot.players['player-1'].position,
  )
  session.destroy()
})

test('client accepts cast-owned heading and prevents movement prediction from replacing it', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  const initialSnapshot = createGameSnapshot(serverState, 'player-1')
  receiveWelcome(transport, initialSnapshot)
  const session = await connecting

  session.sendInput(gameplayInput(
    { x: -1, y: 0 },
    { x: 900, y: 450 },
  ))
  const castHeadingIndex = 8
  const castRadians = castHeadingIndex * 15 * Math.PI / 180
  nowMs += 50
  receiveSnapshot(transport, {
    ...initialSnapshot,
    players: {
      ...initialSnapshot.players,
      'player-1': {
        ...initialSnapshot.players['player-1'],
        headingIndex: castHeadingIndex,
        primaryCast: {
          actionTick: 20,
          aimDirection: {
            x: Math.sin(castRadians),
            y: -Math.cos(castRadians),
          },
          castSequence: 1,
          channelActive: false,
          emissionSequence: 1,
          held: false,
        },
      },
    },
    tick: initialSnapshot.tick + 5,
  }, 0)

  assert.equal(
    session.samplePresentation().players['player-1'].headingIndex,
    castHeadingIndex,
  )
  nowMs += 20
  assert.equal(
    session.samplePresentation().players['player-1'].headingIndex,
    castHeadingIndex,
  )
  session.destroy()
})

test('client visually absorbs an unpredicted push over one snapshot interval', async () => {
  let nowMs = 1_000
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    now: () => nowMs,
    transport,
  })
  const serverState = createGameSimulation({ 'player-1': CHARACTER })
  const initialSnapshot = createGameSnapshot(serverState, 'player-1')
  receiveWelcome(transport, initialSnapshot)
  const session = await connecting
  const beforePush = session.samplePresentation()
  const origin = beforePush.players['player-1'].position
  const pushedX = origin.x + 10

  nowMs += 50
  receiveSnapshot(transport, {
      ...initialSnapshot,
      players: {
        ...initialSnapshot.players,
        'player-1': {
          ...initialSnapshot.players['player-1'],
          position: { x: pushedX, y: origin.y },
        },
      },
      tick: initialSnapshot.tick + 5,
  }, 0)
  const atArrival = session.samplePresentation()
  nowMs += 25
  const halfway = session.samplePresentation()
  nowMs += 25
  const settled = session.samplePresentation()

  assert.deepEqual(atArrival.players['player-1'].position, origin)
  assert.ok(Math.abs(halfway.players['player-1'].position.x - (origin.x + 5)) < 0.0001)
  assert.equal(settled.players['player-1'].position.x, pushedX)
  assert.equal(settled.players['player-1'].position.y, origin.y)
  session.destroy()
})

test('client predicts the authoritative scripted transition walk without accepting input', () => {
  const player = createPlayerCharacter(CHARACTER, { x: 100, y: 100 })
  const predicted = predictPlayerCharacterInHub(
    player,
    gameplayInput({ x: -1, y: 0 }),
    123,
    {
      region: 'courtyard',
      transition: {
        alpha: 0.4,
        destination: 'storeroom',
        phase: 'outgoing',
        scriptedSpeed: 0.45,
        scriptedTarget: { x: 100, y: -1000 },
        sourceRegion: 'courtyard',
      },
    },
  )

  assert.equal(predicted.player.position.x, 100)
  assert.ok(predicted.player.position.y < 100)
  assert.equal(predicted.collisionRngState, 123)
})

test('client rejects a welcome that omits its assigned player', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'missing-player',
    resumeToken: 'reserved-missing-player',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot: createGameSnapshot(createGameSimulation({}), null),
    snapshotSequence: 1,
  }))
  await assert.rejects(connecting, /does not contain the assigned player/)
})

test('client requests a keyframe after a replication gap and resumes cleanly', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    character: CHARACTER,
    credential: 'spawn-secret',
    transport,
  })
  const snapshot = createGameSnapshot(
    createGameSimulation({ 'player-1': CHARACTER }),
    'player-1',
  )
  receiveWelcome(transport, snapshot)
  const session = await connecting
  const beforeGap = transport.sent.length
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(
      snapshot,
      99,
      createReplicatedEntityBaseline(snapshot),
    ),
    sequence: 10,
  }))
  assert.equal(transport.sent.length, beforeGap + 1)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-snapshot-ack',
    requireKeyframe: true,
    sequence: 1,
  })

  const recovered = {
    ...snapshot,
    tick: snapshot.tick + 5,
  }
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(recovered, 0, undefined, true),
    sequence: 11,
  }))
  assert.equal(session.getSnapshot().tick, recovered.tick)
  assert.deepEqual(decodeClientGameMessage(transport.sent.at(-1)!), {
    type: 'client-snapshot-ack',
    requireKeyframe: false,
    sequence: 11,
  })
  session.destroy()
})

function kernelParameters() {
  return {
    fixedTickSeconds: 0.01,
    movementAcceleration: 10,
    movementLaneCap: 118.75,
    movementRetention: 0.9,
    movementThresholdSquared: Math.fround(0.01),
    playerRadius: 25,
  }
}

function receiveWelcome(
  transport: MemoryTransport,
  snapshot: ReturnType<typeof createGameSnapshot>,
): void {
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: PLAYER_CHARACTER_KERNEL_VERSION,
    kernelParameters: kernelParameters(),
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    boneyards: [{ id: 'default-random', name: 'Random Boneyard', source: 'default' }],
    snapshot,
    snapshotSequence: 1,
  }))
}

let nextSnapshotSequence = 10

function receiveSnapshot(
  transport: MemoryTransport,
  snapshot: ReturnType<typeof createGameSnapshot>,
  acknowledgedInputSequence: number,
): void {
  const sequence = nextSnapshotSequence
  nextSnapshotSequence += 1
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence,
  }))
}

class MemoryTransport implements GameTransport {
  readyState: GameTransport['readyState'] = 'open'
  readonly sent: string[] = []
  private readonly closeListeners = new Set<(reason: string) => void>()
  private readonly messageListeners = new Set<(payload: string) => void>()

  close(): void {
    this.readyState = 'closed'
  }

  onClose(listener: (reason: string) => void): () => void {
    this.closeListeners.add(listener)
    return () => this.closeListeners.delete(listener)
  }

  onMessage(listener: (payload: string) => void): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  receive(payload: string): void {
    for (const listener of this.messageListeners) listener(payload)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }
}

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
  decodeClientGameMessage,
  encodeGameMessage,
} from '../protocol/game-protocol.ts'
import { connectGameClientSession } from './game-client-session.ts'
import type { GameTransport } from './game-transport.ts'

const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Helvidius',
  element: 'ether',
} as const

test('client carries character config, predicts input, reconciles, and tears down', async () => {
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
  session.sendInput({ movement: { x: 1, y: 0 } })
  const firstInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(firstInput.type, 'client-input')
  session.sendInput({ movement: { x: 0, y: 1 } })
  const replacementInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(replacementInput.type, 'client-input')
  assert.equal(
    replacementInput.targetTick,
    firstInput.type === 'client-input' ? firstInput.targetTick : -1,
  )
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: createGameSnapshot(serverState, 'player-1'),
  }))
  assert.equal(presented.players['player-1'].position.x, origin.x)
  assert.ok(presented.players['player-1'].position.y > origin.y)
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 2,
    snapshot: createGameSnapshot(serverState, 'player-1'),
  }))
  assert.deepEqual(presented.players['player-1'].position, origin)

  const loadedBoneyard = session.getBoneyard()
  assert.ok(loadedBoneyard)
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 2,
    snapshot: createGameSnapshot(
      enterBoneyardWorld(serverState, loadedBoneyard),
      'player-1',
    ),
  }))
  assert.equal(session.getSnapshot().world.kind, 'boneyard')
  assert.equal(session.samplePresentation().world.kind, 'hub')

  session.destroy()
  assert.equal(decodeClientGameMessage(transport.sent.at(-1)!).type, 'client-disconnect')
  assert.equal(transport.readyState, 'closed')
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
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput({ movement: { x: 1, y: 0 } })
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: createGameSnapshot(serverState, 'player-1'),
  }))
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
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x

  session.sendInput({ movement: { x: 1, y: 0 } })
  const messagesAfterChange = transport.sent.length
  session.sendInput({ movement: { x: 1, y: 0 } })
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
  }))
  await assert.rejects(connecting, /does not contain the assigned player/)
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

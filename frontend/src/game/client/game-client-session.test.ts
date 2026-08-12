import assert from 'node:assert/strict'
import test from 'node:test'

import { createHubSimulation } from '../core-server/hub-simulation.ts'
import { createHubSnapshot } from '../host/hub-snapshot.ts'
import {
  EMPTY_CONTENT_MANIFEST_SHA256,
  GAME_PROTOCOL_VERSION,
  HUB_KERNEL_VERSION,
  decodeClientGameMessage,
  encodeGameMessage,
} from '../protocol/game-protocol.ts'
import { connectGameClientSession } from './game-client-session.ts'
import type { GameTransport } from './game-transport.ts'

test('client session handshakes, sends intent, predicts, reconciles, and tears down', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({
    credential: 'spawn-secret',
    displayName: 'Helvidius',
    transport,
  })
  assert.deepEqual(decodeClientGameMessage(transport.sent[0]), {
    type: 'client-hello',
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: 'spawn-secret',
    displayName: 'Helvidius',
  })
  const serverState = createHubSimulation(['player-1'])
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
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
    snapshot: createHubSnapshot(serverState),
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput({ x: 1, y: 0 })
  const firstInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(firstInput.type, 'client-input')
  session.sendInput({ x: 0, y: 1 })
  const replacementInput = decodeClientGameMessage(transport.sent.at(-1)!)
  assert.equal(replacementInput.type, 'client-input')
  assert.equal(replacementInput.targetTick, firstInput.type === 'client-input' ? firstInput.targetTick : -1)
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: createHubSnapshot(serverState),
  }))
  assert.equal(presented.players['player-1'].position.x, origin)
  assert.ok(presented.players['player-1'].position.y > serverState.players['player-1'].position.y)
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 2,
    snapshot: createHubSnapshot(serverState),
  }))
  assert.equal(presented.players['player-1'].position.x, origin)

  session.destroy()
  assert.equal(decodeClientGameMessage(transport.sent.at(-1)!).type, 'client-disconnect')
  assert.equal(transport.readyState, 'closed')
})

test('client disables prediction when the authoritative kernel does not match', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({ credential: 'spawn-secret', transport })
  const serverState = createHubSimulation(['player-1'])
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'player-1',
    resumeToken: 'reserved-player-1',
    serverTickRate: 100,
    snapshotRate: 20,
    kernelVersion: 'future-hub-kernel',
    kernelParameters: {
      fixedTickSeconds: 0.01,
      movementAcceleration: 10,
      movementLaneCap: 118.75,
      movementRetention: 0.9,
      playerRadius: 25,
    },
    content: { manifestSha256: EMPTY_CONTENT_MANIFEST_SHA256, mods: [] },
    snapshot: createHubSnapshot(serverState),
  }))
  const session = await connecting
  const origin = session.getSnapshot().players['player-1'].position.x
  let presented = session.getSnapshot()
  session.onSnapshot((snapshot) => { presented = snapshot })
  session.sendInput({ x: 1, y: 0 })
  transport.receive(encodeGameMessage({
    type: 'server-snapshot',
    acknowledgedInputSequence: 0,
    snapshot: createHubSnapshot(serverState),
  }))
  assert.equal(presented.players['player-1'].position.x, origin)
  session.destroy()
})

test('client rejects a welcome that omits its assigned player', async () => {
  const transport = new MemoryTransport()
  const connecting = connectGameClientSession({ credential: 'spawn-secret', transport })
  transport.receive(encodeGameMessage({
    type: 'server-welcome',
    protocolVersion: GAME_PROTOCOL_VERSION,
    playerId: 'missing-player',
    resumeToken: 'reserved-missing-player',
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
    snapshot: createHubSnapshot(createHubSimulation([])),
  }))
  await assert.rejects(connecting, /does not contain the assigned player/)
})

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

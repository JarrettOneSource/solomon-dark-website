import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'

import { HUB_SPAWN } from '../core-kernels/hub-math.ts'
import {
  createGameSimulation,
  gameSimulationPlayerRecords,
  getPlayerProgression,
} from '../core-server/game-simulation.ts'
import { createMlBotPolicyActionMaskPlan } from '../core-server/ml-bot-policy/actions.ts'
import {
  createZeroMlBotPolicyCheckpoint,
  encodeMlBotPolicyCheckpoint,
} from '../core-server/ml-bot-policy/checkpoint.ts'
import { MlBotPolicyObserver } from '../core-server/ml-bot-policy/observer.ts'
import { MlBotPolicyRuntime } from '../core-server/ml-bot-policy/runtime.ts'
import { EntityReplicationReconstructor } from '../protocol/entity-replication.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
  type ServerWelcomeMessage,
} from '../protocol/game-protocol.ts'
import type { GameSnapshot } from '../protocol/game-state.ts'
import { startGameHost } from './game-host.ts'
import { MlBotPolicyInferenceWorker } from './ml-bot-host-controller.ts'

const HUMAN = {
  discipline: 'arcane',
  displayName: 'Human',
  element: 'ether',
} as const
const BOT = {
  discipline: 'arcane',
  displayName: 'Policy Bot',
  element: 'fire',
} as const
const CREDENTIAL = 'ml-bot-host-test-secret'

test('host inference worker preserves strict autoregressive runtime output', async () => {
  const checkpoint = movementCheckpoint(1)
  checkpoint.tensors.value_bias[0] = 0.25
  const encoded = encodeMlBotPolicyCheckpoint(checkpoint)
  const worker = await MlBotPolicyInferenceWorker.create(encoded)
  try {
    const state = createGameSimulation({ agent: BOT })
    const frame = new MlBotPolicyObserver('agent').observe(state, {
      activeInputs: {},
      controllers: { agent: 'bot' },
    })
    const plan = createMlBotPolicyActionMaskPlan(state, 'agent', frame)
    const expected = new MlBotPolicyRuntime(checkpoint).inferAutoregressive(
      frame.values,
      { movement: plan.movement, target: plan.target },
      target => plan.abilityByTarget[target]!,
      (_target, ability) => plan.aimByAbility[ability]!,
      { mode: 'argmax' },
    )
    const actual = await worker.infer(frame.values, plan)
    assert.deepEqual(actual.actions, expected.actions)
    assert.equal(actual.logProbability, expected.logProbability)
    assert.equal(actual.value, expected.value)
  } finally {
    await worker.close()
  }
})

test('server-hosted bot joins, replicates, moves through client-input, and leaves with humans', async () => {
  const host = await startGameHost({
    authentication: { kind: 'shared', credential: CREDENTIAL },
    mlBots: [{
      character: BOT,
      checkpoint: encodeMlBotPolicyCheckpoint(movementCheckpoint(2)),
      credential: CREDENTIAL,
    }],
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  const socket = await openSocket(host.address.url)
  try {
    assert.equal(host.playerCount(), 0)
    assert.deepEqual(host.botPlayerIds(), [])
    const welcome = await hello(socket)
    const reconstructor = new EntityReplicationReconstructor()
    reconstructor.reset(welcome.snapshot, welcome.snapshotSequence)
    await waitFor(() => host.botPlayerIds().length === 1)
    const botPlayerId = host.botPlayerIds()[0]!
    assert.equal(host.hostPlayerId(), welcome.playerId)
    assert.equal(host.playerCount(), 2)
    const snapshot = await nextSnapshot(socket, reconstructor, current => (
      current.players[botPlayerId] !== undefined
    ))
    assert.deepEqual(snapshot.players[botPlayerId]?.config, BOT)
    assert.equal(Object.hasOwn(snapshot.players[botPlayerId]!, 'controller'), false)
    await waitFor(() => {
      const bot = gameSimulationPlayerRecords(host.state())[botPlayerId]
      if (!bot) return false
      return Math.hypot(bot.position.x - HUB_SPAWN.x, bot.position.y - HUB_SPAWN.y) > 0
    })
    await closeSocket(socket)
    await waitFor(() => host.playerCount() === 0)
    assert.deepEqual(host.botPlayerIds(), [])
  } finally {
    await closeSocket(socket)
    await host.close()
  }
})

test('server-hosted bot answers its skill offer through the scripted W10 message path', async () => {
  const host = await startGameHost({
    authentication: { kind: 'shared', credential: CREDENTIAL },
    initialPlayerExperience: 100,
    mlBots: [{
      character: BOT,
      checkpoint: encodeMlBotPolicyCheckpoint(movementCheckpoint(3)),
      credential: CREDENTIAL,
    }],
    snapshotRate: 100,
  })
  const socket = await openSocket(host.address.url)
  try {
    const welcome = await hello(socket)
    await waitFor(() => host.botPlayerIds().length === 1)
    const botPlayerId = host.botPlayerIds()[0]!
    await waitFor(() => getPlayerProgression(host.state(), botPlayerId).pendingOffer === null)
    assert.notEqual(getPlayerProgression(host.state(), welcome.playerId).pendingOffer, null)
    assert.equal(getPlayerProgression(host.state(), botPlayerId).level, 2)
  } finally {
    await closeSocket(socket)
    await host.close()
  }
})

function movementCheckpoint(seed: number) {
  const checkpoint = createZeroMlBotPolicyCheckpoint(seed)
  for (let action = 1; action < checkpoint.tensors.movement_bias.length; action += 1) {
    checkpoint.tensors.movement_bias[action] = 1
  }
  return checkpoint
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function hello(socket: WebSocket): Promise<ServerWelcomeMessage> {
  const welcome = nextWelcome(socket)
  socket.send(encodeGameMessage({
    character: HUMAN,
    cheatsEnabled: false,
    credential: CREDENTIAL,
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: 'client-hello',
  }))
  return welcome
}

function nextWelcome(socket: WebSocket): Promise<ServerWelcomeMessage> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('timed out waiting for server welcome')), 10_000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (message.type === 'server-welcome') finish(message)
    }
    const fail = (error: Error) => finish(error)
    const finish = (result: Error | ServerWelcomeMessage) => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

function nextSnapshot(
  socket: WebSocket,
  reconstructor: EntityReplicationReconstructor,
  predicate: (snapshot: GameSnapshot) => boolean,
): Promise<GameSnapshot> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('timed out waiting for bot snapshot')), 10_000)
    const receive = (data: WebSocket.RawData) => {
      const message = decodeServerGameMessage(data.toString())
      if (message.type !== 'server-snapshot') return
      const snapshot = reconstructor.apply(message.frame, message.sequence)
      if (predicate(snapshot)) finish(snapshot)
    }
    const fail = (error: Error) => finish(error)
    const finish = (result: Error | GameSnapshot) => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
}

function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise(resolve => {
    socket.once('close', resolve)
    socket.close(1_000, 'test complete')
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = performance.now() + 10_000
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('timed out waiting for ML bot host state')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

import { performance } from 'node:perf_hooks'

import { WebSocket } from 'ws'

import {
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  createGameSimulation,
} from '../src/game/core-server/game-simulation.ts'
import { createHubStudentFixturePopulation } from '../src/game/core-server/hub-student-fixtures.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'
import * as replication from '../src/game/protocol/entity-replication.ts'
import { GameSaveCoordinator } from '../src/game/save/game-save-coordinator.ts'

const AUTHENTICATION = { kind: 'shared', credential: 'benchmark-secret' }
const ONLINE_PREFERENCES = {
  activityMessages: true,
  globalChat: true,
  submitRuns: false,
}

async function benchmarkCoordinator() {
  const store = new DelayedStore(5)
  const saveCoordinator = new GameSaveCoordinator(store, () => {})
  await saveCoordinator.load()
  const startedAt = performance.now()
  const outcomes = Array.from({ length: 100 }, (_, index) => saveCoordinator.accept({
    document: `checkpoint-${index + 1}`,
    reason: index === 99 ? 'game-over' : 'progress',
    sequence: index + 1,
    streamId: 1,
  }))
  await Promise.all(outcomes)
  await saveCoordinator.idle()
  return {
    elapsedMs: performance.now() - startedAt,
    finalDocument: saveCoordinator.current()?.document ?? null,
    requestedCheckpoints: outcomes.length,
    storeWrites: store.writeCount,
  }
}

async function benchmarkCheckpointFanout() {
  const logs = []
  const host = await startGameHost({
    authentication: AUTHENTICATION,
    log: entry => logs.push(entry),
    snapshotRate: 20,
  })
  const clients = []
  try {
    for (let index = 0; index < 5; index += 1) {
      clients.push(await connectClient(
        host.address.url,
        `Checkpoint-${index + 1}`,
      ))
    }
    await delay(250)
    for (const client of clients) client.resetCounters()
    const active = host.state()
    for (const client of clients) {
      Object.assign(active, grantGameSimulationPlayerExperience(
        active,
        client.playerId,
        100,
      ))
    }
    const startedAt = performance.now()
    let choices = 0
    for (const client of clients) {
      while (true) {
        const offer = getPlayerProgression(host.state(), client.playerId).pendingOffer
        if (!offer) break
        client.socket.send(encodeGameMessage({
          type: 'client-select-skill',
          choiceIndex: 0,
          offerSequence: offer.sequence,
          skillId: offer.options[0].skillId,
        }))
        choices += 1
        await waitFor(() => {
          const next = getPlayerProgression(host.state(), client.playerId).pendingOffer
          return next?.sequence !== offer.sequence
        })
      }
    }
    await waitFor(() => host.state().levelUpBarrier === null)
    await delay(500)
    const batches = logs.filter(entry => (
      entry.event === 'save.checkpoint_batch_completed'
      && entry.details?.sources?.includes('skill-picker-closed')
    ))
    return {
      choices,
      elapsedMs: performance.now() - startedAt,
      perClientCheckpointBytes: clients.map(client => client.checkpointBytes),
      perClientCheckpointMessages: clients.map(client => client.checkpointMessages),
      schedulerBatches: batches.map(entry => entry.details),
      totalCheckpointBytes: clients.reduce((total, client) => total + client.checkpointBytes, 0),
      totalCheckpointMessages: clients.reduce(
        (total, client) => total + client.checkpointMessages,
        0,
      ),
    }
  } finally {
    await Promise.allSettled(clients.map(client => closeSocket(client.socket)))
    await host.close()
  }
}

async function benchmarkSlowPeer() {
  const logs = []
  const host = await startGameHost({
    authentication: AUTHENTICATION,
    log: entry => logs.push(entry),
    snapshotRate: 20,
  })
  const slow = await connectClient(host.address.url, 'Slow')
  const healthy = await connectClient(host.address.url, 'Healthy')
  try {
    slow.ackSnapshots = false
    slow.snapshotSequences.length = 0
    healthy.snapshotSequences.length = 0
    await waitFor(() => slow.snapshotSequences.length >= 8)
    await delay(700)
    const framesBeforeAck = slow.snapshotSequences.length
    const healthyFramesBeforeAck = healthy.snapshotSequences.length
    const acknowledgedSequence = slow.snapshotSequences.at(-3)
    if (acknowledgedSequence === undefined) throw new Error('slow peer has no acknowledgement')
    const resumedAt = performance.now()
    slow.socket.send(encodeGameMessage({
      type: 'client-snapshot-ack',
      requireKeyframe: false,
      sequence: acknowledgedSequence,
    }))
    await waitFor(() => slow.snapshotSequences.length > framesBeforeAck)
    const resumedSequence = slow.snapshotSequences[framesBeforeAck]
    return {
      baselineMissingEvents: logs.filter(entry => (
        entry.event === 'replication.baseline_missing'
      )).length,
      flowRecovered: logs.find(entry => (
        entry.event === 'replication.flow_control_recovered'
      ))?.details ?? null,
      flowStarted: logs.find(entry => (
        entry.event === 'replication.flow_control_started'
      ))?.details ?? null,
      healthyFramesBeforeAck,
      resumeLatencyMs: performance.now() - resumedAt,
      resumedSequenceGap: resumedSequence - acknowledgedSequence,
      slowFramesBeforeAck: framesBeforeAck,
    }
  } finally {
    await Promise.allSettled([closeSocket(slow.socket), closeSocket(healthy.socket)])
    await host.close()
  }
}

function benchmarkSnapshotProjection() {
  const state = createGameSimulation({}, {
    hubStudentPopulation: createHubStudentFixturePopulation({ count: 256, seed: 0x12345678 }),
  })
  const snapshot = createGameSnapshot(state, null)
  const baseline = replication.createReplicatedEntityBaseline(snapshot)
  const iterations = 100
  const peers = 5
  for (let index = 0; index < 10; index += 1) {
    replication.createGameSnapshotFrame(snapshot, 1, baseline)
  }
  const uncachedStartedAt = performance.now()
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let peer = 0; peer < peers; peer += 1) {
      replication.createGameSnapshotFrame(snapshot, 1, baseline)
    }
  }
  const uncachedMs = performance.now() - uncachedStartedAt
  if (typeof replication.createGameSnapshotProjection !== 'function') {
    return { cachedMs: null, iterations, peers, uncachedMs }
  }
  const cachedStartedAt = performance.now()
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const projected = replication.createGameSnapshotProjection(snapshot)
    for (let peer = 0; peer < peers; peer += 1) {
      replication.createGameSnapshotFrame(snapshot, 1, baseline, false, projected)
    }
  }
  return {
    cachedMs: performance.now() - cachedStartedAt,
    iterations,
    peers,
    uncachedMs,
  }
}

async function connectClient(url, displayName) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.once('open', resolve)
    socket.once('error', reject)
  })
  const reconstructor = new replication.EntityReplicationReconstructor()
  let resolveWelcome
  let rejectWelcome
  const welcome = new Promise((resolve, reject) => {
    resolveWelcome = resolve
    rejectWelcome = reject
  })
  const lane = {
    ackSnapshots: true,
    checkpointBytes: 0,
    checkpointMessages: 0,
    playerId: null,
    resetCounters() {
      lane.checkpointBytes = 0
      lane.checkpointMessages = 0
    },
    snapshotSequences: [],
    socket,
  }
  socket.on('message', data => {
    let message
    try {
      message = decodeServerGameMessage(data.toString())
      if (message.type === 'server-welcome') {
        lane.playerId = message.playerId
        reconstructor.reset(message.snapshot, message.snapshotSequence)
        resolveWelcome(message)
        return
      }
      if (message.type === 'server-snapshot') {
        lane.snapshotSequences.push(message.sequence)
        if (lane.ackSnapshots) {
          reconstructor.apply(message.frame, message.sequence)
          socket.send(encodeGameMessage({
            type: 'client-snapshot-ack',
            requireKeyframe: false,
            sequence: message.sequence,
          }))
        }
        return
      }
      if (message.type === 'server-save-checkpoint') {
        lane.checkpointMessages += 1
        lane.checkpointBytes += Buffer.byteLength(message.save)
      }
    } catch (error) {
      rejectWelcome(error)
    }
  })
  socket.send(encodeGameMessage({
    character: { discipline: 'arcane', displayName, element: 'ether' },
    cheatsEnabled: false,
    credential: 'benchmark-secret',
    onlinePreferences: ONLINE_PREFERENCES,
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: 'client-hello',
  }))
  await welcome
  return lane
}

class DelayedStore {
  constructor(delayMs) {
    this.delayMs = delayMs
    this.record = null
    this.writeCount = 0
  }

  async read() {
    return this.record
  }

  async write(document, expectedRevision) {
    this.writeCount += 1
    await delay(this.delayMs)
    if ((this.record?.revision ?? 0) !== expectedRevision) {
      throw new Error('benchmark revision conflict')
    }
    this.record = { document, revision: expectedRevision + 1, slot: 0 }
    return this.record
  }
}

function closeSocket(socket) {
  return new Promise(resolve => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve()
      return
    }
    socket.once('close', resolve)
    socket.close(1000, 'benchmark complete')
  })
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('benchmark condition timed out')
    await delay(5)
  }
}

const coordinator = await benchmarkCoordinator()
const checkpoint = await benchmarkCheckpointFanout()
const flowControl = await benchmarkSlowPeer()
const projection = benchmarkSnapshotProjection()

process.stdout.write(`${JSON.stringify({
  checkpoint,
  coordinator,
  flowControl,
  projection,
})}\n`)

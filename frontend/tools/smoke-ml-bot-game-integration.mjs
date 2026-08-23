import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

import { WebSocket } from 'ws'

import { gameSimulationPlayerRecords } from '../src/game/core-server/game-simulation.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { MlBotPolicyInferenceWorker } from '../src/game/host/ml-bot-host-controller.ts'

const require = createRequire(import.meta.url)
const checkpointPath = process.env.SDR_ML_BOT_CHECKPOINT
  ?? 'server-assets/ml-bot-policy-v5-selected.sdml'
const durationMs = integerArgument('--duration-ms', 90_000)
const policy = await MlBotPolicyInferenceWorker.create(await readFile(checkpointPath))
const admission = {
  content: {
    assets: [],
    boneyards: [],
    manifest: { manifestSha256: '0'.repeat(64), mods: [] },
    modSources: [],
    summary: { manifestSha256: '0'.repeat(64), mods: [] },
  },
  developerAccess: true,
  leaderboardUserId: 1,
}
let ticketAvailable = true
const host = await startGameHost({
  authentication: {
    kind: 'tickets',
    claim: credential => {
      if (!ticketAvailable || credential !== 'ml-bot-smoke-ticket') return null
      ticketAvailable = false
      return admission
    },
  },
  luaWasmPath: require.resolve('wasmoon/dist/glue.wasm'),
  mlBotPolicy: policy,
  sessionKind: 'global-hub',
  sharedHub: true,
  snapshotRate: 20,
})
const socket = await openSocket(host.address.url)

try {
  const welcome = await hello(socket)
  assert.equal(welcome.developerAccess, true)
  const summon = await executeLua(
    socket,
    1,
    'sd.rng.set_seed(1592594436); return sd.bots.summon()',
  )
  assert.equal(summon.ok, true, summon.error ?? 'bot summon failed')
  await waitFor(() => host.botCount() === 1)
  const botPlayerId = host.botPlayerIds()[0]
  assert.equal(typeof botPlayerId, 'string')
  socket.send(encodeGameMessage({
    type: 'client-party-invite',
    targetPlayerId: botPlayerId,
  }))
  await waitForPartyMember(socket, botPlayerId, 5_000)
  const boneyardId = welcome.boneyards.find(choice => choice.source === 'default')?.id
  assert.equal(typeof boneyardId, 'string')
  socket.send(encodeGameMessage({ type: 'client-start-match', boneyardId }))
  await waitFor(() => host.playerState(botPlayerId)?.world.kind === 'boneyard', 10_000)

  const startedAt = performance.now()
  let maximumTravel = 0
  let origin = null
  let lastReportAt = Number.NEGATIVE_INFINITY
  while (performance.now() - startedAt < durationMs) {
    const active = host.playerState(botPlayerId)
    assert.ok(active)
    const player = gameSimulationPlayerRecords(active)[botPlayerId]
    assert.ok(player)
    origin ??= player.position
    maximumTravel = Math.max(
      maximumTravel,
      Math.hypot(player.position.x - origin.x, player.position.y - origin.y),
    )
    const telemetry = host.botTelemetry()[0]
    assert.ok(telemetry)
    const elapsedMs = Math.round(performance.now() - startedAt)
    if (elapsedMs - lastReportAt >= 5_000) {
      lastReportAt = elapsedMs
      process.stdout.write(`${JSON.stringify({
        arenaTransition: active.world.kind === 'boneyard'
          ? active.world.arenaTransition?.phase ?? null
          : null,
        elapsedMs,
        encounterPhase: active.world.kind === 'boneyard'
          ? active.world.encounter?.phase ?? null
          : null,
        encounterPosition: active.world.kind === 'boneyard'
          ? active.world.encounter?.position ?? null
          : null,
        maximumTravel,
        playerPosition: player.position,
        telemetry,
        type: 'progress',
      })}\n`)
    }
    if (telemetry.kills >= 10 && telemetry.decisions >= 25 && telemetry.waveReached >= 1) break
    await delay(100)
  }
  const telemetry = host.botTelemetry()[0]
  assert.ok(telemetry)
  assert.ok(telemetry.decisions >= 25, 'the live bot made fewer than 25 policy decisions')
  assert.ok(maximumTravel > 1, 'the live bot never moved in the Boneyard')
  assert.ok(telemetry.kills >= 10, 'the live bot killed fewer than ten enemies')
  assert.ok(telemetry.waveReached >= 1, 'the live bot did not reach the first numbered wave')
  process.stdout.write(`${JSON.stringify({
    checkpointPath,
    maximumTravel,
    status: 'ok',
    telemetry,
    type: 'result',
  })}\n`)
} finally {
  await closeSocket(socket)
  await waitFor(() => host.botCount() === 0)
  await host.close()
  await policy.close()
}

function integerArgument(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = Number(process.argv[index + 1])
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be positive`)
  return value
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

async function hello(socket) {
  const welcome = nextMessage(socket, message => message.type === 'server-welcome')
  socket.send(encodeGameMessage({
    character: { discipline: 'arcane', displayName: 'Smoke Human', element: 'ether' },
    cheatsEnabled: false,
    credential: 'ml-bot-smoke-ticket',
    profile: { accountUsername: 'Generic', highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: 'client-hello',
  }))
  return await welcome
}

async function executeLua(socket, requestId, code) {
  const result = nextMessage(socket, message => (
    message.type === 'server-lua-result' && message.requestId === requestId
  ))
  socket.send(encodeGameMessage({ type: 'client-lua-execute', code, requestId }))
  return await result
}

function waitForPartyMember(socket, playerId, timeoutMs) {
  return nextMessage(socket, message => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.includes(playerId)
  ), timeoutMs)
}

function nextMessage(socket, predicate, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('timed out waiting for server message')), timeoutMs)
    const receive = data => {
      const message = decodeServerGameMessage(data.toString())
      if (predicate(message)) finish(message)
    }
    const fail = error => finish(error)
    const finish = result => {
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

function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise(resolve => {
    socket.once('close', resolve)
    socket.close(1_000, 'smoke complete')
  })
}

async function waitFor(predicate, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error('timed out waiting for game host state')
    await delay(10)
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

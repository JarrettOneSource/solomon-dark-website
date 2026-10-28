import { createHash, randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { monitorEventLoopDelay, performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { writeSoakEvidence } from './party-soak-evidence.mjs'
import { SOAK_MUTATION } from './party-soak-settings.mjs'
import {
  materializeWebSessionContent, compileWebSessionContentDefinitions,
} from '../src/game/host/web-mod-content.ts'

const output = resolve(required('SDR_SOAK_OUTPUT'))
const sampleMs = number('SDR_SOAK_SAMPLE_MS', 5000)
const webPort = number('SDR_SOAK_WEB_PORT', 4191)
const hostPort = number('SDR_SOAK_HOST_PORT', 4192)
const wasmPath = createRequire(import.meta.url).resolve('wasmoon/dist/glue.wasm')
const source = await readFile(new URL('./party-soak-pilot.lua', import.meta.url), 'utf8')
const id = 'local.performance.party-soak'
const version = '1.1.0'
const contentSha256 = hash(`${id}\0${version}\0${source}`)
const content = await compileWebSessionContentDefinitions(materializeWebSessionContent({
  manifestSha256: hash(`${id}\0${version}\0${contentSha256}`),
  mods: [{ id, name: 'Private invincible endurance pilot', slug: 'party-soak', version,
    priority: 0, entryScript: source, contentSha256, boneyards: [], files: [] }],
}), wasmPath)

await mkdir(output, { recursive: true })
const events = createWriteStream(join(output, 'server-events.jsonl'), { flags: 'wx' })
const samples = createWriteStream(join(output, 'server.jsonl'), { flags: 'wx' })
events.on('error', fatal)
samples.on('error', fatal)
const credential = randomBytes(32).toString('base64url')
let host
let staticServer
let timer
let stopping = false
const loop = monitorEventLoopDelay({ resolution: 10 })
const startedAt = Date.now()
let previousCpu = process.cpuUsage()
let previousAt = performance.now()
let previousTick = null
let previousRun = null
let warnings = 0
let errors = 0
let ruleFailures = 0
let ruleTimeouts = 0

try {
  staticServer = await startStaticClientServer({
    root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)), port: webPort,
  })
  host = await startGameHost({
    host: '127.0.0.1', port: hostPort, allowedOrigins: [staticServer.origin],
    authentication: { kind: 'shared', credential }, sessionKind: 'private-college',
    maxPlayers: 2, snapshotRate: 20, luaWasmPath: wasmPath,
    content: content.manifest, contentSummary: content.summary, modContent: content,
    modAssets: content.assets,
    log: entry => {
      warnings += Number(entry.level === 'warn' || entry.level === 'warning')
      errors += Number(entry.level === 'error')
      events.write(JSON.stringify(entry) + '\n')
      if (entry.event === 'simulation.tick_failed') writeSoakEvidence(output, 'server-fatal.json', entry)
      if (entry.event === 'mods.rule_failed') {
        ruleFailures += 1
        ruleTimeouts += Number(entry.message.includes('thread timeout exceeded'))
      }
    },
    archiveRun: archive => {
      const summary = {
        runId: archive.runId, startedAtUtc: archive.startedAtUtc,
        endedAtUtc: archive.endedAtUtc, endReason: archive.endReason,
        tickCount: archive.performance.tickCount,
        meanTickMs: archive.performance.totalTickMs / Math.max(1, archive.performance.tickCount),
        overBudgetTicks: archive.performance.overBudgetTicks,
        worstTickMs: archive.worstTick.tickMs, recent: archive.performance.recent,
        ruleFailures, ruleTimeouts,
        final: summarizeState(archive.finalState),
      }
      writeSoakEvidence(output, `archive-${archive.id}.json`, archive)
      writeSoakEvidence(output, 'archive-summary.json', summary)
    },
  })
  loop.enable()
  timer = setInterval(sample, sampleMs)
  const runtime = { gameEndpoint: { credential, kind: 'localhost', url: host.address.url } }
  await writeFile(join(output, 'runtime.json'), JSON.stringify(runtime), { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ event: 'soak-runtime.ready', pid: process.pid,
    origin: staticServer.origin, hostUrl: host.address.url, output,
    pilotSha256: hash(source), mutation: SOAK_MUTATION }))
  process.once('SIGINT', () => void stop())
  process.once('SIGTERM', () => void stop())
} catch (error) {
  await stop()
  throw error
}

function sample() {
  const now = performance.now()
  const durationSeconds = (now - previousAt) / 1000
  const cpu = process.cpuUsage()
  const memory = process.memoryUsage()
  const state = host.state()
  const row = {
    atUtc: new Date().toISOString(), elapsedSeconds: (Date.now() - startedAt) / 1000,
    durationSeconds,
    cpuPercent: (cpu.user + cpu.system - previousCpu.user - previousCpu.system) / (durationSeconds * 10000),
    rssMiB: memory.rss / 1048576, heapUsedMiB: memory.heapUsed / 1048576,
    heapTotalMiB: memory.heapTotal / 1048576, externalMiB: memory.external / 1048576,
    arrayBuffersMiB: memory.arrayBuffers / 1048576,
    eventLoopP95Ms: loop.percentile(95) / 1e6, eventLoopP99Ms: loop.percentile(99) / 1e6,
    eventLoopMaximumMs: loop.max / 1e6,
    humanPlayers: host.humanPlayerCount(), partyCount: host.partyCount(), runCount: host.runCount(),
    serverTickHz: previousTick !== null && previousRun === state.run.runId
      ? (state.tick - previousTick) / durationSeconds : null,
    warnings, errors, ruleFailures, ruleTimeouts, ...summarizeState(state),
  }
  samples.write(JSON.stringify(row) + '\n')
  console.log(JSON.stringify(row))
  previousAt = now
  previousCpu = cpu
  previousTick = state.tick
  previousRun = state.run.runId
  loop.reset()
}

function summarizeState(state) {
  const world = state.world
  const livingEnemies = world.kind === 'boneyard' ? world.enemies.actors.filter(actor => (
    actor.currentHealth > 0 && actor.lifeState !== 'dying'
  )) : []
  const livingBosses = livingEnemies.filter(actor => actor.config.classification !== 'normal')
  return {
    tick: state.tick, runId: state.run.runId, runPhase: state.run.phase, world: world.kind,
    wave: world.kind === 'boneyard' ? world.waves?.waveOrdinal ?? 0 : null,
    wavePhase: world.kind === 'boneyard' ? world.waves?.phase ?? null : null,
    enemies: world.kind === 'boneyard' ? world.enemies.actors.length : 0,
    maggots: world.kind === 'boneyard' ? world.enemies.maggots.length : 0,
    enemyDeathEffects: world.kind === 'boneyard' ? world.enemies.deathEffects.length : 0,
    enemyProjectiles: world.kind === 'boneyard' ? world.enemies.projectiles.length : 0,
    enemyProjectileEffects: world.kind === 'boneyard' ? world.enemies.projectileEffects.length : 0,
    primaryProjectiles: state.primarySpells.projectiles.length,
    primaryTransients: state.primarySpells.transients.length,
    secondaryActors: state.secondaryAbilities.actors.length,
    livingEnemyCount: livingEnemies.length, livingBossCount: livingBosses.length,
    bossesTruncated: livingBosses.length > 16,
    bosses: livingBosses.slice(0, 16).map(actor => ({
      id: actor.id, kind: actor.config.enemyToken, classification: actor.config.classification,
      recipeName: actor.config.recipeName, recipeUid: actor.config.recipeUid,
      health: actor.currentHealth, maximumHealth: actor.config.maximumHealth,
      position: actor.position,
    })),
    loot: world.kind === 'boneyard' ? world.loot.actors.length : 0,
    players: state.playerEntities.identities.map(({ playerId }, index) => ({
      id: playerId, position: state.playerEntities.locomotions[index].position,
      health: state.playerEntities.progressions[index].currentHealth,
      mana: state.playerEntities.progressions[index].currentMana,
      level: state.playerEntities.progressions[index].level,
      experience: state.playerEntities.progressions[index].experience,
      primaryCastSequence: state.playerEntities.primaryCasts[index].castSequence,
      primaryEmissionSequence: state.playerEntities.primaryCasts[index].emissionSequence,
      primaryChannelActive: state.playerEntities.primaryCasts[index].channelActive,
      primaryTargetId: state.playerEntities.primaryCasts[index].targetId,
      maximumMana: state.playerEntities.progressions[index].maximumMana,
      primarySkillId: state.playerEntities.skillBooks[index].primarySkillId,
      secondaryCastSequence: state.secondaryAbilities.players[playerId]?.castSequence ?? 0,
      secondaryLastSkillId: state.secondaryAbilities.players[playerId]?.lastSkillId ?? null,
      secondaryGlobalCooldown: state.secondaryAbilities.players[playerId]?.globalCooldownTicks ?? 0,
      lifeState: state.playerEntities.progressions[index].lifeState,
    })),
  }
}

async function stop() {
  if (stopping) return
  stopping = true
  clearInterval(timer)
  loop.disable()
  if (host) await host.close()
  if (staticServer) await staticServer.close()
  await Promise.all([events, samples].map(stream => new Promise(resolveEnd => stream.end(resolveEnd))))
  console.log(JSON.stringify({ event: 'soak-runtime.closed', warnings, errors, ruleFailures, ruleTimeouts }))
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function number(name, fallback) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

function hash(value) { return createHash('sha256').update(value).digest('hex') }
function fatal(error) { console.error(error); process.exitCode = 1; void stop() }

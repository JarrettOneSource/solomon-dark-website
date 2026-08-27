import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer as createViteServer } from 'vite'

import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import {
  canPlaceBoneyardBody,
  clipBoneyardSegment,
} from '../src/game/core-server/boneyard-collision.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
} from '../src/game/core-server/boneyard-enemy-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { grantPlayerEntityWeldBuild } from '../src/game/core-server/player-entity-store.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_WELD_BLIZZARD_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-weld-blizzard-collision')
const credential = randomBytes(32).toString('base64url')

await mkdir(screenshotRoot, { recursive: true })
const frontend = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await frontend.listen()
const address = frontend.httpServer?.address()
if (!address || typeof address === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its Blizzard acceptance port')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  resetWhenEmpty: true,
  snapshotRate: 20,
})

try {
  const browserReceipt = runFocusedSmoke({
    ...process.env,
    SDR_GAME_SMOKE_CREDENTIAL: credential,
    SDR_GAME_SMOKE_ENDPOINT: host.address.url,
    SDR_GAME_SMOKE_URL: baseUrl,
    SDR_PRIMARY_SPELL_BLIZZARD_COLLISION_ACCEPTANCE: '1',
    SDR_PRIMARY_SPELL_BONEYARD_ONLY: '1',
    SDR_PRIMARY_SPELL_HOST_OPENED_BONEYARD: '1',
    SDR_PRIMARY_SPELL_KIND: 'blizzard',
    SDR_PRIMARY_SPELL_SCREENSHOT_ROOT: screenshotRoot,
  })
  const fixture = await prepareBlizzardRun(host)
  const [receipt, combat] = await Promise.all([
    browserReceipt,
    observeBlizzardContact(host, fixture),
  ])
  assert.equal(receipt.status, 'ok')
  assert.equal(receipt.boneyard.wire.state.buildId, 1004)
  assert.ok(receipt.boneyard.channelCount >= 1 && receipt.boneyard.channelCount <= 2)
  assert.ok(receipt.boneyard.glowCount >= 2)
  assert.ok(combat.direct.currentHealth < combat.direct.initialHealth)
  assert.ok(combat.chain.currentHealth < combat.chain.initialHealth)
  assert.equal(combat.outside.currentHealth, combat.outside.initialHealth)
  assert.ok(combat.direct.coldSlowTicks > 0 && combat.direct.stunTicks > 0)
  assert.ok(combat.chain.coldSlowTicks > 0 && combat.chain.stunTicks > 0)
  assert.notEqual(combat.direct.blizzardPushLastTick, null)
  assert.ok(combat.transientKinds.includes('weld-frost-fade'))
  assert.ok(combat.transientKinds.includes('weld-blizzard-glow'))
  assert.deepEqual(receipt.errors, [])
  process.stdout.write(`${JSON.stringify({ combat, receipt, screenshotRoot, status: 'ok' })}\n`)
} finally {
  await Promise.all([host.close(), frontend.close()])
}

async function prepareBlizzardRun(host) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const state = host.state()
    if (state.world.kind === 'boneyard') {
      const playerId = state.playerEntities.identities[0]?.playerId
      if (!playerId) throw new Error('Blizzard browser journey has no player')
      const granted = grantPlayerEntityWeldBuild(
        state.playerEntities,
        playerId,
        1004,
        state.combatRng,
      )
      const player = state.playerEntities.locomotions[0]
      if (!player) throw new Error('Blizzard browser journey has no player locomotion')
      const fixture = blizzardFixture(state.world, player.position)
      const spawned = stepBoneyardEnemyStore(
        createBoneyardEnemyStore('blizzard-browser-contact'),
        {
          firstProjectileWorldContact: () => null,
          paused: true,
          players: {},
          resolveMovement: ({ requestedPosition }) => requestedPosition,
          resolveSpawnIntents: () => fixture.positions.map((position, index) => ({
            enemyToken: 'DEMON',
            flags: [],
            id: index + 1,
            locationPolicy: 'anywhere',
            nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.DEMON,
            position,
            spawnTick: state.tick,
            waveOrdinal: 1,
          })),
          tick: state.tick,
        },
      )
      const actors = spawned.store.actors
      if (actors.length !== fixture.positions.length) {
        throw new Error('Blizzard browser journey did not materialize its hostile fixture')
      }
      Object.assign(state, {
        combatRng: granted.rng,
        playerEntities: granted.store,
        secondaryAbilities: { ...state.secondaryAbilities, targetEffects: [] },
        world: {
          ...state.world,
          arenaTransition: null,
          encounter: null,
          enemies: spawned.store,
          enemyEvents: [],
          tutorial: null,
          waves: null,
        },
      })
      return {
        chain: { id: actors[1].id, initialHealth: actors[1].currentHealth },
        direct: { id: actors[0].id, initialHealth: actors[0].currentHealth },
        outside: { id: actors[2].id, initialHealth: actors[2].currentHealth },
        positions: fixture.positions,
      }
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('Blizzard browser journey did not enter the Boneyard')
}

function blizzardFixture(world, source) {
  const directions = Array.from({ length: 32 }, (_, index) => {
    const angle = index * Math.PI * 2 / 32
    return { x: Math.cos(angle), y: Math.sin(angle) }
  })
  for (const direction of directions) {
    for (const side of [-1, 1]) {
      const perpendicular = {
        x: -direction.y * side,
        y: direction.x * side,
      }
      const endpoint = clipBoneyardSegment(source, {
        x: source.x + direction.x * 500,
        y: source.y + direction.y * 500,
      }, world.bounds, world.collision)
      if (Math.hypot(endpoint.x - source.x, endpoint.y - source.y) < 350) continue
      const direct = {
        x: source.x + direction.x * 80 + perpendicular.x * 30,
        y: source.y + direction.y * 80 + perpendicular.y * 30,
      }
      const chain = {
        x: direct.x + perpendicular.x * 95,
        y: direct.y + perpendicular.y * 95,
      }
      const outside = {
        x: chain.x + perpendicular.x * 160,
        y: chain.y + perpendicular.y * 160,
      }
      const positions = [direct, chain, outside]
      if (positions.every((position) => (
        canPlaceBoneyardBody(position, world.bounds, world.collision, 50)
      ))) return { positions }
    }
  }
  throw new Error('Blizzard browser journey found no clear collision fixture')
}

async function observeBlizzardContact(host, fixture) {
  const deadline = Date.now() + 120_000
  const transientKinds = new Set()
  const observed = {
    chain: contactReceipt(fixture.chain),
    direct: contactReceipt(fixture.direct),
    outside: contactReceipt(fixture.outside),
    positions: fixture.positions,
    transientKinds: [],
  }
  while (Date.now() < deadline) {
    const state = host.state()
    if (state.world.kind === 'boneyard') {
      const actor = (entry) => state.world.enemies.actors.find(({ id }) => id === entry.id)
      const effect = (entry) => state.secondaryAbilities.targetEffects.find(({ targetId }) => (
        targetId === entry.id
      ))
      const directActor = actor(fixture.direct)
      const chainActor = actor(fixture.chain)
      const outsideActor = actor(fixture.outside)
      const directEffect = effect(fixture.direct)
      const chainEffect = effect(fixture.chain)
      for (const { kind } of state.primarySpells.transients) transientKinds.add(kind)
      mergeContactReceipt(observed.chain, contactReceipt(fixture.chain, chainActor, chainEffect))
      mergeContactReceipt(observed.direct, contactReceipt(fixture.direct, directActor, directEffect))
      mergeContactReceipt(
        observed.outside,
        contactReceipt(fixture.outside, outsideActor, effect(fixture.outside)),
      )
      observed.transientKinds = [...transientKinds]
      if (
        observed.direct.currentHealth < observed.direct.initialHealth
        && observed.chain.currentHealth < observed.chain.initialHealth
        && observed.outside.currentHealth === observed.outside.initialHealth
        && observed.direct.coldSlowTicks > 0
        && observed.direct.stunTicks > 0
        && observed.chain.coldSlowTicks > 0
        && observed.chain.stunTicks > 0
        && observed.direct.blizzardPushLastTick !== null
        && transientKinds.has('weld-frost-fade')
        && transientKinds.has('weld-blizzard-glow')
      ) return observed
    }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error(`Blizzard browser contact was not observed: ${JSON.stringify(observed)}`)
}

function contactReceipt(initial, actor, effect) {
  return {
    blizzardPushAccumulator: actor?.blizzardPushAccumulator ?? 0,
    blizzardPushLastTick: actor?.blizzardPushLastTick ?? null,
    coldSlowTicks: effect?.coldSlowTicks ?? 0,
    currentHealth: actor?.currentHealth ?? initial.initialHealth,
    id: initial.id,
    initialHealth: initial.initialHealth,
    position: actor?.position ?? null,
    stunTicks: effect?.stunTicks ?? 0,
  }
}

function mergeContactReceipt(target, sample) {
  target.blizzardPushAccumulator = Math.max(
    target.blizzardPushAccumulator,
    sample.blizzardPushAccumulator,
  )
  target.blizzardPushLastTick ??= sample.blizzardPushLastTick
  target.coldSlowTicks = Math.max(target.coldSlowTicks, sample.coldSlowTicks)
  target.currentHealth = Math.min(target.currentHealth, sample.currentHealth)
  target.position = sample.position ?? target.position
  target.stunTicks = Math.max(target.stunTicks, sample.stunTicks)
}

function runFocusedSmoke(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/smoke-primary-spells.mjs'], {
      cwd: frontendRoot,
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => { output += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error(`Blizzard browser journey failed (${code ?? signal ?? 'unknown'})`))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error('Blizzard browser receipt was not JSON', { cause: error }))
      }
    })
  })
}

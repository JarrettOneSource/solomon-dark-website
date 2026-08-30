import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createServer as createViteServer } from 'vite'

import { boneyardActiveBounds } from '../src/game/core-kernels/boneyard-arena-transition.ts'
import {
  canPlaceBoneyardBody,
  withBoneyardGateCollision,
} from '../src/game/core-server/boneyard-collision.ts'
import { boneyardEnemyActorFlags } from '../src/game/core-server/boneyard-enemy-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-earth-boulder-contact')
const credential = randomBytes(32).toString('base64url')

await mkdir(screenshotRoot, { recursive: true })
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const frontend = await createViteServer({
  configFile: viteConfig,
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await frontend.listen()
const viteAddress = frontend.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its Earth-contact acceptance port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  resetWhenEmpty: true,
  snapshotRate: 20,
})

try {
  const [browser, authority] = await Promise.all([
    runBrowserSmoke({
      ...process.env,
      SDR_GAME_SMOKE_CREDENTIAL: credential,
      SDR_GAME_SMOKE_ENDPOINT: host.address.url,
      SDR_GAME_SMOKE_URL: baseUrl,
      SDR_PRIMARY_EARTH_CONTACT: '1',
      SDR_PRIMARY_SPELL_BONEYARD_ONLY: '1',
      SDR_PRIMARY_SPELL_HOST_OPENED_BONEYARD: '1',
      SDR_PRIMARY_SPELL_KIND: 'earth',
      SDR_PRIMARY_SPELL_SCREENSHOT_ROOT: screenshotRoot,
    }),
    captureAuthorityContact(host),
  ])
  assert.equal(browser.status, 'ok')
  assert.deepEqual(browser.errors, [])
  assert.ok(browser.boneyard.contact)
  assert.equal(browser.boneyard.contact.targetId, authority.fixture.targetId)
  process.stdout.write(`${JSON.stringify({
    authority,
    browser,
    screenshotRoot,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.all([host.close(), frontend.close()])
}

function runBrowserSmoke(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/smoke-primary-spells.mjs'], {
      cwd: frontendRoot,
      env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })
    let output = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { output += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code !== 0) {
        reject(new Error(
          `Earth-contact browser journey failed (${code ?? signal ?? 'unknown'})`,
        ))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error('Earth-contact browser receipt was not JSON', { cause: error }))
      }
    })
  })
}

async function captureAuthorityContact(host) {
  const fixture = await openBoneyardContactFixture(host)
  const worldKey = `boneyard:${fixture.runId}`
  let residual = null
  await waitUntil(() => {
    const state = host.state()
    const boulder = state.primarySpells.projectiles.find((candidate) => (
      candidate.kind === 'earth'
      && candidate.worldKey === worldKey
      && candidate.phase === 'flight'
      && candidate.hitTargetIds.includes(fixture.targetId)
      && candidate.remainingDamage > 0
    ))
    const bit = state.primarySpells.transients.find((candidate) => (
      candidate.kind === 'earth-boulder-bit'
      && candidate.worldKey === worldKey
    ))
    if (!boulder || !bit) return false
    residual = {
      bit: structuredClone(bit),
      boulder: structuredClone(boulder),
      tick: state.tick,
    }
    return true
  }, 'Earth boulder did not retain a live residual carrier after enemy contact', 180_000)

  assert.ok(residual)
  assert.ok(residual.boulder.charge < residual.boulder.maximumCharge)
  assert.equal(residual.boulder.shellCharge, residual.boulder.charge)
  assert.ok(residual.boulder.assemblyCharge > residual.boulder.shellCharge)
  assert.ok(residual.boulder.remainingDamage > 0)

  let terminal = null
  await waitUntil(() => {
    const state = host.state()
    const impact = state.primarySpells.transients.find((candidate) => (
      candidate.kind === 'earth-impact'
      && candidate.worldKey === worldKey
      && candidate.birthTick > residual.tick
    ))
    if (!impact) return false
    terminal = { impact: structuredClone(impact), tick: state.tick }
    return true
  }, 'residual Earth boulder did not reach its terminal breakup', 30_000)

  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const target = state.world.enemies.actors.find(({ id }) => `enemy:${id}` === fixture.targetId)
  assert.ok(!target || target.currentHealth === 0 || target.lifeState === 'dying')
  return { fixture, residual, terminal }
}

async function openBoneyardContactFixture(host) {
  await waitUntil(
    () => host.state().world.kind === 'boneyard' && host.hostPlayerId() !== null,
    'browser did not enter the Boneyard',
    120_000,
  )
  let state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const playerId = host.hostPlayerId()
  const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => (
    id === playerId
  ))
  assert.ok(playerIndex >= 0)
  const solomon = state.world.encounter?.position
  assert.ok(solomon, 'Earth-contact proof requires the Solomon opening encounter')

  setHostPlayerPosition(host, playerIndex, solomon)
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard' && world.encounter?.phase === 'speaking'
  }, 'Solomon did not enter the authentic speaking phase', 10_000)
  setHostPlayerPosition(host, playerIndex, { x: solomon.x, y: solomon.y + 250 })
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard' && world.enemies.actors.some(({ lifeState }) => (
      lifeState === 'alive'
    ))
  }, 'Solomon opening did not release a live combat wave', 30_000)

  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.arenaTransition, 'Earth-contact proof requires sealed arena bounds')
  const lane = findClearEarthLane(state.world)
  const playerPosition = lane.playerPosition
  setHostPlayerPosition(host, playerIndex, playerPosition)
  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const target = state.world.enemies.actors.find((actor) => (
    (boneyardEnemyActorFlags(actor) & 0x2) !== 0
  ))
  assert.ok(target, 'Earth-contact proof requires one targetable live enemy')
  const targetPosition = lane.targetPosition
  const parkedTick = state.tick + 100_000
  const parkedTarget = {
    ...target,
    currentHealth: 1,
    nextMovementTick: parkedTick,
    nextTargetRefreshTick: parkedTick,
    position: targetPosition,
    shieldHealth: 0,
    targetPlayerId: null,
  }
  const progressions = [...state.playerEntities.progressions]
  progressions[playerIndex] = {
    ...progressions[playerIndex],
    currentHealth: progressions[playerIndex].maximumHealth,
    lastDamageTick: null,
    poisonDamagePerTick: 0,
    poisonTicksRemaining: 0,
  }
  assert.ok(state.world.waves, 'Earth-contact proof requires the active retail wave director')
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
    },
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies,
        actors: Object.freeze([parkedTarget]),
        deathEffects: Object.freeze([]),
        mageLightningPulses: Object.freeze([]),
        maggots: Object.freeze([]),
        projectileEffects: Object.freeze([]),
        projectiles: Object.freeze([]),
      },
      enemyEvents: Object.freeze([]),
      waves: { ...state.world.waves, phase: 'dormant' },
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 100))
  return {
    playerId,
    playerPosition,
    runId: state.world.runId,
    safeLaneLength: lane.safeLength,
    targetId: `enemy:${target.id}`,
    targetPosition,
  }
}

function findClearEarthLane(world) {
  assert.ok(world.arenaTransition)
  const bounds = boneyardActiveBounds(world.arenaTransition)
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  const radius = 40
  const directions = Array.from({ length: 16 }, (_, index) => {
    const angle = index * Math.PI / 8
    return { x: Math.cos(angle), y: Math.sin(angle) }
  })
  const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }
  let best = null
  for (let y = bounds.y + 60; y <= bounds.y + bounds.h - 60; y += 40) {
    for (let x = bounds.x + 60; x <= bounds.x + bounds.w - 60; x += 40) {
      const playerPosition = { x, y }
      if (!canPlaceBoneyardBody(playerPosition, bounds, collision, radius)) continue
      let pointBest = null
      for (const direction of directions) {
        let safeLength = 0
        for (let distance = 10; distance <= 500; distance += 10) {
          const sample = {
            x: playerPosition.x + direction.x * distance,
            y: playerPosition.y + direction.y * distance,
          }
          if (!canPlaceBoneyardBody(sample, bounds, collision, radius)) break
          safeLength = distance
        }
        if (pointBest === null || safeLength > pointBest.safeLength) {
          pointBest = { direction, safeLength }
        }
      }
      if (!pointBest || pointBest.safeLength < 320) continue
      const centerDistance = Math.hypot(x - center.x, y - center.y)
      if (
        best === null
        || centerDistance < best.centerDistance
        || (centerDistance === best.centerDistance && pointBest.safeLength > best.safeLength)
      ) {
        best = { ...pointBest, centerDistance, playerPosition }
      }
    }
  }
  assert.ok(best && best.safeLength >= 320, 'Boneyard generated no clear Earth contact lane')
  return {
    playerPosition: best.playerPosition,
    safeLength: best.safeLength,
    targetPosition: {
      x: best.playerPosition.x + best.direction.x * 90,
      y: best.playerPosition.y - 25 / 1.35 + best.direction.y * 90,
    },
  }
}

function setHostPlayerPosition(host, index, position) {
  const state = host.state()
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = {
    ...locomotions[index],
    position: { ...position },
    velocity: { x: 0, y: 0 },
  }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      locomotions: Object.freeze(locomotions),
    },
  })
}

async function waitUntil(predicate, message, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build as buildFrontend, preview as previewBuiltFrontend } from 'vite'

import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const luaWasmPath = fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url))
const kind = process.env.SDR_PRIMARY_SPELL_KIND?.trim().toLowerCase()
const supportedKinds = new Set(['ether', 'fire', 'air', 'water', 'earth'])
if (!kind || !supportedKinds.has(kind)) {
  throw new Error('SDR_PRIMARY_SPELL_KIND must name one elemental primary')
}

const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT
  || join(tmpdir(), `solomon-primary-${kind}`)
const credential = randomBytes(32).toString('base64url')
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))

await mkdir(screenshotRoot, { recursive: true })
await buildFrontend({
  configFile: viteConfig,
  logLevel: 'error',
  root: frontendRoot,
})
const frontend = await previewBuiltFrontend({
  configFile: viteConfig,
  logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 },
  root: frontendRoot,
})
const address = frontend.httpServer.address()
if (!address || typeof address === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its primary-spell acceptance port')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  luaWasmPath,
  resetWhenEmpty: true,
  snapshotRate: 20,
})

try {
  const [receipt, performanceFixture] = await Promise.all([
    runBrowserSmoke({
      ...process.env,
      SDR_GAME_SMOKE_CREDENTIAL: credential,
      SDR_GAME_SMOKE_ENDPOINT: host.address.url,
      SDR_GAME_SMOKE_URL: baseUrl,
      SDR_PRIMARY_SPELL_BONEYARD_ONLY: kind === 'ether' || kind === 'air' ? '1' : '',
      SDR_PRIMARY_SPELL_COMBAT_ADMISSION: kind === 'ether' || kind === 'air' ? '1' : '',
      SDR_PRIMARY_SPELL_KIND: kind,
      SDR_PRIMARY_SPELL_SCREENSHOT_ROOT: screenshotRoot,
    }),
    process.env.SDR_PRIMARY_PERFORMANCE === '1'
      ? stabilizePerformanceCombat(host)
      : Promise.resolve(null),
  ])
  assert.equal(receipt.status, 'ok')
  assert.deepEqual(receipt.errors, [])
  assert.equal(receipt.receipts.length, 1)
  assert.equal(receipt.receipts[0].kind, kind)
  assert.ok(receipt.boneyard, 'the browser journey must reach the Boneyard')
  if (process.env.SDR_PRIMARY_PERFORMANCE === '1') {
    assert.ok(receipt.boneyard.performance, 'the Ether journey must include performance phases')
  }
  process.stdout.write(`${JSON.stringify({
    kind,
    performanceFixture,
    receipt,
    screenshotRoot,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.all([host.close(), frontend.close()])
}

async function stabilizePerformanceCombat(host) {
  await waitUntil(() => {
    const state = host.state()
    return state.world.kind === 'boneyard'
      && state.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')
  }, 'performance fixture did not reach active Boneyard combat', 120_000)
  const receipt = { freezePasses: 0 }
  const freeze = () => {
    const frozen = freezePerformanceCombatState(host)
    if (!frozen) return
    Object.assign(receipt, frozen)
    receipt.freezePasses += 1
  }
  freeze()
  const interval = setInterval(freeze, 25)
  interval.unref()
  const timeout = setTimeout(() => clearInterval(interval), 20_000)
  timeout.unref()
  return receipt
}

function freezePerformanceCombatState(host) {
  const state = host.state()
  if (state.world.kind !== 'boneyard') return null
  const playerId = host.hostPlayerId()
  if (playerId === null) return null
  const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => (
    id === playerId
  ))
  if (playerIndex < 0) return null
  const playerPosition = state.playerEntities.locomotions[playerIndex].position
  const bounds = state.world.arenaTransition?.combatBounds
  if (!bounds) return null
  const corners = [
    { x: bounds.x + 60, y: bounds.y + 60 },
    { x: bounds.x + bounds.w - 60, y: bounds.y + 60 },
    { x: bounds.x + 60, y: bounds.y + bounds.h - 60 },
    { x: bounds.x + bounds.w - 60, y: bounds.y + bounds.h - 60 },
  ]
  const enemyPosition = corners.toSorted((left, right) => (
    Math.hypot(right.x - playerPosition.x, right.y - playerPosition.y)
      - Math.hypot(left.x - playerPosition.x, left.y - playerPosition.y)
  ))[0]
  const frozenUntilTick = state.tick + 10_000
  const actors = state.world.enemies.actors.map((actor) => ({
    ...actor,
    action: null,
    actionProgress: 0,
    nextMovementTick: frozenUntilTick,
    nextTargetRefreshTick: frozenUntilTick,
    position: { ...enemyPosition },
    staffActionFactor: 0,
    staffMovementFactor: 0,
    targetPlayerId: playerId,
  }))
  const progressions = [...state.playerEntities.progressions]
  progressions[playerIndex] = {
    ...progressions[playerIndex],
    currentHealth: progressions[playerIndex].maximumHealth,
  }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
    },
    world: {
      ...state.world,
      enemies: { ...state.world.enemies, actors: Object.freeze(actors) },
    },
  })
  return {
    enemyCount: actors.length,
    frozenUntilTick,
    playerId,
    runId: state.world.runId,
  }
}

async function waitUntil(predicate, message, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
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
          `Primary ${kind} browser journey failed (${code ?? signal ?? 'unknown'})`,
        ))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error(`Primary ${kind} receipt was not JSON`, { cause: error }))
      }
    })
  })
}

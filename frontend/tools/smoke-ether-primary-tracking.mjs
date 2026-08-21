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
const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-ether-primary-tracking')
const credential = randomBytes(32).toString('base64url')

await mkdir(screenshotRoot, { recursive: true })
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
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
const viteAddress = frontend.httpServer.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its Ether-tracking acceptance port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  resetWhenEmpty: true,
  snapshotRate: 20,
})

try {
  const [browser, proof] = await Promise.all([
    runBrowserSmoke({
      ...process.env,
      SDR_GAME_SMOKE_CREDENTIAL: credential,
      SDR_GAME_SMOKE_ENDPOINT: host.address.url,
      SDR_GAME_SMOKE_URL: baseUrl,
      SDR_PRIMARY_SPELL_HOST_OPENED_BONEYARD: '1',
      SDR_PRIMARY_SPELL_KIND: 'ether',
      SDR_PRIMARY_SPELL_SCREENSHOT_ROOT: screenshotRoot,
    }),
    (async () => {
      const fixture = await openBoneyardCombat(host)
      return { fixture, tracking: await captureEtherTracking(host) }
    })(),
  ])
  assert.equal(browser.status, 'ok')
  assert.deepEqual(browser.errors, [])
  assert.ok(proof.tracking.nonzeroTurns > 0)
  process.stdout.write(`${JSON.stringify({
    browser,
    fixture: proof.fixture,
    screenshotRoot,
    status: 'ok',
    tracking: proof.tracking,
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
          `Ether tracking browser journey failed (${code ?? signal ?? 'unknown'})`,
        ))
        return
      }
      try {
        resolve(JSON.parse(output.trim()))
      } catch (error) {
        reject(new Error('Ether tracking browser receipt was not JSON', { cause: error }))
      }
    })
  })
}

async function openBoneyardCombat(host) {
  await waitUntil(
    () => host.state().world.kind === 'boneyard' && host.hostPlayerId() !== null,
    'browser did not enter the Boneyard',
    120_000,
  )
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const playerId = host.hostPlayerId()
  const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => (
    id === playerId
  ))
  assert.ok(playerIndex >= 0)
  const solomon = state.world.encounter?.position
  assert.ok(solomon, 'Ether tracking proof requires the Solomon opening encounter')

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

  const combatState = host.state()
  assert.equal(combatState.world.kind, 'boneyard')
  const combatBounds = combatState.world.arenaTransition?.combatBounds
  assert.ok(combatBounds, 'Ether tracking proof requires sealed arena bounds')
  setHostPlayerPosition(host, playerIndex, {
    x: combatBounds.x + combatBounds.w * 0.5,
    y: combatBounds.y + combatBounds.h * 0.5,
  })
  return {
    enemyCount: combatState.world.enemies.actors.filter(({ lifeState }) => (
      lifeState === 'alive'
    )).length,
    playerId,
    runId: combatState.world.runId,
  }
}

async function captureEtherTracking(host) {
  const samples = []
  let projectileId = null
  const deadline = Date.now() + 180_000
  while (Date.now() < deadline && samples.length < 4) {
    const projectile = host.state().primarySpells.projectiles.find((candidate) => (
      candidate.kind === 'ether'
      && candidate.targetId !== null
      && (projectileId === null || candidate.id === projectileId)
    ))
    if (projectile) {
      projectileId = projectile.id
      if (samples.at(-1)?.flightTicks !== projectile.flightTicks) {
        samples.push({
          flightTicks: projectile.flightTicks,
          headingDegrees: projectile.headingDegrees,
          id: projectile.id,
          position: { ...projectile.position },
          targetId: projectile.targetId,
          tick: host.state().tick,
          turnAccumulator: projectile.turnAccumulator,
          velocity: { ...projectile.velocity },
        })
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  assert.ok(samples.length >= 4, 'expected four authoritative targeted Ether states')
  return assertEtherTrackingSamples(samples)
}

function assertEtherTrackingSamples(samples) {
  let nonzeroTurns = 0
  let maximumTurnBoundSlack = 0
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]
    const current = samples[index]
    assert.equal(current.id, previous.id)
    assert.equal(current.targetId, previous.targetId)
    const elapsedFlightTicks = current.flightTicks - previous.flightTicks
    assert.ok(elapsedFlightTicks > 0)

    const actualTurn = signedDegrees(current.headingDegrees - previous.headingDegrees)
    let expectedAccumulator = previous.turnAccumulator
    let maximumTurn = 0
    for (let tick = 0; tick < elapsedFlightTicks; tick += 1) {
      maximumTurn += Math.abs(Math.fround(2 * Math.fround(expectedAccumulator)))
      const accumulatorStep = expectedAccumulator > 1
        ? 0.0020000000949949026
        : 0.05000000074505806
      expectedAccumulator = Math.min(
        10,
        Math.fround(expectedAccumulator + accumulatorStep),
      )
    }
    assert.ok(Math.abs(actualTurn) <= maximumTurn + 0.000_1)
    if (Math.abs(actualTurn) > 0.000_001) {
      nonzeroTurns += 1
      maximumTurnBoundSlack = Math.max(
        maximumTurnBoundSlack,
        maximumTurn - Math.abs(actualTurn),
      )
    }
    assert.equal(current.turnAccumulator, expectedAccumulator)
    const distance = Math.hypot(
      current.position.x - previous.position.x,
      current.position.y - previous.position.y,
    )
    const maximumDistance = Math.hypot(previous.velocity.x, previous.velocity.y)
      * elapsedFlightTicks
    assert.ok(distance > 0 && distance <= maximumDistance + 0.001)
  }
  assert.ok(nonzeroTurns > 0, 'expected an off-axis Ether target to require steering')
  return {
    maximumTurnBoundSlack,
    nonzeroTurns,
    samples: samples.map((sample) => ({
      flightTicks: sample.flightTicks,
      headingDegrees: sample.headingDegrees,
      id: sample.id,
      position: sample.position,
      targetId: sample.targetId,
      tick: sample.tick,
      turnAccumulator: sample.turnAccumulator,
    })),
  }
}

function signedDegrees(value) {
  return ((value + 540) % 360) - 180
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

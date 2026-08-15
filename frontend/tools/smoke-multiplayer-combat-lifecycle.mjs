import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { solomonContactContains } from '../src/game/core-kernels/boneyard-encounter.ts'
import { BONEYARD_GATE_INITIAL_SWAY } from '../src/game/core-kernels/boneyard-gate.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import {
  createBoneyardCollisionWorld,
  resolveBoneyardMovement,
} from '../src/game/core-server/boneyard-collision.ts'
import {
  createBoneyardCatalog,
  DEFAULT_BONEYARD_CHOICE,
  materializeBoneyard,
} from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const deterministicSeedBytes = Buffer.alloc(16)
const expectedBoneyardSeed = deterministicSeedBytes.toString('hex')
const boneyards = createBoneyardCatalog()
const loadedBoneyard = materializeBoneyard(
  boneyards,
  DEFAULT_BONEYARD_CHOICE.id,
  Buffer.from(deterministicSeedBytes),
)
assert.ok(loadedBoneyard, 'expected the deterministic default Boneyard to materialize')
assert.equal(loadedBoneyard.seed, expectedBoneyardSeed)
assert.ok(loadedBoneyard.scene.solomonDig, 'expected the loaded Solomon Dig scene')
const combatNavigation = {
  bounds: loadedBoneyard.scene.bounds,
  collision: createBoneyardCollisionWorld(loadedBoneyard.scene),
}
const screenshotRoot = process.env.SDR_GAME_MULTIPLAYER_COMBAT_SCREENSHOT_ROOT || '/tmp'
const firstDeathScreenshotPath = `${screenshotRoot}/solomon-dark-multiplayer-first-death.png`
const gameOverScreenshotPath = `${screenshotRoot}/solomon-dark-multiplayer-game-over.png`
const loadoutScreenshotPath = `${screenshotRoot}/solomon-dark-multiplayer-loadout.png`
const returnedHubScreenshotPath = `${screenshotRoot}/solomon-dark-multiplayer-returned-hub.png`
const browserOptions = {
  args: [
    '--autoplay-policy=no-user-gesture-required',
  ],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
}
const viewport = { width: 800, height: 450 }
const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local smoke-test port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  boneyards,
  createBoneyardSeedBytes: () => Buffer.alloc(16),
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const [hostBrowser, guestBrowser] = await Promise.all([
  chromium.launch(browserOptions),
  chromium.launch(browserOptions),
])
const hostPage = await hostBrowser.newPage({ viewport })
const guestPage = await guestBrowser.newPage({ viewport })
await Promise.all([hostPage, guestPage].map((page) => page.addInitScript((runtime) => {
  window.solomonDarkRuntime = runtime
}, {
  gameEndpoint: {
    credential,
    kind: 'localhost',
    url: host.address.url,
  },
})))
const errors = {
  guest: captureErrors(guestPage),
  host: captureErrors(hostPage),
}

try {
  await enterHub(hostPage, 'Fire')
  await enterHub(guestPage, 'Ether')
  await Promise.all([
    waitForPlayers(hostPage, 2),
    waitForPlayers(guestPage, 2),
  ])

  const [hostHub, guestHub] = await Promise.all([
    hubFrame(hostPage),
    hubFrame(guestPage),
  ])
  assert.notEqual(hostHub.localPlayerId, guestHub.localPlayerId)
  assert.equal(hostHub.hostPlayerId, hostHub.localPlayerId)
  assert.equal(guestHub.hostPlayerId, hostHub.localPlayerId)

  await hostPage.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await Promise.all([
    waitForBoneyard(hostPage),
    waitForBoneyard(guestPage),
  ])
  const [hostInitial, guestInitial] = await Promise.all([
    boneyardFrame(hostPage),
    boneyardFrame(guestPage),
  ])
  assert.equal(hostInitial.runId, guestInitial.runId)
  assert.equal(hostInitial.runPhase, 'active')
  assert.equal(guestInitial.runPhase, 'active')
  assert.equal(hostInitial.playerCount, 2)
  assert.equal(guestInitial.playerCount, 2)

  await pulseMovement(guestPage, ['a'], 750)
  const hostScene = hostPage.locator('.boneyard-scene')
  const gateCrossing = await crossEntryGate(
    hostPage,
    guestPage,
    loadedBoneyard.scene,
  )
  const approach = await walkToSolomon(hostPage, hostScene, loadedBoneyard.scene)
  assert.notEqual(approach.phase, 'digging')
  await Promise.all([
    waitForOpeningEnemies(hostPage),
    waitForOpeningEnemies(guestPage),
  ])

  const firstDeath = await driveDesignatedHostToSpectating({
    guest: { label: 'guest', page: guestPage },
    host: { label: 'host', page: hostPage },
    navigation: combatNavigation,
  })
  const survivorEvasion = startSurvivorEvasion(
    firstDeath.survivor.page,
    combatNavigation,
  )
  let firstSpectatorCamera
  let spectatorHud
  let inputLock
  try {
    assert.equal(firstDeath.fallen.label, 'host')
    assert.equal(firstDeath.survivor.label, 'guest')
    assert.equal(firstDeath.fallenFrame.localPlayerLifeState, 'spectating')
    assert.ok(firstDeath.fallenFrame.localPlayerDeathTick >= 159)
    assert.equal(firstDeath.fallenFrame.runPhase, 'active')
    assert.equal(firstDeath.survivorFrame.localPlayerLifeState, 'alive')
    assert.ok(firstDeath.survivorFrame.localPlayerHealth > 0)
    assert.equal(firstDeath.survivorFrame.runPhase, 'active')
    assert.equal(await firstDeath.fallen.page.locator('.boneyard-game-over').count(), 0)
    assert.equal(await firstDeath.survivor.page.locator('.boneyard-game-over').count(), 0)
    firstSpectatorCamera = assertSpectatorCameraFrame(
      firstDeath.fallenFrame,
      guestHub.localPlayerId,
    )
    spectatorHud = await spectatorStatusReceipt(
      firstDeath.fallen.page,
      firstDeath.fallenFrame,
      guestHub.localPlayerId,
    )
    await firstDeath.fallen.page.screenshot({ path: firstDeathScreenshotPath })

    inputLock = await proveSpectatorInputLock(
      firstDeath.fallen.page,
      guestHub.localPlayerId,
    )
  } finally {
    await survivorEvasion.stop()
  }
  const terminal = await driveSurvivorToGameOver(firstDeath.survivor.page)
  await Promise.all([
    waitForGameOver(firstDeath.fallen.page),
    waitForGameOver(firstDeath.survivor.page),
  ])
  const [fallenTerminalFrame, survivorTerminalFrame] = await Promise.all([
    boneyardFrame(firstDeath.fallen.page),
    boneyardFrame(firstDeath.survivor.page),
  ])
  assert.equal(fallenTerminalFrame.localPlayerLifeState, 'spectating')
  assert.equal(fallenTerminalFrame.runPhase, 'game-over')
  assert.notEqual(survivorTerminalFrame.localPlayerLifeState, 'alive')
  assert.equal(survivorTerminalFrame.runPhase, 'game-over')
  assert.equal(fallenTerminalFrame.runId, survivorTerminalFrame.runId)
  assert.ok(survivorTerminalFrame.runGameOverTicks >= 0)
  assert.equal(fallenTerminalFrame.spectatorTargetPlayerId, null)
  await firstDeath.fallen.page.locator('.boneyard-spectator-status').waitFor({
    state: 'detached',
    timeout: 30_000,
  })
  assert.equal(await firstDeath.survivor.page.locator('.boneyard-spectator-status').count(), 0)
  await firstDeath.survivor.page.screenshot({ path: gameOverScreenshotPath })
  const returnToHub = await returnBothPlayersToHub(hostPage, guestPage)

  assert.deepEqual(errors, {
    guest: { console: [], page: [] },
    host: { console: [], page: [] },
  })
  process.stdout.write(`${JSON.stringify({
    approach,
    browserVersion: hostBrowser.version(),
    errors,
    firstDeath: {
      fallen: firstDeath.fallen.label,
      fallenFrame: firstDeath.fallenFrame,
      healthSamples: firstDeath.healthSamples,
      survivor: firstDeath.survivor.label,
      survivorFrame: firstDeath.survivorFrame,
    },
    firstDeathScreenshotPath,
    firstSpectatorCamera,
    gameOverScreenshotPath,
    gateCrossing,
    inputLock,
    loadoutScreenshotPath,
    lobby: {
      guestPlayerId: guestHub.localPlayerId,
      hostPlayerId: hostHub.localPlayerId,
      runId: hostInitial.runId,
    },
    spectatorHud,
    returnToHub,
    returnedHubScreenshotPath,
    status: 'ok',
    terminal: {
      fallenFrame: fallenTerminalFrame,
      survivorFrame: survivorTerminalFrame,
      ...terminal,
    },
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    errors,
    guest: await pageDiagnostics(guestPage),
    host: await pageDiagnostics(hostPage),
  })}\n`)
  throw error
} finally {
  await Promise.all([
    hostBrowser.close(),
    guestBrowser.close(),
    host.close(),
    vite.close(),
  ])
}

function captureErrors(page) {
  const errors = { console: [], page: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  return errors
}

async function enterHub(page, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 45_000,
  })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
}

async function waitForPlayers(page, expected) {
  await page.waitForFunction((count) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerCount === count
  ), expected, { timeout: 30_000 })
}

async function waitForBoneyard(page) {
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === 2
  ), undefined, { timeout: 30_000 })
}

async function waitForOpeningEnemies(page) {
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return Number(scene?.getAttribute('data-wave-live-enemy-count')) >= 10
      && frame?.enemyCount >= 10
      && frame?.runPhase === 'active'
  }, undefined, { timeout: 90_000 })
}

async function hubFrame(page) {
  return page.locator('.hub-world-canvas').evaluate((node) => (
    structuredClone(node.__sdrHubFrame)
  ))
}

async function boneyardFrame(page) {
  return page.locator('.boneyard-world-canvas').evaluate((node) => (
    structuredClone(node.__sdrBoneyardFrame)
  ))
}

async function boneyardFrameWithSpectatorStatus(page) {
  return page.locator('.boneyard-scene').evaluate((scene) => ({
    frame: structuredClone(
      scene.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame,
    ),
    spectatorStatusCount: scene.querySelectorAll('.boneyard-spectator-status').length,
  }))
}

async function driveDesignatedHostToSpectating({ guest, host, navigation }) {
  const healthSamples = []
  let sawDeathPresentation = false
  const deadline = Date.now() + 300_000

  while (Date.now() < deadline) {
    const [hostReceipt, guestFrame] = await Promise.all([
      boneyardFrameWithSpectatorStatus(host.page),
      boneyardFrame(guest.page),
    ])
    const hostFrame = hostReceipt.frame
    healthSamples.push({
      guest: guestFrame.localPlayerHealth,
      host: hostFrame.localPlayerHealth,
      tick: hostFrame.tick,
    })

    if (guestFrame.localPlayerLifeState !== 'alive') {
      throw new Error(`designated guest died before host spectator proof: ${JSON.stringify({
        guestFrame,
        hostFrame,
      })}`)
    }

    if (hostFrame.localPlayerLifeState !== 'alive') {
      if (hostFrame.localPlayerLifeState !== 'spectating') {
        assert.equal(
          hostReceipt.spectatorStatusCount,
          0,
          'spectator status appeared during host death presentation',
        )
        if (hostFrame.localPlayerLifeState === 'dying') {
          sawDeathPresentation = true
        }
      }
      if (hostFrame.localPlayerLifeState === 'spectating') {
        assert.equal(sawDeathPresentation, true)
        return {
          fallen: host,
          fallenFrame: hostFrame,
          healthSamples: compactHealthSamples(healthSamples),
          sawDeathPresentation,
          survivor: guest,
          survivorFrame: guestFrame,
        }
      }
      await evadeEnemyPack(guest.page, guestFrame, navigation, 240)
      continue
    }

    await Promise.all([
      pulseTowardNearestEnemy(host.page, hostFrame, 220),
      evadeEnemyPack(guest.page, guestFrame, navigation, 280),
    ])
  }
  throw new Error('designated host did not reach the native spectator state')
}

function startSurvivorEvasion(page, navigation) {
  let failure = null
  let stopRequested = false
  const completed = (async () => {
    while (!stopRequested) {
      const frame = await boneyardFrame(page)
      if (stopRequested) break
      if (frame.runPhase !== 'active' || frame.localPlayerLifeState !== 'alive') {
        throw new Error(`designated survivor left active play during spectator proof: ${JSON.stringify({
          health: frame.localPlayerHealth,
          lifeState: frame.localPlayerLifeState,
          runPhase: frame.runPhase,
          tick: frame.tick,
        })}`)
      }
      await evadeEnemyPack(page, frame, navigation, 220)
    }
  })().catch((error) => {
    failure = error
  })

  return {
    async stop() {
      stopRequested = true
      await completed
      if (failure !== null) throw failure
    },
  }
}

async function proveSpectatorInputLock(page, targetPlayerId) {
  const before = await boneyardFrame(page)
  const cameraBefore = assertSpectatorCameraFrame(before, targetPlayerId)
  const canvas = page.locator('.boneyard-world-canvas')
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the spectator Boneyard canvas to have bounds')
  await page.bringToFront()
  await page.keyboard.down('d')
  await page.keyboard.down('s')
  await page.mouse.click(
    bounds.x + bounds.width * 0.75,
    bounds.y + bounds.height * 0.5,
  )
  await page.mouse.click(
    bounds.x + bounds.width * 0.25,
    bounds.y + bounds.height * 0.5,
    { button: 'right' },
  )
  await page.waitForTimeout(500)
  await page.keyboard.up('s')
  await page.keyboard.up('d')
  await page.waitForFunction((tick) => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.tick >= tick + 25
  ), before.tick, { timeout: 30_000 })
  const after = await boneyardFrame(page)
  const cameraAfter = assertSpectatorCameraFrame(after, targetPlayerId)
  const displacement = Math.hypot(after.playerX - before.playerX, after.playerY - before.playerY)
  assert.ok(displacement < 0.1, `spectator movement changed position by ${displacement}`)
  assert.equal(after.localPlayerMana, before.localPlayerMana)
  assert.equal(after.localPlayerLifeState, 'spectating')
  const hud = await spectatorStatusReceipt(page, after, targetPlayerId)
  return {
    cameraAfter,
    cameraBefore,
    displacement,
    hud,
    manaAfter: after.localPlayerMana,
    manaBefore: before.localPlayerMana,
    tickAfter: after.tick,
    tickBefore: before.tick,
  }
}

function assertSpectatorCameraFrame(frame, targetPlayerId) {
  const target = frame.playerSamples.find((player) => player.id === targetPlayerId)
  assert.ok(target, `spectator target ${targetPlayerId} was absent from the rendered player sample`)
  assert.equal(frame.spectatorTargetPlayerId, targetPlayerId)
  assert.equal(frame.cameraSubjectPlayerId, targetPlayerId)
  assert.equal(frame.cameraFocusX, target.x)
  assert.equal(frame.cameraFocusY, target.y)
  assert.equal(Number.isFinite(frame.cameraX), true)
  assert.equal(Number.isFinite(frame.cameraY), true)
  return {
    cameraFocusX: frame.cameraFocusX,
    cameraFocusY: frame.cameraFocusY,
    cameraX: frame.cameraX,
    cameraY: frame.cameraY,
    targetDisplayName: target.displayName,
    targetPlayerId,
  }
}

async function spectatorStatusReceipt(page, frame, targetPlayerId) {
  const target = frame.playerSamples.find((player) => player.id === targetPlayerId)
  assert.ok(target, `spectator target ${targetPlayerId} was absent from the rendered player sample`)
  const status = page.locator('.boneyard-spectator-status')
  await status.waitFor({ timeout: 30_000 })
  assert.equal(await status.getAttribute('data-target-player-id'), targetPlayerId)
  const text = (await status.innerText()).replace(/\s+/g, ' ').trim()
  assert.equal(
    text,
    `Spectating ${target.displayName} | Left / Right click: next player`,
  )
  const accessibleLabel = await status.getAttribute('aria-label')
  assert.equal(
    accessibleLabel,
    `Spectating ${target.displayName}. Left or right click to select the next player.`,
  )
  return { accessibleLabel, targetPlayerId, text }
}

async function driveSurvivorToGameOver(page) {
  const healthSamples = []
  const started = await boneyardFrame(page)
  const deadline = Date.now() + 300_000

  while (Date.now() < deadline) {
    const frame = await boneyardFrame(page)
    healthSamples.push({ health: frame.localPlayerHealth, tick: frame.tick })
    if (frame.runPhase === 'game-over') {
      assert.notEqual(frame.localPlayerLifeState, 'alive')
      return {
        finalHealth: frame.localPlayerHealth,
        healthSamples: compactSingleHealthSamples(healthSamples),
        lifeState: frame.localPlayerLifeState,
        startHealth: started.localPlayerHealth,
        startTick: started.tick,
        terminalTick: frame.tick,
      }
    }
    assert.equal(frame.localPlayerLifeState, 'alive')
    await pulseTowardNearestEnemy(page, frame, 260)
  }
  throw new Error(`survivor did not trigger Game Over: ${JSON.stringify(await boneyardFrame(page))}`)
}

async function waitForGameOver(page) {
  await page.locator('.boneyard-game-over').waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.runPhase
      === 'game-over'
  ), undefined, { timeout: 30_000 })
}

async function returnBothPlayersToHub(hostPage, guestPage) {
  const hostGameOver = hostPage.locator('.boneyard-game-over[data-input-ready="true"]')
  const guestGameOver = guestPage.locator('.boneyard-game-over[data-input-ready="true"]')
  await Promise.all([
    hostGameOver.waitFor({ timeout: 180_000 }),
    guestGameOver.waitFor({ timeout: 180_000 }),
  ])
  assert.equal(await hostGameOver.isEnabled(), true)
  assert.equal(await hostGameOver.getAttribute('aria-label'), 'Game over. Continue to loadout.')
  assert.equal(await guestGameOver.isDisabled(), true)
  assert.equal(await guestGameOver.getAttribute('aria-label'), 'Game over. Waiting for host.')

  await hostGameOver.click()
  const hostLoadout = hostPage.locator(
    '.create-menu-scene[data-retained-loadout="true"][data-motion-settled="true"]',
  )
  const guestLoadout = guestPage.locator(
    '.create-menu-scene[data-retained-loadout="true"][data-motion-settled="true"]',
  )
  await Promise.all([
    hostLoadout.waitFor({ timeout: 90_000 }),
    guestLoadout.waitFor({ timeout: 90_000 }),
  ])
  assert.equal(await hostLoadout.getAttribute('data-retained-loadout-can-confirm'), 'true')
  assert.equal(await guestLoadout.getAttribute('data-retained-loadout-can-confirm'), 'false')
  assert.equal(await hostLoadout.getAttribute('data-element'), 'fire')
  assert.equal(await guestLoadout.getAttribute('data-element'), 'ether')
  const hostConfirm = hostPage.locator('.create-menu-discipline-arcane')
  const guestConfirm = guestPage.locator('.create-menu-discipline-arcane')
  assert.equal(await hostConfirm.isEnabled(), true)
  assert.equal(await guestConfirm.isDisabled(), true)
  await hostPage.screenshot({ path: loadoutScreenshotPath })

  await hostConfirm.click()
  await Promise.all([
    hostPage.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 }),
    guestPage.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 }),
    waitForPlayers(hostPage, 2),
    waitForPlayers(guestPage, 2),
  ])
  const [hostHub, guestHub] = await Promise.all([
    hubFrame(hostPage),
    hubFrame(guestPage),
  ])
  assert.equal(hostHub.hostPlayerId, hostHub.localPlayerId)
  assert.equal(guestHub.hostPlayerId, hostHub.localPlayerId)
  assert.notEqual(guestHub.localPlayerId, hostHub.localPlayerId)
  await hostPage.screenshot({ path: returnedHubScreenshotPath })
  return {
    guestLoadoutCanConfirm: false,
    guestPlayerId: guestHub.localPlayerId,
    hostLoadoutCanConfirm: true,
    hostPlayerId: hostHub.localPlayerId,
    playerCount: hostHub.playerCount,
  }
}

async function pulseTowardNearestEnemy(page, frame, durationMs) {
  const target = nearestLivingEnemy(frame)
  if (!target) {
    await page.waitForTimeout(100)
    return
  }
  await pulseMovement(page, movementKeys({
    x: target.x - frame.playerX,
    y: target.y - frame.playerY,
  }), durationMs)
}

async function evadeEnemyPack(page, frame, navigation, durationMs) {
  const direction = safestCombatDirection(frame, navigation)
  if (!direction) {
    await page.waitForTimeout(100)
    return false
  }
  await pulseMovement(page, movementKeys(direction), durationMs)
  return true
}

function safestCombatDirection(frame, navigation) {
  const enemies = frame.enemySamples.filter((enemy) => enemy.lifeState !== 'death')
  if (enemies.length === 0) return null
  const start = { x: frame.playerX, y: frame.playerY }
  const directions = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
  ]

  for (const probeDistance of [70, 45, 25]) {
    let best = null
    for (const direction of directions) {
      const length = Math.hypot(direction.x, direction.y)
      const unit = { x: direction.x / length, y: direction.y / length }
      const end = {
        x: start.x + unit.x * probeDistance,
        y: start.y + unit.y * probeDistance,
      }
      if (!traversesBoneyard(
        start,
        end,
        navigation.bounds,
        navigation.collision,
      )) continue

      const corridorDistances = enemies.map((enemy) => Math.min(
        ...[0.35, 0.7, 1].map((progress) => Math.hypot(
          enemy.x - (start.x + (end.x - start.x) * progress),
          enemy.y - (start.y + (end.y - start.y) * progress),
        )),
      )).toSorted((left, right) => left - right)
      const nearestClearance = corridorDistances[0] ?? Number.POSITIVE_INFINITY
      const crowdClearance = corridorDistances
        .slice(0, 8)
        .reduce((total, distance) => total + Math.min(distance, 250), 0)
      const edgeClearance = Math.min(
        end.x - navigation.bounds.x,
        navigation.bounds.x + navigation.bounds.w - end.x,
        end.y - navigation.bounds.y,
        navigation.bounds.y + navigation.bounds.h - end.y,
      )
      const score = nearestClearance * 100
        + crowdClearance
        + Math.min(edgeClearance, 150) * 2
      if (!best || score > best.score) best = { direction, score }
    }
    if (best) return best.direction
  }

  const nearest = nearestLivingEnemy(frame)
  return nearest
    ? { x: frame.playerX - nearest.x, y: frame.playerY - nearest.y }
    : null
}

function nearestLivingEnemy(frame) {
  return frame.enemySamples
    .filter((enemy) => enemy.lifeState !== 'death')
    .toSorted((left, right) => (
      Math.hypot(left.x - frame.playerX, left.y - frame.playerY)
      - Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
      || left.id - right.id
    ))[0] ?? null
}

async function pulseMovement(page, keys, durationMs) {
  if (keys.length === 0) {
    await page.waitForTimeout(durationMs)
    return
  }
  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await Promise.all([
      page.waitForTimeout(durationMs),
      page.evaluate(() => new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })),
    ])
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
  }
}

function movementKeys({ x, y }) {
  const keys = []
  const scale = Math.max(Math.abs(x), Math.abs(y), 1)
  if (Math.abs(x) / scale >= 0.25) keys.push(x > 0 ? 'd' : 'a')
  if (Math.abs(y) / scale >= 0.25) keys.push(y > 0 ? 's' : 'w')
  return keys
}

async function crossEntryGate(hostPage, guestPage, boneyardScene) {
  const scene = hostPage.locator('.boneyard-scene')
  const guestScene = guestPage.locator('.boneyard-scene')
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const initialGuestGateState = await guestScene.getAttribute('data-gate-state')
  const target = nearestGateCenter(initialGateState, initialX, initialY)
  const initialDirection = Math.sign(target.y - initialY)
  assert.notEqual(initialDirection, 0, 'expected the entry gate to be beyond the player')
  const approachTarget = {
    x: target.x,
    y: target.y - initialDirection * (
      PLAYER_CHARACTER_RADIUS + BONEYARD_GATE_INITIAL_SWAY + 15
    ),
  }
  const aligned = await walkToPoint(
    hostPage,
    scene,
    boneyardScene,
    approachTarget,
    90_000,
    30,
  )
  const direction = Math.sign(target.y - aligned.y)
  assert.notEqual(direction, 0, 'expected the entry gate to be beyond the player')
  const key = direction < 0 ? 'w' : 's'
  const crossingDistance = Math.abs(target.y - aligned.y) + 35
  await holdUntil(
    hostPage,
    key,
    () => scene.getAttribute('data-local-player-y').then((value) => (
      (Number(value) - aligned.y) * direction > crossingDistance
    )),
    15_000,
  )
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  const finalGateState = await scene.getAttribute('data-gate-state')
  assert.equal(
    (finalY - aligned.y) * direction > crossingDistance,
    true,
    'physical gate contact did not open a player-width route',
  )
  assert.notEqual(finalGateState, initialGateState)
  await guestPage.bringToFront()
  await guestPage.waitForFunction((initial) => (
    document.querySelector('.boneyard-scene')?.getAttribute('data-gate-state') !== initial
  ), initialGuestGateState, { timeout: 10_000 })
  return {
    aligned,
    direction,
    finalGateState,
    finalY,
    initialGateState,
    initialX,
    initialY,
    targetX: target.x,
    targetY: target.y,
  }
}

function nearestGateCenter(serializedState, playerX, playerY) {
  const gates = new Map()
  for (const serialized of serializedState?.split('|') || []) {
    const separator = serialized.lastIndexOf(':')
    if (separator < 0) continue
    const id = serialized.slice(0, separator)
    const [x, y] = serialized.slice(separator + 1).split(',').map(Number)
    const gateId = id.slice(0, id.lastIndexOf(':'))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !gateId) continue
    const tips = gates.get(gateId) || []
    tips.push({ x, y })
    gates.set(gateId, tips)
  }
  const centers = [...gates.values()]
    .filter((tips) => tips.length === 2)
    .map((tips) => ({
      x: (tips[0].x + tips[1].x) / 2,
      y: (tips[0].y + tips[1].y) / 2,
    }))
  assert.ok(centers.length > 0, `expected an entry gate in ${serializedState}`)
  return centers.reduce((nearest, center) => (
    Math.hypot(center.x - playerX, center.y - playerY)
      < Math.hypot(nearest.x - playerX, nearest.y - playerY)
      ? center
      : nearest
  ))
}

async function holdUntil(page, key, predicate, timeoutMs) {
  await page.bringToFront()
  await page.keyboard.down(key)
  const deadline = Date.now() + timeoutMs
  try {
    while (Date.now() < deadline) {
      if (await predicate()) return
      await page.waitForTimeout(50)
    }
    throw new Error(`movement ${key} did not reach its target`)
  } finally {
    await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
}

async function walkToPoint(page, scene, boneyardScene, target, timeoutMs, tolerance = 10) {
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  let route = planPointPath(
    boneyardScene,
    await playerPointReceipt(scene, target),
    target,
  )
  let routeIndex = 1
  let stalledSteps = 0
  while (Date.now() - startedAt < timeoutMs) {
    const before = await playerPointReceipt(scene, target)
    if (before.distance <= tolerance) return { x: before.x, y: before.y }
    while (
      routeIndex < route.length
      && Math.hypot(
        route[routeIndex].x - before.x,
        route[routeIndex].y - before.y,
      ) <= 10
    ) {
      routeIndex += 1
    }
    if (routeIndex >= route.length) {
      route = planPointPath(boneyardScene, before, target)
      routeIndex = 1
      continue
    }
    const waypoint = route[routeIndex]
    const waypointDistance = Math.hypot(
      waypoint.x - before.x,
      waypoint.y - before.y,
    )
    await pulseSettledMovement(page, movementKeys({
      x: waypoint.x - before.x,
      y: waypoint.y - before.y,
    }), movementPulseDuration(waypointDistance))
    const after = await playerPointReceipt(scene, target)
    const nextWaypointDistance = Math.hypot(
      waypoint.x - after.x,
      waypoint.y - after.y,
    )
    if (nextWaypointDistance < waypointDistance - 1) {
      stalledSteps = 0
    } else {
      stalledSteps += 1
      if (stalledSteps >= 6) {
        route = planPointPath(boneyardScene, after, target)
        routeIndex = 1
        stalledSteps = 0
      }
    }
  }
  const final = await playerPointReceipt(scene, target)
  throw new Error(`could not walk to ${JSON.stringify(target)} from ${JSON.stringify(final)}`)
}

async function playerPointReceipt(scene, target) {
  const position = await scene.evaluate((node) => ({
    x: Number(node.getAttribute('data-local-player-x')),
    y: Number(node.getAttribute('data-local-player-y')),
  }))
  return {
    ...position,
    distance: Math.hypot(target.x - position.x, target.y - position.y),
  }
}

async function walkToSolomon(page, scene, boneyardScene) {
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  const samples = []
  const initial = await solomonApproachReceipt(scene)
  const solomon = { x: initial.solomonX, y: initial.solomonY }
  let route = planSolomonPath(
    boneyardScene,
    { x: initial.playerX, y: initial.playerY },
    solomon,
  )
  const routeNodes = route.length

  while (Date.now() - startedAt < 240_000) {
    const before = await solomonApproachReceipt(scene)
    samples.push(before)
    if (before.phase !== 'digging') {
      return {
        contactPosition: { x: before.playerX, y: before.playerY },
        phase: before.phase,
        routeNodes,
        samples: samples.length,
        startPosition: { x: samples[0].playerX, y: samples[0].playerY },
      }
    }
    const playerPosition = { x: before.playerX, y: before.playerY }
    if (solomonContactContains(solomon, playerPosition)) {
      const contactDeadline = Date.now() + 2_000
      while (Date.now() < contactDeadline) {
        await page.waitForTimeout(50)
        const held = await solomonApproachReceipt(scene)
        samples.push(held)
        if (held.phase !== 'digging') {
          return {
            contactPosition: { x: held.playerX, y: held.playerY },
            phase: held.phase,
            routeNodes,
            samples: samples.length,
            startPosition: { x: samples[0].playerX, y: samples[0].playerY },
          }
        }
      }
    }
    route = planSolomonPath(boneyardScene, playerPosition, solomon)
    const waypoint = route[1]
    assert.ok(waypoint, 'expected a collision-safe waypoint toward Solomon')
    await driveToSolomonWaypoint(page, scene, waypoint)
  }
  throw new Error(`could not walk to Solomon: ${JSON.stringify(samples.at(-1))}`)
}

async function driveToSolomonWaypoint(page, scene, waypoint) {
  const initial = await solomonApproachReceipt(scene)
  const keys = movementKeys({
    x: waypoint.x - initial.playerX,
    y: waypoint.y - initial.playerY,
  })
  assert.ok(keys.length > 0, 'expected movement keys for the Solomon waypoint')
  let closestDistance = Math.hypot(
    waypoint.x - initial.playerX,
    waypoint.y - initial.playerY,
  )
  const deadline = Date.now() + 1_500
  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    while (Date.now() < deadline) {
      const current = await solomonApproachReceipt(scene)
      if (current.phase !== 'digging') break
      const distance = Math.hypot(
        waypoint.x - current.playerX,
        waypoint.y - current.playerY,
      )
      if (distance <= 16) break
      if (distance > closestDistance + 2 && closestDistance < 40) break
      closestDistance = Math.min(closestDistance, distance)
      await page.waitForTimeout(25)
    }
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
  // Zero input damps retained native velocity by 0.9 each 10 ms tick. At the
  // 118.75 lane cap, 650 ms leaves less than 0.02 world units of coast.
  await page.waitForTimeout(650)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
}

function planSolomonPath(scene, start, solomon) {
  return planBoneyardPath(
    scene,
    start,
    solomon,
    (point) => solomonContactContains(solomon, point) ? [] : null,
    'Solomon',
  )
}

function planPointPath(
  scene,
  start,
  target,
  collision = createBoneyardCollisionWorld(scene),
) {
  return simplifyBoneyardPath(
    planBoneyardPath(
      scene,
      start,
      target,
      (point) => (
        Math.hypot(target.x - point.x, target.y - point.y) <= 40
        && traversesBoneyard(point, target, scene.bounds, collision)
          ? [target]
          : null
      ),
      JSON.stringify(target),
      collision,
    ),
    scene.bounds,
    collision,
  )
}

function planBoneyardPath(
  scene,
  start,
  target,
  finish,
  targetLabel,
  collision = createBoneyardCollisionWorld(scene),
) {
  const gridStep = 40
  const directions = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
  ]
  const startKey = '0,0'
  const parents = new Map([[startKey, null]])
  const points = new Map([[startKey, { ...start }]])
  const queue = [startKey]

  for (let cursor = 0; cursor < queue.length && cursor < 25_000; cursor += 1) {
    const key = queue[cursor]
    const point = points.get(key)
    const tail = finish(point)
    if (tail !== null) {
      return [...reconstructGridPath(key, parents, points), ...tail]
    }
    const [gridX, gridY] = key.split(',').map(Number)
    const orderedDirections = directions.toSorted((first, second) => {
      const firstDistance = Math.hypot(
        start.x + (gridX + first.x) * gridStep - target.x,
        start.y + (gridY + first.y) * gridStep - target.y,
      )
      const secondDistance = Math.hypot(
        start.x + (gridX + second.x) * gridStep - target.x,
        start.y + (gridY + second.y) * gridStep - target.y,
      )
      return firstDistance - secondDistance
    })
    for (const direction of orderedDirections) {
      const nextGridX = gridX + direction.x
      const nextGridY = gridY + direction.y
      const nextKey = `${nextGridX},${nextGridY}`
      if (parents.has(nextKey)) continue
      const next = {
        x: start.x + nextGridX * gridStep,
        y: start.y + nextGridY * gridStep,
      }
      if (!traversesBoneyard(point, next, scene.bounds, collision)) continue
      parents.set(nextKey, key)
      points.set(nextKey, next)
      queue.push(nextKey)
    }
  }
  throw new Error(`no collision-safe route to ${targetLabel} from ${JSON.stringify(start)}`)
}

function traversesBoneyard(start, target, bounds, collision) {
  const distance = Math.hypot(target.x - start.x, target.y - start.y)
  const steps = Math.ceil(distance / 8)
  let current = { ...start }
  for (let step = 1; step <= steps; step += 1) {
    const requested = {
      x: start.x + (target.x - start.x) * step / steps,
      y: start.y + (target.y - start.y) * step / steps,
    }
    const resolved = resolveBoneyardMovement(
      current,
      requested,
      bounds,
      collision,
      PLAYER_CHARACTER_RADIUS,
    )
    if (Math.hypot(resolved.x - requested.x, resolved.y - requested.y) > 0.25) {
      return false
    }
    current = resolved
  }
  return true
}

function reconstructGridPath(goalKey, parents, points) {
  const reversed = []
  let key = goalKey
  while (key !== null) {
    reversed.push(points.get(key))
    key = parents.get(key)
  }
  return reversed.reverse()
}

function simplifyBoneyardPath(path, bounds, collision) {
  const simplified = [path[0]]
  let currentIndex = 0
  while (currentIndex < path.length - 1) {
    let nextIndex = path.length - 1
    while (
      nextIndex > currentIndex + 1
      && !traversesBoneyard(path[currentIndex], path[nextIndex], bounds, collision)
    ) {
      nextIndex -= 1
    }
    simplified.push(path[nextIndex])
    currentIndex = nextIndex
  }
  return simplified
}

function movementPulseDuration(distance) {
  return Math.min(1_000, Math.max(250, Math.round(distance * 8)))
}

async function pulseSettledMovement(page, keys, durationMs) {
  await pulseMovement(page, keys, durationMs)
  await publishStoppedMovement(page)
  // Zero input damps the native 0.9-per-tick velocity tail below 0.02 units.
  await page.waitForTimeout(650)
}

async function publishStoppedMovement(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
    return new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

async function solomonApproachReceipt(scene) {
  return scene.evaluate((node) => {
    const playerX = Number(node.getAttribute('data-local-player-x'))
    const playerY = Number(node.getAttribute('data-local-player-y'))
    const solomonX = Number(node.getAttribute('data-solomon-x'))
    const solomonY = Number(node.getAttribute('data-solomon-y'))
    return {
      distance: Math.hypot(solomonX - playerX, solomonY - playerY),
      phase: node.getAttribute('data-solomon-phase'),
      playerX,
      playerY,
      solomonX,
      solomonY,
    }
  })
}

function compactHealthSamples(samples) {
  if (samples.length <= 12) return samples
  const stride = Math.ceil(samples.length / 10)
  return samples.filter((_sample, index) => index % stride === 0 || index === samples.length - 1)
}

function compactSingleHealthSamples(samples) {
  if (samples.length <= 12) return samples
  const stride = Math.ceil(samples.length / 10)
  return samples.filter((_sample, index) => index % stride === 0 || index === samples.length - 1)
}

async function pageDiagnostics(page) {
  if (page.isClosed()) return { closed: true }
  const url = page.url()
  let body
  try {
    body = (await page.locator('body').innerText({ timeout: 5_000 })).slice(0, 1_500)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      unresponsive: true,
      url,
    }
  }
  return {
    body,
    frame: await page.locator('.boneyard-world-canvas').count() > 0
      ? await boneyardFrame(page)
      : null,
    url,
  }
}

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_MULTIPLAYER_COMBAT_SMOKE_URL
  || process.env.SDR_GAME_SMOKE_URL
  || 'http://127.0.0.1:4187'
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
const [hostBrowser, guestBrowser] = await Promise.all([
  chromium.launch(browserOptions),
  chromium.launch(browserOptions),
])
const hostPage = await hostBrowser.newPage({ viewport })
const guestPage = await guestBrowser.newPage({ viewport })
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
  const gateCrossing = await crossEntryGate(hostPage, guestPage)
  const approach = await walkToSolomon(hostPage)
  assert.notEqual(approach.phase, 'digging')
  await Promise.all([
    waitForOpeningEnemies(hostPage),
    waitForOpeningEnemies(guestPage),
  ])

  const firstDeath = await driveDesignatedHostToSpectating({
    guest: { label: 'guest', page: guestPage },
    host: { label: 'host', page: hostPage },
  })
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
  const firstSpectatorCamera = assertSpectatorCameraFrame(
    firstDeath.fallenFrame,
    guestHub.localPlayerId,
  )
  const spectatorHud = await spectatorStatusReceipt(
    firstDeath.fallen.page,
    firstDeath.fallenFrame,
    guestHub.localPlayerId,
  )
  await firstDeath.fallen.page.screenshot({ path: firstDeathScreenshotPath })

  const inputLock = await proveSpectatorInputLock(
    firstDeath.fallen.page,
    guestHub.localPlayerId,
  )
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
  await Promise.all([hostBrowser.close(), guestBrowser.close()])
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

async function driveDesignatedHostToSpectating({ guest, host }) {
  const healthSamples = []
  let sawDeathPresentation = false
  const deadline = Date.now() + 300_000

  while (Date.now() < deadline) {
    const [hostFrame, guestFrame] = await Promise.all([
      boneyardFrame(host.page),
      boneyardFrame(guest.page),
    ])
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
          await host.page.locator('.boneyard-spectator-status').count(),
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
      await pulseAwayFromNearestEnemy(guest.page, guestFrame, 240)
      continue
    }

    await Promise.all([
      pulseTowardNearestEnemy(host.page, hostFrame, 220),
      pulseAwayFromNearestEnemy(guest.page, guestFrame, 280),
    ])
  }
  throw new Error('designated host did not reach the native spectator state')
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
  const text = (await status.textContent())?.replace(/\s+/g, ' ').trim()
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

async function pulseAwayFromNearestEnemy(page, frame, durationMs) {
  const target = nearestLivingEnemy(frame)
  if (!target) {
    await page.waitForTimeout(100)
    return
  }
  await pulseMovement(page, movementKeys({
    x: frame.playerX - target.x,
    y: frame.playerY - target.y,
  }), durationMs)
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

async function crossEntryGate(hostPage, guestPage) {
  const scene = hostPage.locator('.boneyard-scene')
  const guestScene = guestPage.locator('.boneyard-scene')
  const gate = await alignWithEntryGate(hostPage, scene)
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const initialGuestGateState = await guestScene.getAttribute('data-gate-state')
  const direction = Math.sign(gate.targetY - initialY)
  assert.notEqual(direction, 0, 'expected the entry gate to be beyond the player')
  const key = direction < 0 ? 'w' : 's'
  const crossingDistance = Math.abs(gate.targetY - initialY) + 35
  let crossed = await pushThroughGate(
    hostPage,
    key,
    { crossingDistance, direction, initialY },
    20_000,
  )
  if (!crossed) {
    await pulseMovement(hostPage, ['d'], 250)
    crossed = await pushThroughGate(
      hostPage,
      key,
      { crossingDistance, direction, initialY },
      45_000,
    )
  }
  assert.equal(crossed, true, 'physical gate contact did not open a player-width route')
  await guestPage.bringToFront()
  await guestPage.waitForFunction((initial) => (
    document.querySelector('.boneyard-scene')?.getAttribute('data-gate-state') !== initial
  ), initialGuestGateState, { timeout: 10_000 })
  return {
    direction,
    finalGateState: await scene.getAttribute('data-gate-state'),
    finalY: Number(await scene.getAttribute('data-local-player-y')),
    initialGateState,
    initialY,
    targetY: gate.targetY,
  }
}

async function pushThroughGate(page, key, crossing, timeoutMs) {
  await page.bringToFront()
  await page.keyboard.down(key)
  try {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const y = Number(await page.locator('.boneyard-scene')
        .getAttribute('data-local-player-y'))
      if ((y - crossing.initialY) * crossing.direction > crossing.crossingDistance) {
        return true
      }
      await page.waitForTimeout(100)
    }
    return false
  } finally {
    await page.keyboard.up(key)
  }
}

async function alignWithEntryGate(page, scene) {
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const gateState = await scene.getAttribute('data-gate-state')
  const gates = new Map()
  for (const serialized of gateState?.split('|') || []) {
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
  assert.ok(centers.length > 0, `expected an entry gate in ${gateState}`)
  const target = centers.reduce((nearest, center) => (
    Math.hypot(center.x - initialX, center.y - initialY)
      < Math.hypot(nearest.x - initialX, nearest.y - initialY)
      ? center
      : nearest
  ))
  const delta = target.x - initialX
  if (Math.abs(delta) > 3) {
    await walkToPoint(page, scene, { x: target.x, y: initialY }, 60_000)
  }
  return { targetX: target.x, targetY: target.y }
}

async function walkToPoint(page, scene, target, timeoutMs) {
  const startedAt = Date.now()
  let stalledSteps = 0
  let wallFollow = null
  while (Date.now() - startedAt < timeoutMs) {
    const before = await playerPointReceipt(scene, target)
    if (before.distance <= 6) return before
    const dx = target.x - before.x
    const dy = target.y - before.y
    let movement = { x: dx, y: dy }
    if (wallFollow) {
      movement = {
        x: dx * 0.25 - dy * wallFollow.sign,
        y: dy * 0.25 + dx * wallFollow.sign,
      }
    }
    await pulseMovement(page, movementKeys(movement), 150)
    const after = await playerPointReceipt(scene, target)
    if (wallFollow && after.distance < wallFollow.blockedDistance - 30) {
      wallFollow = null
      stalledSteps = 0
    } else if (wallFollow) {
      const moved = Math.hypot(after.x - before.x, after.y - before.y)
      wallFollow.stalledSteps = moved < 1 ? wallFollow.stalledSteps + 1 : 0
      if (wallFollow.stalledSteps >= 4) {
        wallFollow = {
          blockedDistance: after.distance,
          sign: -wallFollow.sign,
          stalledSteps: 0,
        }
      }
    } else if (after.distance < before.distance - 1) {
      stalledSteps = 0
    } else {
      stalledSteps += 1
      if (stalledSteps >= 4) {
        wallFollow = {
          blockedDistance: after.distance,
          sign: 1,
          stalledSteps: 0,
        }
        stalledSteps = 0
      }
    }
  }
  throw new Error(`could not walk to ${JSON.stringify(target)}`)
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

async function walkToSolomon(page) {
  const scene = page.locator('.boneyard-scene')
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  const samples = []
  let stalledSteps = 0
  let wallFollow = null

  while (Date.now() - startedAt < 180_000) {
    const before = await solomonApproachReceipt(scene)
    samples.push(before)
    if (before.phase !== 'digging') {
      return {
        contactPosition: { x: before.playerX, y: before.playerY },
        phase: before.phase,
        samples: samples.length,
        startPosition: { x: samples[0].playerX, y: samples[0].playerY },
      }
    }

    const dx = before.solomonX - before.playerX
    const dy = before.solomonY - before.playerY
    let movement = { x: dx, y: dy }
    if (wallFollow) {
      movement = {
        x: dx * 0.25 - dy * wallFollow.sign,
        y: dy * 0.25 + dx * wallFollow.sign,
      }
      wallFollow.steps += 1
    }
    await pulseMovement(page, movementKeys(movement), 150)

    const after = await solomonApproachReceipt(scene)
    if (after.phase !== 'digging') continue
    if (wallFollow && after.distance < wallFollow.blockedDistance - 30) {
      wallFollow = null
      stalledSteps = 0
    } else if (wallFollow?.steps >= 50) {
      wallFollow = {
        blockedDistance: after.distance,
        sign: -wallFollow.sign,
        steps: 0,
      }
    } else if (!wallFollow && after.distance < before.distance - 1) {
      stalledSteps = 0
    } else if (!wallFollow) {
      stalledSteps += 1
      if (stalledSteps >= 4) {
        wallFollow = {
          blockedDistance: after.distance,
          sign: 1,
          steps: 0,
        }
        stalledSteps = 0
      }
    }
  }
  throw new Error(`could not walk to Solomon: ${JSON.stringify(samples.at(-1))}`)
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

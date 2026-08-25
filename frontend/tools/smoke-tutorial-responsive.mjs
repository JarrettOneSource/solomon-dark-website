import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'

import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { createBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import {
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN,
  createNativeTutorialState,
  nativeTutorialCameraBounds,
  nativeTutorialEnemySpawnPositionIsAllowed,
} from '../src/game/core-kernels/native-tutorial.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { materializeStockTutorial } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { boneyardCamera } from '../src/game/renderer/boneyard-render-contract.ts'

const screenshotRoot = process.env.SDR_TUTORIAL_RESPONSIVE_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-tutorial-responsive'
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const scenarios = [
  {
    coarse: false,
    name: 'stock',
    preludeScreenshot: `${screenshotRoot}-stock-prelude.png`,
    screenshot: `${screenshotRoot}-stock.png`,
    uiScalePercent: 100,
    viewport: { height: 900, width: 1_600 },
  },
  {
    coarse: false,
    name: 'desktop-75',
    preludeScreenshot: `${screenshotRoot}-desktop-75-prelude.png`,
    screenshot: `${screenshotRoot}-desktop-75.png`,
    uiScalePercent: 75,
    viewport: { height: 1_080, width: 1_920 },
  },
  {
    coarse: false,
    name: 'large',
    preludeScreenshot: `${screenshotRoot}-large-prelude.png`,
    screenshot: `${screenshotRoot}-large.png`,
    uiScalePercent: 125,
    viewport: { height: 1_080, width: 2_560 },
  },
  {
    coarse: true,
    name: 'mobile',
    preludeScreenshot: `${screenshotRoot}-mobile-prelude.png`,
    screenshot: `${screenshotRoot}-mobile.png`,
    uiScalePercent: 100,
    viewport: { height: 414, width: 896 },
  },
]

const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const baseUrl = staticServer.origin
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  executablePath: chromePath,
  headless: true,
})

const receipts = []
try {
  for (const scenario of scenarios) receipts.push(await runScenario(scenario))
  process.stdout.write(`${JSON.stringify({ receipts, status: 'ok' })}\n`)
} finally {
  await browser.close()
  await staticServer.close()
}

async function runScenario(scenario) {
  const credential = randomBytes(32).toString('base64url')
  const host = await startGameHost({
    allowedOrigins: [baseUrl],
    authentication: { kind: 'shared', credential },
    resetWhenEmpty: true,
    snapshotRate: 100,
  })
  const context = await browser.newContext({
    hasTouch: scenario.coarse,
    isMobile: scenario.coarse,
    screen: scenario.viewport,
    viewport: scenario.viewport,
  })
  const page = await context.newPage()
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }))
  const consoleErrors = []
  const failedResponses = []
  const pageErrors = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const location = message.location()
    consoleErrors.push(location.url ? `${message.text()} @ ${location.url}` : message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())) return
    failedResponses.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(({ key, settings }) => {
    localStorage.setItem(key, JSON.stringify(settings))
  }, {
    key: GAME_SETTINGS_STORAGE_KEY,
    settings: { ...DEFAULT_GAME_SETTINGS, uiScalePercent: scenario.uiScalePercent },
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
  })
  await page.addInitScript(bypassStartupAudioPreload)
  const fixture = tutorialIntroSave()
  await seedLocalSave(page, fixture.record)

  try {
    await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
    await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
    await page.getByRole('button', { name: 'Play' }).click()
    const lastGame = page.getByRole('button', { name: 'Last game' })
    assert.equal(await lastGame.isEnabled(), true)
    await lastGame.click()

    await waitForRestoredTutorial(host)
    await waitForBoneyardRenderer(page, { consoleErrors, failedResponses, pageErrors })
    forceTutorialState(host, {
      introActive: true,
      introBlend: 0.65,
      introDelayTicksRemaining: 0,
      introFade: 1,
      introMovementTicksRemaining: 0,
      stage: 0,
      stageTicks: 0,
    })
    const overlay = page.locator('.tutorial-overlay[data-intro-active="true"]')
    await overlay.waitFor({ timeout: 90_000 })
    const prelude = await measurePrelude(page)
    close(prelude.recordCenterX, prelude.overlayCenterX, 0.6, `${scenario.name} prelude x`)
    close(prelude.recordCenterY, prelude.overlayCenterY, 0.6, `${scenario.name} prelude y`)
    await page.screenshot({ path: scenario.preludeScreenshot })

    forceTutorialState(host, {
      introActive: false,
      introBlend: 1,
      introDelayTicksRemaining: 0,
      introFade: 0,
      introMovementTicksRemaining: 0,
      stage: 5,
      stageTicks: 0,
    })
    const pointer = page.locator('[data-tutorial-pointer="secondary-slot"]')
    await pointer.waitFor({ timeout: 15_000 })
    const initial = await measureStageFive(page)
    assertStageFiveReceipt(initial, scenario)

    await page.locator('[data-tutorial-anchor="secondary-slot"]').evaluate((slot) => {
      slot.style.transform = 'translate(80px, -25px)'
    })
    await page.waitForFunction(({ targetX, targetY }) => {
      const pointer = document.querySelector('[data-tutorial-pointer="secondary-slot"]')
      return pointer instanceof HTMLElement
        && (Number(pointer.dataset.targetX) !== targetX
          || Number(pointer.dataset.targetY) !== targetY)
    }, { targetX: initial.targetX, targetY: initial.targetY })
    const moved = await measureStageFive(page)
    assertStageFiveReceipt(moved, scenario)
    const uiScale = scenario.uiScalePercent / 100
    close(moved.targetX - initial.targetX, 80 * uiScale, 0.1, `${scenario.name} moved x`)
    close(moved.targetY - initial.targetY, -25 * uiScale, 0.1, `${scenario.name} moved y`)

    await page.screenshot({ path: scenario.screenshot })
    const spawnDomain = scenario.name === 'stock'
      ? await exerciseTutorialSpawnDomain(host, page, screenshotRoot)
      : null
    assert.deepEqual({ consoleErrors, failedResponses, pageErrors }, {
      consoleErrors: [],
      failedResponses: [],
      pageErrors: [],
    })
    return {
      consoleErrors,
      failedResponses,
      initial,
      moved,
      pageErrors,
      prelude,
      preludeScreenshot: scenario.preludeScreenshot,
      scenario: scenario.name,
      screenshot: scenario.screenshot,
      spawnDomain,
      fixtureSha256: fixture.record.sha256,
    }
  } finally {
    await context.close()
    await host.close()
  }
}

async function waitForBoneyardRenderer(page, errors) {
  const boneyard = page.locator('.boneyard-scene')
  try {
    await boneyard.waitFor({ timeout: 15_000 })
  } catch {
    const pageState = await page.evaluate(() => {
      const menu = document.querySelector('.main-menu-page')
      const loading = document.querySelector('.match-loading-screen')
      return {
        bodyText: document.body.innerText.trim().slice(0, 2_000),
        gameScene: menu instanceof HTMLElement ? menu.dataset.gameScene : null,
        loading: loading instanceof HTMLElement ? { ...loading.dataset } : null,
        url: location.href,
      }
    })
    throw new Error(`browser did not mount the restored Boneyard: ${JSON.stringify({
      ...pageState,
      ...errors,
    })}`)
  }
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return scene instanceof HTMLElement && scene.dataset.rendererState !== 'loading'
  }, null, { timeout: 90_000 })
  const receipt = await boneyard.evaluate((scene) => ({
    rendererState: scene.dataset.rendererState,
    status: scene.querySelector('.hub-renderer-status')?.textContent?.trim() ?? null,
  }))
  assert.equal(receipt.rendererState, 'ready', JSON.stringify({ ...receipt, ...errors }))
}

async function waitForRestoredTutorial(host) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const state = host.state()
    if (state.world.kind === 'boneyard' && state.world.tutorial?.introActive === true) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  const state = host.state()
  throw new Error(`host did not restore the Tutorial intro: ${JSON.stringify({
    hostPlayerId: host.hostPlayerId(),
    tick: state.tick,
    tutorial: state.world.kind === 'boneyard' ? state.world.tutorial : null,
    world: state.world.kind,
  })}`)
}

function forceTutorialState(host, patch) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  Object.assign(state, {
    ...state,
    world: {
      ...state.world,
      tutorial: { ...state.world.tutorial, ...patch },
    },
  })
}

async function exerciseTutorialSpawnDomain(host, page, screenshotPath) {
  const waves = [
    { expectedCount: 10, label: 'opening-dark', ordinal: 1, spawnCursor: 0, waveTicks: 0 },
    { expectedCount: 5, label: 'item-offscreen', ordinal: 2, spawnCursor: 0, waveTicks: 0 },
    { expectedCount: 3, label: 'shared-root-dark', ordinal: 4, spawnCursor: 2, waveTicks: 500 },
    { expectedCount: 1, label: 'potion-light', ordinal: 5, spawnCursor: 0, waveTicks: 0 },
  ]
  const waveReceipts = []
  for (const wave of waves) {
    const configuredTick = configureTutorialWave(host, wave)
    const actors = await waitForTutorialActors(host, wave.expectedCount, configuredTick)
    await waitForRenderedTutorialActors(page, actors, configuredTick)
    const rendered = await renderedEnemyFrame(page)
    const radiusById = new Map(actors.map((actor) => [actor.id, actor.config.collisionRadius]))
    assert.ok(actors.every((actor) => nativeTutorialEnemySpawnPositionIsAllowed(
      actor.position,
      actor.config.collisionRadius,
    )), wave.label)
    assert.ok(rendered.enemySamples.every((actor) => nativeTutorialEnemySpawnPositionIsAllowed(
      { x: actor.x, y: actor.y },
      radiusById.get(actor.id),
    )), `${wave.label} rendered`)
    waveReceipts.push({
      actorCount: actors.length,
      families: [...new Set(actors.map(({ config }) => config.enemyToken))].sort(),
      label: wave.label,
      minimumClearance: Math.min(...actors.map((actor) => (
        tutorialEntranceFenceY(actor.position.x)
        - actor.position.y
        - actor.config.collisionRadius
      ))),
      renderedCount: rendered.enemySamples.length,
      tick: rendered.tick,
    })
    if (wave.label === 'opening-dark') {
      await page.waitForFunction(() => {
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        return frame?.enemySamples.some((enemy) => (
          Math.hypot(enemy.x - frame.playerX, enemy.y - frame.playerY) < 250
        ))
      }, null, { timeout: 10_000 })
      await page.screenshot({ path: `${screenshotPath}-stock-enemy-spawns.png` })
    }
  }

  const cameraConfiguredTick = configureTutorialCamera(host)
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const state = host.state()
    const tutorial = state.world.kind === 'boneyard' ? state.world.tutorial : null
    if (
      tutorial?.cameraLockAgeTicks === NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS
      && tutorial.cameraLockTicksRemaining === 0
    ) break
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  assert.equal(
    state.world.tutorial.cameraLockAgeTicks,
    NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  )
  assert.equal(state.world.tutorial.cameraLockTicksRemaining, 0)
  const cameraBounds = nativeTutorialCameraBounds(state.world.tutorial)
  assert.ok(cameraBounds)
  const playerId = state.playerEntities.identities[0].playerId
  const expectedCamera = boneyardCamera(getPlayerCharacter(state, playerId).position, cameraBounds)
  await page.waitForFunction(({ expectedCamera, minimumTick }) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame
      && frame.tick >= minimumTick
      && Math.abs(frame.cameraX - expectedCamera.x) < 0.01
      && Math.abs(frame.cameraY - expectedCamera.y) < 0.01
  }, { expectedCamera, minimumTick: cameraConfiguredTick }, { timeout: 15_000 })
  const cameraFrame = await renderedEnemyFrame(page)
  await page.screenshot({ path: `${screenshotPath}-stock-camera-locked.png` })
  return {
    camera: {
      ageTicks: state.world.tutorial.cameraLockAgeTicks,
      bounds: cameraBounds,
      cleanupTicksRemaining: state.world.tutorial.cameraLockTicksRemaining,
      rendered: { x: cameraFrame.cameraX, y: cameraFrame.cameraY },
    },
    waveReceipts,
  }
}

function configureTutorialWave(host, wave) {
  return configureTutorialFixture(host, {
    position: { x: 1025, y: 1350 },
    tutorial: {
      active: false,
      stage: 19,
      waveOrdinal: wave.ordinal,
      waveSpawnCursor: wave.spawnCursor,
      waveTicks: wave.waveTicks,
    },
  })
}

function configureTutorialCamera(host) {
  return configureTutorialFixture(host, {
    position: { x: 1025, y: 800 },
    tutorial: { active: false, stage: 19, waveOrdinal: 0 },
  })
}

function configureTutorialFixture(host, fixture) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  const playerId = state.playerEntities.identities[0].playerId
  const character = getPlayerCharacter(state, playerId)
  const playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
    ...character,
    position: fixture.position,
    velocity: { x: 0, y: 0 },
  })
  const tutorial = {
    ...createNativeTutorialState(fixture.position, 0, `browser-${state.tick}`),
    introActive: false,
    introBlend: 1,
    introDelayTicksRemaining: 0,
    introFade: 0,
    introMovementTicksRemaining: 0,
    ...fixture.tutorial,
  }
  const existingEnemies = state.world.enemies
  const freshEnemies = createBoneyardEnemyStore(
    `tutorial-browser-${state.tick}`,
    state.world.earthquakeSceneryTargets.length,
  )
  Object.assign(state, {
    ...state,
    playerEntities,
    world: {
      ...state.world,
      enemies: {
        ...freshEnemies,
        lastStepTick: state.tick,
        nextActorId: existingEnemies.nextActorId,
        nextDeathEpoch: existingEnemies.nextDeathEpoch,
        nextDeathEffectId: existingEnemies.nextDeathEffectId,
        nextEventId: existingEnemies.nextEventId,
        nextMageLightningPulseId: existingEnemies.nextMageLightningPulseId,
        nextNativeCellBindingOrder: existingEnemies.nextNativeCellBindingOrder,
        nextNativeRegistrationOrder: existingEnemies.nextNativeRegistrationOrder,
        nextProjectileEffectId: existingEnemies.nextProjectileEffectId,
        nextProjectileId: existingEnemies.nextProjectileId,
        nextSyntheticSpawnIntentId: existingEnemies.nextSyntheticSpawnIntentId,
      },
      enemyEvents: [],
      tutorial,
    },
  })
  return state.tick
}

async function waitForTutorialActors(host, expectedCount, minimumTick) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const state = host.state()
    if (
      state.tick > minimumTick
      && state.world.kind === 'boneyard'
      && state.world.enemies.actors.length === expectedCount
    ) return state.world.enemies.actors
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Tutorial host did not materialize ${expectedCount} enemies`)
}

async function waitForRenderedTutorialActors(page, actors, minimumTick) {
  const expectedIds = actors.map(({ id }) => id).sort((left, right) => left - right)
  await page.waitForFunction(({ expectedIds, minimumTick }) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame
      && frame.tick >= minimumTick
      && JSON.stringify(frame.enemySamples.map(({ id }) => id).sort((a, b) => a - b))
        === JSON.stringify(expectedIds)
  }, { expectedIds, minimumTick }, { timeout: 10_000 })
}

function renderedEnemyFrame(page) {
  return page.evaluate(() => structuredClone(
    document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame,
  ))
}

function tutorialEntranceFenceY(x) {
  if (x <= NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[0].x) {
    return NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[0].y
  }
  for (let index = 1; index < NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.length; index += 1) {
    const end = NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index]
    if (x > end.x) continue
    const start = NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN[index - 1]
    const progress = (x - start.x) / (end.x - start.x)
    return start.y + (end.y - start.y) * progress
  }
  return NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN.at(-1).y
}

function tutorialIntroSave() {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 31))
  let state = enterBoneyardWorld(
    createGameSimulation({ owner: {
      discipline: 'arcane',
      displayName: 'Sirmin',
      element: 'ether',
    } }),
    loadedBoneyard,
  )
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  state = {
    ...state,
    world: {
      ...state.world,
      tutorial: {
        ...state.world.tutorial,
        introActive: true,
        introBlend: 0,
        introDelayTicksRemaining: 25,
        introFade: 1,
        introMovementTicksRemaining: 0,
        stage: 0,
        stageTicks: 0,
      },
    },
  }
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  return {
    record: {
      document,
      formatVersion: WEB_GAME_SAVE_SCHEMA_VERSION,
      revision: 1,
      sha256: createHash('sha256').update(document).digest('hex'),
      slot: WEB_GAME_SAVE_SLOT,
      updatedAtUtc: new Date().toISOString(),
    },
  }
}

async function seedLocalSave(target, record) {
  await target.goto(new URL('/deployment.json', baseUrl).href, { waitUntil: 'domcontentloaded' })
  await target.evaluate((seed) => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains('slots')) {
        open.result.createObjectStore('slots', { keyPath: 'slot' })
      }
    }
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(seed)
      transaction.onabort = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    }
  }), record)
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
  Object.defineProperty(window, '__sdrRestoreAudioPreload', {
    value: () => { HTMLMediaElement.prototype.load = nativeLoad },
  })
}

function measurePrelude(page) {
  return page.evaluate(() => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`missing ${selector}`)
      return element
    }
    const overlay = requiredElement('.tutorial-overlay')
    const record = requiredElement('.tutorial-prelude-record')
    const overlayRect = overlay.getBoundingClientRect()
    const recordRect = record.getBoundingClientRect()
    return {
      overlayCenterX: overlayRect.left + overlayRect.width / 2,
      overlayCenterY: overlayRect.top + overlayRect.height / 2,
      recordCenterX: recordRect.left + recordRect.width / 2,
      recordCenterY: recordRect.top + recordRect.height / 2,
    }
  })
}

function measureStageFive(page) {
  return page.evaluate(() => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`missing ${selector}`)
      return element
    }
    const overlay = requiredElement('.tutorial-overlay')
    const pointer = requiredElement('[data-tutorial-pointer="secondary-slot"]')
    const slot = requiredElement('[data-tutorial-anchor="secondary-slot"]')
    const heading = requiredElement(
      '.tutorial-instruction-text:not(.tutorial-instruction-shadow):not(.tutorial-instruction-subheading)',
    )
    const overlayRect = overlay.getBoundingClientRect()
    const slotRect = slot.getBoundingClientRect()
    const headingRect = heading.getBoundingClientRect()
    const logicalWidth = Number(overlay.dataset.viewportWidth)
    const logicalHeight = Number(overlay.dataset.viewportHeight)
    return {
      bank: slot.dataset.quickbarBank,
      coarse: matchMedia('(hover: none) and (pointer: coarse)').matches,
      headingBaseline: Number(overlay.dataset.headingBaseline),
      headingCenterX: headingRect.left + headingRect.width / 2,
      originX: Number.parseFloat(pointer.style.left),
      originY: Number.parseFloat(pointer.style.top),
      overlayCenterX: overlayRect.left + overlayRect.width / 2,
      targetX: Number(pointer.dataset.targetX),
      targetY: Number(pointer.dataset.targetY),
      targetFromSlotX: (slotRect.left + slotRect.width / 2 - overlayRect.left)
        * logicalWidth / overlayRect.width,
      targetFromSlotY: (slotRect.top + slotRect.height / 2 - overlayRect.top)
        * logicalHeight / overlayRect.height,
      uiScale: Number(requiredElement('.hub-hud').dataset.uiScale),
      viewportHeight: logicalHeight,
      viewportWidth: logicalWidth,
    }
  })
}

function assertStageFiveReceipt(receipt, scenario) {
  close(receipt.targetX, receipt.targetFromSlotX, 0.05, `${scenario.name} target x`)
  close(receipt.targetY, receipt.targetFromSlotY, 0.05, `${scenario.name} target y`)
  close(receipt.originX, receipt.targetX - 70, 0.05, `${scenario.name} origin x`)
  close(receipt.originY, receipt.targetY - 50, 0.05, `${scenario.name} origin y`)
  close(receipt.headingCenterX, receipt.overlayCenterX, 0.6, `${scenario.name} heading x`)
  close(receipt.headingBaseline, receipt.viewportHeight - 170, 0.001, `${scenario.name} heading y`)
  assert.equal(receipt.coarse, scenario.coarse)
  assert.equal(receipt.uiScale, scenario.uiScalePercent / 100)
  if (scenario.coarse) assert.equal(receipt.bank, 'left')
}

function close(actual, expected, epsilon, label) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: ${actual} is not within ${epsilon} of ${expected}`,
  )
}

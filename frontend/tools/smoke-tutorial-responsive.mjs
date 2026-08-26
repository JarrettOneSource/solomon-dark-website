import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'

import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { createBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import {
  removeBoneyardLootActors,
  spawnBoneyardCustomLootItems,
} from '../src/game/core-server/boneyard-loot-store.ts'
import {
  canPlaceBoneyardBody,
  resolveBoneyardMovement,
} from '../src/game/core-server/boneyard-collision.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../src/game/core-kernels/actor-physics.ts'
import { GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS } from '../src/game/core-kernels/game-run.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import { nativeCollegePathHeadingIndex } from '../src/game/core-kernels/native-college-intro.ts'
import {
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  NATIVE_TUTORIAL_CAMERA_TARGET,
  NATIVE_TUTORIAL_ENTRANCE_FENCE_CHAIN,
  createNativeTutorialState,
  nativeTutorialCameraBounds,
  nativeTutorialAmuletItem,
  nativeTutorialEnemySpawnPositionIsAllowed,
} from '../src/game/core-kernels/native-tutorial.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { materializeStockTutorial } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import {
  createGameSaveDocument,
  restoreGameSaveDocument,
} from '../src/game/save/game-save-document.ts'
import { boneyardCamera } from '../src/game/renderer/boneyard-render-contract.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const screenshotRoot = process.env.SDR_TUTORIAL_RESPONSIVE_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-tutorial-responsive'
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const allScenarios = [
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
const requestedScenario = process.env.SDR_TUTORIAL_RESPONSIVE_SCENARIO?.trim()
const scenarios = requestedScenario
  ? allScenarios.filter(({ name }) => name === requestedScenario)
  : allScenarios
assert.ok(scenarios.length > 0, `unknown Tutorial responsive scenario: ${requestedScenario}`)

const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const baseUrl = staticServer.origin
const browser = await chromium.launch({
  args: ['--disable-audio-output'],
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
  await page.addInitScript(installGameAudioSmokeProbe)
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
    const groundDrop = scenario.name === 'stock'
      ? await exerciseTutorialGroundDrop(host, page, screenshotRoot)
      : null
    forceTutorialState(host, {
      introActive: false,
      introBlend: 1,
      introDelayTicksRemaining: 0,
      introFade: 0,
      introMovementTicksRemaining: 0,
      stage: 18,
      stageTicks: 0,
    })
    await page.locator('.tutorial-overlay[data-stage="18"]').waitFor({ timeout: 15_000 })
    const potionBindings = await page.locator('.hub-hud').evaluate((hud) => ({
      health: hud.querySelector('.hub-hud-potion-button-red')?.getAttribute('data-binding-label'),
      healthPlaque: hud.querySelectorAll(
        '.hub-hud-potion-button-red .hub-hud-quickbar-key-backing',
      ).length,
      mana: hud.querySelector('.hub-hud-potion-button-blue')?.getAttribute('data-binding-label'),
      manaPlaque: hud.querySelectorAll(
        '.hub-hud-potion-button-blue .hub-hud-quickbar-key-backing',
      ).length,
    }))
    assert.deepEqual(potionBindings, {
      health: '3',
      healthPlaque: 1,
      mana: '4',
      manaPlaque: 1,
    })
    assert.match(
      await page.locator('.tutorial-overlay[data-stage="18"] .tutorial-instruction .sr-only')
        .innerText(),
      /3/,
    )
    const vitals = {
      healthMeter: await measureHudPointer(page, 'health-meter', 20),
      healthPotion: await measureHudPointer(page, 'health-potion', 50),
    }
    assertHudPointer(vitals.healthPotion, -50, -30, `${scenario.name} health-potion pointer`)
    assertHudPointer(vitals.healthMeter, -100, 70, `${scenario.name} health-meter pointer`)
    const vitalsScreenshot = `${screenshotRoot}-${scenario.name}-vitals.png`
    await page.waitForFunction(() => {
      const pointer = document.querySelector('[data-tutorial-pointer="health-potion"]')
      return pointer instanceof HTMLElement && getComputedStyle(pointer).opacity === '1'
    }, undefined, { timeout: 10_000 })
    await page.screenshot({ path: vitalsScreenshot })
    const spawnDomain = scenario.name === 'stock'
      ? await exerciseTutorialSpawnDomain(host, page, screenshotRoot)
      : null
    const staffMelee = scenario.name === 'stock'
      ? await exerciseTutorialStaffMelee(host, page, screenshotRoot)
      : null
    const collegeAdmission = scenario.name === 'stock' || scenario.name === 'mobile'
      ? await exerciseTutorialCollegeAdmission(
          host,
          page,
          scenario.name === 'stock' ? screenshotRoot : `${screenshotRoot}-mobile`,
        )
      : null
    assert.deepEqual({ consoleErrors, failedResponses, pageErrors }, {
      consoleErrors: [],
      failedResponses: [],
      pageErrors: [],
    })
    return {
      consoleErrors,
      collegeAdmission,
      failedResponses,
      groundDrop,
      initial,
      moved,
      pageErrors,
      potionBindings,
      prelude,
      preludeScreenshot: scenario.preludeScreenshot,
      scenario: scenario.name,
      screenshot: scenario.screenshot,
      spawnDomain,
      staffMelee,
      vitals,
      vitalsScreenshot,
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

async function exerciseTutorialStaffMelee(host, page, screenshotPath) {
  const configuredTick = configureTutorialFixture(host, {
    combatEnabled: true,
    position: { x: 1025, y: 1350 },
    tutorial: {
      active: true,
      damageProtection: true,
      stage: 11,
      stageTicks: 0,
      waveOrdinal: 3,
      waveSpawnCursor: 0,
      waveTicks: 0,
    },
  })
  const actors = await waitForTutorialActors(host, 8, configuredTick)
  let state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const playerId = state.playerEntities.identities[0]?.playerId
  assert.ok(playerId)
  assert.equal(getPlayerEconomy(state, playerId).equipment.weapon?.equipmentType, 'staff')

  const staged = staffApproachPlacement(state, actors)
  const character = getPlayerCharacter(state, playerId)
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...character,
      position: staged.playerPosition,
      velocity: { x: 0, y: 0 },
    }),
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies,
        actors: state.world.enemies.actors.flatMap((actor) => (
          actor.id === staged.target.id
            ? [{ ...actor, nextMovementTick: Number.MAX_SAFE_INTEGER }]
            : []
        )),
      },
      tutorial: { ...state.world.tutorial, waveSpawnCursor: 5 },
    },
  })
  const stagedTick = state.tick
  await page.waitForFunction((minimumTick) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.tick > minimumTick
  }, stagedTick, { timeout: 10_000 })
  const lesson = page.locator('.tutorial-overlay[data-stage="11"] .tutorial-instruction')
  await lesson.waitFor({ timeout: 10_000 })
  assert.match(
    await lesson.locator('.sr-only').textContent() ?? '',
    /WALK INTO ENEMIES TO CLUB THEM/,
  )

  state = host.state()
  const initialHealth = state.world.kind === 'boneyard'
    ? state.world.enemies.actors.find(({ id }) => id === staged.target.id)?.currentHealth
    : null
  assert.equal(typeof initialHealth, 'number')
  const manaBefore = getPlayerProgression(state, playerId).currentMana
  const actionIdsBefore = new Set(state.primarySpells.transients.map(({ id }) => id))
  const contactIdsBefore = new Set(state.primarySpells.transients
    .filter(({ kind }) => kind === 'player-staff-contact')
    .map(({ id }) => id))
  const keys = tutorialMovementKeys(staged.playerPosition, staged.target.position)
  for (const key of keys) await page.keyboard.down(key)
  let action = null
  try {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline && action === null) {
      state = host.state()
      action = state.primarySpells.transients.find((transient) => (
        transient.ownerId === playerId
        && !actionIdsBefore.has(transient.id)
        && (transient.kind === 'player-staff-melee' || transient.kind === 'player-staff-spin')
      )) ?? null
      if (action === null) await page.waitForTimeout(10)
    }
  } finally {
    for (const key of keys) await page.keyboard.up(key)
  }
  assert.ok(action, 'Tutorial lesson 11 walk-in did not create a Staff action')

  const actionState = host.state()
  const playerAtAction = getPlayerCharacter(actionState, playerId)
  assert.equal(actionState.world.kind, 'boneyard')
  const targetAtAction = actionState.world.enemies.actors.find(({ id }) => (
    id === staged.target.id
  ))
  assert.ok(targetAtAction)
  const distance = Math.hypot(
    targetAtAction.position.x - playerAtAction.position.x,
    targetAtAction.position.y - playerAtAction.position.y,
  )
  const legalDistance = PLAYER_CHARACTER_RADIUS
    + targetAtAction.config.collisionRadius
    + NATIVE_ACTOR_SEPARATION_EPSILON
  assert.ok(distance <= legalDistance + 0.001)

  let contact = null
  let healthAfter = initialHealth
  const contactDeadline = Date.now() + 10_000
  while (Date.now() < contactDeadline) {
    state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    contact = state.primarySpells.transients.find((transient) => (
      transient.kind === 'player-staff-contact'
      && transient.ownerId === playerId
      && !contactIdsBefore.has(transient.id)
    )) ?? null
    healthAfter = state.world.enemies.actors.find(({ id }) => (
      id === staged.target.id
    ))?.currentHealth ?? healthAfter
    if (contact !== null && healthAfter < initialHealth) break
    await page.waitForTimeout(10)
  }
  assert.ok(contact && contact.kind === 'player-staff-contact')
  assert.ok(contact.targetIds.includes(`enemy:${staged.target.id}`))
  assert.ok(healthAfter < initialHealth)
  assert.equal(getPlayerProgression(state, playerId).currentMana, manaBefore)
  await page.waitForFunction(() => {
    const sources = window.__sdrAudioPlaySources ?? []
    return sources.some((source) => source.includes('staff-swoosh'))
      && sources.some((source) => source.includes('staff-hit-wood'))
  }, undefined, { timeout: 10_000 })
  await page.screenshot({ path: `${screenshotPath}-tutorial-staff-melee.png` })

  return {
    actionId: action.id,
    actionKind: action.kind,
    contactId: contact.id,
    distance,
    healthAfter,
    healthBefore: initialHealth,
    legalDistance,
    mana: manaBefore,
    stage: 11,
    targetId: staged.target.id,
  }
}

function staffApproachPlacement(state, actors) {
  assert.equal(state.world.kind, 'boneyard')
  const directions = [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
  ]
  for (const target of actors) {
    for (const direction of directions) {
      const distance = PLAYER_CHARACTER_RADIUS + target.config.collisionRadius + 12
      const playerPosition = {
        x: target.position.x + direction.x * distance,
        y: target.position.y + direction.y * distance,
      }
      if (!nativeTutorialEnemySpawnPositionIsAllowed(
        playerPosition,
        PLAYER_CHARACTER_RADIUS,
      )) continue
      if (!canPlaceBoneyardBody(
        playerPosition,
        state.world.bounds,
        state.world.collision,
        PLAYER_CHARACTER_RADIUS,
      )) continue
      const resolved = resolveBoneyardMovement(
        playerPosition,
        target.position,
        state.world.bounds,
        state.world.collision,
        PLAYER_CHARACTER_RADIUS,
      )
      if (Math.hypot(resolved.x - target.position.x, resolved.y - target.position.y) > 0.01) {
        continue
      }
      if (actors.some((actor) => (
        actor.id !== target.id
        && Math.hypot(
          actor.position.x - playerPosition.x,
          actor.position.y - playerPosition.y,
        ) < PLAYER_CHARACTER_RADIUS + actor.config.collisionRadius + 5
      ))) continue
      return { playerPosition, target }
    }
  }
  throw new Error('could not stage a collision-safe Tutorial Staff approach')
}

function tutorialMovementKeys(start, target) {
  const keys = []
  if (target.x < start.x - 0.01) keys.push('a')
  if (target.x > start.x + 0.01) keys.push('d')
  if (target.y < start.y - 0.01) keys.push('w')
  if (target.y > start.y + 0.01) keys.push('s')
  assert.ok(keys.length > 0)
  return keys
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

async function exerciseTutorialGroundDrop(host, page, screenshotPath) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const player = getPlayerCharacter(state, playerId)
  const healthPotion = getPlayerEconomy(state, playerId).backpack.find(
    ({ kind }) => kind === 'health-potion',
  )
  assert.ok(healthPotion)
  const spawned = spawnBoneyardCustomLootItems(
    state.world.loot,
    [healthPotion],
    { x: player.position.x + 90, y: player.position.y },
    state.tick,
  )
  const actor = spawned.store.actors.at(-1)
  assert.ok(actor)
  Object.assign(state, {
    ...state,
    world: {
      ...state.world,
      loot: spawned.store,
      tutorial: {
        ...state.world.tutorial,
        introActive: false,
        introBlend: 1,
        introFade: 0,
        introMovementTicksRemaining: 0,
        stage: 17,
        stageTicks: 0,
      },
    },
  })

  await page.locator('.tutorial-overlay[data-stage="17"]').waitFor({ timeout: 15_000 })
  await page.locator('[data-tutorial-pointer="world-sack"]').waitFor({ timeout: 15_000 })
  assert.equal(await page.locator('.boneyard-loot-messages > *').count(), 0)
  assert.equal(
    await page.locator('.boneyard-scene').getByText('Health Potion', { exact: true }).count(),
    0,
  )
  await page.screenshot({ path: `${screenshotPath}-ground-health-potion-pointer-only.png` })

  const current = host.state()
  assert.equal(current.world.kind, 'boneyard')
  const currentActor = current.world.loot.actors.find(({ id }) => id === actor.id)
  assert.ok(currentActor)
  current.playerEntities = replacePlayerCharacter(
    current.playerEntities,
    playerId,
    {
      ...getPlayerCharacter(current, playerId),
      position: { ...currentActor.position },
      velocity: { x: 0, y: 0 },
    },
  )
  const notification = page.locator('.boneyard-loot-messages [aria-label="Health Potion"]')
  await notification.waitFor({ timeout: 15_000 })
  return {
    groundTextCount: 0,
    notification: await notification.getAttribute('aria-label'),
    pointerOnlyScreenshot: `${screenshotPath}-ground-health-potion-pointer-only.png`,
  }
}

async function exerciseTutorialCollegeAdmission(host, page, screenshotPath) {
  const collegeAudioEventIndex = await page.evaluate(() => window.__sdrAudioEvents.length)
  const tutorial = host.state()
  assert.equal(tutorial.world.kind, 'boneyard')
  assert.ok(tutorial.world.tutorial)
  Object.assign(tutorial.run, {
    gameOverEventId: 1,
    gameOverExitKind: 'automatic',
    gameOverExitTicks: GAME_OVER_AUTOMATIC_EXIT_FADE_TICKS,
    gameOverTicks: 1_200,
    nextGameOverEventId: 2,
    phase: 'game-over',
  })

  const courtyard = page.locator(
    '.hub-scene[data-hub-region="courtyard"][data-college-intro="courtyard-walk"]',
  )
  await courtyard.waitFor({ timeout: 90_000 })
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  assert.equal(await page.locator('.create-menu-scene').count(), 0)
  const academyMusic = await waitForCollegeAcademyMusic(page, collegeAudioEventIndex)
  await waitForVisibleCollegeTitle(page, 7)
  const title7 = await collegeTitleReceipt(page)
  const title7Wizard = await collegeWizardReceipt(host, page)
  assertCollegeWizardReceipt(title7Wizard, 'Title 7')
  await page.screenshot({ path: `${screenshotPath}-raptisoft-presents.png` })
  await waitForVisibleCollegeTitle(page, 9)
  const title9 = await collegeTitleReceipt(page)
  const title9Wizard = await collegeWizardReceipt(host, page)
  assertCollegeWizardReceipt(title9Wizard, 'Title 9')
  await page.screenshot({ path: `${screenshotPath}-solomon-dark-title.png` })

  const office = page.locator('.hub-scene[data-hub-region="office"]')
  await office.waitFor({ timeout: 90_000 })
  const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
  await dialog.waitFor({ timeout: 90_000 })
  assert.equal(await office.getAttribute('data-story-office'), 'true')
  assert.equal(await office.getAttribute('data-hub-ui-surface'), 'dialogue')
  assert.equal(await office.getAttribute('data-college-intro'), 'arch-dialogue')
  assert.equal(await page.getByRole('dialog', { name: 'Talking to The Polisher' }).count(), 0)
  const automaticVoices = await page.evaluate((fromIndex) => window.__sdrAudioEvents
    .slice(fromIndex)
    .filter(({ src, type }) => type === 'buffer-start'
      && window.__sdrAudioSourceMatches(src, 'arch-intro-0.wav'))
    .map(({ src }) => new URL(src, location.href).pathname.split('/').pop()), collegeAudioEventIndex)
  assert.equal(automaticVoices.length, 1)
  assert.ok(await page.evaluate((source) => window.__sdrAudioSourceMatches(
    source,
    'arch-intro-0.wav',
  ), automaticVoices[0]))
  await page.screenshot({ path: `${screenshotPath}-tutorial-college-office.png` })

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  assert.equal(getPlayerEconomy(state, playerId).tutorialPending, false)
  assert.equal(getPlayerEconomy(state, playerId).collegeIntroPending, true)
  assert.equal(state.world.participants[playerId]?.collegeIntro?.phase, 'arch-dialogue')

  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await waitForHostCollegeState(host, playerId, null)
  const acknowledgedSave = await waitForLocalCollegeSave(page, playerId, null)
  assert.equal(acknowledgedSave.starterTint, title9Wizard.primaryTint)
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 })

  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  await moveHubAxis(page, 'a', 'playerX', 300, 'at-most')
  await moveHubAxis(page, 's', 'playerY', 800, 'at-least')
  await moveHubAxis(page, 'd', 'playerX', 540, 'at-least')
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
  await page.screenshot({ path: `${screenshotPath}-tutorial-college-create.png` })
  return {
    acknowledgedSaveSchema: acknowledgedSave.schemaVersion,
    academyMusic,
    autoDialogue: true,
    automaticVoices,
    createAfterManualExit: true,
    officePlayerPosition: getPlayerCharacter(state, playerId).position,
    regionSequence: ['courtyard', 'office', 'create'],
    storyOffice: true,
    title7,
    title7Wizard,
    title9,
    title9Wizard,
  }
}

async function waitForCollegeAcademyMusic(page, fromEventIndex) {
  await page.waitForFunction(() => window.__sdrAudioMediaChannels().some((channel) => (
    window.__sdrAudioSourceMatches(channel.src, 'academy.mp3')
      && channel.currentTime > 0
      && channel.loop
      && !channel.muted
      && !channel.paused
      && channel.volume > 0
  )), null, { timeout: 15_000 })
  const before = await academyMusicChannel(page)
  await page.waitForTimeout(250)
  const after = await academyMusicChannel(page)
  assert.ok(after.currentTime > before.currentTime)
  const startedCount = await page.evaluate(({ from }) => window.__sdrAudioEvents
    .slice(from)
    .filter(({ src, type }) => type === 'started'
      && window.__sdrAudioSourceMatches(src, 'academy.mp3')).length, { from: fromEventIndex })
  assert.equal(startedCount, 1)
  const reusedUnlockedChannel = await page.evaluate(({ channelId, from }) => window.__sdrAudioEvents
    .slice(0, from)
    .some((event) => event.channelId === channelId && event.type === 'started'), {
    channelId: after.channelId,
    from: fromEventIndex,
  })
  assert.equal(reusedUnlockedChannel, true)
  return {
    currentTimeAdvance: after.currentTime - before.currentTime,
    loop: after.loop,
    reusedUnlockedChannel,
    startedCount,
    volume: after.volume,
  }
}

function academyMusicChannel(page) {
  return page.evaluate(() => {
    const channel = window.__sdrAudioMediaChannels().find(({ src }) => (
      window.__sdrAudioSourceMatches(src, 'academy.mp3')
    ))
    if (!channel) throw new Error('Academy music channel is absent')
    return channel
  })
}

async function collegeWizardReceipt(host, page) {
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  const participant = state.world.participants[playerId]
  const player = getPlayerCharacter(state, playerId)
  assert.ok(participant?.collegeIntro?.phase === 'courtyard-walk')
  const expectedHeadingIndex = nativeCollegePathHeadingIndex(
    'courtyard-walk',
    participant.collegeIntro.pathCursor,
    player.position,
  )
  const frame = await page.locator('.hub-world-canvas').evaluate((node) => ({
    collegePathCursor: node.__sdrHubFrame.collegePathCursor,
    headingIndex: node.__sdrHubFrame.playerHeadingIndex,
    materialTint: node.__sdrHubFrame.playerMaterialTint,
    orbSpriteCount: node.__sdrHubFrame.orbSpriteCount,
    x: node.__sdrHubFrame.playerX,
    y: node.__sdrHubFrame.playerY,
  }))
  assert.equal(typeof frame.collegePathCursor, 'number')
  const expectedFrameHeadingIndex = nativeCollegePathHeadingIndex(
    'courtyard-walk',
    frame.collegePathCursor,
    { x: frame.x, y: frame.y },
  )
  return {
    expectedHeadingIndex,
    expectedFrameHeadingIndex,
    frameHeadingIndex: frame.headingIndex,
    headingIndex: player.headingIndex,
    materialTint: frame.materialTint,
    orbSpriteCount: frame.orbSpriteCount,
    primaryTint: getPlayerEconomy(state, playerId).equipment.hat?.iconTints?.[0] ?? null,
    robeTint: getPlayerEconomy(state, playerId).equipment.robe?.iconTints?.[0] ?? null,
  }
}

function assertCollegeWizardReceipt(receipt, label) {
  assert.equal(receipt.headingIndex, receipt.expectedHeadingIndex, `${label} authority heading`)
  assert.equal(
    receipt.frameHeadingIndex,
    receipt.expectedFrameHeadingIndex,
    `${label} presentation heading: ${JSON.stringify(receipt)}`,
  )
  assert.equal(receipt.orbSpriteCount, 0, `${label} selected-element effect`)
  assert.ok(receipt.primaryTint !== null, `${label} starter tint`)
  assert.equal(receipt.robeTint, receipt.primaryTint, `${label} shared garment tint`)
  assert.equal(receipt.materialTint, receipt.primaryTint, `${label} rendered garment tint`)
  const red = receipt.primaryTint >> 16
  const green = (receipt.primaryTint >> 8) & 0xff
  const blue = receipt.primaryTint & 0xff
  assert.ok(green > red && green > blue, `${label} College green tint`)
}

async function waitForVisibleCollegeTitle(page, record) {
  await page.waitForFunction((expectedRecord) => {
    const overlay = document.querySelector('.college-intro-overlay')
    const title = document.querySelector(`[data-native-ui-record="Title.${expectedRecord}"]`)
    return overlay?.getAttribute('data-college-intro-title-record') === `${expectedRecord}`
      && title instanceof HTMLElement
      && Number(getComputedStyle(title).opacity) > 0.05
  }, record, { timeout: 90_000 })
}

function collegeTitleReceipt(page) {
  return page.locator('.college-intro-overlay').evaluate((overlay) => {
    const record = Number(overlay.getAttribute('data-college-intro-title-record'))
    const title = overlay.querySelector(`[data-native-ui-record="Title.${record}"]`)
    if (!(title instanceof HTMLElement)) throw new Error(`missing Title.${record}`)
    return {
      alpha: Number(getComputedStyle(title).opacity),
      cursor: Number(overlay.getAttribute('data-college-intro-title-cursor')),
      record,
    }
  })
}

async function waitForHostCollegeState(host, playerId, phase) {
  const deadline = performance.now() + 15_000
  while (performance.now() < deadline) {
    const state = host.state()
    if (
      state.world.kind === 'hub'
      && (state.world.participants[playerId]?.collegeIntro?.phase ?? null) === phase
    ) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(`timed out waiting for College state ${phase}`)
}

async function waitForLocalCollegeSave(page, playerId, phase) {
  const deadline = performance.now() + 20_000
  let lastReceipt = null
  while (performance.now() < deadline) {
    const record = await readLocalSaveRecord(page)
    if (record?.document) {
      try {
        const restored = restoreGameSaveDocument(record.document)
        lastReceipt = {
          collegeIntro: restored.state.world.kind === 'hub'
            ? restored.state.world.participants[playerId]?.collegeIntro ?? null
            : undefined,
          revision: record.revision,
          schemaVersion: record.formatVersion,
          world: restored.state.world.kind,
        }
        if (
          restored.state.world.kind === 'hub'
          && (restored.state.world.participants[playerId]?.collegeIntro?.phase ?? null) === phase
        ) return {
          schemaVersion: WEB_GAME_SAVE_SCHEMA_VERSION,
          starterTint: getPlayerEconomy(restored.state, playerId)
            .equipment.hat?.iconTints?.[0] ?? null,
        }
      } catch (error) {
        lastReceipt = {
          error: error instanceof Error ? error.message : String(error),
          revision: record.revision,
          schemaVersion: record.formatVersion,
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(
    `timed out waiting for saved College state ${phase}: ${JSON.stringify(lastReceipt)}`,
  )
}

function readLocalSaveRecord(page) {
  return page.evaluate((slot) => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(slot)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ?? null)
    }
  }), WEB_GAME_SAVE_SLOT)
}

async function moveHubAxis(page, key, axis, target, direction) {
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ frameAxis, frameDirection, value }) => {
      const frameValue = document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.[frameAxis]
      return typeof frameValue === 'number'
        && (frameDirection === 'at-least' ? frameValue >= value : frameValue <= value)
    }, { frameAxis: axis, frameDirection: direction, value: target }, { timeout: 15_000 })
  } finally {
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
  }
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

  const unsafeConfiguredTick = configureTutorialWave(host, {
    expectedCount: 1,
    label: 'camera-safety-light',
    ordinal: 5,
    spawnCursor: 0,
    waveTicks: 0,
  })
  const [unsafeEnemy] = await waitForTutorialActors(host, 1, unsafeConfiguredTick)
  assert.ok(unsafeEnemy)
  assert.equal(tutorialCameraContainsEnemy(
    unsafeEnemy.position,
    unsafeEnemy.config.collisionRadius,
  ), false)
  const cameraConfiguredTick = configureTutorialCameraWithExistingEnemies(host)
  await waitForHostTick(host, cameraConfiguredTick + 30)
  let unsafeState = host.state()
  assert.equal(unsafeState.world.kind, 'boneyard')
  assert.ok(unsafeState.world.tutorial)
  assert.equal(unsafeState.world.tutorial.cameraLockTriggered, false)
  assert.equal(unsafeState.world.tutorial.cameraLockAgeTicks, 0)
  const unsafeFrame = await renderedEnemyFrame(page)
  const unsafePlayerId = unsafeState.playerEntities.identities[0].playerId
  const unsafeExpectedCamera = boneyardCamera(
    getPlayerCharacter(unsafeState, unsafePlayerId).position,
    unsafeState.world.bounds,
  )
  close(unsafeFrame.cameraX, unsafeExpectedCamera.x, 0.01, 'unsafe enemy full camera x')
  close(unsafeFrame.cameraY, unsafeExpectedCamera.y, 0.01, 'unsafe enemy full camera y')
  await page.screenshot({ path: `${screenshotPath}-unsafe-enemy-camera-full.png` })
  const unsafeSack = stageTutorialCameraSack(host)
  clearTutorialEnemies(host)
  await waitForHostTick(host, host.state().tick + 30)
  let sackState = host.state()
  assert.equal(sackState.world.kind, 'boneyard')
  assert.ok(sackState.world.tutorial)
  assert.equal(sackState.world.tutorial.cameraLockTriggered, false)
  clearTutorialCameraSack(host, unsafeSack.id)
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
      && frame.offCameraCleanupApplied === true
  }, { expectedCamera, minimumTick: cameraConfiguredTick }, { timeout: 15_000 })
  const cameraFrame = await renderedEnemyFrame(page)
  assert.ok(cameraFrame.retiredStaticSourceCount > 0)
  assert.ok(cameraFrame.retiredStaticResidentCount > 0)
  assert.ok(cameraFrame.residentCount < unsafeFrame.residentCount)
  assert.equal(await page.locator('.boneyard-world-canvas').getAttribute(
    'data-static-off-camera-cleanup',
  ), 'applied')
  await page.screenshot({ path: `${screenshotPath}-stock-camera-locked.png` })
  return {
    camera: {
      ageTicks: state.world.tutorial.cameraLockAgeTicks,
      bounds: cameraBounds,
      cleanupTicksRemaining: state.world.tutorial.cameraLockTicksRemaining,
      retiredStaticResidentCount: cameraFrame.retiredStaticResidentCount,
      retiredStaticSourceCount: cameraFrame.retiredStaticSourceCount,
      rendered: { x: cameraFrame.cameraX, y: cameraFrame.cameraY },
    },
    cameraSafety: {
      deferredForEnemyId: unsafeEnemy.id,
      target: NATIVE_TUTORIAL_CAMERA_TARGET,
      unsafeCamera: { x: unsafeFrame.cameraX, y: unsafeFrame.cameraY },
      unsafePosition: unsafeEnemy.position,
      unsafeSack,
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

function configureTutorialCameraWithExistingEnemies(host) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  const playerId = state.playerEntities.identities[0].playerId
  const character = getPlayerCharacter(state, playerId)
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...character,
      position: { x: 1025, y: 800 },
      velocity: { x: 0, y: 0 },
    }),
    world: {
      ...state.world,
      tutorial: {
        ...state.world.tutorial,
        active: false,
        cameraLockAgeTicks: 0,
        cameraLockTriggered: false,
        cameraLockTicksRemaining: 0,
        stage: 19,
        waveOrdinal: 0,
        waveSpawnCursor: 0,
        waveTicks: 0,
      },
    },
  })
  return state.tick
}

function clearTutorialEnemies(host) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const source = state.world.enemies
  const fresh = createBoneyardEnemyStore(
    `tutorial-camera-clear-${state.tick}`,
    state.world.earthquakeSceneryTargets.length,
  )
  Object.assign(state, {
    ...state,
    world: {
      ...state.world,
      enemies: {
        ...fresh,
        lastStepTick: state.tick,
        nextActorId: source.nextActorId,
        nextDeathEpoch: source.nextDeathEpoch,
        nextDeathEffectId: source.nextDeathEffectId,
        nextEventId: source.nextEventId,
        nextMageLightningPulseId: source.nextMageLightningPulseId,
        nextNativeCellBindingOrder: source.nextNativeCellBindingOrder,
        nextNativeRegistrationOrder: source.nextNativeRegistrationOrder,
        nextProjectileEffectId: source.nextProjectileEffectId,
        nextProjectileId: source.nextProjectileId,
        nextSyntheticSpawnIntentId: source.nextSyntheticSpawnIntentId,
      },
      enemyEvents: [],
    },
  })
}

function stageTutorialCameraSack(host) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const position = { x: 1100, y: 1300 }
  const spawned = spawnBoneyardCustomLootItems(
    state.world.loot,
    [nativeTutorialAmuletItem()],
    position,
    state.tick,
  )
  const actor = spawned.store.actors.at(-1)
  assert.ok(actor)
  Object.assign(state, {
    ...state,
    world: { ...state.world, loot: spawned.store },
  })
  return { id: actor.id, position }
}

function clearTutorialCameraSack(host, actorId) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  Object.assign(state, {
    ...state,
    world: {
      ...state.world,
      loot: removeBoneyardLootActors(state.world.loot, [actorId]),
    },
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
      encounter: fixture.combatEnabled && state.world.encounter !== null
        ? { ...state.world.encounter, phase: 'gone', runEventId: 1 }
        : state.world.encounter,
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

async function waitForHostTick(host, minimumTick) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (host.state().tick >= minimumTick) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Tutorial host did not reach tick ${minimumTick}`)
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

function tutorialCameraContainsEnemy(position, radius) {
  return position.x - radius >= NATIVE_TUTORIAL_CAMERA_TARGET.x
    && position.y - radius >= NATIVE_TUTORIAL_CAMERA_TARGET.y
    && position.x + radius <= NATIVE_TUTORIAL_CAMERA_TARGET.x + NATIVE_TUTORIAL_CAMERA_TARGET.w
    && position.y + radius <= NATIVE_TUTORIAL_CAMERA_TARGET.y + NATIVE_TUTORIAL_CAMERA_TARGET.h
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
      pointerScale: Number(pointer.dataset.pointerScale),
      targetX: Number(pointer.dataset.targetX),
      targetY: Number(pointer.dataset.targetY),
      targetFromSlotX: (slotRect.left + slotRect.width / 2 - overlayRect.left)
        * logicalWidth / overlayRect.width,
      targetFromSlotY: (slotRect.top + slotRect.height / 2 - overlayRect.top)
        * logicalHeight / overlayRect.height,
      targetScale: slotRect.height * logicalHeight / overlayRect.height / 53,
      uiScale: Number(requiredElement('.hub-hud').dataset.uiScale),
      viewportHeight: logicalHeight,
      viewportWidth: logicalWidth,
    }
  })
}

function measureHudPointer(page, anchor, nativeTargetHeight) {
  return page.evaluate(({ expectedAnchor, expectedNativeHeight }) => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`missing ${selector}`)
      return element
    }
    const overlay = requiredElement('.tutorial-overlay')
    const pointer = requiredElement(`[data-tutorial-pointer="${expectedAnchor}"]`)
    const target = requiredElement(`[data-tutorial-anchor="${expectedAnchor}"]`)
    const overlayRect = overlay.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const logicalWidth = Number(overlay.dataset.viewportWidth)
    const logicalHeight = Number(overlay.dataset.viewportHeight)
    return {
      originX: Number(pointer.dataset.x),
      originY: Number(pointer.dataset.y),
      pointerScale: Number(pointer.dataset.pointerScale),
      targetFromElementX: (targetRect.left + targetRect.width / 2 - overlayRect.left)
        * logicalWidth / overlayRect.width,
      targetFromElementY: (targetRect.top + targetRect.height / 2 - overlayRect.top)
        * logicalHeight / overlayRect.height,
      targetScale: targetRect.height * logicalHeight / overlayRect.height / expectedNativeHeight,
      targetX: Number(pointer.dataset.targetX),
      targetY: Number(pointer.dataset.targetY),
    }
  }, { expectedAnchor: anchor, expectedNativeHeight: nativeTargetHeight })
}

function assertHudPointer(receipt, nativeOffsetX, nativeOffsetY, label) {
  close(receipt.targetX, receipt.targetFromElementX, 0.05, `${label} target x`)
  close(receipt.targetY, receipt.targetFromElementY, 0.05, `${label} target y`)
  close(receipt.pointerScale, receipt.targetScale, 0.001, `${label} scale`)
  close(receipt.originX, receipt.targetX + nativeOffsetX * receipt.targetScale, 0.05, `${label} origin x`)
  close(receipt.originY, receipt.targetY + nativeOffsetY * receipt.targetScale, 0.05, `${label} origin y`)
}

function assertStageFiveReceipt(receipt, scenario) {
  close(receipt.targetX, receipt.targetFromSlotX, 0.05, `${scenario.name} target x`)
  close(receipt.targetY, receipt.targetFromSlotY, 0.05, `${scenario.name} target y`)
  close(receipt.pointerScale, receipt.targetScale, 0.001, `${scenario.name} pointer scale`)
  close(receipt.originX, receipt.targetX - 70 * receipt.targetScale, 0.05, `${scenario.name} origin x`)
  close(receipt.originY, receipt.targetY - 50 * receipt.targetScale, 0.05, `${scenario.name} origin y`)
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

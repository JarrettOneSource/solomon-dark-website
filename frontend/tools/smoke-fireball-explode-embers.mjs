import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { getPlayerSkillBook } from '../src/game/core-server/game-simulation.ts'
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
} from '../src/game/game-settings.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const screenshotRoot = process.env.SDR_FIREBALL_EXPLODE_SCREENSHOT_ROOT || '/tmp'
const screenshots = {
  cameraSetting: `${screenshotRoot}/solomon-fireball-camera-shake-off.png`,
  explosion: `${screenshotRoot}/solomon-fireball-explode-embers.png`,
}

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
  throw new Error('Vite did not expose its Fire acceptance port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const credential = 'fireball-explode-ember-browser-parity'
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 20,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: chromePath,
  headless: true,
})
const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
const consoleErrors = []
const httpErrors = []
const pageErrors = []

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) httpErrors.push({
      status: response.status(),
      url: response.url(),
    })
  })
  await page.route('**/api/mods?**', (route) => route.fulfill({
    body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/game/parties', (route) => route.fulfill({
    body: JSON.stringify({ items: [] }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current') || 'local'
    return route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(installFireProbe)
  await page.addInitScript(({ key, settings }) => {
    localStorage.setItem(key, JSON.stringify(settings))
  }, {
    key: GAME_SETTINGS_STORAGE_KEY,
    settings: {
      ...DEFAULT_GAME_SETTINGS,
      complexShadows: false,
      lightQualityPercent: 24,
      multipleShadows: false,
    },
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })

  await enterHub(page, baseUrl)
  const playerId = host.hostPlayerId()
  assert.ok(playerId, 'the browser must own the local authoritative player')
  armFireSkills(host, playerId)

  await page.setViewportSize({ height: 450, width: 800 })
  await enterBoneyard(page)
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 90_000 })
  await openBoneyardCombat(page, host, playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const enemyBaseline = structuredClone(state.world.enemies)
  assert.ok(enemyBaseline.actors.length > 0, 'the authentic opening wave must contain an enemy')
  await waitForCameraRest(page)

  const baselineStart = await page.evaluate(() => window.__fireRenderSamples.length)
  await page.waitForTimeout(750)
  const baselineTiming = await timingReceipt(page, baselineStart)

  const nonlethal = await castAtPreparedEnemy({
    health: 1_000,
    host,
    page,
    playerId,
    baseline: enemyBaseline,
    requireLiveEmber: true,
  })
  await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.primarySpellKinds.includes('fire-explosion')
      && frame.primarySpellKinds.includes('fire-ember')
  }, undefined, { timeout: 10_000 })
  await page.screenshot({ path: screenshots.explosion })
  await page.waitForFunction((wireStart) => window.__fireWireFrames
    .slice(wireStart)
    .some((frame) => frame.transients.some((effect) => (
      effect.kind === 'fire-ember' && effect.life > 0 && effect.life < 1
    ))), nonlethal.wireStart, { timeout: 12_000 })
  const minimumEmberLife = await page.evaluate((wireStart) => Math.min(
    ...window.__fireWireFrames
      .slice(wireStart)
      .flatMap((frame) => frame.transients)
      .filter((effect) => effect.kind === 'fire-ember')
      .map((effect) => effect.life),
  ), nonlethal.wireStart)
  assert.ok(minimumEmberLife > 0 && minimumEmberLife < 1)
  await waitForFireClear(host)
  const nonlethalSamples = await renderSamples(page, nonlethal.sampleStart)
  assert.equal(maximum(nonlethalSamples.map(({ feedbackMagnitude }) => feedbackMagnitude)), 0)
  assert.equal(maximum(nonlethalSamples.map(({ secondaryCameraMagnitude }) => (
    secondaryCameraMagnitude
  ))), 0)
  assert.equal(maximum(nonlethalSamples.map(({ worldShakeMagnitude }) => (
    worldShakeMagnitude
  ))), 0)
  const explosionTiming = timingFromSamples(nonlethalSamples)

  const lethalOn = await castAtPreparedEnemy({
    health: 0.25,
    host,
    page,
    playerId,
    baseline: enemyBaseline,
  })
  await page.waitForFunction((sampleStart) => window.__fireRenderSamples
    .slice(sampleStart)
    .some(({ feedbackMagnitude }) => feedbackMagnitude > 0), lethalOn.sampleStart, {
    timeout: 5_000,
  })
  const lethalOnSamples = await renderSamples(page, lethalOn.sampleStart)
  const lethalOnMagnitude = maximum(lethalOnSamples.map(({ feedbackMagnitude }) => (
    feedbackMagnitude
  )))
  assert.ok(lethalOnMagnitude > 0, 'a lethal enemy terminal must own the stock camera pulse')
  await waitForFireClear(host)

  await setCameraShake(page, false, screenshots.cameraSetting)
  const storedSettings = await page.evaluate((key) => (
    JSON.parse(localStorage.getItem(key))
  ), GAME_SETTINGS_STORAGE_KEY)
  assert.equal(storedSettings.zoomEffects, false)
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.dataset.zoomEffects === 'false'
  ))

  const lethalOff = await castAtPreparedEnemy({
    health: 0.25,
    host,
    page,
    playerId,
    baseline: enemyBaseline,
  })
  await waitUntil(() => {
    const current = host.state()
    if (current.world.kind !== 'boneyard') return false
    const enemy = current.world.enemies.actors.find(({ id }) => id === lethalOff.enemyId)
    return enemy === undefined || enemy.lifeState === 'dying'
  }, 'the camera-off Fireball did not kill its prepared target', 5_000)
  await page.waitForTimeout(750)
  const lethalOffSamples = await renderSamples(page, lethalOff.sampleStart)
  assert.ok(lethalOffSamples.some(({ kinds }) => kinds.includes('fire-explosion')))
  assert.equal(maximum(lethalOffSamples.map(({ feedbackMagnitude }) => feedbackMagnitude)), 0)
  assert.equal(maximum(lethalOffSamples.map(({ secondaryCameraMagnitude }) => (
    secondaryCameraMagnitude
  ))), 0)
  assert.equal(maximum(lethalOffSamples.map(({ worldShakeMagnitude }) => (
    worldShakeMagnitude
  ))), 0)

  const audio = await page.evaluate((start) => window.__sdrAudioEvents
    .slice(start)
    .filter(({ type }) => type === 'buffer-start' || type === 'play')
    .map(({ playbackRate, src, volume }) => ({ playbackRate, src, volume })), nonlethal.audioStart)
  const fireballHits = audio.filter(({ src }) => src.includes('fireball-hit'))
  const throwFire = audio.filter(({ src }) => src.includes('throw-fire'))
  assert.ok(fireballHits.length >= 6, 'three Explode contacts must each own two Fireball hit cues')
  assert.ok(throwFire.length >= 6, 'cast release and shared explosion must each own Throw Fire')
  assert.ok(fireballHits.some(({ playbackRate }) => playbackRate !== 1))

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.equal(await page.locator('.game-runtime-error-panel').count(), 0)
  const restorationStart = await page.evaluate(() => window.__fireRenderSamples.length)
  await page.waitForTimeout(750)
  const restorationTiming = await timingReceipt(page, restorationStart)
  assert.ok(explosionTiming.samples >= 3)

  process.stdout.write(`${JSON.stringify({
    audio: {
      fireballHitCount: fireballHits.length,
      sharedPitchRange: [
        Math.min(...fireballHits.map(({ playbackRate }) => playbackRate)),
        Math.max(...fireballHits.map(({ playbackRate }) => playbackRate)),
      ],
      throwFireCount: throwFire.length,
    },
    camera: {
      lethalOffMagnitude: 0,
      lethalOnMagnitude,
      nonlethalExplodeMagnitude: 0,
      persisted: storedSettings.zoomEffects,
    },
    errors: { console: consoleErrors, http: httpErrors, page: pageErrors },
    protocol: {
      minimumLiveEmberLife: minimumEmberLife,
      runtimeErrorPanels: 0,
    },
    screenshots,
    status: 'ok',
    timing: {
      baseline: baselineTiming,
      explosion: explosionTiming,
      restoration: restorationTiming,
    },
  }, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    body: (await page.locator('body').innerText().catch(() => '')).slice(0, 2_000),
    consoleErrors,
    host: summarizeHost(host),
    httpErrors,
    pageErrors,
    recentFrames: await page.evaluate(() => window.__fireRenderSamples?.slice(-20) ?? []),
  }, null, 2)}\n`)
  throw error
} finally {
  for (const close of [
    () => browser.close(),
    () => host.close(),
    () => vite.close(),
  ]) {
    await Promise.race([
      close(),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ])
  }
}

process.exit(0)

function installFireProbe() {
  const samples = []
  const wireFrames = []
  const nativeJsonParse = JSON.parse
  let previousAt = null
  Object.defineProperties(window, {
    __fireRenderSamples: { value: samples },
    __fireWireFrames: { value: wireFrames },
  })
  JSON.parse = function (...args) {
    const value = nativeJsonParse.apply(this, args)
    const frame = value?.type === 'server-welcome'
      ? value.snapshot
      : value?.type === 'server-snapshot'
        ? value.frame
        : null
    if (frame?.primarySpells) {
      wireFrames.push({
        tick: frame.tick,
        transients: frame.primarySpells.transients.map((effect) => ({ ...effect })),
      })
      if (wireFrames.length > 4_000) wireFrames.shift()
    }
    return value
  }
  const observe = (at) => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    const frame = canvas?.__sdrBoneyardFrame
    if (frame) {
      samples.push({
        at,
        feedbackMagnitude: frame.worldFeedbackMagnitude,
        frameGapMs: previousAt === null ? 0 : at - previousAt,
        kinds: [...frame.primarySpellKinds],
        secondaryCameraMagnitude: Number(canvas.dataset.secondaryCameraMagnitude || 0),
        tick: frame.tick,
        worldShakeMagnitude: Math.hypot(frame.worldShakeX, frame.worldShakeY),
      })
      previousAt = at
      if (samples.length > 20_000) samples.shift()
    }
    requestAnimationFrame(observe)
  }
  requestAnimationFrame(observe)
}

async function enterHub(page, baseUrl) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'Play' }).dispatchEvent('click')
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'New Game' }).dispatchEvent('click')
  await enterCreateAfterCollegeOffice(page)
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'Fire' }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator(
    '.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]',
  ).waitFor({ timeout: 90_000 })
}

async function declineTutorialOffer(page) {
  const offer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (!await offer.isVisible()) return
  await offer.getByRole('button', { exact: true, name: 'NO' }).click()
  await offer.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function enterCreateAfterCollegeOffice(page) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const office = page.locator('.hub-scene[data-hub-region="office"][data-story-office="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    office.waitFor({ timeout: 90_000 }).then(() => 'office'),
  ])
  if (first === 'create') return

  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.getAttribute('data-hub-region') === 'office'
      && canvas?.getAttribute('data-transition-phase') === 'none'
  }, undefined, { timeout: 30_000 })
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await completeCollegeIntroDialogue(page)
  await moveHubAxis(page, 'a', 'playerX', 300, 'at-most')
  await moveHubAxis(page, 's', 'playerY', 800, 'at-least')
  await moveHubAxis(page, 'd', 'playerX', 540, 'at-least')
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
}

async function completeCollegeIntroDialogue(page) {
  const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
  if (!await dialog.isVisible()) {
    await page.keyboard.press('e')
    await dialog.waitFor({ timeout: 15_000 })
  }
  await dialog.getByRole('button', { name: 'Skip' }).click()
  for (const label of ['Solomon Dark?', 'Collateral Damage?', 'Assistance?']) {
    await dialog.getByRole('button', { exact: true, name: label }).click()
    await dialog.getByRole('button', { name: 'Skip' }).click()
  }
  await dialog.getByRole('button', { exact: true, name: 'Done' }).click()
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function moveHubAxis(page, key, axis, target, direction) {
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ axis, direction, target }) => {
      const value = document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.[axis]
      return typeof value === 'number'
        && (direction === 'at-least' ? value >= target : value <= target)
    }, { axis, direction, target }, { timeout: 15_000 })
  } finally {
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
  }
}

async function enterBoneyard(page) {
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const scene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const picker = page.locator('.hub-boneyard-picker')
  await Promise.race([
    scene.waitFor({ timeout: 90_000 }),
    picker.waitFor({ timeout: 90_000 }),
  ])
  if (await picker.isVisible()) {
    const option = page.locator('.hub-boneyard-option').first()
    await option.waitFor({ timeout: 30_000 })
    await option.click()
  }
  await scene.waitFor({ timeout: 90_000 })
}

function armFireSkills(host, playerId) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const base = getPlayerSkillBook(state, playerId)
  const permanentRanks = [...base.permanentRanks]
  const effectiveRanks = [...base.effectiveRanks]
  const learnedSkillOrder = [...base.learnedSkillOrder]
  for (const skillId of [17, 18]) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
    if (!learnedSkillOrder.includes(skillId)) learnedSkillOrder.push(skillId)
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...base,
    effectiveRanks: Object.freeze(effectiveRanks),
    learnedSkillOrder: Object.freeze(learnedSkillOrder),
    permanentRanks: Object.freeze(permanentRanks),
  }
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index],
    currentHealth: 1_000_000,
    currentMana: 10_000,
    maximumHealth: 1_000_000,
    maximumMana: 10_000,
    pendingOffer: null,
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      progressions: Object.freeze(progressions),
      skillBooks: Object.freeze(skillBooks),
    },
  })
}

async function openBoneyardCombat(page, host, playerId) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')) return
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  const solomon = state.world.encounter?.position
  assert.ok(solomon, 'Fire acceptance requires the authentic Solomon encounter')
  setHostPlayerPosition(host, index, solomon)
  await waitUntil(() => {
    const current = host.state()
    return current.world.kind === 'boneyard' && current.world.encounter?.phase === 'speaking'
  }, 'Solomon did not enter the speaking phase', 10_000)
  const afterApproach = host.state()
  assert.equal(afterApproach.world.kind, 'boneyard')
  setHostPlayerPosition(host, index, { x: solomon.x, y: solomon.y + 250 })
  await waitUntil(() => {
    const current = host.state()
    return current.world.kind === 'boneyard'
      && (current.world.encounter?.runEventId ?? 0) > 0
      && current.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')
  }, 'Solomon did not release the opening combat wave', 30_000)
  const combat = host.state()
  assert.equal(combat.world.kind, 'boneyard')
  assert.ok(combat.world.waves, 'Fire acceptance requires the native wave director')
  const expectedOpeningCount = combat.world.waves.openingBursts.reduce(
    (total, burst) => total + burst.count,
    0,
  )
  assert.ok(expectedOpeningCount >= 11 && expectedOpeningCount <= 17)
  assert.equal(
    combat.world.enemies.actors.filter(({ lifeState }) => lifeState === 'alive').length
      + combat.world.waves.pendingSpawnBudget,
    expectedOpeningCount,
  )
  Object.assign(combat, {
    world: {
      ...combat.world,
      waves: {
        ...combat.world.waves,
        activeBurstIndex: null,
        activeBursts: [],
        activeGroupIndex: null,
        activeGroupMemberIndex: 0,
        burstSpawnRemaining: 0,
        burstSpreadTicksRemaining: 0,
        burstStarted: false,
        pendingSpawnBudget: 0,
        phase: 'opening-threshold',
        populationThreshold: 0,
        spawnCountdown: 0,
        spawnDelayTicks: 0,
      },
    },
  })
  const bounds = combat.world.arenaTransition?.combatBounds
  assert.ok(bounds)
  setHostPlayerPosition(host, index, {
    x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2,
  })
  armFireSkills(host, playerId)
  await page.waitForTimeout(200)
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

async function castAtPreparedEnemy({
  baseline,
  health,
  host,
  page,
  playerId,
  requireLiveEmber = false,
}) {
  const attemptReceipts = []
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForFireClear(host)
    const enemyId = prepareEnemy(host, playerId, baseline, health)
    await page.waitForTimeout(150)
    const pointer = await enemyPointer(page, host, enemyId)
    const sampleStart = await page.evaluate(() => window.__fireRenderSamples.length)
    const wireStart = await page.evaluate(() => window.__fireWireFrames.length)
    const audioStart = await page.evaluate(() => window.__sdrAudioEvents.length)
    const firstEffectId = host.state().primarySpells.nextId
    await page.mouse.move(pointer.x, pointer.y)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(260)
    await page.mouse.up({ button: 'left' })
    const attempted = host.state()
    attemptReceipts.push({
      attempt: attempt + 1,
      player: attempted.playerEntities.locomotions.find((_, index) => (
        attempted.playerEntities.identities[index]?.playerId === playerId
      ))?.position ?? null,
      pointer,
      projectiles: attempted.primarySpells.projectiles.map((projectile) => ({
        direction: projectile.direction,
        id: projectile.id,
        kind: projectile.kind,
        position: projectile.position,
      })),
      target: attempted.world.kind === 'boneyard'
        ? attempted.world.enemies.actors.find(({ id }) => id === enemyId)?.position ?? null
        : null,
    })
    try {
      await waitUntil(() => host.state().primarySpells.transients.some((effect) => (
        effect.id >= firstEffectId && effect.kind === 'fire-explosion'
      )), 'Fireball contact did not materialize its shared explosion', 5_000)
    } catch (error) {
      if (attempt === 2) {
        throw new Error(
          `Fireball contact missed after three attempts: ${JSON.stringify(attemptReceipts)}`,
          { cause: error },
        )
      }
      continue
    }
    await waitUntil(() => host.state().primarySpells.transients.some((effect) => (
      effect.id >= firstEffectId && effect.kind === 'fire-explosion' && effect.ageTicks > 0
    )), 'Fireball explosion did not advance through its authoritative contact tick', 5_000)
    const hasLiveEmber = host.state().primarySpells.transients.some((effect) => (
      effect.id >= firstEffectId && effect.kind === 'fire-ember'
    ))
    if (requireLiveEmber && !hasLiveEmber) {
      if (attempt === 2) {
        throw new Error('three authentic Fireball contacts consumed every newborn Ember')
      }
      continue
    }
    moveEnemiesAway(host, playerId)
    return { audioStart, enemyId, sampleStart, wireStart }
  }
  throw new Error('Fireball acceptance exhausted its bounded cast attempts')
}

function prepareEnemy(host, playerId, baseline, health) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const player = state.playerEntities.locomotions[index].position
  const current = state.world.enemies
  const enemies = structuredClone(baseline)
  enemies.lastStepTick = state.tick
  for (const counter of [
    'nextActorId',
    'nextDeathEpoch',
    'nextDeathEffectId',
    'nextEventId',
    'nextMageLightningPulseId',
    'nextProjectileEffectId',
    'nextProjectileId',
    'nextSyntheticSpawnIntentId',
  ]) enemies[counter] = Math.max(enemies[counter], current[counter])
  const targetId = enemies.actors[0].id
  const far = {
    x: state.world.bounds.x + state.world.bounds.w - 100,
    y: state.world.bounds.y + state.world.bounds.h - 100,
  }
  enemies.actors = enemies.actors.map((actor, actorIndex) => ({
    ...actor,
    config: {
      ...actor.config,
      maximumHealth: actor.id === targetId ? Math.max(health, 1_000) : 1_000,
    },
    currentHealth: actor.id === targetId ? health : 1_000,
    lastDamagedByPlayerId: null,
    lastDamageTick: null,
    nextMovementTick: state.tick + 100_000,
    nextTargetRefreshTick: state.tick + 100_000,
    position: actor.id === targetId
      ? { x: player.x, y: player.y - 80 }
      : { x: far.x - actorIndex * 2, y: far.y },
    shieldHealth: 0,
    shieldMaximumHealth: 0,
    targetPlayerId: null,
  }))
  Object.assign(state, {
    world: {
      ...state.world,
      enemies,
      enemyEvents: [],
    },
  })
  return targetId
}

function moveEnemiesAway(host, playerId) {
  const state = host.state()
  if (state.world.kind !== 'boneyard') return
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  const player = state.playerEntities.locomotions[index].position
  const enemies = {
    ...state.world.enemies,
    actors: state.world.enemies.actors.map((actor, actorIndex) => ({
      ...actor,
      nextMovementTick: state.tick + 100_000,
      position: { x: player.x + 350 + actorIndex * 2, y: player.y + 350 },
    })),
  }
  Object.assign(state, { world: { ...state.world, enemies } })
}

async function enemyPointer(page, host, enemyId) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const enemy = state.world.enemies.actors.find(({ id }) => id === enemyId)
  assert.ok(enemy)
  return page.locator('.boneyard-world-canvas').evaluate((node, position) => {
    const bounds = node.getBoundingClientRect()
    const frame = node.__sdrBoneyardFrame
    const scaleX = bounds.width / node.clientWidth
    const scaleY = bounds.height / node.clientHeight
    const x = bounds.left + (
      node.clientWidth / 2 + (position.x - frame.cameraX) * frame.cameraZoom
    ) * scaleX
    const y = bounds.top + (
      node.clientHeight / 2 + (position.y - frame.cameraY) * frame.cameraZoom
    ) * scaleY
    return {
      bounds: {
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
      },
      camera: { x: frame.cameraX, y: frame.cameraY, zoom: frame.cameraZoom },
      client: { height: node.clientHeight, width: node.clientWidth },
      scale: { x: scaleX, y: scaleY },
      stack: document.elementsFromPoint(x, y).slice(0, 5).map((element) => ({
        className: `${element.className}`,
        tagName: element.tagName,
      })),
      x,
      y,
    }
  }, enemy.position)
}

async function setCameraShake(page, enabled, screenshotPath) {
  const scene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await scene.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10_000 })
  await page.waitForTimeout(350)
  await pause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  const dialog = page.locator('.game-settings-dialog')
  await dialog.waitFor({ timeout: 10_000 })
  await dialog.getByRole('button', { name: 'TWEAK GAME' }).click()
  const toggle = dialog.getByRole('button', { name: 'CAMERA SHAKE' })
  assert.equal(await toggle.getAttribute('aria-pressed'), `${!enabled}`)
  await toggle.click()
  assert.equal(await toggle.getAttribute('aria-pressed'), `${enabled}`)
  await page.screenshot({ path: screenshotPath })
  await dialog.getByRole('button', { name: 'BACK' }).click()
  await dialog.getByRole('button', { name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })
  if (await pause.isVisible().catch(() => false)) {
    await pause.getByRole('button', { name: 'RESUME GAME' })
      .dispatchEvent('click')
      .catch(() => {})
  }
  await pause.waitFor({ state: 'detached', timeout: 10_000 })
}

async function waitForFireClear(host) {
  await waitUntil(() => {
    const spells = host.state().primarySpells
    return !spells.projectiles.some(({ kind }) => kind === 'fire')
      && !spells.transients.some(({ kind }) => kind.startsWith('fire-'))
  }, 'Fire actors did not retire through their authoritative teardown', 15_000)
}

async function waitForCameraRest(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    const frame = canvas?.__sdrBoneyardFrame
    return frame && frame.worldFeedbackMagnitude === 0
      && frame.worldShakeX === 0
      && frame.worldShakeY === 0
      && Number(canvas.dataset.secondaryCameraMagnitude || 0) === 0
  }, undefined, { timeout: 10_000 })
}

async function renderSamples(page, start) {
  return page.evaluate((sampleStart) => window.__fireRenderSamples.slice(sampleStart), start)
}

async function timingReceipt(page, start) {
  return timingFromSamples(await renderSamples(page, start))
}

function timingFromSamples(samples) {
  const gaps = samples.map(({ frameGapMs }) => frameGapMs).filter((gap) => gap > 0)
  gaps.sort((left, right) => left - right)
  return {
    maximumGapMs: gaps.at(-1) ?? 0,
    p95GapMs: gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))] ?? 0,
    samples: samples.length,
  }
}

function maximum(values) {
  return values.length === 0 ? 0 : Math.max(...values)
}

async function waitUntil(predicate, message, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

function summarizeHost(host) {
  const state = host.state()
  return {
    primarySpells: state.primarySpells,
    tick: state.tick,
    world: state.world.kind === 'boneyard'
      ? {
          encounter: state.world.encounter,
          enemies: state.world.enemies.actors.map(({ currentHealth, id, lifeState, position }) => ({
            currentHealth, id, lifeState, position,
          })),
          runId: state.world.runId,
        }
      : { kind: state.world.kind },
  }
}

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import {
  createServer as createViteServer,
  preview as previewBuiltFrontend,
} from 'vite'

import { actorHeadingIndex } from '../src/game/core-kernels/actor-heading.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-director.ts'
import { solomonContactContains } from '../src/game/core-kernels/boneyard-encounter.ts'
import {
  NATIVE_LANTERN_LIGHT_BASE_INTENSITY,
  NATIVE_LANTERN_LIGHT_FLICKER,
} from '../src/game/core-kernels/native-boneyard-lighting.ts'
import { NATIVE_ACTOR_SEPARATION_EPSILON } from '../src/game/core-kernels/actor-physics.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { createNativeRng, drawNativeFloat } from '../src/game/core-kernels/native-rng.ts'
import { nativeSolomonDirtStateAt } from '../src/game/renderer/boneyard-solomon-dirt-presentation.ts'
import { BONEYARD_GATE_INITIAL_SWAY } from '../src/game/core-kernels/boneyard-gate.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import {
  PRIMARY_CAST_ACTION_END_TICK,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  PRIMARY_SPELL_RANK_ONE_MANA_COSTS,
} from '../src/game/core-kernels/primary-spells.ts'
import {
  canPlaceBoneyardBody,
  createBoneyardCollisionWorld,
  firstBoneyardPathBlockProgress,
  resolveBoneyardMovement,
} from '../src/game/core-server/boneyard-collision.ts'
import {
  damageBoneyardEnemy,
  stepBoneyardEnemyStore,
} from '../src/game/core-server/boneyard-enemy-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  getPlayerEconomy,
  getPlayerCharacter,
  getPlayerProgression,
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import {
  EntityReplicationReconstructor,
  REPLICATED_ENTITY_TYPES,
} from '../src/game/protocol/entity-replication.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const deterministicSeedBytes = Buffer.alloc(16)
const expectedBoneyardSeed = deterministicSeedBytes.toString('hex')
const chillArrowOnly = process.argv.includes('--chill-arrow-only')
const cleanupOnly = process.argv.includes('--cleanup-only')
const entranceOnly = process.argv.includes('--entrance-only')
const openingOnly = process.argv.includes('--opening-only')
const slumpgutOnly = process.argv.includes('--slumpgut-only')
const staffMeleeOnly = process.argv.includes('--staff-melee-only')
const deathEffectsOnly = process.argv.includes('--death-effects-only')
const productionFrontend = process.env.SDR_GAME_WAVES_SMOKE_PRODUCTION === '1'
const FIRE_ENGAGEMENT_MIN_DISTANCE = 70
const FIRE_ENGAGEMENT_MAX_DISTANCE = 135
const COMBAT_ENTRY_GATE_MARGIN = 40
const MINIMUM_SKELETON_COLLISION_RADIUS = 12
const fireCastDriver = { nextReadyTick: 0 }
const screenshotPath = process.env.SDR_GAME_WAVES_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-solomon-waves.png'
const speakingScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-speaking$1')
const dirtScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-dirt$1')
const combatScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-combat$1')
const retiredEntryScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-retired-entry$1')
const slumpgutScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-slumpgut$1')
const staffMeleeScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-staff-melee$1')
const staffSmokeScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-staff-smoke$1')
const archerScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-archer-projectile$1')
const chillArrowScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-chill-arrow$1')
const frostAuraHailScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-frost-aura-hail$1')
const deathScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-death$1')
const gameOverScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-game-over$1')
const loadoutScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-loadout$1')
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const vite = productionFrontend
  ? await previewBuiltFrontend({
      configFile: viteConfig,
      logLevel: 'error',
      preview: { host: '127.0.0.1', port: 0 },
      root: frontendRoot,
    })
  : await createViteServer({
      configFile: viteConfig,
      logLevel: 'error',
      root: frontendRoot,
      server: { host: '127.0.0.1', port: 0 },
    })
if (!productionFrontend) await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local smoke-test port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  createBoneyardSeedBytes: () => Buffer.from(deterministicSeedBytes),
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
const failedResponses = []
const wire = observeGameWire(page, host.address.url)
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push({
    status: response.status(),
    url: response.url(),
  })
})
await page.route('**/deployment.json?*', async (route) => {
  const revision = new URL(route.request().url()).searchParams.get('current')
  await route.fulfill({ json: { revision } })
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
await page.addInitScript(installGameAudioSmokeProbe)

try {
  if (slumpgutOnly) {
    const slumpgut = await proveSlumpgutBrowser(page, slumpgutScreenshotPath)
    assert.deepEqual(wire.errors, [])
    assert.deepEqual(errors, [])
    assert.deepEqual(failedResponses, [])
    process.stdout.write(`${JSON.stringify({
      errors,
      failedResponses,
      productionFrontend,
      screenshotPath: slumpgutScreenshotPath,
      slumpgut,
      status: 'ok',
      wire: wireSummary(wire),
    })}\n`)
  } else {
  await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene')
  const initial = await encounterReceipt(scene)
  const initialFrame = await boneyardFrame(page)
  assert.equal(initial.phase, 'digging')
  assert.equal(initial.wavePhase, 'dormant')
  assert.equal(initial.liveEnemies, 0)
  assert.equal(initialFrame.offCameraCleanupApplied, false)
  assert.equal(initialFrame.solomonGraveMarkPassCount, 1)
  assert.equal(initialFrame.retiredStaticResidentCount, 0)
  assert.equal(initialFrame.retiredStaticSourceCount, 0)
  const initialPainter = {
    lanternRow: initialFrame.lanternPainterRow,
    lanternZIndex: initialFrame.lanternZIndex,
    solomonRow: initialFrame.solomonPainterRow,
    solomonZIndex: initialFrame.solomonZIndex,
  }
  assert.ok(Number.isInteger(initialPainter.lanternRow))
  assert.ok(Number.isInteger(initialPainter.solomonRow))
  assert.equal(initialPainter.solomonRow - initialPainter.lanternRow, 20)
  assert.ok(initialPainter.lanternZIndex > 0)
  assert.ok(initialPainter.solomonZIndex > initialPainter.lanternZIndex)
  const loadedBoneyard = await waitForWireValue(
    page,
    wire,
    (receipt) => receipt.loadedBoneyard,
    10_000,
    'the first loaded Boneyard',
  )
  assert.ok(loadedBoneyard?.scene?.solomonDig, 'expected the loaded Solomon Dig scene')
  assert.deepEqual(initialFrame.solomonClipRectWorld, {
    height: 100,
    width: 200,
    x: loadedBoneyard.scene.solomonDig.position.x - 100,
    y: loadedBoneyard.scene.solomonDig.position.y - 100,
  })
  assert.ok(initialFrame.solomonBodyOffsetY >= 5)
  assert.ok(initialFrame.solomonBodyOffsetY <= 15)
  assert.equal(initialFrame.solomonBodyTint, 0xffffff)
  assert.equal(initialFrame.solomonGraveMarkTint, 0xffffff)
  assert.equal(loadedBoneyard.seed, expectedBoneyardSeed)
  const openingSpriteIds = new Set(loadedBoneyard.scene.sprites.map(({ eid }) => eid))
  assert.equal(openingSpriteIds.has('sprite-196'), false)
  for (const preservedSpriteId of ['sprite-193', 'sprite-194', 'sprite-195', 'sprite-197']) {
    assert.equal(openingSpriteIds.has(preservedSpriteId), true, preservedSpriteId)
  }
  const surface = await boneyardSurfaceReceipt(page, loadedBoneyard.scene)
  const digAudio = await captureSolomonDigAudio(page)
  const combatNavigation = {
    bounds: loadedBoneyard.scene.bounds,
    collision: createBoneyardCollisionWorld(loadedBoneyard.scene),
    scene: loadedBoneyard.scene,
  }
  const diggingCombatAdmission = await provePreludeCombatSealed(page, scene, 'digging')

  const gateCrossing = await crossNearestEntryGate(page, scene, loadedBoneyard.scene)
  combatNavigation.entryGate = {
    direction: gateCrossing.direction,
    y: gateCrossing.target.y,
  }
  const nearSolomon = await walkNearSolomon(
    page,
    scene,
    loadedBoneyard.scene,
  )
  const digDirt = await captureSolomonDirt(
    page,
    loadedBoneyard.scene.solomonDig.position,
    dirtScreenshotPath,
  )
  const nearDigAudio = await captureNearSolomonDigAudio(
    page,
    digAudio.eventId,
    digAudio.events.length,
  )
  const nearSolomonFrame = await boneyardFrame(page)
  const lanternLightMinimum = Math.fround(
    NATIVE_LANTERN_LIGHT_BASE_INTENSITY - NATIVE_LANTERN_LIGHT_FLICKER,
  )
  const lanternLightMaximum = Math.fround(
    NATIVE_LANTERN_LIGHT_BASE_INTENSITY + NATIVE_LANTERN_LIGHT_FLICKER,
  )
  assert.ok(
    nearSolomonFrame.lanternLightIntensity >= lanternLightMinimum,
    JSON.stringify({ lanternLightMinimum, nearSolomonFrame }),
  )
  assert.ok(
    nearSolomonFrame.lanternLightIntensity <= lanternLightMaximum,
    JSON.stringify({ lanternLightMaximum, nearSolomonFrame }),
  )
  await installSolomonSpeakingProbe(page)
  const approach = await walkToSolomon(page, scene, loadedBoneyard.scene)
  assert.notEqual(approach.phase, 'digging')
  const speakingFrame = await boneyardFrame(page)
  const speakingGraveMarkPassCount = speakingFrame.solomonGraveMarkPassCount
  assert.equal(speakingGraveMarkPassCount, 1)
  assert.equal(speakingFrame.solomonClipRectWorld?.width, 2_000)
  assert.equal(speakingFrame.solomonClipRectWorld?.height, 1_000)
  assert.ok(speakingFrame.solomonBodyOffsetY >= 5)
  assert.equal(speakingFrame.solomonBodyTint, 0xffffff)
  assert.equal(speakingFrame.solomonGraveMarkTint, 0xffffff)
  const digAudioEventIdAtContact = Number(
    await scene.getAttribute('data-solomon-dig-audio-event-id'),
  )

  const speakingHandle = await page.waitForFunction(() => (
    window.__sdrSolomonSpeakingReceipt?.animated
      ? window.__sdrSolomonSpeakingReceipt
      : null
  ), undefined, { timeout: 15_000 })
  const speaking = await speakingHandle.jsonValue()
  const hello = speaking.hello
  assert.equal(hello.phase, 'speaking')
  assert.match(hello.voiceCue, /^solomon-hello-[1-4]$/)
  assert.ok(hello.renderFrame >= 213 && hello.renderFrame <= 227)
  assert.equal(
    Number(await scene.getAttribute('data-solomon-dig-audio-event-id')),
    digAudioEventIdAtContact,
  )
  assert.equal(Number(await scene.getAttribute('data-solomon-dirt-count')), 0)
  const mouthPoses = [hello.mouthPose, speaking.animated.mouthPose]
  const headings = [hello.heading, speaking.animated.heading]
  assert.ok(
    new Set(mouthPoses).size > 1,
    `expected speaking mouth animation (${mouthPoses.join(', ')})`,
  )
  const speakingCombatAdmission = await provePreludeCombatSealed(page, scene, 'speaking')
  await page.screenshot({ path: speakingScreenshotPath })
  await page.waitForFunction((cue) => (
    window.__sdrAudioPlaySources?.some((source) => source.includes(cue))
  ), hello.voiceCue, { timeout: 5_000 })

  const escapeKeys = movementKeys({
    x: approach.contactPosition.x - loadedBoneyard.scene.solomonDig.position.x,
    y: approach.contactPosition.y - loadedBoneyard.scene.solomonDig.position.y,
  })
  assert.ok(escapeKeys.length > 0, 'expected a movement direction away from Solomon')
  for (const key of escapeKeys) await page.keyboard.down(key)
  let opening
  let runEdge
  let runEdgeGraveMarkPassCount
  let solomonEscape
  try {
    await page.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-run-event-id')) === 1
    ), undefined, { timeout: 15_000 })
    runEdge = await encounterReceipt(scene)
    assert.ok(runEdge.phase === 'escaping' || runEdge.phase === 'gone')
    runEdgeGraveMarkPassCount = (await boneyardFrame(page)).solomonGraveMarkPassCount
    assert.equal(runEdgeGraveMarkPassCount, 0)
    assert.equal(runEdge.combatEnabled, true)
    await page.waitForFunction(({ x, y }) => {
      const scene = document.querySelector('.boneyard-scene')
      const currentX = Number(scene?.getAttribute('data-solomon-x'))
      const currentY = Number(scene?.getAttribute('data-solomon-y'))
      return Math.hypot(currentX - x, currentY - y) > 20
    }, { x: runEdge.solomonX, y: runEdge.solomonY }, { timeout: 5_000 })
    solomonEscape = await encounterReceipt(scene)
    assert.ok(Math.hypot(
      solomonEscape.solomonX - runEdge.solomonX,
      solomonEscape.solomonY - runEdge.solomonY,
    ) > 20)
    await page.screenshot({ path: screenshotPath })
    await page.waitForFunction((requiredLiveEnemies) => {
      const scene = document.querySelector('.boneyard-scene')
      return Number(scene?.getAttribute('data-wave-live-enemy-count')) >= requiredLiveEnemies
        && window.__sdrAudioPlaySources?.some((source) => source.includes('solomon-laugh-1'))
    }, staffMeleeOnly ? 1 : 8, { timeout: 10_000 })
    if (!staffMeleeOnly && !cleanupOnly) {
      await page.waitForFunction(() => (
        document.querySelector('.boneyard-scene')
          ?.getAttribute('data-wave-phase') === 'opening-threshold'
      ), undefined, { timeout: 15_000 })
    }
    opening = await encounterReceipt(scene)
  } finally {
    for (const key of escapeKeys) await page.keyboard.up(key)
  }
  if (staffMeleeOnly) {
    assert.equal(opening.combatEnabled, true)
    assert.ok(opening.liveEnemies >= 1)
  } else if (cleanupOnly) {
    assert.equal(opening.combatEnabled, true)
    assert.ok(opening.liveEnemies >= 8)
  } else {
    assert.equal(opening.wavePhase, 'opening-threshold')
    assert.ok(opening.liveEnemies >= 11 && opening.liveEnemies <= 17)
    assert.equal(opening.pendingSpawnBudget, 0)
  }
  assert.equal(opening.waveOrdinal, 0)
  const openingSteering = staffMeleeOnly || cleanupOnly || chillArrowOnly
    ? null
    : await captureOpeningSteering(
        page,
        wire,
        loadedBoneyard.runId,
        opening.liveEnemies,
      )
  const entranceRetirement = openingOnly || staffMeleeOnly || chillArrowOnly
    || deathEffectsOnly
    ? null
    : await proveRetiredEntry(
        page,
        scene,
        wire,
        loadedBoneyard.runId,
        gateCrossing,
        initialFrame.residentCount,
        retiredEntryScreenshotPath,
      )

  if (cleanupOnly || entranceOnly || openingOnly || staffMeleeOnly || chillArrowOnly) {
    const runCombatAdmission = entranceOnly
      ? await proveRunCombatAdmitted(page, scene)
      : null
    const staffMelee = staffMeleeOnly
      ? await proveStaffMeleeContact(
          page,
          combatNavigation,
          staffSmokeScreenshotPath,
        )
      : null
    const chillArrow = chillArrowOnly
      ? await proveChillWindArrowTumble(page, wire, chillArrowScreenshotPath)
      : null
    await page.screenshot({
      path: staffMeleeOnly
        ? staffMeleeScreenshotPath
        : chillArrowOnly ? chillArrowScreenshotPath : combatScreenshotPath,
    })
    assert.deepEqual(wire.errors, [])
    assert.deepEqual(errors, [])
    assert.deepEqual(failedResponses, [])
    process.stdout.write(`${JSON.stringify({
      digDirt,
      dirtScreenshotPath,
      entranceRetirement,
      digAudio,
      diggingCombatAdmission,
      errors,
      failedResponses,
      gateCrossing,
      nearDigAudio,
      nearSolomon,
      nearSolomonFrame: {
        lanternLightIntensity: nearSolomonFrame.lanternLightIntensity,
        lightSourceCount: nearSolomonFrame.lightSourceCount,
        solomonGraveMarkPassCount: nearSolomonFrame.solomonGraveMarkPassCount,
      },
      opening,
      openingSteering,
      productionFrontend,
      cleanupOnly,
      chillArrow,
      chillArrowOnly,
      chillArrowScreenshotPath,
      retiredEntryScreenshotPath,
      runCombatAdmission,
      solomonEscape,
      initialGraveMarkPassCount: initialFrame.solomonGraveMarkPassCount,
      initialSolomonPresentation: {
        bodyOffsetY: initialFrame.solomonBodyOffsetY,
        bodyTint: initialFrame.solomonBodyTint,
        clipRectWorld: initialFrame.solomonClipRectWorld,
        dirtTint: initialFrame.solomonDirtTint,
        graveMarkTint: initialFrame.solomonGraveMarkTint,
      },
      initialPainter,
      speakingGraveMarkPassCount,
      speakingSolomonPresentation: {
        bodyOffsetY: speakingFrame.solomonBodyOffsetY,
        bodyTint: speakingFrame.solomonBodyTint,
        clipRectWorld: speakingFrame.solomonClipRectWorld,
        dirtTint: speakingFrame.solomonDirtTint,
        graveMarkTint: speakingFrame.solomonGraveMarkTint,
      },
      runEdgeGraveMarkPassCount,
      speakingCombatAdmission,
      screenshotPath: staffMeleeOnly
        ? staffMeleeScreenshotPath
        : chillArrowOnly ? chillArrowScreenshotPath : combatScreenshotPath,
      staffMelee,
      status: 'ok',
      surface,
      wire: wireSummary(wire),
    })}\n`)
  } else {
  await installEnemyActionProbe(page)
  const combat = await castUntilEnemyDies(page, { navigation: combatNavigation })
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return scene?.getAttribute('data-last-enemy-event-output') === 'skeleton-shatter'
      && window.__sdrAudioPlaySources?.some((source) => source.includes('skeleton-die'))
  }, undefined, { timeout: 30_000 })
  combat.enemyTerminalOutput = await scene.getAttribute('data-last-enemy-event-output')
  await page.screenshot({ path: combatScreenshotPath })
  const transientDeathFrame = await boneyardFrame(page)
  assert.ok(
    transientDeathFrame.enemyDeathEffectCount > 0,
    'the terminal enemy did not hand off to a rendered death effect',
  )
  if (deathEffectsOnly) {
    const restoredDeathFrame = await restoreBoneyardDeathEffects(
      page,
      transientDeathFrame.runId,
    )
    assert.deepEqual(wire.errors, [])
    assert.deepEqual(errors, [])
    assert.deepEqual(failedResponses, [])
    process.stdout.write(`${JSON.stringify({
      combat,
      combatScreenshotPath,
      deathEffectsOnly,
      errors,
      failedResponses,
      productionFrontend,
      restoredDeathFrame: {
        enemyDeathEffectCount: restoredDeathFrame.enemyDeathEffectCount,
        runId: restoredDeathFrame.runId,
        tick: restoredDeathFrame.tick,
      },
      status: 'ok',
      transientDeathFrame: {
        enemyDeathEffectCount: transientDeathFrame.enemyDeathEffectCount,
        enemyDeathEffectSamples: transientDeathFrame.enemyDeathEffectSamples,
        tick: transientDeathFrame.tick,
      },
      wire: wireSummary(wire),
    })}\n`)
  } else {
  const locomotion = await kiteUntilSolomonTaunt(page, combatNavigation)
  const taunt = await encounterReceipt(scene)
  assert.equal(taunt.voiceCue, 'solomon-get-him-boys')
  assert.equal(taunt.voiceEventId, 3)
  assert.ok(taunt.liveEnemies >= 9 && taunt.liveEnemies <= 17)
  const archer = await proveArcherProjectileLifecycle(
    page,
    wire,
    loadedBoneyard.runId,
    archerScreenshotPath,
    combatNavigation,
  )
  const death = await waitForPlayerDeath(page)
  const deathRender = await waitForRenderedDeathSequence(page)
  const enemyHeadFacingSamples = await page.evaluate(() => (
    window.__sdrEnemyHeadFacingSamples ?? []
  ))
  assert.ok(
    enemyHeadFacingSamples.some((sample) => (
      (sample.headFacingOffset === -1 || sample.headFacingOffset === 1)
      && /^(?:skeleton-|mage-)/.test(sample.action)
    )),
    'expected a naturally rolled Skeleton-family head-facing turn during combat',
  )
  const playerDamageEvents = [...wire.events.values()].filter((event) => (
    event.runId === loadedBoneyard.runId && event.type === 'player-damage-sound'
  ))
  assert.ok(playerDamageEvents.length > 0, 'expected an authoritative Wizard ouch event')
  assert.ok(playerDamageEvents.every((event) => /^wizard-ouch-[123]$/.test(event.sound)))
  assert.ok(playerDamageEvents.every((event) => event.pitch === 1))
  assert.ok(playerDamageEvents.every((event) => (
    event.gainScale >= 0.25 && event.gainScale <= 1
  )))
  const playerDamageAudio = await page.evaluate(() => (
    window.__sdrAudioEvents.filter((event) => (
      event.type === 'buffer-start'
        && /wizard-ouch-[123](?:-[\w-]+)?\.wav$/.test(new URL(event.src).pathname)
    )).map((event) => ({
      playbackRate: event.playbackRate,
      src: event.src,
      volume: event.volume,
    }))
  ))
  assert.ok(playerDamageAudio.length > 0, 'expected decoded Wizard ouch playback')
  assert.ok(playerDamageAudio.every((event) => event.playbackRate === 1))
  await page.screenshot({ path: deathScreenshotPath })
  const gameOver = page.getByRole('status', { name: 'Game over.' })
  await gameOver.waitFor({ timeout: 30_000 })
  assert.equal(await page.locator('.boneyard-game-over button').count(), 0)
  const gameOverFrame = await boneyardFrame(page)
  assert.equal(gameOverFrame.runPhase, 'game-over')
  assert.ok(gameOverFrame.runGameOverTicks < 1_000)
  assert.equal(gameOverFrame.runGameOverExitTicks, null)
  await page.screenshot({ path: gameOverScreenshotPath })
  const retainedLoadout = page.locator(
    '.create-menu-scene[data-retained-loadout="true"][data-motion-settled="true"]',
  )
  await retainedLoadout.waitFor({ timeout: 90_000 })
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 30_000 })
  assert.equal(await retainedLoadout.getAttribute('data-element'), 'fire')
  await page.screenshot({ path: loadoutScreenshotPath })

  const firstRunId = gameOverFrame.runId
  await page.locator(
    staffMeleeOnly ? '.create-menu-discipline-body' : '.create-menu-discipline-arcane',
  ).click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.waitForFunction((priorRunId) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.runPhase === 'active' && frame.runId !== priorRunId
  }, firstRunId, { timeout: 30_000 })
  const secondRun = await boneyardFrame(page)
  const secondLoadedBoneyard = await waitForWireValue(
    page,
    wire,
    (receipt) => (
      receipt.loadedBoneyard?.runId !== firstRunId
        ? receipt.loadedBoneyard
        : null
    ),
    10_000,
    'the second loaded Boneyard',
  )
  assert.notEqual(secondRun.runId, firstRunId)
  assert.equal(secondLoadedBoneyard.runId, secondRun.runId)
  assert.equal(secondLoadedBoneyard.seed, expectedBoneyardSeed)
  assert.equal(secondRun.localPlayerHealth, 50)
  assert.equal(secondRun.localPlayerMana, 100)
  assert.equal(secondRun.localPlayerLifeState, 'alive')
  assert.equal(secondRun.enemyCount, 0)
  assert.equal(await scene.getAttribute('data-solomon-phase'), 'digging')

  const audioPlaySources = await page.evaluate(() => (
    [...new Set(window.__sdrAudioPlaySources ?? [])]
  ))
  assert.ok(audioPlaySources.some((source) => source.includes(hello.voiceCue)))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-laugh-1')))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-get-him-boys')))
  assert.ok(audioPlaySources.some((source) => source.includes('throw-fire')))
  assert.ok(audioPlaySources.some((source) => source.includes('skeleton-die')))
  assert.ok(audioPlaySources.some((source) => source.includes('wizard-ouch-')))
  assert.ok(audioPlaySources.some((source) => source.includes('death-guitar')))
  assert.deepEqual(wire.errors, [])
  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    approach,
    archer,
    archerScreenshotPath,
    audioPlaySources,
    combat,
    combatScreenshotPath,
    death,
    deathRender,
    deathScreenshotPath,
    digAudio,
    digDirt,
    dirtScreenshotPath,
    diggingCombatAdmission,
    errors,
    failedResponses,
    entranceRetirement,
    enemyHeadFacingSamples,
    gateCrossing,
    gameOverFrame,
    gameOverScreenshotPath,
    headings: [...new Set(headings)],
    hello,
    loadoutScreenshotPath,
    locomotion,
    initialPainter,
    mouthPoses: [...new Set(mouthPoses)],
    nearDigAudio,
    nearSolomon,
    opening,
    openingSteering,
    playerDamageAudio,
    playerDamageEvents,
    productionFrontend,
    retiredEntryScreenshotPath,
    runEdge,
    screenshotPath,
    secondRun,
    secondLoadedBoneyard: {
      runId: secondLoadedBoneyard.runId,
      seed: secondLoadedBoneyard.seed,
    },
    solomonEscape,
    speakingCombatAdmission,
    speakingScreenshotPath,
    status: 'ok',
    surface,
    taunt,
  })}\n`)
  }
  }
  }
} catch (error) {
  await page.screenshot({ path: screenshotPath.replace(/(\.[^.]+)?$/, '-failure$1') })
  process.stderr.write(`${JSON.stringify({
    body: (await page.locator('body').innerText()).slice(0, 2_000),
    encounter: await currentEncounterReceipt(page),
    errors,
    failedResponses,
    screenshotPath,
    url: page.url(),
    wire: wireSummary(wire),
  })}\n`)
  throw error
} finally {
  await Promise.all([
    browser.close(),
    host.close(),
    vite.close(),
  ])
}

async function proveSlumpgutBrowser(page, screenshotPath) {
  await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene')
  let state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.waves)
  assert.ok(state.world.waves.slumpgutRecipeUid)
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const initialPlayer = getPlayerCharacter(state, playerId)
  const rngState = slumpgutSmokeRngState(state.world, initialPlayer.position)
  const worldManagerOrder = createNativeWorldManagerOrder(state.worldManagerOrder)
  const staged = stepBoneyardEnemyStore({
    ...state.world.enemies,
    lastStepTick: state.tick - 1,
  }, {
    firstProjectileWorldContact: () => null,
    paused: true,
    players: {},
    registerWorldPainter: worldManagerOrder.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [
      ...Array.from({ length: 76 }, (_, index) => ({
        enemyToken: 'ZOMBIE',
        flags: Object.freeze([]),
        id: index + 1,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.ZOMBIE,
        position: Object.freeze({
          x: state.world.bounds.x + 250 + index % 10 * 45,
          y: state.world.bounds.y + 450 + Math.floor(index / 10) * 45,
        }),
        spawnTick: state.tick,
        waveOrdinal: 0,
      })),
      {
        enemyToken: 'COFFIN',
        flags: Object.freeze([]),
        id: 77,
        locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.COFFIN,
        position: Object.freeze({
          x: state.world.bounds.x + 900,
          y: state.world.bounds.y + 700,
        }),
        spawnTick: state.tick,
        waveOrdinal: 0,
      },
    ],
    tick: state.tick,
  })
  const censusActors = staged.store.actors.map((actor) => ({
    ...actor,
    nextMovementTick: Number.MAX_SAFE_INTEGER,
    nextTargetRefreshTick: Number.MAX_SAFE_INTEGER,
    targetPlayerId: null,
  }))
  Object.assign(state, {
    worldManagerOrder: worldManagerOrder.state(),
    world: {
      ...state.world,
      enemies: {
        ...staged.store,
        actors: Object.freeze(censusActors),
        maggots: Object.freeze([]),
      },
      waves: {
        ...state.world.waves,
        interwaveDelayTicks: 1,
        nextScheduleIndex: 0,
        phase: 'interwave',
        rngState,
        slumpgutPhase: 'eligible',
        slumpgutPollCursor: 0,
        slumpgutTicksRemaining: 0,
      },
    },
  })

  const thresholdTick = state.tick + 1
  await waitForHostTick(page, thresholdTick)
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return scene?.getAttribute('data-wave-slumpgut-phase') === 'interval-countdown'
      && Number(scene.getAttribute('data-wave-live-zombie-count')) === 76
  }, undefined, { timeout: 10_000 })
  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.equal(state.world.waves?.phase, 'spawning')
  assert.equal(state.world.waves?.slumpgutPhase, 'interval-countdown')
  assert.ok((state.world.waves?.slumpgutTicksRemaining ?? 0) > 0)
  assert.ok((state.world.waves?.slumpgutTicksRemaining ?? 0) <= 1_000)
  assert.equal(state.world.enemies.actors.filter(({ config }) => (
    config.enemyToken === 'ZOMBIE'
  )).length, 76)
  assert.equal(state.world.enemies.actors.filter(({ config }) => (
    config.enemyToken === 'COFFIN'
  )).length, 1)
  const thresholdReceipt = {
    liveEnemyCount: state.world.enemies.actors.length,
    liveZombieCount: 76,
    ordinaryWavePhase: state.world.waves?.phase,
    phase: state.world.waves?.slumpgutPhase,
    tick: state.tick,
    ticksRemaining: state.world.waves?.slumpgutTicksRemaining,
  }

  state.world = {
    ...state.world,
    enemies: {
      ...state.world.enemies,
      actors: Object.freeze(state.world.enemies.actors.filter(({ config }) => (
        config.enemyToken === 'COFFIN'
      ))),
      maggots: Object.freeze([]),
    },
    waves: state.world.waves === null
      ? null
      : {
          ...state.world.waves,
          phase: 'dormant',
          slumpgutTicksRemaining: 1,
        },
  }
  const intervalReleaseTick = state.tick + 1
  await waitForHostTick(page, intervalReleaseTick)
  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.equal(state.world.waves?.slumpgutPhase, 'script-sleep')
  assert.ok((state.world.waves?.slumpgutTicksRemaining ?? 0) > 0)
  assert.ok((state.world.waves?.slumpgutTicksRemaining ?? 0) <= 1_500)
  assert.equal(state.world.enemies.actors.filter(({ config }) => (
    config.enemyToken === 'COFFIN'
  )).length, 1)
  const intervalReceipt = {
    phase: state.world.waves?.slumpgutPhase,
    tick: state.tick,
    ticksRemaining: state.world.waves?.slumpgutTicksRemaining,
  }

  state.world = {
    ...state.world,
    waves: state.world.waves === null
      ? null
      : { ...state.world.waves, slumpgutTicksRemaining: 1 },
  }
  const spawnReleaseTick = state.tick + 1
  await waitForHostTick(page, spawnReleaseTick)
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return scene?.getAttribute('data-wave-slumpgut-phase') === 'retired'
      && Number(scene.getAttribute('data-wave-live-zombie-count')) === 1
  }, undefined, { timeout: 10_000 })

  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.equal(state.world.waves?.slumpgutPhase, 'retired')
  const actors = state.world.enemies.actors.filter(({ config }) => (
    config.recipeName === 'Slumpgut'
  ))
  assert.equal(actors.length, 1)
  assert.equal(state.world.enemies.actors.filter(({ config }) => (
    config.enemyToken === 'COFFIN'
  )).length, 1)
  const actor = actors[0]
  assert.equal(actor.config.classification, 'boss')
  assert.equal(actor.config.enemyToken, 'ZOMBIE')
  assert.equal(actor.config.maximumHealth, 1_575)
  assert.equal(actor.config.pathfindingMode, 2)
  assert.equal(actor.config.flanking, false)
  assert.deepEqual(actor.config.family, {
    bodyType: 3,
    poisonDuration: 10,
    poisonPoolDamage: 15,
    poisonPunchDamage: 10,
    rotten: true,
  })

  const player = getPlayerCharacter(state, playerId)
  const visualPosition = Object.freeze({
    x: player.position.x + 90,
    y: player.position.y + 20,
  })
  state.world = {
    ...state.world,
    enemies: {
      ...state.world.enemies,
      actors: state.world.enemies.actors.map((candidate) => (
        candidate.id === actor.id
          ? {
              ...candidate,
              nextMovementTick: Number.MAX_SAFE_INTEGER,
              nextTargetRefreshTick: Number.MAX_SAFE_INTEGER,
              position: visualPosition,
              targetPlayerId: null,
            }
          : candidate
      )),
    },
  }
  await page.waitForFunction(({ actorId, x, y }) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    const rendered = frame?.enemySamples.find((candidate) => candidate.id === actorId)
    return rendered !== undefined
      && Math.abs(rendered.x - x) < 0.01
      && Math.abs(rendered.y - y) < 0.01
  }, { actorId: actor.id, ...visualPosition }, { timeout: 10_000 })

  const frame = await boneyardFrame(page)
  const rendered = frame.enemySamples.find(({ id }) => id === actor.id)
  assert.ok(rendered)
  assert.equal(rendered.enemyToken, 'ZOMBIE')
  assert.equal(rendered.maximumHealth, 1_575)
  assert.equal(rendered.renderedScale, 1)
  await page.screenshot({ path: screenshotPath })

  state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const liveActor = state.world.enemies.actors.find(({ id }) => id === actor.id)
  assert.ok(liveActor)
  const existingLootActorIds = new Set(state.world.loot.actors.map(({ id }) => id))
  const damaged = damageBoneyardEnemy(state.world.enemies, {
    actorId: actor.id,
    amount: liveActor.currentHealth,
    sourcePlayerId: playerId,
    tick: state.tick,
  })
  assert.equal(damaged.accepted, true)
  assert.equal(damaged.killed, true)
  state.world = { ...state.world, enemies: damaged.store }

  let deathReward = null
  const deathDeadline = Date.now() + 10_000
  while (Date.now() < deathDeadline && deathReward === null) {
    const current = host.state()
    if (current.world.kind === 'boneyard') {
      const scriptActors = current.world.loot.actors.filter((candidate) => (
        candidate.source === 'script' && !existingLootActorIds.has(candidate.id)
      ))
      if (
        !current.world.enemies.actors.some(({ id }) => id === actor.id)
        && scriptActors.length > 0
      ) {
        const gold = scriptActors.filter(({ kind }) => kind === 'gold')
        const sacks = scriptActors.filter(({ kind }) => kind === 'sack')
        assert.ok(
          (gold.length > 0 && sacks.length === 0)
          || (gold.length === 0 && sacks.length === 1),
        )
        assert.equal(current.world.enemies.actors.filter(({ config }) => (
          config.enemyToken === 'COFFIN'
        )).length, 1)
        deathReward = {
          actorCount: scriptActors.length,
          gold: gold.reduce((total, candidate) => total + candidate.amount, 0),
          item: sacks[0]?.item?.name ?? null,
          kind: gold.length > 0 ? 'gold' : 'item',
          tick: current.tick,
        }
      }
    }
    if (deathReward === null) await page.waitForTimeout(10)
  }
  assert.ok(deathReward, 'Slumpgut did not execute its linked Miniboss Die reward')
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return Number(scene?.getAttribute('data-wave-live-zombie-count')) === 0
  }, undefined, { timeout: 10_000 })

  return {
    actorId: actor.id,
    currentHealth: actor.currentHealth,
    deathReward,
    intervalReceipt,
    liveEnemyCount: Number(await scene.getAttribute('data-wave-live-enemy-count')),
    liveZombieCount: Number(await scene.getAttribute('data-wave-live-zombie-count')),
    maximumHealth: actor.config.maximumHealth,
    recipeName: actor.config.recipeName,
    rendered,
    spawnTick: actor.spawnTick,
    thresholdReceipt,
    wavePhase: await scene.getAttribute('data-wave-phase'),
  }
}

function slumpgutSmokeRngState(world, playerPosition) {
  let target = null
  for (const distance of [90, 120, 70]) {
    for (let index = 0; index < 16; index += 1) {
      const angle = index * Math.PI / 8
      const candidate = {
        x: playerPosition.x + Math.cos(angle) * distance,
        y: playerPosition.y + Math.sin(angle) * distance,
      }
      if (canPlaceBoneyardBody(candidate, world.bounds, world.collision, 45)) {
        target = candidate
        break
      }
    }
    if (target !== null) break
  }
  assert.ok(target, 'could not stage an in-light Slumpgut candidate near the player')

  for (let seed = 0; seed < 1_000_000; seed += 1) {
    const rngState = createNativeRng(seed)
    const x = drawNativeFloat(rngState, world.bounds.w)
    const y = drawNativeFloat(x.state, world.bounds.h)
    const position = {
      x: world.bounds.x + x.value,
      y: world.bounds.y + y.value,
    }
    if (Math.hypot(position.x - target.x, position.y - target.y) <= 15) {
      return rngState
    }
  }
  throw new Error('could not pin the Slumpgut smoke RNG near its light-valid target')
}

function observeGameWire(page, endpoint) {
  const endpointUrl = new URL(endpoint).href
  const receipt = {
    descriptors: new Map(),
    enemyFirstSamples: new Map(),
    errors: [],
    events: new Map(),
    latestSnapshot: null,
    loadedBoneyard: null,
    outsideCombatEnemySamples: [],
    projectileSamples: new Map(),
    reconstructor: new EntityReplicationReconstructor(),
    retired: new Map(),
    sequence: 0,
    socketCount: 0,
  }
  page.on('websocket', (socket) => {
    if (new URL(socket.url()).href !== endpointUrl) return
    receipt.socketCount += 1
    socket.on('framereceived', ({ payload }) => {
      try {
        recordWireMessage(
          receipt,
          decodeServerGameMessage(Buffer.isBuffer(payload) ? payload.toString() : payload),
        )
      } catch (error) {
        boundedPush(receipt.errors, error instanceof Error ? error.message : String(error), 16)
      }
    })
  })
  return receipt
}

function recordWireMessage(receipt, message) {
  if (message.type === 'server-boneyard-loaded') {
    receipt.loadedBoneyard = message.boneyard
    return
  }
  if (message.type === 'server-welcome') {
    receipt.reconstructor.reset(message.snapshot, message.snapshotSequence)
    receipt.sequence = message.snapshotSequence
    receipt.latestSnapshot = message.snapshot
    recordWireEnemyEvents(receipt, message.snapshot)
    recordCombatBoundViolations(receipt, message.snapshot)
    return
  }
  if (message.type !== 'server-snapshot' || message.sequence <= receipt.sequence) return
  recordWireEntityFrame(receipt, message.frame.world.entities, message.sequence)
  const snapshot = receipt.reconstructor.apply(message.frame, message.sequence)
  receipt.sequence = message.sequence
  receipt.latestSnapshot = snapshot
  recordWireEnemyEvents(receipt, snapshot)
  recordCombatBoundViolations(receipt, snapshot)
}

function recordWireEntityFrame(receipt, entities, sequence) {
  for (const descriptor of entities.spawned) {
    boundedMapSet(
      receipt.descriptors,
      replicatedEntityKey(descriptor[0], descriptor[1]),
      descriptor,
      128,
    )
  }
  for (const sample of entities.samples) {
    if (sample[0] !== REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile) continue
    const prior = receipt.projectileSamples.get(sample[1])
    boundedMapSet(receipt.projectileSamples, sample[1], {
      count: (prior?.count ?? 0) + 1,
      first: prior?.first ?? sample,
      last: sample,
    }, 128)
  }
  for (const [typeId, id] of entities.retired) {
    boundedMapSet(receipt.retired, replicatedEntityKey(typeId, id), sequence, 128)
  }
}

function recordWireEnemyEvents(receipt, snapshot) {
  if (snapshot.world.kind !== 'boneyard') return
  for (const event of snapshot.world.enemyEvents) {
    boundedMapSet(receipt.events, `${event.runId}:${event.eventId}`, event, 512)
  }
}

function recordCombatBoundViolations(receipt, snapshot) {
  if (snapshot.world.kind !== 'boneyard') return
  const player = Object.values(snapshot.players)[0]
  for (const enemy of snapshot.world.enemies) {
    if (receipt.enemyFirstSamples.has(enemy.id)) continue
    boundedMapSet(receipt.enemyFirstSamples, enemy.id, {
      distanceFromPlayer: player
        ? Math.hypot(
            enemy.position.x - player.position.x,
            enemy.position.y - player.position.y,
          )
        : null,
      headingDeg: enemy.headingDeg,
      id: enemy.id,
      observedTick: snapshot.tick,
      position: enemy.position,
      spawnTick: enemy.spawnTick,
    }, 128)
  }
  const transition = snapshot.world.arenaTransition
  if (!transition || transition.phase === 'open') return
  const bounds = transition.combatBounds
  for (const enemy of snapshot.world.enemies) {
    if (
      enemy.position.x >= bounds.x
      && enemy.position.y >= bounds.y
      && enemy.position.x <= bounds.x + bounds.w
      && enemy.position.y <= bounds.y + bounds.h
    ) continue
    boundedPush(receipt.outsideCombatEnemySamples, {
      bounds,
      enemyId: enemy.id,
      position: enemy.position,
      tick: snapshot.tick,
    }, 16)
  }
}

function replicatedEntityKey(typeId, id) {
  return `${typeId}:${id}`
}

function boundedMapSet(map, key, value, limit) {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  while (map.size > limit) map.delete(map.keys().next().value)
}

function boundedPush(values, value, limit) {
  values.push(value)
  if (values.length > limit) values.splice(0, values.length - limit)
}

async function waitForWireValue(page, wire, read, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (wire.errors.length > 0) {
      throw new Error(`game wire observation failed: ${wire.errors.join('; ')}`)
    }
    const value = read(wire)
    if (value) return value
    await page.waitForTimeout(25)
  }
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify(wireSummary(wire))}`)
}

function wireSummary(wire) {
  return {
    descriptorCount: wire.descriptors.size,
    enemyFirstSampleCount: wire.enemyFirstSamples.size,
    errors: [...wire.errors],
    eventCount: wire.events.size,
    latestTick: wire.latestSnapshot?.tick ?? null,
    outsideCombatEnemySamples: [...wire.outsideCombatEnemySamples],
    projectileSampleCount: wire.projectileSamples.size,
    retiredCount: wire.retired.size,
    sequence: wire.sequence,
    socketCount: wire.socketCount,
  }
}

async function captureOpeningSteering(page, wire, runId, expectedCount) {
  const before = await waitForWireValue(
    page,
    wire,
    ({ latestSnapshot }) => (
      latestSnapshot?.world.kind === 'boneyard'
      && latestSnapshot.world.runId === runId
      && latestSnapshot.world.enemies.length >= expectedCount
        ? latestSnapshot
        : null
    ),
    5_000,
    'the complete immediate opening snapshot',
  )
  const openingEnemies = before.world.enemies.slice(0, expectedCount)
  const roots = openingEnemies.map((enemy) => {
    const sample = wire.enemyFirstSamples.get(enemy.id)
    assert.ok(sample, `expected a first-position sample for enemy ${enemy.id}`)
    return sample
  })
  assert.ok(
    roots.every(({ distanceFromPlayer }) => distanceFromPlayer > 100),
    'dark placement must resolve beyond the raw 100-unit near-player ring',
  )
  const spawnTickCounts = new Map()
  for (const { spawnTick } of roots) {
    spawnTickCounts.set(spawnTick, (spawnTickCounts.get(spawnTick) ?? 0) + 1)
  }
  const spawnTicks = [...spawnTickCounts].toSorted((left, right) => left[0] - right[0])
  const immediateCount = spawnTicks[0]?.[1] ?? 0
  const delayedCount = spawnTicks.slice(1).reduce((total, [, count]) => total + count, 0)
  assert.ok(immediateCount >= 8 && immediateCount <= 12)
  assert.ok(delayedCount >= 3 && delayedCount <= 5)
  assert.equal(spawnTicks[1]?.[0] - spawnTicks[0]?.[0], 500)
  assert.equal(spawnTicks.at(-1)?.[0] - spawnTicks[1]?.[0], 400)

  const beforeById = new Map(openingEnemies.map((enemy) => [enemy.id, enemy]))
  const after = await waitForWireValue(
    page,
    wire,
    ({ latestSnapshot }) => (
      latestSnapshot?.world.kind === 'boneyard'
      && latestSnapshot.world.runId === runId
      && latestSnapshot.tick >= before.tick + 25
        ? latestSnapshot
        : null
    ),
    5_000,
    'opening steering movement',
  )
  const afterPlayer = Object.values(after.players)[0]
  assert.ok(afterPlayer, 'expected the post-opening player snapshot')
  const samples = after.world.enemies.flatMap((enemy) => {
    const prior = beforeById.get(enemy.id)
    if (!prior) return []
    const directHeading = positiveHeading(Math.atan2(
      afterPlayer.position.x - enemy.position.x,
      -(afterPlayer.position.y - enemy.position.y),
    ) * 180 / Math.PI)
    return [{
      directHeadingErrorDeg: headingDistance(enemy.headingDeg, directHeading),
      headingAfterDeg: enemy.headingDeg,
      headingBeforeDeg: prior.headingDeg,
      id: enemy.id,
      movement: Math.hypot(
        enemy.position.x - prior.position.x,
        enemy.position.y - prior.position.y,
      ),
    }]
  })
  assert.ok(samples.some(({ movement }) => movement > 0.5))
  assert.ok(
    samples.some(({ directHeadingErrorDeg }) => directHeadingErrorDeg > 0.25),
    'opening enemies must retain gradual offset steering instead of snap-facing the target',
  )
  return {
    afterTick: after.tick,
    beforeTick: before.tick,
    delayedCount,
    immediateCount,
    roots,
    samples,
  }
}

function positiveHeading(value) {
  return ((value % 360) + 360) % 360
}

function headingDistance(left, right) {
  return Math.abs(positiveHeading(left - right + 180) - 180)
}

async function proveArcherProjectileLifecycle(
  page,
  wire,
  runId,
  screenshotPath,
  navigation,
) {
  const deadline = Date.now() + 900_000
  const killReceipts = []
  const selectedSkillIds = []
  let killCount = 0
  let wave

  while (Date.now() < deadline) {
    await drainPendingSkillOffers(page, selectedSkillIds)
    if (wire.errors.length > 0) {
      throw new Error(`game wire observation failed: ${wire.errors.join('; ')}`)
    }

    const frame = await boneyardFrame(page)
    const snapshot = currentBoneyardSnapshot(wire, runId)
    if (!snapshot) {
      await page.waitForTimeout(25)
      continue
    }
    const archers = snapshot.world.enemies.filter((enemy) => (
      enemy.enemyToken === 'SKELETONARCHER'
    ))
    if (archers.length > 0) {
      if (!frame.enemyFamilies.split(',').includes('SKELETONARCHER')) {
        await page.waitForTimeout(25)
        continue
      }
      wave = await encounterReceipt(page.locator('.boneyard-scene'))
      assert.equal(wave.waveOrdinal, 2)
      assert.equal(wave.waveScheduleIndex, 1)
      break
    }
    assert.equal(
      frame.localPlayerLifeState,
      'alive',
      `player died before the deterministic Archer wave after ${killCount} kills`,
    )

    if (!nearestLivingEnemy(frame)) {
      await page.waitForTimeout(100)
      continue
    }
    const killed = await castUntilEnemyDies(page, {
      deadline,
      navigation,
      selectedSkillIds,
    })
    killCount += 1
    boundedPush(killReceipts, killed, 12)

    const after = await boneyardFrame(page)
    if (after.localPlayerLifeState === 'alive') {
      const nearest = nearestLivingEnemy(after)
      if (nearest && enemyDistance(after, nearest) <= FIRE_ENGAGEMENT_MAX_DISTANCE) {
        await evadeEnemyPack(page, after, navigation, 220)
      }
    }
  }

  assert.ok(wave, `deterministic Archer wave did not materialize: ${JSON.stringify({
    killCount,
    wire: wireSummary(wire),
  })}`)
  return observeArcherProjectileLifecycle(
    page,
    wire,
    runId,
    deadline,
    screenshotPath,
    navigation,
    { killCount, killReceipts, selectedSkillIds, wave },
  )
}

async function observeArcherProjectileLifecycle(
  page,
  wire,
  runId,
  deadline,
  screenshotPath,
  navigation,
  advanceReceipt,
) {
  const discardedProjectileIds = new Set()
  const renderedProjectileTicks = new Map()
  const renderedShotActorIds = new Set()
  let candidate = null
  let reconstructedProjectile = null

  while (Date.now() < deadline) {
    if (wire.errors.length > 0) {
      throw new Error(`game wire observation failed: ${wire.errors.join('; ')}`)
    }
    const snapshot = currentBoneyardSnapshot(wire, runId)
    const frame = await boneyardFrame(page)
    if (!snapshot) {
      await page.waitForTimeout(25)
      continue
    }

    const archerIds = new Set(snapshot.world.enemies
      .filter((enemy) => enemy.enemyToken === 'SKELETONARCHER')
      .map((enemy) => enemy.id))
    for (const enemy of frame.enemySamples) {
      if (archerIds.has(enemy.id) && enemy.action === 'archer-shot') {
        renderedShotActorIds.add(enemy.id)
      }
    }

    if (!candidate) {
      candidate = [...wire.events.values()]
        .filter((event) => (
          event.runId === runId
          && event.type === 'projectile-spawned'
          && archerIds.has(event.actorId)
          && !discardedProjectileIds.has(event.projectileId)
        ))
        .sort((left, right) => left.eventId - right.eventId)[0] ?? null
      reconstructedProjectile = null
    }

    if (candidate) {
      const projectileId = candidate.projectileId
      const activeProjectile = snapshot.world.enemyProjectiles.find((projectile) => (
        projectile.id === projectileId
      ))
      if (activeProjectile) reconstructedProjectile = { ...activeProjectile }
      if (
        frame.enemyProjectileIds.includes(projectileId)
        && !renderedProjectileTicks.has(projectileId)
      ) {
        renderedProjectileTicks.set(projectileId, frame.tick)
        await page.screenshot({ path: screenshotPath })
      }

      const retirement = [...wire.events.values()].find((event) => (
        event.runId === runId
        && event.type === 'projectile-retired'
        && event.projectileId === projectileId
      ))
      const rendered = renderedProjectileTicks.has(projectileId)
      const motion = wire.projectileSamples.get(projectileId)
      const moved = motion
        && motion.last[5] > motion.first[5]
        && (motion.last[2] !== motion.first[2] || motion.last[3] !== motion.first[3])
      const activeInReconstruction = snapshot.world.enemyProjectiles.some((projectile) => (
        projectile.id === projectileId
      ))
      const activeInRenderer = frame.enemyProjectileIds.includes(projectileId)

      if (retirement && !activeInReconstruction && !activeInRenderer) {
        if (
          rendered
          && reconstructedProjectile
          && renderedShotActorIds.has(candidate.actorId)
          && motion?.count >= 2
          && moved
        ) {
          const enemyDescriptor = wire.descriptors.get(replicatedEntityKey(
            REPLICATED_ENTITY_TYPES.boneyardEnemy,
            candidate.actorId,
          ))
          const projectileDescriptor = wire.descriptors.get(replicatedEntityKey(
            REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
            projectileId,
          ))
          assert.ok(enemyDescriptor, 'expected the Archer wire descriptor')
          assert.equal(enemyDescriptor[0], REPLICATED_ENTITY_TYPES.boneyardEnemy)
          assert.equal(enemyDescriptor[1], candidate.actorId)
          assert.equal(enemyDescriptor[2], 1)
          assert.equal(enemyDescriptor[3], 1002)
          assert.ok(projectileDescriptor, 'expected the arrow wire descriptor')
          assert.equal(
            projectileDescriptor[0],
            REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
          )
          assert.equal(projectileDescriptor[1], projectileId)
          assert.equal(projectileDescriptor[2], 0)
          assert.equal(projectileDescriptor[3], 0x7da)
          assert.equal(projectileDescriptor[4], candidate.actorId)
          assert.equal(reconstructedProjectile.kind, 'arrow')
          assert.equal(reconstructedProjectile.nativeTypeId, 0x7da)
          assert.equal(reconstructedProjectile.ownerActorId, candidate.actorId)
          assert.equal(retirement.actorId, candidate.actorId)
          return {
            ...advanceReceipt,
            actorId: candidate.actorId,
            archerDescriptor: [...enemyDescriptor],
            archerShotRendered: true,
            projectileDescriptor: [...projectileDescriptor],
            projectileId,
            projectileMotion: {
              count: motion.count,
              first: [...motion.first],
              last: [...motion.last],
            },
            projectileRenderedTick: renderedProjectileTicks.get(projectileId),
            reconstructedProjectile,
            retirementEventId: retirement.eventId,
            retirementTick: retirement.tick,
            wireRetirementSequence: wire.retired.get(replicatedEntityKey(
              REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
              projectileId,
            )) ?? null,
          }
        }
        discardedProjectileIds.add(projectileId)
        candidate = null
        reconstructedProjectile = null
      }
    }

    const focusActorId = candidate?.actorId
      ?? nearestArcherId(frame, archerIds)
    const archer = frame.enemySamples.find((enemy) => enemy.id === focusActorId)
    if (!archer) {
      await page.waitForTimeout(50)
      continue
    }
    const nearest = nearestLivingEnemy(frame)
    const nearestDistance = nearest ? enemyDistance(frame, nearest) : Number.POSITIVE_INFINITY
    if (nearestDistance < FIRE_ENGAGEMENT_MIN_DISTANCE) {
      await evadeEnemyPack(page, frame, navigation, 220)
    } else {
      await page.waitForTimeout(50)
    }
  }

  throw new Error(`Archer projectile lifecycle did not complete: ${JSON.stringify({
    advanceReceipt,
    discardedProjectileIds: [...discardedProjectileIds],
    renderedProjectileTicks: [...renderedProjectileTicks],
    renderedShotActorIds: [...renderedShotActorIds],
    wire: wireSummary(wire),
  })}`)
}

function currentBoneyardSnapshot(wire, runId) {
  const snapshot = wire.latestSnapshot
  return snapshot?.world.kind === 'boneyard' && snapshot.world.runId === runId
    ? snapshot
    : null
}

function nearestArcherId(frame, archerIds) {
  return frame.enemySamples
    .filter((enemy) => archerIds.has(enemy.id) && enemy.lifeState !== 'death')
    .toSorted((left, right) => (
      Math.hypot(left.x - frame.playerX, left.y - frame.playerY)
      - Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
      || left.id - right.id
    ))[0]?.id ?? null
}

async function drainPendingSkillOffers(page, selectedSkillIds = []) {
  const picker = page.locator('.skill-picker-stage')

  while (await picker.count() > 0) {
    await picker.waitFor({ state: 'visible', timeout: 5_000 })
    const offerSequence = Number(await picker.getAttribute('data-offer-sequence'))
    assert.ok(Number.isSafeInteger(offerSequence), 'expected a real skill offer sequence')
    const choices = picker.locator('button[data-skill-id]')
    const skillIds = await choices.evaluateAll((buttons) => (
      buttons.map((button) => Number(button.getAttribute('data-skill-id')))
    ))
    assert.ok(skillIds.length > 0, 'expected a real offered skill choice')
    const nonPrimaryIndex = skillIds.findIndex((skillId) => skillId !== 16)
    const choiceIndex = nonPrimaryIndex >= 0 ? nonPrimaryIndex : 0
    const skillId = skillIds[choiceIndex]
    assert.ok(Number.isSafeInteger(skillId), 'expected a real offered skill id')
    await choices.nth(choiceIndex).click()
    await page.waitForFunction((priorSequence) => {
      const current = document.querySelector('.skill-picker-stage')
      return current === null
        || Number(current.getAttribute('data-offer-sequence')) !== priorSequence
    }, offerSequence, { timeout: 15_000 })
    boundedPush(selectedSkillIds, skillId, 16)
  }
}

async function kiteUntilSolomonTaunt(page, navigation) {
  const first = await boneyardFrame(page)
  const actions = new Set()
  let minimumHealth = first.localPlayerHealth
  let pulseIndex = 0
  const fallbackDirections = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ]
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const frame = await boneyardFrame(page)
    minimumHealth = Math.min(minimumHealth, frame.localPlayerHealth)
    for (const enemy of frame.enemySamples) {
      if (enemy.action) actions.add(enemy.action)
    }
    const receipt = await encounterReceipt(page.locator('.boneyard-scene'))
    const hasTaunt = receipt.voiceEventId === 3
      && await page.evaluate(() => window.__sdrAudioPlaySources?.some(
        (source) => source.includes('solomon-get-him-boys'),
      ))
    if (hasTaunt) {
      const movedEnemyIds = await page.evaluate(() => window.__sdrEnemyMovedIds ?? [])
      assert.ok(movedEnemyIds.length > 0, 'expected authoritative enemy locomotion')
      return {
        actions: [...actions],
        endTick: frame.tick,
        minimumHealth,
        movedEnemyIds,
        startTick: first.tick,
      }
    }

    if (frame.localPlayerLifeState === 'alive') {
      const moved = await evadeEnemyPack(page, frame, navigation, 220)
      if (!moved) {
        await pulseMovement(
          page,
          movementKeys(fallbackDirections[pulseIndex % fallbackDirections.length]),
          180,
        )
      }
    } else {
      await page.waitForTimeout(100)
    }
    pulseIndex += 1
  }
  throw new Error('Solomon did not finish the laugh and taunt while combat was active')
}

async function proveChillWindArrowTumble(page, wire, screenshotPath) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.equal(state.levelUpBarrier, null)
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const auraTargetTemplate = state.world.enemies.actors.find((actor) => (
    actor.lifeState === 'alive' && actor.config.enemyToken !== 'COFFIN'
  ))
  assert.ok(auraTargetTemplate, 'opening wave had no Cold Aura target template')
  learnChillWind(state, playerId)
  Object.assign(state, {
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies,
        actors: Object.freeze([]),
        deathEffects: Object.freeze([]),
        mageLightningPulses: Object.freeze([]),
        maggots: Object.freeze([]),
        projectileEffects: Object.freeze([]),
        projectiles: Object.freeze([]),
      },
      waves: state.world.waves === null
        ? null
        : { ...state.world.waves, phase: 'dormant' },
    },
  })

  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.5)
  const baselineScreenshotPath = screenshotPath.replace(/\.png$/, '-frost-jet.png')
  let baseline = null
  await page.mouse.down({ button: 'left' })
  try {
    baseline = await waitForWaterCohort(page, playerId, 2, 4, 15)
    await page.waitForTimeout(120)
    baseline = {
      ...baseline,
      visualPrimarySpellCount: (await boneyardFrame(page)).primarySpellCount,
    }
    await page.screenshot({ path: baselineScreenshotPath })
  } finally {
    await page.mouse.up({ button: 'left' })
  }
  assert.ok(baseline)
  await page.waitForTimeout(400)

  const arrowState = host.state()
  assert.equal(arrowState.world.kind, 'boneyard')
  const player = getPlayerCharacter(arrowState, playerId)
  const arrowId = arrowState.world.enemies.nextProjectileId
  const effectId = arrowState.world.enemies.nextProjectileEffectId
  assert.ok(arrowId > 0)
  assert.ok(effectId > 0)
  const tick = arrowState.tick
  const nativeCellBindingOrder = arrowState.world.enemies.nextNativeCellBindingOrder
  const nativeRegistrationOrder = arrowState.world.enemies.nextNativeRegistrationOrder
  const arrow = Object.freeze({
    ageTicks: 0,
    bounceVelocity: 0,
    chillTumbleAccumulator: 0,
    coldSlowTicks: 0,
    contactRadius: 8,
    damage: 1,
    headingDeg: 90,
    hitPlayerIds: Object.freeze([]),
    homing: false,
    id: arrowId,
    kind: 'arrow',
    lastStepTick: tick,
    lightRegistration: null,
    lifetimeTicks: 300,
    minimumSpeed: 0,
    nativeTypeId: 0x7da,
    nativeCellBindingOrder,
    nativeRegistrationOrder,
    ownerActorId: 1,
    payload: 'normal',
    poisonDamage: 0,
    poisonDuration: 0,
    position: Object.freeze({ x: player.position.x + 80, y: player.position.y }),
    speed: 0,
    settledTicksRemaining: 300,
    spawnTick: tick,
    targetPlayerId: null,
    verticalOffset: -25,
    verticalVelocity: 0,
    visualPhaseDeg: 0,
    visualScale: 1,
  })
  Object.assign(arrowState, {
    world: {
      ...arrowState.world,
      enemies: {
        ...arrowState.world.enemies,
        nextNativeCellBindingOrder: nativeCellBindingOrder + 1,
        nextNativeRegistrationOrder: nativeRegistrationOrder + 1,
        nextProjectileId: arrowId + 1,
        projectileEffects: Object.freeze([]),
        projectiles: Object.freeze([arrow]),
      },
    },
  })

  let hostEffect = null
  let firstAccumulatorTick = null
  let maximumAccumulator = 0
  await page.mouse.down({ button: 'left' })
  try {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline && hostEffect === null) {
      const current = host.state()
      if (current.world.kind === 'boneyard') {
        const retainedArrow = current.world.enemies.projectiles.find(({ id }) => id === arrowId)
        if (retainedArrow?.kind === 'arrow' && retainedArrow.chillTumbleAccumulator > 0) {
          firstAccumulatorTick ??= current.tick
          maximumAccumulator = Math.max(
            maximumAccumulator,
            retainedArrow.chillTumbleAccumulator,
          )
        }
        hostEffect = current.world.enemies.projectileEffects.find((effect) => (
          effect.id === effectId && effect.kind === 'arrow-tumble'
        )) ?? null
      }
      if (hostEffect === null) await page.waitForTimeout(1)
    }
  } finally {
    await page.mouse.up({ button: 'left' })
  }
  assert.ok(hostEffect, 'learned Chill Wind did not tumble the hostile Arrow')
  assert.ok(firstAccumulatorTick !== null, 'Chill Wind never accumulated Arrow tumble force')
  assert.ok(maximumAccumulator > 0.9 && maximumAccumulator <= 1)
  assert.ok(hostEffect.alpha > 2 && hostEffect.alpha <= 6)
  assert.equal(hostEffect.entry, 2)
  assert.equal(hostEffect.ownerProjectileId, arrowId)

  const wireEffect = await waitForWireValue(
    page,
    wire,
    ({ latestSnapshot }) => latestSnapshot?.world.kind === 'boneyard'
      ? latestSnapshot.world.enemyProjectileEffects.find((effect) => (
          effect.id === effectId && effect.kind === 'arrow-tumble' && effect.alpha > 2
        )) ?? null
      : null,
    5_000,
    'the replicated alpha-six Arrow SpinAway',
  )
  await page.waitForFunction((id) => (
    document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame?.enemyProjectileEffectIds?.includes(id)
  ), effectId, { timeout: 5_000 })
  const renderedFrame = await boneyardFrame(page)
  await page.screenshot({ path: screenshotPath })

  const retirementDeadline = Date.now() + 5_000
  while (Date.now() < retirementDeadline) {
    const current = host.state()
    const hostRetired = current.world.kind === 'boneyard'
      && !current.world.enemies.projectileEffects.some(({ id }) => id === effectId)
    const wireRetired = wire.latestSnapshot?.world.kind === 'boneyard'
      && !wire.latestSnapshot.world.enemyProjectileEffects.some(({ id }) => id === effectId)
    if (hostRetired && wireRetired) break
    await page.waitForTimeout(20)
  }
  const finalState = host.state()
  assert.equal(finalState.world.kind, 'boneyard')
  assert.equal(finalState.world.enemies.projectileEffects.some(({ id }) => id === effectId), false)
  assert.equal(wire.latestSnapshot?.world.kind, 'boneyard')
  assert.equal(
    wire.latestSnapshot.world.enemyProjectileEffects.some(({ id }) => id === effectId),
    false,
  )
  assert.ok(host.hostPlayerId(), 'the browser player disconnected during SpinAway')
  learnConeOfIce(host.state(), playerId, 11)
  const coneScreenshotPath = screenshotPath.replace(/\.png$/, '-cone-of-ice-rank-11.png')
  await page.mouse.down({ button: 'left' })
  let cone
  try {
    cone = await waitForWaterCohort(page, playerId, 10, 10, 90)
    await page.waitForTimeout(120)
    cone = {
      ...cone,
      visualPrimarySpellCount: (await boneyardFrame(page)).primarySpellCount,
    }
    await page.screenshot({ path: coneScreenshotPath })
  } finally {
    await page.mouse.up({ button: 'left' })
  }
  const auraHail = await proveFrostAuraHailContact(
    page,
    wire,
    playerId,
    auraTargetTemplate,
    frostAuraHailScreenshotPath,
  )
  return {
    auraHail,
    arrowId,
    baseline,
    baselineScreenshotPath,
    cone,
    coneScreenshotPath,
    effectId,
    entry: wireEffect.entry,
    firstAccumulatorTick,
    initialAlpha: wireEffect.alpha,
    maximumAccumulator,
    renderedEffectIds: renderedFrame.enemyProjectileEffectIds,
    retirementTick: finalState.tick,
    tumbleTick: hostEffect.spawnTick,
  }
}

async function proveFrostAuraHailContact(
  page,
  wire,
  playerId,
  targetTemplate,
  screenshotPath,
) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  learnWaterSkill(state, playerId, 37, 1)
  learnWaterSkill(state, playerId, 38, 10)
  learnWaterSkill(state, playerId, 39, 1)
  const player = getPlayerCharacter(state, playerId)
  const aim = player.primaryCast.aimDirection
  const targetPosition = {
    x: player.position.x - aim.x * 300,
    y: player.position.y - aim.y * 300,
  }
  const target = {
    ...targetTemplate,
    config: { ...targetTemplate.config, maximumHealth: 1_000_000 },
    currentHealth: 1_000_000,
    nextAttackTick: Number.MAX_SAFE_INTEGER,
    nextMovementTick: Number.MAX_SAFE_INTEGER,
    nextTargetRefreshTick: Number.MAX_SAFE_INTEGER,
    position: targetPosition,
    targetPlayerId: null,
  }
  Object.assign(state, {
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies,
        actors: Object.freeze([target]),
        maggots: Object.freeze([]),
        projectileEffects: Object.freeze([]),
        projectiles: Object.freeze([]),
      },
    },
  })

  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.5)
  let receipt = null
  await page.mouse.down({ button: 'left' })
  try {
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline && receipt === null) {
      const current = host.state()
      const aura = [...current.primarySpells.transients].reverse().find((effect) => (
        effect.kind === 'water-aura' && effect.ownerId === playerId
      ))
      const hail = [...current.primarySpells.transients].reverse().find((effect) => (
        effect.kind === 'water-hail' && effect.ownerId === playerId
      ))
      const effect = current.secondaryAbilities.targetEffects.find((candidate) => (
        candidate.targetId === target.id && candidate.worldKey === `boneyard:${current.world.runId}`
      ))
      const frame = await boneyardFrame(page)
      const wireAura = wire.latestSnapshot?.primarySpells.transients.find((candidate) => (
        candidate.kind === 'water-aura' && candidate.ownerId === playerId
      ))
      const wireHail = wire.latestSnapshot?.primarySpells.transients.find((candidate) => (
        candidate.kind === 'water-hail' && candidate.ownerId === playerId
      ))
      if (
        aura?.kind === 'water-aura'
        && hail?.kind === 'water-hail'
        && effect?.coldSlowFactor === Math.fround(Math.fround(0.6) / Math.fround(1.5))
        && effect.coldSlowTicks === 200
        && wireAura?.kind === 'water-aura'
        && wireHail?.kind === 'water-hail'
        && frame.primarySpellKinds.includes('water-aura')
        && frame.primarySpellKinds.includes('water-hail')
      ) receipt = { aura, effect, frame, hail, wireAura, wireHail }
      else await page.waitForTimeout(5)
    }
    assert.ok(receipt, 'Boneyard never resolved distant Aura/Permafrost and Hail')
    await page.screenshot({ path: screenshotPath })
  } finally {
    await page.mouse.up({ button: 'left' })
  }

  const pushState = host.state()
  assert.equal(pushState.world.kind, 'boneyard')
  const pushPlayer = getPlayerCharacter(pushState, playerId)
  const pushTarget = pushState.world.enemies.actors.find(({ id }) => id === target.id)
  assert.ok(pushTarget)
  const pushHealthStart = pushTarget.currentHealth
  const pushStart = {
    x: pushPlayer.position.x + pushPlayer.primaryCast.aimDirection.x * 80,
    y: pushPlayer.position.y + pushPlayer.primaryCast.aimDirection.y * 80,
  }
  Object.assign(pushState, {
    secondaryAbilities: {
      ...pushState.secondaryAbilities,
      targetEffects: pushState.secondaryAbilities.targetEffects.filter((effect) => (
        effect.targetId !== target.id
      )),
    },
    world: {
      ...pushState.world,
      enemies: {
        ...pushState.world.enemies,
        actors: pushState.world.enemies.actors.map((actor) => (
          actor.id === pushTarget.id ? { ...actor, position: pushStart } : actor
        )),
      },
    },
  })
  let pushReceipt = null
  await page.mouse.down({ button: 'left' })
  try {
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline && pushReceipt === null) {
      const current = host.state()
      if (current.world.kind === 'boneyard') {
        const actor = current.world.enemies.actors.find(({ id }) => id === target.id)
        const cold = current.secondaryAbilities.targetEffects.find((effect) => (
          effect.targetId === target.id
          && effect.worldKey === `boneyard:${current.world.runId}`
        ))
        if (
          actor
          && actor.currentHealth < pushHealthStart
          && Math.hypot(actor.position.x - pushStart.x, actor.position.y - pushStart.y) > 0.05
          && cold?.coldSlowFactor === Math.fround(1 / 3)
          && cold.coldSlowTicks === 200
        ) {
          pushReceipt = { actor, cold }
        }
      }
      if (pushReceipt === null) await page.waitForTimeout(5)
    }
  } finally {
    await page.mouse.up({ button: 'left' })
  }
  assert.ok(pushReceipt, 'Frost contact did not apply damage, Cold, and Chill displacement')
  return {
    auraFactor: receipt.effect.coldSlowFactor,
    auraId: receipt.aura.id,
    auraTicks: receipt.effect.coldSlowTicks,
    baseColdFactor: pushReceipt.cold.coldSlowFactor,
    baseColdTicks: pushReceipt.cold.coldSlowTicks,
    damage: pushHealthStart - pushReceipt.actor.currentHealth,
    hailId: receipt.hail.id,
    pushDelta: {
      x: pushReceipt.actor.position.x - pushStart.x,
      y: pushReceipt.actor.position.y - pushStart.y,
    },
    renderedKinds: [...new Set(receipt.frame.primarySpellKinds.filter((kind) => (
      kind === 'water-aura' || kind === 'water-hail'
    )))],
    screenshotPath,
    targetDistance: 300,
    wireAuraId: receipt.wireAura.id,
    wireHailId: receipt.wireHail.id,
  }
}

function learnChillWind(state, playerId) {
  learnWaterSkill(state, playerId, 33, 1)
}

function learnConeOfIce(state, playerId, rank) {
  learnWaterSkill(state, playerId, 34, rank)
}

function learnWaterSkill(state, playerId, skillId, rank) {
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[skillId] = rank
  effectiveRanks[skillId] = rank
  const skillBooks = [...state.playerEntities.skillBooks]
  const progressions = [...state.playerEntities.progressions]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: sourceBook.learnedSkillOrder.includes(skillId)
      ? sourceBook.learnedSkillOrder
      : [...sourceBook.learnedSkillOrder, skillId],
    permanentRanks,
  }
  progressions[index] = {
    ...progressions[index],
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions,
      skillBooks,
    }, playerId, getPlayerEconomy(state, playerId)),
  })
}

function fortifyStaffMovementTrial(state, playerId) {
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index],
    currentHealth: 1_000_000,
    maximumHealth: 1_000_000,
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    playerEntities: { ...state.playerEntities, progressions },
  })
}

function stageStaffMovementTarget(state, playerId, navigation) {
  assert.equal(state.world.kind, 'boneyard')
  const player = getPlayerCharacter(state, playerId)
  const targetIndex = state.world.enemies.actors.findIndex((actor) => (
    actor.lifeState === 'alive'
    && actor.config.enemyToken !== 'COFFIN'
    && actor.brain.phase === 'approach'
  ))
  assert.notEqual(targetIndex, -1, 'opening wave had no controllable Staff target')
  const target = state.world.enemies.actors[targetIndex]
  const directions = [
    { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
    { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ]
  let targetPosition = null
  const contactDistance = PLAYER_CHARACTER_RADIUS + target.config.collisionRadius
  for (const distance of [contactDistance + 8, contactDistance + 16, contactDistance + 24]) {
    for (const direction of directions) {
      const length = Math.hypot(direction.x, direction.y)
      const candidate = {
        x: player.position.x + direction.x / length * distance,
        y: player.position.y + direction.y / length * distance,
      }
      const insideBounds = candidate.x >= navigation.bounds.x + PLAYER_CHARACTER_RADIUS
        && candidate.x <= navigation.bounds.x + navigation.bounds.w - PLAYER_CHARACTER_RADIUS
        && candidate.y >= navigation.bounds.y + PLAYER_CHARACTER_RADIUS
        && candidate.y <= navigation.bounds.y + navigation.bounds.h - PLAYER_CHARACTER_RADIUS
      if (!insideBounds || !traversesBoneyard(
        player.position,
        candidate,
        navigation.bounds,
        navigation.collision,
      )) continue
      const clearOfOthers = state.world.enemies.actors.every((actor, index) => (
        index === targetIndex
        || actor.lifeState !== 'alive'
        || Math.hypot(
          actor.position.x - candidate.x,
          actor.position.y - candidate.y,
        ) > actor.config.collisionRadius + target.config.collisionRadius + 20
      ))
      if (!clearOfOthers) continue
      targetPosition = candidate
      break
    }
    if (targetPosition !== null) break
  }
  assert.ok(targetPosition, 'could not stage a collision-safe Staff target')
  const actors = [...state.world.enemies.actors]
  actors[targetIndex] = {
    ...target,
    currentHealth: 1_000,
    nextMovementTick: Number.MAX_SAFE_INTEGER,
    nextTargetRefreshTick: Number.MAX_SAFE_INTEGER,
    position: targetPosition,
    targetPlayerId: null,
  }
  Object.assign(state, {
    world: {
      ...state.world,
      enemies: { ...state.world.enemies, actors },
    },
  })
  return target.id
}

function stagedStaffTargetDirection(state, playerId, targetId) {
  if (state.world.kind !== 'boneyard') return null
  const target = state.world.enemies.actors.find((actor) => (
    actor.id === targetId && actor.lifeState === 'alive'
  ))
  if (!target) return null
  const player = getPlayerCharacter(state, playerId)
  return {
    x: target.position.x - player.position.x,
    y: target.position.y - player.position.y,
  }
}

async function waitForWaterCohort(
  page,
  playerId,
  expectedCount,
  expectedSpeed,
  expectedAmplitudeDegrees,
) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const state = host.state()
    const cohorts = new Map()
    for (const transient of state.primarySpells.transients) {
      if (transient.kind !== 'water' || transient.ownerId !== playerId) continue
      const cohortId = transient.id - transient.variant
      const cohort = cohorts.get(cohortId) ?? []
      cohort.push(transient)
      cohorts.set(cohortId, cohort)
    }
    for (const cohort of [...cohorts.values()].reverse()) {
      if (cohort.length !== expectedCount) continue
      cohort.sort((left, right) => left.variant - right.variant)
      if (!cohort.every(({ speed }) => speed === expectedSpeed)) continue
      const aimDirection = getPlayerCharacter(state, playerId).primaryCast.aimDirection
      const aimHeadingDegrees = directionHeadingDegrees(aimDirection)
      const angularOffsetsDegrees = cohort.map(({ direction }) => signedHeadingDeltaDegrees(
        aimHeadingDegrees,
        directionHeadingDegrees(direction),
      ))
      const maximumAbsoluteAngularOffsetDegrees = Math.max(
        ...angularOffsetsDegrees.map(Math.abs),
      )
      assert.ok(angularOffsetsDegrees.every((offset) => (
        Math.abs(offset) <= expectedAmplitudeDegrees + 0.01
      )))
      if (maximumAbsoluteAngularOffsetDegrees < expectedAmplitudeDegrees - 0.1) continue
      const frame = await boneyardFrame(page)
      if (!frame.primarySpellKinds.includes('water')) continue
      assert.ok(frame.primarySpellCount >= expectedCount)
      assert.deepEqual(
        cohort.map(({ variant }) => variant),
        Array.from({ length: expectedCount }, (_, index) => index),
      )
      return {
        aimHeadingDegrees,
        angularOffsetsDegrees,
        ids: cohort.map(({ id }) => id),
        maximumAbsoluteAngularOffsetDegrees,
        maximumVariant: cohort.at(-1).variant,
        renderedPrimarySpellCount: frame.primarySpellCount,
        speeds: cohort.map(({ speed }) => speed),
        tick: state.tick,
      }
    }
    await page.waitForTimeout(1)
  }
  throw new Error(`Water cohort ${expectedCount}@${expectedSpeed} was not rendered`)
}

function directionHeadingDegrees(direction) {
  return Math.atan2(direction.x, -direction.y) * 180 / Math.PI
}

function signedHeadingDeltaDegrees(from, to) {
  return ((to - from + 540) % 360) - 180
}

async function proveStaffMeleeContact(page, navigation, smokeScreenshotPath) {
  let initialState = host.state()
  assert.equal(initialState.world.kind, 'boneyard')
  const playerId = initialState.playerEntities.identities[0]?.playerId
  assert.ok(playerId, 'expected the authoritative browser player')
  learnFortunateFlailing(initialState, playerId)
  fortifyStaffMovementTrial(initialState, playerId)
  const stagedTargetId = stageStaffMovementTarget(initialState, playerId, navigation)
  stabilizeStaffMeleeEnemies(initialState, playerId, stagedTargetId)
  await waitForStaffPresentationReady(page)
  initialState = host.state()
  const existingSmokeIds = new Set(initialState.primarySpells.transients
    .filter(({ kind, ownerId }) => kind === 'player-staff-smoke' && ownerId === playerId)
    .map(({ id }) => id))
  const renderedSmokePromise = captureRenderedStaffSmoke(page, smokeScreenshotPath)
  const existingActionIds = new Set(initialState.primarySpells.transients
    .filter((transient) => (
      transient.ownerId === playerId
      && (transient.kind === 'player-staff-melee' || transient.kind === 'player-staff-spin')
    ))
    .map(({ id }) => id))
  const actionDeadline = Date.now() + 60_000
  let action = null
  let actionState = null

  while (Date.now() < actionDeadline && action === null) {
    const state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    action = state.primarySpells.transients.find((transient) => (
      transient.ownerId === playerId
      && !existingActionIds.has(transient.id)
      && (transient.kind === 'player-staff-melee' || transient.kind === 'player-staff-spin')
    )) ?? null
    if (action !== null) {
      actionState = state
      break
    }
    const frame = await boneyardFrame(page)
    assert.equal(frame.localPlayerLifeState, 'alive', 'player died before Staff contact')
    const direction = stagedStaffTargetDirection(state, playerId, stagedTargetId)
      ?? nearestEnemyApproachDirection(frame, navigation)
    if (direction === null) {
      await page.waitForTimeout(50)
    } else {
      await pulseMovement(page, movementKeys(direction), 80)
    }
  }

  assert.ok(action && actionState, 'walking into the opening wave did not admit a Staff action')
  assert.equal(actionState.world.kind, 'boneyard')
  const playerAtAction = getPlayerCharacter(actionState, playerId)
  const targetAtAction = nearestHostileActor(actionState, playerAtAction.position)
  assert.ok(targetAtAction, 'Staff admission had no living hostile contact candidate')
  const actionDistance = Math.hypot(
    targetAtAction.position.x - playerAtAction.position.x,
    targetAtAction.position.y - playerAtAction.position.y,
  )
  const legalDistance = PLAYER_CHARACTER_RADIUS
    + targetAtAction.collisionRadius
    + NATIVE_ACTOR_SEPARATION_EPSILON
  assert.ok(
    actionDistance <= legalDistance + 2,
    `Staff action began outside native contact clearance (${actionDistance} > ${legalDistance})`,
  )

  const contactIdsAtAction = new Set(actionState.primarySpells.transients
    .filter(({ kind, ownerId }) => kind === 'player-staff-contact' && ownerId === playerId)
    .map(({ id }) => id))
  const healthAtAction = hostileHealthById(actionState)
  const manaAtAction = getPlayerProgression(actionState, playerId).currentMana
  const movement = await proveMovementDuringStaffAction(
    page,
    playerId,
    action,
    actionState,
  )
  const contactDeadline = Date.now() + 10_000
  let contact = null
  let damage = []
  let contactState = actionState

  while (Date.now() < contactDeadline) {
    contactState = host.state()
    assert.equal(contactState.world.kind, 'boneyard')
    contact = contactState.primarySpells.transients.find((transient) => (
      transient.kind === 'player-staff-contact'
      && transient.ownerId === playerId
      && !contactIdsAtAction.has(transient.id)
    )) ?? null
    damage = [...hostileHealthById(contactState)].flatMap(([id, currentHealth]) => {
      const previousHealth = healthAtAction.get(id)
      return previousHealth !== undefined && currentHealth < previousHealth
        ? [{ currentHealth, id, previousHealth }]
        : []
    })
    if (contact !== null && damage.length > 0) break
    await page.waitForTimeout(10)
  }

  assert.ok(contact && contact.kind === 'player-staff-contact')
  assert.ok(damage.length > 0, 'Staff contact marker did not damage a hostile')
  assert.ok(contact.targetIds.some((targetId) => (
    damage.some(({ id }) => targetId === `enemy:${id}`)
  )))
  assert.equal(getPlayerProgression(contactState, playerId).currentMana, manaAtAction)
  const healthBeforeRepeat = hostileHealthById(contactState)
  await page.waitForFunction(() => {
    const sources = window.__sdrAudioPlaySources ?? []
    return sources.some((source) => source.includes('staff-swoosh'))
  }, undefined, { timeout: 10_000 })

  const smoke = await waitForStaffSmoke(
    page,
    playerId,
    existingSmokeIds,
    renderedSmokePromise,
    navigation,
  )

  const repeatDeadline = Date.now() + 30_000
  let repeatAction = null
  let repeatActionState = null
  while (Date.now() < repeatDeadline && repeatAction === null) {
    const state = host.state()
    repeatAction = state.primarySpells.transients.find((transient) => (
      transient.ownerId === playerId
      && transient.id !== action.id
      && (transient.kind === 'player-staff-melee' || transient.kind === 'player-staff-spin')
    )) ?? null
    if (repeatAction !== null) {
      repeatActionState = state
      break
    }
    const frame = await boneyardFrame(page)
    assert.equal(frame.localPlayerLifeState, 'alive', 'player died before repeated Staff contact')
    const direction = stagedStaffTargetDirection(state, playerId, stagedTargetId)
      ?? nearestEnemyApproachDirection(frame, navigation)
    if (direction === null) {
      await page.waitForTimeout(25)
    } else {
      await pulseMovement(page, movementKeys(direction), 80)
    }
  }
  assert.ok(repeatAction && repeatActionState, 'movement did not admit the next Staff action')

  const repeatContactIds = new Set([...contactIdsAtAction, contact.id])
  const repeatContactDeadline = Date.now() + 10_000
  let repeatContact = null
  let repeatDamage = []
  while (Date.now() < repeatContactDeadline) {
    const state = host.state()
    repeatContact = state.primarySpells.transients.find((transient) => (
      transient.kind === 'player-staff-contact'
      && transient.ownerId === playerId
      && !repeatContactIds.has(transient.id)
    )) ?? null
    repeatDamage = [...hostileHealthById(state)].flatMap(([id, currentHealth]) => {
      const previousHealth = healthBeforeRepeat.get(id)
      return previousHealth !== undefined && currentHealth < previousHealth
        ? [{ currentHealth, id, previousHealth }]
        : []
    })
    if (repeatContact !== null && repeatDamage.length > 0) break
    await page.waitForTimeout(10)
  }
  assert.ok(repeatContact && repeatContact.kind === 'player-staff-contact')
  assert.ok(repeatDamage.length > 0, 're-engaged Staff marker did not damage a hostile')
  await page.waitForFunction(() => (
    (window.__sdrAudioPlaySources ?? []).some((source) => source.includes('staff-hit-wood'))
  ), undefined, { timeout: 10_000 })

  const audioSources = await page.evaluate(() => (
    [...new Set(window.__sdrAudioPlaySources ?? [])].filter((source) => (
      source.includes('staff-swoosh') || source.includes('staff-hit-wood')
    ))
  ))
  return {
    actionDistance,
    actionId: action.id,
    actionKind: action.kind,
    audioSources,
    contactId: contact.id,
    contactTargetIds: contact.targetIds,
    damage,
    legalDistance,
    manaAtAction,
    movement,
    repeatActionId: repeatAction.id,
    repeatActionKind: repeatAction.kind,
    repeatContactId: repeatContact.id,
    repeatDamage,
    smoke,
    targetId: targetAtAction.id,
    stagedTargetId,
    targetToken: targetAtAction.enemyToken,
  }
}

async function proveMovementDuringStaffAction(page, playerId, action, actionState) {
  const playerAtAction = getPlayerCharacter(actionState, playerId)
  const initialSpeed = Math.hypot(
    playerAtAction.velocity.x,
    playerAtAction.velocity.y,
  )
  assert.ok(initialSpeed > 0.01, 'Staff admission did not retain its movement epoch velocity')
  const keys = movementKeys({
    x: -playerAtAction.velocity.x,
    y: -playerAtAction.velocity.y,
  })
  assert.ok(keys.length > 0, 'Staff escape direction produced no movement keys')
  const keyDirection = {
    x: Number(keys.includes('d')) - Number(keys.includes('a')),
    y: Number(keys.includes('s')) - Number(keys.includes('w')),
  }
  const keyDirectionLength = Math.hypot(keyDirection.x, keyDirection.y)
  const direction = {
    x: keyDirection.x / keyDirectionLength,
    y: keyDirection.y / keyDirectionLength,
  }
  const positionProjection = (player) => (
    player.position.x * direction.x + player.position.y * direction.y
  )
  const velocityProjection = (player) => (
    player.velocity.x * direction.x + player.velocity.y * direction.y
  )
  const initialPositionProjection = positionProjection(playerAtAction)
  const initialVelocityProjection = velocityProjection(playerAtAction)
  let priorPositionProjection = initialPositionProjection
  let minimumPositionProjection = initialPositionProjection
  let receipt = null

  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    const deadline = Date.now() + 750
    while (Date.now() < deadline && receipt === null) {
      await page.waitForTimeout(5)
      const state = host.state()
      const activeAction = state.primarySpells.transients.find((transient) => (
        transient.id === action.id
        && transient.ownerId === playerId
        && transient.kind === action.kind
      ))
      if (!activeAction) break
      const player = getPlayerCharacter(state, playerId)
      const currentPositionProjection = positionProjection(player)
      const currentVelocityProjection = velocityProjection(player)
      minimumPositionProjection = Math.min(
        minimumPositionProjection,
        currentPositionProjection,
      )
      if (
        currentVelocityProjection > 0.01
        && currentPositionProjection > priorPositionProjection + 0.001
      ) {
        const frame = await boneyardFrame(page)
        assert.equal(
          player.headingIndex,
          actorHeadingIndex(activeAction.headingDegrees),
          'escape movement replaced Staff-action heading',
        )
        receipt = {
          actionAgeTicks: activeAction.ageTicks,
          attachmentPose: frame.playerAttachmentPose,
          escapeDistanceFromTurn: currentPositionProjection - minimumPositionProjection,
          initialSpeed,
          initialVelocityProjection,
          playerHeadingIndex: player.headingIndex,
          velocityProjection: currentVelocityProjection,
          walkPose: frame.playerWalkPose,
        }
        break
      }
      priorPositionProjection = currentPositionProjection
    }
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }

  assert.ok(receipt, `${action.kind} retired before escape movement became authoritative`)
  assert.ok(receipt.initialVelocityProjection < 0)
  assert.ok(receipt.escapeDistanceFromTurn > 0)
  return receipt
}

function learnFortunateFlailing(state, playerId) {
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[71] = 9
  effectiveRanks[71] = 9
  const skillBooks = [...state.playerEntities.skillBooks]
  const progressions = [...state.playerEntities.progressions]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: sourceBook.learnedSkillOrder.includes(71)
      ? sourceBook.learnedSkillOrder
      : [...sourceBook.learnedSkillOrder, 71],
    permanentRanks,
  }
  progressions[index] = {
    ...progressions[index],
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions,
      skillBooks,
    }, playerId, getPlayerEconomy(state, playerId)),
  })
}

async function waitForStaffSmoke(
  page,
  playerId,
  existingSmokeIds,
  renderedSmokePromise,
  navigation,
) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    const smoke = state.primarySpells.transients.find((transient) => (
      transient.kind === 'player-staff-smoke'
      && transient.ownerId === playerId
      && !existingSmokeIds.has(transient.id)
    ))
    if (smoke) {
      const rendered = await renderedSmokePromise
      if (rendered.error !== null) throw rendered.error
      return {
        ageTicks: smoke.ageTicks,
        alpha: smoke.alpha,
        entry: smoke.entry,
        id: smoke.id,
        kind: smoke.kind,
        renderedTick: rendered.tick,
        scale: smoke.scale,
        screenshotPath: rendered.screenshotPath,
      }
    }
    const frame = await boneyardFrame(page)
    assert.equal(frame.localPlayerLifeState, 'alive', 'player died before Staff SmokePuff')
    const direction = nearestEnemyApproachDirection(frame, navigation)
    if (direction === null) await page.waitForTimeout(20)
    else await pulseMovement(page, movementKeys(direction), 60)
  }
  throw new Error('rank-nine Fortunate Flailing did not render Staff SmokePuff')
}

function captureRenderedStaffSmoke(page, screenshotPath) {
  return (async () => {
    try {
      await page.waitForFunction(() => (
        document.querySelector('.boneyard-world-canvas')
          ?.__sdrBoneyardFrame?.primarySpellKinds?.includes('player-staff-smoke')
      ), undefined, { timeout: 120_000 })
      const frame = await boneyardFrame(page)
      assert.ok(frame.primarySpellKinds.includes('player-staff-smoke'))
      await page.screenshot({ path: screenshotPath })
      return { error: null, screenshotPath, tick: frame.tick }
    } catch (error) {
      return { error, screenshotPath, tick: null }
    }
  })()
}

async function waitForStaffPresentationReady(page) {
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame?.arenaTransitionPhase === 'sealed'
  ), undefined, { timeout: 15_000 })
  const deadline = Date.now() + 10_000
  let consecutiveSamples = 0
  while (Date.now() < deadline) {
    const frame = await boneyardFrame(page)
    const lagTicks = host.state().tick - frame.tick
    consecutiveSamples = lagTicks >= 0 && lagTicks <= 10
      ? consecutiveSamples + 1
      : 0
    if (consecutiveSamples >= 3) return
    await page.waitForTimeout(20)
  }
  throw new Error('Staff presentation did not catch up to the sealed Arena epoch')
}

function stabilizeStaffMeleeEnemies(state, playerId, targetId) {
  assert.equal(state.world.kind, 'boneyard')
  const player = getPlayerCharacter(state, playerId)
  const target = state.world.enemies.actors.find((actor) => actor.id === targetId)
  assert.ok(target, 'Staff SmokePuff proof requires one living enemy')
  const enemies = {
    ...state.world.enemies,
    actors: state.world.enemies.actors.map((actor) => {
      if (actor.id === targetId) {
        return {
          ...actor,
          config: {
            ...actor.config,
            extraDamage: 0,
            maximumHealth: 1_000,
            primaryDamage: actor.config.primaryDamage === null ? null : 0,
            secondaryDamage: 0,
            tertiaryDamage: 0,
          },
          currentHealth: 1_000,
          nextMovementTick: state.tick + 1_000_000,
          nextTargetRefreshTick: state.tick + 1_000_000,
        }
      }
      return {
        ...actor,
        nextMovementTick: state.tick + 1_000_000,
        nextTargetRefreshTick: state.tick + 1_000_000,
        position: { x: player.position.x + 2_000 + actor.id, y: player.position.y + 2_000 },
      }
    }),
  }
  Object.assign(state, { world: { ...state.world, enemies } })
}

function nearestHostileActor(state, position) {
  assert.equal(state.world.kind, 'boneyard')
  return [
    ...state.world.enemies.actors.flatMap((actor) => (
      actor.lifeState === 'alive' && actor.config.enemyToken !== 'COFFIN'
        ? [{
            collisionRadius: actor.config.collisionRadius,
            enemyToken: actor.config.enemyToken,
            id: actor.id,
            position: actor.position,
          }]
        : []
    )),
    ...state.world.enemies.maggots.flatMap((maggot) => (
      maggot.lifeState === 'alive'
        ? [{
            collisionRadius: maggot.collisionRadius,
            enemyToken: 'MAGGOT',
            id: maggot.id,
            position: maggot.position,
          }]
        : []
    )),
  ].toSorted((left, right) => (
    Math.hypot(left.position.x - position.x, left.position.y - position.y)
    - Math.hypot(right.position.x - position.x, right.position.y - position.y)
    || left.id - right.id
  ))[0] ?? null
}

function hostileHealthById(state) {
  assert.equal(state.world.kind, 'boneyard')
  return new Map([
    ...state.world.enemies.actors.flatMap((actor) => (
      actor.config.enemyToken === 'COFFIN' ? [] : [[actor.id, actor.currentHealth]]
    )),
    ...state.world.enemies.maggots.map((maggot) => [maggot.id, maggot.currentHealth]),
  ])
}

async function castUntilEnemyDies(page, {
  deadline = Date.now() + 240_000,
  navigation,
  selectedSkillIds = [],
} = {}) {
  assert.ok(navigation, 'combat navigation is required')
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  let acceptedCastCount = 0
  let acceptedTick = null
  let enemyCountBefore = null
  let enemyHealthBefore = null
  let lastAimedTargetId = null
  let manaAfter = null
  let manaBefore = null
  let selectedTargetId = null

  while (Date.now() < deadline) {
    await drainPendingSkillOffers(page, selectedSkillIds)
    let before = await boneyardFrame(page)
    assert.equal(before.localPlayerLifeState, 'alive', 'player died before the combat cast')

    let target = selectedTargetId === null
      ? nearestFireTarget(before, navigation)
      : enemyById(before, selectedTargetId)
    if (!target) {
      if (selectedTargetId !== null && acceptedCastCount > 0) {
        return fireRetirementReceipt({
          acceptedCastCount,
          acceptedTick,
          enemyCountBefore,
          enemyHealthBefore,
          frame: before,
          manaAfter,
          manaBefore,
          selectedSkillIds,
          targetId: selectedTargetId,
        })
      }
      if (!await approachNearestEnemy(page, before, navigation, 220)) {
        await page.waitForTimeout(50)
      }
      continue
    }
    if (target.lifeState === 'death' || target.currentHealth <= 0) {
      assert.notEqual(selectedTargetId, null, 'an uncommitted target cannot already be terminal')
      const retired = await waitForEnemyRetirement(
        page,
        selectedTargetId,
        deadline,
        navigation,
        selectedSkillIds,
      )
      return fireRetirementReceipt({
        acceptedCastCount,
        acceptedTick,
        enemyCountBefore,
        enemyHealthBefore,
        frame: retired,
        manaAfter,
        manaBefore,
        selectedSkillIds,
        targetId: selectedTargetId,
      })
    }

    const distance = enemyDistance(before, target)
    const recovering = before.tick < fireCastDriver.nextReadyTick
    const waitingForMana = before.localPlayerMana + Number.EPSILON
      < PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire
    if (recovering || waitingForMana) {
      await evadeEnemyPack(page, before, navigation, 220)
      continue
    }
    if (!visibleLivingEnemy(before, target) || distance > FIRE_ENGAGEMENT_MAX_DISTANCE) {
      const nearest = nearestLivingEnemy(before)
      if (nearest && enemyDistance(before, nearest) < FIRE_ENGAGEMENT_MAX_DISTANCE) {
        await evadeEnemyPack(page, before, navigation, 220)
      } else {
        await page.waitForTimeout(100)
      }
      continue
    }

    await drainPendingSkillOffers(page, selectedSkillIds)
    before = await boneyardFrame(page)
    target = selectedTargetId === null
      ? nearestFireTarget(before, navigation)
      : enemyById(before, selectedTargetId)
    if (
      !target
      || !visibleLivingEnemy(before, target)
      || !firePathReachesTarget(navigation, before, target)
    ) continue
    const refreshedDistance = enemyDistance(before, target)
    if (
      before.localPlayerMana + Number.EPSILON < PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire
      || before.tick < fireCastDriver.nextReadyTick
      || refreshedDistance > FIRE_ENGAGEMENT_MAX_DISTANCE
    ) continue

    const castEnemyStates = new Map(before.enemySamples
      .filter((enemy) => enemy.lifeState !== 'death' && enemy.currentHealth > 0)
      .map((enemy) => [enemy.id, {
        currentHealth: enemy.currentHealth,
        lifeState: enemy.lifeState,
      }]))
    const targetPoint = await enemyScreenPoint(canvas, before, target)
    lastAimedTargetId = target.id
    await page.bringToFront()
    await page.mouse.move(targetPoint.x, targetPoint.y)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(35)
    await page.mouse.up({ button: 'left' })

    const acceptanceDeadline = Math.min(deadline, Date.now() + 3_000)
    let accepted = null
    let lastAcceptanceEvasionAt = Date.now()
    while (Date.now() < acceptanceDeadline) {
      await drainPendingSkillOffers(page, selectedSkillIds)
      const frame = await boneyardFrame(page)
      if (frame.localPlayerMana < before.localPlayerMana) {
        accepted = frame
        break
      }
      if (firstDamagedEnemy(frame, castEnemyStates)) {
        // A point-blank Fire projectile can damage and retire between rendered mana samples.
        // In this single-player smoke, that post-click contact is the acceptance witness.
        accepted = frame
        break
      }
      if (Date.now() - lastAcceptanceEvasionAt >= 250) {
        await evadeEnemyPack(page, frame, navigation, 180)
        lastAcceptanceEvasionAt = Date.now()
      } else {
        await page.waitForTimeout(25)
      }
    }
    if (!accepted) continue

    acceptedCastCount += 1
    acceptedTick ??= accepted.tick
    fireCastDriver.nextReadyTick = accepted.tick + PRIMARY_CAST_ACTION_END_TICK
    enemyCountBefore ??= before.enemyCount
    manaBefore ??= before.localPlayerMana
    manaAfter = accepted.localPlayerMana

    const contactDeadline = Math.min(deadline, Date.now() + 5_000)
    let contacted = false
    let lastContactEvasionAt = Date.now()
    let frame = accepted
    while (Date.now() < contactDeadline) {
      await drainPendingSkillOffers(page, selectedSkillIds)
      const contact = firstDamagedEnemy(frame, castEnemyStates)
      if (contact) {
        selectedTargetId = contact.id
        enemyHealthBefore = contact.previous.currentHealth
      }
      if (contact && !contact.current) {
        return fireRetirementReceipt({
          acceptedCastCount,
          acceptedTick,
          enemyCountBefore,
          enemyHealthBefore,
          frame,
          manaAfter,
          manaBefore,
          selectedSkillIds,
          targetId: selectedTargetId,
        })
      }
      if (contact) contacted = true
      if (contact?.current && (
        contact.current.lifeState === 'death'
        || contact.current.currentHealth <= 0
      )) {
        const retired = await waitForEnemyRetirement(
          page,
          selectedTargetId,
          deadline,
          navigation,
          selectedSkillIds,
        )
        return fireRetirementReceipt({
          acceptedCastCount,
          acceptedTick,
          enemyCountBefore,
          enemyHealthBefore,
          frame: retired,
          manaAfter,
          manaBefore,
          selectedSkillIds,
          targetId: selectedTargetId,
        })
      }
      if (contacted) break
      if (Date.now() - lastContactEvasionAt >= 250) {
        await evadeEnemyPack(page, frame, navigation, 180)
        lastContactEvasionAt = Date.now()
      } else {
        await page.waitForTimeout(25)
      }
      frame = await boneyardFrame(page)
    }
    if (!contacted) {
      await evadeEnemyPack(page, await boneyardFrame(page), navigation, 220)
    }
  }

  throw new Error(`Fire combat did not retire its selected enemy: ${JSON.stringify({
    acceptedCastCount,
    aimedTargetId: lastAimedTargetId,
    contactedTargetId: selectedTargetId,
    frame: await boneyardFrame(page),
    selectedSkillIds,
  })}`)
}

async function waitForEnemyRetirement(
  page,
  targetId,
  deadline,
  navigation,
  selectedSkillIds,
) {
  while (Date.now() < deadline) {
    await drainPendingSkillOffers(page, selectedSkillIds)
    const frame = await boneyardFrame(page)
    if (!enemyById(frame, targetId)) return frame
    assert.equal(frame.localPlayerLifeState, 'alive', 'player died before the enemy retired')
    await evadeEnemyPack(page, frame, navigation, 220)
  }
  throw new Error(`enemy ${targetId} did not retire before the combat deadline`)
}

function fireRetirementReceipt({
  acceptedCastCount,
  acceptedTick,
  enemyCountBefore,
  enemyHealthBefore,
  frame,
  manaAfter,
  manaBefore,
  selectedSkillIds,
  targetId,
}) {
  assert.ok(acceptedCastCount > 0, `enemy ${targetId} retired without an accepted Fire cast`)
  return {
    acceptedCastCount,
    acceptedTick,
    attempt: acceptedCastCount,
    enemyCountAfter: frame.enemyCount,
    enemyCountBefore,
    enemyHealthAfter: null,
    enemyHealthBefore,
    enemyLifeState: 'retired',
    manaAfter,
    manaBefore,
    playerHealthAfter: frame.localPlayerHealth,
    selectedSkillIds: [...selectedSkillIds],
    targetId,
  }
}

function enemyById(frame, targetId) {
  return frame.enemySamples.find((enemy) => enemy.id === targetId) ?? null
}

function firstDamagedEnemy(frame, previousById) {
  for (const [id, previous] of previousById) {
    const current = enemyById(frame, id)
    if (
      !current
      || current.currentHealth < previous.currentHealth
      || (current.lifeState === 'death' && previous.lifeState !== 'death')
    ) return { current, id, previous }
  }
  return null
}

function enemyDistance(frame, enemy) {
  return Math.hypot(enemy.x - frame.playerX, enemy.y - frame.playerY)
}

async function evadeEnemyPack(page, frame, navigation, durationMs) {
  const direction = safestCombatDirection(frame, navigation)
  if (!direction) return false
  await pulseMovement(page, movementKeys(direction), durationMs)
  return true
}

async function approachNearestEnemy(page, frame, navigation, durationMs) {
  const direction = nearestEnemyApproachDirection(frame, navigation)
  if (!direction) return false
  await pulseMovement(page, movementKeys(direction), durationMs)
  return true
}

function nearestEnemyApproachDirection(frame, navigation) {
  if (!combatInteriorContains(
    navigation,
    { x: frame.playerX, y: frame.playerY },
    COMBAT_ENTRY_GATE_MARGIN,
  )) {
    return { x: 0, y: navigation.entryGate.direction }
  }
  const nearest = nearestLivingEnemy(frame)
  if (!nearest) return null
  const start = { x: frame.playerX, y: frame.playerY }
  const route = planEnemyApproachPath(
    navigation,
    start,
    { x: nearest.x, y: nearest.y },
  )
  const waypoint = route[1]
  return waypoint ? {
    x: waypoint.x - start.x,
    y: waypoint.y - start.y,
  } : null
}

function safestCombatDirection(frame, navigation) {
  const enemies = frame.enemySamples.filter((enemy) => enemy.lifeState !== 'death')
  if (enemies.length === 0) return null
  const start = { x: frame.playerX, y: frame.playerY }
  if (!combatInteriorContains(navigation, start, COMBAT_ENTRY_GATE_MARGIN)) {
    return { x: 0, y: navigation.entryGate.direction }
  }
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
      if (!combatInteriorContains(navigation, end, COMBAT_ENTRY_GATE_MARGIN)) continue
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

async function waitForPlayerDeath(page) {
  const first = await boneyardFrame(page)
  const actions = new Set()
  const healthSamples = [first.localPlayerHealth]
  let lastApproachAt = 0
  const deadline = Date.now() + 240_000

  while (Date.now() < deadline) {
    const frame = await boneyardFrame(page)
    healthSamples.push(frame.localPlayerHealth)
    for (const enemy of frame.enemySamples) {
      if (enemy.action) actions.add(enemy.action)
    }
    if (frame.runPhase === 'game-over' && frame.localPlayerDeathTick >= 153) {
      assert.equal(Math.min(...healthSamples), 0)
      const probedActions = await page.evaluate(() => window.__sdrEnemyActionSamples ?? [])
      for (const action of probedActions) actions.add(action)
      assert.ok(actions.size > 0, 'expected an enemy attack animation before player death')
      return {
        actions: [...actions],
        deathTick: frame.localPlayerDeathTick,
        finalHealth: frame.localPlayerHealth,
        lifeState: frame.localPlayerLifeState,
        runGameOverTicks: frame.runGameOverTicks,
        runId: frame.runId,
        startHealth: first.localPlayerHealth,
      }
    }
    if (
      frame.localPlayerLifeState === 'alive'
      && Date.now() - lastApproachAt >= 2_000
    ) {
      const target = nearestLivingEnemy(frame)
      if (target) {
        await pulseMovement(page, movementKeys({
          x: target.x - frame.playerX,
          y: target.y - frame.playerY,
        }), 180)
      } else {
        await page.waitForTimeout(180)
      }
      lastApproachAt = Date.now()
    } else {
      await page.waitForTimeout(100)
    }
  }
  throw new Error(`player did not reach terminal death: ${JSON.stringify(await boneyardFrame(page))}`)
}

async function installEnemyActionProbe(page) {
  await page.evaluate(() => {
    const samples = []
    const headFacingSamples = []
    const origins = new Map()
    const movedIds = []
    Object.defineProperty(window, '__sdrEnemyActionSamples', {
      configurable: true,
      value: samples,
    })
    Object.defineProperty(window, '__sdrEnemyMovedIds', {
      configurable: true,
      value: movedIds,
    })
    Object.defineProperty(window, '__sdrEnemyHeadFacingSamples', {
      configurable: true,
      value: headFacingSamples,
    })
    const observe = () => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      for (const enemy of frame?.enemySamples ?? []) {
        if (enemy.action && !samples.includes(enemy.action)) samples.push(enemy.action)
        if (
          enemy.action
          && enemy.headFacingOffset !== 0
          && !headFacingSamples.some((sample) => (
            sample.id === enemy.id
            && sample.action === enemy.action
            && sample.headFacingOffset === enemy.headFacingOffset
          ))
        ) {
          headFacingSamples.push({
            action: enemy.action,
            headFacingOffset: enemy.headFacingOffset,
            id: enemy.id,
          })
        }
        const origin = origins.get(enemy.id)
        if (!origin) {
          origins.set(enemy.id, { x: enemy.x, y: enemy.y })
        } else if (
          !movedIds.includes(enemy.id)
          && Math.hypot(enemy.x - origin.x, enemy.y - origin.y) > 2
        ) {
          movedIds.push(enemy.id)
        }
      }
      if (document.querySelector('.boneyard-world-canvas')) requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  })
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

function nearestFireTarget(frame, navigation) {
  return frame.enemySamples
    .filter((enemy) => {
      return visibleLivingEnemy(frame, enemy)
        && enemyDistance(frame, enemy) <= FIRE_ENGAGEMENT_MAX_DISTANCE
        && firePathReachesTarget(navigation, frame, enemy)
    })
    .toSorted((left, right) => (
      enemyDistance(frame, left) - enemyDistance(frame, right)
      || left.id - right.id
    ))[0] ?? null
}

function firePathReachesTarget(navigation, origin, target) {
  const start = { x: origin.playerX ?? origin.x, y: origin.playerY ?? origin.y }
  const end = { x: target.x, y: target.y }
  if (
    !combatInteriorContains(navigation, start)
    || !combatInteriorContains(navigation, end)
  ) return false
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  if (distance === 0) return true
  const worldProgress = firstBoneyardPathBlockProgress(
    start,
    end,
    navigation.bounds,
    navigation.collision,
    PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  )
  const conservativeActorEntry = Math.max(
    0,
    1 - (
      PRIMARY_SPELL_FIRE_COLLISION_RADIUS + MINIMUM_SKELETON_COLLISION_RADIUS
    ) / distance,
  )
  return worldProgress === null || worldProgress - conservativeActorEntry > 1e-9
}

function combatInteriorContains(navigation, point, margin = 0) {
  const gate = navigation.entryGate
  return !gate || (point.y - gate.y) * gate.direction >= margin
}

function visibleLivingEnemy(frame, enemy) {
  if (enemy.lifeState === 'death') return false
  const x = frame.playerScreenX + (enemy.x - frame.playerX) * 1.35
  const y = frame.playerScreenY + (enemy.y - frame.playerY) * 1.35
  return x >= 30 && x <= 1_570 && y >= 30 && y <= 870
}

async function enemyScreenPoint(canvas, frame, enemy) {
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the Boneyard canvas to have bounds')
  const logicalX = frame.playerScreenX + (enemy.x - frame.playerX) * 1.35
  const logicalY = frame.playerScreenY + (enemy.y - frame.playerY) * 1.35
  return {
    x: bounds.x + logicalX / 1_600 * bounds.width,
    y: bounds.y + logicalY / 900 * bounds.height,
  }
}

async function boneyardFrame(page) {
  return page.locator('.boneyard-world-canvas').evaluate((node) => (
    structuredClone(node.__sdrBoneyardFrame)
  ))
}

async function boneyardSurfaceReceipt(page, scene) {
  const receipt = await page.locator('.boneyard-world-canvas').evaluate((node) => ({
    activeRoadMeshCount: Number(node.dataset.roadActiveMeshCount),
    arenaBaseRenderer: node.dataset.arenaBaseRenderer,
    arenaGroundRenderer: node.dataset.arenaGroundRenderer,
    roadIndexCount: Number(node.dataset.roadIndexCount),
    roadMeshCount: Number(node.dataset.roadMeshCount),
    roadRenderer: node.dataset.roadRenderer,
    roadVertexCount: Number(node.dataset.roadVertexCount),
  }))
  assert.equal(receipt.arenaBaseRenderer, 'retail-editor-field-capture+native-road-layout')
  assert.equal(receipt.arenaGroundRenderer, 'retail-editor-field-capture-web-override')
  assert.equal(receipt.roadRenderer, 'native-indexed-owner-mesh')
  assert.equal(receipt.roadMeshCount, scene.roads.length)
  assert.equal(receipt.roadVertexCount, scene.roads.length * 8)
  assert.equal(receipt.roadIndexCount, scene.roads.length * 18)
  assert.ok(receipt.activeRoadMeshCount > 0 && receipt.activeRoadMeshCount <= scene.roads.length)
  assert.ok(scene.roads.every((road) => (
    Number.isInteger(road.linkMask) && road.linkMask >= 0 && road.linkMask <= 3
  )))
  return receipt
}

async function waitForRenderedDeathSequence(page) {
  await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.playerDeathFrame === 3
      && frame.playerDeathFrameSamples?.[0]?.frame === 0
  }, undefined, { timeout: 30_000 })
  const frame = await boneyardFrame(page)
  const samples = frame.playerDeathFrameSamples
  const renderedFrames = samples.map((sample) => sample.frame)
  assert.equal(renderedFrames[0], 0)
  assert.equal(renderedFrames.at(-1), 3)
  assert.ok(renderedFrames.every((value, index) => (
    index === 0 || value > renderedFrames[index - 1]
  )))
  for (const sample of samples) {
    assert.equal(sample.colorLayerCount, 9)
    assert.equal(sample.shadowLayerCount, sample.frame === 3 ? 9 : 0)
    if (sample.frame === 0) assert.ok(sample.deathTick >= 0 && sample.deathTick <= 152)
    if (sample.frame === 1) assert.ok(sample.deathTick >= 153 && sample.deathTick <= 155)
    if (sample.frame === 2) assert.ok(sample.deathTick >= 156 && sample.deathTick <= 158)
    if (sample.frame === 3) assert.ok(sample.deathTick >= 159)
  }
  return {
    currentColorLayerCount: frame.playerDeathColorLayerCount,
    currentFrame: frame.playerDeathFrame,
    currentShadowLayerCount: frame.playerDeathShadowLayerCount,
    samples,
  }
}

async function proveRetiredEntry(
  page,
  scene,
  wire,
  runId,
  gateCrossing,
  initialResidentCount,
  cleanupScreenshotPath,
) {
  const snapshot = currentBoneyardSnapshot(wire, runId)
  assert.ok(snapshot, 'expected the authoritative Boneyard snapshot')
  const transition = snapshot.world.arenaTransition
  assert.ok(transition, 'expected generated-arena transition ownership')
  assert.notEqual(transition.phase, 'open')
  assert.deepEqual(wire.outsideCombatEnemySamples, [])

  await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    const frame = canvas?.__sdrBoneyardFrame
    return frame?.arenaTransitionPhase === 'sealed'
      && frame.offCameraCleanupApplied === true
      && canvas?.getAttribute('data-static-off-camera-cleanup') === 'applied'
  }, undefined, { timeout: 15_000 })
  const cleanupFrame = await boneyardFrame(page)
  assert.equal(cleanupFrame.offCameraCleanupApplied, true)
  assert.ok(cleanupFrame.retiredStaticSourceCount > 0)
  assert.ok(cleanupFrame.retiredStaticResidentCount > 0)
  assert.ok(cleanupFrame.residentCount < initialResidentCount)
  assert.equal(
    cleanupFrame.visibleResidentCount + cleanupFrame.culledResidentCount,
    cleanupFrame.residentCount,
  )
  assert.equal(cleanupFrame.gateLeafCount, 2)
  await page.screenshot({ path: cleanupScreenshotPath })

  const boundaryY = gateCrossing.direction > 0
    ? transition.combatBounds.y + PLAYER_CHARACTER_RADIUS
    : transition.combatBounds.y + transition.combatBounds.h - PLAYER_CHARACTER_RADIUS
  const beforeY = Number(await scene.getAttribute('data-local-player-y'))
  const returnKey = gateCrossing.direction > 0 ? 'w' : 's'
  await page.bringToFront()
  await page.keyboard.down(returnKey)
  try {
    const deadline = Date.now() + 2_000
    let priorY = beforeY
    let stableSamples = 0
    while (Date.now() < deadline && stableSamples < 12) {
      await page.waitForTimeout(100)
      const currentY = Number(await scene.getAttribute('data-local-player-y'))
      const atBoundary = Math.abs(currentY - boundaryY) <= 1
      stableSamples = atBoundary && Math.abs(currentY - priorY) < 0.05
        ? stableSamples + 1
        : 0
      priorY = currentY
    }
  } finally {
    await page.keyboard.up(returnKey)
    await publishStoppedMovement(page)
  }

  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  const returnProgress = (beforeY - finalY) * gateCrossing.direction
  assert.ok(
    (finalY - boundaryY) * gateCrossing.direction >= -0.5,
    `player crossed retired boundary ${boundaryY}: ${finalY}`,
  )
  assert.ok(
    (finalY - gateCrossing.target.y) * gateCrossing.direction > 0,
    `player regained retired entry Gate ${gateCrossing.target.y}: ${finalY}`,
  )
  const availableReturnProgress = Math.abs(beforeY - boundaryY)
  assert.ok(
    returnProgress >= Math.min(25, Math.max(0, availableReturnProgress - 1)),
    `player did not advance toward retired entry: ${returnProgress}/${availableReturnProgress}`,
  )
  assert.deepEqual(wire.outsideCombatEnemySamples, [])
  const frame = await boneyardFrame(page)
  assert.equal(frame.localPlayerLifeState, 'alive')
  assert.ok(
    frame.arenaTransitionPhase === 'locking' || frame.arenaTransitionPhase === 'sealed',
  )
  assert.equal(frame.enemyOutsideCombatBoundsCount, 0)
  return {
    beforeY,
    boundaryY,
    cameraX: frame.cameraX,
    cameraY: frame.cameraY,
    finalY,
    phase: frame.arenaTransitionPhase,
    reachedBoundary: Math.abs(finalY - boundaryY) <= 2,
    residentCountAfter: frame.residentCount,
    residentCountBefore: initialResidentCount,
    retiredStaticResidentCount: frame.retiredStaticResidentCount,
    retiredStaticSourceCount: frame.retiredStaticSourceCount,
    returnProgress,
    sampledEnemyCount: snapshot.world.enemies.length,
  }
}

async function enterBoneyard(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeOffice(page)
  await page.getByRole('button', { name: chillArrowOnly ? /water/i : /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 30_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen').waitFor({
    state: 'detached',
    timeout: 90_000,
  })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.getAttribute('data-hub-region') === 'courtyard'
      && canvas?.getAttribute('data-transition-phase') === 'none'
  }, undefined, { timeout: 30_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 90_000 })
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.runPhase === 'active'
      && scene?.getAttribute('data-solomon-phase') === 'digging'
  }, undefined, { timeout: 90_000 })
}

async function restoreBoneyardDeathEffects(page, runId) {
  await page.locator('.boneyard-scene').focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10_000 })
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  const lastGame = page.getByRole('button', { name: 'Last game' })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 90_000 })
  await page.waitForFunction((expectedRunId) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.runId === expectedRunId && frame.enemyDeathEffectCount > 0
  }, runId, { timeout: 30_000 })
  const frame = await boneyardFrame(page)
  assert.equal(frame.runId, runId)
  assert.ok(frame.enemyDeathEffectCount > 0)
  return frame
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

async function crossNearestEntryGate(page, scene, boneyardScene) {
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
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
    page,
    scene,
    boneyardScene,
    approachTarget,
    90_000,
    30,
  )
  const direction = Math.sign(target.y - aligned.y)
  assert.notEqual(direction, 0, 'expected the entry gate to be beyond the player')
  const crossingDistance = Math.abs(target.y - aligned.y) + 35
  await holdUntil(page, direction < 0 ? 'w' : 's', () => (
    scene.getAttribute('data-local-player-y').then((value) => (
      (Number(value) - aligned.y) * direction > crossingDistance
    ))
  ), 15_000)
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  const finalGateState = await scene.getAttribute('data-gate-state')
  assert.ok((finalY - aligned.y) * direction > crossingDistance)
  assert.notEqual(finalGateState, initialGateState)
  return { aligned, direction, finalY, initialX, initialY, target }
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
    await pulseMovement(page, movementKeys({
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
  const initial = await approachReceipt(scene)
  const solomon = { x: initial.solomonX, y: initial.solomonY }
  let route = planSolomonPath(
    boneyardScene,
    { x: initial.playerX, y: initial.playerY },
    solomon,
  )
  const routeNodes = route.length

  while (Date.now() - startedAt < 240_000) {
    const before = await approachReceipt(scene)
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
        const held = await approachReceipt(scene)
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

async function walkNearSolomon(page, scene, boneyardScene) {
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  const initial = await approachReceipt(scene)
  const solomon = { x: initial.solomonX, y: initial.solomonY }
  assert.ok(initial.distance > 275, 'expected the entry path to begin outside near-Dig range')
  while (Date.now() - startedAt < 240_000) {
    const before = await approachReceipt(scene)
    assert.equal(before.phase, 'digging')
    if (before.distance <= 275) {
      return { x: before.playerX, y: before.playerY, distance: before.distance }
    }
    const route = planSolomonPath(
      boneyardScene,
      { x: before.playerX, y: before.playerY },
      solomon,
    )
    const waypoint = route[1]
    assert.ok(waypoint, 'expected a collision-safe near-Dig waypoint')
    await driveToNearSolomonWaypoint(page, scene, waypoint)
  }
  throw new Error(`could not reach near-Dig audio range: ${JSON.stringify(
    await approachReceipt(scene),
  )}`)
}

async function driveToNearSolomonWaypoint(page, scene, waypoint) {
  const initial = await approachReceipt(scene)
  const keys = movementKeys({
    x: waypoint.x - initial.playerX,
    y: waypoint.y - initial.playerY,
  })
  assert.ok(keys.length > 0, 'expected movement keys for the near-Dig waypoint')
  const deadline = Date.now() + 1_500
  for (const key of keys) await page.keyboard.down(key)
  try {
    while (Date.now() < deadline) {
      const current = await approachReceipt(scene)
      if (current.phase !== 'digging' || current.distance <= 260) break
      if (Math.hypot(
        waypoint.x - current.playerX,
        waypoint.y - current.playerY,
      ) <= 16) break
      await page.waitForTimeout(25)
    }
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
  await page.waitForTimeout(650)
}

async function driveToSolomonWaypoint(page, scene, waypoint) {
  const initial = await approachReceipt(scene)
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
      const current = await approachReceipt(scene)
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

function planEnemyApproachPath(navigation, start, target) {
  return simplifyBoneyardPath(
    planBoneyardPath(
      navigation.scene,
      start,
      target,
      (point) => (
        Math.hypot(target.x - point.x, target.y - point.y)
          <= FIRE_ENGAGEMENT_MAX_DISTANCE
          && firePathReachesTarget(navigation, point, target)
          ? []
          : null
      ),
      `Fire engagement with ${JSON.stringify(target)}`,
      navigation.collision,
    ),
    navigation.bounds,
    navigation.collision,
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

async function pulseMovement(page, keys, durationMs) {
  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    await page.waitForTimeout(durationMs)
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
}

async function publishStoppedMovement(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
    return new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

function movementKeys({ x, y }) {
  const keys = []
  const scale = Math.max(Math.abs(x), Math.abs(y), 1)
  if (Math.abs(x) / scale >= 0.25) keys.push(x > 0 ? 'd' : 'a')
  if (Math.abs(y) / scale >= 0.25) keys.push(y > 0 ? 's' : 'w')
  return keys
}

async function approachReceipt(scene) {
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

async function encounterReceipt(scene) {
  return scene.evaluate((node) => ({
    combatEnabled: node.getAttribute('data-combat-enabled') === 'true',
    heading: Number(node.getAttribute('data-solomon-heading')),
    liveEnemies: Number(node.getAttribute('data-wave-live-enemy-count')),
    mouthPose: Number(node.getAttribute('data-solomon-mouth-pose')),
    pendingSpawnBudget: Number(node.getAttribute('data-wave-pending-spawn-budget')),
    phase: node.getAttribute('data-solomon-phase'),
    renderFrame: Number(document.querySelector('.boneyard-dig-anchor')
      ?.getAttribute('data-frame')),
    runEventId: Number(node.getAttribute('data-solomon-run-event-id')),
    solomonX: Number(node.getAttribute('data-solomon-x')),
    solomonY: Number(node.getAttribute('data-solomon-y')),
    voiceCue: node.getAttribute('data-solomon-voice-cue'),
    voiceEventId: Number(node.getAttribute('data-solomon-voice-event-id')),
    waveOrdinal: Number(node.getAttribute('data-wave-ordinal')),
    wavePhase: node.getAttribute('data-wave-phase'),
    waveScheduleIndex: Number(node.getAttribute('data-wave-schedule-index')),
    waveSlumpgutPhase: node.getAttribute('data-wave-slumpgut-phase'),
    waveSlumpgutTicksRemaining: Number(
      node.getAttribute('data-wave-slumpgut-ticks-remaining'),
    ),
    waveSpawnDelayTicks: Number(node.getAttribute('data-wave-spawn-delay-ticks')),
  }))
}

async function provePreludeCombatSealed(page, scene, expectedPhase) {
  const beforeScene = await encounterReceipt(scene)
  assert.equal(beforeScene.phase, expectedPhase)
  assert.equal(beforeScene.combatEnabled, false)
  const before = hostCombatAdmissionReceipt()
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  const bounds = await canvas.boundingBox()
  const frame = await boneyardFrame(page)
  assert.ok(bounds)
  assert.ok(Number.isFinite(frame.playerScreenX) && Number.isFinite(frame.playerScreenY))
  const aim = {
    x: bounds.x + Math.max(1, Math.min(bounds.width - 1, frame.playerScreenX)),
    y: bounds.y + Math.max(1, Math.min(bounds.height - 1, frame.playerScreenY - 120)),
  }

  await page.mouse.move(aim.x, aim.y)
  await page.mouse.down({ button: 'right' })
  await page.waitForTimeout(35)
  await page.mouse.up({ button: 'right' })
  await waitForHostTick(page, before.tick + 80)

  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(35)
  await page.mouse.up({ button: 'left' })
  await waitForHostTick(page, before.tick + 110)

  const after = hostCombatAdmissionReceipt()
  assert.equal(after.mana, before.mana)
  assert.equal(after.primaryCastSequence, before.primaryCastSequence)
  assert.equal(after.primarySpellCount, before.primarySpellCount)
  assert.equal(after.secondaryActorCount, before.secondaryActorCount)
  assert.equal(after.secondaryCastSequence, before.secondaryCastSequence)
  assert.equal(after.secondaryEventCount, before.secondaryEventCount)
  assert.equal((await encounterReceipt(scene)).combatEnabled, false)
  return { after, before, phase: expectedPhase }
}

async function proveRunCombatAdmitted(page, scene) {
  assert.equal((await encounterReceipt(scene)).combatEnabled, true)
  const before = hostCombatAdmissionReceipt()
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  const bounds = await canvas.boundingBox()
  const frame = await boneyardFrame(page)
  assert.ok(bounds)
  const aim = {
    x: bounds.x + Math.max(1, Math.min(bounds.width - 1, frame.playerScreenX)),
    y: bounds.y + Math.max(1, Math.min(bounds.height - 1, frame.playerScreenY - 120)),
  }
  await page.mouse.move(aim.x, aim.y)
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(35)
  await page.mouse.up({ button: 'left' })
  await waitForHostTick(page, before.tick + 30)
  const after = hostCombatAdmissionReceipt()
  assert.equal(after.primaryCastSequence, before.primaryCastSequence + 1)
  assert.ok(after.mana < before.mana)
  return { after, before }
}

function hostCombatAdmissionReceipt() {
  const state = host.state()
  const identity = state.playerEntities.identities[0]
  assert.ok(identity)
  const index = state.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === identity.playerId
  ))
  const secondary = state.secondaryAbilities.players[identity.playerId]
  return {
    mana: state.playerEntities.progressions[index].currentMana,
    primaryCastSequence: state.playerEntities.primaryCasts[index].castSequence,
    primarySpellCount: state.primarySpells.projectiles.length + state.primarySpells.transients.length,
    secondaryActorCount: state.secondaryAbilities.actors.length,
    secondaryCastSequence: secondary?.castSequence ?? 0,
    secondaryEventCount: state.secondaryAbilities.events.length,
    tick: state.tick,
  }
}

async function waitForHostTick(page, targetTick) {
  const deadline = Date.now() + 5_000
  while (host.state().tick < targetTick && Date.now() < deadline) {
    await page.waitForTimeout(10)
  }
  assert.ok(host.state().tick >= targetTick, `host did not reach tick ${targetTick}`)
}

async function captureSolomonDigAudio(page) {
  await page.waitForFunction(() => {
    const sources = window.__sdrAudioPlaySources ?? []
    const matches = window.__sdrAudioSourceMatches
    return typeof matches === 'function'
      && sources.some((source) => (
        matches(source, 'shovel-1.wav') || matches(source, 'shovel-2.wav')
      ))
      && sources.some((source) => (
        matches(source, 'throw-dirt-1.wav') || matches(source, 'throw-dirt-2.wav')
      ))
  }, undefined, { timeout: 15_000 })
  const receipt = await page.evaluate(() => {
    const matches = window.__sdrAudioSourceMatches
    const files = [
      'shovel-1.wav',
      'shovel-2.wav',
      'throw-dirt-1.wav',
      'throw-dirt-2.wav',
    ]
    const events = window.__sdrAudioEvents.filter((event) => (
      event.type === 'buffer-start'
        && files.some((file) => matches(event.src, file))
    )).map((event) => ({
      playbackRate: event.playbackRate,
      source: files.find((file) => matches(event.src, file)),
      volume: event.volume,
    }))
    return {
      cue: document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-dig-audio-cue'),
      eventId: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-dig-audio-event-id')),
      events,
      gain: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-dig-audio-gain')),
      playbackRate: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-dig-audio-playback-rate')),
    }
  })
  assert.ok(receipt.events.some((event) => event.source?.startsWith('shovel-')))
  assert.ok(receipt.events.some((event) => event.source?.startsWith('throw-dirt-')))
  assert.ok(receipt.events.every((event) => event.playbackRate === 1))
  assert.ok(receipt.eventId >= 2)
  assert.match(receipt.cue, /^(?:shovel|throw-dirt)-[12]$/)
  assert.equal(receipt.playbackRate, 1)
  assert.ok(receipt.gain >= 0 && receipt.gain <= 1)
  return receipt
}

async function captureSolomonDirt(page, solomonPosition, capturePath) {
  await page.evaluate(() => {
    const receipt = {
      live: false,
      retired: false,
      samples: [],
    }
    window.__sdrSolomonDirtReceipt = receipt
    const sample = () => {
      const scene = document.querySelector('.boneyard-scene')
      if (!scene) return
      const count = Number(scene.getAttribute('data-solomon-dirt-count'))
      const passCount = Number(scene.getAttribute('data-solomon-dirt-pass-count'))
      if (count > 0) {
        receipt.live = true
        const current = {
          ageTicks: Number(scene.getAttribute('data-solomon-dirt-age-ticks')),
          alpha: Number(scene.getAttribute('data-solomon-dirt-alpha')),
          audioEventId: Number(scene.getAttribute('data-solomon-dig-audio-event-id')),
          count,
          eventId: Number(scene.getAttribute('data-solomon-dirt-event-id')),
          headingDegrees: Number(scene.getAttribute('data-solomon-dirt-heading')),
          passCount,
          x: Number(scene.getAttribute('data-solomon-dirt-x')),
          y: Number(scene.getAttribute('data-solomon-dirt-y')),
        }
        const prior = receipt.samples.at(-1)
        if (prior?.ageTicks !== current.ageTicks || prior?.eventId !== current.eventId) {
          receipt.samples.push(current)
        }
      } else if (receipt.live) {
        receipt.retired = true
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.waitForFunction(() => window.__sdrSolomonDirtReceipt?.live, undefined, {
    timeout: 15_000,
  })
  await page.screenshot({ path: capturePath })
  await page.waitForFunction(() => window.__sdrSolomonDirtReceipt?.retired, undefined, {
    timeout: 5_000,
  })
  const receipt = await page.evaluate(() => window.__sdrSolomonDirtReceipt)
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    const offset = Number(scene?.getAttribute('data-solomon-dig-body-offset-y'))
    return offset > 0.1 && offset <= 10
  }, undefined, { timeout: 15_000 })
  receipt.bodyOffsetY = Number(await page.locator('.boneyard-scene')
    .getAttribute('data-solomon-dig-body-offset-y'))
  assert.ok(receipt.samples.length >= 2, 'expected multiple fixed-age Flydirt samples')
  assert.ok(receipt.bodyOffsetY > 0.1 && receipt.bodyOffsetY <= 10)
  assert.ok(receipt.samples.every((sample) => sample.count === 1))
  assert.ok(receipt.samples.every((sample) => sample.passCount === 2))
  assert.ok(receipt.samples.every((sample) => sample.audioEventId === sample.eventId))
  for (const sample of receipt.samples) {
    const expected = nativeSolomonDirtStateAt(solomonPosition, sample.ageTicks)
    assert.ok(expected, `unexpected retired Flydirt age ${sample.ageTicks}`)
    assert.equal(sample.alpha, expected.alpha)
    assert.equal(sample.headingDegrees, expected.headingDegrees)
    assert.equal(sample.x, expected.position.x)
    assert.equal(sample.y, expected.position.y)
  }
  assert.ok(receipt.samples.at(-1).alpha < receipt.samples[0].alpha)
  assert.ok(receipt.samples.at(-1).headingDegrees > receipt.samples[0].headingDegrees)
  assert.notDeepEqual(
    [receipt.samples.at(-1).x, receipt.samples.at(-1).y],
    [receipt.samples[0].x, receipt.samples[0].y],
  )
  return receipt
}

async function captureNearSolomonDigAudio(page, previousEventId, previousEventCount) {
  await page.waitForFunction(({ eventCount, eventId }) => {
    const scene = document.querySelector('.boneyard-scene')
    const files = [
      'shovel-1.wav',
      'shovel-2.wav',
      'throw-dirt-1.wav',
      'throw-dirt-2.wav',
    ]
    const matches = window.__sdrAudioSourceMatches
    const events = window.__sdrAudioEvents.filter((event) => (
      event.type === 'buffer-start'
        && files.some((file) => matches(event.src, file))
    ))
    return Number(scene?.getAttribute('data-solomon-dig-audio-event-id')) > eventId
      && events.length > eventCount
      && events.slice(eventCount).some((event) => event.volume > 0)
  }, {
    eventCount: previousEventCount,
    eventId: previousEventId,
  }, { timeout: 15_000 })
  const receipt = await page.evaluate((eventCount) => {
    const files = [
      'shovel-1.wav',
      'shovel-2.wav',
      'throw-dirt-1.wav',
      'throw-dirt-2.wav',
    ]
    const matches = window.__sdrAudioSourceMatches
    const events = window.__sdrAudioEvents.filter((event) => (
      event.type === 'buffer-start'
        && files.some((file) => matches(event.src, file))
    )).slice(eventCount).map((event) => ({
      playbackRate: event.playbackRate,
      source: files.find((file) => matches(event.src, file)),
      volume: event.volume,
    }))
    return {
      eventId: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-dig-audio-event-id')),
      events,
      gain: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-dig-audio-gain')),
    }
  }, previousEventCount)
  assert.ok(receipt.eventId > previousEventId)
  assert.ok(receipt.events.some((event) => event.volume > 0))
  assert.ok(receipt.events.every((event) => event.playbackRate === 1))
  assert.ok(receipt.gain > 0 && receipt.gain <= 1)
  return receipt
}

async function installSolomonSpeakingProbe(page) {
  await page.evaluate(() => {
    const scene = document.querySelector('.boneyard-scene')
    if (!scene) throw new Error('Solomon speaking probe requires the Boneyard scene')
    window.__sdrSolomonSpeakingReceipt = { animated: null, hello: null }
    const sample = () => {
      if (
        scene.getAttribute('data-solomon-phase') !== 'speaking'
        || Number(scene.getAttribute('data-solomon-voice-event-id')) < 1
      ) return
      const current = {
        heading: Number(scene.getAttribute('data-solomon-heading')),
        mouthPose: Number(scene.getAttribute('data-solomon-mouth-pose')),
        phase: scene.getAttribute('data-solomon-phase'),
        renderFrame: Number(document.querySelector('.boneyard-dig-anchor')
          ?.getAttribute('data-frame')),
        voiceCue: scene.getAttribute('data-solomon-voice-cue'),
        voiceEventId: Number(scene.getAttribute('data-solomon-voice-event-id')),
      }
      window.__sdrSolomonSpeakingReceipt.hello ??= current
      if (
        current.mouthPose
          !== window.__sdrSolomonSpeakingReceipt.hello.mouthPose
      ) window.__sdrSolomonSpeakingReceipt.animated = current
    }
    const observer = new MutationObserver(sample)
    observer.observe(scene, {
      attributeFilter: [
        'data-solomon-heading',
        'data-solomon-mouth-pose',
        'data-solomon-phase',
        'data-solomon-voice-event-id',
      ],
      attributes: true,
    })
    sample()
  })
}

async function currentEncounterReceipt(page) {
  const scene = page.locator('.boneyard-scene')
  return await scene.count() === 0 ? null : encounterReceipt(scene)
}

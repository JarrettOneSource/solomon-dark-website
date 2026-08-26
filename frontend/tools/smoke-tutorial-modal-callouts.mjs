// Tutorial modal teaching-overlay journey.
//
// Restores the stock Tutorial save, opens the inventory at stage 9 (-> stage 10) and the skill
// book at stage 12 (-> stage 13) through the real key bindings, and proves that every callout
// frame, every text line and every pointer the browser paints lands where the recovered
// `Tutorial::Render` model (`0x005D08C0` -> `0x005C9C70` / `0x005C9BB0`, see
// docs/game-native-parity-re.md 2026-08-25) puts it, at several viewports. The backpack gate
// (first backpack cell empty) and the third-page concentration gate are exercised as well. The
// blinking pointers (stage-9 inventory, stage-12 skills, modal resume, stage-14 selected HUD) are
// sampled both hidden and visible on the never-paused application tick (`App+0x28`, 100 Hz,
// 20 hidden / 30 visible ticks) while the gameplay pause holds `stageTicks` still, and the
// steady modal pointers must never hide.
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'

import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import { insertLootInventoryItem } from '../src/game/core-kernels/hub-economy.ts'
import { nativeTutorialAmuletItem } from '../src/game/core-kernels/native-tutorial.ts'
import {
  grantPlayerEntitySkillRanks,
  replacePlayerEconomy,
  selectPlayerEntityConcentrationSlot,
} from '../src/game/core-server/player-entity-store.ts'
import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
  gameBindingLabel,
} from '../src/game/game-settings.ts'
import { materializeStockTutorial } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { NATIVE_HUD_BACKBUFFER } from '../src/game/native-hud-layout.ts'
import { nativeUiFont } from '../src/game/native-ui/native-ui-catalog.ts'
import { layoutNativeUiText } from '../src/game/native-ui/native-ui-text.ts'
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import {
  TUTORIAL_CALLOUT_FONT,
  tutorialModalTeachingPlans,
} from '../src/game/tutorial-modal-callouts.ts'

// Pointer selectors (hoisted above the top-level await so the scenario loop can see them).
const MODAL_RESUME_POINTER = '[data-tutorial-pointer="modal-resume"]'
const MODAL_STEADY_POINTERS = '[data-tutorial-pointer^="modal-"]:not([data-tutorial-pointer="modal-resume"])'
const SELECTED_HUD_POINTER = '[data-tutorial-pointer="selected-skills"]'

const screenshotRoot = process.env.SDR_TUTORIAL_MODAL_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-tutorial-modal-callouts'
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const allScenarios = [
  { hasTouch: false, isMobile: false, name: 'stock', viewport: { height: 900, width: 1_600 } },
  { hasTouch: false, isMobile: false, name: 'wide', viewport: { height: 1_080, width: 2_560 } },
  { hasTouch: false, isMobile: false, name: 'tall', viewport: { height: 1_000, width: 1_200 } },
  { hasTouch: true, isMobile: true, name: 'touch', viewport: { height: 414, width: 896 } },
]
const requestedScenario = process.env.SDR_TUTORIAL_MODAL_SCENARIO?.trim()
const scenarios = requestedScenario
  ? allScenarios.filter(({ name }) => name === requestedScenario)
  : allScenarios
assert.ok(scenarios.length > 0, `unknown Tutorial modal scenario: ${requestedScenario}`)
const INVENTORY_KEY = DEFAULT_GAME_SETTINGS.controls.openInventory
const SKILLS_KEY = DEFAULT_GAME_SETTINGS.controls.openSkills
const allowSettledOpening = process.env.SDR_TUTORIAL_MODAL_ALLOW_SETTLED_OPENING === '1'
const allowSparsePresentation = process.env.SDR_TUTORIAL_MODAL_ALLOW_SPARSE_PRESENTATION === '1'
const GLYPH_HALF_HEIGHT = nativeUiFont(TUTORIAL_CALLOUT_FONT).metrics[0] / 2
// NativeBitmapText renders mask glyphs (no text nodes), so callout lines are compared as the glyph
// code points produced by the same left-aligned layout the component runs.
const calloutGlyphs = (text) => layoutNativeUiText({
  font: TUTORIAL_CALLOUT_FONT,
  text,
  x: 0,
  y: GLYPH_HALF_HEIGHT,
}).glyphs.map(({ codePoint }) => codePoint)
const INTRO_CLEARED = {
  introActive: false,
  introBlend: 1,
  introDelayTicksRemaining: 0,
  introFade: 0,
  introMovementTicksRemaining: 0,
}
const EMPTY_CONTENT = {
  assets: [],
  boneyards: [],
  compiledMods: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] },
  modSources: [],
  summary: { manifestSha256: '0'.repeat(64), mods: [] },
}

const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const baseUrl = staticServer.origin
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  executablePath: chromePath,
  headless: true,
})

// Every scenario runs even after an earlier one fails so one run reports every viewport.
const failures = []
const receipts = []
try {
  for (const scenario of scenarios) {
    try {
      receipts.push(await runScenario(scenario))
    } catch (error) {
      failures.push({ error: error instanceof Error ? error.stack ?? error.message : String(error), scenario: scenario.name })
    }
  }
  process.stdout.write(`${JSON.stringify({ failures, receipts, status: failures.length === 0 ? 'ok' : 'failed' })}\n`)
  if (failures.length > 0) {
    for (const failure of failures) process.stderr.write(`[${failure.scenario}] ${failure.error}\n`)
    process.exitCode = 1
  }
} finally {
  await browser.close()
  await staticServer.close()
}

async function runScenario(scenario) {
  const credential = randomBytes(32).toString('base64url')
  let ticketAvailable = true
  const hostErrors = []
  const host = await startGameHost({
    allowedOrigins: [baseUrl],
    authentication: {
      kind: 'tickets',
      claim: candidate => {
        if (!ticketAvailable || candidate !== credential) return null
        ticketAvailable = false
        return { content: EMPTY_CONTENT, leaderboardUserId: 42 }
      },
    },
    log: entry => {
      if (entry.level === 'error') hostErrors.push(entry)
    },
    sessionKind: 'private-college',
    snapshotRate: 100,
  })
  const context = await browser.newContext({
    hasTouch: scenario.hasTouch,
    isMobile: scenario.isMobile,
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
    settings: { ...DEFAULT_GAME_SETTINGS, uiScalePercent: 100 },
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
  })
  await page.addInitScript(bypassStartupAudioPreload)
  const fixture = tutorialIntroSave()
  await seedLocalSave(page, fixture.record)
  const errors = { consoleErrors, failedResponses, hostErrors, pageErrors }
  const screenshots = {
    inventory: `${screenshotRoot}-${scenario.name}-inventory.png`,
    inventoryEmptyBackpack: `${screenshotRoot}-${scenario.name}-inventory-empty-backpack.png`,
    inventoryPrompt: `${screenshotRoot}-${scenario.name}-inventory-prompt.png`,
    skills: `${screenshotRoot}-${scenario.name}-skills.png`,
    skillsPrompt: `${screenshotRoot}-${scenario.name}-skills-prompt.png`,
    skillsThreePages: `${screenshotRoot}-${scenario.name}-skills-three-pages.png`,
    selectedHud: `${screenshotRoot}-${scenario.name}-selected-hud.png`,
  }

  try {
    await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
    await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
    await page.getByRole('button', { name: 'Play' }).click()
    const lastGame = page.getByRole('button', { name: 'Last game' })
    assert.equal(await lastGame.isEnabled(), true)
    await lastGame.click()

    await waitForRestoredTutorial(host)
    await waitForBoneyardRenderer(page, errors)
    const playerId = host.state().playerEntities.identities[0].playerId
    grantTutorialAmulet(host, playerId)

    // Stage 10: the inventory modal with the starter potions in the first backpack cells.
    forceTutorialState(host, { ...INTRO_CLEARED, inventoryOpened: false, stage: 9, stageTicks: 0 })
    await page.locator('.tutorial-overlay[data-stage="9"]').waitFor({ timeout: 15_000 })
    await page.locator('[data-tutorial-pointer="inventory"]').waitFor({ timeout: 15_000 })
    const inventoryPointerBlink = await sampleBlink(page, '[data-tutorial-pointer="inventory"]')
    assertBlink(inventoryPointerBlink, `${scenario.name} stage-9 inventory pointer`)
    const inventoryPrompt = await measureResponsiveHudPointer(page, 'inventory', 62)
    assertResponsiveHudPointer(inventoryPrompt, -40, -40, `${scenario.name} stage-9 inventory pointer`)
    await screenshotInBlinkWindow(page, screenshots.inventoryPrompt, '[data-tutorial-pointer="inventory"]')
    if (scenario.hasTouch) await page.locator('.hub-hud-backpack-button').click()
    else await page.keyboard.press(INVENTORY_KEY)
    await waitForTutorialStage(host, page, 10)
    await page.locator('.tutorial-modal-callouts[data-stage="10"]').waitFor({ timeout: 15_000 })
    const inventoryOpeningMeasurement = await measureOpeningModal(page, 10, allowSettledOpening)
    const inventoryOpening = compareModal(
      inventoryOpeningMeasurement,
      expectedPlans(host.state(), playerId, 10, inventoryOpeningMeasurement.progress),
      `${scenario.name} inventory opening`,
    )
    await page.locator('canvas[data-native-reveal="settled"]').waitFor({ timeout: 30_000 })
    await screenshotInBlinkWindow(page, screenshots.inventory)
    const inventory = compareModal(
      await measureModal(page, 10),
      expectedPlans(host.state(), playerId, 10),
      `${scenario.name} inventory`,
    )
    assert.ok(inventory.members.includes('callout:backpack'), `${scenario.name} backpack lesson`)
    assert.ok(inventory.canvas, `${scenario.name} inventory canvas`)
    const backpackPointerLanding = await measurePaintedPointerLanding(
      page,
      '[data-tutorial-pointer="modal-backpack"]',
      '[data-inventory-owner="backpack"][aria-label^="Sorceror\'s Amulet,"]',
    )
    assert.ok(backpackPointerLanding.insideX, `${scenario.name} backpack arrow x ${JSON.stringify(backpackPointerLanding)}`)
    assert.ok(
      Math.abs(backpackPointerLanding.tipY - backpackPointerLanding.targetTop)
        <= Math.max(2, backpackPointerLanding.targetHeight * 0.12),
      `${scenario.name} backpack arrow top edge ${JSON.stringify(backpackPointerLanding)}`,
    )
    const equipmentPointerLanding = await measurePaintedPointerLanding(
      page,
      '[data-tutorial-pointer="modal-equipment"]',
      '[data-equipment-slot="amulet"]',
    )
    assert.ok(
      equipmentPointerLanding.distanceToTarget <= equipmentPointerLanding.targetHeight * 0.4,
      `${scenario.name} amulet body arrow ${JSON.stringify(equipmentPointerLanding)}`,
    )
    const blink = await sampleBlink(page, MODAL_RESUME_POINTER, MODAL_STEADY_POINTERS)
    assertBlink(blink, `${scenario.name} stage-10 resume pointer`)
    assert.equal(blink.steadyHidden, 0, `${scenario.name} steady pointers ${JSON.stringify(blink)}`)
    if (scenario.hasTouch) await page.locator('[data-inventory-resume="true"]').click()
    else await page.keyboard.press(INVENTORY_KEY)
    await waitForTutorialStage(host, page, 11)
    await page.locator('.tutorial-modal-callouts').waitFor({ state: 'detached', timeout: 15_000 })

    // Stage 10 again with an empty first backpack cell: the backpack lesson must vanish.
    clearBackpack(host, playerId)
    forceTutorialState(host, { ...INTRO_CLEARED, ...idleNarration(host), inventoryOpened: false, stage: 9, stageTicks: 0 })
    await page.locator('.tutorial-overlay[data-stage="9"]').waitFor({ timeout: 15_000 })
    if (scenario.hasTouch) await page.locator('.hub-hud-backpack-button').click()
    else await page.keyboard.press(INVENTORY_KEY)
    await waitForTutorialStage(host, page, 10)
    await page.locator('.tutorial-modal-callouts[data-stage="10"]').waitFor({ timeout: 15_000 })
    await page.locator('canvas[data-native-reveal="settled"]').waitFor({ timeout: 30_000 })
    await page.locator('[data-tutorial-callout="backpack"]').waitFor({ state: 'detached', timeout: 15_000 })
    await screenshotInBlinkWindow(page, screenshots.inventoryEmptyBackpack)
    const inventoryEmptyBackpack = compareModal(
      await measureModal(page, 10),
      expectedPlans(host.state(), playerId, 10),
      `${scenario.name} inventory (empty backpack)`,
    )
    assert.equal(inventoryEmptyBackpack.members.length, 6, `${scenario.name} empty backpack members`)
    if (scenario.hasTouch) await page.locator('[data-inventory-resume="true"]').click()
    else await page.keyboard.press(INVENTORY_KEY)
    await waitForTutorialStage(host, page, 11)
    await page.locator('.tutorial-modal-callouts').waitFor({ state: 'detached', timeout: 15_000 })

    // Stage 13: the skill book with the two starting pages (hover lesson, no concentration).
    forceTutorialState(host, { ...INTRO_CLEARED, ...idleNarration(host), skillsOpened: false, stage: 12, stageTicks: 0 })
    await page.locator('.tutorial-overlay[data-stage="12"]').waitFor({ timeout: 15_000 })
    await page.locator('[data-tutorial-pointer="skills"]').waitFor({ timeout: 15_000 })
    const skillsPointerBlink = await sampleBlink(page, '[data-tutorial-pointer="skills"]')
    assertBlink(skillsPointerBlink, `${scenario.name} stage-12 skills pointer`)
    const skillsPrompt = await measureResponsiveHudPointer(page, 'skills', 62)
    assertResponsiveHudPointer(skillsPrompt, 40, -40, `${scenario.name} stage-12 skills pointer`)
    await screenshotInBlinkWindow(page, screenshots.skillsPrompt, '[data-tutorial-pointer="skills"]')
    if (scenario.hasTouch) await page.locator('.hub-hud-tome-button').click()
    else await page.keyboard.press(SKILLS_KEY)
    await waitForTutorialStage(host, page, 13)
    await page.locator('.tutorial-modal-callouts[data-stage="13"]').waitFor({ timeout: 15_000 })
    const skillsOpeningMeasurement = await measureOpeningModal(page, 13, allowSettledOpening)
    const skillsOpening = compareModal(
      skillsOpeningMeasurement,
      expectedPlans(host.state(), playerId, 13, skillsOpeningMeasurement.progress),
      `${scenario.name} skills opening`,
    )
    await page.locator('.skill-book-renderer canvas').waitFor({ timeout: 30_000 })
    await page.locator('.skill-book-stage[data-transition-phase="settled"]').waitFor({ timeout: 15_000 })
    await screenshotInBlinkWindow(page, screenshots.skills)
    const skills = compareModal(
      await measureModal(page, 13),
      expectedPlans(host.state(), playerId, 13),
      `${scenario.name} skills`,
    )
    assert.deepEqual(
      skills.members,
      ['callout:resume', 'pointer:resume', 'callout:quick-use', 'pointer:quick-use', 'pointer:hover', 'callout:hover'],
      `${scenario.name} skill members`,
    )

    // A third root page appears: the concentration lesson must join at the third placement.
    // The open book holds a gameplay pause (`client-gameplay-pause`, source `skill-book`) and the
    // host only broadcasts on tick advance, so the page is granted while the world runs and the
    // book is re-opened from a forced stage 12 -- the way a client meets a three-page book.
    if (scenario.hasTouch) await page.locator('[data-skill-book-resume="true"]').click()
    else await page.keyboard.press(SKILLS_KEY)
    // Earlier forced stages leave their wave enemies alive, so `enemyCount > 2` can move 15 -> 14 on
    // the tick after the close; either stage proves the book closed into the wave.
    await waitForTutorialStage(host, page, [15, 14])
    await page.locator('.tutorial-modal-callouts').waitFor({ state: 'detached', timeout: 15_000 })
    grantThirdSkillPage(host, playerId)
    forceTutorialState(host, { ...INTRO_CLEARED, ...idleNarration(host), skillsOpened: false, stage: 12, stageTicks: 0 })
    await page.locator('.tutorial-overlay[data-stage="12"]').waitFor({ timeout: 15_000 })
    if (scenario.hasTouch) await page.locator('.hub-hud-tome-button').click()
    else await page.keyboard.press(SKILLS_KEY)
    await waitForTutorialStage(host, page, 13)
    await page.locator('.tutorial-modal-callouts[data-stage="13"]').waitFor({ timeout: 15_000 })
    await page.locator('.skill-book-renderer canvas').waitFor({ timeout: 30_000 })
    await page.locator('.skill-book-stage[data-transition-phase="settled"]').waitFor({ timeout: 15_000 })
    await page.locator('[data-tutorial-callout="concentration"]').waitFor({ timeout: 15_000 })
    await page.locator('[data-tutorial-callout="concentration-limit"]').waitFor({ timeout: 15_000 })
    await screenshotInBlinkWindow(page, screenshots.skillsThreePages)
    const skillsThreePages = compareModal(
      await measureModal(page, 13),
      expectedPlans(host.state(), playerId, 13),
      `${scenario.name} skills (three pages)`,
    )
    assert.equal(skillsThreePages.members.length, 9, `${scenario.name} three-page members`)
    const skillsBlink = await sampleBlink(page, MODAL_RESUME_POINTER, MODAL_STEADY_POINTERS)
    assertBlink(skillsBlink, `${scenario.name} stage-13 resume pointer`)
    assert.equal(skillsBlink.steadyHidden, 0, `${scenario.name} stage-13 steady pointers ${JSON.stringify(skillsBlink)}`)
    // Closing re-enters stage 15 and starts wave 4 again; with the first wave's enemies still
    // alive the 15 -> 14 transition (`enemyCount > 2`) can land on the next tick, so wait for the
    // modal to detach rather than for a stage-15 sample.
    if (scenario.hasTouch) await page.locator('[data-skill-book-resume="true"]').click()
    else await page.keyboard.press(SKILLS_KEY)
    await page.locator('.tutorial-modal-callouts').waitFor({ state: 'detached', timeout: 15_000 })

    // Stage 14: the selected-HUD lesson needs concentration A (the stock forced level-up
    // auto-concentrates row 65/67/60) and enters from stage 15 once wave 4 has more than two
    // enemies. Its pointer sits at c(primary) + (30, 50) under the HUD row, points up at the
    // primary/A midpoint, and blinks (`0x005D1D36..0x005D1DE9`, blink = 1).
    concentrateOnSkill(host, playerId, 65)
    await waitForEnemies(host, 3)
    await waitForTutorialStage(host, page, 14)
    const selectedHudPointer = page.locator(SELECTED_HUD_POINTER)
    await selectedHudPointer.waitFor({ timeout: 15_000 })
    const selectedHudGeometry = await measureSelectedHudLesson(page)
    assertSelectedHudLesson(selectedHudGeometry, `${scenario.name} stage-14 selected-HUD lesson`)
    const selectedHudBlink = await sampleBlink(page, SELECTED_HUD_POINTER)
    assertBlink(selectedHudBlink, `${scenario.name} stage-14 selected-HUD pointer`)
    await screenshotInBlinkWindow(page, screenshots.selectedHud, SELECTED_HUD_POINTER)

    await context.close()
    await waitForHostRetirement(host)
    assert.equal(host.loadedBoneyard(), null)
    assert.equal(host.state().world.kind, 'hub')
    assert.deepEqual(errors, {
      consoleErrors: [],
      failedResponses: [],
      hostErrors: [],
      pageErrors: [],
    })
    return {
      ...errors,
      blink,
      inventoryPointerBlink,
      inventoryPrompt,
      backpackPointerLanding,
      equipmentPointerLanding,
      selectedHudBlink,
      selectedHudGeometry,
      skillsBlink,
      skillsPointerBlink,
      skillsPrompt,
      fixtureSha256: fixture.record.sha256,
      inventory,
      inventoryEmptyBackpack,
      inventoryOpening,
      scenario: scenario.name,
      screenshots,
      skills,
      skillsOpening,
      skillsThreePages,
      viewport: scenario.viewport,
    }
  } catch (error) {
    // Keep a picture of the failing state so a symptom run still yields visual evidence.
    const path = `${screenshotRoot}-${scenario.name}-failure.png`
    let note = `failure screenshot: ${path}`
    try {
      await page.screenshot({ path })
    } catch (screenshotError) {
      note = `failure screenshot unavailable: ${screenshotError instanceof Error ? screenshotError.message : String(screenshotError)}`
    }
    throw new Error(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n${note}`)
  } finally {
    await context.close()
    await host.close()
  }
}

// The client plans from the replicated protocol player (`ProtocolPlayerProgression` carries
// `learnedSkills`/`learnedSkillOrder`; the sim-side component does not), so expectations are
// read from the same snapshot projection the host replicates.
function snapshotPlayer(state, playerId) {
  const player = createGameSnapshot(state, playerId).players[playerId]
  assert.ok(player, `snapshot player ${playerId}`)
  return player
}

function expectedPlans(state, playerId, stage, modalProgress = 1) {
  const player = snapshotPlayer(state, playerId)
  return tutorialModalTeachingPlans({
    backpack: player.economy.backpack,
    modalProgress,
    progression: player.progression,
    resumeBindingLabel: gameBindingLabel(stage === 10 ? INVENTORY_KEY : SKILLS_KEY),
    stage,
  })
}

function measureResponsiveHudPointer(page, anchor, nativeTargetHeight) {
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
    const marker = document.createElement('b')
    Object.assign(marker.style, {
      height: '1px',
      left: '29px',
      pointerEvents: 'none',
      position: 'absolute',
      top: '2px',
      width: '1px',
    })
    pointer.append(marker)
    const markerRect = marker.getBoundingClientRect()
    marker.remove()
    return {
      headingBaseline: Number(overlay.dataset.headingBaseline),
      originX: Number(pointer.dataset.x),
      originY: Number(pointer.dataset.y),
      paintedTipX: markerRect.left + markerRect.width / 2,
      paintedTipY: markerRect.top + markerRect.height / 2,
      pointerScale: Number(pointer.dataset.pointerScale),
      targetBottom: targetRect.bottom,
      targetHeight: targetRect.height,
      targetLeft: targetRect.left,
      targetRight: targetRect.right,
      targetScale: targetRect.height * logicalHeight / overlayRect.height / expectedNativeHeight,
      targetTop: targetRect.top,
      targetWidth: targetRect.width,
      targetX: Number(pointer.dataset.targetX),
      targetY: Number(pointer.dataset.targetY),
      subheadingBaseline: Number(overlay.dataset.subheadingBaseline),
      targetFromElementX: (targetRect.left + targetRect.width / 2 - overlayRect.left)
        * logicalWidth / overlayRect.width,
      targetFromElementY: (targetRect.top + targetRect.height / 2 - overlayRect.top)
        * logicalHeight / overlayRect.height,
    }
  }, { expectedAnchor: anchor, expectedNativeHeight: nativeTargetHeight })
}

function assertResponsiveHudPointer(receipt, nativeOffsetX, nativeOffsetY, label) {
  close(receipt.targetX, receipt.targetFromElementX, 0.05, `${label} target x`)
  close(receipt.targetY, receipt.targetFromElementY, 0.05, `${label} target y`)
  close(receipt.pointerScale, receipt.targetScale, 0.001, `${label} scale`)
  close(receipt.originX, receipt.targetX + nativeOffsetX * receipt.targetScale, 0.05, `${label} origin x`)
  close(receipt.originY, receipt.targetY + nativeOffsetY * receipt.targetScale, 0.05, `${label} origin y`)
  close(receipt.subheadingBaseline, receipt.targetY - 95 * receipt.targetScale, 0.05, `${label} subheading y`)
  close(receipt.headingBaseline, receipt.subheadingBaseline - 30, 0.05, `${label} heading y`)
  assert.ok(
    receipt.paintedTipX >= receipt.targetLeft && receipt.paintedTipX <= receipt.targetRight
      && receipt.paintedTipY >= receipt.targetTop && receipt.paintedTipY <= receipt.targetBottom,
    `${label} painted tip ${JSON.stringify(receipt)}`,
  )
}

function measurePaintedPointerLanding(page, pointerSelector, targetSelector) {
  return page.evaluate(({ expectedPointer, expectedTarget }) => {
    const pointer = document.querySelector(expectedPointer)
    const target = document.querySelector(expectedTarget)
    if (!(pointer instanceof HTMLElement)) throw new Error(`missing ${expectedPointer}`)
    if (!(target instanceof HTMLElement)) throw new Error(`missing ${expectedTarget}`)
    const marker = document.createElement('b')
    Object.assign(marker.style, {
      height: '1px',
      left: '29px',
      pointerEvents: 'none',
      position: 'absolute',
      top: '2px',
      width: '1px',
    })
    pointer.append(marker)
    const markerRect = marker.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    marker.remove()
    const tipX = markerRect.left + markerRect.width / 2
    const tipY = markerRect.top + markerRect.height / 2
    const distanceX = Math.max(targetRect.left - tipX, 0, tipX - targetRect.right)
    const distanceY = Math.max(targetRect.top - tipY, 0, tipY - targetRect.bottom)
    return {
      distanceToTarget: Math.hypot(distanceX, distanceY),
      insideX: tipX >= targetRect.left && tipX <= targetRect.right,
      targetBottom: targetRect.bottom,
      targetHeight: targetRect.height,
      targetLeft: targetRect.left,
      targetRight: targetRect.right,
      targetTop: targetRect.top,
      tipX,
      tipY,
    }
  }, { expectedPointer: pointerSelector, expectedTarget: targetSelector })
}

function measureSelectedHudLesson(page) {
  return page.evaluate(() => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`missing ${selector}`)
      return element
    }
    const overlay = requiredElement('.tutorial-overlay')
    const pointer = requiredElement('[data-tutorial-pointer="selected-skills"]')
    const primary = requiredElement('[data-tutorial-anchor="primary-skill"]')
    const concentration = requiredElement('[data-tutorial-anchor="concentration-a"]')
    const firstLine = requiredElement('.tutorial-selected-hud-first-line:not(.tutorial-instruction-shadow)')
    const secondLine = requiredElement('.tutorial-selected-hud-second-line:not(.tutorial-instruction-shadow)')
    const overlayRect = overlay.getBoundingClientRect()
    const logicalWidth = Number(overlay.dataset.viewportWidth)
    const logicalHeight = Number(overlay.dataset.viewportHeight)
    const logicalCenter = (element) => {
      const rect = element.getBoundingClientRect()
      return {
        x: (rect.left + rect.width / 2 - overlayRect.left) * logicalWidth / overlayRect.width,
        y: (rect.top + rect.height / 2 - overlayRect.top) * logicalHeight / overlayRect.height,
      }
    }
    const logicalText = (element) => {
      const rect = element.getBoundingClientRect()
      return {
        baseline: (rect.top - overlayRect.top) * logicalHeight / overlayRect.height + 12,
        x: (rect.left + rect.width / 2 - overlayRect.left) * logicalWidth / overlayRect.width,
      }
    }
    const primaryRect = primary.getBoundingClientRect()
    return {
      concentration: logicalCenter(concentration),
      firstLine: logicalText(firstLine),
      pointer: {
        scale: Number(pointer.dataset.pointerScale),
        toX: Number(pointer.dataset.toX),
        toY: Number(pointer.dataset.toY),
        x: Number(pointer.dataset.x),
        y: Number(pointer.dataset.y),
      },
      primary: logicalCenter(primary),
      scale: primaryRect.height * logicalHeight / overlayRect.height / 65,
      secondLine: logicalText(secondLine),
    }
  })
}

function assertSelectedHudLesson(receipt, label) {
  const expectedTargetX = (receipt.primary.x + receipt.concentration.x) * 0.5
  const expectedTargetY = (receipt.primary.y + receipt.concentration.y) * 0.5
  close(receipt.pointer.scale, receipt.scale, 0.001, `${label} scale`)
  close(receipt.pointer.toX, expectedTargetX, 0.05, `${label} target x`)
  close(receipt.pointer.toY, expectedTargetY, 0.05, `${label} target y`)
  close(receipt.pointer.x, receipt.primary.x + 30 * receipt.scale, 0.05, `${label} origin x`)
  close(receipt.pointer.y, receipt.primary.y + 50 * receipt.scale, 0.05, `${label} origin y`)
  close(receipt.firstLine.x, receipt.primary.x - 220 * receipt.scale, 0.6, `${label} first line x`)
  close(receipt.firstLine.baseline, receipt.primary.y + 50 * receipt.scale, 0.6, `${label} first line y`)
  close(receipt.secondLine.x, receipt.primary.x - 220 * receipt.scale, 0.6, `${label} second line x`)
  close(receipt.secondLine.baseline, receipt.primary.y + 70 * receipt.scale, 0.6, `${label} second line y`)
}

function measureModal(page, stage) {
  return page.evaluate((expectedStage) => {
    const requiredElement = (selector) => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`missing ${selector}`)
      return element
    }
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect()
      return { height: rect.height, left: rect.left, top: rect.top, width: rect.width }
    }
    const visible = (element) => {
      const style = getComputedStyle(element)
      return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const stageElement = requiredElement('.tutorial-modal-callout-stage')
    const modal = requiredElement(`.tutorial-modal-callouts[data-stage="${expectedStage}"]`)
    const order = [...modal.children].map((child) => {
      if (!(child instanceof HTMLElement)) return 'unknown'
      if (child.dataset.tutorialCallout) return `callout:${child.dataset.tutorialCallout}`
      if (child.dataset.tutorialPointer?.startsWith('modal-')) {
        return `pointer:${child.dataset.tutorialPointer.slice('modal-'.length)}`
      }
      return 'unknown'
    })
    const callouts = [...modal.querySelectorAll('[data-tutorial-callout]')].map((element) => ({
      centerX: Number(element.dataset.centerX),
      centerY: Number(element.dataset.centerY),
      id: element.dataset.tutorialCallout,
      lines: [...element.querySelectorAll('.tutorial-callout-text')].map((line) => ({
        ...rectOf(line),
        font: line.dataset.nativeUiFont ?? null,
        glyphs: [...line.querySelectorAll('[data-native-ui-glyph]')]
          .map((glyph) => Number(glyph.dataset.nativeUiGlyph)),
      })),
      rect: rectOf(element),
    }))
    const pointers = [...modal.querySelectorAll('[data-tutorial-pointer^="modal-"]')].map((element) => {
      const rect = rectOf(element)
      return {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        id: element.dataset.tutorialPointer.slice('modal-'.length),
        scale: Number(element.dataset.pointerScale),
        toX: Number(element.dataset.toX),
        toY: Number(element.dataset.toY),
        visible: visible(element),
        x: Number(element.dataset.x),
        y: Number(element.dataset.y),
      }
    })
    const canvas = document.querySelector('canvas[data-native-reveal]')
    return {
      callouts,
      canvas: canvas instanceof HTMLElement ? rectOf(canvas) : null,
      order,
      pointers,
      progress: Number(modal.dataset.modalProgress),
      screenProgress: expectedStage === 10
        ? Number(canvas?.dataset.nativeRevealProgress)
        : Number(document.querySelector('.skill-book-stage')?.dataset.openProgress),
      stage: rectOf(stageElement),
    }
  }, stage)
}

function compareModal(measured, plans, label) {
  const scale = measured.stage.width / NATIVE_HUD_BACKBUFFER.width
  close(measured.stage.height, NATIVE_HUD_BACKBUFFER.height * scale, 0.05, `${label} stage aspect`)
  assert.ok(scale > 0, `${label} stage scale`)
  close(measured.screenProgress, measured.progress, 0.05, `${label} modal progress owner`)
  const tolerance = 0.51 * scale
  const toClient = (x, y) => ({ x: measured.stage.left + x * scale, y: measured.stage.top + y * scale })
  let maxDelta = 0
  const check = (actual, expected, what) => {
    maxDelta = Math.max(maxDelta, Math.abs(actual - expected))
    close(actual, expected, tolerance, `${label} ${what}`)
  }
  const members = plans.map((plan) => `${plan.kind}:${plan.id}`)
  assert.deepEqual(measured.order, members, `${label} draw order`)
  for (const plan of plans) {
    if (plan.kind === 'callout') {
      const callout = measured.callouts.find(({ id }) => id === plan.id)
      assert.ok(callout, `${label} callout ${plan.id}`)
      assert.deepEqual(
        [callout.centerX, callout.centerY],
        [plan.geometry.centerX, plan.geometry.centerY],
        `${label} callout ${plan.id} centre`,
      )
      const frame = toClient(plan.geometry.frame.x, plan.geometry.frame.y)
      check(callout.rect.left, frame.x, `${plan.id} frame left`)
      check(callout.rect.top, frame.y, `${plan.id} frame top`)
      check(callout.rect.width, plan.geometry.frame.width * scale, `${plan.id} frame width`)
      check(callout.rect.height, plan.geometry.frame.height * scale, `${plan.id} frame height`)
      assert.deepEqual(
        callout.lines.map(({ font, glyphs }) => ({ font, glyphs })),
        plan.geometry.lines.map(({ text }) => ({ font: TUTORIAL_CALLOUT_FONT, glyphs: calloutGlyphs(text) })),
        `${label} callout ${plan.id} lines`,
      )
      plan.geometry.lines.forEach((line, index) => {
        const origin = toClient(line.x, line.y - GLYPH_HALF_HEIGHT)
        check(callout.lines[index].left, origin.x, `${plan.id} line ${index} left`)
        check(callout.lines[index].top, origin.y, `${plan.id} line ${index} top`)
      })
    } else {
      const pointer = measured.pointers.find(({ id }) => id === plan.id)
      assert.ok(pointer, `${label} pointer ${plan.id}`)
      assert.deepEqual(
        [pointer.x, pointer.y, pointer.toX, pointer.toY],
        [plan.x, plan.y, plan.toX, plan.toY],
        `${label} pointer ${plan.id} origin/tip`,
      )
      assert.equal(pointer.scale, 1, `${label} pointer ${plan.id} fixed-stage scale`)
      const origin = toClient(plan.x, plan.y)
      check(pointer.centerX, origin.x, `${plan.id} pointer centre x`)
      check(pointer.centerY, origin.y, `${plan.id} pointer centre y`)
      if (!plan.blink) assert.equal(pointer.visible, true, `${label} pointer ${plan.id} visible`)
    }
  }
  if (measured.canvas) {
    check(measured.canvas.left, measured.stage.left, 'inventory canvas left')
    check(measured.canvas.top, measured.stage.top, 'inventory canvas top')
    check(measured.canvas.width, measured.stage.width, 'inventory canvas width')
    check(measured.canvas.height, measured.stage.height, 'inventory canvas height')
  }
  return {
    canvas: measured.canvas,
    maxDelta,
    members,
    progress: measured.progress,
    pointers: plans.filter((plan) => plan.kind === 'pointer').map((plan) => ({
      blink: plan.blink,
      id: plan.id,
      tip: [plan.toX, plan.toY],
    })),
    scale,
    stage: measured.stage,
  }
}

async function measureOpeningModal(page, stage, allowSettled) {
  await page.waitForFunction(({ allowSettled, expectedStage }) => {
    const modal = document.querySelector(`.tutorial-modal-callouts[data-stage="${expectedStage}"]`)
    if (!(modal instanceof HTMLElement)) return false
    const progress = Number(modal.dataset.modalProgress)
    return progress > 0.05 && (progress < 0.95 || (allowSettled && progress === 1))
  }, { allowSettled, expectedStage: stage }, { timeout: 15_000 })
  return measureModal(page, stage)
}


async function sampleBlink(page, blinkSelector, steadySelector = null) {
  if (allowSparsePresentation) {
    return page.evaluate(({ blinkSelector, steadySelector }) => {
      const visible = (element) => {
        const style = getComputedStyle(element)
        return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none'
      }
      const blinking = document.querySelector(blinkSelector)
      const receipt = {
        blinkHidden: blinking instanceof HTMLElement && !visible(blinking) ? 1 : 0,
        blinkVisible: blinking instanceof HTMLElement && visible(blinking) ? 1 : 0,
        steadyHidden: 0,
        steadyVisible: 0,
      }
      for (const element of steadySelector ? document.querySelectorAll(steadySelector) : []) {
        if (visible(element)) receipt.steadyVisible += 1
        else receipt.steadyHidden += 1
      }
      return receipt
    }, { blinkSelector, steadySelector })
  }
  const opacityIs = ({ expected, selector }) => {
    const element = document.querySelector(selector)
    return element instanceof HTMLElement && getComputedStyle(element).opacity === expected
  }
  const sampleSteady = () => page.evaluate((selector) => {
    const visible = (element) => {
      const style = getComputedStyle(element)
      return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const receipt = { hidden: 0, visible: 0 }
    for (const element of selector ? document.querySelectorAll(selector) : []) {
      if (visible(element)) receipt.visible += 1
      else receipt.hidden += 1
    }
    return receipt
  }, steadySelector)
  await page.waitForFunction(opacityIs, { expected: '0', selector: blinkSelector }, { timeout: 5_000 })
  const hiddenSteady = await sampleSteady()
  await page.waitForFunction(opacityIs, { expected: '1', selector: blinkSelector }, { timeout: 5_000 })
  const visibleSteady = await sampleSteady()
  return {
    blinkHidden: 1,
    blinkVisible: 1,
    steadyHidden: hiddenSteady.hidden + visibleSteady.hidden,
    steadyVisible: hiddenSteady.visible + visibleSteady.visible,
  }
}

// The pure contract pins the exact 20-hidden / 30-visible application ticks. Browser sampling can
// be sparse under software rendering, so this journey requires both real painted phases without
// inferring the duty ratio from an irregular main-thread sample count.
function assertBlink(samples, label) {
  if (allowSparsePresentation) {
    assert.ok(samples.blinkHidden + samples.blinkVisible > 0, `${label} blink ${JSON.stringify(samples)}`)
    return
  }
  assert.ok(
    samples.blinkHidden > 0 && samples.blinkVisible > 0,
    `${label} blink ${JSON.stringify(samples)}`,
  )
}

function clearBackpack(host, playerId) {
  const state = host.state()
  const economy = getPlayerEconomy(state, playerId)
  // Economy replication is revision-gated (entity-replication.ts / BoneyardScene setEconomy), so the
  // emptied backpack must carry a new revision to reach the client like a real economy mutation.
  const playerEntities = replacePlayerEconomy(state.playerEntities, playerId, {
    ...economy,
    backpack: [],
    revision: economy.revision + 1,
  })
  assert.notEqual(playerEntities, state.playerEntities, 'backpack cleared')
  Object.assign(state, { ...state, playerEntities })
}

function grantTutorialAmulet(host, playerId) {
  const state = host.state()
  const economy = getPlayerEconomy(state, playerId)
  const inserted = insertLootInventoryItem(economy, nativeTutorialAmuletItem())
  assert.equal(inserted.accepted, true, 'Tutorial amulet inserted')
  const playerEntities = replacePlayerEconomy(state.playerEntities, playerId, inserted.state)
  assert.notEqual(playerEntities, state.playerEntities, 'Tutorial amulet replicated')
  Object.assign(state, { ...state, playerEntities })
}

function concentrateOnSkill(host, playerId, skillId) {
  const state = host.state()
  const granted = grantPlayerEntitySkillRanks(state.playerEntities, playerId, skillId, 1, state.gameRng)
  assert.notEqual(granted.store, state.playerEntities, `skill ${skillId} granted`)
  const playerEntities = selectPlayerEntityConcentrationSlot(granted.store, playerId, skillId, 0)
  Object.assign(state, { ...state, gameRng: granted.rng, playerEntities })
}

async function waitForEnemies(host, count) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const state = host.state()
    const enemies = state.world.kind === 'boneyard'
      ? state.world.enemies.actors.length + state.world.enemies.maggots.length
      : 0
    if (enemies >= count) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`fewer than ${count} enemies spawned for stage 14`)
}

function grantThirdSkillPage(host, playerId) {
  const state = host.state()
  const before = snapshotPlayer(state, playerId).progression.learnedSkillOrder.length
  const granted = grantPlayerEntitySkillRanks(state.playerEntities, playerId, 16, 1, state.gameRng)
  assert.notEqual(granted.store, state.playerEntities, 'skill 16 granted')
  Object.assign(state, { ...state, gameRng: granted.rng, playerEntities: granted.store })
  assert.equal(snapshotPlayer(host.state(), playerId).progression.learnedSkillOrder.length, before + 1)
}

// The blink runs on the application tick, not on `stageTicks` (frozen by the modal pause), so the
// capture waits for the pointer's hidden -> visible edge and lands early in the 300 ms window.
async function screenshotInBlinkWindow(page, path, selector = MODAL_RESUME_POINTER) {
  if (allowSparsePresentation) {
    await page.screenshot({ path })
    return
  }
  const opacityIs = ([target, expected]) => {
    const element = document.querySelector(target)
    return element !== null && getComputedStyle(element).opacity === expected
  }
  await page.waitForFunction(opacityIs, [selector, '0'], { timeout: 10_000 })
  await page.waitForFunction(opacityIs, [selector, '1'], { timeout: 10_000 })
  await page.screenshot({ path })
}

async function waitForTutorialStage(host, page, stage) {
  const stages = Array.isArray(stage) ? stage : [stage]
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const state = host.state()
    if (state.world.kind === 'boneyard' && stages.includes(state.world.tutorial?.stage)) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  const state = host.state()
  const client = await page.evaluate(() => ({
    activeElement: document.activeElement?.tagName ?? null,
    inventoryCanvas: document.querySelector('canvas[data-native-reveal]') !== null,
    loading: document.querySelector('.match-loading-screen') !== null,
    modalStage: document.querySelector('.tutorial-modal-callouts')?.getAttribute('data-stage') ?? null,
    overlayStage: document.querySelector('.tutorial-overlay')?.getAttribute('data-stage') ?? null,
    skillBook: document.querySelector('.skill-book-renderer') !== null,
  }))
  throw new Error(`Tutorial did not reach stage ${stages.join('/')}: ${JSON.stringify({
    client,
    tutorial: state.world.kind === 'boneyard' ? state.world.tutorial : state.world.kind,
  })}`)
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

async function waitForHostRetirement(host) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (
      host.humanPlayerCount() === 0
      && host.capacityParticipantCount() === 0
      && host.runCount() === 0
    ) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error(`Tutorial host did not retire its final actor: ${JSON.stringify({
    capacity: host.capacityParticipantCount(),
    humans: host.humanPlayerCount(),
    runs: host.runCount(),
  })}`)
}

function idleNarration(host) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const { narration } = state.world.tutorial
  return { narration: { ...narration, current: null, pending: [], ticksRemaining: 0 } }
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

function close(actual, expected, epsilon, label) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: ${actual} is not within ${epsilon} of ${expected}`,
  )
}

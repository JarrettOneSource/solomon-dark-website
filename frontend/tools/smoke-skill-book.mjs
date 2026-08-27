import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import {
  NATIVE_HUD_BACKBUFFER,
  nativeHudModalSlideLayout,
} from '../src/game/native-hud-layout.ts'
import {
  getPlayerCharacter,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import {
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_SKILL_BOOK_SMOKE_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-skill-book'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const networkErrors = []

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
  snapshotRate: 100,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
await page.addInitScript(installGameAudioSmokeProbe)

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (
      failure === 'net::ERR_ABORTED'
      && (
        /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())
        || new URL(request.url()).pathname === '/deployment.json'
      )
    ) return
    networkErrors.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current') ?? 'local'
    return route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
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
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialPrompt = page.locator('.stock-prompt-dialog[data-prompt-kind="tutorial"]')
  if (await tutorialPrompt.isVisible()) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeAdmission(page, host)
  await page.getByRole('button', { name: /Ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  try {
    await hubScene.waitFor({ timeout: 30_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      consoleErrors,
      pageErrors,
      url: page.url(),
    })}\n`)
    throw error
  }
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor({
    timeout: 10_000,
  })
  await page.waitForFunction(() => (
    document.querySelector('.hub-world-canvas')?.getAttribute('data-transition-phase') === 'none'
  ))

  await page.getByRole('button', { name: 'Open skills' }).click()
  const book = page.getByRole('dialog', { name: 'Skills' })
  try {
    await book.waitFor({ timeout: 30_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      consoleErrors,
      mainMenu: await page.locator('.main-menu-page').evaluate((node) => ({ ...node.dataset })),
      networkErrors,
      openSkillsButtons: await page.getByRole('button', { name: 'Open skills' }).count(),
      pageErrors,
      skillBookStages: await page.locator('.skill-book-stage').count(),
    })}\n`)
    throw error
  }
  await book.locator('.skill-book-canvas').waitFor({ timeout: 15_000 })
  await book.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({ timeout: 5_000 })
  assert.equal(await hubScene.getAttribute('data-gameplay-input-blocked'), 'true')
  assert.equal(await page.locator('.game-menu-skull').isHidden(), true)
  assert.deepEqual(await book.locator('.skill-book-canvas').evaluate((canvas) => ({
    height: canvas.height,
    webgl2: canvas.getContext('webgl2') instanceof WebGL2RenderingContext,
    width: canvas.width,
  })), { height: 900, webgl2: true, width: 1600 })
  const hubSealMotion = await sampleSkillBookSealMotion(page, book)
  await page.screenshot({ path: `${screenshotRoot}-settled.png` })

  const leviathan = book.getByRole('button', { name: /Call Leviathan, rank 1/ })
  await leviathan.hover()
  await book.locator('xpath=self::*[@data-hovered-skill-id="11"]').waitFor()
  assert.equal(await book.locator('.skill-book-canvas').getAttribute('data-native-hover-skill-id'), '11')
  await page.screenshot({ path: `${screenshotRoot}-tooltip.png` })
  const quickbarTwo = book.getByRole('button', { name: /Quickbar 2, empty/ })
  await leviathan.dragTo(quickbarTwo)
  try {
    await book.getByRole('button', { name: /Quickbar 2, Call Leviathan/ }).waitFor({
      timeout: 5_000,
    })
  } catch (error) {
    const playerId = host.hostPlayerId()
    process.stderr.write(`${JSON.stringify({
      consoleErrors,
      pageErrors,
      quickbar: playerId
        ? host.state().playerEntities.skillBooks[
          host.state().playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
        ]?.skillQuickbar
        : null,
    })}\n`)
    throw error
  }
  assert.equal(await book.getByRole('button', { name: /Quickbar [12], Call Leviathan/ }).count(), 2)
  const pullOffAudioStart = await audioEventCount(page)
  const pullOff = await pullSkillOffBelt(page, book, book.getByRole('button', {
    name: /Quickbar 2, Call Leviathan/,
  }))
  await book.getByRole('button', { name: /Quickbar 2, empty/ }).waitFor({ timeout: 5_000 })
  const pullOffAudio = await waitForSelectorAudio(page, pullOffAudioStart, ['poof'], 1)
  await waitForSavedQuickbar(page, host.hostPlayerId(), 1, null)

  const missile = book.getByRole('button', { name: /Magic Missile, rank 1/ })
  const dragAudioStart = await audioEventCount(page)
  const paintedDrag = await dragSkillToPaintedBeltEdge(
    page,
    book,
    missile,
    2,
    `${screenshotRoot}-painted-drag.png`,
  )
  await book.getByRole('button', { name: /Quickbar 3, Magic Missile/ }).waitFor()
  assert.equal(paintedDrag.draggedSkillId, '8')
  const dragAudio = await waitForSelectorAudio(page, dragAudioStart, ['pickskill'], 1)

  await page.keyboard.press('Escape')
  await book.waitFor({ state: 'detached', timeout: 5_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const hubEtherOrb = await waitForOrbProgram(
    page,
    '.hub-world-canvas',
    playerId,
    8,
  )
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  for (const skillId of [16, 57, 58, 59]) {
    permanentRanks[skillId] = 1
    effectiveRanks[skillId] = 1
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  const progressions = [...state.playerEntities.progressions]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: [...sourceBook.learnedSkillOrder, 16, 57, 58, 59],
    permanentRanks,
  }
  progressions[index] = {
    ...progressions[index],
    revision: progressions[index].revision + 1,
  }
  const sourceEconomy = getPlayerEconomy(state, playerId)
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions,
      skillBooks,
    }, playerId, {
      ...sourceEconomy,
      ownedPerkSelectors: [...new Set([...sourceEconomy.ownedPerkSelectors, 21])],
    }),
  })
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Open skills' }).click()
  await book.waitFor({ timeout: 10_000 })
  await book.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({
    timeout: 5_000,
  })
  const [reopenedSealTick] = await skillBookSealMotion(book.locator('.skill-book-canvas'))
  assert.ok(reopenedSealTick < hubSealMotion.last.tick, JSON.stringify({
    firstScreenLastTick: hubSealMotion.last.tick,
    reopenedSealTick,
  }))
  const fireball = book.getByRole('button', { name: /Fireball, rank 1/ })
  await fireball.waitFor({ timeout: 10_000 })
  await fireball.click()
  await page.getByRole('img', { name: 'Fireball primary spell' }).waitFor({ timeout: 10_000 })
  const hubFireOrb = await waitForOrbProgram(
    page,
    '.hub-world-canvas',
    playerId,
    16,
  )
  await book.getByRole('button', { name: /Channel Mana, rank 1/ }).click()
  await book.locator(
    '.skill-book-entry-action[data-skill-id="57"][aria-pressed="true"]',
  ).waitFor({ timeout: 10_000 })
  await book.getByRole('button', { name: /Meditation, rank 1/ }).click()
  await book.locator(
    '.skill-book-entry-action[data-skill-id="58"][aria-pressed="true"]',
  ).waitFor({ timeout: 10_000 })
  await page.getByRole('img', { name: /Channel Mana, concentration A/ }).waitFor({ timeout: 10_000 })
  await page.getByRole('img', { name: /Meditation, concentration B/ }).waitFor({ timeout: 10_000 })
  await page.screenshot({ path: `${screenshotRoot}-mixed-quickbar.png` })

  await page.keyboard.press('Escape')
  await book.waitFor({ state: 'detached', timeout: 5_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()

  const primaryAction = page.getByRole('button', {
    name: 'Select primary attack, current Fireball',
  })
  const primaryOpenAudioStart = await audioEventCount(page)
  await primaryAction.click()
  const primarySelector = page.getByRole('dialog', { name: 'Select Primary Attack' })
  await primarySelector.locator('.hud-skill-selector-canvas').waitFor({ timeout: 15_000 })
  await assertGameSoundMuted(page, true)
  const primaryOpenAudio = await waitForSelectorAudio(page, primaryOpenAudioStart, ['click'])
  assert.equal(await hubScene.getAttribute('data-gameplay-input-blocked'), 'true')
  assert.deepEqual(await page.locator('.hub-hud-selected-skill-action').evaluateAll(
    (buttons) => buttons.map((button) => {
      const bounds = button.getBoundingClientRect()
      return {
        binding: Number(button.getAttribute('data-binding')),
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
      }
    }),
  ), [
    { binding: 12, height: 65, left: 740, top: -7, width: 40 },
    { binding: 16, height: 65, left: 820, top: -7, width: 40 },
    { binding: 20, height: 65, left: 780, top: -7, width: 40 },
  ])
  assert.deepEqual(await primarySelector.locator('.hud-skill-selector-action').evaluateAll(
    (buttons) => buttons.map((button) => Number(button.getAttribute('data-skill-id'))),
  ), [8, 16])
  assert.deepEqual(await primarySelector.locator('.hud-skill-selector-canvas').evaluate((canvas) => ({
    height: canvas.height,
    webgl2: canvas.getContext('webgl2') instanceof WebGL2RenderingContext,
    width: canvas.width,
  })), { height: 900, webgl2: true, width: 1600 })
  await page.screenshot({ path: `${screenshotRoot}-hud-primary-selector.png` })
  const primarySelectionAudioStart = await audioEventCount(page)
  await primarySelector.getByRole('button', { name: /Magic Missile/ }).click()
  await primarySelector.waitFor({ state: 'detached' })
  const primarySelectionAudio = await waitForSelectorAudio(
    page,
    primarySelectionAudioStart,
    ['click'],
    0,
  )
  await page.getByRole('img', { name: 'Magic Missile primary spell' }).waitFor({ timeout: 10_000 })
  const hubRestoredEtherOrb = await waitForOrbProgram(
    page,
    '.hub-world-canvas',
    playerId,
    8,
  )
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)
  await page.screenshot({ path: `${screenshotRoot}-hub-ether-orb.png` })

  await page.getByRole('button', {
    name: 'Select concentration A, current Channel Mana',
  }).click()
  const concentrationA = page.getByRole('dialog', { name: 'Select Concentration' })
  await concentrationA.locator('.hud-skill-selector-canvas').waitFor({ timeout: 15_000 })
  await assertGameSoundMuted(page, true)
  assert.deepEqual(await concentrationA.locator('.hud-skill-selector-action').evaluateAll(
    (buttons) => buttons.map((button) => Number(button.getAttribute('data-skill-id'))),
  ), [57, 59])
  const concentrationSelectionAudioStart = await audioEventCount(page)
  await concentrationA.getByRole('button', { name: /Battle Mage/ }).click()
  const concentrationSelectionAudio = await waitForSelectorAudio(
    page,
    concentrationSelectionAudioStart,
    ['click', 'concentrate'],
    0,
  )
  await page.getByRole('button', {
    name: 'Select concentration A, current Battle Mage',
  }).waitFor({ timeout: 10_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)

  await page.getByRole('button', {
    name: 'Select concentration B, current Meditation',
  }).click()
  const concentrationB = page.getByRole('dialog', { name: 'Select Concentration' })
  await concentrationB.locator('.hud-skill-selector-canvas').waitFor({ timeout: 15_000 })
  await assertGameSoundMuted(page, true)
  assert.deepEqual(await concentrationB.locator('.hud-skill-selector-action').evaluateAll(
    (buttons) => buttons.map((button) => Number(button.getAttribute('data-skill-id'))),
  ), [57, 58])
  await concentrationB.getByRole('button', { name: /Channel Mana/ }).click()
  await page.getByRole('button', {
    name: 'Select concentration B, current Channel Mana',
  }).waitFor({ timeout: 10_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)
  await page.screenshot({ path: `${screenshotRoot}-hud-selectors.png` })

  await page.getByRole('button', {
    name: 'Select primary attack, current Magic Missile',
  }).click()
  await primarySelector.waitFor()
  await assertGameSoundMuted(page, true)
  await page.mouse.click(1_500, 500)
  await primarySelector.waitFor({ state: 'detached' })
  await page.getByRole('img', { name: 'Magic Missile primary spell' }).waitFor()
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  const boneyardScene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyardScene.waitFor({ timeout: 90_000 })
  const boneyardEtherOrb = await waitForOrbProgram(
    page,
    '.boneyard-world-canvas',
    playerId,
    8,
  )
  await page.getByRole('button', { name: 'Open skills' }).click()
  await book.waitFor({ timeout: 10_000 })
  await book.locator('.skill-book-canvas').waitFor({ timeout: 15_000 })
  await book.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({
    timeout: 5_000,
  })
  const boneyardSealMotion = await sampleSkillBookSealMotion(page, book, 3)
  await page.keyboard.press('Escape')
  await book.waitFor({ state: 'detached', timeout: 5_000 })
  await boneyardScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await page.getByRole('button', {
    name: 'Select primary attack, current Magic Missile',
  }).click()
  await primarySelector.locator('.hud-skill-selector-canvas').waitFor({ timeout: 15_000 })
  await assertGameSoundMuted(page, true)
  assert.equal(await boneyardScene.getAttribute('data-gameplay-input-blocked'), 'true')
  const beforeCancelledPointer = host.state()
  const beforeCancelledIndex = beforeCancelledPointer.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(beforeCancelledIndex, -1)
  const beforeCancelledPosition = {
    ...beforeCancelledPointer.playerEntities.locomotions[beforeCancelledIndex].position,
  }
  assert.equal(
    beforeCancelledPointer.playerEntities.primaryCasts[beforeCancelledIndex].actionTick,
    -1,
  )
  await page.keyboard.press('w')
  await page.mouse.click(1_500, 500)
  await primarySelector.waitFor({ state: 'detached' })
  await boneyardScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)
  await page.waitForTimeout(150)
  const afterCancelledPointer = host.state()
  const afterCancelledPosition =
    afterCancelledPointer.playerEntities.locomotions[beforeCancelledIndex].position
  assert.deepEqual(afterCancelledPosition, beforeCancelledPosition)
  assert.equal(
    afterCancelledPointer.playerEntities.primaryCasts[beforeCancelledIndex].actionTick,
    -1,
  )
  assert.equal(afterCancelledPointer.playerEntities.primaryCasts[beforeCancelledIndex].held, false)

  await page.getByRole('button', {
    name: 'Select primary attack, current Magic Missile',
  }).click()
  await primarySelector.locator('.hud-skill-selector-canvas').waitFor({ timeout: 15_000 })
  await assertGameSoundMuted(page, true)
  await page.screenshot({ path: `${screenshotRoot}-boneyard-selector.png` })
  await primarySelector.getByRole('button', { name: /Fireball/ }).click()
  await page.getByRole('img', { name: 'Fireball primary spell' }).waitFor({ timeout: 10_000 })
  const boneyardFireOrb = await waitForOrbProgram(
    page,
    '.boneyard-world-canvas',
    playerId,
    16,
  )
  await boneyardScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)
  await page.screenshot({ path: `${screenshotRoot}-boneyard-fire-orb.png` })

  const selectedState = host.state()
  const selectedIndex = selectedState.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(selectedIndex, -1)
  assert.deepEqual([
    selectedState.playerEntities.skillRuntimes[selectedIndex].concentrationSkillIdA,
    selectedState.playerEntities.skillRuntimes[selectedIndex].concentrationSkillIdB,
  ], [59, 57])
  assert.equal(getPlayerCharacter(selectedState, playerId).config.element, 'ether')
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(networkErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    boneyardSelector: true,
    consoleErrors,
    duplicateSecondary: true,
    hudConcentrationA: 59,
    hudConcentrationB: 57,
    hudSelectorCancel: true,
    hudSelectorWebGl2: true,
    mixedQuickbar: true,
    orbSelection: {
      boneyardEther: boneyardEtherOrb,
      boneyardFire: boneyardFireOrb,
      hubEther: hubEtherOrb,
      hubFire: hubFireOrb,
      hubRestoredEther: hubRestoredEtherOrb,
    },
      paintedDrag,
      pullOff,
    networkErrors,
    pageErrors,
    sealMotion: {
      boneyard: boneyardSealMotion,
      hub: hubSealMotion,
      reopenedTick: reopenedSealTick,
    },
      selectorAudio: {
        dragAudio,
      concentrationSelectionAudio,
      primaryOpenAudio,
        primarySelectionAudio,
        pullOffAudio,
    },
    primarySelection: 'Fireball after Boneyard selector',
    screenshots: [
      `${screenshotRoot}-settled.png`,
      `${screenshotRoot}-tooltip.png`,
      `${screenshotRoot}-mixed-quickbar.png`,
      `${screenshotRoot}-hud-primary-selector.png`,
      `${screenshotRoot}-hud-selectors.png`,
      `${screenshotRoot}-boneyard-selector.png`,
      `${screenshotRoot}-hub-ether-orb.png`,
      `${screenshotRoot}-boneyard-fire-orb.png`,
    ],
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

async function enterCreateAfterCollegeAdmission(page, host) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    page.locator('.hub-scene[data-renderer-state="ready"]')
      .waitFor({ timeout: 90_000 })
      .then(() => 'hub'),
  ])
  if (first === 'create') return

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  const participant = state.world.participants[playerId]
  if (participant?.collegeIntro) {
    state.world = {
      ...state.world,
      participants: {
        ...state.world.participants,
        [playerId]: {
          collegeIntro: {
            ...participant.collegeIntro,
            contactCounter: 0,
            coverAlpha: 0,
            dialogueSequence: participant.collegeIntro.dialogueSequence + 1,
            officeSpeed: 0.5,
            pathCursor: 6,
            phase: 'arch-dialogue',
            titleCursor: 5,
          },
          region: 'office',
          transition: null,
        },
      },
    }
    state.playerEntities = replacePlayerCharacter(
      state.playerEntities,
      playerId,
      {
        ...getPlayerCharacter(state, playerId),
        position: { x: 522.5, y: 530 },
        velocity: { x: 0, y: 0 },
      },
    )
    const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
    await dialog.waitFor({ timeout: 15_000 })
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.getByRole('button', { name: 'Solomon Dark?' }).click()
    await waitForHostCollegeAcknowledgement(host, playerId)
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  }

  const officeState = host.state()
  assert.equal(officeState.world.kind, 'hub')
  officeState.playerEntities = replacePlayerCharacter(
    officeState.playerEntities,
    playerId,
    {
      ...getPlayerCharacter(officeState, playerId),
      position: { x: 512, y: 900 },
      velocity: { x: 0, y: 0 },
    },
  )
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
}

async function waitForHostCollegeAcknowledgement(host, playerId) {
  const deadline = performance.now() + 10_000
  while (performance.now() < deadline) {
    const state = host.state()
    if (state.world.kind === 'hub' && state.world.participants[playerId]?.collegeIntro === null) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('timed out waiting for College dialogue acknowledgement')
}

async function sampleSkillBookSealMotion(page, book, sampleCount = 5) {
  const canvas = book.locator('.skill-book-canvas')
  const samples = []
  for (let index = 0; index < sampleCount; index += 1) {
    if (index > 0) await page.waitForTimeout(150)
    const [tick, phaseDegrees, y, ...x] = await skillBookSealMotion(canvas)
    samples.push({ centers: x.map((centerX) => [centerX, y]), phaseDegrees, tick })
  }
  const expectedCenters = [
    [800, 490],
    [840, 490],
    [800, 490],
    [760, 490],
    [800, 490],
    [840, 490],
    [800, 490],
    [760, 490],
  ]
  for (const sample of samples) {
    assert.deepEqual(sample.centers, expectedCenters)
    assert.ok(Number.isInteger(sample.tick) && sample.tick >= 0, JSON.stringify(sample))
    assert.ok(
      Math.abs(sample.phaseDegrees + sample.tick / 60) < 1e-9,
      JSON.stringify(sample),
    )
  }
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(samples[index].tick > samples[index - 1].tick, JSON.stringify(samples))
    assert.ok(
      samples[index].phaseDegrees < samples[index - 1].phaseDegrees,
      JSON.stringify(samples),
    )
  }
  return { first: samples[0], last: samples.at(-1) }
}

async function pullSkillOffBelt(page, book, slot) {
  const bounds = await slot.boundingBox()
  assert.ok(bounds)
  const origin = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await page.mouse.move(origin.x, origin.y)
  await page.mouse.down()
  try {
    await page.mouse.move(origin.x + 80, origin.y, { steps: 16 })
    await page.waitForFunction(() => (
      document.querySelector('.skill-book-pull-off-burst[data-smoke-count="24"]')
    ), undefined, { polling: 'raf', timeout: 2_000 })
    const burst = book.locator('.skill-book-pull-off-burst')
    const receipt = {
      moveFadeCount: Number(await burst.getAttribute('data-move-fade-count')),
      smokeCount: Number(await burst.getAttribute('data-smoke-count')),
    }
    assert.equal(receipt.smokeCount, 24)
    assert.ok(receipt.moveFadeCount === 3 || receipt.moveFadeCount === 4)
    await page.screenshot({ path: `${screenshotRoot}-pull-off.png` })
    return receipt
  } finally {
    await page.mouse.up()
  }
}

async function waitForSavedQuickbar(page, playerId, slot, expectedSkillId) {
  assert.ok(playerId)
  const deadline = performance.now() + 15_000
  while (performance.now() < deadline) {
    const document = await readLocalSaveDocument(page)
    if (document) {
      try {
        const restored = restoreGameSaveDocument(document)
        const index = restored.state.playerEntities.identities.findIndex(
          ({ playerId: id }) => id === playerId,
        )
        if (restored.state.playerEntities.skillBooks[index]?.skillQuickbar[slot]
          === expectedSkillId) return
      } catch {
        // Wait for the addressed quickbar checkpoint to replace an earlier save.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`timed out waiting for saved quickbar slot ${slot}`)
}

function readLocalSaveDocument(page) {
  return page.evaluate((slot) => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(slot)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result?.document ?? null)
    }
  }), WEB_GAME_SAVE_SLOT)
}

function skillBookSealMotion(canvas) {
  return canvas.evaluate((element) => (
    (element.dataset.nativeSealMotion ?? '').split(',').map(Number)
  ))
}

async function dragSkillToPaintedBeltEdge(page, book, source, slot, screenshotPath) {
  const sourceBounds = await source.boundingBox()
  const stageBounds = await book.boundingBox()
  assert.ok(sourceBounds)
  assert.ok(stageBounds)
  const belt = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    1,
  ).belt[slot]
  assert.ok(belt)
  const scaleX = stageBounds.width / NATIVE_HUD_BACKBUFFER.width
  const scaleY = stageBounds.height / NATIVE_HUD_BACKBUFFER.height
  const sourcePoint = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  }
  const release = {
    x: stageBounds.x + (belt.x + belt.width / 2) * scaleX,
    y: stageBounds.y + (belt.y + belt.height - 2) * scaleY,
  }
  await page.mouse.move(sourcePoint.x, sourcePoint.y)
  await page.mouse.down()
  let draggedSkillId = null
  try {
    await page.mouse.move(release.x, release.y, { steps: 24 })
    await page.waitForTimeout(100)
    draggedSkillId = await book.getAttribute('data-dragged-skill-id')
    await page.screenshot({ path: screenshotPath })
  } finally {
    await page.mouse.up()
  }
  return { draggedSkillId, release, slot, source: sourcePoint }
}

async function audioEventCount(target) {
  return target.evaluate(() => window.__sdrAudioEvents.length)
}

async function waitForSelectorAudio(target, start, expectedStems, expectedMasterVolume) {
  await target.waitForFunction(({ eventStart, stems }) => {
    const events = window.__sdrAudioEvents.slice(eventStart).filter(({ src, type }) => (
      type === 'buffer-start'
      && stems.some((stem) => window.__sdrAudioSourceMatches(src, `${stem}.wav`))
    ))
    return stems.every((stem, index) => (
      window.__sdrAudioSourceMatches(events[index]?.src ?? '', `${stem}.wav`)
    ))
  }, { eventStart: start, stems: expectedStems })
  const events = await target.evaluate(({ eventStart, stems }) => (
    window.__sdrAudioEvents.slice(eventStart)
      .filter(({ src, type }) => (
        type === 'buffer-start'
        && stems.some((stem) => window.__sdrAudioSourceMatches(src, `${stem}.wav`))
      ))
      .map(({ masterVolume, playbackRate, src, volume }) => ({
        masterVolume,
        playbackRate,
        src,
        volume,
      }))
  ), { eventStart: start, stems: expectedStems })
  assert.deepEqual(
    events.map(({ playbackRate, volume }) => ({ playbackRate, volume })),
    expectedStems.map(() => ({ playbackRate: 1, volume: 1 })),
  )
  if (expectedMasterVolume !== undefined) {
    assert.deepEqual(
      events.map(({ masterVolume }) => masterVolume),
      expectedStems.map(() => expectedMasterVolume),
    )
  }
  return events
}

async function assertGameSoundMuted(target, expected) {
  await target.waitForFunction((muted) => {
    const attribute = document.querySelector('.main-menu-page')
      ?.getAttribute('data-game-sounds-muted')
    const masterVolumes = window.__sdrAudioMasterVolumes?.('click') ?? []
    return attribute === `${muted}`
      && masterVolumes.length > 0
      && masterVolumes.every(volume => muted ? volume === 0 : volume > 0)
  }, expected, { timeout: 5_000 })
}

async function waitForOrbProgram(page, canvasSelector, playerId, selectedPrimaryId) {
  await page.waitForFunction(({ expected, id, selector }) => {
    const canvas = document.querySelector(selector)
    const frame = canvas?.__sdrHubFrame ?? canvas?.__sdrBoneyardFrame
    return frame?.playerElementEffectPrimaryId === expected
      && frame.playerElementEffectPrimaryIds?.[id] === expected
      && frame.orbSpriteCount > 0
  }, {
    expected: selectedPrimaryId,
    id: playerId,
    selector: canvasSelector,
  }, { timeout: 10_000 })
  const receipt = await page.locator(canvasSelector).evaluate((canvas, id) => {
    const frame = canvas.__sdrHubFrame ?? canvas.__sdrBoneyardFrame
    return {
      localPrimaryId: frame.playerElementEffectPrimaryId,
      orbSpriteCount: frame.orbSpriteCount,
      replicatedPrimaryId: frame.playerElementEffectPrimaryIds[id],
      tick: frame.tick,
    }
  }, playerId)
  assert.equal(receipt.localPrimaryId, selectedPrimaryId)
  assert.equal(receipt.replicatedPrimaryId, selectedPrimaryId)
  assert.ok(receipt.orbSpriteCount > 0)
  return receipt
}

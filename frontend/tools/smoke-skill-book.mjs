import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

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
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
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
  await page.screenshot({ path: `${screenshotRoot}-settled.png` })

  const leviathan = book.getByRole('button', { name: /Call Leviathan, rank 1/ })
  await leviathan.hover()
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

  const missile = book.getByRole('button', { name: /Magic Missile, rank 1/ })
  const quickbarThree = book.getByRole('button', { name: /Quickbar 3, empty/ })
  await missile.dragTo(quickbarThree)
  await book.getByRole('button', { name: /Quickbar 3, Magic Missile/ }).waitFor()

  await page.keyboard.press('Escape')
  await book.waitFor({ state: 'detached', timeout: 5_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
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
  const fireball = book.getByRole('button', { name: /Fireball, rank 1/ })
  await fireball.waitFor({ timeout: 10_000 })
  await fireball.click()
  await page.getByRole('img', { name: 'Fireball primary spell' }).waitFor({ timeout: 10_000 })
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
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)

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
  await boneyardScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  await assertGameSoundMuted(page, false)

  const selectedState = host.state()
  const selectedIndex = selectedState.playerEntities.identities.findIndex(
    ({ playerId: id }) => id === playerId,
  )
  assert.notEqual(selectedIndex, -1)
  assert.deepEqual([
    selectedState.playerEntities.skillRuntimes[selectedIndex].concentrationSkillIdA,
    selectedState.playerEntities.skillRuntimes[selectedIndex].concentrationSkillIdB,
  ], [59, 57])
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
    networkErrors,
    pageErrors,
    selectorAudio: {
      concentrationSelectionAudio,
      primaryOpenAudio,
      primarySelectionAudio,
    },
    primarySelection: 'Fireball after Boneyard selector',
    screenshots: [
      `${screenshotRoot}-settled.png`,
      `${screenshotRoot}-tooltip.png`,
      `${screenshotRoot}-mixed-quickbar.png`,
      `${screenshotRoot}-hud-primary-selector.png`,
      `${screenshotRoot}-hud-selectors.png`,
      `${screenshotRoot}-boneyard-selector.png`,
    ],
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
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

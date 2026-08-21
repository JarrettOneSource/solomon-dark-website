import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

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

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => networkErrors.push(
    `${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
  ))
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
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
  assert.deepEqual(await book.locator('.skill-book-canvas').evaluate((canvas) => ({
    height: canvas.height,
    webgl2: canvas.getContext('webgl2') instanceof WebGL2RenderingContext,
    width: canvas.width,
  })), { height: 900, webgl2: true, width: 1600 })

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

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[16] = 1
  effectiveRanks[16] = 1
  const skillBooks = [...state.playerEntities.skillBooks]
  const progressions = [...state.playerEntities.progressions]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: [...sourceBook.learnedSkillOrder, 16],
    permanentRanks,
  }
  progressions[index] = {
    ...progressions[index],
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions,
      skillBooks,
    }, playerId, getPlayerEconomy(state, playerId)),
  })
  const fireball = book.getByRole('button', { name: /Fireball, rank 1/ })
  await fireball.waitFor({ timeout: 10_000 })
  await fireball.click()
  await page.getByAltText('Fireball primary spell').waitFor({ timeout: 10_000 })
  await page.screenshot({ path: `${screenshotRoot}-mixed-quickbar.png` })

  await page.keyboard.press('Escape')
  await book.waitFor({ state: 'detached', timeout: 5_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    duplicateSecondary: true,
    mixedQuickbar: true,
    pageErrors,
    primarySelection: 'Fireball',
    screenshots: [
      `${screenshotRoot}-tooltip.png`,
      `${screenshotRoot}-mixed-quickbar.png`,
    ],
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

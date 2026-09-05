import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { measureNativeUiText, nativeUiFont, wrapNativeUiText } from '../src/game/native-ui/core.ts'
import {
  HAGATHA_NATIVE_TOOLTIP_LINES,
  HUB_HOVER_BOX,
  hubHagathaTooltipLines,
  hubOwnedPerkSlotRect,
} from '../src/game/renderer/hub-inventory-render-contract.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const productionBuild = process.env.SDR_OVERLAY_PRODUCTION === '1'
const screenshotRoot = process.env.SDR_OVERLAY_SCREENSHOT_ROOT
  || `/tmp/solomon-inventory-tooltip-layering-${process.pid}`
const receipts = []
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const networkErrors = []
let vite = null
let staticServer = null
let baseUrl
if (productionBuild) {
  staticServer = await startStaticClientServer({
    root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
  })
  baseUrl = staticServer.origin
} else {
  vite = await createViteServer({
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
  baseUrl = `http://127.0.0.1:${viteAddress.port}`
}
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())) return
    if (failure === 'net::ERR_ABORTED' && new URL(request.url()).pathname === '/deployment.json') return
    networkErrors.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
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
  await page.addInitScript(bypassStartupAudioPreload)
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialPrompt = page.locator(
    '[data-prompt-kind="tutorial"] .stock-prompt-dialog',
  )
  const tutorialPromptVisible = await tutorialPrompt
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true, () => false)
  if (tutorialPromptVisible) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  await page.evaluate(() => window.__sdrRestoreAudioPreload())
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Earth/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-mind').click()
  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  await hubScene.waitFor({ timeout: 30_000 })
  await hubScene.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor({
    timeout: 10_000,
  })

  await exerciseInventory('College')
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  await exerciseInventory('Boneyard')
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(networkErrors, [])
  console.log(JSON.stringify({ productionBuild, receipts, pageErrors, consoleErrors, networkErrors }))
} catch (error) {
  await page.screenshot({ path: `${screenshotRoot}-failure.png` })
  console.error(error, { pageErrors, consoleErrors, networkErrors,
    scene: await page.locator('.hub-scene, .boneyard-scene').evaluateAll(nodes => nodes.map(node => ({ ...node.dataset }))),
  })
  throw error
} finally {
  await page.close()
  await browser.close()
  await host.close()
  await vite?.close()
  await staticServer?.close()
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

async function tooltipMarginPixels(page, rect) {
  const png = await page.locator('.hub-inventory-native-canvas').screenshot()
  return page.evaluate(async ({ dataUrl, rect }) => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(rect.left, rect.top, rect.width, rect.height)
    let nonBlack = 0
    let maximumChannel = 0
    for (let index = 0; index < data.length; index += 4) {
      const maximum = Math.max(data[index], data[index + 1], data[index + 2])
      if (maximum > 0) nonBlack += 1
      maximumChannel = Math.max(maximumChannel, maximum)
    }
    return { nonBlack, maximumChannel }
  }, { dataUrl: `data:image/png;base64,${png.toString('base64')}`, rect })
}

async function exerciseInventory(scene) {
  const fullGrid = [27, 6, 27, 0, 1, 2, 3, 4, 5]
  const initialPerks = scene === 'College' ? [0, 6, 2] : fullGrid
  await setPerks(initialPerks)
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  while (await inventory.getAttribute('data-native-stats-page') !== '2') {
    const next = Number(await inventory.getAttribute('data-native-stats-page')) + 1
    await inventory.getByRole('button', { name: 'Next player stats page' }).click()
    await inventory.locator(`[data-native-stats-page="${next}"]`).waitFor({ state: 'attached' })
  }
  await waitForPerks(initialPerks)
  await inventory.locator('[data-owned-hagatha-selector="6"]').hover()
  await page.getByRole('tooltip').filter({ hasText: /REVELATION CHARM/ }).waitFor()
  const crossing = await tooltipMarginPixels(page, { left: 367, top: 240, width: 8, height: 8 })
  assert.equal(crossing.nonBlack, 0, `${scene}: Stats chain paints through Revelation Charm`)
  await page.screenshot({ path: `${screenshotRoot}-${scene.toLowerCase()}.png` })

  if (scene === 'College') {
    for (let selector = 0; selector < HAGATHA_NATIVE_TOOLTIP_LINES.length; selector += 1) {
      // Perky Charm (8) has authored copy but cannot be a native owned outcome.
      if (selector === 8) continue
      const selectors = [selector === 0 ? 1 : 0, selector]
      await setPerks(selectors)
      await waitForPerks(selectors)
      await checkPerkMargin(inventory, selector, 1, scene)
    }
    await setPerks(fullGrid)
    await waitForPerks(fullGrid)
  }
  for (const [index, selector] of fullGrid.entries()) {
    await page.mouse.move(700, 450)
    await checkPerkMargin(inventory, selector, index, scene)
  }

  await page.mouse.move(700, 450)
  assert.equal(await page.getByRole('tooltip').count(), 0, `${scene}: stale tooltip after pointer leave`)
  await inventory.locator('[data-owned-hagatha-selector="6"]').focus()
  await page.getByRole('tooltip').waitFor()
  await inventory.getByRole('button', { name: 'Previous player stats page' }).click()
  assert.equal(await page.getByRole('tooltip').count(), 0, `${scene}: stale tooltip after page change`)
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'hidden' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  await page.mouse.move(700, 450)
  await page.keyboard.press('i')
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  assert.equal(await page.getByRole('tooltip').count(), 0, `${scene}: stale tooltip after reopen`)
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'hidden' })
  receipts.push({ scene, crossing, perkVariants: scene === 'College' ? 27 : 8, occupiedCells: 9, teardown: 'pass' })
  console.log(`${scene}: tooltip pixels, all nine cells and teardown passed`)
}

async function setPerks(selectors) {
  await page.mouse.move(700, 450)
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.playerState(playerId)
  assert.ok(state)
  const economy = getPlayerEconomy(state, playerId)
  const tonicPurchases = selectors.filter(selector => selector === 27).length
  Object.assign(state, {
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      charmCapacity: 3 + 3 * tonicPurchases,
      ownedPerkSelectors: selectors,
      revision: economy.revision + 1,
      tonicPurchases,
    }),
  })
}

async function waitForPerks(selectors) {
  await page.waitForFunction(expected => (
    [...document.querySelectorAll('.hub-native-ui-overlay [data-owned-hagatha-selector]')]
      .map(node => Number(node.getAttribute('data-owned-hagatha-selector'))).join(',')
    === expected.join(',')
  ), selectors)
}

async function checkPerkMargin(inventory, selector, index, scene) {
  const cell = inventory.locator('[data-owned-hagatha-selector]').nth(index)
  await cell.hover()
  const lines = hubHagathaTooltipLines({
    cheatDeathCharges: selector === 7 ? 1 : null,
    firstMixed: true,
    price: null,
    selector,
  })
  const tooltip = page.getByRole('tooltip')
  await tooltip.filter({ hasText: lines[0].text }).waitFor()
  const wrapped = lines.map(line => ({
    ...line,
    rows: wrapNativeUiText(line.text, line.font, HUB_HOVER_BOX.contentMaxWidth),
  }))
  const width = 2 * HUB_HOVER_BOX.contentMargin + Math.max(...wrapped.flatMap(line => (
    line.rows.map(text => measureNativeUiText(text, line.font))
  )))
  const height = 2 * HUB_HOVER_BOX.contentMargin + (wrapped.length - 1) * HUB_HOVER_BOX.lineGap
    + wrapped.reduce((sum, line) => sum + line.rows.length * nativeUiFont(line.font).metrics[0], 0)
  const [left, top, cellWidth, cellHeight] = hubOwnedPerkSlotRect(index)
  const boxLeft = left - 53 + cellWidth / 2 + HUB_HOVER_BOX.ownedPerkSourceGap
  const boxTop = Math.max(25, Math.min(900 - 25 - height, top + cellHeight / 2 - height / 2))
  const margin = await tooltipMarginPixels(page, {
    left: Math.ceil(boxLeft + 4),
    top: Math.floor(boxTop + height - 12),
    width: Math.floor(width - 8),
    height: 8,
  })
  assert.equal(margin.nonBlack, 0, `${scene}: ${lines[0].text}, cell ${index}, tooltip margin is obscured`)
}

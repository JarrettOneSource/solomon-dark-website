import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import {
  createServer as createViteServer,
  preview as previewBuiltFrontend,
} from 'vite'

import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { fixedGameViewportLayout } from '../src/game/renderer/game-viewport.ts'
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const viteConfig = fileURLToPath(new URL('../vite.config.ts', import.meta.url))
const production = process.env.SDR_TITLE_PROMPT_SMOKE_PRODUCTION === '1'
const screenshotRoot = process.env.SDR_TITLE_PROMPT_SMOKE_SCREENSHOT_ROOT
  || '/tmp/solomon-title-prompt-responsive'
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const viewports = [
  { height: 900, name: 'stock', width: 1_600 },
  { height: 414, name: 'mobile', width: 896 },
  { height: 1_080, name: 'ultrawide', width: 2_560 },
  { height: 1_000, name: 'tall', width: 1_200 },
]

const vite = production
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
if (!production) await vite.listen()
const address = vite.httpServer?.address()
if (address === null || typeof address === 'string') {
  await vite.close()
  throw new Error('title prompt smoke server did not bind a port')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const save = seededSave()
const receipts = []

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      hasTouch: viewport.name === 'mobile',
      viewport: { height: viewport.height, width: viewport.width },
    })
    const page = await context.newPage()
    const consoleErrors = []
    const failedResponses = []
    const pageErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`)
      }
    })
    await page.route('**/deployment.json*', (route) => route.fulfill({
      body: JSON.stringify({ revision: 'title-prompt-smoke' }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    }))
    await page.addInitScript(bypassStartupAudioPreload)

    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
    await tutorial.waitFor({ timeout: 10_000 })
    const tutorialReceipt = await promptReceipt(page, 'tutorial', viewport)
    const tutorialScreenshot = `${screenshotRoot}-${viewport.name}-tutorial.png`
    await page.screenshot({ path: tutorialScreenshot })

    let resizeReceipt = null
    let resizeScreenshot = null
    if (viewport.name === 'mobile') {
      const resized = { height: 1_000, name: 'mobile-live-resize', width: 1_200 }
      await page.setViewportSize({ height: resized.height, width: resized.width })
      resizeReceipt = await promptReceipt(page, 'tutorial', resized)
      resizeScreenshot = `${screenshotRoot}-${resized.name}-tutorial.png`
      await page.screenshot({ path: resizeScreenshot })
      await page.setViewportSize({ height: viewport.height, width: viewport.width })
      await promptReceipt(page, 'tutorial', viewport)
    }

    await tutorial.getByRole('button', { exact: true, name: 'NO' }).click()
    await tutorial.waitFor({ state: 'detached' })
    await assertCurtainHidden(page)
    assert.equal(await page.locator('.create-menu-scene').count(), 0)
    await page.getByRole('button', { exact: true, name: 'Play' }).click()
    await page.getByRole('button', { exact: true, name: 'New game' }).click()
    await page.locator('.create-menu-scene').waitFor({ state: 'visible', timeout: 10_000 })
    const declineFlow = {
      createVisible: await page.locator('.create-menu-scene').isVisible(),
      collegeVisible: await page.locator('.hub-scene[data-region="courtyard"]').count(),
    }
    assert.deepEqual(declineFlow, { collegeVisible: 0, createVisible: true })

    await seedLocalSave(page, save)
    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
    assert.equal(await page.getByRole('dialog', { name: 'Play the Tutorial?' }).count(), 0)
    await page.getByRole('button', { name: 'Play' }).click()
    await page.getByRole('button', { name: 'New game' }).click()
    const kill = page.getByRole('dialog', { name: 'Kill character?' })
    await kill.waitFor({ timeout: 10_000 })
    const killReceipt = await promptReceipt(page, 'kill-wizard', viewport)
    const killScreenshot = `${screenshotRoot}-${viewport.name}-kill.png`
    await page.screenshot({ path: killScreenshot })
    await kill.getByRole('button', { exact: true, name: 'NO' }).click()
    await kill.waitFor({ state: 'detached' })
    await assertCurtainHidden(page)

    assert.deepEqual(pageErrors, [])
    assert.deepEqual(consoleErrors, [])
    assert.deepEqual(failedResponses, [])
    receipts.push({
      consoleErrors,
      declineFlow,
      failedResponses,
      kill: killReceipt,
      killScreenshot,
      pageErrors,
      resize: resizeReceipt,
      resizeScreenshot,
      tutorial: tutorialReceipt,
      tutorialScreenshot,
      viewport,
    })
    await context.close()
  }

  process.stdout.write(`${JSON.stringify({
    browserVersion: browser.version(),
    production,
    receipts,
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
  await vite.close()
}

async function promptReceipt(page, kind, viewport) {
  const expected = fixedGameViewportLayout(viewport.width, viewport.height)
  try {
    await page.waitForFunction(({ height, kind: promptKind, width }) => {
      const canvas = document.querySelector('.title-menu-canvas')
      const frame = canvas?.__sdrTitleFrame
      return canvas?.getAttribute('data-prompt') === promptKind
        && Math.abs(frame.viewportWidth - width) < 0.01
        && Math.abs(frame.viewportHeight - height) < 0.01
    }, {
      height: expected.height,
      kind,
      width: expected.width,
    }, { timeout: 15_000 })
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const canvas = document.querySelector('.title-menu-canvas')
      return {
        bodyText: document.body.textContent?.slice(0, 500),
        canvasPresent: canvas instanceof HTMLCanvasElement,
        frame: canvas?.__sdrTitleFrame ? structuredClone(canvas.__sdrTitleFrame) : null,
        prompt: canvas?.getAttribute('data-prompt') ?? null,
      }
    })
    throw new Error(`title prompt did not settle: ${JSON.stringify(diagnostic)}`, {
      cause: error,
    })
  }

  const receipt = await page.evaluate((promptKind) => {
    const canvas = document.querySelector('.title-menu-canvas')
    const dialog = document.querySelector(`.stock-prompt-dialog[data-prompt-kind="${promptKind}"]`)
    const stage = dialog?.closest('.stock-prompt-stage')
    if (!(canvas instanceof HTMLCanvasElement) || !(dialog instanceof HTMLElement)
      || !(stage instanceof HTMLElement)) return null
    const rect = (element) => {
      const bounds = element.getBoundingClientRect()
      return {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      }
    }
    const textureSources = JSON.parse(canvas.dataset.textureSources || '[]')
    return {
      actions: [...dialog.querySelectorAll('.stock-prompt-action')].map(rect),
      canvas: rect(canvas),
      dialog: rect(dialog),
      frame: structuredClone(canvas.__sdrTitleFrame),
      prompt: canvas.dataset.prompt,
      stage: rect(stage),
      textureAlpha: {
        composited: canvas.dataset.compositedTextureAlpha,
        native: canvas.dataset.nativeTextureAlpha,
        title: canvas.dataset.titleTextureAlpha,
      },
      textureSources: {
        count: textureSources.length,
        exactTitle: textureSources.some((source) => source.includes('native-ui-title-atlas')),
        looseTitleCrop: textureSources.some((source) => (
          /menu-solomon-|main-menu-(?:cloud-(?:base|detail|shadow)|grass|grave-|horizon|moon)/
            .test(source)
        )),
      },
    }
  }, kind)
  assert.ok(receipt)
  assert.equal(receipt.prompt, kind)
  assert.deepEqual(receipt.textureAlpha, {
    composited: 'premultiply-alpha-on-upload',
    native: 'no-premultiply-alpha',
    title: 'no-premultiply-alpha',
  })
  assert.equal(receipt.textureSources.exactTitle, true)
  assert.equal(receipt.textureSources.looseTitleCrop, false)
  close(receipt.canvas.width, viewport.width, `${kind} canvas width`)
  close(receipt.canvas.height, viewport.height, `${kind} canvas height`)
  const physicalStageWidth = 1_600 * expected.displayScale
  const physicalStageHeight = 900 * expected.displayScale
  close(receipt.stage.width, physicalStageWidth, `${kind} native stage width`)
  close(receipt.stage.height, physicalStageHeight, `${kind} native stage height`)
  close(
    receipt.stage.left - receipt.canvas.left,
    (viewport.width - physicalStageWidth) / 2,
    `${kind} native stage left`,
  )
  close(
    receipt.stage.top - receipt.canvas.top,
    (viewport.height - physicalStageHeight) / 2,
    `${kind} native stage top`,
  )
  assert.equal(receipt.actions.length, 2)
  for (const action of receipt.actions) {
    assert.ok(action.left >= receipt.canvas.left)
    assert.ok(action.right <= receipt.canvas.right)
    assert.ok(action.top >= receipt.canvas.top)
    assert.ok(action.bottom <= receipt.canvas.bottom)
    close(action.width, 200 * expected.displayScale, `${kind} action width`)
    close(action.height, 69 * expected.displayScale, `${kind} action height`)
  }
  return receipt
}

async function assertCurtainHidden(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.title-menu-canvas')
    return canvas?.getAttribute('data-prompt') === 'none'
  }, undefined, { timeout: 10_000 })
}

async function seedLocalSave(page, record) {
  await page.goto(`${baseUrl}/deployment.json`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((seed) => new Promise((resolve, reject) => {
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

function seededSave() {
  const playerId = 'prompt-smoke'
  const state = createGameSimulation({ [playerId]: {
    discipline: 'arcane',
    displayName: 'Prompt Tester',
    element: 'fire',
  } })
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId,
    state,
  })
  return {
    document,
    formatVersion: WEB_GAME_SAVE_SCHEMA_VERSION,
    revision: 1,
    sha256: createHash('sha256').update(document).digest('hex'),
    slot: WEB_GAME_SAVE_SLOT,
    updatedAtUtc: new Date().toISOString(),
  }
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
}

function close(actual, expected, label, tolerance = 0.1) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`,
  )
}

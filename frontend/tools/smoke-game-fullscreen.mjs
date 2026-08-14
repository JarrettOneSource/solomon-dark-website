import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

function captureErrors(page) {
  const consoleErrors = []
  const pageErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  return { consoleErrors, pageErrors }
}

async function openTitle(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
}

async function disableElementFullscreen(page, installed = false) {
  await page.addInitScript((appMode) => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
      configurable: true,
      get: () => false,
    })
    Object.defineProperty(Document.prototype, 'exitFullscreen', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(Document.prototype, 'webkitExitFullscreen', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', {
      configurable: true,
      get: () => false,
    })
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(Navigator.prototype, 'standalone', {
      configurable: true,
      get: () => appMode,
    })
  }, installed)
}

async function proveStandardFullscreen(options, label) {
  const page = await browser.newPage(options)
  const errors = captureErrors(page)
  await openTitle(page)
  const canvas = page.locator('.title-menu-canvas')
  const canvasHandle = await canvas.elementHandle()
  assert.ok(canvasHandle, `expected ${label} title canvas`)
  const button = page.locator('[data-game-fullscreen]')
  assert.equal(await button.getAttribute('data-game-fullscreen-mode'), 'fullscreen')
  assert.equal(await button.getAttribute('aria-label'), 'Enter fullscreen')
  await button.click()
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement)
  assert.equal(await button.getAttribute('aria-label'), 'Exit fullscreen')
  assert.equal(await canvasHandle.evaluate((node) => node.isConnected), true)
  await button.click()
  await page.waitForFunction(() => document.fullscreenElement === null)
  assert.equal(await button.getAttribute('aria-label'), 'Enter fullscreen')
  assert.equal(await canvasHandle.evaluate((node) => node.isConnected), true)
  assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] })
  const buttonBounds = await button.boundingBox()
  const canvasBounds = await canvas.boundingBox()
  assert.ok(buttonBounds)
  assert.ok(canvasBounds)
  const receipt = { button: buttonBounds, canvas: canvasBounds }
  await page.close()
  return receipt
}

const reports = {}
try {
  reports.desktop = await proveStandardFullscreen(
    { viewport: { width: 1280, height: 800 } },
    'desktop',
  )
  reports.mobileLandscape = await proveStandardFullscreen(
    { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } },
    'mobile landscape',
  )
  assert.equal(reports.mobileLandscape.button.width, 44)
  assert.equal(reports.mobileLandscape.button.height, 44)

  const portrait = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })
  const portraitErrors = captureErrors(portrait)
  await portrait.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  const orientationHint = portrait.getByText(/Rotate your device to landscape/)
  await orientationHint.waitFor({ timeout: 90_000 })
  assert.ok(await orientationHint.isVisible())
  const portraitButton = portrait.locator('[data-game-fullscreen]')
  const portraitBounds = await portraitButton.boundingBox()
  assert.ok(portraitBounds)
  assert.equal(portraitBounds.width, 44)
  assert.equal(portraitBounds.height, 44)
  assert.equal(await portraitButton.evaluate((button) => {
    const bounds = button.getBoundingClientRect()
    const topmost = document.elementFromPoint(
      bounds.left + bounds.width / 2,
      bounds.top + bounds.height / 2,
    )
    return topmost === button || button.contains(topmost)
  }), true)
  assert.deepEqual(portraitErrors, { consoleErrors: [], pageErrors: [] })
  reports.mobilePortrait = { button: portraitBounds, topmost: true }
  await portrait.close()

  const unsupported = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 },
  })
  await disableElementFullscreen(unsupported)
  const unsupportedErrors = captureErrors(unsupported)
  await openTitle(unsupported)
  const unsupportedButton = unsupported.getByRole('button', { name: 'Fullscreen options' })
  assert.equal(await unsupportedButton.getAttribute('data-game-fullscreen-mode'), 'install')
  await unsupportedButton.click()
  assert.ok(await unsupported.getByText(/Add to Home Screen/).isVisible())
  assert.equal(await unsupported.evaluate(() => document.fullscreenElement), null)
  assert.deepEqual(unsupportedErrors, { consoleErrors: [], pageErrors: [] })
  reports.unsupported = { installHelp: true }
  await unsupported.close()

  const installed = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 },
  })
  await disableElementFullscreen(installed, true)
  const installedErrors = captureErrors(installed)
  await openTitle(installed)
  assert.equal(await installed.locator('[data-game-fullscreen]').count(), 0)
  assert.deepEqual(installedErrors, { consoleErrors: [], pageErrors: [] })
  reports.installed = { redundantControl: false }
  await installed.close()

  const manifestPage = await browser.newPage()
  const manifestResponse = await manifestPage.request.get(`${baseUrl}/game.webmanifest`)
  const manifest = {
    body: await manifestResponse.json(),
    contentType: manifestResponse.headers()['content-type'] ?? null,
    status: manifestResponse.status(),
  }
  assert.equal(manifest.status, 200)
  assert.match(manifest.contentType, /application\/manifest\+json/)
  assert.equal(manifest.body.start_url, '/game')
  assert.equal(manifest.body.display, 'fullscreen')
  assert.equal(manifest.body.orientation, 'landscape')
  reports.manifest = manifest
  await manifestPage.close()

  process.stdout.write(`${JSON.stringify({ status: 'ok', ...reports })}\n`)
} finally {
  await browser.close()
}

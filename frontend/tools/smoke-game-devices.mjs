import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const deckScreenshotPath = process.env.SDR_GAME_DECK_SCREENSHOT
  || '/tmp/solomon-dark-responsive-deck.png'
const mobileHubScreenshotPath = process.env.SDR_GAME_MOBILE_HUB_SCREENSHOT
  || '/tmp/solomon-dark-responsive-mobile-hub.png'
const mobileBoneyardScreenshotPath = process.env.SDR_GAME_MOBILE_BONEYARD_SCREENSHOT
  || '/tmp/solomon-dark-responsive-mobile-boneyard.png'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

async function enterHubWithPointer(page, element = 'Water') {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-world-canvas').waitFor({ timeout: 30_000 })
}

async function pulseGamepad(page, buttonIndex) {
  await page.evaluate((index) => window.__sdrTestGamepad.setButton(index, true), buttonIndex)
  await page.waitForTimeout(90)
  await page.evaluate((index) => window.__sdrTestGamepad.setButton(index, false), buttonIndex)
  await page.waitForTimeout(140)
}

function assertRect(actual, expected, label, epsilon = 0.05) {
  assert.ok(actual, `expected ${label} bounds`)
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= epsilon,
      `${label} ${key}: expected ${expected[key]}, received ${actual[key]}`,
    )
  }
}

const reports = {}
try {
  const deck = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const deckErrors = []
  deck.on('pageerror', (error) => deckErrors.push(error.message))
  await deck.addInitScript(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, touched: false, value: 0 }))
    const pad = {
      axes: [0, 0, 0, 0],
      buttons,
      connected: true,
      id: 'Steam Deck Built-in Controller',
      index: 0,
      mapping: 'standard',
      timestamp: 0,
      vibrationActuator: null,
    }
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [pad, null, null, null],
    })
    window.__sdrTestGamepad = {
      setAxes(x, y) {
        pad.axes[0] = x
        pad.axes[1] = y
        pad.timestamp += 1
      },
      setButton(index, pressed) {
        buttons[index].pressed = pressed
        buttons[index].touched = pressed
        buttons[index].value = pressed ? 1 : 0
        pad.timestamp += 1
      },
    }
  })
  await deck.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await deck.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await pulseGamepad(deck, 0)
  await pulseGamepad(deck, 0)
  await deck.getByRole('button', { name: 'New Game' }).waitFor()
  await pulseGamepad(deck, 0)
  await pulseGamepad(deck, 0)
  await deck.locator('.create-menu-scene[data-motion-settled="true"]').waitFor()
  await pulseGamepad(deck, 0)
  await pulseGamepad(deck, 0)
  await deck.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await pulseGamepad(deck, 0)
  await pulseGamepad(deck, 0)
  const deckCanvas = deck.locator('.hub-world-canvas')
  await deckCanvas.waitFor({ timeout: 30_000 })
  const deckBefore = await deckCanvas.evaluate((node) => node.__sdrHubFrame.playerX)
  await deck.evaluate(() => window.__sdrTestGamepad.setAxes(1, 0))
  await deck.waitForTimeout(800)
  await deck.evaluate(() => window.__sdrTestGamepad.setAxes(0, 0))
  await deck.waitForTimeout(150)
  const deckAfterStick = await deckCanvas.evaluate((node) => node.__sdrHubFrame.playerX)
  assert.ok(deckAfterStick > deckBefore, `expected stick movement (${deckBefore} -> ${deckAfterStick})`)
  await deck.evaluate(() => window.__sdrTestGamepad.setButton(15, true))
  await deck.waitForTimeout(800)
  await deck.evaluate(() => window.__sdrTestGamepad.setButton(15, false))
  await deck.waitForTimeout(150)
  const deckAfterDpad = await deckCanvas.evaluate((node) => node.__sdrHubFrame.playerX)
  assert.ok(deckAfterDpad > deckAfterStick, `expected D-pad movement (${deckAfterStick} -> ${deckAfterDpad})`)
  const stageBounds = await deck.locator('.main-menu-stage').boundingBox()
  const deckCanvasBounds = await deckCanvas.boundingBox()
  assertRect(stageBounds, { x: 0, y: 0, width: 1280, height: 800 }, 'Steam Deck stage')
  assertRect(deckCanvasBounds, stageBounds, 'Steam Deck canvas')
  const deckScene = deck.locator('.hub-scene')
  assert.equal(Number(await deckScene.getAttribute('data-viewport-width')), 1600)
  assert.equal(Number(await deckScene.getAttribute('data-viewport-height')), 1000)
  assert.equal(Number(await deckScene.getAttribute('data-viewport-scale')), 0.8)
  await deckCanvas.evaluate((node) => { node.__sdrViewportProbe = 'same-canvas' })
  await deck.setViewportSize({ width: 1200, height: 800 })
  await deck.waitForFunction(() => (
    Number(document.querySelector('.hub-scene')?.getAttribute('data-viewport-height')) > 1066
  ))
  assert.equal(
    await deckCanvas.evaluate((node) => node.__sdrViewportProbe),
    'same-canvas',
    'live resize must not remount the renderer canvas',
  )
  assertRect(
    await deck.locator('.main-menu-stage').boundingBox(),
    { x: 0, y: 0, width: 1200, height: 800 },
    'resized Steam Deck stage',
  )
  assertRect(
    await deckCanvas.boundingBox(),
    { x: 0, y: 0, width: 1200, height: 800 },
    'resized Steam Deck canvas',
  )
  await deck.screenshot({ path: deckScreenshotPath })
  assert.deepEqual(deckErrors, [])
  reports.steamDeck = {
    gamepad: 'standard',
    before: deckBefore,
    afterDpad: deckAfterDpad,
    afterStick: deckAfterStick,
    renderer: await deckCanvas.getAttribute('data-renderer-name'),
    screenshotPath: deckScreenshotPath,
    stageBounds,
    viewport: {
      height: Number(await deckScene.getAttribute('data-viewport-height')),
      scale: Number(await deckScene.getAttribute('data-viewport-scale')),
      width: Number(await deckScene.getAttribute('data-viewport-width')),
    },
  }
  await deck.close()

  const mobile = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 },
  })
  const mobileErrors = []
  mobile.on('pageerror', (error) => mobileErrors.push(error.message))
  await enterHubWithPointer(mobile)
  const joystick = mobile.locator('.hub-touch-joystick')
  await joystick.waitFor()
  const joystickBounds = await joystick.boundingBox()
  assert.ok(joystickBounds && joystickBounds.width > 60, 'expected a visible landscape touch joystick')
  const canvas = mobile.locator('.hub-world-canvas')
  const mobileScene = mobile.locator('.hub-scene')
  const mobileStageBounds = await mobile.locator('.main-menu-stage').boundingBox()
  const mobileCanvasBounds = await canvas.boundingBox()
  assertRect(mobileStageBounds, { x: 0, y: 0, width: 844, height: 390 }, 'mobile stage')
  assertRect(mobileCanvasBounds, mobileStageBounds, 'mobile canvas')
  const mobileViewport = {
    height: Number(await mobileScene.getAttribute('data-viewport-height')),
    scale: Number(await mobileScene.getAttribute('data-viewport-scale')),
    width: Number(await mobileScene.getAttribute('data-viewport-width')),
  }
  assert.ok(Math.abs(mobileViewport.height - 900) < 0.001)
  assert.ok(Math.abs(mobileViewport.scale - 390 / 900) < 0.000001)
  assert.ok(Math.abs(mobileViewport.width - 844 / mobileViewport.scale) < 0.001)
  const mapBounds = await mobile.locator('.hub-hud-map').boundingBox()
  assert.ok(mapBounds && mapBounds.x >= 0 && mapBounds.y >= 0)
  assert.ok(mapBounds.x + mapBounds.width <= 844.05)
  assert.ok(mapBounds.y + mapBounds.height <= 390.05)
  const before = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  const centerX = joystickBounds.x + joystickBounds.width / 2
  const centerY = joystickBounds.y + joystickBounds.height / 2
  const mobileCdp = await mobile.context().newCDPSession(mobile)
  await mobileCdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: centerX, y: centerY }],
  })
  await mobileCdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: centerX + joystickBounds.width * 0.3, y: centerY }],
  })
  await mobile.waitForTimeout(800)
  await mobileCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForTimeout(150)
  const after = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  const touchDistance = after - before
  assert.ok(
    touchDistance > 40,
    `expected touch input to remain active through parent snapshot renders (${before} -> ${after})`,
  )
  const hubResolution = Number(await canvas.getAttribute('data-resolution'))
  await mobile.screenshot({ path: mobileHubScreenshotPath })
  await mobile.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const mobileBoneyard = mobile.locator('.boneyard-scene[data-renderer-state="ready"]')
  await mobileBoneyard.waitFor({ timeout: 30_000 })
  const mobileBoneyardCanvas = mobile.locator('.boneyard-world-canvas')
  const mobileBoneyardCanvasBounds = await mobileBoneyardCanvas.boundingBox()
  assertRect(
    mobileBoneyardCanvasBounds,
    { x: 0, y: 0, width: 844, height: 390 },
    'mobile Boneyard canvas',
  )
  const mobileBoneyardViewport = {
    height: Number(await mobileBoneyard.getAttribute('data-viewport-height')),
    scale: Number(await mobileBoneyard.getAttribute('data-viewport-scale')),
    width: Number(await mobileBoneyard.getAttribute('data-viewport-width')),
  }
  assert.deepEqual(mobileBoneyardViewport, mobileViewport)
  const darkness = mobile.locator('.boneyard-darkness')
  const darknessBounds = await darkness.count() > 0 ? await darkness.boundingBox() : null
  if (darknessBounds) assertRect(darknessBounds, mobileBoneyardCanvasBounds, 'mobile darkness')
  const playerScreen = await mobileBoneyardCanvas.evaluate((node) => ({
    x: node.__sdrBoneyardFrame.playerScreenX,
    y: node.__sdrBoneyardFrame.playerScreenY,
  }))
  assert.ok(playerScreen.x >= 0 && playerScreen.x <= mobileBoneyardViewport.width)
  assert.ok(playerScreen.y >= 0 && playerScreen.y <= mobileBoneyardViewport.height)
  await mobile.screenshot({ path: mobileBoneyardScreenshotPath })
  assert.deepEqual(mobileErrors, [])
  reports.mobileLandscape = {
    before,
    after,
    joystickWidth: joystickBounds.width,
    resolution: hubResolution,
    screenshots: {
      boneyard: mobileBoneyardScreenshotPath,
      hub: mobileHubScreenshotPath,
    },
    stageBounds: mobileStageBounds,
    touchDistance,
    viewport: mobileViewport,
    boneyard: {
      darkness: Boolean(darknessBounds),
      playerScreen,
      viewport: mobileBoneyardViewport,
    },
  }
  await mobile.close()

  const portrait = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })
  await portrait.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  const orientationHint = portrait.getByText(/Rotate your device to landscape/)
  await orientationHint.waitFor({ timeout: 90_000 })
  assert.ok(await orientationHint.isVisible())
  reports.mobilePortrait = { orientationHint: true }
  await portrait.close()

  process.stdout.write(JSON.stringify({ status: 'ok', ...reports }) + '\n')
} finally {
  await browser.close()
}

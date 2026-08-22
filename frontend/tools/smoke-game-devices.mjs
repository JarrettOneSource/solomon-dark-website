import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import {
  assertBoneyardCombatSealed,
  crossEntryGateWithJoystick,
  waitForBoneyardCombatAdmission,
  walkToSolomonWithJoystick,
} from './smoke-boneyard-combat-admission.mjs'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const deckScreenshotPath = process.env.SDR_GAME_DECK_SCREENSHOT
  || '/tmp/solomon-dark-responsive-deck.png'
const mobileHubScreenshotPath = process.env.SDR_GAME_MOBILE_HUB_SCREENSHOT
  || '/tmp/solomon-dark-responsive-mobile-hub.png'
const mobileBoneyardScreenshotPath = process.env.SDR_GAME_MOBILE_BONEYARD_SCREENSHOT
  || '/tmp/solomon-dark-responsive-mobile-boneyard.png'
const mobileSettingsScreenshotPath = process.env.SDR_GAME_MOBILE_SETTINGS_SCREENSHOT
  || '/tmp/solomon-dark-responsive-mobile-settings.png'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

async function enterHubWithPointer(page, element = 'Water', navigate = true) {
  if (navigate) await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene').waitFor({ timeout: 15_000 })
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

function rectsOverlap(first, second) {
  assert.ok(first && second, 'expected both element bounds')
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  )
}

function rectCenter(rect) {
  assert.ok(rect, 'expected element bounds')
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

async function touchStart(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
}

async function touchMove(cdp, x, y) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y }],
  })
}

async function touchEnd(cdp, type = 'touchEnd') {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [] })
}

async function installLifecycleHarness(page) {
  await page.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = function decode() {
      if (this.src.includes('/create-hand-')) {
        return Promise.reject(new DOMException('Forced redundant hand decode rejection'))
      }
      return nativeDecode.call(this)
    }

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window)
    const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window)
    const animationFrames = new Map()
    let nextAnimationFrameId = 1
    let animationFramesPaused = false

    const scheduleAnimationFrame = (id) => {
      const frame = animationFrames.get(id)
      if (!frame || animationFramesPaused || frame.nativeId !== null) return
      frame.nativeId = nativeRequestAnimationFrame((now) => {
        animationFrames.delete(id)
        frame.callback(now)
      })
    }

    window.requestAnimationFrame = (callback) => {
      const id = nextAnimationFrameId
      nextAnimationFrameId += 1
      animationFrames.set(id, { callback, nativeId: null })
      scheduleAnimationFrame(id)
      return id
    }
    window.cancelAnimationFrame = (id) => {
      const frame = animationFrames.get(id)
      if (frame && frame.nativeId !== null) nativeCancelAnimationFrame(frame.nativeId)
      animationFrames.delete(id)
    }

    const visibilityState = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'visibilityState',
    ).get
    const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden').get
    let hiddenOverride = null
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => hiddenOverride === null
        ? visibilityState.call(document)
        : hiddenOverride ? 'hidden' : 'visible',
    })
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hiddenOverride === null ? hidden.call(document) : hiddenOverride,
    })

    window.__sdrTestLifecycle = {
      pauseAnimationFrames() {
        animationFramesPaused = true
        for (const frame of animationFrames.values()) {
          if (frame.nativeId !== null) nativeCancelAnimationFrame(frame.nativeId)
          frame.nativeId = null
        }
      },
      resumeAnimationFrames() {
        animationFramesPaused = false
        for (const id of animationFrames.keys()) scheduleAnimationFrame(id)
      },
      setHidden(value) {
        hiddenOverride = value
        document.dispatchEvent(new Event('visibilitychange'))
      },
    }
  })
}

async function settledPosition(page, readPosition, label) {
  await page.waitForTimeout(600)
  const firstMotion = await presentationMotion(page)
  if (firstMotion?.kind === 'hub' && firstMotion.moving) {
    await page.waitForFunction(() => (
      document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerMoving === false
    ), null, { timeout: 3_000 })
  }
  const afterTail = await readPosition()
  const afterTailMotion = await presentationMotion(page)
  await page.waitForTimeout(600)
  const settled = await readPosition()
  const settledMotion = await presentationMotion(page)
  assert.ok(
    Math.abs(settled - afterTail) < 1,
    `${label} remained latched after its movement tail (${afterTail} -> ${settled}; ${JSON.stringify({ afterTailMotion, settledMotion })})`,
  )
  return { afterTail, afterTailMotion, settled, settledMotion }
}

async function presentationMotion(page) {
  return page.evaluate(() => {
    const hub = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    if (hub) return { kind: 'hub', moving: hub.playerMoving, tick: hub.tick, x: hub.playerX }
    const boneyard = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return boneyard
      ? { kind: 'boneyard', tick: boneyard.tick, x: boneyard.playerX }
      : null
  })
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
  const titleCanvas = deck.locator('.title-menu-canvas')
  await titleCanvas.waitFor()
  const titleCanvasHandle = await titleCanvas.elementHandle()
  assert.ok(titleCanvasHandle, 'expected the Steam Deck title canvas')
  const titleStageBounds = await deck.locator('.main-menu-stage').boundingBox()
  assertRect(titleStageBounds, { x: 0, y: 0, width: 1280, height: 800 }, 'Steam Deck title stage')
  assertRect(await titleCanvas.boundingBox(), titleStageBounds, 'Steam Deck title canvas')
  assertRect(
    await deck.locator(
      '.main-menu-native-stage:not(.main-menu-quit-stage):not(.main-menu-account-stage)',
    ).boundingBox(),
    { x: 0, y: 40, width: 1280, height: 720 },
    'Steam Deck title native stage',
  )
  assert.equal(Number(await titleCanvas.getAttribute('data-viewport-width')), 1600)
  assert.equal(Number(await titleCanvas.getAttribute('data-viewport-height')), 1000)

  assert.equal(
    await deck.locator('[data-game-fullscreen]').getAttribute('aria-label'),
    'Enter fullscreen',
  )
  const fullscreenButton = deck.locator('[data-game-fullscreen]')
  await fullscreenButton.click()
  await deck.waitForFunction(() => document.fullscreenElement === document.documentElement)
  await deck.waitForFunction(() => (
    document.querySelector('[data-game-fullscreen]')?.getAttribute('aria-label') === 'Exit fullscreen'
  ))
  assert.equal(await fullscreenButton.getAttribute('aria-label'), 'Exit fullscreen')
  assert.equal(await titleCanvasHandle.evaluate((node) => node.isConnected), true)
  await fullscreenButton.click()
  await deck.waitForFunction(() => document.fullscreenElement === null)
  await deck.waitForFunction(() => (
    document.querySelector('[data-game-fullscreen]')?.getAttribute('aria-label') === 'Enter fullscreen'
  ))
  assert.equal(await fullscreenButton.getAttribute('aria-label'), 'Enter fullscreen')
  assert.equal(await titleCanvasHandle.evaluate((node) => node.isConnected), true)
  await deck.reload({ waitUntil: 'domcontentloaded' })
  await deck.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })

  await pulseGamepad(deck, 0)
  await pulseGamepad(deck, 0)
  await deck.getByRole('button', { name: 'New Game' }).waitFor()
  await pulseGamepad(deck, 0)
  await pulseGamepad(deck, 0)
  await deck.locator('.create-menu-scene[data-motion-settled="true"]').waitFor()
  const createCanvas = deck.locator('.create-menu-canvas')
  const createCanvasHandle = await createCanvas.elementHandle()
  assert.ok(createCanvasHandle, 'expected the Steam Deck Create canvas')
  const createFullscreenButton = deck.locator('[data-game-fullscreen]')
  assertRect(await createCanvas.boundingBox(), titleStageBounds, 'Steam Deck Create canvas')
  assertRect(
    await deck.locator('.create-menu-native-back-stage').boundingBox(),
    { x: 0, y: 0, width: 1280, height: 720 },
    'Steam Deck Create back stage',
  )
  assertRect(
    await deck.locator('.create-menu-native-name-stage').boundingBox(),
    { x: 0, y: 0, width: 1280, height: 720 },
    'Steam Deck Create name stage',
  )
  assertRect(
    await deck.locator('.create-menu-native-action-stage').boundingBox(),
    { x: 0, y: 80, width: 1280, height: 720 },
    'Steam Deck Create action stage',
  )
  assert.equal(Number(await createCanvas.getAttribute('data-viewport-width')), 1600)
  assert.equal(Number(await createCanvas.getAttribute('data-viewport-height')), 1000)
  assert.equal(await createCanvasHandle.evaluate((node) => node.isConnected), true)
  assert.equal(await createFullscreenButton.getAttribute('aria-label'), 'Enter fullscreen')
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
  await installLifecycleHarness(mobile)
  const mobileErrors = []
  mobile.on('pageerror', (error) => mobileErrors.push(error.message))
  await mobile.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await mobile.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const mobileTitleCanvas = mobile.locator('.title-menu-canvas')
  const mobileTitleStageBounds = await mobile.locator('.main-menu-stage').boundingBox()
  assertRect(
    mobileTitleStageBounds,
    { x: 0, y: 0, width: 844, height: 390 },
    'mobile title stage',
  )
  assertRect(await mobileTitleCanvas.boundingBox(), mobileTitleStageBounds, 'mobile title canvas')
  assertRect(
    await mobile.locator(
      '.main-menu-native-stage:not(.main-menu-quit-stage):not(.main-menu-account-stage)',
    ).boundingBox(),
    { x: (844 - 1600 * (390 / 900)) / 2, y: 0, width: 1600 * (390 / 900), height: 390 },
    'mobile title native stage',
  )
  assert.ok(
    Math.abs(Number(await mobileTitleCanvas.getAttribute('data-viewport-width')) - 844 / (390 / 900)) < 0.001,
  )
  assert.equal(Number(await mobileTitleCanvas.getAttribute('data-viewport-height')), 900)
  await enterHubWithPointer(mobile, 'Water', false)
  const joystick = mobile.locator('[data-joystick="movement"]')
  const joystickKnob = joystick.locator('.game-touch-joystick-knob')
  await joystick.waitFor()
  const joystickBounds = await joystick.boundingBox()
  assert.ok(joystickBounds && joystickBounds.width > 60, 'expected a visible landscape touch joystick')
  // the shared Hub is noncombat: the primary attack lane exists only in the Boneyard
  assert.equal(
    await mobile.locator('[data-joystick="primary"]').count(),
    0,
    'the Hub must not render the primary attack joystick',
  )
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
  assert.equal(
    rectsOverlap(joystickBounds, mapBounds),
    false,
    'movement joystick must not cover the Hub map control',
  )
  const before = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  const centerX = joystickBounds.x + joystickBounds.width / 2
  const centerY = joystickBounds.y + joystickBounds.height / 2
  const requestedOffset = joystickBounds.width * 0.3
  const mobileCdp = await mobile.context().newCDPSession(mobile)

  await joystick.evaluate((node) => {
    node.addEventListener('pointerdown', (event) => {
      window.__sdrLastTouchPointerId = event.pointerId
    })
  })
  await touchStart(mobileCdp, centerX, centerY)
  await touchMove(mobileCdp, centerX + requestedOffset, centerY)
  await mobile.waitForTimeout(50)
  const heldKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(
    Math.abs(heldKnobCenter.x - (centerX + requestedOffset)) < 1,
    `expected scaled joystick knob to follow the touch (${heldKnobCenter.x} vs ${centerX + requestedOffset})`,
  )
  assert.ok(Math.abs(heldKnobCenter.y - centerY) < 1)
  await mobile.waitForTimeout(800)
  await touchEnd(mobileCdp)
  const normalRelease = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'normal touch release',
  )
  const releasedKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(Math.abs(releasedKnobCenter.x - centerX) < 1)
  assert.ok(Math.abs(releasedKnobCenter.y - centerY) < 1)
  const after = normalRelease.afterTail
  const touchDistance = after - before
  assert.ok(
    touchDistance > 40,
    `expected touch input to remain active through parent snapshot renders (${before} -> ${after})`,
  )

  // a held walk in the sealed Hub moves the player and never arms a cast
  const sealedWalkBefore = normalRelease.settled
  await mobileCdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 11, x: centerX, y: centerY }],
  })
  await mobileCdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 11, x: centerX - requestedOffset, y: centerY }],
  })
  await mobile.waitForTimeout(350)
  const sealedWalkHeld = await canvas.evaluate((node) => ({
    playerAttachmentPose: node.__sdrHubFrame.playerAttachmentPose,
    playerX: node.__sdrHubFrame.playerX,
    primarySpellKinds: [...node.__sdrHubFrame.primarySpellKinds],
  }))
  assert.ok(sealedWalkBefore - sealedWalkHeld.playerX > 10, 'left touch must move in the Hub')
  assert.deepEqual(sealedWalkHeld.primarySpellKinds, [], 'the Hub walk must not arm a cast')
  assert.equal(sealedWalkHeld.playerAttachmentPose, 0)
  await touchEnd(mobileCdp)
  const concurrentRelease = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'sealed Hub walk release',
  )
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerAttachmentPose === 0
      && (frame.primarySpellKinds?.length ?? 0) === 0
  }, null, { timeout: 10_000 })
  const sealedWalkKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(Math.abs(sealedWalkKnobCenter.x - centerX) < 1)
  assert.ok(Math.abs(sealedWalkKnobCenter.y - centerY) < 1)

  const cancelBefore = concurrentRelease.settled
  await touchStart(mobileCdp, centerX, centerY)
  await touchMove(mobileCdp, centerX - requestedOffset, centerY)
  await mobile.waitForTimeout(300)
  const cancelHeld = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  assert.ok(cancelBefore - cancelHeld > 10, 'expected cancellation probe to hold left movement')
  await touchEnd(mobileCdp, 'touchCancel')
  const pointerCancel = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'pointer cancellation',
  )
  const cancelledKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(Math.abs(cancelledKnobCenter.x - centerX) < 1)
  assert.ok(Math.abs(cancelledKnobCenter.y - centerY) < 1)

  const lostCaptureBefore = pointerCancel.settled
  await touchStart(mobileCdp, centerX, centerY)
  await touchMove(mobileCdp, centerX + requestedOffset, centerY)
  await mobile.waitForTimeout(100)
  const activePointerId = await mobile.evaluate(() => window.__sdrLastTouchPointerId)
  assert.equal(typeof activePointerId, 'number')
  await joystick.evaluate((node, pointerId) => node.releasePointerCapture(pointerId), activePointerId)
  await touchMove(mobileCdp, centerX + joystickBounds.width, centerY)
  await mobile.waitForTimeout(300)
  const lostCaptureHeld = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  assert.ok(
    lostCaptureHeld - lostCaptureBefore > 10,
    'expected window tracking to retain the active contact after capture loss',
  )
  await touchEnd(mobileCdp)
  const lostCaptureRelease = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'release after pointer-capture loss',
  )
  const lostCaptureKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(Math.abs(lostCaptureKnobCenter.x - centerX) < 1)
  assert.ok(Math.abs(lostCaptureKnobCenter.y - centerY) < 1)

  await touchStart(mobileCdp, centerX, centerY)
  await touchMove(mobileCdp, centerX - requestedOffset, centerY)
  await mobile.waitForTimeout(200)
  await mobile.evaluate(() => window.dispatchEvent(new Event('blur')))
  const focusInterruption = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'focus interruption',
  )
  const blurredKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(Math.abs(blurredKnobCenter.x - centerX) < 1)
  assert.ok(Math.abs(blurredKnobCenter.y - centerY) < 1)
  await touchEnd(mobileCdp)

  const reuseBefore = focusInterruption.settled
  await touchStart(mobileCdp, centerX, centerY)
  await touchMove(mobileCdp, centerX + requestedOffset, centerY)
  await mobile.waitForTimeout(300)
  await touchEnd(mobileCdp)
  const gestureReuse = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'gesture after focus interruption',
  )
  assert.ok(
    gestureReuse.afterTail - reuseBefore > 10,
    'expected a new gesture after focus interruption',
  )

  const visibilityStart = gestureReuse.settled
  await touchStart(mobileCdp, centerX, centerY)
  await touchMove(mobileCdp, centerX - requestedOffset, centerY)
  await mobile.waitForTimeout(300)
  const visibilityBefore = await canvas.evaluate((node) => node.__sdrHubFrame.playerX)
  assert.ok(
    visibilityStart - visibilityBefore > 10,
    'expected held movement before the visibility-suspension probe',
  )
  await mobile.evaluate(() => {
    window.__sdrTestLifecycle.pauseAnimationFrames()
    window.__sdrTestLifecycle.setHidden(true)
  })
  await new Promise((resolve) => setTimeout(resolve, 1_200))
  await mobile.evaluate(() => {
    window.__sdrTestLifecycle.setHidden(false)
    window.__sdrTestLifecycle.resumeAnimationFrames()
  })
  await touchEnd(mobileCdp)
  const visibilityInterruption = await settledPosition(
    mobile,
    () => canvas.evaluate((node) => node.__sdrHubFrame.playerX),
    'visibility interruption during render suspension',
  )
  const visibilitySuspensionTravel = Math.abs(
    visibilityInterruption.afterTail - visibilityBefore,
  )
  assert.ok(
    visibilitySuspensionTravel < 40,
    `hidden render suspension retained authoritative input (${visibilitySuspensionTravel})`,
  )
  const visibilityKnobCenter = rectCenter(await joystickKnob.boundingBox())
  assert.ok(Math.abs(visibilityKnobCenter.x - centerX) < 1)
  assert.ok(Math.abs(visibilityKnobCenter.y - centerY) < 1)
  await mobileScene.focus()
  await mobile.keyboard.press('Escape')
  const mobilePause = mobile.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await mobilePause.waitFor()
  await mobile.waitForTimeout(350)
  await mobilePause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  const mobileSettings = mobile.locator('.game-settings-dialog')
  await mobileSettings.waitFor()
  await mobileSettings.getByRole('slider', { name: 'CAMERA FOV' }).fill('125')
  await mobileSettings.getByRole('slider', { name: 'UI SCALE' }).fill('150')
  assert.equal(await mobileScene.getAttribute('data-camera-zoom'), '0.96')
  assert.equal(await mobileScene.getAttribute('data-ui-scale'), '1.5')
  await mobile.screenshot({ path: mobileSettingsScreenshotPath })
  await mobileSettings.getByRole('button', { name: 'DONE' }).click()
  await mobileSettings.waitFor({ state: 'detached' })
  const scaledJoystickBounds = await joystick.boundingBox()
  assert.ok(scaledJoystickBounds)
  assert.ok(Math.abs(scaledJoystickBounds.width / joystickBounds.width - 1.5) < 0.01)
  assert.equal(
    await mobile.locator('[data-joystick="primary"]').count(),
    0,
    'the scaled Hub must still not render the primary attack joystick',
  )
  const scaledMapBounds = await mobile.locator('.hub-hud-map').boundingBox()
  assert.ok(scaledMapBounds && scaledMapBounds.x >= 0 && scaledMapBounds.y >= 0)
  assert.ok(scaledMapBounds.x + scaledMapBounds.width <= 844.05)
  assert.ok(scaledMapBounds.y + scaledMapBounds.height <= 390.05)
  assert.equal(
    rectsOverlap(scaledJoystickBounds, scaledMapBounds),
    false,
    'scaled movement joystick must not cover the scaled Hub map control',
  )
  const hubResolution = Number(await canvas.getAttribute('data-resolution'))
  await mobile.screenshot({ path: mobileHubScreenshotPath })

  const scaledCenter = rectCenter(scaledJoystickBounds)
  await touchStart(mobileCdp, scaledCenter.x, scaledCenter.y)
  await touchMove(
    mobileCdp,
    scaledCenter.x + scaledJoystickBounds.width * 0.3,
    scaledCenter.y,
  )
  await mobile.waitForTimeout(200)
  await mobile.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const mobileBoneyard = mobile.locator('.boneyard-scene[data-renderer-state="ready"]')
  await mobileBoneyard.waitFor({ timeout: 30_000 })
  await touchEnd(mobileCdp)
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
  const environmentLight = mobile.locator('.boneyard-environment-light')
  const environmentLightBounds = await environmentLight.count() > 0
    ? await environmentLight.boundingBox()
    : null
  if (environmentLightBounds) {
    assertRect(
      environmentLightBounds,
      mobileBoneyardCanvasBounds,
      'mobile environment light',
    )
  }
  const playerScreen = await mobileBoneyardCanvas.evaluate((node) => ({
    x: node.__sdrBoneyardFrame.playerScreenX,
    y: node.__sdrBoneyardFrame.playerScreenY,
  }))
  assert.ok(playerScreen.x >= 0 && playerScreen.x <= mobileBoneyardViewport.width)
  assert.ok(playerScreen.y >= 0 && playerScreen.y <= mobileBoneyardViewport.height)
  const sceneTeardown = await settledPosition(
    mobile,
    () => mobileBoneyardCanvas.evaluate((node) => node.__sdrBoneyardFrame.playerX),
    'Hub-to-Boneyard joystick teardown',
  )
  const boneyardJoystick = mobile.locator('[data-joystick="movement"]')
  const boneyardKnob = boneyardJoystick.locator('.game-touch-joystick-knob')
  const boneyardPrimaryJoystick = mobile.locator('[data-joystick="primary"]')
  const boneyardPrimaryKnob = boneyardPrimaryJoystick.locator('.game-touch-joystick-knob')
  await boneyardJoystick.waitFor()
  await boneyardPrimaryJoystick.waitFor()
  const boneyardJoystickBounds = await boneyardJoystick.boundingBox()
  const boneyardPrimaryBounds = await boneyardPrimaryJoystick.boundingBox()
  assert.ok(
    boneyardJoystickBounds && boneyardJoystickBounds.width > 60,
    'expected a visible Boneyard movement joystick',
  )
  assert.ok(
    boneyardPrimaryBounds && boneyardPrimaryBounds.width > 60,
    'expected a visible Boneyard primary attack joystick',
  )
  const boneyardCenter = rectCenter(boneyardJoystickBounds)
  const boneyardBefore = sceneTeardown.settled
  await touchStart(mobileCdp, boneyardCenter.x, boneyardCenter.y)
  await touchMove(
    mobileCdp,
    boneyardCenter.x - boneyardJoystickBounds.width * 0.3,
    boneyardCenter.y,
  )
  await mobile.waitForTimeout(300)
  await touchEnd(mobileCdp)
  const boneyardRelease = await settledPosition(
    mobile,
    () => mobileBoneyardCanvas.evaluate((node) => node.__sdrBoneyardFrame.playerX),
    'Boneyard touch release',
  )
  assert.ok(
    boneyardBefore - boneyardRelease.afterTail > 10,
    'expected the Boneyard joystick to own a fresh gesture',
  )
  const boneyardKnobCenter = rectCenter(await boneyardKnob.boundingBox())
  assert.ok(Math.abs(boneyardKnobCenter.x - boneyardCenter.x) < 1)
  assert.ok(Math.abs(boneyardKnobCenter.y - boneyardCenter.y) < 1)

  const boneyardPrimaryCenter = rectCenter(boneyardPrimaryBounds)
  // combat is sealed until Solomon runs: prove the seal, then earn admission
  // the way a player does before the primary joystick is expected to cast
  const boneyardScene = mobile.locator('.boneyard-scene')
  const sealedBoneyardSamples = await assertBoneyardCombatSealed(mobile, mobileCdp, boneyardScene, {
    center: boneyardPrimaryCenter,
    offset: boneyardPrimaryBounds.width * 0.3,
  })
  const gateCrossing = await crossEntryGateWithJoystick(mobile, mobileCdp, boneyardScene, boneyardJoystickBounds)
  const solomonApproach = await walkToSolomonWithJoystick(mobile, mobileCdp, boneyardScene, boneyardJoystickBounds)
  const combatAdmission = await waitForBoneyardCombatAdmission(mobile, boneyardScene)
  // the approach moved the player: later gestures measure from where the walk
  // released, which must itself latch like every other release
  const solomonApproachRelease = await settledPosition(
    mobile,
    () => mobileBoneyardCanvas.evaluate((node) => node.__sdrBoneyardFrame.playerX),
    'Solomon approach release',
  )
  await touchStart(mobileCdp, boneyardPrimaryCenter.x, boneyardPrimaryCenter.y)
  await touchMove(
    mobileCdp,
    boneyardPrimaryCenter.x + boneyardPrimaryBounds.width * 0.3,
    boneyardPrimaryCenter.y,
  )
  const boneyardPrimaryAttackHandle = await mobile.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.primarySpellKinds?.includes('water')
      ? { ...frame, primarySpellKinds: [...frame.primarySpellKinds] }
      : null
  }, null, { timeout: 10_000 })
  const boneyardPrimaryAttack = await boneyardPrimaryAttackHandle.jsonValue()
  await boneyardPrimaryAttackHandle.dispose()
  await touchEnd(mobileCdp)
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && !frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const boneyardPrimaryReleasedCenter = rectCenter(await boneyardPrimaryKnob.boundingBox())
  assert.ok(Math.abs(boneyardPrimaryReleasedCenter.x - boneyardPrimaryCenter.x) < 1)
  assert.ok(Math.abs(boneyardPrimaryReleasedCenter.y - boneyardPrimaryCenter.y) < 1)

  const boneyardConcurrentBefore = solomonApproachRelease.settled
  const boneyardRequestedOffset = boneyardJoystickBounds.width * 0.3
  const boneyardPrimaryRequestedOffset = boneyardPrimaryBounds.width * 0.3
  await mobileCdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 11, x: boneyardCenter.x, y: boneyardCenter.y },
      { id: 22, x: boneyardPrimaryCenter.x, y: boneyardPrimaryCenter.y },
    ],
  })
  await mobileCdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      {
        id: 11,
        x: boneyardCenter.x - boneyardRequestedOffset,
        y: boneyardCenter.y,
      },
      {
        id: 22,
        x: boneyardPrimaryCenter.x + boneyardPrimaryRequestedOffset,
        y: boneyardPrimaryCenter.y,
      },
    ],
  })
  await mobile.waitForTimeout(350)
  const boneyardConcurrentHeld = await mobileBoneyardCanvas.evaluate((node) => ({
    playerX: node.__sdrBoneyardFrame.playerX,
    primarySpellKinds: [...node.__sdrBoneyardFrame.primarySpellKinds],
  }))
  assert.ok(
    boneyardConcurrentBefore - boneyardConcurrentHeld.playerX > 10,
    'left touch must move during a Boneyard attack',
  )
  assert.ok(boneyardConcurrentHeld.primarySpellKinds.includes('water'))
  await touchEnd(mobileCdp)
  const boneyardConcurrentRelease = await settledPosition(
    mobile,
    () => mobileBoneyardCanvas.evaluate((node) => node.__sdrBoneyardFrame.playerX),
    'simultaneous Boneyard movement and primary attack release',
  )
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && !frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const boneyardConcurrentMovementCenter = rectCenter(await boneyardKnob.boundingBox())
  const boneyardConcurrentPrimaryCenter = rectCenter(await boneyardPrimaryKnob.boundingBox())
  assert.ok(Math.abs(boneyardConcurrentMovementCenter.x - boneyardCenter.x) < 1)
  assert.ok(Math.abs(boneyardConcurrentMovementCenter.y - boneyardCenter.y) < 1)
  assert.ok(Math.abs(boneyardConcurrentPrimaryCenter.x - boneyardPrimaryCenter.x) < 1)
  assert.ok(Math.abs(boneyardConcurrentPrimaryCenter.y - boneyardPrimaryCenter.y) < 1)
  await mobile.screenshot({ path: mobileBoneyardScreenshotPath })
  assert.deepEqual(mobileErrors, [])
  reports.mobileLandscape = {
    before,
    after,
    joystickWidth: joystickBounds.width,
    scaledJoystickWidth: scaledJoystickBounds.width,
    boneyardPrimaryJoystickWidth: boneyardPrimaryBounds.width,
    primaryAttack: {
      boneyard: boneyardPrimaryAttack,
      concurrentHeld: boneyardConcurrentHeld,
      boneyardSealedHoldSamples: sealedBoneyardSamples,
      combatAdmission,
      gateCrossing,
      hubDisabled: true,
      hubSealedWalk: sealedWalkHeld,
      solomonApproach,
    },
    resolution: hubResolution,
    screenshots: {
      boneyard: mobileBoneyardScreenshotPath,
      hub: mobileHubScreenshotPath,
      settings: mobileSettingsScreenshotPath,
    },
    stageBounds: mobileStageBounds,
    touchDistance,
    touchLifecycle: {
      boneyardConcurrentRelease,
      boneyardRelease,
      focusInterruption,
      gestureReuse,
      lostCaptureRelease,
      normalRelease,
      pointerCancel,
      sceneTeardown,
      solomonApproachRelease,
      visibilityInterruption: {
        ...visibilityInterruption,
        suspensionTravel: visibilitySuspensionTravel,
      },
    },
    viewport: mobileViewport,
    boneyard: {
      environmentLight: Boolean(environmentLightBounds),
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

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

// Drives the PRODUCTION bundle (vite preview + a real game host injected via
// window.solomonDarkRuntime), not the dev server. The dev server's unminified
// CSS kept the independent `translate` property that centered the joystick
// knob; the production pipeline folds that property into `transform`, which
// inline styles override. This smoke exists so build-pipeline CSS behavior is
// asserted on the surface users actually receive.
const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const endpointUrl = process.env.SDR_GAME_ENDPOINT_URL
const endpointCredential = process.env.SDR_GAME_ENDPOINT_CREDENTIAL
assert.ok(
  endpointUrl && endpointCredential,
  'SDR_GAME_ENDPOINT_URL and SDR_GAME_ENDPOINT_CREDENTIAL are required',
)
const idleScreenshotPath = process.env.SDR_JOYSTICK_IDLE_SCREENSHOT
  || '/tmp/solomon-dark-built-joystick-idle.png'
const heldScreenshotPath = process.env.SDR_JOYSTICK_HELD_SCREENSHOT
  || '/tmp/solomon-dark-built-joystick-held.png'

function rectCenter(rect) {
  assert.ok(rect, 'expected element bounds')
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function rectsOverlap(first, second) {
  assert.ok(first && second, 'expected both element bounds')
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

async function settledBounds(locator, page) {
  let previous = ''
  let stable = 0
  for (let sample = 0; sample < 160; sample += 1) {
    const bounds = await locator.boundingBox()
    const key = JSON.stringify(bounds)
    stable = key === previous ? stable + 1 : 0
    previous = key
    if (stable >= 10) return bounds
    await page.waitForTimeout(30)
  }
  assert.fail('knob bounds never settled')
}

async function assertGameSurface(page, memberSelector) {
  const member = page.locator(memberSelector).first()
  await member.waitFor()
  const receipt = await member.evaluate((node) => {
    const surface = node.closest('.game-surface')
    if (!surface) return null
    const style = getComputedStyle(surface)
    const contextMenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true })
    const contextMenuAllowed = node.dispatchEvent(contextMenu)
    const dragStartAllowed = node.dispatchEvent(dragStart)
    return {
      contextMenuCanceled: !contextMenuAllowed && contextMenu.defaultPrevented,
      dragStartCanceled: !dragStartAllowed && dragStart.defaultPrevented,
      overscrollBehavior: style.overscrollBehavior,
      tapHighlight: style.webkitTapHighlightColor,
      touchAction: style.touchAction,
      userSelect: style.userSelect,
      webkitUserSelect: style.webkitUserSelect,
    }
  })
  assert.ok(receipt, `${memberSelector} must be inside the persistent game surface`)
  assert.equal(receipt.contextMenuCanceled, true)
  assert.equal(receipt.dragStartCanceled, true)
  assert.equal(receipt.overscrollBehavior, 'none')
  assert.equal(receipt.tapHighlight, 'rgba(0, 0, 0, 0)')
  assert.equal(receipt.touchAction, 'manipulation')
  assert.equal(receipt.userSelect, 'none')
  assert.equal(receipt.webkitUserSelect, 'none')
  return receipt
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const mobile = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 },
  })
  const browserSurfaceReceipts = {}
  const consoleErrors = []
  const pageErrors = []
  mobile.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  mobile.on('pageerror', (error) => pageErrors.push(error.message))
  await mobile.addInitScript(([url, credential]) => {
    window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', url, credential } }
  }, [endpointUrl, endpointCredential])

  await mobile.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await mobile.locator('.native-loader-page').waitFor({ timeout: 15_000 })
  browserSurfaceReceipts.loader = await assertGameSurface(mobile, '.native-loader-page')
  try {
    await mobile.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  } catch (error) {
    const failurePath = idleScreenshotPath.replace(/\.png$/, '-failure.png')
    await mobile.screenshot({ path: failurePath })
    process.stderr.write(`menu never appeared; page errors: ${JSON.stringify(pageErrors)}; screenshot: ${failurePath}\n`)
    throw error
  }
  browserSurfaceReceipts.title = await assertGameSurface(mobile, '.main-menu-page')
  await mobile.getByRole('button', { name: 'Play' }).click()
  await mobile.getByRole('button', { name: 'New Game' }).click()
  await mobile.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  browserSurfaceReceipts.create = await assertGameSurface(mobile, '.create-menu-scene')
  await mobile.getByRole('button', { name: /Water/i }).click()
  await mobile.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  const hubLoading = mobile.locator('.match-loading-screen').waitFor({ timeout: 15_000 })
  await mobile.locator('.create-menu-discipline-arcane').click()
  await hubLoading
  browserSurfaceReceipts.hubLoading = await assertGameSurface(mobile, '.match-loading-screen')
  await mobile.locator('.hub-world-canvas').waitFor({ timeout: 30_000 })
  browserSurfaceReceipts.hub = await assertGameSurface(mobile, '.hub-scene')

  const movementJoystick = mobile.locator('[data-joystick="movement"]')
  const movementKnob = movementJoystick.locator('.game-touch-joystick-knob')
  const primaryJoystick = mobile.locator('[data-joystick="primary"]')
  const primaryKnob = primaryJoystick.locator('.game-touch-joystick-knob')
  await movementJoystick.waitFor()
  await primaryJoystick.waitFor()

  const movementIdleCenter = rectCenter(await settledBounds(movementKnob, mobile))
  const movementBase = await movementJoystick.boundingBox()
  const movementCenter = rectCenter(movementBase)
  assert.ok(
    Math.abs(movementIdleCenter.x - movementCenter.x) < 1,
    `idle movement knob must center in the base (x ${movementIdleCenter.x} vs ${movementCenter.x})`,
  )
  assert.ok(
    Math.abs(movementIdleCenter.y - movementCenter.y) < 1,
    `idle movement knob must center in the base (y ${movementIdleCenter.y} vs ${movementCenter.y})`,
  )

  const primaryIdleCenter = rectCenter(await settledBounds(primaryKnob, mobile))
  const primaryBase = await primaryJoystick.boundingBox()
  const primaryCenter = rectCenter(primaryBase)
  assert.ok(Math.abs(primaryIdleCenter.x - primaryCenter.x) < 1)
  assert.ok(Math.abs(primaryIdleCenter.y - primaryCenter.y) < 1)
  assert.equal(
    rectsOverlap(primaryBase, await mobile.locator('.hub-hud-map').boundingBox()),
    false,
    'primary joystick must not cover the Hub map control',
  )
  await mobile.screenshot({ path: idleScreenshotPath })

  const cdp = await mobile.context().newCDPSession(mobile)
  await mobile.evaluate(() => {
    window.__sdrJoystickPointerDefaults = []
    document.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-joystick]')) {
        window.__sdrJoystickPointerDefaults.push(event.defaultPrevented)
      }
    })
  })

  for (const center of [movementCenter, primaryCenter]) {
    for (let tap = 0; tap < 8; tap += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: center.x, y: center.y }],
      })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: movementCenter.x, y: movementCenter.y }],
  })
  await mobile.waitForTimeout(850)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForTimeout(100)
  const interactionReceipt = await mobile.evaluate(() => {
    const selection = window.getSelection()
    return {
      activeJoystick: document.activeElement?.matches?.('[data-joystick]') ?? false,
      pointerDefaults: window.__sdrJoystickPointerDefaults,
      selectionRangeCount: selection?.rangeCount ?? -1,
      selectionText: selection?.toString() ?? '',
      selectionType: selection?.type ?? 'missing',
    }
  })
  assert.equal(interactionReceipt.pointerDefaults.length, 17)
  assert.equal(interactionReceipt.pointerDefaults.every(Boolean), true)
  assert.equal(interactionReceipt.activeJoystick, false)
  assert.equal(interactionReceipt.selectionRangeCount, 0)
  assert.equal(interactionReceipt.selectionText, '')
  assert.equal(interactionReceipt.selectionType, 'None')

  const movementOffset = movementBase.width * 0.3
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: movementCenter.x, y: movementCenter.y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: movementCenter.x + movementOffset, y: movementCenter.y }],
  })
  await mobile.waitForTimeout(60)
  const movementHeldCenter = rectCenter(await movementKnob.boundingBox())
  assert.ok(
    Math.abs(movementHeldCenter.x - (movementCenter.x + movementOffset)) < 1,
    `held movement knob must follow the touch (${movementHeldCenter.x} vs ${movementCenter.x + movementOffset})`,
  )
  assert.ok(Math.abs(movementHeldCenter.y - movementCenter.y) < 1)

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const movementReleasedCenter = rectCenter(await settledBounds(movementKnob, mobile))
  assert.ok(Math.abs(movementReleasedCenter.x - movementCenter.x) < 1)
  assert.ok(Math.abs(movementReleasedCenter.y - movementCenter.y) < 1)

  const primaryOffset = primaryBase.width * 0.3
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: primaryCenter.x, y: primaryCenter.y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: primaryCenter.x + primaryOffset, y: primaryCenter.y }],
  })
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerHeadingIndex === 6
      && frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const primaryHeldCenter = rectCenter(await primaryKnob.boundingBox())
  assert.ok(Math.abs(primaryHeldCenter.x - (primaryCenter.x + primaryOffset)) < 1)
  assert.ok(Math.abs(primaryHeldCenter.y - primaryCenter.y) < 1)
  await mobile.screenshot({ path: heldScreenshotPath })

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerAttachmentPose === 0
      && !frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const primaryReleasedCenter = rectCenter(await settledBounds(primaryKnob, mobile))
  assert.ok(Math.abs(primaryReleasedCenter.x - primaryCenter.x) < 1)
  assert.ok(Math.abs(primaryReleasedCenter.y - primaryCenter.y) < 1)

  const concurrentStartX = await mobile.locator('.hub-world-canvas').evaluate(
    (node) => node.__sdrHubFrame.playerX,
  )
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 11, x: movementCenter.x, y: movementCenter.y },
      { id: 22, x: primaryCenter.x, y: primaryCenter.y },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { id: 11, x: movementCenter.x + movementOffset, y: movementCenter.y },
      { id: 22, x: primaryCenter.x + primaryOffset, y: primaryCenter.y },
    ],
  })
  await mobile.waitForFunction((startX) => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerX > startX + 10
      && frame.playerHeadingIndex === 6
      && frame.primarySpellKinds?.includes('water')
  }, concurrentStartX, { timeout: 10_000 })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerMoving === false
      && frame.playerAttachmentPose === 0
      && !frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const concurrentMovementReleased = rectCenter(await settledBounds(movementKnob, mobile))
  const concurrentPrimaryReleased = rectCenter(await settledBounds(primaryKnob, mobile))
  assert.ok(Math.abs(concurrentMovementReleased.x - movementCenter.x) < 1)
  assert.ok(Math.abs(concurrentMovementReleased.y - movementCenter.y) < 1)
  assert.ok(Math.abs(concurrentPrimaryReleased.x - primaryCenter.x) < 1)
  assert.ok(Math.abs(concurrentPrimaryReleased.y - primaryCenter.y) < 1)

  const boneyardLoading = mobile.locator('.match-loading-screen').waitFor({ timeout: 15_000 })
  await mobile.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await boneyardLoading
  browserSurfaceReceipts.boneyardLoading = await assertGameSurface(mobile, '.match-loading-screen')
  await mobile.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  browserSurfaceReceipts.boneyard = await assertGameSurface(mobile, '.boneyard-scene')
  const boneyardPrimaryJoystick = mobile.locator('[data-joystick="primary"]')
  const boneyardPrimaryKnob = boneyardPrimaryJoystick.locator('.game-touch-joystick-knob')
  const boneyardPrimaryBase = await boneyardPrimaryJoystick.boundingBox()
  const boneyardPrimaryCenter = rectCenter(boneyardPrimaryBase)
  const boneyardPrimaryOffset = boneyardPrimaryBase.width * 0.3
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: boneyardPrimaryCenter.x, y: boneyardPrimaryCenter.y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{
      x: boneyardPrimaryCenter.x + boneyardPrimaryOffset,
      y: boneyardPrimaryCenter.y,
    }],
  })
  await mobile.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame.primarySpellKinds?.includes('water')
  ), null, { timeout: 10_000 })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && !frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const boneyardPrimaryReleased = rectCenter(await settledBounds(boneyardPrimaryKnob, mobile))
  assert.ok(Math.abs(boneyardPrimaryReleased.x - boneyardPrimaryCenter.x) < 1)
  assert.ok(Math.abs(boneyardPrimaryReleased.y - boneyardPrimaryCenter.y) < 1)

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(
    `built-bundle joystick smoke passed: movement (${movementIdleCenter.x.toFixed(2)}, ${movementIdleCenter.y.toFixed(2)}), `
    + `primary attack (${primaryIdleCenter.x.toFixed(2)}, ${primaryIdleCenter.y.toFixed(2)}), `
    + 'rightward Water heading 6, simultaneous movement, Boneyard cast, '
    + `${interactionReceipt.pointerDefaults.length} canceled rapid/held pointer defaults, `
    + `and game-surface policy across ${Object.keys(browserSurfaceReceipts).join(', ')}\n`,
  )
} finally {
  await browser.close()
}

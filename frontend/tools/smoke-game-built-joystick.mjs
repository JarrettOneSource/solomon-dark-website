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
  await mobile.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor({
    timeout: 10_000,
  })
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
  const joystickGeometry = await movementJoystick.evaluate((node) => ({
    base: Number.parseFloat(getComputedStyle(node).width),
    knob: Number.parseFloat(getComputedStyle(node.querySelector('.game-touch-joystick-knob')).width),
  }))
  assert.deepEqual(joystickGeometry, { base: 237.5, knob: 100 })
  assert.ok(Math.abs(movementBase.width - 237.5 * 390 / 900) < 0.1)
  assert.ok(Math.abs(primaryBase.width - 237.5 * 390 / 900) < 0.1)
  assert.ok(Math.abs(primaryIdleCenter.x - primaryCenter.x) < 1)
  assert.ok(Math.abs(primaryIdleCenter.y - primaryCenter.y) < 1)
  assert.equal(
    rectsOverlap(primaryBase, await mobile.locator('.hub-hud-map').boundingBox()),
    false,
    'primary joystick must not cover the Hub map control',
  )
  await mobile.screenshot({ path: idleScreenshotPath })

  const cdp = await mobile.context().newCDPSession(mobile)
  const abilityButtons = mobile.locator('.hub-hud-quickbar-slot')
  assert.equal(await abilityButtons.count(), 8)
  const abilityBounds = await abilityButtons.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return {
      height: rect.height,
      topmost: document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      )?.closest('.hub-hud-quickbar-slot') === node,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    }
  }))
  abilityBounds.forEach((bounds, index) => {
    assert.ok(Math.abs(bounds.width - 100 * 390 / 900) < 0.1, `ability ${index} width`)
    assert.ok(Math.abs(bounds.height - 100 * 390 / 900) < 0.1, `ability ${index} height`)
    assert.equal(bounds.topmost, true, `ability ${index} must be topmost at its center`)
    assert.equal(rectsOverlap(bounds, movementBase), false)
    assert.equal(rectsOverlap(bounds, primaryBase), false)
    for (let previous = 0; previous < index; previous += 1) {
      assert.equal(rectsOverlap(bounds, abilityBounds[previous]), false)
    }
  })

  const hudButtons = [
    mobile.getByRole('button', { name: /Use health potion/ }),
    mobile.getByRole('button', { name: /Open inventory/ }),
    mobile.getByRole('button', { name: 'Open skills' }),
    mobile.getByRole('button', { name: /Use mana potion/ }),
  ]
  const hudButtonBounds = []
  for (const button of hudButtons) {
    const bounds = await button.boundingBox()
    assert.ok(Math.abs(bounds.width - 100 * 390 / 900) < 0.1)
    assert.ok(Math.abs(bounds.height - 100 * 390 / 900) < 0.1)
    hudButtonBounds.push(bounds)
  }
  for (let index = 0; index < hudButtonBounds.length; index += 1) {
    for (let previous = 0; previous < index; previous += 1) {
      assert.equal(rectsOverlap(hudButtonBounds[index], hudButtonBounds[previous]), false)
    }
  }

  const firstAbilityCenter = rectCenter(abilityBounds[0])
  await mobile.evaluate(() => {
    window.__sdrAbilityPointerEvents = []
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      document.addEventListener(type, (event) => {
        if (event.target instanceof Element && event.target.closest('.hub-hud-quickbar-slot')) {
          window.__sdrAbilityPointerEvents.push({
            button: event.button,
            defaultPrevented: event.defaultPrevented,
            pointerType: event.pointerType,
            slot: event.target.closest('.hub-hud-quickbar-slot')?.getAttribute('data-slot'),
            type,
          })
        }
      })
    }
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: firstAbilityCenter.x, y: firstAbilityCenter.y }],
  })
  try {
    const quickbarCast = await mobile.waitForFunction(() => {
      const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
      const cooldown = document.querySelector(
        '.hub-hud-quickbar-slot[data-slot="0"] .hub-hud-quickbar-cooldown',
      ) !== null
      return cooldown || frame?.secondaryAbilityCount > 0
        ? {
            cooldown,
            count: frame?.secondaryAbilityCount ?? 0,
            kinds: [...(frame?.secondaryAbilityKinds ?? [])],
          }
        : null
    }, null, { timeout: 10_000 })
    await quickbarCast.dispose()
  } catch {
    const abilityFailure = await mobile.evaluate(() => {
      const slot = document.querySelector('.hub-hud-quickbar-slot[data-slot="0"]')
      const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
      return {
        disabled: slot?.disabled,
        frameSecondary: frame && Object.fromEntries(
          Object.entries(frame).filter(([key]) => key.toLowerCase().includes('secondary')),
        ),
        label: slot?.getAttribute('aria-label'),
        pointerEvents: window.__sdrAbilityPointerEvents,
        sceneInputBlocked: document.querySelector('.hub-scene')
          ?.getAttribute('data-gameplay-input-blocked'),
      }
    })
    assert.fail(`touch quickbar slot did not cast: ${JSON.stringify(abilityFailure)}`)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  await mobile.getByRole('button', { name: 'Use health potion, 1 available' }).click()
  await mobile.getByRole('button', { name: 'Use health potion, 0 available' }).waitFor()
  await mobile.getByRole('button', { name: 'Use mana potion, 1 available' }).click()
  await mobile.getByRole('button', { name: 'Use mana potion, 0 available' }).waitFor()
  await mobile.getByRole('button', { name: /Open inventory/ }).click()
  const hubInventory = mobile.getByRole('dialog', { name: 'Inventory' })
  await hubInventory.waitFor()
  await hubInventory.getByRole('button', { name: 'Done' }).click()
  await mobile.getByRole('button', { name: 'Open skills' }).click()
  const hubSkills = mobile.getByRole('dialog', { name: 'Skills' })
  await hubSkills.waitFor()
  await hubSkills.getByRole('button', { name: 'Close skills' }).click()

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

  assert.equal(await mobile.locator('.boneyard-scene .hub-hud-quickbar-slot').count(), 8)
  await mobile.getByRole('button', { name: /Open inventory/ }).click()
  const boneyardInventory = mobile.getByRole('dialog', { name: 'Inventory' })
  await boneyardInventory.waitFor()
  await boneyardInventory.getByRole('button', { name: 'Done' }).click()
  await mobile.getByRole('button', { name: 'Open skills' }).click()
  const boneyardSkills = mobile.getByRole('dialog', { name: 'Skills' })
  await boneyardSkills.waitFor()
  await boneyardSkills.getByRole('button', { name: 'Close skills' }).click()

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(
    `built-bundle mobile controls smoke passed: 237.5px movement (${movementIdleCenter.x.toFixed(2)}, ${movementIdleCenter.y.toFixed(2)}), `
    + `primary attack (${primaryIdleCenter.x.toFixed(2)}, ${primaryIdleCenter.y.toFixed(2)}), `
    + 'eight quickbar buttons, red/blue potion taps, inventory/skills in both scenes, '
    + 'rightward Water heading 6, simultaneous movement, Boneyard cast, '
    + `${interactionReceipt.pointerDefaults.length} canceled rapid/held pointer defaults, `
    + `and game-surface policy across ${Object.keys(browserSurfaceReceipts).join(', ')}\n`,
  )
} finally {
  await browser.close()
}

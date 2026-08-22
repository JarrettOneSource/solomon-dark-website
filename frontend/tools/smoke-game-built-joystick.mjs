import assert from 'node:assert/strict'
import { join } from 'node:path'

import { chromium } from 'playwright-core'

import {
  assertBoneyardCombatSealed,
  crossEntryGateWithJoystick,
  waitForBoneyardCombatAdmission,
  walkToSolomonWithJoystick,
} from './smoke-boneyard-combat-admission.mjs'

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
  // detection and measurement share one browser-side task: `/game` mounts two
  // loader pages back to back (the Suspense fallback, then the game's own), so
  // a handle taken on the first can be detached before a second round-trip
  // measures it, and a detached node has no surface ancestor
  const handle = await page.waitForFunction((selector) => {
    const node = document.querySelector(selector)
    if (!node) return null
    const surface = node.closest('.game-surface')
    if (!surface) return { missingSurface: true }
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
  }, memberSelector, { timeout: 30_000 })
  const receipt = await handle.jsonValue()
  assert.equal(receipt.missingSurface, undefined, `${memberSelector} must be inside the persistent game surface`)
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

let mobile = null
try {
  mobile = await browser.newPage({
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
  await movementJoystick.waitFor()
  // the shared Hub is noncombat: the primary attack lane exists only in the Boneyard
  assert.equal(
    await mobile.locator('[data-joystick="primary"]').count(),
    0,
    'the Hub must not render the primary attack joystick',
  )

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

  const joystickGeometry = await movementJoystick.evaluate((node) => ({
    base: Number.parseFloat(getComputedStyle(node).width),
    knob: Number.parseFloat(getComputedStyle(node.querySelector('.game-touch-joystick-knob')).width),
  }))
  assert.deepEqual(joystickGeometry, { base: 120, knob: 52 })
  assert.ok(Math.abs(movementBase.width - 120) < 0.1, `movement joystick width ${movementBase.width}`)
  assert.equal(
    rectsOverlap(movementBase, await mobile.locator('.hub-hud-map').boundingBox()),
    false,
    'movement joystick must not cover the Hub map control',
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
    assert.ok(Math.abs(bounds.width - 44) < 0.1, `ability ${index} width ${bounds.width}`)
    assert.ok(Math.abs(bounds.height - 44) < 0.1, `ability ${index} height ${bounds.height}`)
    assert.equal(bounds.topmost, true, `ability ${index} must be topmost at its center`)
    assert.equal(rectsOverlap(bounds, movementBase), false)
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
  for (const [index, button] of hudButtons.entries()) {
    const bounds = await button.boundingBox()
    assert.ok(bounds, `HUD button ${index} must be laid out`)
    assert.ok(Math.abs(bounds.width - 44) < 0.1, `HUD button ${index} width ${bounds.width}`)
    assert.ok(Math.abs(bounds.height - 44) < 0.1, `HUD button ${index} height ${bounds.height}`)
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
  // the shared Hub is sealed: the tap must reach the slot (it stays
  // hit-testable so it never falls through to the world and walks the
  // player) and must cast nothing; the quickbar cast proof lives in the
  // Boneyard below
  const sealedStart = await mobile.evaluate(() => {
    const frame = document.querySelector('.hub-world-canvas').__sdrHubFrame
    return { frameCount: frame.frameCount, x: frame.playerX, y: frame.playerY }
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: firstAbilityCenter.x, y: firstAbilityCenter.y }],
  })
  await mobile.waitForFunction(
    () => window.__sdrAbilityPointerEvents.some((event) => event.type === 'pointerdown'),
    null,
    { timeout: 10_000 },
  )
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  // a cast arms on the down event and shows within a tick, a walk moves
  // playerX within a frame: thirty rendered frames is the settle window
  await mobile.waitForFunction(
    (start) => (document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.frameCount ?? 0) >= start + 30,
    sealedStart.frameCount,
    { timeout: 10_000 },
  )
  const sealedSlot = await mobile.evaluate(() => {
    const slot = document.querySelector('.hub-hud-quickbar-slot[data-slot="0"]')
    const frame = document.querySelector('.hub-world-canvas').__sdrHubFrame
    return {
      cooldown: slot.getAttribute('data-cooldown') === 'true'
        || slot.querySelector('.hub-hud-quickbar-cooldown') !== null,
      disabled: slot.disabled,
      label: slot.getAttribute('aria-label'),
      pointerEvents: window.__sdrAbilityPointerEvents,
      primarySpellKinds: [...frame.primarySpellKinds],
      secondaryAbilityCount: frame.secondaryAbilityCount,
      x: frame.playerX,
      y: frame.playerY,
    }
  })
  assert.equal(sealedSlot.disabled, true, `Hub slot 0 must be sealed: ${sealedSlot.label}`)
  assert.match(sealedSlot.label, /unavailable in the Hub/)
  assert.ok(
    sealedSlot.pointerEvents.some((event) => event.type === 'pointerdown'
      && event.pointerType === 'touch' && event.slot === '0'),
    `the sealed slot must receive the tap: ${JSON.stringify(sealedSlot.pointerEvents)}`,
  )
  assert.equal(sealedSlot.cooldown, false, 'a sealed slot must not start a cooldown')
  assert.equal(sealedSlot.secondaryAbilityCount, 0, 'a sealed slot must not cast')
  assert.deepEqual(sealedSlot.primarySpellKinds, [])
  assert.deepEqual(
    { x: sealedSlot.x, y: sealedSlot.y },
    { x: sealedStart.x, y: sealedStart.y },
    'a tap on a sealed slot must not walk the player',
  )

  await mobile.getByRole('button', { name: 'Use health potion, 1 available' }).click()
  await mobile.getByRole('button', { name: 'Use health potion, 0 available' }).waitFor()
  await mobile.getByRole('button', { name: 'Use mana potion, 1 available' }).click()
  await mobile.getByRole('button', { name: 'Use mana potion, 0 available' }).waitFor()
  await mobile.getByRole('button', { name: /Open inventory/ }).click()
  const hubInventory = mobile.getByRole('dialog', { name: 'Inventory' })
  await hubInventory.waitFor()
  // the stock inventory screen has no close control and its curtain covers the
  // HUD, so touch closes it from a screen-space control on the stage that
  // counters the stage projection to a real 40px target
  const inventoryClose = hubInventory.getByRole('button', { name: 'Close inventory' })
  const inventoryCloseBounds = await inventoryClose.boundingBox()
  assert.ok(inventoryCloseBounds, 'expected the touch close control on the inventory stage')
  assert.ok(
    Math.abs(inventoryCloseBounds.width - 40) < 0.6 && Math.abs(inventoryCloseBounds.height - 40) < 0.6,
    `the inventory close control must counter the stage scale to 40px, got ${JSON.stringify(inventoryCloseBounds)}`,
  )
  await inventoryClose.click()
  await hubInventory.waitFor({ state: 'detached' })
  await mobile.getByRole('button', { name: 'Open skills' }).click()
  const hubSkills = mobile.getByRole('dialog', { name: 'Skills' })
  await hubSkills.waitFor()
  await hubSkills.getByRole('button', { name: 'Close skills' }).click()
  // the skills curtain covers the joysticks until React unmounts it: a tap
  // dispatched before that lands on the curtain, not on the joystick
  await hubSkills.waitFor({ state: 'detached' })

  await mobile.evaluate(() => {
    // every pointerdown is recorded with its target, so a tap that lands off
    // the joystick names what caught it instead of only going missing
    window.__sdrJoystickPointerDefaults = []
    window.__sdrStrayPointerDowns = []
    document.addEventListener('pointerdown', (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('[data-joystick]')) {
        window.__sdrJoystickPointerDefaults.push(event.defaultPrevented)
        return
      }
      const classes = typeof target?.className === 'string' ? target.className.trim().split(/\s+/) : []
      window.__sdrStrayPointerDowns.push([target?.tagName.toLowerCase() ?? 'none', ...classes].join('.'))
    })
  })

  for (const center of [movementCenter]) {
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
      strayPointerDowns: window.__sdrStrayPointerDowns,
      selectionText: selection?.toString() ?? '',
      selectionType: selection?.type ?? 'missing',
    }
  })
  assert.equal(
    interactionReceipt.pointerDefaults.length,
    9,
    `eight taps and one hold must all land on the movement joystick; strays: ${JSON.stringify(interactionReceipt.strayPointerDowns)}`,
  )
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

  // walking in the Hub must move the player and never arm a cast: the Hub is sealed
  const hubWalkStartX = await mobile.locator('.hub-world-canvas').evaluate(
    (node) => node.__sdrHubFrame.playerX,
  )
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 11, x: movementCenter.x, y: movementCenter.y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ id: 11, x: movementCenter.x + movementOffset, y: movementCenter.y }],
  })
  await mobile.waitForFunction((startX) => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerX > startX + 10
      && frame.playerMoving === true
      && (frame.primarySpellKinds?.length ?? 0) === 0
  }, hubWalkStartX, { timeout: 10_000 })
  await mobile.screenshot({ path: heldScreenshotPath })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.playerMoving === false
      && frame.playerAttachmentPose === 0
      && (frame.primarySpellKinds?.length ?? 0) === 0
  }, null, { timeout: 10_000 })
  const hubWalkReleased = rectCenter(await settledBounds(movementKnob, mobile))
  assert.ok(Math.abs(hubWalkReleased.x - movementCenter.x) < 1)
  assert.ok(Math.abs(hubWalkReleased.y - movementCenter.y) < 1)

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
  // combat is sealed until Solomon runs: prove the seal, then earn admission
  // the way a player does before the primary joystick is expected to cast
  const boneyardScene = mobile.locator('.boneyard-scene')
  const sealedBoneyardSamples = await assertBoneyardCombatSealed(mobile, cdp, boneyardScene, {
    center: boneyardPrimaryCenter,
    offset: boneyardPrimaryOffset,
  })
  // the quickbar roster and the HUD dialogs do not depend on combat, so they
  // are proven while the arena is still sealed: once Solomon runs, the opening
  // wave surrounds a lone player at the dig and the run is over within seconds
  assert.equal(await mobile.locator('.boneyard-scene .hub-hud-quickbar-slot').count(), 8)
  const boneyardAbility = mobile.locator('.boneyard-scene .hub-hud-quickbar-slot[data-slot="0"]')
  const boneyardAbilityLabel = await boneyardAbility.getAttribute('aria-label')
  assert.doesNotMatch(boneyardAbilityLabel, /unavailable in the Hub/)
  assert.equal(
    await boneyardAbility.isDisabled(),
    false,
    `Boneyard slot 0 must be armed: ${boneyardAbilityLabel}`,
  )
  const boneyardAbilityCenter = rectCenter(await boneyardAbility.boundingBox())
  await mobile.getByRole('button', { name: /Open inventory/ }).click()
  const boneyardInventory = mobile.getByRole('dialog', { name: 'Inventory' })
  await boneyardInventory.waitFor()
  // the Boneyard stage projects at a different scale than the Hub's, and the
  // touch close control must still counter it to a real 40px target
  const boneyardInventoryClose = boneyardInventory.getByRole('button', { name: 'Close inventory' })
  const boneyardInventoryCloseBounds = await boneyardInventoryClose.boundingBox()
  assert.ok(boneyardInventoryCloseBounds, 'expected the touch close control on the Boneyard inventory stage')
  assert.ok(
    Math.abs(boneyardInventoryCloseBounds.width - 40) < 0.6
      && Math.abs(boneyardInventoryCloseBounds.height - 40) < 0.6,
    `the Boneyard inventory close control must counter the stage scale to 40px, got ${JSON.stringify(boneyardInventoryCloseBounds)}`,
  )
  await boneyardInventoryClose.click()
  await boneyardInventory.waitFor({ state: 'detached' })
  await mobile.getByRole('button', { name: 'Open skills' }).click()
  const boneyardSkills = mobile.getByRole('dialog', { name: 'Skills' })
  await boneyardSkills.waitFor()
  await boneyardSkills.getByRole('button', { name: 'Close skills' }).click()
  // an open curtain blocks gameplay input: the crossing starts only once React
  // has unmounted it
  await boneyardSkills.waitFor({ state: 'detached' })

  const boneyardMovementBase = await mobile.locator('[data-joystick="movement"]').boundingBox()
  const gateCrossing = await crossEntryGateWithJoystick(mobile, cdp, boneyardScene, boneyardMovementBase)
  const solomonApproach = await walkToSolomonWithJoystick(mobile, cdp, boneyardScene, boneyardMovementBase)
  await watchPlayerHealth(mobile)
  const combatAdmission = await waitForBoneyardCombatAdmission(mobile, boneyardScene)
  // the opening wave is live from here, so the casts follow admission at once:
  // the first quickbar slot (Ring of Ice around the player) and then the
  // primary stick, each receipted with the player's health at the cast
  const healthAtAdmission = await playerHealth(mobile)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: boneyardAbilityCenter.x, y: boneyardAbilityCenter.y }],
  })
  try {
    const boneyardCast = await mobile.waitForFunction(() => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      const slot = document.querySelector('.boneyard-scene .hub-hud-quickbar-slot[data-slot="0"]')
      const cooldown = slot?.getAttribute('data-cooldown') === 'true'
        || slot?.querySelector('.hub-hud-quickbar-cooldown') !== null
      return cooldown || (frame?.secondaryAbilityCount ?? 0) > 0
        ? {
            cooldown,
            count: frame?.secondaryAbilityCount ?? 0,
            kinds: [...(frame?.secondaryAbilityKinds ?? [])],
          }
        : null
    }, null, { timeout: 10_000 })
    await boneyardCast.dispose()
  } catch {
    const boneyardAbilityFailure = await mobile.evaluate(() => {
      const slot = document.querySelector('.boneyard-scene .hub-hud-quickbar-slot[data-slot="0"]')
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      return {
        disabled: slot?.disabled,
        frameSecondary: frame && Object.fromEntries(
          Object.entries(frame).filter(([key]) => key.toLowerCase().includes('secondary')),
        ),
        health: document.querySelector('.boneyard-scene img[alt^="Health "]')?.getAttribute('alt') ?? null,
        label: slot?.getAttribute('aria-label'),
        sceneInputBlocked: document.querySelector('.boneyard-scene')
          ?.getAttribute('data-gameplay-input-blocked'),
      }
    })
    assert.fail(`Boneyard quickbar slot did not cast: ${JSON.stringify(boneyardAbilityFailure)}`)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const healthAtQuickbarCast = await playerHealth(mobile)
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
  await waitForBoneyardPrimaryCast(mobile, boneyardPrimaryCenter)
  const healthAtPrimaryCast = await playerHealth(mobile)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await mobile.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && !frame.primarySpellKinds?.includes('water')
  }, null, { timeout: 10_000 })
  const boneyardPrimaryReleased = rectCenter(await settledBounds(boneyardPrimaryKnob, mobile))
  assert.ok(Math.abs(boneyardPrimaryReleased.x - boneyardPrimaryCenter.x) < 1)
  assert.ok(Math.abs(boneyardPrimaryReleased.y - boneyardPrimaryCenter.y) < 1)
  const healthTimeline = await mobile.evaluate(() => window.__sdrPlayerHealthWatch.stop())

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(
    `built-bundle mobile controls smoke passed: 120px movement (${movementIdleCenter.x.toFixed(2)}, ${movementIdleCenter.y.toFixed(2)}), `
    + `Boneyard primary attack (${boneyardPrimaryCenter.x.toFixed(2)}, ${boneyardPrimaryCenter.y.toFixed(2)}), `
    + 'eight quickbar buttons, red/blue potion taps, inventory/skills in both scenes, '
    + 'sealed-Hub walk and slot tap without a cast, '
    + `sealed Boneyard primary hold (${sealedBoneyardSamples} samples), `
    + `entry gate crossed at x=${gateCrossing.alignedX.toFixed(0)} (${gateCrossing.direction > 0 ? 'south' : 'north'}), `
    + `Solomon contact after ${solomonApproach.samples} joystick samples (${(solomonApproach.elapsedMs / 1000).toFixed(1)}s), `
    + `combat admitted at run event ${combatAdmission.runEventId} (${healthAtAdmission}), `
    + `quickbar cast at ${healthAtQuickbarCast}, Boneyard Water cast at ${healthAtPrimaryCast}, `
    + `${interactionReceipt.pointerDefaults.length} canceled rapid/held pointer defaults, `
    + `and game-surface policy across ${Object.keys(browserSurfaceReceipts).join(', ')}\n`,
  )
  process.stdout.write(`built-bundle mobile controls receipt: ${JSON.stringify({
    combatAdmission,
    gateCrossing,
    healthTimeline,
    solomonApproach: { ...solomonApproach, samples: solomonApproach.samples },
  })}\n`)
} catch (error) {
  // Any failure after the page exists leaves a screenshot and the on-screen
  // state behind, so an unattended run names the surface that failed.
  const failureDir = process.env.SDR_JOYSTICK_FAILURE_DIR
  if (mobile && failureDir) {
    const state = await mobile.evaluate(() => ({
      activeElement: document.activeElement?.tagName ?? null,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((node) => node.getAttribute('aria-label')),
      inventoryButtons: [...document.querySelectorAll('button[aria-label^="Open inventory"]')].map((node) => ({
        disabled: node.disabled,
        hidden: node.offsetParent === null,
        rect: node.getBoundingClientRect().toJSON(),
      })),
      scene: { ...(document.querySelector('.boneyard-scene, .hub-scene')?.dataset ?? {}) },
      url: location.href,
    })).catch((cause) => ({ unavailable: String(cause) }))
    const screenshotPath = join(failureDir, 'built-joystick-failure.png')
    await mobile.screenshot({ path: screenshotPath }).catch(() => {})
    console.error(`failure state: ${JSON.stringify(state)}; screenshot ${screenshotPath}`)
  }
  throw error
} finally {
  await browser.close()
}

// The held primary joystick must cast water within 10s. When it does not, the
// failure names the surface that failed: what sits under the touch point (a
// layout that swallowed the touch), the joystick's own active state and knob,
// whether the renderer still ticks and what the scene reports (a host that
// never answered), plus a screenshot when SDR_JOYSTICK_FAILURE_DIR is set.
function playerHealth(page) {
  return page.evaluate(() => (
    document.querySelector('.boneyard-scene img[alt^="Health "]')?.getAttribute('alt') ?? null
  ))
}

// Records every change of the HUD health meter from now on (with the live
// enemy count), so the receipt shows how the opening wave treated the player
// around the casts instead of leaving the run's outcome to guesswork.
function watchPlayerHealth(page) {
  return page.evaluate(() => {
    const read = () => ({
      atMs: Math.round(performance.now()),
      enemies: Number(document.querySelector('.boneyard-scene')?.getAttribute('data-wave-live-enemy-count')),
      health: document.querySelector('.boneyard-scene img[alt^="Health "]')?.getAttribute('alt') ?? null,
    })
    const first = read()
    const timeline = [first]
    let last = first.health
    const timer = setInterval(() => {
      const next = read()
      if (next.health === last) return
      last = next.health
      timeline.push(next)
    }, 50)
    window.__sdrPlayerHealthWatch = {
      stop() {
        clearInterval(timer)
        const final = read()
        return { changes: timeline, final, watchedMs: final.atMs - first.atMs }
      },
    }
  })
}

async function waitForBoneyardPrimaryCast(page, center) {
  try {
    await page.waitForFunction(() => (
      document.querySelector('.boneyard-world-canvas')
        ?.__sdrBoneyardFrame.primarySpellKinds?.includes('water')
    ), null, { timeout: 10_000 })
  } catch (error) {
    const report = await page.evaluate(async ({ x, y }) => {
      const canvas = document.querySelector('.boneyard-world-canvas')
      const framesBefore = canvas?.__sdrBoneyardFrame?.frameCount ?? null
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      const frame = canvas?.__sdrBoneyardFrame
      const joystick = document.querySelector('[data-joystick="primary"]')
      const describe = (node) => `${node.tagName.toLowerCase()}${
        node.getAttribute('class') ? `.${node.getAttribute('class').trim().split(/\s+/).join('.')}` : ''
      }`
      return {
        framesInOneSecond: framesBefore === null ? null : (frame?.frameCount ?? 0) - framesBefore,
        joystick: joystick ? { active: joystick.dataset.active, knob: joystick.querySelector('.game-touch-joystick-knob')?.style.transform ?? null } : null,
        playerScreen: frame ? [frame.playerScreenX, frame.playerScreenY] : null,
        primarySpellKinds: frame?.primarySpellKinds ?? null,
        scene: { ...document.querySelector('.boneyard-scene')?.dataset },
        underTouch: document.elementsFromPoint(x, y).slice(0, 6).map(describe),
      }
    }, center)
    const failureDir = process.env.SDR_JOYSTICK_FAILURE_DIR
    const screenshotPath = failureDir ? join(failureDir, 'built-joystick-boneyard-failure.png') : null
    if (screenshotPath) await page.screenshot({ path: screenshotPath })
    throw new Error(
      `no water primary cast within 10s of holding the Boneyard primary joystick; ${JSON.stringify(report)}`
      + (screenshotPath ? `; screenshot ${screenshotPath}` : ''),
      { cause: error },
    )
  }
}

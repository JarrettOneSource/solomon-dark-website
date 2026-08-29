import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import {
  DEFAULT_GAME_SETTINGS,
  GAME_SETTINGS_STORAGE_KEY,
} from '../src/game/game-settings.ts'

const baseUrl = process.env.SDR_GAME_BOOK_SMOKE_URL || 'http://127.0.0.1:4191'
const screenshotRoot = process.env.SDR_GAME_BOOK_SMOKE_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-inventory-skill-book'
const mobile = process.env.SDR_GAME_BOOK_SMOKE_MOBILE === '1'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({
  ...(mobile ? { hasTouch: true, isMobile: true } : {}),
  viewport: mobile ? { width: 844, height: 390 } : { width: 1600, height: 900 },
})
const consoleErrors = []
const pageErrors = []
const failedResponses = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
})
await page.addInitScript(bypassStartupAudioPreload)
await page.addInitScript(({ key, settings }) => {
  localStorage.setItem(key, JSON.stringify(settings))
}, {
  key: GAME_SETTINGS_STORAGE_KEY,
  settings: {
    ...DEFAULT_GAME_SETTINGS,
    controls: {
      ...DEFAULT_GAME_SETTINGS.controls,
      openInventory: 'KeyB',
      openSkills: 'KeyV',
    },
  },
})
await page.addInitScript(() => {
  window.__sdrInventoryPointerEvents = []
  for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchend']) {
    window.addEventListener(type, (event) => {
      const target = event.target instanceof Element
        ? event.target.closest('.hub-native-ui-action')
        : null
      if (!target) return
      window.__sdrInventoryPointerEvents.push({
        atMs: performance.now(),
        label: target.getAttribute('aria-label'),
        pointerType: 'pointerType' in event ? event.pointerType : 'touch',
        type,
      })
    }, { capture: true })
  }
})
await page.route('**/deployment.json?*', async (route) => {
  const revision = new URL(route.request().url()).searchParams.get('current')
  await route.fulfill({ json: { revision } })
})

try {
  await enterHub(page)

  const optionalBookReceipts = []
  const skillBookViewportReceipts = []

  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 10_000 })
  await activate(page, page.getByRole('button', { name: /Open inventory/ }))
  const hubInventory = page.getByRole('dialog', { name: 'Inventory' })
  await hubInventory.waitFor({ timeout: 5_000 })
  await waitForInventory(hubInventory)
  const inventoryToSkills = observeOptionalBookOverlap(page, 'skills')
  await hubInventory.getByRole('button', { name: 'Open skills' }).click()
  optionalBookReceipts.push(await inventoryToSkills)
  const hubSkills = page.getByRole('dialog', { name: 'Skills' })
  await hubSkills.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({
    timeout: 10_000,
  })
  skillBookViewportReceipts.push(await skillBookViewportReceipt(page, hubSkills, 'Hub'))
  await hubInventory.waitFor({ state: 'hidden', timeout: 10_000 })
  await page.screenshot({ path: `${screenshotRoot}-hub-skills.png` })
  const skillsToInventory = observeOptionalBookOverlap(page, 'inventory')
  await hubSkills.getByRole('button', { name: 'Open inventory' }).click()
  optionalBookReceipts.push(await skillsToInventory)
  await hubSkills.waitFor({ state: 'hidden', timeout: 10_000 })
  await hubInventory.waitFor({ timeout: 10_000 })
  await waitForInventory(hubInventory)
  const healthPotion = hubInventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Health Potion, quantity 1',
  })
  await activate(page, healthPotion)
  await healthPotion.locator('xpath=self::*[@data-selected="true"]').waitFor()
  if (mobile) {
    await page.waitForTimeout(250)
    await doubleTouchActivate(healthPotion)
  } else {
    await page.waitForTimeout(550)
    await doubleActivate(page, healthPotion)
  }
  await healthPotion.waitFor({ state: 'detached' })
  await page.screenshot({ path: `${screenshotRoot}-hub-inventory.png` })
  assert.equal(await hubInventory.getByRole('button', { name: 'Done' }).count(), 0)
  await page.keyboard.press('b')
  await hubInventory.waitFor({ state: 'hidden' })
  await page.locator(
    '.hub-scene[data-gameplay-input-blocked="false"]',
  ).waitFor({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyard.waitFor({ timeout: 90_000 })

  await activate(page, page.getByRole('button', { name: /Open inventory/ }))
  const matchInventory = page.getByRole('dialog', { name: 'Inventory' })
  await matchInventory.waitFor()
  await waitForInventory(matchInventory)
  const matchInventoryToSkills = observeOptionalBookOverlap(page, 'skills')
  await page.keyboard.press('v')
  optionalBookReceipts.push(await matchInventoryToSkills)
  const matchSkills = page.getByRole('dialog', { name: 'Skills' })
  await matchSkills.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({
    timeout: 10_000,
  })
  skillBookViewportReceipts.push(await skillBookViewportReceipt(
    page,
    matchSkills,
    'Boneyard',
  ))
  await matchInventory.waitFor({ state: 'hidden', timeout: 10_000 })
  const matchSkillsToInventory = observeOptionalBookOverlap(page, 'inventory')
  await page.keyboard.press('b')
  optionalBookReceipts.push(await matchSkillsToInventory)
  await matchSkills.waitFor({ state: 'hidden', timeout: 10_000 })
  await matchInventory.waitFor({ timeout: 10_000 })
  await waitForInventory(matchInventory)
  assert.equal(await boneyard.getAttribute('data-gameplay-input-blocked'), 'true')
  const matchManaPotion = matchInventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  })
  assert.equal(await matchManaPotion.count(), 1)
  await activate(page, matchManaPotion)
  await matchManaPotion.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await page.waitForTimeout(250)
  await matchInventory.locator(
    '.hub-inventory-native-canvas[data-native-item-info="visible"]',
  ).waitFor()
  assert.match(
    await matchInventory.getAttribute('data-native-inventory-selection') || '',
    /^backpack:/,
  )
  if (mobile) {
    await page.screenshot({ path: `${screenshotRoot}-match-inventory-item-info.png` })
    await doubleTouchActivate(matchManaPotion)
  } else {
    await page.screenshot({ path: `${screenshotRoot}-match-inventory-item-info.png` })
    await page.waitForTimeout(300)
    await doubleActivate(page, matchManaPotion)
  }
  await matchManaPotion.waitFor({ state: 'detached' })
  await page.screenshot({ path: `${screenshotRoot}-match-inventory.png` })

  await page.keyboard.press('b')
  await matchInventory.waitFor({ state: 'hidden' })
  await boneyard.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [], JSON.stringify(failedResponses))
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    failedResponses,
    hubInventory: true,
    matchInventory: true,
    matchInventoryPotionConsumed: true,
    mobile,
    optionalBookReceipts,
    pageErrors,
    pointerEvents: await page.evaluate(() => window.__sdrInventoryPointerEvents),
    skillBookViewportReceipts,
  })}\n`)
} finally {
  await browser.close()
}

async function enterHub(target) {
  await target.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await target.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorialPrompt = target.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialPrompt.isVisible()) {
    await tutorialPrompt.getByRole('button', { exact: true, name: 'NO' }).click()
  }
  await target.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await target.getByRole('button', { name: 'Play' }).click()
  await target.getByRole('button', { name: 'New Game' }).click()
  await target.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await target.getByRole('button', { name: /Ether/i }).click()
  await target.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await target.locator('.create-menu-discipline-arcane').click()
  await target.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
}

async function waitForInventory(inventory) {
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({
    timeout: 10_000,
  })
}

async function observeOptionalBookOverlap(page, target) {
  const receipt = await page.waitForFunction((replacementTarget) => {
    const inventory = document.querySelector('.hub-native-ui-overlay[data-surface-kind="inventory"]')
    const skills = document.querySelector('.skill-book-stage')
    if (!inventory || !skills) return false
    if (replacementTarget === 'skills') {
      if (inventory.getAttribute('data-replacement-target') !== 'skills') return false
    } else if (skills.getAttribute('data-transition-target') !== 'inventory') return false
    return {
      inventoryReveal: inventory.querySelector('.hub-inventory-native-canvas')
        ?.getAttribute('data-native-reveal-progress') ?? null,
      inventoryTarget: inventory.getAttribute('data-replacement-target'),
      skillsProgress: skills.getAttribute('data-open-progress'),
      skillsTarget: skills.getAttribute('data-transition-target'),
      target: replacementTarget,
    }
  }, target, { timeout: 5_000 })
  return receipt.jsonValue()
}

async function skillBookViewportReceipt(page, book, scene) {
  const overlay = page.locator('.skill-book-overlay').filter({ has: book })
  assert.equal(await overlay.count(), 1, `${scene} Skills has no viewport owner`)
  const [overlayBox, stageBox, curtainStyle] = await Promise.all([
    overlay.boundingBox(),
    book.boundingBox(),
    overlay.locator('.skill-book-curtain').evaluate((curtain) => {
      const style = getComputedStyle(curtain)
      return {
        backgroundColor: style.backgroundColor,
        opacity: Number(style.opacity),
        pointerEvents: style.pointerEvents,
      }
    }),
  ])
  assert.ok(overlayBox, `${scene} Skills viewport owner has no geometry`)
  assert.ok(stageBox, `${scene} Skills native stage has no geometry`)
  const viewport = page.viewportSize()
  assert.ok(viewport)
  assert.deepEqual({
    height: Math.round(overlayBox.height),
    width: Math.round(overlayBox.width),
    x: Math.round(overlayBox.x),
    y: Math.round(overlayBox.y),
  }, {
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  })
  assert.equal(curtainStyle.backgroundColor, 'rgb(0, 0, 0)')
  assert.equal(curtainStyle.opacity, 1)
  assert.equal(curtainStyle.pointerEvents, 'none')
  assert.ok(stageBox.width <= overlayBox.width)
  assert.ok(stageBox.height <= overlayBox.height)
  if (viewport.width / viewport.height !== 16 / 9) {
    assert.ok(
      stageBox.width < overlayBox.width || stageBox.height < overlayBox.height,
      `${scene} Skills native stage unexpectedly stretched to the viewport`,
    )
  }
  return {
    curtainStyle,
    overlay: overlayBox,
    scene,
    stage: stageBox,
    viewport,
  }
}

async function activate(page, target) {
  const box = await target.boundingBox()
  assert.ok(box, 'inventory activation target has no browser geometry')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  if (mobile) await page.touchscreen.tap(x, y)
  else await page.mouse.click(x, y)
  await page.waitForTimeout(25)
}

async function doubleActivate(page, target) {
  const box = await target.boundingBox()
  assert.ok(box, 'inventory double-activation target has no browser geometry')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.dblclick(x, y)
}

async function doubleTouchActivate(target) {
  await target.evaluate((element) => {
    const button = element
    Object.defineProperties(button, {
      hasPointerCapture: { configurable: true, value: () => false },
      releasePointerCapture: { configurable: true, value: () => {} },
      setPointerCapture: { configurable: true, value: () => {} },
    })
    for (const pointerId of [98, 99]) {
      button.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId,
        pointerType: 'touch',
      }))
      button.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId,
        pointerType: 'touch',
      }))
    }
    delete button.hasPointerCapture
    delete button.releasePointerCapture
    delete button.setPointerCapture
  })
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

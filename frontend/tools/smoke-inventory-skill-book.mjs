import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

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
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
await page.addInitScript(bypassStartupAudioPreload)
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

try {
  await enterHub(page)

  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 10_000 })
  await activate(page, page.getByRole('button', { name: /Open inventory/ }))
  const hubInventory = page.getByRole('dialog', { name: 'Inventory' })
  await hubInventory.waitFor({ timeout: 5_000 })
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
  await page.keyboard.press('i')
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

  await page.keyboard.press('i')
  await matchInventory.waitFor({ state: 'hidden' })
  await boneyard.locator('xpath=self::*[@data-gameplay-input-blocked="false"]').waitFor()

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    hubInventory: true,
    matchInventory: true,
    matchInventoryPotionConsumed: true,
    mobile,
    pageErrors,
    pointerEvents: await page.evaluate(() => window.__sdrInventoryPointerEvents),
  })}\n`)
} finally {
  await browser.close()
}

async function enterHub(target) {
  await target.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await target.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
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

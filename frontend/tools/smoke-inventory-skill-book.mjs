import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_BOOK_SMOKE_URL || 'http://127.0.0.1:4191'
const screenshotRoot = process.env.SDR_GAME_BOOK_SMOKE_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-inventory-skill-book'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const consoleErrors = []
const pageErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
await page.addInitScript(bypassStartupAudioPreload)

try {
  await enterHub(page)

  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Open skills' }).click()
  const hubBook = page.getByRole('dialog', { name: 'Skills' })
  await hubBook.waitFor()
  await waitForSkillBook(hubBook)
  assert.equal(await page.locator('.hub-scene').getAttribute('data-gameplay-input-blocked'), 'true')
  assert.equal(await hubBook.getAttribute('data-transition-phase'), 'settled')
  assert.equal(await hubBook.locator('.skill-book-canvas').count(), 1)
  assert.equal(await hubBook.getByRole('button', { name: /Belt 1, Call Leviathan/ }).count(), 1)
  await page.screenshot({ path: `${screenshotRoot}-hub-skills.png` })

  await hubBook.getByRole('button', { name: /Belt 2, empty/ }).click()
  await hubBook.getByRole('button', { name: 'Call Leviathan, rank 1' }).click()
  await hubBook.getByRole('button', { name: /Belt 2, Call Leviathan/ }).waitFor()
  assert.equal(await hubBook.getByRole('button', { name: /Call Leviathan/ }).count() >= 3, true)
  await page.screenshot({ path: `${screenshotRoot}-hub-duplicate-belt.png` })

  await page.keyboard.press('i')
  const hubInventory = page.getByRole('dialog', { name: 'Inventory' })
  await hubInventory.waitFor({ timeout: 5_000 })
  await waitForInventory(hubInventory)
  const healthPotion = hubInventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Health Potion, quantity 1',
  })
  await healthPotion.click()
  await healthPotion.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await healthPotion.dblclick()
  await healthPotion.waitFor({ state: 'detached' })
  await page.screenshot({ path: `${screenshotRoot}-hub-inventory.png` })
  await hubInventory.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyard.waitFor({ timeout: 30_000 })

  await page.getByRole('button', { name: /Open inventory/ }).click()
  const matchInventory = page.getByRole('dialog', { name: 'Inventory' })
  await matchInventory.waitFor()
  await waitForInventory(matchInventory)
  assert.equal(await boneyard.getAttribute('data-gameplay-input-blocked'), 'true')
  assert.equal(await matchInventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  }).count(), 1)
  await page.screenshot({ path: `${screenshotRoot}-match-inventory.png` })

  await page.keyboard.press('t')
  const matchBook = page.getByRole('dialog', { name: 'Skills' })
  await matchBook.waitFor()
  await waitForSkillBook(matchBook)
  assert.equal(await matchInventory.count(), 0)
  assert.equal(await matchBook.getByRole('button', { name: /Belt 1, Call Leviathan/ }).count(), 1)
  assert.equal(await matchBook.getByRole('button', { name: /Belt 2, Call Leviathan/ }).count(), 1)
  assert.equal(await boneyard.getAttribute('data-gameplay-input-blocked'), 'true')
  const renderer = await matchBook.locator('.skill-book-canvas').evaluate((canvas) => ({
    height: canvas.height,
    width: canvas.width,
    webgl2: canvas.getContext('webgl2') instanceof WebGL2RenderingContext,
  }))
  assert.deepEqual(renderer, { height: 900, width: 1600, webgl2: true })
  await page.screenshot({ path: `${screenshotRoot}-match-skills.png` })

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    duplicateBelt: true,
    hubInventory: true,
    hubSkills: true,
    matchInventory: true,
    matchSkills: true,
    pageErrors,
    renderer,
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

async function waitForSkillBook(book) {
  await book.locator('.skill-book-canvas').waitFor({ timeout: 15_000 })
  await book.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({ timeout: 5_000 })
}

async function waitForInventory(inventory) {
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({
    timeout: 10_000,
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

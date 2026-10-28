import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'

const evidence = process.env.SDR_TYPOGRAPHY_EVIDENCE || '/tmp/solomon-font-built-20260904'
await mkdir(evidence, { recursive: true })
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const credential = randomBytes(32).toString('base64url')
let host = null
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  headless: true,
})
const errors = { page: [], console: [], responses: [] }
const receipts = []
try {
  for (const scenario of [
    { name: 'retina', width: 1920, height: 1080, deviceScaleFactor: 2, touch: false },
    { name: 'mobile', width: 896, height: 414, deviceScaleFactor: 3, touch: true },
  ]) {
    let { context, page } = await openGame(scenario)
    await capture(page, scenario, 'title', '.title-menu-canvas')

    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    const settings = page.locator('.game-settings-dialog')
    await settings.waitFor()
    const range = settings.getByRole('slider', { name: 'SOUND VOL:' })
    await range.focus()
    await range.press('End')
    const settingsText = await settings.locator('.game-settings-range').first().evaluate(row => {
      const label = row.querySelector('.game-settings-native-label [data-native-ui-font]')
      const glyphs = [...label.querySelectorAll('[data-native-ui-glyph]')].map(glyph => glyph.getBoundingClientRect())
      const rowRect = row.getBoundingClientRect()
      const input = row.querySelector('input').getBoundingClientRect()
      const output = row.querySelector('output').getBoundingClientRect()
      return {
        centerOffset: (Math.min(...glyphs.map(glyph => glyph.top)) + Math.max(...glyphs.map(glyph => glyph.bottom)) - rowRect.top - rowRect.bottom) / 2,
        valueClear: output.left >= input.right,
      }
    })
    assert.ok(Math.abs(settingsText.centerOffset) <= 1)
    assert.equal(settingsText.valueClear, true)
    await page.screenshot({ path: `${evidence}/${scenario.name}-settings.png`, scale: 'css' })
    await settings.getByRole('button', { name: 'DONE', exact: true }).click()
    await openCreate(page)
    await capture(page, scenario, 'create', '.create-menu-canvas')
    await chooseLoadout(page)
    await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 240000 })
    await page.locator('.main-menu-screen-fade-idle').waitFor()
    await page.screenshot({ path: `${evidence}/${scenario.name}-hub.png`, scale: 'css' })
    if (scenario.touch) assert.equal(await page.locator('.hub-hud-quickbar-binding:visible').count(), 0)

    await page.getByRole('button', { name: /Open inventory/ }).click()
    const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
    await inventory.waitFor()
    await page.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({ timeout: 10000 })
    await capture(page, scenario, 'inventory', '.hub-inventory-native-canvas')
    await inventory.getByRole('button', { name: 'Next player stats page', exact: true }).click()
    await capture(page, scenario, 'stats', '.hub-inventory-native-canvas')
    await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
    const skills = page.getByRole('dialog', { name: 'Skills', exact: true })
    await skills.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor({ timeout: 10000 })
    await capture(page, scenario, 'skills', '.skill-book-canvas')
    await skills.getByRole('button', { name: 'Open inventory', exact: true }).click()
    await page.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({ timeout: 10000 })
    await capture(page, scenario, 'inventory-reopened', '.hub-inventory-native-canvas')
    await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
    await inventory.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: /^Select primary attack,/ }).click()
    await capture(page, scenario, 'primary-selector', '.hud-skill-selector-canvas')
    await page.keyboard.press('Escape')
    await page.locator('.hud-skill-selector-stage').waitFor({ state: 'hidden' })
    await context.close()
    await host.close()
    ;({ context, page } = await openGame(scenario, 300))
    await openCreate(page)
    await chooseLoadout(page)
    const picker = page.locator('.skill-picker-canvas')
    await picker.waitFor({ timeout: 30000 })
    await capture(page, scenario, 'level-picker', '.skill-picker-canvas')
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.skill-picker-canvas')
      return canvas?.dataset.nativeTextCacheResolution === canvas?.dataset.resolution
    }, undefined, { timeout: 10000 })
    const firstCache = Number(await picker.getAttribute('data-native-text-cache-resolution'))
    await page.setViewportSize({ width: 1280, height: 720 })
    await capture(page, scenario, 'level-picker-resized', '.skill-picker-canvas')
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.skill-picker-canvas')
      return canvas?.dataset.nativeTextCacheResolution === canvas?.dataset.resolution
    }, undefined, { timeout: 10000 })
    receipts.push({ scenario: scenario.name, name: 'picker-cache', first: firstCache, resized: Number(await picker.getAttribute('data-native-text-cache-resolution')) })
    await context.close()
    await host.close()
    host = null
  }
  assert.deepEqual(errors, { page: [], console: [], responses: [] })
  process.stdout.write(`${JSON.stringify({ errors, receipts })}\n`)
} finally {
  await browser.close()
  await host?.close()
  await server.close()
}

async function openGame(scenario, initialPlayerExperience = 0) {
  host = await startGameHost({
    allowedOrigins: [server.origin],
    authentication: { kind: 'shared', credential },
    initialPlayerExperience,
    sessionKind: 'private-college',
    snapshotRate: 20,
  })
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    deviceScaleFactor: scenario.deviceScaleFactor,
    hasTouch: scenario.touch,
    isMobile: scenario.touch,
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  await page.route('**/deployment.json?*', async route => {
    await route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } })
  })
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
  })
  await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 240000 })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  return { context, page }
}

async function openCreate(page) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: /^New game$/i }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill('Aurelia')
}

async function chooseLoadout(page) {
  await page.getByRole('button', { name: 'water', exact: true }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15000 })
  await page.locator('.create-menu-discipline-arcane').click()
}

async function capture(page, scenario, name, selector) {
  const canvas = page.locator(selector)
  await page.waitForFunction(selector => {
    const target = document.querySelector(selector)
    const rect = target?.getBoundingClientRect()
    return rect && Math.abs(target.width - Math.round(rect.width * devicePixelRatio)) <= 1
      && Math.abs(target.height - Math.round(rect.height * devicePixelRatio)) <= 1
  }, selector, { timeout: 10000 })
  const receipt = await canvas.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { backing: [element.width, element.height], displayed: [rect.width, rect.height], dpr: devicePixelRatio }
  })
  receipts.push({ scenario: scenario.name, name, ...receipt })
  await page.screenshot({ path: `${evidence}/${scenario.name}-${name}.png`, scale: 'css' })
}

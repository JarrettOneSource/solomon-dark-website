import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_NATIVE_UI_SCREENSHOT
  || '/tmp/solomon-dark-native-ui-workbench.png'
const domScreenshotPath = process.env.SDR_NATIVE_UI_DOM_SCREENSHOT
  || '/tmp/solomon-dark-native-ui-dom-workbench.png'
const boastScreenshotPath = process.env.SDR_NATIVE_UI_BOAST_SCREENSHOT
  || '/tmp/solomon-dark-native-ui-boast-workbench.png'
const boastScrolledScreenshotPath = process.env.SDR_NATIVE_UI_BOAST_SCROLLED_SCREENSHOT
  || '/tmp/solomon-dark-native-ui-boast-workbench-scrolled.png'
const errors = {
  console: [],
  failedResponses: [],
  page: [],
}

const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer?.address()
if (!address || typeof address === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its native-UI workbench port')
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
try {
  const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) {
      errors.failedResponses.push({ status: response.status(), url: response.url() })
    }
  })
  await page.goto(`http://127.0.0.1:${address.port}/native-ui.html`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(() => document.documentElement.dataset.nativeUiWorkbench === 'ready')
  const canvas = page.locator('.native-ui-workbench-canvas')
  await canvas.waitFor()
  assert.deepEqual(await canvas.evaluate(element => ({
    actionCount: element.dataset.actionCount,
    atlasCount: element.dataset.atlasCount,
    fontCount: element.dataset.fontCount,
    mode: element.dataset.mode,
    recordCount: element.dataset.recordCount,
  })), {
    actionCount: '6',
    atlasCount: '13',
    fontCount: '10',
    mode: 'components',
    recordCount: '1292',
  })
  await canvas.screenshot({ path: screenshotPath })

  await page.locator('#show-dom').click()
  const dom = page.locator('[data-native-ui-dom-workbench="ready"]:not([hidden])')
  await dom.waitFor()
  assert.equal(await dom.locator('[data-native-ui-message-box]').count(), 1)
  assert.equal(await dom.locator('[data-native-ui-button]').count(), 3)
  assert.equal(await dom.locator('[data-native-ui-tabs]').count(), 1)
  assert.equal(await dom.locator('[data-native-ui-tab]').count(), 4)
  assert.equal(await dom.locator('[data-native-ui-simple-menu]').count(), 1)
  assert.equal(await dom.locator('[data-native-ui-simple-menu-action]').count(), 2)
  assert.equal(await dom.locator('[data-native-ui-settings-controls]').count(), 1)
  assert.equal(await dom.getByRole('slider', { name: 'SOUND VOL:' }).count(), 1)
  assert.equal(await dom.locator('[data-native-ui-font="menu"]').count() > 0, true)
  assert.equal(await dom.locator('[data-native-ui-font="medium"]').count() > 0, true)
  await dom.getByRole('tab', { name: 'SIMPLE MENUS' }).click()
  assert.equal(
    await dom.getByRole('tab', { name: 'SIMPLE MENUS' }).getAttribute('aria-selected'),
    'true',
  )
  const menuSettings = dom.locator('[data-native-ui-simple-menu-action="settings"]')
  await menuSettings.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' })
  assert.equal(
    await dom.locator('[data-native-ui-simple-menu]').getAttribute('data-native-ui-simple-menu-pressed'),
    'settings',
  )
  assert.equal(await dom.locator('[data-native-ui-node="settings:body"] [data-native-ui-record="UI.102"]').count(), 1)
  await menuSettings.dispatchEvent('pointercancel', { pointerType: 'mouse' })
  await waitForDomUiImages(page)
  await page.locator('#native-ui-stage').screenshot({ path: domScreenshotPath })
  await dom.getByRole('tab', { name: 'BOAST MENU' }).click()
  const boastMenu = dom.locator('[data-native-ui-boast-menu]')
  await boastMenu.waitFor()
  assert.equal(await boastMenu.locator('[data-native-ui-boast-action]').count(), 6)
  assert.equal(await boastMenu.locator('[data-native-ui-clip="boast:swipe-box"]').count(), 1)
  assert.equal(await boastMenu.locator('[data-native-ui-node="native:0:icon-left"]').count(), 1)
  assert.equal(await boastMenu.locator('[data-native-ui-node="native:0:icon-right"]').count(), 1)
  assert.equal(
    await boastMenu.locator('[data-native-ui-node="native:0:detail"]')
      .getAttribute('data-native-ui-text-lines'),
    '"I can do this entire mission without\ndrinking a single potion of any kind!"',
  )
  assert.equal(await boastMenu.getAttribute('data-native-ui-boast-scroll-max'), '95')
  assert.equal(await boastMenu.getAttribute('data-native-ui-boast-scroll-y'), '0')
  const boastBounds = await boastMenu.boundingBox()
  assert.ok(boastBounds)
  const logicalActionHeight = async id => {
    const bounds = await boastMenu.locator(`[data-native-ui-boast-action="${id}"]`).boundingBox()
    assert.ok(bounds)
    return bounds.height / (boastBounds.height / 900)
  }
  assert.ok(Math.abs(await logicalActionHeight('native:4') - 15) < 0.01)
  await waitForDomUiImages(page)
  await page.locator('#native-ui-stage').screenshot({ path: boastScreenshotPath })
  const scaleX = boastBounds.width / 1_600
  const scaleY = boastBounds.height / 900
  await page.mouse.move(boastBounds.x + 800 * scaleX, boastBounds.y + 650 * scaleY)
  await page.mouse.down()
  await page.mouse.move(boastBounds.x + 800 * scaleX, boastBounds.y + 450 * scaleY, { steps: 4 })
  await page.mouse.up()
  await page.waitForFunction(() => (
    document.querySelector('[data-native-ui-boast-menu]')
      ?.getAttribute('data-native-ui-boast-scroll-y') === '95'
  ))
  assert.ok(Math.abs(await logicalActionHeight('native:0') - 15) < 0.01)
  assert.ok(Math.abs(await logicalActionHeight('native:4') - 85) < 0.01)
  await page.locator('#native-ui-stage').screenshot({ path: boastScrolledScreenshotPath })
  await boastMenu.locator('[data-native-ui-boast-action="native:3"]').click()
  assert.equal(
    await boastMenu.locator('[data-native-ui-boast-action="native:3"]')
      .getAttribute('aria-pressed'),
    'true',
  )
  await boastMenu.locator('[data-native-ui-boast-action="native:3"]').press('ArrowUp')
  await page.waitForFunction(() => (
    document.querySelector('[data-native-ui-boast-menu]')
      ?.getAttribute('data-native-ui-boast-scroll-y') === '70'
  ))
  await boastMenu.locator('[data-native-ui-boast-action="native:3"]').press('PageDown')
  await page.waitForFunction(() => (
    document.querySelector('[data-native-ui-boast-menu]')
      ?.getAttribute('data-native-ui-boast-scroll-y') === '95'
  ))
  await page.locator('#show-components').click()
  await canvas.waitFor({ state: 'visible' })

  const atlasCounts = {
    Bonedit: 84,
    ControlPanel: 116,
    Controls: 4,
    Create: 24,
    Fonts: 627,
    GameOver: 3,
    Inventory: 84,
    LevelPicker: 8,
    Loader: 5,
    Skills: 166,
    Title: 25,
    UI: 113,
  }
  for (const [atlas, count] of Object.entries(atlasCounts)) {
    await page.locator('#atlas').selectOption(atlas)
    await page.locator('#record').fill(`${count - 1}`)
    await page.locator('#record').dispatchEvent('change')
    await page.waitForFunction(({ expectedAtlas, expectedRecord }) => {
      const target = document.querySelector('.native-ui-workbench-canvas')
      return target?.dataset.mode === 'atlas'
        && target.dataset.atlas === expectedAtlas
        && target.dataset.record === expectedRecord
    }, { expectedAtlas: atlas, expectedRecord: `${count - 1}` })
  }
  assert.deepEqual(errors, { console: [], failedResponses: [], page: [] })
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    atlasesExercised: Object.keys(atlasCounts),
    boastScreenshotPath,
    boastScrolledScreenshotPath,
    domScreenshotPath,
    screenshotPath,
    errors,
  })}\n`)
} finally {
  await browser.close()
  await vite.close()
}

async function waitForDomUiImages(page) {
  await page.evaluate(async () => {
    const urls = new Set()
    for (const element of document.querySelectorAll('[data-native-ui-dom-workbench] *')) {
      const style = getComputedStyle(element)
      for (const source of [style.backgroundImage, style.maskImage, style.webkitMaskImage]) {
        for (const match of (source || '').matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          urls.add(new URL(match[1], document.baseURI).href)
        }
      }
    }
    await Promise.all(Array.from(urls, async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
    }))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}

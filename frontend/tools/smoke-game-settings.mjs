import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { startGameHost } from '../src/game/host/game-host.ts'
import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const screenshots = {
  boneyard: process.env.SDR_GAME_SETTINGS_BONEYARD_SCREENSHOT
    || '/tmp/solomon-dark-settings-boneyard.png',
  darkCloud: process.env.SDR_GAME_SETTINGS_DARK_CLOUD_SCREENSHOT
    || '/tmp/solomon-dark-settings-dark-cloud.png',
  title: process.env.SDR_GAME_SETTINGS_TITLE_SCREENSHOT
    || '/tmp/solomon-dark-settings-title.png',
}
const errors = []
let darkCloudPaint = null

const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local Settings-smoke port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 20,
})
const runtime = {
  gameEndpoint: {
    credential,
    kind: 'localhost',
    url: host.address.url,
  },
}
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  executablePath: process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'),
  headless: true,
})
const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })

try {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.route('**/api/mods?**', (route) => route.fulfill({
    body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/game/parties', (route) => route.fulfill({
    body: JSON.stringify({ items: [] }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript((configuration) => {
    window.solomonDarkRuntime = configuration
  }, runtime)
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  // A fresh browser profile has no save, so the title offers the stock Tutorial prompt first.
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
    await tutorialOffer.waitFor({ state: 'detached' })
  }

  await page.getByRole('button', { name: 'Settings' }).click()
  let dialog = page.locator('.game-settings-dialog')
  await dialog.waitFor()
  assert.equal(await dialog.getAttribute('data-settings-context'), 'title')
  assert.equal(await dialog.getAttribute('data-settings-page'), 'root')
  assert.equal(await dialog.getByText('RESOLUTION', { exact: true }).count(), 0)
  await setRange(dialog.getByRole('slider', { name: 'SOUND VOL:' }), 65)
  await setRange(dialog.getByRole('slider', { name: 'MUSIC VOL:' }), 40)
  await setRange(dialog.getByRole('slider', { name: 'CAMERA FOV' }), 125)
  await setRange(dialog.getByRole('slider', { name: 'UI SCALE' }), 150)

  const fullscreen = dialog.locator('[data-settings-fullscreen]')
  if (await fullscreen.getAttribute('aria-pressed') !== null) {
    await fullscreen.click()
    await page.waitForFunction(() => document.fullscreenElement === document.documentElement)
    await page.waitForFunction(() => (
      document.querySelector('[data-settings-fullscreen]')?.getAttribute('aria-pressed') === 'true'
    ))
    assert.equal(await fullscreen.getAttribute('aria-pressed'), 'true')
    await fullscreen.click()
    await page.waitForFunction(() => document.fullscreenElement === null)
    await page.waitForFunction(() => (
      document.querySelector('[data-settings-fullscreen]')?.getAttribute('aria-pressed') === 'false'
    ))
  }

  await dialog.getByRole('button', { name: 'CUSTOMIZE KEYBOARD' }).click()
  assert.equal(await dialog.getAttribute('data-settings-page'), 'controls')
  const moveRight = dialog.locator('[data-binding-action="moveRight"]')
  await moveRight.click()
  await page.keyboard.press('KeyZ')
  assert.equal(await moveRight.getAttribute('data-binding-code'), 'KeyZ')
  assert.match(await moveRight.innerText(), /Z/)
  const openSkills = dialog.locator('[data-binding-action="openSkills"]')
  const openChat = dialog.locator('[data-binding-action="openChat"]')
  assert.equal(await openSkills.getAttribute('data-binding-code'), 'KeyK')
  assert.equal(await openChat.getAttribute('data-binding-code'), 'KeyT')
  await openSkills.click()
  await page.keyboard.press('KeyT')
  assert.equal(await openSkills.getAttribute('data-binding-code'), 'KeyT')
  assert.equal(await openChat.getAttribute('data-binding-code'), 'KeyK')
  await dialog.getByRole('button', { name: 'BACK' }).click()
  await dialog.locator('[data-game-default-focus="true"]').waitFor()
  await nextPaint(page)
  await page.screenshot({ path: screenshots.title })
  await dialog.getByRole('button', { name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })

  const persistedTitle = await storedSettings(page)
  assert.deepEqual({
    cameraFovPercent: persistedTitle.cameraFovPercent,
    openChat: persistedTitle.controls.openChat,
    openSkills: persistedTitle.controls.openSkills,
    moveRight: persistedTitle.controls.moveRight,
    musicVolumePercent: persistedTitle.musicVolumePercent,
    soundVolumePercent: persistedTitle.soundVolumePercent,
    uiScalePercent: persistedTitle.uiScalePercent,
  }, {
    cameraFovPercent: 125,
    openChat: 'KeyK',
    openSkills: 'KeyT',
    moveRight: 'KeyZ',
    musicVolumePercent: 40,
    soundVolumePercent: 65,
    uiScalePercent: 150,
  })

  await page.getByRole('button', { name: 'Explore the Dark Cloud' }).click()
  await page.locator('.dark-cloud-scene').waitFor()
  await page.locator('.main-menu-screen-fade-idle').waitFor()
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'GAME SETTINGS' }).click()
  dialog = page.locator('.game-settings-dialog')
  await dialog.waitFor()
  assert.equal(await dialog.getAttribute('data-settings-context'), 'dark-cloud')
  assert.equal(await page.locator('.dark-cloud-modal-backdrop').count(), 0)
  darkCloudPaint = await dialog.evaluate((node) => {
    const label = [...node.querySelectorAll('span')].find((candidate) => (
      candidate.textContent === 'SOUND VOL:'
    ))
    if (!(label instanceof HTMLElement)) throw new Error('Dark Cloud Settings sound label is missing')
    const bounds = label.getBoundingClientRect()
    const style = getComputedStyle(label)
    const top = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    return {
      bounds: { height: bounds.height, width: bounds.width, x: bounds.x, y: bounds.y },
      color: style.color,
      display: style.display,
      opacity: style.opacity,
      topClass: top?.className ?? '',
      topTag: top?.tagName ?? '',
      visibility: style.visibility,
    }
  })
  await nextPaint(page)
  await page.screenshot({ path: screenshots.darkCloud })
  await dialog.getByRole('button', { name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.dark-cloud-scene').count(), 1)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'MAIN MENU' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor()

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /water/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  const hubScene = page.locator(
    '.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]',
  )
  await hubScene.waitFor({ timeout: 90_000 })
  assert.equal(await hubScene.getAttribute('data-camera-zoom'), '0.96')
  assert.equal(await hubScene.getAttribute('data-ui-scale'), '1.5')
  assert.equal(await page.locator('.hub-hud').getAttribute('data-ui-scale'), '1.5')

  const hubCanvas = page.locator('.hub-world-canvas')
  const beforeMove = await hubCanvas.evaluate((canvas) => canvas.__sdrHubFrame.playerX)
  await page.keyboard.down('z')
  await page.waitForTimeout(350)
  await page.keyboard.up('z')
  await page.waitForTimeout(100)
  const afterMove = await hubCanvas.evaluate((canvas) => canvas.__sdrHubFrame.playerX)
  assert.ok(afterMove > beforeMove + 10, `configured Move Right did not move: ${beforeMove} -> ${afterMove}`)
  await page.keyboard.press('KeyK')
  const chat = page.locator('.game-chat[data-chat-open="true"]')
  await chat.waitFor()
  assert.equal(await chat.locator('.game-chat-input').evaluate((input) => input === document.activeElement), true)
  await page.keyboard.press('Escape')
  await page.locator('.game-chat[data-chat-open="false"]').waitFor()
  const hubReceipt = {
    cameraZoom: Number(await hubScene.getAttribute('data-camera-zoom')),
    chatBinding: persistedTitle.controls.openChat,
    movementDelta: afterMove - beforeMove,
    uiScale: Number(await hubScene.getAttribute('data-ui-scale')),
  }

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyardScene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const boneyardPicker = page.locator('.hub-boneyard-picker')
  const firstBoneyardOption = page.locator('.hub-boneyard-option').first()
  await Promise.race([
    boneyardScene.waitFor({ timeout: 90_000 }),
    boneyardPicker.waitFor({ timeout: 90_000 }),
  ])
  if (await boneyardPicker.isVisible()) {
    await firstBoneyardOption.waitFor({ timeout: 30_000 })
    await firstBoneyardOption.click()
  }
  await boneyardScene.waitFor({ timeout: 90_000 })
  assert.equal(await boneyardScene.getAttribute('data-camera-zoom'), '1.08')
  await boneyardScene.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor()
  await page.waitForTimeout(350)
  await pause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  dialog = page.locator('.game-settings-dialog')
  await dialog.waitFor()
  assert.equal(await dialog.getAttribute('data-settings-context'), 'gameplay')
  await dialog.getByRole('button', { name: 'TWEAK GAME' }).click()
  for (const label of ['COMPLEX LIGHTING', 'COMPLEX SHADOWS', 'MULTIPLE SHADOWS']) {
    const toggle = dialog.getByRole('button', { name: label })
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
    await toggle.click()
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false')
  }
  const cameraShake = dialog.getByRole('button', { name: 'CAMERA SHAKE' })
  await cameraShake.click()
  assert.equal(await cameraShake.getAttribute('aria-pressed'), 'false')
  await setRange(dialog.getByRole('slider', { name: 'LIGHT QUALITY' }), 24)

  const boneyardCanvas = page.locator('.boneyard-world-canvas')
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    return canvas?.dataset.complexLighting === 'false'
      && canvas.dataset.complexShadowsEnabled === 'false'
      && canvas.dataset.multipleShadows === 'false'
      && canvas.dataset.zoomEffects === 'false'
  })
  assert.equal(await boneyardCanvas.getAttribute('data-light-quality'), `${Math.fround(0.06)}`)
  await nextPaint(page)
  await page.screenshot({ path: screenshots.boneyard })
  await dialog.getByRole('button', { name: 'BACK' }).click()
  await dialog.getByRole('button', { name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.dataset.complexShadowRecordCount === '0'
  ))

  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    boneyard: {
      cameraZoom: Number(await boneyardScene.getAttribute('data-camera-zoom')),
      complexLighting: await boneyardCanvas.getAttribute('data-complex-lighting'),
      complexShadowRecords: Number(
        await boneyardCanvas.getAttribute('data-complex-shadow-record-count'),
      ),
      lightQuality: Number(await boneyardCanvas.getAttribute('data-light-quality')),
      multipleShadows: await boneyardCanvas.getAttribute('data-multiple-shadows'),
      zoomEffects: await boneyardCanvas.getAttribute('data-zoom-effects'),
    },
    darkCloudPaint,
    errors,
    hub: hubReceipt,
    screenshots,
    status: 'ok',
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    body: (await page.locator('body').innerText().catch(() => '')).slice(0, 2_000),
    boneyard: await page.locator('.boneyard-scene').evaluateAll((nodes) => (
      nodes.map((node) => ({ ...node.dataset }))
    )),
    errors,
    hub: await page.locator('.hub-scene').evaluateAll((nodes) => (
      nodes.map((node) => ({ ...node.dataset }))
    )),
    loading: await page.locator('.match-loading-screen').allInnerTexts(),
    runtimeStatus: await page.locator('.main-menu-runtime-status').allInnerTexts(),
  })}\n`)
  throw error
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

async function setRange(locator, value) {
  await locator.fill(`${value}`)
}

async function storedSettings(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), GAME_SETTINGS_STORAGE_KEY)
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => (
    requestAnimationFrame(resolve)
  ))))
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

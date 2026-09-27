import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer, preview } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { emitNativePlayerScreenFlash } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const mobile = process.env.SDR_GAME_SETTINGS_MOBILE === '1'
const built = process.env.SDR_GAME_SETTINGS_BUILT === '1'
const screenshots = {
  boneyard: process.env.SDR_GAME_SETTINGS_BONEYARD_SCREENSHOT
    || '/tmp/solomon-dark-settings-boneyard.png',
  darkCloud: process.env.SDR_GAME_SETTINGS_DARK_CLOUD_SCREENSHOT
    || '/tmp/solomon-dark-settings-dark-cloud.png',
  title: process.env.SDR_GAME_SETTINGS_TITLE_SCREENSHOT
    || '/tmp/solomon-dark-settings-title.png',
}
const errors = []
const failedResponses = []
let darkCloudPaint = null
let mobileAudio = null
let settingsPresentation = null
const rangeTouches = {}

const vite = built ? await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', root: frontendRoot,
  preview: { host: '127.0.0.1', port: 0 },
}) : await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
if (!built) await vite.listen()
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
const context = await browser.newContext(mobile ? {
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1',
  viewport: { height: 414, width: 896 },
} : { viewport: { height: 900, width: 1600 } })
const page = await context.newPage()

try {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })
  await page.route('**/api/mods?**', (route) => route.fulfill({
    body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/mods/popular?**', (route) => route.fulfill({
    body: JSON.stringify({ days: 30, items: [] }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/stats', (route) => route.fulfill({
    body: JSON.stringify({
      downloadsTotal: 0,
      enrolled: 0,
      matchesLive: 0,
      savesSynced: 0,
      tomes: 0,
      wizardsOnline: 0,
    }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/game/parties', (route) => route.fulfill({
    body: JSON.stringify({ items: [] }),
    contentType: 'application/json',
    status: 200,
  }))
  // The deployment-revision poll (deployment-revision.ts, every 15 s from Game.tsx) asks for
  // deployment.json; Vite dev serves none, and each 404 lands in `errors`, so answer with the
  // current revision like the other smokes do.
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  if (mobile) {
    await page.addInitScript(emulateIosMediaVolume)
    await page.addInitScript(() => {
      localStorage.setItem('sdr:muted', '0')
      localStorage.setItem('sdr:sfx-muted', '0')
    })
  }
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript((configuration) => {
    window.solomonDarkRuntime = configuration
  }, runtime)
  if (mobile) mobileAudio = await exercisePublicSiteAudio(page, baseUrl)
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
  settingsPresentation = await assertNativeSettingsPresentation(dialog, { desktop: !mobile })
  assert.equal(await dialog.getAttribute('data-settings-context'), 'title')
  assert.equal(await dialog.getAttribute('data-settings-page'), 'root')
  assert.equal(await dialog.getByText('RESOLUTION', { exact: true }).count(), 0)
  assert.deepEqual(
    await dialog.locator('.game-settings-content > .game-settings-group').evaluateAll(groups => (
      groups.map(group => group.getAttribute('aria-label'))
    )),
    ['SOUND AND MUSIC', 'VIDEO SETTINGS', 'DARK CLOUD SETTINGS', 'CONTROLS', 'PERFORMANCE'],
  )
  const footer = dialog.getByRole('button', { exact: true, name: 'DONE' })
  assert.equal(await footer.locator('[data-native-ui-record="UI.105"]').count(), 1)
  await footer.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' })
  assert.equal(await footer.locator('[data-native-ui-record="UI.106"]').count(), 1)
  await footer.dispatchEvent('pointerup', { button: 0, pointerType: 'mouse' })
  await dialog.getByRole('button', { name: 'ONLINE AND ACCOUNT' }).click()
  assert.equal(await dialog.getAttribute('data-settings-page'), 'cloud')
  const onlineMaster = dialog.getByRole('button', { name: 'ENABLE ONLINE FEATURES' })
  const onlineChildren = [
    'ENABLE ACTIVITY MESSAGES',
    'ENABLE GLOBAL CHAT',
    'ENABLE SHARED HUB',
    'SUBMIT RUNS TO SERVER',
  ].map(name => dialog.getByRole('button', { name }))
  assert.equal(await onlineMaster.getAttribute('aria-pressed'), 'true')
  for (const child of onlineChildren) {
    assert.equal(await child.getAttribute('aria-pressed'), 'true')
    assert.equal(await child.isEnabled(), true)
  }
  await onlineMaster.click()
  assert.equal(await onlineMaster.getAttribute('aria-pressed'), 'false')
  for (const child of onlineChildren) {
    assert.equal(await child.getAttribute('aria-pressed'), 'false')
    assert.equal(await child.isDisabled(), true)
  }
  await onlineMaster.click()
  for (const child of onlineChildren) {
    assert.equal(await child.getAttribute('aria-pressed'), 'true')
    assert.equal(await child.isEnabled(), true)
  }
  await dialog.getByRole('button', { exact: true, name: 'BACK' }).click()
  assert.equal(await dialog.getAttribute('data-settings-page'), 'root')
  await setRange(dialog.getByRole('slider', { name: 'SOUND VOL:' }), 65)
  await setRange(dialog.getByRole('slider', { name: 'MUSIC VOL:' }), 40)
  await setRange(dialog.getByRole('slider', { name: 'CAMERA FOV' }), 125)
  await setRange(dialog.getByRole('slider', { name: 'UI SCALE' }), 150)
  if (mobile) {
    await page.waitForFunction(() => window.__sdrAudioMediaChannels?.().some((channel) => (
      window.__sdrAudioSourceMatches(channel.src, 'solomondarktheme.mp3')
        && channel.volume === 1
        && Math.abs(channel.outputVolume - 0.4) < 0.001
    )), undefined, { timeout: 5_000 })
    await page.waitForFunction(() => (
      window.__sdrAudioMasterVolumes?.('click').length > 0
        && window.__sdrAudioMasterVolumes('click')
          .every((volume) => Math.abs(volume - 0.65) < 0.001)
    ))
    mobileAudio = {
      ...mobileAudio,
      game: await page.evaluate(() => ({
        music: window.__sdrAudioMediaChannels().find((channel) => (
          window.__sdrAudioSourceMatches(channel.src, 'solomondarktheme.mp3')
        )),
        soundMaster: window.__sdrAudioMasterVolumes('click'),
      })),
    }
  }

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
  const healthPotion = dialog.locator('[data-binding-action="belt4"]')
  const manaPotion = dialog.locator('[data-binding-action="belt5"]')
  assert.equal(await openSkills.getAttribute('data-binding-code'), 'KeyK')
  assert.equal(await openChat.getAttribute('data-binding-code'), 'KeyT')
  assert.equal(await healthPotion.getAttribute('data-binding-code'), 'Digit3')
  assert.equal(await manaPotion.getAttribute('data-binding-code'), 'Digit4')
  await openSkills.click()
  await page.keyboard.press('KeyT')
  assert.equal(await openSkills.getAttribute('data-binding-code'), 'KeyT')
  assert.equal(await openChat.getAttribute('data-binding-code'), 'KeyK')
  await healthPotion.click()
  await page.keyboard.press('KeyH')
  await manaPotion.click()
  await page.keyboard.press('KeyJ')
  assert.equal(await healthPotion.getAttribute('data-binding-code'), 'KeyH')
  assert.equal(await manaPotion.getAttribute('data-binding-code'), 'KeyJ')
  await dialog.getByRole('button', { exact: true, name: 'BACK' }).click()
  await dialog.locator('[data-game-default-focus="true"]').waitFor()
  await dialog.getByRole('button', { name: 'TWEAK GAME' }).click()
  const reducedScreenFlashes = dialog.getByRole('button', { name: 'REDUCED SCREEN FLASHES' })
  assert.equal(await reducedScreenFlashes.getAttribute('aria-pressed'), 'false')
  await reducedScreenFlashes.click()
  assert.equal(await reducedScreenFlashes.getAttribute('aria-pressed'), 'true')
  await dialog.getByRole('button', { exact: true, name: 'BACK' }).click()
  await nextPaint(page)
  await page.screenshot({ path: screenshots.title })
  await dialog.getByRole('button', { exact: true, name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })

  const persistedTitle = await storedSettings(page)
  assert.deepEqual({
    cameraFovPercent: persistedTitle.cameraFovPercent,
    healthPotion: persistedTitle.controls.belt4,
    manaPotion: persistedTitle.controls.belt5,
    openChat: persistedTitle.controls.openChat,
    openSkills: persistedTitle.controls.openSkills,
    moveRight: persistedTitle.controls.moveRight,
    musicVolumePercent: persistedTitle.musicVolumePercent,
    online: {
      activity: persistedTitle.enableActivityMessages,
      globalChat: persistedTitle.enableGlobalChat,
      master: persistedTitle.enableOnlineFeatures,
      sharedHub: persistedTitle.enableSharedHub,
      submitRuns: persistedTitle.submitRunsToServer,
    },
    reducedScreenFlashes: persistedTitle.reducedScreenFlashes,
    soundVolumePercent: persistedTitle.soundVolumePercent,
    uiScalePercent: persistedTitle.uiScalePercent,
  }, {
    cameraFovPercent: 125,
    healthPotion: 'KeyH',
    manaPotion: 'KeyJ',
    openChat: 'KeyK',
    openSkills: 'KeyT',
    moveRight: 'KeyZ',
    musicVolumePercent: 40,
    online: {
      activity: true,
      globalChat: true,
      master: true,
      sharedHub: true,
      submitRuns: true,
    },
    reducedScreenFlashes: true,
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
  await assertNativeSettingsPresentation(dialog, { desktop: !mobile })
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
  await dialog.getByRole('button', { exact: true, name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.dark-cloud-scene').count(), 1)
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'MAIN MENU' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor()

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeAdmission(page, host)
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
  await page.locator('.hub-hud-quickbar-slot[data-entry-kind="health-potion"][data-binding-code="KeyH"]').waitFor()
  await page.locator('.hub-hud-quickbar-slot[data-entry-kind="mana-potion"][data-binding-code="KeyJ"]').waitFor()

  const hubCanvas = page.locator('.hub-world-canvas')
  const hubScreenFlash = await captureReducedScreenFlash(
    page,
    host,
    '.hub-world-canvas',
  )
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
    potionBindings: ['H', 'J'],
    screenFlash: hubScreenFlash,
    uiScale: Number(await hubScene.getAttribute('data-ui-scale')),
  }

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyardScene = page.locator(
    '.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]',
  )
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
  const boneyardCanvas = page.locator('.boneyard-world-canvas')
  const boneyardScreenFlash = await captureReducedScreenFlash(
    page,
    host,
    '.boneyard-world-canvas',
  )
  await boneyardScene.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor()
  await page.waitForTimeout(350)
  await pause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  dialog = page.locator('.game-settings-dialog')
  await dialog.waitFor()
  await assertNativeSettingsPresentation(dialog, { desktop: !mobile })
  assert.equal(await dialog.getAttribute('data-settings-context'), 'gameplay')
  await dialog.getByRole('button', { name: 'TWEAK GAME' }).click()
  assert.equal(
    await dialog.getByRole('button', { name: 'REDUCED SCREEN FLASHES' })
      .getAttribute('aria-pressed'),
    'true',
  )
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

  await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    return canvas?.dataset.complexLighting === 'false'
      && canvas.dataset.complexShadowsEnabled === 'false'
      && canvas.dataset.multipleShadows === 'false'
      && canvas.dataset.zoomEffects === 'false'
  })
  assert.equal(await boneyardCanvas.getAttribute('data-light-quality'), `${Math.fround(0.06)}`)
  await nextPaint(page)
  const lowQualityRegionTarget = await boneyardCanvas.evaluate((canvas) => ({
    logicalSide: canvas.__sdrBoneyardFrame.regionLightLogicalSide,
    physicalSide: canvas.__sdrBoneyardFrame.regionLightPhysicalSide,
  }))
  assert.equal(lowQualityRegionTarget.physicalSide, 128)
  const pausedRedraw = mobile ? null : await assertPausedWorldRedraw(boneyardCanvas)
  // The module-level ownership probe uses Vite imports; the full UI journey also runs built.
  const retainedHailRedraw = mobile || built ? null : await assertRetainedHailRedraw()
  await page.screenshot({ path: screenshots.boneyard })
  await dialog.getByRole('button', { exact: true, name: 'BACK' }).click()
  await dialog.getByRole('button', { exact: true, name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.dataset.complexShadowRecordCount === '0'
  ))

  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    boneyard: {
      cameraZoom: Number(await boneyardScene.getAttribute('data-camera-zoom')),
      complexLighting: await boneyardCanvas.getAttribute('data-complex-lighting'),
      complexShadowRecords: Number(
        await boneyardCanvas.getAttribute('data-complex-shadow-record-count'),
      ),
      lightQuality: Number(await boneyardCanvas.getAttribute('data-light-quality')),
      lowQualityRegionTarget,
      pausedRedraw,
      retainedHailRedraw,
      multipleShadows: await boneyardCanvas.getAttribute('data-multiple-shadows'),
      screenFlash: boneyardScreenFlash,
      zoomEffects: await boneyardCanvas.getAttribute('data-zoom-effects'),
    },
    darkCloudPaint,
    errors,
    failedResponses,
    hub: hubReceipt,
    mobileAudio,
    rangeTouches,
    settingsPresentation,
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
    failedResponses,
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
  if (mobile) {
    await locator.scrollIntoViewIfNeeded()
    const before = Number(await locator.inputValue())
    const minimum = Number(await locator.getAttribute('min'))
    const maximum = Number(await locator.getAttribute('max'))
    const touchValue = before === minimum ? maximum : minimum
    const box = await locator.boundingBox()
    assert.ok(box)
    const row = locator.locator('xpath=ancestor::label[1]')
    const label = await row.locator('.game-settings-native-label .sr-only').innerText()
    await locator.tap({
      position: {
        x: touchValue === minimum ? 1 : box.width - 1,
        y: box.height / 2,
      },
    })
    await page.waitForTimeout(100)
    assert.equal(Number(await locator.inputValue()), touchValue)
    assert.equal(
      await row.locator('output').innerText(),
      `${touchValue}%`,
    )
    rangeTouches[label] = { before, touchValue }
    if (label === 'SOUND VOL:') {
      await page.waitForFunction(() => (
        window.__sdrAudioMasterVolumes?.('click').length > 0
          && window.__sdrAudioMasterVolumes('click').every((volume) => volume === 0)
      ))
    } else if (label === 'MUSIC VOL:') {
      await page.waitForFunction(() => window.__sdrAudioMediaChannels?.().some((channel) => (
        window.__sdrAudioSourceMatches(channel.src, 'solomondarktheme.mp3')
          && channel.volume === 1
          && channel.outputVolume === 0
      )))
    }
  }
  await locator.fill(`${value}`)
  assert.equal(Number(await locator.inputValue()), value)
}

async function assertPausedWorldRedraw(canvas) {
  const viewport = page.viewportSize()
  assert.ok(viewport)
  const frozen = await canvas.evaluate(node => ({
    frameCount: node.__sdrBoneyardFrame.frameCount,
    tick: node.__sdrBoneyardFrame.tick,
  }))
  const before = await pausedWorldPixels(canvas)
  await page.setViewportSize({ width: viewport.width + 160, height: viewport.height + 90 })
  await nextPaint(page)
  const resized = await pausedWorldPixels(canvas)
  await page.setViewportSize(viewport)
  await nextPaint(page)
  const restored = await pausedWorldPixels(canvas)
  assert.equal(restored.rgbaSha256, before.rgbaSha256, 'paused resize advanced the retained world image')
  assert.deepEqual(await canvas.evaluate(node => ({
    frameCount: node.__sdrBoneyardFrame.frameCount,
    tick: node.__sdrBoneyardFrame.tick,
  })), frozen, 'local graphics repaint advanced the frozen presentation')
  return { before, resized, restored, ...frozen }
}

async function pausedWorldPixels(canvas) {
  const style = await page.addStyleTag({ content:
    '.game-settings-backdrop, .gameplay-pause-stage { visibility: hidden !important; }',
  })
  try {
    const box = await canvas.boundingBox()
    assert.ok(box)
    const focus = await canvas.evaluate(node => {
      const frame = node.__sdrBoneyardFrame
      const width = Number(node.dataset.viewportWidth), height = Number(node.dataset.viewportHeight)
      return { x: .5 + (frame.playerX - frame.cameraX) * frame.cameraZoom / width,
        y: .5 + (frame.playerY - frame.cameraY) * frame.cameraZoom / height }
    })
    const png = await page.screenshot({ clip: {
      x: Math.max(box.x, Math.min(box.x + box.width - 160, box.x + box.width * focus.x - 80)),
      y: Math.max(box.y, Math.min(box.y + box.height - 160, box.y + box.height * focus.y - 80)),
      width: 160, height: 160,
    } })
    const pixels = await page.evaluate(async data => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob())
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width; canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      context.drawImage(bitmap, 0, 0); bitmap.close()
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data
      let nonblack = 0
      for (let index = 0; index < rgba.length; index += 4) {
        if (Math.max(rgba[index], rgba[index + 1], rgba[index + 2]) > 8) nonblack += 1
      }
      const digest = await crypto.subtle.digest('SHA-256', rgba)
      return { nonblack, rgbaSha256: [...new Uint8Array(digest)]
        .map(value => value.toString(16).padStart(2, '0')).join('') }
    }, png.toString('base64'))
    assert.ok(pixels.nonblack > 32, 'paused graphics change cleared the world canvas')
    return pixels
  } finally { await style.evaluate(node => node.remove()) }
}

async function assertRetainedHailRedraw() {
  const playerId = host.hostPlayerId()
  const boneyard = host.loadedBoneyard()
  assert.ok(playerId && boneyard)
  const receipt = await page.evaluate(async ({ snapshot, boneyard, playerId }) => {
    const { createBoneyardWorldRenderer } = await import('/src/game/renderer/boneyard-world-renderer.ts')
    const { createRetainedBoneyardPrimarySpellPresentation } = await import('/src/game/client/primary-spell-retained-hail-presentation.ts')
    const { createPrimarySpellSimulationFrame } = await import('/src/game/protocol/primary-spell-hail-replication.ts')
    const player = snapshot.players[playerId]
    const hail = Array.from({ length: 16 }, (_, index) => ({
      ageTicks: 20, birthTick: snapshot.tick - 20, bounceProgress: Math.fround(.4),
      bounceSoundIndex: null, bounceSoundPitch: null, bounceSoundSequence: 0,
      height: -24, horizontalVelocity: { x: 2, y: -1 }, id: 900000 + index,
      kind: 'water-hail', life: Math.fround(1.7), ownerId: playerId,
      painterRegistrations: [{ managerLane: 'actor', registrationOrdinal: 900000 + index }],
      position: { x: Math.fround(player.position.x + 50 + index % 4 * 12),
        y: Math.fround(player.position.y + 30 + Math.floor(index / 4) * 12) },
      rotationDegrees: index * 15, rotationStepDegrees: 2, savedBounceVelocity: -3,
      scale: Math.fround(.15), verticalVelocity: 1, worldKey: `boneyard:${boneyard.runId}`,
    }))
    const presentation = createRetainedBoneyardPrimarySpellPresentation()
    const frame = transients => createPrimarySpellSimulationFrame({ nextId: 900017, projectiles: [], transients })
    snapshot.primarySpells = presentation.copyFrame(frame(hail), snapshot.tick)
    const viewport = { width: 1600, height: 900, displayScale: 1 }
    const renderer = await createBoneyardWorldRenderer({
      boneyard, playerId, initialSnapshot: snapshot, viewport, devicePixelRatio: 1,
      modAssets: [], modCatalog: [], now: () => 100000,
    })
    const read = async () => {
      const gl = renderer.canvas.getContext('webgl2')
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4)
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      const diagnostics = renderer.canvas.__sdrBoneyardFrame
      const digest = await crypto.subtle.digest('SHA-256', pixels)
      return { frame: diagnostics.frameCount, tick: diagnostics.tick, hail: diagnostics.primaryHailMeshCount,
        rgbaSha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') }
    }
    try {
      renderer.render(snapshot)
      const before = await read()
      presentation.copyFrame(frame(hail.map(effect => ({ ...effect,
        position: { x: Math.fround(effect.position.x + 200), y: Math.fround(effect.position.y + 100) }, height: -4,
      }))), snapshot.tick + 5)
      renderer.resize({ ...viewport, width: 1760, height: 990 }, 1)
      renderer.resize(viewport, 1)
      const afterResample = await read()
      presentation.copyFrame(frame([]), snapshot.tick + 10)
      renderer.resize({ ...viewport, width: 1760, height: 990 }, 1)
      renderer.resize(viewport, 1)
      return { before, afterResample, afterRetirement: await read() }
    } finally { renderer.destroy() }
  }, { boneyard, playerId, snapshot: createGameSnapshot(host.state(), playerId) })
  assert.equal(receipt.before.hail, 16)
  assert.deepEqual(receipt.afterResample, receipt.before, 'later Hail sampling changed the frozen renderer frame')
  assert.deepEqual(receipt.afterRetirement, receipt.before, 'Hail retirement changed the frozen renderer frame')
  return receipt
}

async function exercisePublicSiteAudio(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  const cursorEffects = page.getByRole('button', { name: /cursor effects/i })
  await cursorEffects.waitFor()
  await cursorEffects.tap()
  await page.waitForFunction(() => window.__sdrAudioMediaChannels?.().some((channel) => (
    ['prelude.mp3', 'solomondarktheme.mp3', 'academy.mp3', 'academyold.mp3']
      .some((source) => window.__sdrAudioSourceMatches(channel.src, source))
      && !channel.paused
      && Math.abs(channel.outputVolume - 0.09) < 0.001
      && channel.volume === 1
  )), undefined, { timeout: 5_000 })
  await page.getByRole('button', { name: 'Mute music' }).tap()
  await page.waitForFunction(() => window.__sdrAudioMediaChannels?.().some((channel) => (
    ['prelude.mp3', 'solomondarktheme.mp3', 'academy.mp3', 'academyold.mp3']
      .some((source) => window.__sdrAudioSourceMatches(channel.src, source))
      && channel.paused
      && channel.outputVolume === 0
      && channel.volume === 1
  )), undefined, { timeout: 5_000 })
  await page.getByRole('button', { name: 'Unmute music' }).tap()
  await page.waitForFunction(() => window.__sdrAudioMediaChannels?.().some((channel) => (
    ['prelude.mp3', 'solomondarktheme.mp3', 'academy.mp3', 'academyold.mp3']
      .some((source) => window.__sdrAudioSourceMatches(channel.src, source))
      && !channel.paused
      && Math.abs(channel.outputVolume - 0.09) < 0.001
      && channel.volume === 1
  )), undefined, { timeout: 5_000 })
  return page.evaluate(() => ({
    effect: window.__sdrAudioEvents.findLast((event) => (
      event.type === 'play'
        && window.__sdrAudioSourceMatches(event.src, 'backpack-close.mp3')
    )),
    music: window.__sdrAudioMediaChannels().findLast((channel) => (
      ['prelude.mp3', 'solomondarktheme.mp3', 'academy.mp3', 'academyold.mp3']
        .some((source) => window.__sdrAudioSourceMatches(channel.src, source))
        && !channel.paused
        && channel.outputVolume > 0
    )),
  }))
}

function emulateIosMediaVolume() {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume')
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => 1,
    set: () => {},
  })
}

async function enterCreateAfterCollegeAdmission(page, host) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    page.locator('.hub-scene[data-renderer-state="ready"]')
      .waitFor({ timeout: 90_000 })
      .then(() => 'hub'),
  ])
  if (first === 'create') return
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  const participant = state.world.participants[playerId]
  if (participant?.collegeIntro) {
    state.world = {
      ...state.world,
      participants: {
        ...state.world.participants,
        [playerId]: {
          collegeIntro: {
            ...participant.collegeIntro,
            contactCounter: 0,
            coverAlpha: 0,
            dialogueSequence: participant.collegeIntro.dialogueSequence + 1,
            officeSpeed: 0.5,
            pathCursor: 6,
            phase: 'arch-dialogue',
            titleCursor: 5,
          },
          region: 'office',
          transition: null,
        },
      },
    }
    state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
      ...getPlayerCharacter(state, playerId),
      position: { x: 522.5, y: 530 },
      velocity: { x: 0, y: 0 },
    })
    const arch = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
    await arch.waitFor({ timeout: 15_000 })
    await arch.getByRole('button', { name: 'Skip' }).click()
    await arch.getByRole('button', { name: 'Solomon Dark?' }).click()
    await arch.getByRole('button', { name: 'Skip' }).click()
    await arch.getByRole('button', { name: 'Done' }).click()
    await arch.getByRole('button', { name: 'Skip' }).click()
    await arch.waitFor({ state: 'hidden', timeout: 15_000 })
  }
  const office = host.state()
  office.playerEntities = replacePlayerCharacter(office.playerEntities, playerId, {
    ...getPlayerCharacter(office, playerId),
    position: { x: 512, y: 900 },
    velocity: { x: 0, y: 0 },
  })
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
}

async function assertNativeSettingsPresentation(dialog, { desktop }) {
  const receipt = await dialog.evaluate((node) => {
    const bounds = node.getBoundingClientRect()
    const rect = selector => {
      const value = node.querySelector(selector).getBoundingClientRect()
      return { height: value.height, width: value.width, x: value.x, y: value.y }
    }
    const records = [...node.querySelectorAll('.native-settings-panel-art [data-native-ui-record]')]
      .map((record) => record.getAttribute('data-native-ui-record'))
    return {
      actionArrows: node.querySelectorAll('[data-native-ui-record="ControlPanel.0"]').length,
      bounds: { height: bounds.height, width: bounds.width, x: bounds.x, y: bounds.y },
      footerBounds: rect('.game-settings-close'),
      frameRecords: records,
      leftFlourishBounds: rect('.native-settings-panel-art .game-settings-frame-flourish.left'),
      nativeFonts: [...node.querySelectorAll('[data-native-ui-font]')].map((font) => (
        font.getAttribute('data-native-ui-font')
      )),
      rowPlates: node.querySelectorAll('[data-native-ui-plan] [data-native-ui-record="ControlPanel.3"]').length,
      sliderTracks: node.querySelectorAll('[data-native-ui-strip="ControlPanel.4"]').length,
      stoneButtons: [...node.querySelectorAll(
        '.game-settings-close [data-native-ui-record="UI.105"], .game-settings-close [data-native-ui-record="UI.106"]',
      )].map(button => button.getAttribute('data-native-ui-record')),
      topLeftFrameBounds: rect('.native-settings-panel-art .game-settings-frame-corner.top-left'),
      toggles: [...node.querySelectorAll(
        '[data-native-ui-record="ControlPanel.8"], [data-native-ui-record="ControlPanel.9"]',
      )].map((toggle) => toggle.getAttribute('data-native-ui-record')),
    }
  })
  assert.deepEqual(receipt.frameRecords, [
    'UI.17', 'UI.17', 'UI.17', 'UI.17', 'UI.18', 'UI.18',
  ])
  assert.ok(receipt.nativeFonts.length > 0)
  assert.ok(receipt.nativeFonts.every((font) => font === 'control-panel'))
  assert.ok(receipt.rowPlates > 0)
  assert.ok(receipt.sliderTracks >= 4)
  assert.ok(receipt.toggles.length > 0)
  assert.ok(receipt.actionArrows > 0)
  assert.deepEqual(receipt.stoneButtons, ['UI.105'])
  if (desktop) {
    assert.deepEqual(receipt.bounds, { height: 700, width: 600, x: 500, y: 100 })
    assert.deepEqual(receipt.footerBounds, { height: 41, width: 300, x: 650, y: 739.5 })
    assert.deepEqual(receipt.topLeftFrameBounds, { height: 83, width: 80, x: 490, y: 90 })
    assert.deepEqual(receipt.leftFlourishBounds, { height: 262, width: 86, x: 402, y: 319 })
  } else {
    assert.ok(receipt.bounds.width <= 600)
    assert.ok(receipt.bounds.height <= 700)
  }
  return receipt
}

async function storedSettings(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), GAME_SETTINGS_STORAGE_KEY)
}

async function captureReducedScreenFlash(page, host, selector) {
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  const player = getPlayerCharacter(state, playerId)
  const worldKey = state.world.kind === 'hub'
    ? `hub:${state.world.participants[playerId]?.region ?? 'courtyard'}`
    : `boneyard:${state.world.runId}`
  state.secondaryAbilities = emitNativePlayerScreenFlash(state.secondaryAbilities, {
    ownerId: playerId,
    position: player.position,
    screenFlash: {
      alpha: 1,
      blue: 1,
      decayPerTick: Math.fround(0.01),
      green: 1,
      pointAttenuated: false,
      red: 1,
    },
    tick: state.tick,
    worldKey,
  })
  const observed = await page.waitForFunction((selector) => {
    const node = document.querySelector(selector)
    const frame = node?.__sdrHubFrame ?? node?.__sdrBoneyardFrame
    if ((frame?.secondaryScreenFlashAlpha ?? 0) <= 0) return null
    // Capture the observed frame atomically; the native flash can expire before another RPC.
    return {
      alpha: frame.secondaryScreenFlashAlpha,
      color: frame.secondaryScreenFlashColor,
      mode: node.dataset.reducedScreenFlashes,
    }
  }, selector)
  const receipt = await observed.jsonValue()
  await observed.dispose()
  assert.equal(receipt.mode, 'true')
  assert.equal(receipt.color, 0xffffff)
  assert.ok(receipt.alpha > 0 && receipt.alpha <= 0.2, JSON.stringify(receipt))
  return receipt
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

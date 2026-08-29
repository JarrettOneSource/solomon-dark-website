import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const mobile = process.env.SDR_GAME_SETTINGS_MOBILE === '1'
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
const rangeTouches = {}

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
  assert.equal(await dialog.getAttribute('data-settings-context'), 'title')
  assert.equal(await dialog.getAttribute('data-settings-page'), 'root')
  assert.equal(await dialog.getByText('RESOLUTION', { exact: true }).count(), 0)
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
  await dialog.getByRole('button', { name: 'BACK' }).click()
  await dialog.locator('[data-game-default-focus="true"]').waitFor()
  await nextPaint(page)
  await page.screenshot({ path: screenshots.title })
  await dialog.getByRole('button', { name: 'DONE' }).click()
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
  const lowQualityRegionTarget = await boneyardCanvas.evaluate((canvas) => ({
    logicalSide: canvas.__sdrBoneyardFrame.regionLightLogicalSide,
    physicalSide: canvas.__sdrBoneyardFrame.regionLightPhysicalSide,
  }))
  assert.equal(lowQualityRegionTarget.physicalSide, 128)
  await page.screenshot({ path: screenshots.boneyard })
  await dialog.getByRole('button', { name: 'BACK' }).click()
  await dialog.getByRole('button', { name: 'DONE' }).click()
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
      multipleShadows: await boneyardCanvas.getAttribute('data-multiple-shadows'),
      zoomEffects: await boneyardCanvas.getAttribute('data-zoom-effects'),
    },
    darkCloudPaint,
    errors,
    failedResponses,
    hub: hubReceipt,
    mobileAudio,
    rangeTouches,
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
    const label = await locator.locator('xpath=preceding-sibling::span').innerText()
    await locator.tap({
      position: {
        x: touchValue === minimum ? 1 : box.width - 1,
        y: box.height / 2,
      },
    })
    await page.waitForTimeout(100)
    assert.equal(Number(await locator.inputValue()), touchValue)
    assert.equal(
      await locator.locator('xpath=following-sibling::output').innerText(),
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

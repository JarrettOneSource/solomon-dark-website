import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4192'
const endpointUrl = process.env.SDR_GAME_SMOKE_ENDPOINT?.trim()
const endpointCredential = process.env.SDR_GAME_SMOKE_CREDENTIAL?.trim()
if (!endpointUrl || !endpointCredential) {
  throw new Error('SDR_GAME_SMOKE_ENDPOINT and SDR_GAME_SMOKE_CREDENTIAL are required')
}

const publicEndpointUrl = 'wss://smoke.invalid/game-hub'
const screenshotRoot = process.env.SDR_HUB_COMBAT_SCREENSHOT_ROOT || '/tmp'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const pageErrors = []
const consoleErrors = []
const failedResponses = []
const admissionRequests = []
let page

try {
  page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript(installProbe, { endpointUrl, publicEndpointUrl })
  await page.route('**/api/game/hub', async (route) => {
    const state = await page.evaluate(() => ({
      disciplineCommittedAt: window.__sdrHubCombatDisciplineCommittedAt,
      loadingAttached: Boolean(document.querySelector(
        '.match-loading-screen[data-flow="hub"]',
      )),
      loadingStage: document.querySelector(
        '.match-loading-screen[data-flow="hub"]',
      )?.getAttribute('data-stage') ?? null,
      now: performance.now(),
    }))
    admissionRequests.push(state)
    await route.fulfill({
      body: JSON.stringify({
        credential: endpointCredential,
        kind: 'remote',
        url: publicEndpointUrl,
      }),
      contentType: 'application/json',
      status: 201,
    })
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  assert.equal(admissionRequests.length, 0)

  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  assert.equal(admissionRequests.length, 0)
  const admissionResponse = page.waitForResponse(response => (
    new URL(response.url()).pathname === '/api/game/hub'
  ), { timeout: 10_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.match-loading-screen[data-flow="hub"]')
    .waitFor({ state: 'attached', timeout: 5_000 })
  await admissionResponse
  assert.equal(admissionRequests.length, 1)
  assert.equal(admissionRequests[0].loadingAttached, true)
  assert.equal(admissionRequests[0].loadingStage, 'connecting_transport')
  assert.equal(typeof admissionRequests[0].disciplineCommittedAt, 'number')
  assert.ok(admissionRequests[0].now >= admissionRequests[0].disciplineCommittedAt)

  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  await hubScene.waitFor({ timeout: 60_000 })
  await page.locator('.match-loading-screen[data-flow="hub"]')
    .waitFor({ state: 'detached', timeout: 30_000 })
  const hubCanvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  const hubBefore = await frameReceipt(hubCanvas, 'hub')
  const hubManaBefore = await localMana(page)
  const disabledSecondarySlots = await page.locator(
    '.hub-hud-skill-quickbar[data-mode="hub"] .hub-hud-quickbar-slot:disabled',
  ).count()
  assert.ok(disabledSecondarySlots >= 1)
  assert.equal(await page.locator('.touch-joystick[data-lane="primary"]').count(), 0)

  const hubBounds = await hubCanvas.boundingBox()
  assert.ok(hubBounds)
  const hubTarget = {
    x: hubBounds.x + hubBounds.width * 0.7,
    y: hubBounds.y + hubBounds.height * 0.4,
  }
  const hubSampleStart = await page.evaluate(() => window.__sdrHubCombatSamples.length)
  await page.mouse.move(hubTarget.x, hubTarget.y)
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(350)
  await page.mouse.up({ button: 'left' })
  await page.mouse.down({ button: 'right' })
  await page.waitForTimeout(350)
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(250)

  const hubSamples = await page.evaluate(start => (
    window.__sdrHubCombatSamples.slice(start).filter(sample => sample.scene === 'hub')
  ), hubSampleStart)
  assert.ok(hubSamples.length > 0)
  assert.ok(hubSamples.every(sample => sample.primarySpellCount === 0))
  assert.ok(hubSamples.every(sample => sample.secondaryAbilityCount === 0))
  assert.ok(hubSamples.every(sample => sample.playerAttachmentPose === 0))
  assert.ok(hubSamples.every(sample => sample.playerWeaponScale === 1))
  assert.equal(await localMana(page), hubManaBefore)
  const hubAfter = await frameReceipt(hubCanvas, 'hub')
  await page.screenshot({ path: `${screenshotRoot}/solomon-hub-noncombat-final.png` })

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyardScene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyardScene.waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen[data-flow="boneyard"]')
    .waitFor({ state: 'detached', timeout: 30_000 })
  const boneyardCanvas = page.locator(
    '.boneyard-world-canvas[data-game-renderer="pixi-webgl"]',
  )
  const boneyardBounds = await boneyardCanvas.boundingBox()
  assert.ok(boneyardBounds)
  const boneyardSampleStart = await page.evaluate(() => window.__sdrHubCombatSamples.length)
  await page.mouse.move(
    boneyardBounds.x + boneyardBounds.width * 0.7,
    boneyardBounds.y + boneyardBounds.height * 0.4,
  )
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(300)
  await page.mouse.up({ button: 'left' })
  const castSampleHandle = await page.waitForFunction(start => (
    window.__sdrHubCombatSamples.slice(start).find(sample => (
      sample.scene === 'boneyard'
      && sample.playerAttachmentPose === 8
      && sample.playerElementEffectScale > 1
    )) ?? null
  ), boneyardSampleStart, { timeout: 10_000 })
  const boneyardCast = await castSampleHandle.jsonValue()
  await castSampleHandle.dispose()
  assert.equal(boneyardCast.playerWeaponScale, 1)
  assert.ok(boneyardCast.playerElementEffectScale > 1)
  assert.ok(boneyardCast.primarySpellCount > 0)
  await page.screenshot({ path: `${screenshotRoot}/solomon-boneyard-staff-scale-final.png` })

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    admissionRequests,
    boneyardCast,
    browserVersion: browser.version(),
    consoleErrors,
    disabledSecondarySlots,
    failedResponses,
    hubAfter,
    hubBefore,
    hubManaBefore,
    hubSampleCount: hubSamples.length,
    pageErrors,
    status: 'ok',
  }, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    admissionRequests,
    body: page ? (await page.locator('body').innerText()).slice(0, 2_000) : null,
    consoleErrors,
    failedResponses,
    pageErrors,
    samples: page
      ? await page.evaluate(() => window.__sdrHubCombatSamples?.slice(-20) ?? [])
      : [],
  }, null, 2)}\n`)
  throw error
} finally {
  await browser.close()
}

async function frameReceipt(canvas, scene) {
  return canvas.evaluate((node, sceneName) => {
    const frame = sceneName === 'hub' ? node.__sdrHubFrame : node.__sdrBoneyardFrame
    return structuredClone({
      playerAttachmentPose: frame.playerAttachmentPose,
      playerElementEffectScale: frame.playerElementEffectScale,
      playerWeaponScale: frame.playerWeaponScale,
      primarySpellCount: frame.primarySpellCount,
      secondaryAbilityCount: frame.secondaryAbilityCount ?? 0,
      tick: frame.tick,
    })
  }, scene)
}

async function localMana(currentPage) {
  return currentPage.evaluate(() => {
    const frame = window.__sdrHubCombatLatestFrame
    if (!frame) return null
    const canvas = document.querySelector('.hub-world-canvas')
    const playerId = canvas?.__sdrHubFrame?.localPlayerId
      ?? document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        ?.cameraSubjectPlayerId
    return playerId ? frame.players[playerId]?.progression.currentMana ?? null : null
  })
}

function installProbe({ endpointUrl: mappedEndpoint, publicEndpointUrl: publicEndpoint }) {
  const NativeWebSocket = window.WebSocket
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(Target, args) {
      if (`${args[0]}` === publicEndpoint) args[0] = mappedEndpoint
      return Reflect.construct(Target, args, Target)
    },
  })
  const samples = []
  let latestFrame = null
  let disciplineCommittedAt = null
  Object.defineProperties(window, {
    __sdrHubCombatDisciplineCommittedAt: { get: () => disciplineCommittedAt },
    __sdrHubCombatLatestFrame: { get: () => latestFrame },
    __sdrHubCombatSamples: { value: samples },
  })
  const nativeParse = JSON.parse
  JSON.parse = function (...args) {
    const value = nativeParse.apply(this, args)
    const frame = value?.type === 'server-welcome'
      ? value.snapshot
      : value?.type === 'server-snapshot'
        ? value.frame
        : null
    if (frame?.players) latestFrame = frame
    return value
  }
  window.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('.create-menu-discipline')) {
      disciplineCommittedAt = performance.now()
    }
  }, { capture: true })
  let previous = ''
  const observe = () => {
    const hub = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    const boneyard = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    const frame = boneyard ?? hub
    const scene = boneyard ? 'boneyard' : hub ? 'hub' : null
    if (frame && scene) {
      const sample = {
        playerAttachmentPose: frame.playerAttachmentPose,
        playerElementEffectScale: frame.playerElementEffectScale,
        playerWeaponScale: frame.playerWeaponScale,
        primarySpellCount: frame.primarySpellCount,
        scene,
        secondaryAbilityCount: frame.secondaryAbilityCount ?? 0,
        tick: frame.tick,
      }
      const key = JSON.stringify(sample)
      if (key !== previous) {
        samples.push(sample)
        previous = key
      }
    }
    requestAnimationFrame(observe)
  }
  requestAnimationFrame(observe)
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

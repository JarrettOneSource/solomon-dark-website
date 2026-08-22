import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const baseUrl = process.env.SDR_GAME_WEATHER_URL || 'http://127.0.0.1:4182'
const endpoint = process.env.SDR_GAME_WEATHER_ENDPOINT?.trim()
const credential = process.env.SDR_GAME_WEATHER_CREDENTIAL?.trim()
const screenshot = process.env.SDR_GAME_WEATHER_SCREENSHOT || '/tmp/solomon-dark-world-weather.png'
if (!endpoint || !credential) {
  throw new Error('SDR_GAME_WEATHER_ENDPOINT and SDR_GAME_WEATHER_CREDENTIAL are required')
}

const pageErrors = []
const consoleErrors = []
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(() => {
    localStorage.setItem('solomon-dark-game-settings-v1', '{"enableCheats":true}')
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: new URL(endpoint).protocol === 'wss:' ? 'remote' : 'localhost',
      url: endpoint,
    },
  })

  await page.goto(`${baseUrl}/game`, {
    timeout: 180_000,
    waitUntil: 'domcontentloaded',
  })
  try {
    await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 300_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      consoleErrors,
      pageErrors,
      url: page.url(),
    })}\n`)
    throw error
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  const continueLocal = page.getByRole('button', { name: /continue local/i })
  if (await continueLocal.isVisible().catch(() => false)) await continueLocal.click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill('WeatherProbe')
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  await selectStormyBoneyard(page)
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyard = page.locator('.boneyard-scene')
  await boneyard.waitFor({ timeout: 30_000 })
  await boneyard.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]').waitFor({ timeout: 30_000 })
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  const mode = Number(await boneyard.getAttribute('data-environment-mode'))
  assert.ok(mode === 1 || mode === 2, `expected a rainy or stormy stock Boneyard, got mode ${mode}`)
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    return Number(canvas?.dataset.weatherDropCount) > 0
      && Number(canvas?.dataset.weatherSplashCount) > 0
      && document.querySelector('.boneyard-scene')?.getAttribute('data-weather-audio-gain') !== null
  }, undefined, { timeout: 30_000 })
  const receipt = await page.evaluate(() => {
    const scene = document.querySelector('.boneyard-scene')
    const canvas = document.querySelector('.boneyard-world-canvas')
    const frame = canvas?.__sdrBoneyardFrame
    return {
      audioCue: scene?.getAttribute('data-weather-audio-cue'),
      audioGain: Number(scene?.getAttribute('data-weather-audio-gain')),
      audioOwner: scene?.getAttribute('data-weather-audio-owner'),
      canvasMode: Number(canvas?.dataset.weatherMode),
      complexLighting: canvas?.dataset.complexLighting,
      dropCount: Number(canvas?.dataset.weatherDropCount),
      lightCompositeZIndex: Number(canvas?.dataset.regionLightCompositeZIndex),
      maxMainLightScalar: frame?.maxMainLightScalar,
      minMainLightScalar: frame?.minMainLightScalar,
      splashAsset: canvas?.dataset.weatherSplashAsset,
      splashBlend: canvas?.dataset.weatherSplashBlend,
      splashCount: Number(canvas?.dataset.weatherSplashCount),
      splashZIndex: Number(canvas?.dataset.weatherSplashZIndex),
      streakRenderer: canvas?.dataset.weatherStreakRenderer,
      streakZIndex: Number(canvas?.dataset.weatherStreakZIndex),
      rainfallSources: window.__sdrAudioPlaySources.filter((source) => source.includes('rainfall-loop')),
    }
  })
  assert.equal(receipt.canvasMode, mode)
  assert.equal(receipt.splashAsset, 'DeadHawg:24')
  assert.equal(receipt.splashBlend, 'add')
  assert.equal(receipt.streakRenderer, 'pixi-particle-batch')
  assert.equal(receipt.audioCue, 'rainfall-loop')
  assert.equal(receipt.audioOwner, 'boneyard-weather:rainfall')
  assert.equal(receipt.complexLighting, 'true')
  assert.ok(receipt.audioGain > 0)
  assert.ok(receipt.dropCount > 0)
  assert.ok(receipt.splashCount > 0)
  assert.ok(receipt.splashZIndex < receipt.lightCompositeZIndex)
  assert.ok(receipt.lightCompositeZIndex < receipt.streakZIndex)
  assert.ok(receipt.rainfallSources.length > 0)
  await page.screenshot({ path: screenshot })
  const flattenedOrder = await disableComplexLighting(page, boneyard)
  assert.ok(flattenedOrder.splashZIndex < flattenedOrder.streakZIndex)
  assert.ok(flattenedOrder.streakZIndex < flattenedOrder.lightCompositeZIndex)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    flattenedOrder,
    mode,
    pageErrors,
    consoleErrors,
    receipt,
  })}\n`)
} finally {
  await browser.close()
}

async function selectStormyBoneyard(page) {
  await page.waitForFunction(() => Boolean(window.solomonDark?.lua), undefined, {
    timeout: 10_000,
  })
  const result = await page.evaluate(() => (
    window.solomonDark.lua.execute('return sd.rng.set_seed(2)')
  ))
  assert.equal(result.ok, true, result.error)
  assert.deepEqual(result.values, [2])
}

async function disableComplexLighting(page, boneyard) {
  await boneyard.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor()
  await pause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  const dialog = page.locator('.game-settings-dialog')
  await dialog.waitFor()
  await dialog.getByRole('button', { name: 'TWEAK GAME' }).click()
  const toggle = dialog.getByRole('button', { name: 'COMPLEX LIGHTING' })
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true')
  await toggle.click()
  await dialog.getByRole('button', { name: 'BACK' }).click()
  await dialog.getByRole('button', { name: 'DONE' }).click()
  await dialog.waitFor({ state: 'detached' })
  try {
    await pause.waitFor({ state: 'detached', timeout: 3_000 })
  } catch {
    await page.keyboard.press('Escape')
    await pause.waitFor({ state: 'detached' })
  }
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.dataset.complexLighting === 'false'
      && Number(document.querySelector('.boneyard-world-canvas')?.dataset.weatherStreakZIndex)
        < Number(document.querySelector('.boneyard-world-canvas')?.dataset.regionLightCompositeZIndex)
  ))
  return page.locator('.boneyard-world-canvas').evaluate((canvas) => ({
    lightCompositeZIndex: Number(canvas.dataset.regionLightCompositeZIndex),
    splashZIndex: Number(canvas.dataset.weatherSplashZIndex),
    streakZIndex: Number(canvas.dataset.weatherStreakZIndex),
  }))
}

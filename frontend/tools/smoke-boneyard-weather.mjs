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
const failedResponses = []
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ location: message.location(), text: message.text() })
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
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
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
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
  const pixelProbe = await weatherSplashPixelProbe(page)
  assert.ok(pixelProbe)
  assert.deepEqual(pixelProbe.blendModes, ['add'])
  assert.equal(pixelProbe.scaleMode, 'linear')
  assert.ok(pixelProbe.contribution.brightenedPixelCount > 0)
  assert.equal(pixelProbe.contribution.darkenedPixelCount, 0)
  assert.equal(pixelProbe.contribution.negativeChannelCount, 0)
  await page.screenshot({ path: screenshot })
  const flattenedOrder = await disableComplexLighting(page, boneyard)
  assert.ok(flattenedOrder.splashZIndex < flattenedOrder.streakZIndex)
  assert.ok(flattenedOrder.streakZIndex < flattenedOrder.lightCompositeZIndex)
  const flattenedPixelProbe = await weatherSplashPixelProbe(page)
  assert.ok(flattenedPixelProbe)
  assert.deepEqual(flattenedPixelProbe.blendModes, ['add'])
  assert.equal(flattenedPixelProbe.scaleMode, 'linear')
  assert.ok(flattenedPixelProbe.contribution.brightenedPixelCount > 0)
  assert.equal(flattenedPixelProbe.contribution.darkenedPixelCount, 0)
  assert.equal(flattenedPixelProbe.contribution.negativeChannelCount, 0)
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  process.stdout.write(`${JSON.stringify({
    failedResponses,
    flattenedOrder,
    flattenedPixelProbe,
    mode,
    pageErrors,
    consoleErrors,
    pixelProbe,
    receipt,
  })}\n`)
} finally {
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ])
}
process.exit(0)

async function weatherSplashPixelProbe(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.boneyard-world-canvas')
    const probe = canvas?.__sdrWeatherSplashPixelProbe
    if (!canvas || !probe) return null
    const scratch = canvas.ownerDocument.createElement('canvas')
    scratch.height = canvas.height
    scratch.width = canvas.width
    const context = scratch.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Weather pixel probe could not create a 2D context.')
    const capture = (renderable) => {
      probe.render(renderable)
      context.clearRect(0, 0, scratch.width, scratch.height)
      context.drawImage(canvas, 0, 0)
      return context.getImageData(0, 0, scratch.width, scratch.height).data.slice()
    }
    const compare = (candidate, baseline) => {
      let baselineLumaTotal = 0
      let brightenedPixelCount = 0
      let candidateLumaMaximum = 0
      let candidateLumaMinimum = 255
      let candidateLumaTotal = 0
      let changedPixelCount = 0
      let darkChangedPixelCount = 0
      let darkenedPixelCount = 0
      let maximumLumaDelta = 0
      let minimumLumaDelta = 0
      let negativeChannelCount = 0
      for (let offset = 0; offset < candidate.length; offset += 4) {
        const redDelta = candidate[offset] - baseline[offset]
        const greenDelta = candidate[offset + 1] - baseline[offset + 1]
        const blueDelta = candidate[offset + 2] - baseline[offset + 2]
        if (redDelta === 0 && greenDelta === 0 && blueDelta === 0) continue
        changedPixelCount += 1
        if (redDelta < 0) negativeChannelCount += 1
        if (greenDelta < 0) negativeChannelCount += 1
        if (blueDelta < 0) negativeChannelCount += 1
        const baselineLuma = Math.round(
          (54 * baseline[offset] + 183 * baseline[offset + 1]
            + 19 * baseline[offset + 2]) / 256,
        )
        const candidateLuma = Math.round(
          (54 * candidate[offset] + 183 * candidate[offset + 1]
            + 19 * candidate[offset + 2]) / 256,
        )
        const lumaDelta = 54 * redDelta + 183 * greenDelta + 19 * blueDelta
        baselineLumaTotal += baselineLuma
        candidateLumaMaximum = Math.max(candidateLumaMaximum, candidateLuma)
        candidateLumaMinimum = Math.min(candidateLumaMinimum, candidateLuma)
        candidateLumaTotal += candidateLuma
        if (candidateLuma <= 16) darkChangedPixelCount += 1
        if (lumaDelta > 0) brightenedPixelCount += 1
        if (lumaDelta < 0) darkenedPixelCount += 1
        maximumLumaDelta = Math.max(maximumLumaDelta, lumaDelta)
        minimumLumaDelta = Math.min(minimumLumaDelta, lumaDelta)
      }
      return {
        averageBaselineLuma: baselineLumaTotal / changedPixelCount,
        averageCandidateLuma: candidateLumaTotal / changedPixelCount,
        brightenedPixelCount,
        candidateLumaMaximum,
        candidateLumaMinimum,
        changedPixelCount,
        darkChangedPixelCount,
        darkenedPixelCount,
        maximumLumaDelta,
        minimumLumaDelta,
        negativeChannelCount,
      }
    }
    const originalRenderable = probe.renderable()
    try {
      const baseline = capture(false)
      const candidate = capture(originalRenderable)
      return {
        blendModes: probe.blendModes(),
        canvasHeight: canvas.height,
        canvasWidth: canvas.width,
        contribution: compare(candidate, baseline),
        scaleMode: probe.scaleMode(),
        splashViewCount: probe.splashViewCount(),
      }
    } finally {
      probe.render(originalRenderable)
    }
  })
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

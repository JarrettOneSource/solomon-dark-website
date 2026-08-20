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
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill('WeatherProbe')
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
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
    return {
      audioCue: scene?.getAttribute('data-weather-audio-cue'),
      audioGain: Number(scene?.getAttribute('data-weather-audio-gain')),
      audioOwner: scene?.getAttribute('data-weather-audio-owner'),
      canvasMode: Number(canvas?.dataset.weatherMode),
      dropCount: Number(canvas?.dataset.weatherDropCount),
      splashAsset: canvas?.dataset.weatherSplashAsset,
      splashCount: Number(canvas?.dataset.weatherSplashCount),
      rainfallSources: window.__sdrAudioPlaySources.filter((source) => source.includes('rainfall-loop')),
    }
  })
  assert.equal(receipt.canvasMode, mode)
  assert.equal(receipt.splashAsset, 'DeadHawg:24')
  assert.equal(receipt.audioCue, 'rainfall-loop')
  assert.equal(receipt.audioOwner, 'boneyard-weather:rainfall')
  assert.ok(receipt.audioGain > 0)
  assert.ok(receipt.dropCount > 0)
  assert.ok(receipt.splashCount > 0)
  assert.ok(receipt.rainfallSources.length > 0)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  await page.screenshot({ path: screenshot })
  process.stdout.write(`${JSON.stringify({ mode, pageErrors, consoleErrors, receipt })}\n`)
} finally {
  await browser.close()
}

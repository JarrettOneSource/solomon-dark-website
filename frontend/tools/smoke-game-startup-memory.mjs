import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_STARTUP_SMOKE_URL || 'http://127.0.0.1:5173'
const screenshotPath = process.env.SDR_GAME_STARTUP_SCREENSHOT?.trim()
const maximumDecodedImageBytes = 128 * 1024 * 1024

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  screen: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
})

await page.addInitScript(() => {
  const probe = window.__sdrStartupAssetProbe = {
    audioActive: 0,
    audioBuffers: [],
    audioPeakActive: 0,
    imageActive: 0,
    imagePeakActive: 0,
    images: [],
  }
  const sourceDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'src',
  )
  if (!sourceDescriptor?.get || !sourceDescriptor.set) {
    throw new Error('HTML image source descriptor is unavailable.')
  }
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: sourceDescriptor.configurable,
    enumerable: sourceDescriptor.enumerable,
    get() {
      return sourceDescriptor.get.call(this)
    },
    set(value) {
      if (!this.__sdrStartupTracked) {
        this.__sdrStartupTracked = true
        probe.imageActive += 1
        probe.imagePeakActive = Math.max(probe.imagePeakActive, probe.imageActive)
        const finish = (status) => {
          probe.imageActive -= 1
          probe.images.push({
            height: this.naturalHeight,
            rgbaBytes: this.naturalWidth * this.naturalHeight * 4,
            source: String(value),
            status,
            width: this.naturalWidth,
          })
        }
        this.addEventListener('load', () => finish('load'), { once: true })
        this.addEventListener('error', () => finish('error'), { once: true })
      }
      sourceDescriptor.set.call(this, value)
    },
  })

  const originalDecodeAudioData = AudioContext.prototype.decodeAudioData
  AudioContext.prototype.decodeAudioData = async function (...arguments_) {
    probe.audioActive += 1
    probe.audioPeakActive = Math.max(probe.audioPeakActive, probe.audioActive)
    try {
      const decoded = await originalDecodeAudioData.apply(this, arguments_)
      probe.audioBuffers.push({
        channels: decoded.numberOfChannels,
        frames: decoded.length,
        pcmBytes: decoded.numberOfChannels * decoded.length * 4,
        sampleRate: decoded.sampleRate,
      })
      return decoded
    } finally {
      probe.audioActive -= 1
    }
  }
})

const pageErrors = []
const consoleErrors = []
const failedResponses = []
const crashes = []
let loadCount = 0
page.on('load', () => { loadCount += 1 })
page.on('crash', () => crashes.push(Date.now()))
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('response', response => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() })
  }
})

try {
  const startedAt = Date.now()
  await page.goto(`${baseUrl}/game`, {
    timeout: 120_000,
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(() => (
    !document.querySelector('.native-loader-page')
    && document.querySelector('.title-menu-canvas') !== null
  ), undefined, { timeout: 120_000 })
  const durationMs = Date.now() - startedAt
  const probe = await page.evaluate(() => structuredClone(window.__sdrStartupAssetProbe))
  const loadedImages = probe.images.filter(({ status }) => status === 'load')
  const decodedImageBytes = loadedImages.reduce(
    (total, { rgbaBytes }) => total + rgbaBytes,
    0,
  )
  const decodedAudioBytes = probe.audioBuffers.reduce(
    (total, { pcmBytes }) => total + pcmBytes,
    0,
  )
  const loadedSources = loadedImages.map(({ source }) => source)

  assert.equal(loadCount, 1)
  assert.deepEqual(crashes, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.equal(probe.images.some(({ status }) => status === 'error'), false)
  assert.ok(
    probe.imagePeakActive <= 4,
    `startup reached ${probe.imagePeakActive} simultaneous image loads`,
  )
  assert.ok(
    probe.audioPeakActive <= 4,
    `startup reached ${probe.audioPeakActive} simultaneous audio decodes`,
  )
  assert.ok(
    decodedImageBytes <= maximumDecodedImageBytes,
    `startup decoded ${(decodedImageBytes / 1048576).toFixed(2)} MiB of images`,
  )
  for (const forbidden of [
    'anim-solomon-encounter',
    'hub-courtyard',
    'match-loading-background',
    'player-character-',
    'skill-picker-',
  ]) {
    assert.equal(
      loadedSources.some(source => source.includes(forbidden)),
      false,
      `startup loaded inactive-scene source ${forbidden}`,
    )
  }
  if (screenshotPath) await page.screenshot({ path: screenshotPath })

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    durationMs,
    loadCount,
    imageCount: loadedImages.length,
    imagePeakActive: probe.imagePeakActive,
    audioBufferCount: probe.audioBuffers.length,
    audioPeakActive: probe.audioPeakActive,
    decodedImageBytes,
    decodedImageMiB: decodedImageBytes / 1048576,
    decodedAudioBytes,
    decodedAudioMiB: decodedAudioBytes / 1048576,
    maximumDecodedImageBytes,
    screenshotPath: screenshotPath ?? null,
    crashes,
    pageErrors,
    consoleErrors,
    failedResponses,
  })}\n`)
} finally {
  await browser.close()
}

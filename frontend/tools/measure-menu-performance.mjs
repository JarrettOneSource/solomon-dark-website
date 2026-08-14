import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_PERF_URL
  || process.env.SDR_GAME_SMOKE_URL
  || 'http://127.0.0.1:4181'
const cdpUrl = process.env.SDR_GAME_CDP_URL?.trim()
const sampleMs = Number(process.env.SDR_GAME_PERF_SAMPLE_MS || 5_000)
const screenshotPrefix = process.env.SDR_GAME_PERF_SCREENSHOT_PREFIX?.trim()
const browserFrameLimitDisabled = process.env.SDR_GAME_PERF_UNCAPPED === '1'
const presentationUncapped = process.env.SDR_GAME_PRESENTATION_UNCAPPED === '1'
const connectedBrowser = Boolean(cdpUrl)
const browser = cdpUrl
  ? await chromium.connectOverCDP(cdpUrl)
  : await chromium.launch({
      executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
      headless: true,
      args: browserFrameLimitDisabled
        ? ['--disable-frame-rate-limit', '--disable-gpu-vsync']
        : [],
    })
const context = connectedBrowser
  ? browser.contexts()[0]
  : await browser.newContext()
assert.ok(context, 'expected a browser context')
const page = await context.newPage()
await page.setViewportSize({ width: 1600, height: 900 })
await page.bringToFront()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  const loaderCanvas = page.locator('canvas.native-loader-canvas')
  const loaderVisible = await loaderCanvas.waitFor({ timeout: 2_000 })
    .then(() => true, () => false)
  const loader = loaderVisible
    ? await loaderCanvas.evaluate((canvas) => ({
        progress: Number(canvas.dataset.progress),
        renderer: canvas.dataset.gameRenderer ?? null,
        rendererName: canvas.dataset.rendererName ?? null,
      }))
    : null
  if (screenshotPrefix && loaderVisible) {
    await page.screenshot({ path: `${screenshotPrefix}-loader.png` })
  }
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const presentation = await configureGamePresentation(page, presentationUncapped)
  await page.waitForTimeout(1_000)
  const title = await measureScene(page, sampleMs, '.main-menu-stage')
  if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-title.png` })

  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  const elementPicker = await measureScene(page, sampleMs, '.create-menu-scene')
  if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-element.png` })

  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator(
    '.create-menu-scene[data-phase="discipline"][data-motion-settled="true"]',
  ).waitFor({ timeout: 30_000 })
  const disciplinePicker = await measureScene(page, sampleMs, '.create-menu-scene')
  if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-discipline.png` })

  if (process.env.SDR_GAME_PERF_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_PERF_SCREENSHOT })
  }

  assert.deepEqual(errors, [])
  if (!presentation.uncapped) {
    assert.ok(title.averageFps <= presentation.frameCap + 0.01, JSON.stringify(title))
    assert.ok(elementPicker.averageFps <= presentation.frameCap + 0.01, JSON.stringify(elementPicker))
    assert.ok(disciplinePicker.averageFps <= presentation.frameCap + 0.01, JSON.stringify(disciplinePicker))
  }
  process.stdout.write(`${JSON.stringify({
    browserFrameLimitDisabled,
    disciplinePicker,
    elementPicker,
    loader,
    presentationFrameCap: presentation.frameCap,
    presentationUncapped: presentation.uncapped,
    sampleSeconds: sampleMs / 1_000,
    status: 'ok',
    title,
  })}\n`)
} catch (error) {
  const diagnostics = await page.evaluate(() => ({
    canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
      className: canvas.className,
      dataset: { ...canvas.dataset },
      height: canvas.height,
      width: canvas.width,
    })),
    createMenu: document.querySelector('.create-menu-scene')?.outerHTML.slice(0, 2_000)
      ?? null,
    rendererError: document.querySelector('.main-menu-renderer-error')?.textContent ?? null,
    titleScreen: document.querySelector('.title-menu-renderer') !== null,
  })).catch(() => null)
  process.stderr.write(`${JSON.stringify({
    diagnostics,
    errors,
    failure: error instanceof Error ? error.message : String(error),
    status: 'error',
  })}\n`)
  throw error
} finally {
  await page.close()
  await browser.close()
}

async function measureScene(page, duration, sceneSelector) {
  const cdp = await page.context().newCDPSession(page)
  await Promise.all([
    cdp.send('Performance.enable'),
    cdp.send('LayerTree.enable'),
  ])
  let compositorLayers = 0
  cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => {
    compositorLayers = Math.max(compositorLayers, layers?.length ?? 0)
  })
  const before = metricMap(await cdp.send('Performance.getMetrics'))
  const samples = await page.evaluate((measurementMs) => new Promise((resolve) => {
    const presentation = window.__sdrGamePresentation
    const timestamps = []
    const unsubscribe = presentation.subscribe((now) => timestamps.push(now))
    setTimeout(() => {
      unsubscribe()
      resolve(timestamps)
    }, measurementMs)
  }), duration)
  const after = metricMap(await cdp.send('Performance.getMetrics'))
  await cdp.detach()

  const intervals = samples.slice(1).map(
    (timestamp, index) => timestamp - samples[index],
  )
  const elapsedMs = samples.at(-1) - samples[0]
  const slowest = [...intervals].sort((a, b) => b - a)
  const lowCount = Math.max(1, Math.ceil(slowest.length * 0.01))
  const slowMean = slowest.slice(0, lowCount)
    .reduce((total, value) => total + value, 0) / lowCount
  const runtime = await page.locator(sceneSelector).evaluate((scene) => {
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') || probe.getContext('webgl')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    const canvases = [...document.querySelectorAll('canvas')].map((canvas) => ({
      className: canvas.className,
      height: canvas.height,
      renderer: canvas.dataset.gameRenderer ?? null,
      rendererName: canvas.dataset.rendererName ?? null,
      width: canvas.width,
    }))
    return {
      animatedElements: document.getAnimations().filter(
        (animation) => animation.playState === 'running',
      ).length,
      canvasCount: canvases.length,
      canvases,
      domNodes: document.querySelectorAll('*').length,
      gpu: extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : 'unavailable',
      sceneChildren: scene.querySelectorAll('*').length,
    }
  })
  return {
    averageFps: round(intervals.length * 1_000 / elapsedMs),
    browserTaskMs: round(
      ((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1_000,
    ),
    compositorLayers,
    onePercentLowFps: round(1_000 / slowMean),
    slowFramesOver10Ms: intervals.filter((interval) => interval > 10).length,
    slowFramesOver20Ms: intervals.filter((interval) => interval > 20).length,
    ...runtime,
  }
}

async function configureGamePresentation(page, uncapped) {
  return page.evaluate((enabled) => {
    const presentation = window.__sdrGamePresentation
    if (!presentation) throw new Error('game presentation controls are unavailable')
    presentation.setUncapped(enabled)
    return {
      frameCap: presentation.frameCap,
      uncapped: presentation.uncapped,
    }
  }, uncapped)
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function round(value) {
  return Math.round(value * 100) / 100
}

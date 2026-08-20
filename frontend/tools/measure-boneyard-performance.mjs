import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_PERF_URL
  || process.env.SDR_GAME_SMOKE_URL
  || 'http://127.0.0.1:4181'
const cdpUrl = process.env.SDR_GAME_CDP_URL?.trim()
const minimumFps = Number(process.env.SDR_GAME_MIN_FPS || 0)
const sampleMs = Number(process.env.SDR_GAME_PERF_SAMPLE_MS || 5_000)
const viewport = parseViewport(process.env.SDR_GAME_PERF_VIEWPORT || '1600x900')
const mobileEmulation = process.env.SDR_GAME_PERF_MOBILE === '1'
const cpuThrottleRate = Number(process.env.SDR_GAME_CPU_THROTTLE || 1)
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
  : await browser.newContext({
      deviceScaleFactor: mobileEmulation ? 3 : 1,
      hasTouch: mobileEmulation,
      isMobile: mobileEmulation,
      viewport,
    })
assert.ok(context, 'expected a browser context')
const page = await context.newPage()
await page.setViewportSize(viewport)
await page.bringToFront()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  if (!Number.isFinite(cpuThrottleRate) || cpuThrottleRate < 1 || cpuThrottleRate > 20) {
    throw new Error('SDR_GAME_CPU_THROTTLE must be between 1 and 20')
  }
  if (cpuThrottleRate > 1) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate })
    await cdp.detach()
  }
  const presentation = await enterBoneyard(page)
  const canvas = page.locator(
    '.boneyard-world-canvas[data-game-renderer="pixi-webgl"]',
  )
  const initialStaticPaintCount = await canvas.evaluate(
    (node) => node.__sdrBoneyardFrame.staticPaintCount,
  )
  const idle = await measure(page, sampleMs)
  const initialY = Number(await page.locator('.boneyard-scene')
    .getAttribute('data-local-player-y'))
  const movementKey = initialY > 1_000 ? 'w' : 's'
  await page.keyboard.down(movementKey)
  const moving = await measure(page, sampleMs)
  await page.keyboard.up(movementKey)
  const runtime = await canvas.evaluate((node, measuredViewport) => {
    const context = node.getContext('webgl2') || node.getContext('webgl')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    const darkness = document.querySelector('.boneyard-darkness')
    const frame = node.__sdrBoneyardFrame
    return {
      darknessAlpha: darkness instanceof HTMLCanvasElement
        ? darknessAlphaReceipt(darkness, node, frame, measuredViewport)
        : null,
      domNodes: document.querySelectorAll('*').length,
      environmentMode: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-environment-mode')),
      gpu: extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : 'unavailable',
      renderer: node.dataset.rendererName,
      resolution: Number(node.dataset.resolution),
      cameraRenderGroup: frame.cameraRenderGroup,
      culledResidentCount: frame.culledResidentCount,
      residentCount: frame.residentCount,
      staticPaintCount: frame.staticPaintCount,
      visibleMainLayerCount: frame.visibleMainLayerCount,
      visibleOversizedResidentCount: frame.visibleOversizedResidentCount,
      visibleResidentCount: frame.visibleResidentCount,
    }

    function darknessAlphaReceipt(darknessCanvas, worldCanvas, diagnostics, fallbackViewport) {
      const darknessContext = darknessCanvas.getContext('2d')
      if (!darknessContext) return null
      const logicalWidth = Number(worldCanvas.dataset.viewportWidth)
        || fallbackViewport.width
      const logicalHeight = Number(worldCanvas.dataset.viewportHeight)
        || fallbackViewport.height
      const scaleX = darknessCanvas.width / logicalWidth
      const scaleY = darknessCanvas.height / logicalHeight
      const player = {
        x: diagnostics.playerScreenX * scaleX,
        y: diagnostics.playerScreenY * scaleY,
      }
      const corners = [
        { x: 2 * scaleX, y: 2 * scaleY },
        { x: (logicalWidth - 2) * scaleX, y: 2 * scaleY },
        { x: 2 * scaleX, y: (logicalHeight - 2) * scaleY },
        {
          x: (logicalWidth - 2) * scaleX,
          y: (logicalHeight - 2) * scaleY,
        },
      ]
      const farthest = corners.reduce((best, point) => (
        Math.hypot(point.x - player.x, point.y - player.y)
          > Math.hypot(best.x - player.x, best.y - player.y)
          ? point
          : best
      ))
      return {
        center: darknessContext.getImageData(
          Math.round(player.x),
          Math.round(player.y),
          1,
          1,
        ).data[3],
        far: darknessContext.getImageData(
          Math.round(farthest.x),
          Math.round(farthest.y),
          1,
          1,
        ).data[3],
        logicalHeight,
        logicalWidth,
        physicalHeight: darknessCanvas.height,
        physicalWidth: darknessCanvas.width,
        resolution: Number(worldCanvas.dataset.resolution),
      }
    }
  }, viewport)
  if (process.env.SDR_GAME_PERF_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_PERF_SCREENSHOT })
  }

  assert.deepEqual(errors, [])
  assert.equal(runtime.renderer, 'webgl')
  assert.equal(runtime.cameraRenderGroup, true)
  assert.ok(runtime.residentCount > 0)
  assert.ok(runtime.culledResidentCount > 0)
  assert.ok(runtime.staticPaintCount > 0)
  assert.equal(runtime.staticPaintCount, initialStaticPaintCount)
  assert.ok(runtime.visibleResidentCount > 0)
  assert.ok(runtime.visibleMainLayerCount > 0)
  assert.equal(runtime.visibleResidentCount + runtime.culledResidentCount, runtime.residentCount)
  assert.ok(idle.minimumVisibleResidentCount > 0, JSON.stringify(idle))
  assert.ok(moving.minimumVisibleResidentCount > 0, JSON.stringify(moving))
  assert.ok(idle.minimumOversizedVisibleResidentCount > 0, JSON.stringify(idle))
  assert.ok(moving.minimumOversizedVisibleResidentCount > 0, JSON.stringify(moving))
  assert.ok(moving.presentedPlayerPositions > 10, JSON.stringify(moving))
  if (runtime.environmentMode === 1 || runtime.environmentMode === 2) {
    assert.ok(presentation.startupLighting, 'expected startup darkness diagnostics')
    assert.equal(
      presentation.startupLighting.physicalWidth,
      Math.round(
        presentation.startupLighting.logicalWidth
        * presentation.startupLighting.resolution,
      ),
    )
    assert.equal(
      presentation.startupLighting.physicalHeight,
      Math.round(
        presentation.startupLighting.logicalHeight
        * presentation.startupLighting.resolution,
      ),
    )
    assert.ok(presentation.startupLighting.center <= 16, JSON.stringify(presentation))
    assert.ok(presentation.startupLighting.far >= 240, JSON.stringify(presentation))
    assert.ok(runtime.darknessAlpha, 'expected the native darkness canvas')
    assert.ok(runtime.darknessAlpha.center <= 16, JSON.stringify(runtime))
    assert.ok(runtime.darknessAlpha.far >= 240, JSON.stringify(runtime))
  } else {
    assert.equal(runtime.darknessAlpha, null)
  }
  if (minimumFps > 0) {
    assert.ok(idle.averageFps >= minimumFps, JSON.stringify(idle))
    assert.ok(moving.averageFps >= minimumFps, JSON.stringify(moving))
  }
  if (!presentation.uncapped) {
    assert.ok(idle.averageFps <= presentation.frameCap + 0.01, JSON.stringify(idle))
    assert.ok(moving.averageFps <= presentation.frameCap + 0.01, JSON.stringify(moving))
  }
  process.stdout.write(`${JSON.stringify({
    idle,
    minimumFps,
    moving,
    runtime,
    sampleSeconds: sampleMs / 1000,
    status: 'ok',
    browserFrameLimitDisabled,
    cpuThrottleRate,
    mobileEmulation,
    viewport,
    presentationFrameCap: presentation.frameCap,
    presentationUncapped: presentation.uncapped,
    startupLighting: presentation.startupLighting,
  })}\n`)
} finally {
  await browser.close()
}

async function enterBoneyard(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const presentation = await configureGamePresentation(page, presentationUncapped)
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await Promise.race([
    page.getByLabel(/College courtyard/).waitFor({ timeout: 30_000 }),
    page.locator('.boneyard-scene').waitFor({ timeout: 30_000 }),
  ])
  if (await page.getByLabel(/College courtyard/).count()) {
    await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  }
  await page.locator('.boneyard-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 30_000 })
  const startupLighting = await page.evaluate((fallbackViewport) => {
    const darkness = document.querySelector('.boneyard-darkness')
    const world = document.querySelector('.boneyard-world-canvas')
    if (!(darkness instanceof HTMLCanvasElement) || !(world instanceof HTMLCanvasElement)) {
      return null
    }
    const context = darkness.getContext('2d')
    const diagnostics = world.__sdrBoneyardFrame
    if (!context || !diagnostics) return null
    const logicalWidth = Number(world.dataset.viewportWidth) || fallbackViewport.width
    const logicalHeight = Number(world.dataset.viewportHeight) || fallbackViewport.height
    const scaleX = darkness.width / logicalWidth
    const scaleY = darkness.height / logicalHeight
    const player = {
      x: Math.max(0, Math.min(darkness.width - 1, diagnostics.playerScreenX * scaleX)),
      y: Math.max(0, Math.min(darkness.height - 1, diagnostics.playerScreenY * scaleY)),
    }
    const corners = [
      { x: 2 * scaleX, y: 2 * scaleY },
      { x: (logicalWidth - 2) * scaleX, y: 2 * scaleY },
      { x: 2 * scaleX, y: (logicalHeight - 2) * scaleY },
      {
        x: (logicalWidth - 2) * scaleX,
        y: (logicalHeight - 2) * scaleY,
      },
    ]
    const farthest = corners.reduce((best, point) => (
      Math.hypot(point.x - player.x, point.y - player.y)
        > Math.hypot(best.x - player.x, best.y - player.y)
        ? point
        : best
    ))
    return {
      center: context.getImageData(
        Math.round(player.x),
        Math.round(player.y),
        1,
        1,
      ).data[3],
      far: context.getImageData(
        Math.max(0, Math.min(darkness.width - 1, Math.round(farthest.x))),
        Math.max(0, Math.min(darkness.height - 1, Math.round(farthest.y))),
        1,
        1,
      ).data[3],
      logicalHeight,
      logicalWidth,
      physicalHeight: darkness.height,
      physicalWidth: darkness.width,
      resolution: Number(world.dataset.resolution),
    }
  }, viewport)
  await page.waitForTimeout(1_000)
  return { ...presentation, startupLighting }
}

async function measure(page, duration) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const before = metricMap(await cdp.send('Performance.getMetrics'))
  const samples = await page.evaluate((measurementMs) => new Promise((resolve) => {
    const presentation = window.__sdrGamePresentation
    const longTasks = []
    const positions = []
    const residentCounts = []
    const timestamps = []
    const unsubscribe = presentation.subscribe((now) => {
      const diagnostics = document.querySelector('.boneyard-world-canvas')
        ?.__sdrBoneyardFrame
      timestamps.push(now)
      positions.push(diagnostics
        ? { x: diagnostics.playerX, y: diagnostics.playerY }
        : null)
      residentCounts.push(diagnostics
        ? {
            oversized: diagnostics.visibleOversizedResidentCount,
            visible: diagnostics.visibleResidentCount,
          }
        : null)
    })
    const observer = typeof PerformanceObserver === 'undefined'
      ? null
      : new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks.push({ duration: entry.duration, startTime: entry.startTime })
          }
        })
    observer?.observe({ entryTypes: ['longtask'] })
    setTimeout(() => {
      unsubscribe()
      observer?.disconnect()
      resolve({ longTasks, positions, residentCounts, timestamps })
    }, measurementMs)
  }), duration)
  const after = metricMap(await cdp.send('Performance.getMetrics'))
  await cdp.detach()
  const intervals = samples.timestamps.slice(1).map(
    (timestamp, index) => timestamp - samples.timestamps[index],
  )
  const elapsedMs = samples.timestamps.at(-1) - samples.timestamps[0]
  const slowest = [...intervals].sort((a, b) => b - a)
  const sorted = [...intervals].sort((a, b) => a - b)
  const lowCount = Math.max(1, Math.ceil(slowest.length * 0.01))
  const slowMean = slowest.slice(0, lowCount)
    .reduce((total, value) => total + value, 0) / lowCount
  const residentCounts = samples.residentCounts.filter(Boolean)
  return {
    averageFps: round(intervals.length * 1000 / elapsedMs),
    browserTaskMs: round(
      ((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000,
    ),
    onePercentLowFps: round(1000 / slowMean),
    p95FrameMs: round(percentile(sorted, 0.95)),
    p99FrameMs: round(percentile(sorted, 0.99)),
    maximumFrameMs: round(Math.max(...intervals)),
    longTaskCount: samples.longTasks.length,
    longestTaskMs: round(Math.max(0, ...samples.longTasks.map(({ duration }) => duration))),
    endPosition: samples.positions.findLast(Boolean),
    minimumOversizedVisibleResidentCount: residentCounts.length > 0
      ? Math.min(...residentCounts.map(({ oversized }) => oversized))
      : 0,
    minimumVisibleResidentCount: residentCounts.length > 0
      ? Math.min(...residentCounts.map(({ visible }) => visible))
      : 0,
    presentedPlayerPositions: new Set(samples.positions
      .filter(Boolean)
      .map(({ x, y }) => `${x},${y}`)).size,
    slowFramesOver10Ms: intervals.filter((interval) => interval > 10).length,
    slowFramesOver20Ms: intervals.filter((interval) => interval > 20).length,
    startPosition: samples.positions.find(Boolean),
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

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value.trim())
  if (!match) throw new Error('SDR_GAME_PERF_VIEWPORT must use WIDTHxHEIGHT')
  const width = Number(match[1])
  const height = Number(match[2])
  if (width < 320 || width > 7680 || height < 240 || height > 4320) {
    throw new Error('SDR_GAME_PERF_VIEWPORT is outside the supported range')
  }
  return { height, width }
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

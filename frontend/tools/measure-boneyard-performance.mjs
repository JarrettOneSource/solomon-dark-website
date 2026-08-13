import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_PERF_URL
  || process.env.SDR_GAME_SMOKE_URL
  || 'http://127.0.0.1:4181'
const cdpUrl = process.env.SDR_GAME_CDP_URL?.trim()
const minimumFps = Number(process.env.SDR_GAME_MIN_FPS || 0)
const sampleMs = Number(process.env.SDR_GAME_PERF_SAMPLE_MS || 5_000)
const connectedBrowser = Boolean(cdpUrl)
const browser = cdpUrl
  ? await chromium.connectOverCDP(cdpUrl)
  : await chromium.launch({
      executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
      headless: true,
    })
const context = connectedBrowser
  ? browser.contexts()[0]
  : await browser.newContext()
assert.ok(context, 'expected a browser context')
const page = await context.newPage()
await page.setViewportSize({ width: 1600, height: 900 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

try {
  await enterBoneyard(page)
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
  const runtime = await canvas.evaluate((node) => {
    const context = node.getContext('webgl2') || node.getContext('webgl')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    const darkness = document.querySelector('.boneyard-darkness')
    const frame = node.__sdrBoneyardFrame
    return {
      darknessAlpha: darkness instanceof HTMLCanvasElement
        ? darknessAlphaReceipt(darkness, frame)
        : null,
      domNodes: document.querySelectorAll('*').length,
      environmentMode: Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-environment-mode')),
      gpu: extension
        ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
        : 'unavailable',
      renderer: node.dataset.rendererName,
      resolution: Number(node.dataset.resolution),
      staticPaintCount: frame.staticPaintCount,
    }

    function darknessAlphaReceipt(darknessCanvas, diagnostics) {
      const darknessContext = darknessCanvas.getContext('2d')
      if (!darknessContext) return null
      const scaleX = darknessCanvas.width / 1600
      const scaleY = darknessCanvas.height / 900
      const player = {
        x: diagnostics.playerScreenX * scaleX,
        y: diagnostics.playerScreenY * scaleY,
      }
      const corners = [
        { x: 2 * scaleX, y: 2 * scaleY },
        { x: 1598 * scaleX, y: 2 * scaleY },
        { x: 2 * scaleX, y: 898 * scaleY },
        { x: 1598 * scaleX, y: 898 * scaleY },
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
      }
    }
  })
  if (process.env.SDR_GAME_PERF_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_PERF_SCREENSHOT })
  }

  assert.deepEqual(errors, [])
  assert.equal(runtime.renderer, 'webgl')
  assert.ok(runtime.staticPaintCount > 0)
  assert.equal(runtime.staticPaintCount, initialStaticPaintCount)
  assert.ok(moving.presentedPlayerPositions > 10, JSON.stringify(moving))
  if (runtime.environmentMode === 1 || runtime.environmentMode === 2) {
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
  process.stdout.write(`${JSON.stringify({
    idle,
    minimumFps,
    moving,
    runtime,
    sampleSeconds: sampleMs / 1000,
    status: 'ok',
  })}\n`)
} finally {
  await page.close()
  await browser.close()
}

async function enterBoneyard(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
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
  await page.waitForTimeout(1_000)
}

async function measure(page, duration) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  const before = metricMap(await cdp.send('Performance.getMetrics'))
  const samples = await page.evaluate((measurementMs) => new Promise((resolve) => {
    const positions = []
    const timestamps = []
    const startedAt = performance.now()
    const frame = (now) => {
      const diagnostics = document.querySelector('.boneyard-world-canvas')
        ?.__sdrBoneyardFrame
      timestamps.push(now)
      positions.push(diagnostics
        ? { x: diagnostics.playerX, y: diagnostics.playerY }
        : null)
      if (now - startedAt >= measurementMs) resolve({ positions, timestamps })
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }), duration)
  const after = metricMap(await cdp.send('Performance.getMetrics'))
  await cdp.detach()
  const intervals = samples.timestamps.slice(1).map(
    (timestamp, index) => timestamp - samples.timestamps[index],
  )
  const elapsedMs = samples.timestamps.at(-1) - samples.timestamps[0]
  const slowest = [...intervals].sort((a, b) => b - a)
  const lowCount = Math.max(1, Math.ceil(slowest.length * 0.01))
  const slowMean = slowest.slice(0, lowCount)
    .reduce((total, value) => total + value, 0) / lowCount
  return {
    averageFps: round(intervals.length * 1000 / elapsedMs),
    browserTaskMs: round(
      ((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000,
    ),
    onePercentLowFps: round(1000 / slowMean),
    endPosition: samples.positions.findLast(Boolean),
    presentedPlayerPositions: new Set(samples.positions
      .filter(Boolean)
      .map(({ x, y }) => `${x},${y}`)).size,
    slowFramesOver10Ms: intervals.filter((interval) => interval > 10).length,
    slowFramesOver20Ms: intervals.filter((interval) => interval > 20).length,
    startPosition: samples.positions.find(Boolean),
  }
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function round(value) {
  return Math.round(value * 100) / 100
}

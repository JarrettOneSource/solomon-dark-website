import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const sampleMs = Number(process.env.SDR_GAME_PERF_SAMPLE_MS || 20_000)
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: /Air/ }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  const canvas = page.locator('.hub-world-canvas')
  await canvas.waitFor({ timeout: 30_000 })
  await page.waitForTimeout(3_000)

  const cdp = await page.context().newCDPSession(page)
  await Promise.all([
    cdp.send('Performance.enable'),
    cdp.send('LayerTree.enable'),
    cdp.send('Network.enable'),
  ])
  let layerCount = 0
  let snapshotBytes = 0
  let snapshotFrames = 0
  cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => {
    layerCount = Math.max(layerCount, layers?.length ?? 0)
  })
  cdp.on('Network.webSocketFrameReceived', ({ response }) => {
    if (typeof response.payloadData !== 'string' || !response.payloadData.includes('server-snapshot')) return
    snapshotBytes += Buffer.byteLength(response.payloadData)
    snapshotFrames += 1
  })
  const metricsBefore = metricMap(await cdp.send('Performance.getMetrics'))
  const frames = await page.evaluate((duration) => new Promise((resolve) => {
    const timestamps = []
    const startedAt = performance.now()
    const frame = (now) => {
      timestamps.push(now)
      if (now - startedAt >= duration) resolve(timestamps)
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }), sampleMs)
  const metricsAfter = metricMap(await cdp.send('Performance.getMetrics'))
  const intervals = frames.slice(1).map((timestamp, index) => timestamp - frames[index])
  const elapsedMs = frames.at(-1) - frames[0]
  const sortedSlowest = [...intervals].sort((a, b) => b - a)
  const lowCount = Math.max(1, Math.ceil(sortedSlowest.length * 0.01))
  const slowMean = sortedSlowest.slice(0, lowCount).reduce((total, value) => total + value, 0) / lowCount
  const runtime = await canvas.evaluate((node) => {
    const context = node.getContext('webgl2') || node.getContext('webgl')
    const extension = context?.getExtension('WEBGL_debug_renderer_info')
    return {
      domNodes: document.querySelectorAll('*').length,
      gpu: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      renderer: node.dataset.rendererName,
      resolution: Number(node.dataset.resolution),
      studentCount: node.__sdrHubFrame.studentCount,
      worldDomChildren: document.querySelector('.hub-world-renderer')?.childElementCount ?? -1,
    }
  })
  const report = {
    averageFps: intervals.length * 1000 / elapsedMs,
    browserTaskSeconds: (metricsAfter.TaskDuration ?? 0) - (metricsBefore.TaskDuration ?? 0),
    compositorLayers: layerCount,
    onePercentLowFps: 1000 / slowMean,
    sampleSeconds: elapsedMs / 1000,
    snapshotFrames,
    snapshotHertz: snapshotFrames * 1000 / elapsedMs,
    snapshotKiBPerSecond: snapshotBytes / 1024 * 1000 / elapsedMs,
    slowFramesOver20Ms: intervals.filter((interval) => interval > 20).length,
    ...runtime,
  }
  assert.equal(report.renderer, 'webgl')
  assert.equal(report.worldDomChildren, 1)
  assert.ok(report.snapshotHertz > 18 && report.snapshotHertz < 22)
  process.stdout.write(`${JSON.stringify(report)}\n`)
} finally {
  await browser.close()
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

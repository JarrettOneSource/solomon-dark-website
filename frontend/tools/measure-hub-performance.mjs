import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const sampleMs = Number(process.env.SDR_GAME_PERF_SAMPLE_MS || 20_000)
const uncapped = process.env.SDR_GAME_PERF_UNCAPPED === '1'
const requireHardwareGpu = process.env.SDR_GAME_REQUIRE_HARDWARE_GPU === '1'
const movementCommands = parseMovementCommands(process.env.SDR_GAME_PERF_MOVE_SCRIPT)
const cdpUrl = process.env.SDR_GAME_CDP_URL?.trim()
const expectedStudentCount = optionalInteger(
  process.env.SDR_HUB_BENCH_STUDENTS,
  'SDR_HUB_BENCH_STUDENTS',
  0,
  256,
)
const browser = cdpUrl
  ? await chromium.connectOverCDP(cdpUrl)
  : await chromium.launch({
      executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
      headless: true,
      args: uncapped ? ['--disable-frame-rate-limit', '--disable-gpu-vsync'] : [],
    })
const errors = []
let page

try {
  const context = cdpUrl
    ? browser.contexts()[0]
    : await browser.newContext({ viewport: { width: 1600, height: 900 } })
  if (!context) throw new Error('CDP browser has no default context')
  page = await context.newPage()
  await page.setViewportSize({ width: 1600, height: 900 })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await page.getByRole('button', { name: /air/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  const canvas = page.locator('.hub-world-canvas')
  await canvas.waitFor({ timeout: 30_000 })
  const arrivalStudentCount = await studentCount(canvas)
  const movementReceipt = []
  for (const command of movementCommands) {
    const before = await playerPosition(canvas)
    await page.keyboard.down(command.key)
    await page.waitForTimeout(command.durationMs)
    await page.keyboard.up(command.key)
    await page.waitForTimeout(100)
    movementReceipt.push({ ...command, before, after: await playerPosition(canvas) })
  }
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
    if (typeof response.payloadData !== 'string') return
    let payload
    try {
      payload = JSON.parse(response.payloadData)
    } catch {
      return
    }
    if (payload?.type !== 'server-snapshot') return
    snapshotBytes += Buffer.byteLength(response.payloadData)
    snapshotFrames += 1
  })
  await page.waitForTimeout(1_000)
  snapshotBytes = 0
  snapshotFrames = 0
  const metricsBefore = metricMap(await cdp.send('Performance.getMetrics'))
  const sample = await page.evaluate((duration) => new Promise((resolve) => {
    const timestamps = []
    const studentCounts = []
    const startedAt = performance.now()
    const frame = (now) => {
      timestamps.push(now)
      studentCounts.push(document.querySelector('.hub-world-canvas')?.__sdrHubFrame.studentCount ?? -1)
      if (now - startedAt >= duration) resolve({ studentCounts, timestamps })
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }), sampleMs)
  const frames = sample.timestamps
  const measuredSnapshotBytes = snapshotBytes
  const measuredSnapshotFrames = snapshotFrames
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
      staticCulling: node.dataset.staticCulling,
      studentCulling: node.dataset.studentCulling,
      astronomerRenderable: node.__sdrHubFrame.astronomerRenderable,
      cameraRenderGroupCount: node.__sdrHubFrame.cameraRenderGroupCount,
      pooledStudentViewCount: node.__sdrHubFrame.pooledStudentViewCount,
      playerX: node.__sdrHubFrame.playerX,
      playerY: node.__sdrHubFrame.playerY,
      southernArchitectureCount: node.__sdrHubFrame.southernArchitectureCount,
      southernArtRenderable: node.__sdrHubFrame.southernArtRenderable,
      southernChildCount: node.__sdrHubFrame.southernChildCount,
      studentCount: node.__sdrHubFrame.studentCount,
      studentOutsideViewCount: node.__sdrHubFrame.studentOutsideViewCount,
      studentViewCreationCount: node.__sdrHubFrame.studentViewCreationCount,
      studentViewReuseCount: node.__sdrHubFrame.studentViewReuseCount,
      studentVisibleCandidateCount: node.__sdrHubFrame.studentVisibleCandidateCount,
      worldDomChildren: document.querySelector('.hub-world-renderer')?.childElementCount ?? -1,
    }
  })
  const report = {
    averageFps: intervals.length * 1000 / elapsedMs,
    browserTaskSeconds: (metricsAfter.TaskDuration ?? 0) - (metricsBefore.TaskDuration ?? 0),
    compositorLayers: layerCount,
    onePercentLowFps: 1000 / slowMean,
    sampleSeconds: elapsedMs / 1000,
    snapshotFrames: measuredSnapshotFrames,
    snapshotHertz: measuredSnapshotFrames * 1000 / elapsedMs,
    snapshotKiBPerSecond: measuredSnapshotBytes / 1024 * 1000 / elapsedMs,
    slowFramesOver20Ms: intervals.filter((interval) => interval > 20).length,
    uncapped,
    movementReceipt,
    expectedStudentCount: expectedStudentCount ?? null,
    studentArrivalCount: arrivalStudentCount,
    studentFinalCount: sample.studentCounts.at(-1),
    studentMaximumCount: Math.max(...sample.studentCounts),
    studentMinimumCount: Math.min(...sample.studentCounts),
    ...runtime,
  }
  assert.equal(report.renderer, 'webgl')
  assert.equal(report.staticCulling, 'none')
  assert.equal(report.studentCulling, 'instrumentation-only')
  assert.equal(report.worldDomChildren, 1)
  assert.equal(report.astronomerRenderable, true)
  assert.equal(report.southernArtRenderable, true)
  assert.ok(report.southernArchitectureCount > 0)
  assert.equal(
    report.southernChildCount,
    report.southernArchitectureCount + 3,
  )
  assert.equal(
    report.studentVisibleCandidateCount + report.studentOutsideViewCount,
    report.studentCount,
  )
  assert.equal(report.cameraRenderGroupCount, 3)
  if (requireHardwareGpu) assert.doesNotMatch(report.gpu, /SwiftShader|llvmpipe/i)
  if (expectedStudentCount !== undefined) {
    assert.equal(report.studentArrivalCount, expectedStudentCount)
    assert.equal(report.studentMinimumCount, expectedStudentCount)
    assert.equal(report.studentMaximumCount, expectedStudentCount)
    assert.equal(report.studentFinalCount, expectedStudentCount)
  }
  assert.deepEqual(errors, [])
  assert.ok(
    report.snapshotHertz > 18 && report.snapshotHertz < 22,
    `expected 20 Hz snapshots: ${JSON.stringify(report)}`,
  )
  if (process.env.SDR_GAME_PERF_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_PERF_SCREENSHOT })
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
} finally {
  await page?.close()
  await browser.close()
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function optionalInteger(value, name, minimum, maximum) {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return parsed
}

async function studentCount(canvas) {
  return canvas.evaluate((node) => node.__sdrHubFrame.studentCount)
}

async function playerPosition(canvas) {
  return canvas.evaluate((node) => ({
    x: node.__sdrHubFrame.playerX,
    y: node.__sdrHubFrame.playerY,
  }))
}

function parseMovementCommands(value) {
  if (!value?.trim()) return []
  const commands = value.split(',').map((source) => {
    const [key, durationText, ...unexpected] = source.trim().split(':')
    if (unexpected.length > 0 || !['w', 'a', 's', 'd'].includes(key)) {
      throw new Error('SDR_GAME_PERF_MOVE_SCRIPT entries must use w|a|s|d:milliseconds')
    }
    return {
      durationMs: optionalInteger(
        durationText,
        'SDR_GAME_PERF_MOVE_SCRIPT duration',
        1,
        30_000,
      ),
      key,
    }
  })
  if (commands.some(({ durationMs }) => durationMs === undefined)) {
    throw new Error('SDR_GAME_PERF_MOVE_SCRIPT entries require a duration')
  }
  const totalDuration = commands.reduce((total, command) => total + command.durationMs, 0)
  if (totalDuration > 60_000) {
    throw new Error('SDR_GAME_PERF_MOVE_SCRIPT may not exceed 60000 milliseconds')
  }
  return commands
}

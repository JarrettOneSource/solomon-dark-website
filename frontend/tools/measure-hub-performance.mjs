import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const sampleMs = Number(process.env.SDR_GAME_PERF_SAMPLE_MS || 20_000)
const viewport = parseViewport(process.env.SDR_GAME_PERF_VIEWPORT || '1600x900')
const mobileEmulation = process.env.SDR_GAME_PERF_MOBILE === '1'
const cpuThrottleRate = Number(process.env.SDR_GAME_CPU_THROTTLE || 1)
const minimumAverageFps = Number(process.env.SDR_GAME_MIN_AVERAGE_FPS || 0)
const maximumFrameMs = Number(process.env.SDR_GAME_MAX_FRAME_MS || 0)
const maximumP99FrameMs = Number(process.env.SDR_GAME_MAX_P99_FRAME_MS || 0)
const maximumSlowFramesOver34Ms = optionalInteger(
  process.env.SDR_GAME_MAX_FRAMES_OVER_34_MS,
  'SDR_GAME_MAX_FRAMES_OVER_34_MS',
  0,
  100_000,
)
const endpointUrl = process.env.SDR_GAME_ENDPOINT_URL?.trim()
const endpointCredential = process.env.SDR_GAME_ENDPOINT_CREDENTIAL?.trim()
if (Boolean(endpointUrl) !== Boolean(endpointCredential)) {
  throw new Error(
    'SDR_GAME_ENDPOINT_URL and SDR_GAME_ENDPOINT_CREDENTIAL must be provided together',
  )
}
const browserFrameLimitDisabled = process.env.SDR_GAME_PERF_UNCAPPED === '1'
const presentationUncapped = process.env.SDR_GAME_PRESENTATION_UNCAPPED === '1'
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
      args: browserFrameLimitDisabled
        ? ['--disable-frame-rate-limit', '--disable-gpu-vsync']
        : [],
    })
const errors = []
let page

try {
  const context = cdpUrl
    ? browser.contexts()[0]
    : await browser.newContext({
        deviceScaleFactor: mobileEmulation ? 3 : 1,
        hasTouch: mobileEmulation,
        isMobile: mobileEmulation,
        viewport,
      })
  if (!context) throw new Error('CDP browser has no default context')
  page = await context.newPage()
  await page.setViewportSize(viewport)
  await page.bringToFront()
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  if (!Number.isFinite(cpuThrottleRate) || cpuThrottleRate < 1 || cpuThrottleRate > 20) {
    throw new Error('SDR_GAME_CPU_THROTTLE must be between 1 and 20')
  }
  if (endpointUrl && endpointCredential) {
    await page.addInitScript(([url, credential]) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { kind: 'localhost', url, credential },
      }
    }, [endpointUrl, endpointCredential])
  }
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const presentation = await configureGamePresentation(page, presentationUncapped)
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

  if (cpuThrottleRate > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottleRate })
  }
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
    const presentation = window.__sdrGamePresentation
    const frameSamples = []
    const longTasks = []
    const studentCounts = []
    const observer = typeof PerformanceObserver === 'function'
      ? new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longTasks.push({ duration: entry.duration, startTime: entry.startTime })
          }
        })
      : null
    observer?.observe({ entryTypes: ['longtask'] })
    const unsubscribe = presentation.subscribe((now) => {
      const diagnostics = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
      const studentCount = diagnostics?.studentCount ?? -1
      studentCounts.push(studentCount)
      frameSamples.push({
        finishedAt: performance.now(),
        now,
        pooledStudentViewCount: diagnostics?.pooledStudentViewCount ?? -1,
        studentCount,
        studentViewCreationCount: diagnostics?.studentViewCreationCount ?? -1,
        studentViewReuseCount: diagnostics?.studentViewReuseCount ?? -1,
        tick: diagnostics?.tick ?? -1,
      })
    })
    setTimeout(() => {
      unsubscribe()
      observer?.disconnect()
      resolve({ frameSamples, longTasks, studentCounts })
    }, duration)
  }), sampleMs)
  const frames = sample.frameSamples.map(({ now }) => now)
  const measuredSnapshotBytes = snapshotBytes
  const measuredSnapshotFrames = snapshotFrames
  const metricsAfter = metricMap(await cdp.send('Performance.getMetrics'))
  if (cpuThrottleRate > 1) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  }
  const intervals = frames.slice(1).map((timestamp, index) => timestamp - frames[index])
  const elapsedMs = frames.at(-1) - frames[0]
  const sortedSlowest = [...intervals].sort((a, b) => b - a)
  const sortedIntervals = [...intervals].sort((a, b) => a - b)
  const tickDeltas = sample.frameSamples.slice(1).map(
    ({ tick }, index) => tick - sample.frameSamples[index].tick,
  )
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
    fastFramesUnderCapInterval: intervals.filter((interval) => interval < 2.5).length,
    minimumFrameMs: Math.min(...intervals),
    maximumFrameMs: Math.max(...intervals),
    p95FrameMs: percentile(sortedIntervals, 0.95),
    p99FrameMs: percentile(sortedIntervals, 0.99),
    presentationTickRewinds: tickDeltas.filter((delta) => delta < 0).length,
    maximumPresentationTickRewind: Math.max(0, ...tickDeltas.map((delta) => -delta)),
    onePercentLowFps: 1000 / slowMean,
    sampleSeconds: elapsedMs / 1000,
    snapshotFrames: measuredSnapshotFrames,
    snapshotHertz: measuredSnapshotFrames * 1000 / elapsedMs,
    snapshotKiBPerSecond: measuredSnapshotBytes / 1024 * 1000 / elapsedMs,
    slowFramesOver20Ms: intervals.filter((interval) => interval > 20).length,
    slowFramesOver34Ms: intervals.filter((interval) => interval > 34).length,
    longTaskCount: sample.longTasks.length,
    longestTaskMs: Math.max(0, ...sample.longTasks.map(({ duration }) => duration)),
    slowestFrames: slowFrameReceipts(sample.frameSamples),
    longTasks: sample.longTasks,
    browserFrameLimitDisabled,
    cpuThrottleRate,
    mobileEmulation,
    viewport,
    presentationFrameCap: presentation.frameCap,
    presentationUncapped: presentation.uncapped,
    movementReceipt,
    expectedStudentCount: expectedStudentCount ?? null,
    studentArrivalCount: arrivalStudentCount,
    studentFinalCount: sample.studentCounts.at(-1),
    studentMaximumCount: Math.max(...sample.studentCounts),
    studentMinimumCount: Math.min(...sample.studentCounts),
    ...runtime,
  }
  if (minimumAverageFps > 0) {
    assert.ok(
      report.averageFps >= minimumAverageFps,
      `average FPS missed the floor: ${JSON.stringify(report)}`,
    )
  }
  if (maximumFrameMs > 0) {
    assert.ok(
      report.maximumFrameMs <= maximumFrameMs,
      `presentation stutter exceeded the frame-gap limit: ${JSON.stringify(report)}`,
    )
  }
  if (maximumP99FrameMs > 0) {
    assert.ok(
      report.p99FrameMs <= maximumP99FrameMs,
      `presentation p99 exceeded the frame-gap limit: ${JSON.stringify(report)}`,
    )
  }
  if (maximumSlowFramesOver34Ms !== undefined) {
    assert.ok(
      report.slowFramesOver34Ms <= maximumSlowFramesOver34Ms,
      `presentation had too many multi-frame stalls: ${JSON.stringify(report)}`,
    )
  }
  assert.equal(report.renderer, 'webgl')
  assert.equal(report.staticCulling, 'none')
  assert.equal(report.studentCulling, 'instrumentation-only')
  assert.equal(report.worldDomChildren, 1)
  assert.equal(report.astronomerRenderable, true)
  assert.equal(report.southernArtRenderable, true)
  assert.equal(report.southernArchitectureCount, 16)
  assert.equal(report.southernChildCount, 19)
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
  if (!report.presentationUncapped) {
    assert.ok(
      report.averageFps <= report.presentationFrameCap + 0.01,
      `presentation exceeded its cap: ${JSON.stringify(report)}`,
    )
  }
  if (process.env.SDR_GAME_PERF_SCREENSHOT) {
    await page.screenshot({ path: process.env.SDR_GAME_PERF_SCREENSHOT })
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
} catch (error) {
  if (errors.length > 0) {
    process.stderr.write(`Browser errors before performance receipt: ${JSON.stringify(errors)}\n`)
  }
  throw error
} finally {
  await page?.close()
  await browser.close()
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value)
  if (!match) throw new Error('SDR_GAME_PERF_VIEWPORT must use WIDTHxHEIGHT')
  const width = Number(match[1])
  const height = Number(match[2])
  if (width < 1 || height < 1 || width > 8_192 || height > 8_192) {
    throw new Error('SDR_GAME_PERF_VIEWPORT dimensions must be between 1 and 8192')
  }
  return { height, width }
}

function percentile(sortedValues, percentileRank) {
  if (sortedValues.length === 0) return 0
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileRank) - 1),
  )
  return sortedValues[index]
}

function slowFrameReceipts(frameSamples) {
  return frameSamples.slice(1).map((sample, index) => {
    const previous = frameSamples[index]
    return {
      finishedWorkMs: sample.finishedAt - sample.now,
      intervalMs: sample.now - previous.now,
      pooledStudentViewCount: sample.pooledStudentViewCount,
      previousFinishedWorkMs: previous.finishedAt - previous.now,
      studentCount: sample.studentCount,
      studentCountDelta: sample.studentCount - previous.studentCount,
      studentViewCreationCount: sample.studentViewCreationCount,
      studentViewReuseCount: sample.studentViewReuseCount,
      tick: sample.tick,
      tickDelta: sample.tick - previous.tick,
      timestamp: sample.now,
    }
  }).sort((left, right) => right.intervalMs - left.intervalMs).slice(0, 12)
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

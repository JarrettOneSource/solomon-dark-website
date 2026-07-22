import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

const baseUrl = process.env.BONEYARD_BENCH_URL ?? 'http://127.0.0.1:4175'
const fixture = process.env.BONEYARD_BENCH_FIXTURE
  ? path.resolve(process.env.BONEYARD_BENCH_FIXTURE)
  : fileURLToPath(new URL('../public/samples/story0.boneyard', import.meta.url))
const stress = Math.max(1, Number.parseInt(process.env.BONEYARD_BENCH_STRESS ?? '1', 10) || 1)
const routeFilter = process.env.BONEYARD_BENCH_ROUTE ?? 'all'
const phaseFilter = new Set((process.env.BONEYARD_BENCH_PHASES ?? 'load,hover,pan,zoom').split(','))
const assertBudgets = process.env.BONEYARD_BENCH_ASSERT === '1'
const fixtureBytes = await readFile(fixture)
const fixtureFileName = `benchmark-${path.basename(fixture)}`

const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : { channel: process.env.CHROME_CHANNEL ?? 'chrome' }),
  headless: true,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
})

function metricMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function summarizeProfile(profile, limit = 12) {
  const frames = new Map(profile.nodes.map((node) => [node.id, node.callFrame]))
  const selfMicros = new Map()
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const frame = frames.get(profile.samples[i])
    if (!frame) continue
    const name = frame.functionName || '(anonymous)'
    const location = frame.url
      ? `${path.basename(frame.url)}:${frame.lineNumber + 1}`
      : ''
    const key = location ? `${name} (${location})` : name
    selfMicros.set(key, (selfMicros.get(key) ?? 0) + (profile.timeDeltas?.[i] ?? 0))
  }
  return [...selfMicros]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, micros]) => ({ name, selfMs: Math.round(micros / 100) / 10 }))
}

async function installObservers(page) {
  await page.addInitScript(() => {
    const state = {
      longTasks: [],
      rafDurations: [],
      canvasCalls: {},
    }
    window.__boneyardBenchmark = state

    try {
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) state.longTasks.push(entry.duration)
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      // Long Task timing is unavailable in a few test browsers; CDP task time
      // remains the authoritative measurement in that case.
    }

    const nativeRaf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => nativeRaf((timestamp) => {
      const started = performance.now()
      try {
        return callback(timestamp)
      } finally {
        state.rafDurations.push(performance.now() - started)
      }
    })

    const methods = [
      'clearRect', 'drawImage', 'ellipse', 'fill', 'fillRect', 'stroke',
      'strokeRect', 'createPattern', 'createRadialGradient', 'save', 'restore',
    ]
    for (const name of methods) {
      const native = CanvasRenderingContext2D.prototype[name]
      if (typeof native !== 'function') continue
      CanvasRenderingContext2D.prototype[name] = function (...args) {
        state.canvasCalls[name] = (state.canvasCalls[name] ?? 0) + 1
        return native.apply(this, args)
      }
    }

    window.__resetBoneyardBenchmark = () => {
      state.longTasks.length = 0
      state.rafDurations.length = 0
      state.canvasCalls = {}
    }
  })
}

async function benchmarkState(page) {
  return page.evaluate(() => {
    const state = window.__boneyardBenchmark
    const raf = [...state.rafDurations].sort((a, b) => a - b)
    const percentile = (p) => raf.length === 0 ? 0 : raf[Math.min(raf.length - 1, Math.floor(raf.length * p))]
    return {
      longTaskCount: state.longTasks.length,
      longTaskTotalMs: Math.round(state.longTasks.reduce((sum, value) => sum + value, 0) * 10) / 10,
      longestTaskMs: Math.round(Math.max(0, ...state.longTasks) * 10) / 10,
      rafCallbackCount: raf.length,
      rafP50Ms: Math.round(percentile(0.5) * 10) / 10,
      rafP95Ms: Math.round(percentile(0.95) * 10) / 10,
      rafMaxMs: Math.round(Math.max(0, ...raf) * 10) / 10,
      canvasCalls: state.canvasCalls,
    }
  })
}

async function largestCanvas(page) {
  const canvases = await page.locator('canvas').evaluateAll((nodes) => nodes.map((node, index) => {
    const rect = node.getBoundingClientRect()
    return { index, x: rect.x, y: rect.y, width: rect.width, height: rect.height, area: rect.width * rect.height }
  }).filter(({ area }) => area > 0).sort((a, b) => b.area - a.area))
  if (canvases.length === 0) throw new Error('No visible canvas found')
  return canvases[0]
}

async function measure(page, client, name, action) {
  process.stderr.write(`  ${name}... `)
  await page.evaluate(() => window.__resetBoneyardBenchmark())
  const before = metricMap(await client.send('Performance.getMetrics'))
  await client.send('Profiler.start')
  const started = performance.now()
  await action()
  await page.waitForTimeout(250)
  const wallMs = performance.now() - started
  const { profile } = await client.send('Profiler.stop')
  const after = metricMap(await client.send('Performance.getMetrics'))
  const result = {
    name,
    wallMs: Math.round(wallMs * 10) / 10,
    taskMs: Math.round(((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 10000) / 10,
    scriptMs: Math.round(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 10000) / 10,
    layoutMs: Math.round(((after.LayoutDuration ?? 0) - (before.LayoutDuration ?? 0)) * 10000) / 10,
    ...(await benchmarkState(page)),
    hottestSelfTime: summarizeProfile(profile),
  }
  process.stderr.write(`${result.taskMs} ms task time\n`)
  process.stderr.write(`${JSON.stringify(result.hottestSelfTime.slice(0, 6))}\n`)
  return result
}

async function exerciseCanvas(page, kind) {
  const canvas = await largestCanvas(page)
  const centerX = canvas.x + canvas.width / 2
  const centerY = canvas.y + canvas.height / 2
  const x0 = canvas.x + canvas.width * 0.25
  const x1 = canvas.x + canvas.width * 0.75

  const hover = async () => {
    const steps = 6 * stress
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1)
      await page.mouse.move(x0 + (x1 - x0) * t, centerY + Math.sin(t * Math.PI * 8) * canvas.height * 0.2)
      await page.waitForTimeout(4)
    }
  }
  const pan = async () => {
    await page.mouse.move(centerX, centerY)
    await page.mouse.down({ button: kind === 'editor' ? 'middle' : 'left' })
    const steps = 4 * stress
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      await page.mouse.move(centerX + Math.sin(t * Math.PI * 2) * 180, centerY + Math.sin(t * Math.PI * 4) * 80)
      await page.waitForTimeout(6)
    }
    await page.mouse.up({ button: kind === 'editor' ? 'middle' : 'left' })
  }
  const zoom = async () => {
    await page.mouse.move(centerX, centerY)
    const steps = 4 * stress
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, i < steps / 2 ? -80 : 80)
      await page.waitForTimeout(12)
    }
  }
  return { canvas, hover, pan, zoom }
}

async function runRoute({ kind, route, readyText }) {
  process.stderr.write(`${kind} ${route}\n`)
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await installObservers(page)
  const client = await context.newCDPSession(page)
  await client.send('Performance.enable')
  await client.send('Profiler.enable')
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
  await page.getByText(readyText, { exact: false }).first().waitFor()
  process.stderr.write('  route ready\n')

  const input = page.locator('input[type=file]').first()
  const phases = []
  const load = await measure(page, client, 'load', async () => {
    await input.setInputFiles({
      name: fixtureFileName,
      mimeType: 'application/octet-stream',
      buffer: fixtureBytes,
    })
    await page.getByText(fixtureFileName, { exact: false }).first().waitFor({ timeout: 30_000 })
    await page.waitForTimeout(1_500)
  })
  phases.push(load)

  const exercise = await exerciseCanvas(page, kind)
  if (phaseFilter.has('hover')) phases.push(await measure(page, client, 'hover', exercise.hover))
  if (phaseFilter.has('pan')) phases.push(await measure(page, client, 'pan', exercise.pan))
  if (phaseFilter.has('zoom')) phases.push(await measure(page, client, 'zoom', exercise.zoom))
  const result = { kind, route, canvas: exercise.canvas, phases }
  await context.close()
  return result
}

try {
  const results = []
  if (routeFilter === 'all' || routeFilter === 'editor') {
    results.push(await runRoute({ kind: 'editor', route: '/boneyard', readyText: 'The Boneyard' }))
  }
  if (routeFilter === 'all' || routeFilter === 'viewer') {
    results.push(await runRoute({ kind: 'viewer', route: '/boneyards', readyText: 'Boneyard Viewer' }))
  }
  if (assertBudgets) {
    if (stress !== 1) throw new Error('Performance budgets require BONEYARD_BENCH_STRESS=1')
    const budgets = { load: 2_000, hover: 1_500, pan: 1_500, zoom: 1_500 }
    const failures = results.flatMap((result) => result.phases
      .filter((phase) => phase.taskMs > budgets[phase.name])
      .map((phase) => `${result.kind} ${phase.name}: ${phase.taskMs} ms > ${budgets[phase.name]} ms`))
    if (failures.length > 0) throw new Error(`Boneyard performance budget failed:\n${failures.join('\n')}`)
  }
  console.log(JSON.stringify({ fixture, results }, null, 2))
} finally {
  await browser.close()
}

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

export async function renderArchivedRun(options) {
  assert.ok(Number.isInteger(options.width) && options.width > 0 && options.width <= 8192)
  assert.ok(Number.isInteger(options.height) && options.height > 0 && options.height <= 8192)
  const pixelRatio = options.pixelRatio ?? 1
  assert.ok(Number.isFinite(pixelRatio) && pixelRatio > 0 && pixelRatio <= 32)
  const root = fileURLToPath(new URL('../', import.meta.url))
  const vite = await createServer({
    root, logLevel: 'error', cacheDir: 'node_modules/.vite-run-archive',
    server: { host: '127.0.0.1', port: 0 },
  })
  let browser = null
  const errors = { console: [], page: [], responses: [] }
  try {
    await vite.listen()
    browser = await chromium.launch({
      executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: options.headless,
    })
    const page = await browser.newPage({
      viewport: { width: options.width, height: options.height }, deviceScaleFactor: pixelRatio,
    })
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    const origin = `http://127.0.0.1:${vite.httpServer.address().port}`
    await page.route(`${origin}/__run_archive`, route => route.fulfill({
      body: '<!doctype html><html><body style="margin:0;background:black"></body></html>',
      contentType: 'text/html',
    }))
    await page.goto(`${origin}/__run_archive`)
    const result = await page.evaluate(async ({ boneyard, snapshot, playerId, iterations }) => {
      const { createBoneyardWorldRenderer } = await import('/src/game/renderer/boneyard-world-renderer.ts')
      const { gameViewportLayout } = await import('/src/game/renderer/game-viewport.ts')
      const { RunPerformanceSampler } = await import('/src/game/client/run-performance.ts')
      const renderer = await createBoneyardWorldRenderer({
        boneyard, initialSnapshot: snapshot, playerId,
        modAssets: [], modCatalog: [], viewport: gameViewportLayout(innerWidth, innerHeight),
        now: () => 0,
      })
      document.body.appendChild(renderer.canvas)
      const renderMs = []
      const timing = new RunPerformanceSampler(performance.now())
      const context = { serverTick: snapshot.tick, pingMs: null, hidden: false, paused: false }
      for (let index = -30; index < iterations; index += 1) {
        const now = await new Promise(resolve => requestAnimationFrame(resolve))
        if (index === -1) {
          timing.sample(now, context)
          timing.frame(now, document.hidden)
        }
        const started = performance.now()
        renderer.render(snapshot)
        if (index >= 0) {
          renderMs.push(performance.now() - started)
          timing.frame(now, document.hidden)
        }
      }
      const summarize = values => {
        values.sort((a, b) => a - b)
        const percentile = fraction => values[Math.ceil(values.length * fraction) - 1]
        return { count: values.length, p50: percentile(0.5), p95: percentile(0.95),
          p99: percentile(0.99), maximum: values.at(-1) }
      }
      const receipt = { renderMs: summarize(renderMs),
        clientTiming: timing.sample(performance.now(), { ...context, hidden: document.hidden }),
        canvasWidth: renderer.canvas.width, canvasHeight: renderer.canvas.height,
        players: Object.keys(snapshot.players).length, tick: snapshot.tick }
      renderer.destroy()
      return receipt
    }, options)
    assert.deepEqual(errors, { console: [], page: [], responses: [] })
    return { ...result, errors }
  } finally {
    await browser?.close()
    await vite.close()
  }
}

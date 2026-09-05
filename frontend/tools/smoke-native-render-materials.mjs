import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', root, server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer.address()
assert.ok(address && typeof address !== 'string')
const origin = `http://127.0.0.1:${address.port}`
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = { console: [], page: [], responses: [] }
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  await page.route(`${origin}/__materials`, route => route.fulfill({
    body: '<!doctype html><html><body style="margin:0;background:black"></body></html>', contentType: 'text/html',
  }))
  await page.goto(`${origin}/__materials`, { waitUntil: 'domcontentloaded' })
  if (process.argv.includes('--measure')) {
    const measured = await page.evaluate(async () => {
      const { measureNativeMaterialFrames } = await import('/tools/native-render-material-probe.mjs')
      return measureNativeMaterialFrames()
    })
    for (const phase of measured.phases) {
      phase.frameGaps = summarize(phase.frameGaps)
      phase.renderTimes = summarize(phase.renderTimes)
    }
    assert.deepEqual(errors, { console: [], page: [], responses: [] })
    console.log(JSON.stringify({ errors, measured }))
  } else {
    const samples = await page.evaluate(async () => {
      const { renderNativeMaterialSamples } = await import('/tools/native-render-material-probe.mjs')
      return renderNativeMaterialSamples()
    })
    const failures = []
    for (const sample of samples) {
      const expected = expectedPixel(sample)
      if (sample.pixel.some((value, index) => Math.abs(value - expected[index]) > 2)) {
        failures.push({ ...sample, expected })
      }
    }
    console.log(JSON.stringify({ errors, failures, samples }))
    assert.deepEqual(errors, { console: [], page: [], responses: [] })
    assert.deepEqual(failures, [], 'GPU output must match independent native RGBA interpolation and blending')
  }
} finally {
  await browser.close()
  await vite.close()
}

function expectedPixel(sample) {
  if (sample.role === 'particle-blend') {
    const color = saturate([128 / 255, 64 / 255, 192 / 255], 'arena')
    return sample.blend === 'multiply'
      ? [...color.map(channel => channel * 255), sample.alpha]
      : [...color.map(channel => channel * sample.alpha), sample.alpha * sample.alpha / 255]
  }
  if (sample.role === 'first-normal') return [128, 128, 128, 128 * 128 / 255]
  if (sample.role === 'uniform') {
    const alpha = (128 / 255) ** 2
    const color = saturate([128 / 255, 192 / 255, 1], sample.mode)
    return [...color.map(channel => channel * alpha * 255), alpha * alpha * 255]
  }
  if (sample.role === 'multiply') {
    return [...saturate([128 / 255, 64 / 255, 192 / 255], sample.mode).map(channel => channel * 255), sample.alpha]
  }
  const amount = 8.5 / 16
  const vertex = sample.top.map((value, index) => (value * (1 - amount) + sample.bottom[index] * amount) / 255)
  const color = saturate(vertex.slice(0, 3), sample.mode)
  return [...color.map(channel => channel * vertex[3] * 255), vertex[3] * vertex[3] * 255]
}

function saturate(color, mode) {
  if (mode === 'fixed') return color
  const grey = (color[0] + color[1] + color[2]) / 3
  return color.map(channel => grey * 0.35 + channel * 0.65)
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const at = percentile => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile) - 1)]
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted.at(-1) }
}

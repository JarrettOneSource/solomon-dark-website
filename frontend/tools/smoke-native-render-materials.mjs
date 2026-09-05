import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const collectCoverage = process.argv.includes('--coverage')
const coveragePlugins = collectCoverage
  ? [(await import('./quality/coverage-plugin.mjs')).rendererCoveragePlugin()]
  : []
const vite = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', plugins: coveragePlugins, root,
  cacheDir: 'reports/renderer-quality/vite-cache',
  server: { host: '127.0.0.1', port: 0 },
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
  const activeMutant = process.env.__STRYKER_ACTIVE_MUTANT__
  if (activeMutant !== undefined) {
    await page.addInitScript(id => { globalThis.__stryker__ = { activeMutant: id } }, activeMutant)
  }
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
    const { samples, contexts } = await page.evaluate(async () => {
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
    console.log(JSON.stringify({ errors, failures, samples: samples.length }))
    assert.deepEqual(errors, { console: [], page: [], responses: [] })
    assert.deepEqual(failures, [], 'GPU output must match independent native RGBA interpolation and blending')
    assert.deepEqual(contexts, [{ previousShaderDestroyed: true, previousProgramDestroyed: true }])
    const contracts = await page.evaluate(async () => {
      const { inspectNativeRenderContracts } = await import('/tools/native-render-contract-probe.mjs')
      return inspectNativeRenderContracts()
    })
    console.log(JSON.stringify({ contracts }))
    assert.deepEqual(contracts.sources.map(({ name, alphaMode, addressMode, scaleMode }) => (
      [name, alphaMode, addressMode, scaleMode]
    )), [
      ['stock', 'no-premultiply-alpha', 'repeat', 'linear'],
      ['point', 'no-premultiply-alpha', 'repeat', 'nearest'],
      ['framed', 'no-premultiply-alpha', 'clamp-to-edge', 'linear'],
      ['composited', 'premultiply-alpha-on-upload', 'clamp-to-edge', 'linear'],
    ])
    assert.ok(contracts.sources.every(({ pixel }) => pixel.every(channel => channel === 255)))
    for (const grid of contracts.grids) {
      assert.deepEqual(grid.initial, [255, 255, 255, 255])
      assert.deepEqual(grid.before, [255, 255, 255, 255])
      assert.deepEqual(grid.after, [63, 63, 63, 255])
      assert.equal(grid.colors.length, grid.vertices * 4)
      assert.equal(grid.colors.filter((_, index) => index % 4 !== 3).every(value => value === 63), true)
      assert.equal(grid.removed && grid.meshDestroyed && grid.geometryDestroyed && grid.shaderDestroyed, true)
      assert.equal(grid.borrowedTextureAlive, true)
    }
    assert.deepEqual(contracts.roads, {
      countBefore: 5, countAfter: 3, countAfterEmpty: 3,
      vertices: 40, indices: 90, meshes: 5, pixel: [128, 128, 128, 255], childrenAfterDestroy: 0,
      resourcesDestroyed: true, textureAlive: true,
    })
    assert.deepEqual(contracts.detachedScene, { destroyed: true, count: 0 })
    assert.deepEqual(contracts.missingRoad, { message: 'Native Road style 0 texture is unavailable', childrenAfterFailure: 0 })
    const variants = await page.evaluate(async () => {
      const { inspectNativeRendererVariants } = await import('/tools/native-render-contract-probe.mjs')
      return inspectNativeRendererVariants()
    })
    console.log(JSON.stringify({ variants }))
    assert.deepEqual(variants.errors, ['uninitialized-fixed', 'uninitialized-arena', 'unsupported-renderer'].map(name => (
      { name, message: 'Native materials require an initialized WebGL renderer' }
    )))
    assert.deepEqual(variants.variants, [
      { name: 'sprite-only', pixel: [128, 128, 128, 64] },
      { name: 'browser-overlay', pixel: [128, 128, 128, 128] },
      { name: 'default-particle', pixel: [255, 255, 255, 255] },
    ])
    const transforms = await page.evaluate(async () => {
      const { compareNativeBatchTransforms } = await import('/tools/native-render-contract-probe.mjs')
      return compareNativeBatchTransforms()
    })
    console.log(JSON.stringify({ transforms }))
    assert.equal(transforms.length, 6)
    assert.ok(transforms.every(row => row.changedChannels === 0 && row.visiblePixels > 1000 && row.reusedBatchShaders))
    const surfaceSampling = await page.evaluate(async () => {
      const { inspectNativeSurfaceSampling } = await import('/tools/native-render-contract-probe.mjs')
      return inspectNativeSurfaceSampling()
    })
    assert.deepEqual(surfaceSampling, [[160, 160, 160, 255], [160, 160, 160, 255]])
    const staff = await page.evaluate(async () => {
      const { compareNativeStaffFrames } = await import('/tools/native-render-staff-probe.mjs')
      return compareNativeStaffFrames()
    })
    console.log(JSON.stringify({ staff }))
    assert.equal(staff.frames.length, 6)
    assert.ok(staff.frames.every(row => row.changedChannels === 0 && row.visiblePixels > 50))
    assert.ok(staff.lifetimes.every(row => row.container && row.children && row.geometry && row.textureAlive))
    const lifetimes = await page.evaluate(async () => {
      const { inspectNativeMaterialLifetimes } = await import('/tools/native-render-lifecycle-probe.mjs')
      return inspectNativeMaterialLifetimes()
    })
    console.log(JSON.stringify({ lifetimes }))
    for (const row of lifetimes.pixels) {
      const expected = row.phase.includes('arena') ? [128, 86, 170, 255] : [128, 64, 192, 255]
      assert.ok(row.pixel.every((channel, index) => Math.abs(channel - expected[index]) <= 1), JSON.stringify(row))
    }
    for (const key of ['idempotent', 'previousShadersPreserved', 'retiredArenaShaders', 'replacedStockMesh', 'fixedShadersDestroyed', 'texturesAlive']) {
      assert.equal(lifetimes[key], true, key)
    }
    assert.ok(lifetimes.batchLifetimes.every(Boolean))
    assert.deepEqual(errors, { console: [], page: [], responses: [] })
  }
  if (collectCoverage) {
    const coverage = await page.evaluate(() => globalThis.__coverage__)
    assert.ok(coverage, 'renderer instrumentation must produce browser coverage')
    const directory = resolve('reports/renderer-quality/coverage/raw')
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/browser.json`, JSON.stringify(coverage))
  }
} finally {
  await browser.close()
  await vite.close()
}

function expectedPixel(sample) {
  if (sample.role === 'explicit-shader') return [63, 63, 63, 255]
  if (sample.role === 'retained-color-mode') {
    const color = sample.masked ? [1, 1, 1] : saturate(sample.rgba.slice(0, 3).map(channel => channel / 255), sample.mode)
    const alpha = sample.rgba[3] / 255
    return [...color.map(channel => channel * alpha * 255), alpha * alpha * 255]
  }
  if (sample.role === 'texture-opacity') {
    const alpha = sample.rgba[3] / 255 * (128 / 255) ** 2
    const texture = sample.rgba.slice(0, 3).map(channel => sample.premultiplied ? channel / sample.rgba[3] : channel / 255)
    const vertex = [128 / 255, 192 / 255, 1]
    const grey = (texture[0] + texture[1] + texture[2]) / 3 * (vertex[0] + vertex[1] + vertex[2]) / 3
    const color = texture.map((channel, index) => (
      sample.mode === 'fixed' ? channel * vertex[index] : grey * 0.35 + channel * vertex[index] * 0.65
    ))
    return [...color.map(channel => channel * alpha * 255), alpha * alpha * 255]
  }

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
  vertex[3] *= sample.groupAlpha ?? 1
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

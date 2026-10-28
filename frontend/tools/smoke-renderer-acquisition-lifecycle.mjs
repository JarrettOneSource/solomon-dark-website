import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { createGameSimulation, enterBoneyardWorld } from '../src/game/core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { createHubPresentationTimeline } from '../src/game/client/hub-presentation-timeline.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const root = resolve(process.env.SDR_LIFECYCLE_SOURCE_ROOT || frontendRoot)
const evidence = process.env.SDR_LIFECYCLE_EVIDENCE_ROOT
const mode = process.env.SDR_LIFECYCLE_EXPECT || 'candidate'
assert.ok(evidence, 'SDR_LIFECYCLE_EVIDENCE_ROOT is required')
assert.ok(['baseline', 'candidate'].includes(mode), 'SDR_LIFECYCLE_EXPECT must be baseline or candidate')
await mkdir(evidence, { recursive: true })
const probe = await readFile(new URL('./renderer-acquisition-lifecycle-probe.mjs', import.meta.url), 'utf8')
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')
const asset = (sha256, path) => ({ sha256, path, kind: 'image', modId: 'lifecycle-fixture',
  byteLength: pixel.length, contentType: 'image/png' })
const assets = [asset('1'.repeat(64), 'early.png'), asset('2'.repeat(64), 'failed.png'), asset('3'.repeat(64), 'late.png')]
const simulation = createGameSimulation({ local: { element: 'fire', discipline: 'arcane', displayName: 'Lifecycle probe' } })
const hubSnapshot = createHubPresentationTimeline({
  initialSnapshot: createGameSnapshot(simulation, 'local'), initialReceivedAtMs: 0,
  localPlayerId: 'local', serverTickRate: 100, snapshotRate: 20,
}).sample(0)
const boneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 45))
const boneyardSnapshot = createGameSnapshot(enterBoneyardWorld(simulation, boneyard), 'local')
const cases = [
  ...['skill-picker', 'skill-book', 'hud-selector', 'inventory'].map(kind => ({ kind, holdGpu: true, abort: 'fonts' })),
  { kind: 'skill-picker', name: 'skill-picker-early-gpu', abort: 'fonts', abortDelayMs: 250 },
  { kind: 'hub-world', assets: [assets[1]], initialSnapshot: hubSnapshot, abort: 'mod' },
  { kind: 'boneyard-world', assets: [assets[1]], initialSnapshot: boneyardSnapshot, boneyard, abort: 'mod' },
  { kind: 'workbench', abort: 'fonts' },
  { kind: 'workbench', name: 'workbench-success' },
  { kind: 'image-cache', source: '/__lifecycle/image.png', abort: 'image' },
  { kind: 'mod-images', assets, abort: 'mod' },
  { kind: 'mod-images-overlap', assets, abort: 'mod', holdLate: true },
  { kind: 'mod-images-overlap', name: 'mod-images-old-generation', assets, abort: 'mod', holdLate: true, replaceGeneration: true },
  { kind: 'stock-images', sources: ['/__lifecycle/early.png', '/__lifecycle/failed.png', '/__lifecycle/late.png'], abort: 'stock' },
  { kind: 'static-images', abort: 'static' },
  { kind: 'static-images', name: 'static-images-fresh' },
]
const selected = process.env.SDR_LIFECYCLE_CASES?.split(',')
const server = await createServer({ root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 } })
let browser
const receipt = { mode, root, revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  harnessSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),
  probeSha256: createHash('sha256').update(probe).digest('hex'), cases: [] }
try {
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--disable-breakpad'] })
  for (const input of cases) {
    const name = input.name || input.kind
    if (selected && !selected.includes(name)) continue
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    const page = await context.newPage()
    const errors = { page: [], console: [], requests: [], responses: [] }
    const injectedUrls = new Set()
    let injected = false
    let releaseLate
    const lateGate = new Promise(resolve => { releaseLate = resolve })
    await page.exposeFunction('__releaseLifecycleLateImages', () => { releaseLate() })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', entry => {
      if (entry.type() === 'error') errors.console.push({ text: entry.text(), url: entry.location().url })
    })
    page.on('requestfailed', request => errors.requests.push({ url: request.url(), error: request.failure()?.errorText }))
    page.on('response', response => {
      if (response.status() >= 400) errors.responses.push({ url: response.url(), status: response.status() })
    })
    await page.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname === '/__acquisition-probe.mjs') {
        return route.fulfill({ contentType: 'text/javascript', body: probe })
      }
      if (url.pathname === '/__acquisition') {
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' })
      }
      const target = input.abort === 'fonts' ? url.pathname.endsWith('/skill-picker-fonts-atlas.png')
        : input.abort === 'mod' ? url.pathname === `/api/game/content/${assets[1].sha256}`
        : input.abort === 'image' ? url.pathname === '/__lifecycle/image.png'
        : input.abort === 'stock' ? url.pathname === '/__lifecycle/failed.png'
        : input.abort === 'static' ? url.pathname.includes('/boneyard/deadhawg/') : false
      if (request.resourceType() === 'image' && target && !injected) {
        injected = true
        injectedUrls.add(request.url())
        if (input.abortDelayMs) await new Promise(resolve => setTimeout(resolve, input.abortDelayMs))
        return route.abort('failed')
      }
      if (url.pathname.startsWith('/__lifecycle/') || url.pathname.startsWith('/api/game/content/')) {
        if (url.pathname.endsWith('/late.png') || url.pathname.endsWith(assets[2].sha256)) {
          if (input.holdLate) await lateGate
          else await new Promise(resolve => setTimeout(resolve, 150))
        }
        return route.fulfill({ contentType: 'image/png', body: pixel })
      }
      return route.continue()
    })
    let result, failure
    try {
      await page.goto(`${origin}/__acquisition`, { waitUntil: 'domcontentloaded' })
      result = await page.evaluate(async input => {
        const { inspectRendererAcquisition } = await import('/__acquisition-probe.mjs')
        return inspectRendererAcquisition(input)
      }, input)
    } catch (error) { failure = error.stack || String(error) }
    const unexpected = {
      page: errors.page,
      console: errors.console.filter(entry => !injectedUrls.has(entry.url)),
      requests: errors.requests.filter(entry => !injectedUrls.has(entry.url)),
      responses: errors.responses.filter(entry => !injectedUrls.has(entry.url)),
    }
    const violations = []
    const check = (condition, text) => { if (!condition) violations.push(text) }
    check(!failure, failure)
    check(!input.abort || injected, 'expected failure injection did not occur')
    check(Object.values(unexpected).every(values => values.length === 0), 'unexpected browser error')
    if (result) {
      if (result.afterFailure) checkClean(result.afterFailure, check, 'failed acquisition')
      if (result.afterTeardown) checkClean(result.afterTeardown, check, 'teardown')
      if ('retrySucceeded' in result) check(result.retrySucceeded, 'same-document retry failed')
      if (result.retainedCanvas !== undefined && result.retainedCanvas !== null) check(result.retainedCanvas, 'retained canvas lease/identity changed')
      if (input.holdGpu) {
        check(result.first.status === 'rejected', 'failure waited for held GPU sibling')
        check(result.atFailure.applications.some(row => !row.completed), 'no delayed GPU acquisition observed')
      }
      if (input.kind === 'image-cache') {
        check(result.sharesInFlight, 'in-flight image request was not shared')
        check(result.first.status === 'rejected' && result.retried && result.second.status === 'resolved', 'failed image cache did not recover')
      }
      if (input.kind === 'mod-images') {
        check(result.releasedEarly && result.releasedLate, 'failed mod group retained successful image promises')
        if (result.retrySucceeded) {
          check(result.sharedDuringOwner, 'successful mod owner lost its shared image cache before destroy')
          check(result.releasedOnDestroy, 'successful mod owner retained its image cache after destroy')
        }
      }
      if (input.kind === 'mod-images-overlap') {
        check(result.first.status === 'rejected' && result.overlapPending, 'shared sibling did not remain pending across failure/retry')
        check(result.oldGenerationReplaced === Boolean(input.replaceGeneration), 'mod cache generation fixture did not match its declared boundary')
        check(result.sharedAfterFailedCleanup, 'late failed-owner cleanup evicted the successful overlapping owner')
        check(result.releasedByLastOwner, 'last successful mod owner did not release its image generation')
      }
      if (input.kind === 'static-images') {
        check(result.first.status === (input.abort ? 'rejected' : 'resolved'), 'static image first-load outcome changed')
        check(result.second.status === (input.abort ? 'rejected' : 'resolved'), 'cached static image wait did not settle correctly')
      }
      if (input.kind === 'workbench') {
        check(result.status === (input.abort ? 'error' : 'ready'), 'workbench readiness outcome changed')
        if (input.abort) checkClean(result.afterLoad, check, 'workbench failure')
      }
    }
    receipt.cases.push({ name, injection: { kind: input.abort || null, urls: [...injectedUrls] }, result,
      errors, unexpected, failure, candidateContractViolations: violations })
    releaseLate()
    await context.close()
    await writeFile(resolve(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
    console.log(JSON.stringify({ name, candidateContractViolations: violations }))
  }
  const violations = receipt.cases.flatMap(row => row.candidateContractViolations.map(reason => ({ name: row.name, reason })))
  if (mode === 'candidate') assert.deepEqual(violations, [])
  else {
    for (const row of receipt.cases) {
      assert.equal(row.failure, undefined, `${row.name}: baseline harness failed`)
      assert.ok(Object.values(row.unexpected).every(values => values.length === 0), `${row.name}: unexpected baseline browser error`)
      assert.ok(!row.injection.kind || row.injection.urls.length === 1, `${row.name}: baseline injection was not observed`)
      if (['workbench-success', 'stock-images', 'static-images-fresh'].includes(row.name)) {
        assert.deepEqual(row.candidateContractViolations, [], `${row.name}: unchanged success control regressed`)
      }
    }
    assert.ok(violations.length > 0, 'unmodified baseline unexpectedly satisfied every regression')
  }
} finally {
  await browser?.close()
  await server.close()
  await writeFile(resolve(evidence, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
}

function checkClean(snapshot, check, label) {
  check(snapshot.liveImageSources === 0, `${label} leaked image texture sources: ${snapshot.liveImageSources}`)
  for (const [index, application] of snapshot.applications.entries()) {
    check(application.destroyCalls === 1, `${label} application ${index} destroy count ${application.destroyCalls}`)
    check(application.contextLost === true, `${label} application ${index} retained its WebGL context`)
  }
}

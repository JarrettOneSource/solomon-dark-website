import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { enterElementHub, enterBoneyard } from './game-smoke-navigation.mjs'
import { nativeTreeOverlapsCamera } from '../src/game/renderer/boneyard-tree-occlusion.ts'

// This is bounded browser acceptance of original Tree scene behavior and an
// actual compiled UI journey, not a full gate or a native-history equivalence claim.
const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(process.env.SDR_TREE_SCENE_OUTPUT || resolve(root, 'reports/tree-fade-scene'))
const mode = process.env.SDR_TREE_SCENE_MODE || 'all'
await mkdir(output, { recursive: true })
const errors = { page: [], console: [], responses: [], requests: [], host: [] }
const report = { status: 'running', browser: null, errors, scene: {}, ui: {} }
const checkpoint = () => writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2) + '\n')
let browser, vite, server, host, currentPage
function watch(page) {
  page.on('pageerror', e => errors.page.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()) })
  page.on('response', r => { if (r.status() >= 400) errors.responses.push({ status: r.status(), url: r.url() }) })
  page.on('requestfailed', r => errors.requests.push({ url: r.url(), error: r.failure()?.errorText }))
}
async function screenshot(page, name, selector) {
  const path = resolve(output, name + '.png')
  await (selector ? page.locator(selector) : page).screenshot({ path, timeout: 30000 })
  return path
}
try {
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  })
  report.browser = browser.version()
  if (mode !== 'ui') await sceneAcceptance()
  if (mode !== 'scene') await compiledJourney()
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], host: [] })
  report.status = 'ok'
  await checkpoint()
  process.stdout.write(JSON.stringify(report) + '\n')
} catch (error) {
  report.status = 'failed'
  report.failure = { message: error.message, stack: error.stack }
  if (currentPage && !currentPage.isClosed()) {
    report.failure.screenshot = await screenshot(currentPage, 'failure').catch(() => null)
  }
  await checkpoint()
  throw error
} finally {
  await browser?.close()
  await host?.close()
  await vite?.close()
  await server?.close()
}

async function sceneAcceptance() {
  vite = await createServer({
    root, configFile: false, logLevel: 'error',
    cacheDir: resolve(output, 'vite-cache'),
    server: { host: '127.0.0.1', port: 0 },
  })
  await vite.listen()
  const address = vite.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const origin = 'http://127.0.0.1:' + address.port
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  currentPage = page
  watch(page)
  await page.route(origin + '/__tree-scene', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#000"></body></html>',
  }))
  await page.addInitScript(() => {
    const records = []
    const owners = new WeakMap()
    for (const kind of ['Buffer', 'Texture', 'Program', 'Framebuffer']) {
      const proto = WebGL2RenderingContext.prototype
      const create = proto['create' + kind], remove = proto['delete' + kind]
      proto['create' + kind] = function (...args) {
        const value = create.apply(this, args)
        if (value) {
          let owner = owners.get(this)
          if (!owner) { owner = {}; owners.set(this, owner); records.push(owner) }
          const stats = owner[kind] ||= { created: 0, deleted: 0, live: new Set() }
          stats.created += 1; stats.live.add(value)
        }
        return value
      }
      proto['delete' + kind] = function (value) {
        const stats = owners.get(this)?.[kind]
        if (stats?.live.delete(value)) stats.deleted += 1
        return remove.call(this, value)
      }
    }
    window.__treeGlResources = () => records.map(owner => Object.fromEntries(
      Object.entries(owner).map(([kind, s]) => [kind, { created: s.created, deleted: s.deleted, live: s.live.size }]),
    ))
  })
  await page.goto(origin + '/__tree-scene')
  report.scene.opaque = await page.evaluate(async () => {
    const { createBoneyardWorldRenderer } = await import('/src/game/renderer/boneyard-world-renderer.ts')
    const { createGameSimulation, enterBoneyardWorld } = await import('/src/game/core-server/game-simulation.ts')
    const { createGameSnapshot } = await import('/src/game/host/game-snapshot.ts')
    const { DEFAULT_GAME_SETTINGS } = await import('/src/game/game-settings.ts')
    const { gameRunWorldTick } = await import('/src/game/core-kernels/game-run.ts')
    const viewport = { width: 1600, height: 900, displayScale: 1 }
    const outside = { x: 703, y: 150 }, inside = { x: 702, y: 150 }
    const runId = 'tree-scene-acceptance'
    const loaded = {
      choice: { id: 'tree-proof', name: 'Tree proof', source: 'default' },
      geometrySha256: 'tree-proof', sourceSha256: 'tree-proof', seed: 'tree-proof', runId,
      scene: {
        bounds: { x: 0, y: 0, w: 1600 / 1.35, h: 900 / 1.35 },
        environmentMode: 0, fences: [], name: 'Tree proof',
        objects: [{ atlasEntry: 264, eid: 'tree-0', pos: { x: 500, y: 350 },
          secondaryAtlasEntry: 243, secondaryVariant: 0, secondaryVisible: true,
          sortBias: 0, typeId: 2001, variant: 0 }],
        roads: [], solomonDig: null, spawn: { facingDeg: 0, ...outside }, sprites: [], terrain: [],
      },
    }
    const defaults = createGameSnapshot(enterBoneyardWorld(createGameSimulation({
      local: { discipline: 'arcane', displayName: 'Tree scene proof', element: 'fire' },
    }), loaded), 'local')
    const positionAt = tick => (tick > 1000 && tick <= 1065) || (tick > 1130 && tick <= 1196) ? inside : outside
    const snapshot = (tick, gameOver = false, position = positionAt(tick)) => ({
      ...defaults, tick,
      players: { local: { ...defaults.players.local, position, velocity: { x: 0, y: 0 } } },
      run: gameOver ? { ...defaults.run, phase: 'game-over', gameOverTicks: tick - 1130 } : defaults.run,
    })
    const options = {
      boneyard: loaded, now: () => 1000, devicePixelRatio: 1,
      initialSnapshot: snapshot(1000), modAssets: [], modCatalog: [], playerId: 'local', viewport,
      samplePlayerPositionAtTick: (tick, id) => id === 'local' ? positionAt(tick) : null,
      sampleSceneryActorPosesAtTick: tick => ({
        players: [{ id: 'local', position: positionAt(tick) }], enemies: [], maggots: [], encounter: null,
      }),
    }
    const renderer = await createBoneyardWorldRenderer(options)
    renderer.canvas.id = 'tree-scene-canvas'
    document.body.append(renderer.canvas)
    const gl = renderer.canvas.getContext('webgl2')
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    const pixels = (canvas = renderer.canvas) => {
      const copy = document.createElement('canvas')
      copy.width = canvas.width; copy.height = canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(canvas, 0, 0)
      return context.getImageData(0, 0, copy.width, copy.height).data
    }
    const difference = (a, b) => {
      let changed = 0, delta = 0, max = 0
      for (let i = 0; i < a.length; i += 4) {
        let sum = 0
        for (let c = 0; c < 3; c++) { const d = Math.abs(a[i + c] - b[i + c]); sum += d; delta += d; max = Math.max(max, d) }
        if (sum > 3) changed++
      }
      return { changedPixels: changed, channelDelta: delta, maxChannelDelta: max }
    }
    const frame = () => structuredClone(renderer.canvas.__sdrBoneyardFrame)
    const state = () => ({
      frame: frame(), settings: { ...renderer.canvas.dataset },
      canvas: { width: renderer.canvas.width, height: renderer.canvas.height },
      glError: gl.getError(), resources: window.__treeGlResources(),
    })
    window.__treeScene = {
      renderer, options, snapshot, positionAt, outside, inside, viewport,
      defaults: DEFAULT_GAME_SETTINGS, state, frame, pixels, difference, gameRunWorldTick,
      baseline: pixels(), create: createBoneyardWorldRenderer,
    }
    return { ...state(), originalAtlasRecords: [264, 243],
      gl: { version: gl.getParameter(gl.VERSION), vendor: gl.getParameter(gl.VENDOR),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) } }
  })
  assert.equal(report.scene.opaque.frame.treeCount, 1)
  assert.equal(report.scene.opaque.frame.minTreeAlpha, 1)
  await screenshot(page, 'scene-opaque', '#tree-scene-canvas')
  report.scene.faded = await page.evaluate(() => {
    const p = window.__treeScene
    for (let tick = 1001; tick <= 1065; tick++) p.renderer.render(p.snapshot(tick))
    return { ...p.state(), difference: p.difference(p.baseline, p.pixels()) }
  })
  assert.equal(report.scene.faded.frame.minTreeAlpha, Math.fround(.4))
  assert.ok(report.scene.faded.difference.changedPixels > 500)
  assert.deepEqual(report.scene.faded.frame.sceneryShadows, report.scene.opaque.frame.sceneryShadows)
  assert.equal(report.scene.faded.frame.sceneryShadows.familyQuads['Tree:tree-root-mask'], 1)
  assert.equal(report.scene.faded.frame.sceneryShadows.directionalFamilyCasters.Tree, 1)
  assert.equal(report.scene.faded.frame.complexShadowQuadCount, report.scene.opaque.frame.complexShadowQuadCount)
  assert.deepEqual(report.scene.faded.resources, report.scene.opaque.resources)
  await screenshot(page, 'scene-faded-complex', '#tree-scene-canvas')
  await checkpoint()

  report.scene.pausedGraphicsChanges = []
  for (const variant of [
    { name: 'simple-light', settings: { complexLighting: false } },
    { name: 'complex-light', settings: { complexLighting: true } },
    { name: 'simple-shadow', settings: { complexShadows: false } },
    { name: 'complex-shadow', settings: { complexShadows: true } },
    { name: 'fov125', settings: { cameraFovPercent: 125 } },
    { name: 'fov100', settings: { cameraFovPercent: 100 } },
    { name: 'retina-resize', viewport: { width: 1280, height: 720, displayScale: 1 }, dpr: 2 },
    { name: 'original-resize', viewport: { width: 1600, height: 900, displayScale: 1 }, dpr: 1 },
  ]) {
    const result = await page.evaluate(variant => {
      const p = window.__treeScene
      if (variant.settings) { p.currentSettings = { ...(p.currentSettings || p.defaults), ...variant.settings }; p.renderer.setSettings(p.currentSettings) }
      else p.renderer.resize(variant.viewport, variant.dpr)
      return p.state()
    }, variant)
    assert.equal(result.frame.minTreeAlpha, Math.fround(.4), variant.name + ' must not advance Tree')
    assert.equal(result.frame.treeAlphaMismatchCount, 0)
    assert.equal(result.frame.treeTintMismatchCount, 0)
    assert.equal(result.glError, 0)
    await screenshot(page, 'scene-' + variant.name, '#tree-scene-canvas')
    report.scene.pausedGraphicsChanges.push({ name: variant.name, ...result })
  }
  report.scene.recovered = await page.evaluate(() => {
    const p = window.__treeScene
    for (let tick = 1066; tick <= 1130; tick++) p.renderer.render(p.snapshot(tick))
    return p.state()
  })
  assert.equal(report.scene.recovered.frame.minTreeAlpha, 1)
  await screenshot(page, 'scene-recovered', '#tree-scene-canvas')
  // Worst phase takes 25 scan ticks plus 41 float32 approach stores.
  report.scene.gameOver = await page.evaluate(() => {
    const p = window.__treeScene
    const clocks = []
    for (let tick = 1131; tick <= 1196; tick++) {
      const s = p.snapshot(tick, true)
      clocks.push({ raw: tick, world: p.gameRunWorldTick(tick, s.run) })
      p.renderer.render(s)
    }
    return { ...p.state(), clocks }
  })
  assert.equal(report.scene.gameOver.frame.minTreeAlpha, Math.fround(.4))
  assert.equal(new Set(report.scene.gameOver.clocks.map(x => x.world)).size, 1)
  assert.equal(report.scene.gameOver.clocks[0].world, 1130)
  await screenshot(page, 'scene-game-over-faded', '#tree-scene-canvas')
  report.scene.pausedClock = await page.evaluate(() => {
    const p = window.__treeScene
    for (let index = 0; index < 25; index++) p.renderer.render(p.snapshot(1196, true, p.outside))
    return p.state()
  })
  assert.equal(report.scene.pausedClock.frame.minTreeAlpha, Math.fround(.4))
  report.scene.resumedClock = await page.evaluate(() => {
    const p = window.__treeScene
    for (let tick = 1197; tick <= 1262; tick++) p.renderer.render(p.snapshot(tick, true))
    return p.state()
  })
  assert.equal(report.scene.resumedClock.frame.minTreeAlpha, 1)
  // Warm all buffers in this unchanged camera/settings state, then prove bounded
  // resident GPU allocation over repeated paint. Per-material identity is covered
  // by the independent original-atlas material fixture.
  report.scene.retained = await page.evaluate(() => {
    const p = window.__treeScene
    for (let index = 0; index < 10; index++) p.renderer.render(p.snapshot(1262, true))
    const before = p.state()
    for (let index = 0; index < 60; index++) p.renderer.render(p.snapshot(1262, true))
    return { before, after: p.state() }
  })
  assert.deepEqual(report.scene.retained.after.resources, report.scene.retained.before.resources)
  for (const stage of ['opaque', 'faded', 'recovered', 'gameOver', 'pausedClock', 'resumedClock']) {
    assert.equal(report.scene[stage].glError, 0, stage)
    assert.equal(report.scene[stage].frame.treeAlphaMismatchCount, 0, stage)
    assert.equal(report.scene[stage].frame.treeTintMismatchCount, 0, stage)
  }
  report.scene.destroy = await page.evaluate(() => {
    const p = window.__treeScene
    p.renderer.destroy()
    p.renderer.destroy()
    return { connected: p.renderer.canvas.isConnected, resources: window.__treeGlResources() }
  })
  assert.equal(report.scene.destroy.connected, false)
  for (const resources of report.scene.destroy.resources) {
    for (const kind of ['Texture', 'Buffer', 'Framebuffer']) assert.equal(resources[kind]?.live ?? 0, 0, kind + ' destruction')
  }
  await checkpoint()
  await page.close()
  await vite.close(); vite = null
}

async function compiledJourney() {
  server = await startStaticClientServer({ root: resolve(root, '../backend/wwwroot') })
  const credential = randomBytes(32).toString('base64url')
  host = await startGameHost({
    allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
    resetWhenEmpty: true, snapshotRate: 20,
    log: entry => { if (entry.level === 'error') errors.host.push(entry) },
  })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  currentPage = page; watch(page)
  const requests = []
  page.on('request', r => { const path = new URL(r.url()).pathname; if (/\.(?:js|ts)$/.test(path)) requests.push(path) })
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { kind: 'localhost', credential, url: host.address.url },
  })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await enterElementHub(page, server.origin, 'Fire')
  report.ui.hubScreenshot = await screenshot(page, 'compiled-hub')
  await checkpoint()
  await enterBoneyard(page)
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30000 })
  const canvas = page.locator('.boneyard-world-canvas')
  await canvas.waitFor({ timeout: 30000 })
  report.ui.boneyard = await canvas.evaluate(c => ({
    frame: structuredClone(c.__sdrBoneyardFrame), settings: { ...c.dataset },
    glError: c.getContext('webgl2').getError(),
  }))
  assert.ok(report.ui.boneyard.frame.treeCount > 0)
  // Candidate-only throughput in the real compiled scene. No readback,
  // forced render, screenshots or GL calls occur in the timed interval.
  await page.bringToFront()
  await page.waitForTimeout(1500)
  report.ui.performance = await page.evaluate(async () => {
    const c = document.querySelector('.boneyard-world-canvas')
    const resource = () => {
      const f = c.__sdrBoneyardFrame
      return Object.fromEntries(['frameCount', 'tick', 'residentCount', 'visibleResidentCount',
        'culledResidentCount', 'staticPaintCount', 'treeCount', 'treeProxyResidentCount',
        'treeAlphaMismatchCount', 'treeTintMismatchCount', 'complexShadowActiveMeshCount',
        'complexShadowPooledMeshCount', 'complexShadowAllocatedQuadCapacity',
        'regionLightPhysicalSide', 'cameraX', 'cameraY', 'cameraZoom',
        'weatherDropCount', 'enemyCount'].map(key => [key, f[key]]))
    }
    const before = resource(), startedAt = performance.now()
    const visibilityBefore = document.visibilityState
    let previousCount = before.frameCount, previousAt = startedAt
    const advancing = [], rafIntervals = []
    let lastRaf = null
    await new Promise(resolve => {
      const sample = at => {
        if (lastRaf !== null) rafIntervals.push(at - lastRaf)
        lastRaf = at
        const count = c.__sdrBoneyardFrame.frameCount
        if (count > previousCount) {
          advancing.push({ intervalMs: at - previousAt, frames: count - previousCount })
          previousAt = at; previousCount = count
        }
        if (at - startedAt >= 5000) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const endedAt = performance.now(), after = resource()
    const distribution = values => {
      const sorted = [...values].sort((a, b) => a - b)
      const percentile = p => sorted[Math.floor((sorted.length - 1) * p)] ?? null
      return { samples: sorted.length, minimum: sorted[0] ?? null, median: percentile(.5),
        p95: percentile(.95), p99: percentile(.99), maximum: sorted.at(-1) ?? null,
        mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null }
    }
    const rect = c.getBoundingClientRect()
    const gl = c.getContext('webgl2'), debug = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      scope: 'Candidate-only idle compiled Boneyard; no GPU readback or forced render in timed interval',
      elapsedMs: endedAt - startedAt, before, after,
      advancingRendererFrames: after.frameCount - before.frameCount,
      observedRendererFramesPerSecond: (after.frameCount - before.frameCount) * 1000 / (endedAt - startedAt),
      advancingFrameIntervalsMs: distribution(advancing.map(x => x.intervalMs)),
      observedFramesPerAdvance: distribution(advancing.map(x => x.frames)),
      rafIntervalsMs: distribution(rafIntervals),
      visibilityBefore, visibilityAfter: document.visibilityState, documentHasFocus: document.hasFocus(),
      viewport: { cssWidth: rect.width, cssHeight: rect.height, backingWidth: c.width, backingHeight: c.height,
        dpr: devicePixelRatio, logicalWidth: Number(c.dataset.viewportWidth), logicalHeight: Number(c.dataset.viewportHeight) },
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      glErrorAfter: gl.getError(),
      heapAfter: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null,
    }
  })
  const perf = report.ui.performance
  const visible = perf.before
  const worldBounds = { x: visible.cameraX - perf.viewport.logicalWidth / (2 * visible.cameraZoom),
    y: visible.cameraY - perf.viewport.logicalHeight / (2 * visible.cameraZoom),
    w: perf.viewport.logicalWidth / visible.cameraZoom, h: perf.viewport.logicalHeight / visible.cameraZoom }
  perf.visibleOriginalTreeInputs = host.loadedBoneyard().scene.objects
    .filter(o => o.typeId === 2001 && o.variant <= 5 && o.secondaryVisible)
    .map(o => ({ eid: o.eid, mainVariant: o.variant, position: o.pos,
      secondaryVariant: o.secondaryVariant, secondaryVisible: o.secondaryVisible }))
    .filter(tree => nativeTreeOverlapsCamera(tree, worldBounds))
  assert.ok(perf.visibleOriginalTreeInputs.length > 0)
  assert.ok(perf.advancingRendererFrames > 0)
  assert.equal(perf.visibilityBefore, 'visible')
  assert.equal(perf.visibilityAfter, 'visible')
  assert.equal(perf.glErrorAfter, 0)
  assert.equal(perf.after.staticPaintCount, perf.before.staticPaintCount)
  assert.equal(perf.after.treeAlphaMismatchCount, 0)
  assert.equal(perf.after.treeTintMismatchCount, 0)
  report.ui.boneyardScreenshot = await screenshot(page, 'compiled-boneyard')
  await checkpoint()
  const beforeMove = host.state().tick
  await page.keyboard.down('d')
  await page.waitForTimeout(550)
  await page.keyboard.up('d')
  assert.ok(host.state().tick > beforeMove)
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 15000 })
  const pausedTick = host.state().tick
  await page.waitForTimeout(350)
  assert.equal(host.state().tick, pausedTick, 'real Boneyard host clock must pause')
  report.ui.pause = { pausedTick, afterWaitTick: host.state().tick, screenshot: await screenshot(page, 'compiled-paused') }
  await pause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  const settings = page.locator('.game-settings-dialog')
  await settings.waitFor()
  const fov = settings.getByRole('slider', { name: 'CAMERA FOV' })
  await fov.fill('125'); await fov.dispatchEvent('input'); await fov.dispatchEvent('change')
  await settings.getByRole('button', { name: 'TWEAK GAME' }).click()
  const lighting = settings.getByRole('button', { name: 'COMPLEX LIGHTING', exact: true })
  assert.equal(await lighting.getAttribute('aria-pressed'), 'true')
  await lighting.click()
  report.ui.simpleLighting = await canvas.evaluate(c => ({ frame: structuredClone(c.__sdrBoneyardFrame), settings: { ...c.dataset } }))
  assert.equal(report.ui.simpleLighting.settings.complexLighting, 'false')
  report.ui.settingsScreenshot = await screenshot(page, 'compiled-simple-light-settings')
  await lighting.click()
  await settings.getByRole('button', { name: 'BACK', exact: true }).click()
  await settings.getByRole('button', { name: 'DONE', exact: true }).click()
  await settings.waitFor({ state: 'hidden' })
  await page.waitForFunction(tick => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.tick > tick, pausedTick, { timeout: 15000 })
  await page.setViewportSize({ width: 1280, height: 720 })
  // gameViewportLayout keeps 1600x900 logical space below the native minimum.
  await page.waitForFunction(() => {
    const c = document.querySelector('.boneyard-world-canvas')
    return c?.dataset.viewportWidth === '1600'
      && Math.abs(c.getBoundingClientRect().width - 1280) < 1
  })
  report.ui.resized = await canvas.evaluate(c => ({
    frame: structuredClone(c.__sdrBoneyardFrame), settings: { ...c.dataset },
    canvas: { width: c.width, height: c.height, displayedWidth: c.getBoundingClientRect().width, displayedHeight: c.getBoundingClientRect().height }, glError: c.getContext('webgl2').getError(),
  }))
  report.ui.resizedScreenshot = await screenshot(page, 'compiled-resumed-resized')
  report.ui.requests = [...new Set(requests)]
  assert.ok(report.ui.requests.some(path => /^\/assets\/.*\.js$/.test(path)))
  assert.equal(report.ui.requests.some(path => path.startsWith('/src/')), false)
  assert.equal(report.ui.boneyard.glError, 0)
  assert.equal(report.ui.resized.glError, 0)
  await checkpoint()
  await page.close()
  await host.close(); host = null
  await server.close(); server = null
}

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { hubOwnedPerkSlotRect } from '../src/game/renderer/hub-inventory-render-contract.ts'

const playerId = 'stats-scroll-contract'
const config = { displayName: 'Scroll', discipline: 'arcane', element: 'ether' }
const player = createGameSnapshot(createGameSimulation({ [playerId]: config }), playerId).players[playerId]
const model = {
  belt: player.belt, config, economy: player.economy, progression: player.progression,
  dragging: null, dyeModal: null, flybys: [], inspection: null,
  kind: 'inventory', runSummary: null, notice: null, pressedControl: null,
  sackPath: [], sackTransition: null, selection: null, statsPage: 0,
}
const root = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({ root, configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
await vite.listen()
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`
const errors = { console: [], page: [], responses: [], requests: [] }
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH, headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
  await page.route(`${origin}/__stats_scroll`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }))
  await page.goto(`${origin}/__stats_scroll`)
  const samples = await page.evaluate(async model => {
    const { createHubInventoryRenderer } = await import('/src/game/renderer/hub-inventory-renderer.ts')
    const renderer = await createHubInventoryRenderer()
    let clock = 1_000
    const originalNow = performance.now.bind(performance)
    Object.defineProperty(performance, 'now', { configurable: true, value: () => clock })
    let detach
    try {
      renderer.setModel(model)
      detach = renderer.mount(document.body)
      const context = renderer.canvas.getContext('webgl2') ?? renderer.canvas.getContext('webgl')
      if (!context) throw new Error('Actual WebGL pixels are required')
      const capture = () => {
        const pixels = new Uint8Array(320 * 320 * 4)
        context.readPixels(50, 491, 320, 320, context.RGBA, context.UNSIGNED_BYTE, pixels)
        return Array.from(pixels)
      }
      renderer.render(clock, 1)
      const before = capture()
      renderer.setModel({ ...model, statsPage: 1 })
      renderer.render(clock, 1)
      const zeroTicks = capture()
      clock += 10
      renderer.render(clock, 1)
      const firstTick = capture()
      renderer.setModel({ ...model, statsPage: 1, economy: { ...model.economy, revision: model.economy.revision + 1 } })
      renderer.render(clock, 1)
      const equalTargetRefresh = capture()
      clock = 1_370
      renderer.render(clock, 1)
      const settled = capture()
      renderer.setModel({ ...model, statsPage: 0 })
      renderer.render(clock, 1)
      const reverseZeroTicks = capture()
      clock += 10
      renderer.render(clock, 1)
      const reverseFirstTick = capture()
      return { before, zeroTicks, firstTick, equalTargetRefresh, settled, reverseZeroTicks, reverseFirstTick }
    } finally {
      detach?.()
      renderer.destroy()
      Object.defineProperty(performance, 'now', { configurable: true, value: originalNow })
    }
  }, model)
  const hashes = Object.fromEntries(Object.entries(samples).map(([key, pixels]) => [
    key, createHash('sha256').update(Buffer.from(pixels)).digest('hex'),
  ]))
  assert.ok(samples.before.some((value, index) => index % 4 !== 3 && value !== 0), 'Stats must paint visible pixels')
  assert.equal(hashes.zeroTicks, hashes.before, 'Changing Stats page must not snap pixels before its first native tick')
  assert.notEqual(hashes.firstTick, hashes.before, 'The first native tick must move visible Stats content')
  assert.notEqual(hashes.firstTick, hashes.settled, 'The first tick must not jump to the settled page')
  assert.equal(hashes.equalTargetRefresh, hashes.firstTick, 'A live equal-target refresh must preserve displayed Stats pixels')
  assert.equal(hashes.reverseZeroTicks, hashes.settled, 'Retargeting must preserve the displayed pixels')
  assert.notEqual(hashes.reverseFirstTick, hashes.settled, 'Reversal must move on its next native tick')
  const hoverProbes = await page.evaluate(async ({ model, rects }) => {
    const { createHubInventoryRenderer } = await import('/src/game/renderer/hub-inventory-renderer.ts')
    const renderer = await createHubInventoryRenderer()
    const originalNow = performance.now.bind(performance)
    let clock = 10_000
    Object.defineProperty(performance, 'now', { configurable: true, value: () => clock })
    const selectors = [27, 6, 27, 0, 1, 2, 3, 4, 5]
    const economy = { ...model.economy, ownedPerkSelectors: selectors, tonicPurchases: 2, charmCapacity: 9 }
    const variants = [{ ...model, economy }, { ...model, economy, kind: 'service', trader: 'fomentius',
      dowsingReferenceItem: null, inventorySelection: null, selectedItemId: null, selectedOwner: null }]
    const probes = []
    let detach
    try {
      const gl = renderer.canvas.getContext('webgl2') ?? renderer.canvas.getContext('webgl')
      const capture = () => {
        const pixels = new Uint8Array(1600 * 900 * 4)
        gl.readPixels(0, 0, 1600, 900, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        return pixels
      }
      const differenceBounds = (a, b) => {
        let left = 1600, right = -1, top = 900, bottom = -1
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue
          const pixel = i / 4, x = pixel % 1600, y = 899 - Math.floor(pixel / 1600)
          left = Math.min(left, x); right = Math.max(right, x)
          top = Math.min(top, y); bottom = Math.max(bottom, y)
        }
        return right < 0 ? null : { left, right, top, bottom }
      }
      for (const variant of variants) {
        clock += 10_000
        renderer.setModel({ ...variant, statsPage: 1 })
        detach = renderer.mount(document.body)
        renderer.render(clock, 1)
        renderer.setModel({ ...variant, statsPage: 2 })
        clock += 100
        for (const [index, selector] of selectors.entries()) {
          renderer.setModel({ ...variant, statsPage: 2, inspection: null })
          const { statsOffset } = renderer.render(clock, 1)
          const reference = capture()
          renderer.setModel({ ...variant, statsPage: 2, inspection: { kind: 'owned-perk', index, selector } })
          renderer.render(clock, 1)
          const bounds = differenceBounds(reference, capture())
          const rect = rects[index]
          probes.push({ kind: variant.kind, index, bounds, expectedY: rect[1] + rect[3] / 2 + 640 - statsOffset })
        }
        renderer.setModel({ ...variant, statsPage: 1, inspection: { kind: 'owned-perk', index: 0, selector: 27 } })
        clock += 30
        const { statsOffset } = renderer.render(clock, 1)
        const movingTooltip = capture()
        renderer.setModel({ ...variant, statsPage: 1, inspection: null })
        renderer.render(clock, 1)
        probes.push({ kind: variant.kind, index: 0, reversal: true,
          bounds: differenceBounds(capture(), movingTooltip), expectedY: rects[0][1] + rects[0][3] / 2 + 640 - statsOffset })
        renderer.setModel({ ...variant, statsPage: 0, inspection: { kind: 'owned-perk', index: 0, selector: 27 } })
        clock += 1_000
        renderer.render(clock, 1)
        const clipped = capture()
        renderer.setModel({ ...variant, statsPage: 0, inspection: null })
        renderer.render(clock, 1)
        probes.push({ kind: variant.kind, clipped: true, bounds: differenceBounds(capture(), clipped) })
        detach(); detach = undefined
      }
      return probes
    } finally {
      detach?.()
      renderer.destroy()
      Object.defineProperty(performance, 'now', { configurable: true, value: originalNow })
    }
  }, { model, rects: Array.from({ length: 9 }, (_, index) => hubOwnedPerkSlotRect(index)) })
  for (const probe of hoverProbes) {
    if (probe.clipped) assert.equal(probe.bounds, null, 'A clipped perk cannot paint a stale tooltip')
    else {
      assert.ok(probe.bounds, 'A visible perk must paint its tooltip')
      assert.ok(Math.abs((probe.bounds.top + probe.bounds.bottom) / 2 - probe.expectedY) <= 1,
        `Perk tooltip follows its moving cell: ${JSON.stringify(probe)}`)
    }
  }
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [] })
  console.log(JSON.stringify({ status: 'ok', hashes, hoverProbes, errors, browser: browser.version(),
    qualification: 'Actual public renderer/WebGL pixels with a declared numeric clock; real scene journey is separate.' }))
} finally {
  await browser?.close()
  await vite.close()
}

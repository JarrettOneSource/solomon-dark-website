import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const opaqueScreenshot = process.env.SDR_TREE_OPAQUE_SCREENSHOT
  || '/tmp/solomon-dark-tree-opaque-20260814.png'
const fadedScreenshot = process.env.SDR_TREE_FADED_SCREENSHOT
  || '/tmp/solomon-dark-tree-faded-20260814.png'
const recoveredScreenshot = process.env.SDR_TREE_RECOVERED_SCREENSHOT
  || '/tmp/solomon-dark-tree-recovered-20260814.png'

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1600, height: 900 },
  })
  const consoleErrors = []
  const failedResponses = []
  const pageErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })

  await page.route(`${baseUrl}/__tree-occlusion-proof`, (route) => route.fulfill({
    body: '<!doctype html><html><body></body></html>',
    contentType: 'text/html',
    status: 200,
  }))
  await page.goto(`${baseUrl}/__tree-occlusion-proof`, {
    waitUntil: 'domcontentloaded',
  })
  const opaque = await page.evaluate(async () => {
    document.body.replaceChildren()
    document.body.style.background = '#000'
    document.body.style.margin = '0'

    const [rendererModule, playerModule, spellModule] = await Promise.all([
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/core-kernels/primary-spells.ts'),
    ])
    const viewport = { displayScale: 1, height: 900, width: 1600 }
    const runId = 'tree-occlusion-browser-proof'
    const treePosition = { x: 500, y: 350 }
    const outside = { x: 703, y: 150 }
    const inside = { x: 702, y: 150 }
    const behindTree = { x: 500, y: 100 }
    const loaded = {
      choice: { id: 'tree-proof', name: 'Tree proof', source: 'default' },
      geometrySha256: 'tree-proof',
      runId,
      seed: 'tree-proof',
      sourceSha256: 'tree-proof',
      scene: {
        bounds: {
          h: viewport.height / 1.35,
          w: viewport.width / 1.35,
          x: 0,
          y: 0,
        },
        environmentMode: 0,
        fences: [],
        name: 'Tree proof',
        objects: [{
          atlasEntry: 264,
          eid: 'tree-0',
          pos: treePosition,
          secondaryAtlasEntry: 243,
          secondaryVariant: 0,
          secondaryVisible: true,
          sortBias: 0,
          typeId: 2001,
          variant: 0,
        }],
        roads: [],
        solomonDig: null,
        spawn: { facingDeg: 0, ...outside },
        sprites: [],
        terrain: [],
      },
    }
    const snapshotAt = (tick, position) => ({
      hostPlayerId: 'local',
      players: {
        local: {
          config: {
            discipline: 'arcane',
            displayName: 'Tree Probe',
            element: 'fire',
          },
          footstepTick: 0,
          gaitDegrees: 0,
          headingIndex: 0,
          position,
          primaryCast: playerModule.createIdlePlayerPrimaryCast(),
          velocity: { x: 0, y: 0 },
          walkCyclePrimary: 0,
        },
      },
      primarySpells: spellModule.createPrimarySpellSimulation(),
      tick,
      world: { gateLeaves: [], kind: 'boneyard', runId },
    })
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: snapshotAt(1_000, outside),
      playerId: 'local',
      viewport,
    })
    renderer.canvas.id = 'tree-probe'
    document.body.append(renderer.canvas)

    const capture = () => {
      const copy = document.createElement('canvas')
      copy.width = renderer.canvas.width
      copy.height = renderer.canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(renderer.canvas, 0, 0)
      return context.getImageData(0, 0, copy.width, copy.height).data
    }
    const difference = (first, second) => {
      let changedPixels = 0
      let channelDelta = 0
      let maxChannelDelta = 0
      for (let y = 0; y < 650; y += 1) {
        for (let x = 300; x < 1_050; x += 1) {
          if (x >= 875 && x <= 1_015 && y >= 100 && y <= 300) continue
          const offset = (y * renderer.canvas.width + x) * 4
          let pixelDelta = 0
          for (let channel = 0; channel < 3; channel += 1) {
            const delta = Math.abs(first[offset + channel] - second[offset + channel])
            pixelDelta += delta
            channelDelta += delta
            maxChannelDelta = Math.max(maxChannelDelta, delta)
          }
          if (pixelDelta > 3) changedPixels += 1
        }
      }
      return { changedPixels, channelDelta, maxChannelDelta }
    }
    const frame = () => ({ ...renderer.canvas.__sdrBoneyardFrame })
    window.__treeOcclusionProbe = {
      baseline: capture(),
      capture,
      difference,
      frame,
      behindTree,
      inside,
      outside,
      renderer,
      snapshotAt,
    }
    return {
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      frame: frame(),
      renderer: renderer.canvas.dataset.gameRenderer,
      rendererName: renderer.canvas.dataset.rendererName,
    }
  })

  const canvas = page.locator('#tree-probe')
  await canvas.screenshot({ path: opaqueScreenshot })
  assert.equal(opaque.renderer, 'pixi-webgl')
  assert.match(opaque.rendererName.toLowerCase(), /webgl/)
  assert.equal(opaque.context, 'webgl2')
  assert.equal(opaque.frame.treeCount, 1)
  assert.equal(opaque.frame.treeProxyResidentCount, 1)
  assert.equal(opaque.frame.fadedTreeCount, 0)
  assert.equal(opaque.frame.minTreeAlpha, 1)
  assert.equal(opaque.frame.treeAlphaMismatchCount, 0)
  assert.equal(opaque.frame.treeTintMismatchCount, 0)
  assert.ok(opaque.frame.minTreeLightScalar > 0.2)
  assert.ok(opaque.frame.minTreeLightScalar < 0.6)

  const faded = await page.evaluate(() => {
    const probe = window.__treeOcclusionProbe
    probe.renderer.render(probe.snapshotAt(1_065, probe.inside))
    const pixels = probe.capture()
    return {
      difference: probe.difference(probe.baseline, pixels),
      frame: probe.frame(),
    }
  })
  assert.equal(faded.frame.fadedTreeCount, 1)
  assert.equal(faded.frame.minTreeAlpha, 0.4)
  assert.equal(faded.frame.treeAlphaMismatchCount, 0)
  assert.equal(faded.frame.treeTintMismatchCount, 0)
  assert.ok(Math.abs(
    faded.frame.minTreeLightScalar - opaque.frame.minTreeLightScalar,
  ) < 0.01)
  assert.ok(faded.difference.changedPixels > 500)
  assert.ok(faded.difference.channelDelta > 10_000)
  assert.ok(faded.difference.maxChannelDelta > 10)

  const behindTree = await page.evaluate(() => {
    const probe = window.__treeOcclusionProbe
    probe.renderer.render(probe.snapshotAt(1_065, probe.behindTree))
    return probe.frame()
  })
  await canvas.screenshot({ path: fadedScreenshot })
  assert.equal(behindTree.fadedTreeCount, 1)
  assert.equal(behindTree.minTreeAlpha, 0.4)
  assert.equal(behindTree.treeAlphaMismatchCount, 0)
  assert.equal(behindTree.treeTintMismatchCount, 0)

  const recovered = await page.evaluate(() => {
    const probe = window.__treeOcclusionProbe
    probe.renderer.render(probe.snapshotAt(1_130, probe.outside))
    const pixels = probe.capture()
    return {
      difference: probe.difference(probe.baseline, pixels),
      frame: probe.frame(),
    }
  })
  await canvas.screenshot({ path: recoveredScreenshot })
  assert.equal(recovered.frame.fadedTreeCount, 0)
  assert.equal(recovered.frame.minTreeAlpha, 1)
  assert.equal(recovered.frame.treeAlphaMismatchCount, 0)
  assert.equal(recovered.frame.treeTintMismatchCount, 0)
  assert.ok(
    recovered.difference.changedPixels < faded.difference.changedPixels / 5,
  )

  await page.evaluate(() => window.__treeOcclusionProbe.renderer.destroy())
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    opaque,
    faded,
    behindTree,
    recovered,
    screenshots: {
      faded: fadedScreenshot,
      opaque: opaqueScreenshot,
      recovered: recoveredScreenshot,
    },
  })}\n`)
} finally {
  await browser.close()
}

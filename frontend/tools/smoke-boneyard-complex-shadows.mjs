import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const leftScreenshot = process.env.SDR_SHADOW_LEFT_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-left-20260814.png'
const rightScreenshot = process.env.SDR_SHADOW_RIGHT_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-right-20260814.png'
const generatedScreenshot = process.env.SDR_SHADOW_GENERATED_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-generated-20260814.png'

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: 900, width: 1600 },
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

  await page.route(`${baseUrl}/__complex-shadow-proof`, (route) => route.fulfill({
    body: '<!doctype html><html><body></body></html>',
    contentType: 'text/html',
    status: 200,
  }))
  await page.goto(`${baseUrl}/__complex-shadow-proof`, {
    waitUntil: 'domcontentloaded',
  })
  const left = await page.evaluate(async () => {
    document.body.replaceChildren()
    document.body.style.background = '#000'
    document.body.style.margin = '0'
    const [rendererModule, playerModule, shadowModule, spellModule] = await Promise.all([
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/renderer/boneyard-complex-shadows.ts'),
      import('/src/game/core-kernels/primary-spells.ts'),
    ])
    const viewport = { displayScale: 1, height: 900, width: 1600 }
    const runId = 'complex-shadow-browser-proof'
    const loaded = {
      choice: { id: 'shadow-proof', name: 'Shadow proof', source: 'default' },
      geometrySha256: 'shadow-proof',
      runId,
      seed: 'shadow-proof',
      sourceSha256: 'shadow-proof',
      scene: {
        bounds: {
          h: viewport.height / 1.35,
          w: viewport.width / 1.35,
          x: 0,
          y: 0,
        },
        environmentMode: 0,
        fences: [{
          eid: 'fence-0',
          points: [{ x: 450, y: 430 }, { x: 650, y: 430 }],
          segmentCode: 0,
          style: 0,
          typeId: 3005,
        }],
        name: 'Complex shadow proof',
        objects: [
          {
            atlasEntry: 264,
            eid: 'tree-0',
            pos: { x: 500, y: 250 },
            secondaryAtlasEntry: 243,
            secondaryVariant: 0,
            secondaryVisible: true,
            sortBias: 0,
            typeId: 2001,
            variant: 0,
          },
          {
            atlasEntry: 97,
            eid: 'gravestone-0',
            overlayAtlasEntry: 88,
            overlayVariant: 0,
            pos: { x: 600, y: 350 },
            sortBias: 0,
            typeId: 2029,
            variant: 0,
          },
        ],
        roads: [],
        solomonDig: null,
        spawn: { facingDeg: 90, x: 275, y: 330 },
        sprites: [],
        terrain: [],
      },
    }
    const snapshotAt = (tick, position, headingIndex) => ({
      hostPlayerId: 'local',
      players: {
        local: {
          config: {
            discipline: 'arcane',
            displayName: 'Shadow Probe',
            element: 'fire',
          },
          footstepTick: 0,
          gaitDegrees: headingIndex * 15,
          headingIndex,
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
      initialSnapshot: snapshotAt(1_000, { x: 275, y: 330 }, 6),
      playerId: 'local',
      viewport,
    })
    renderer.canvas.id = 'complex-shadow-probe'
    document.body.append(renderer.canvas)
    const capture = () => {
      const copy = document.createElement('canvas')
      copy.width = renderer.canvas.width
      copy.height = renderer.canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(renderer.canvas, 0, 0)
      return context.getImageData(0, 0, copy.width, copy.height).data
    }
    window.__complexShadowProbe = {
      capture,
      leftPixels: capture(),
      renderer,
      rightSnapshot: snapshotAt(1_010, { x: 800, y: 330 }, 18),
    }
    const treeOutline = shadowModule.nativeBoneyardTreeComplexShadowOutline(0)
    return {
      complexShadows: renderer.canvas.dataset.complexShadows,
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      frame: { ...renderer.canvas.__sdrBoneyardFrame },
      renderer: renderer.canvas.dataset.gameRenderer,
      rendererName: renderer.canvas.dataset.rendererName,
      treeComplexShadowOutline: renderer.canvas.dataset.treeComplexShadowOutline,
      treeOutline: {
        maxX: Math.max(...treeOutline.map(({ x }) => x)),
        maxY: Math.max(...treeOutline.map(({ y }) => y)),
        minX: Math.min(...treeOutline.map(({ x }) => x)),
        minY: Math.min(...treeOutline.map(({ y }) => y)),
        pointCount: treeOutline.length,
      },
    }
  })

  const canvas = page.locator('#complex-shadow-probe')
  await canvas.screenshot({ path: leftScreenshot })
  assert.equal(left.renderer, 'pixi-webgl')
  assert.match(left.rendererName.toLowerCase(), /webgl/)
  assert.equal(left.context, 'webgl2')
  assert.equal(left.complexShadows, 'native-directional-edges')
  assert.equal(left.treeComplexShadowOutline, 'native-main-variant-table')
  assert.deepEqual(left.treeOutline, {
    maxX: 18,
    maxY: 12,
    minX: -5,
    minY: -8,
    pointCount: 4,
  })
  assert.ok(left.frame.complexShadowCasterCount >= 3)
  assert.ok(left.frame.complexShadowRecordCount >= 3)
  assert.ok(left.frame.complexShadowQuadCount >= left.frame.complexShadowCasterCount)

  const right = await page.evaluate(() => {
    const probe = window.__complexShadowProbe
    probe.renderer.render(probe.rightSnapshot)
    const rightPixels = probe.capture()
    let changedPixels = 0
    let channelDelta = 0
    for (let offset = 0; offset < rightPixels.length; offset += 4) {
      const delta = (
        Math.abs(rightPixels[offset] - probe.leftPixels[offset])
        + Math.abs(rightPixels[offset + 1] - probe.leftPixels[offset + 1])
        + Math.abs(rightPixels[offset + 2] - probe.leftPixels[offset + 2])
      )
      if (delta > 3) changedPixels += 1
      channelDelta += delta
    }
    return {
      changedPixels,
      channelDelta,
      frame: { ...probe.renderer.canvas.__sdrBoneyardFrame },
    }
  })
  await canvas.screenshot({ path: rightScreenshot })
  assert.ok(right.frame.complexShadowCasterCount >= 3)
  assert.ok(right.frame.complexShadowRecordCount >= 3)
  assert.ok(right.frame.complexShadowQuadCount >= right.frame.complexShadowCasterCount)
  assert.ok(right.changedPixels > 20_000)
  assert.ok(right.channelDelta > 100_000)

  await page.evaluate(() => {
    window.__complexShadowProbe.renderer.destroy()
    document.body.replaceChildren()
  })

  const generated = await page.evaluate(async () => {
    const [
      encounterModule,
      rendererModule,
      playerModule,
      spellModule,
      templatesModule,
    ] = await Promise.all([
      import('/src/game/core-kernels/boneyard-encounter.ts'),
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/core-kernels/primary-spells.ts'),
      import('/src/game/host/native-generated-boneyards.ts'),
    ])
    const viewport = { displayScale: 1, height: 900, width: 1600 }
    const template = templatesModule.NATIVE_GENERATED_BONEYARDS[0]
    const runId = 'generated-complex-shadow-browser-proof'
    const headingIndex = Math.round(template.scene.spawn.facingDeg / 15)
    const encounter = template.scene.solomonDig
      ? encounterModule.createSolomonEncounter(
          template.scene.solomonDig,
          'generated-shadow-proof',
        )
      : undefined
    const snapshotAt = (tick) => ({
      hostPlayerId: 'local',
      players: {
        local: {
          config: {
            discipline: 'arcane',
            displayName: 'Generated Shadow Probe',
            element: 'fire',
          },
          footstepTick: 0,
          gaitDegrees: headingIndex * 15,
          headingIndex,
          position: {
            x: template.scene.spawn.x,
            y: template.scene.spawn.y,
          },
          primaryCast: playerModule.createIdlePlayerPrimaryCast(),
          velocity: { x: 0, y: 0 },
          walkCyclePrimary: 0,
        },
      },
      primarySpells: spellModule.createPrimarySpellSimulation(),
      tick,
      world: {
        ...(encounter ? { encounter } : {}),
        gateLeaves: [],
        kind: 'boneyard',
        runId,
      },
    })
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: {
        choice: {
          id: 'generated-shadow-proof',
          name: template.scene.name,
          source: 'default',
        },
        geometrySha256: template.geometrySha256,
        runId,
        seed: 'generated-shadow-proof',
        sourceSha256: template.sourceSha256,
        scene: template.scene,
      },
      devicePixelRatio: 1,
      initialSnapshot: snapshotAt(2_000),
      playerId: 'local',
      viewport,
    })
    renderer.canvas.id = 'generated-complex-shadow-probe'
    document.body.append(renderer.canvas)
    const renderDurations = []
    for (let frame = 1; frame <= 30; frame += 1) {
      await new Promise(requestAnimationFrame)
      const renderStart = performance.now()
      renderer.render(snapshotAt(2_000 + frame))
      renderDurations.push(performance.now() - renderStart)
    }
    await new Promise(requestAnimationFrame)
    window.__generatedComplexShadowRenderer = renderer
    return {
      averageRenderMs: renderDurations.reduce((sum, value) => sum + value, 0)
        / renderDurations.length,
      frame: { ...renderer.canvas.__sdrBoneyardFrame },
    }
  })
  await page.locator('#generated-complex-shadow-probe').screenshot({
    path: generatedScreenshot,
  })
  assert.ok(generated.frame.staticLayerCount > 100)
  assert.ok(generated.frame.visibleMainLayerCount > 0)
  assert.ok(generated.frame.complexShadowCasterCount > 0)
  assert.ok(generated.frame.complexShadowRecordCount > 0)
  assert.ok(generated.frame.complexShadowQuadCount > 0)
  assert.ok(Number.isFinite(generated.averageRenderMs))
  assert.ok(generated.averageRenderMs > 0)
  await page.evaluate(() => window.__generatedComplexShadowRenderer.destroy())
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])

  process.stdout.write(`${JSON.stringify({
    left,
    generated,
    right,
    screenshots: {
      generated: generatedScreenshot,
      left: leftScreenshot,
      right: rightScreenshot,
    },
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
}

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const leftScreenshot = process.env.SDR_SHADOW_LEFT_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-left-20260814.png'
const rightScreenshot = process.env.SDR_SHADOW_RIGHT_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-right-20260814.png'
const generatedScreenshot = process.env.SDR_SHADOW_GENERATED_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-generated-20260814.png'
const expectedShadowImplementation = process.env.SDR_EXPECT_SHADOW_IMPLEMENTATION
  || 'native-indexed-owner-mesh'
const generatedWarmupFrames = boundedInteger(
  process.env.SDR_SHADOW_WARMUP_FRAMES || '30',
  'SDR_SHADOW_WARMUP_FRAMES',
  0,
  300,
)
const generatedMeasurementFrames = boundedInteger(
  process.env.SDR_SHADOW_MEASUREMENT_FRAMES || '180',
  'SDR_SHADOW_MEASUREMENT_FRAMES',
  1,
  1_800,
)
const generatedStartupIterations = boundedInteger(
  process.env.SDR_SHADOW_STARTUP_ITERATIONS || '0',
  'SDR_SHADOW_STARTUP_ITERATIONS',
  0,
  100,
)

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
    const [airModule, economyModule, rendererModule, playerModule, secondaryModule, shadowModule, spellModule] = await Promise.all([
      import('/src/game/renderer/primary-spell-air-native.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/core-kernels/native-secondary-abilities.ts'),
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
    const longAir = {
      ageTicks: 0,
      birthTick: 1_000,
      direction: { x: 1, y: 0 },
      endpoint: { x: 725, y: 330 },
      id: 4_501,
      kind: 'air',
      midpoint: { x: 500, y: 330 },
      origin: { x: 275, y: 330 },
      ownerId: 'local',
      targetId: null,
      lightRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
      underpowered: false,
      variant: 0,
      worldKey: `boneyard:${runId}`,
    }
    const snapshotAt = (tick, position, headingIndex, includeLongAir = false) => {
      const primarySpells = spellModule.createPrimarySpellSimulation()
      if (includeLongAir) primarySpells.transients.push(longAir)
      return {
        hostPlayerId: 'local',
        players: {
          local: {
            config: {
              discipline: 'arcane',
              displayName: 'Shadow Probe',
              element: 'air',
            },
            economy: economyModule.createHubEconomy(0x5299a0),
            footstepTick: 0,
            gaitDegrees: headingIndex * 15,
            headingIndex,
            lighting: {
              driveActive: false,
              lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
              overlayEffectPhase: 0,
            },
            position,
            primaryCast: playerModule.createIdlePlayerPrimaryCast(),
            progression: {
              activeWeldBuildId: null,
              coldSlowTicksRemaining: 0,
              currentHealth: 50,
              currentMana: 100,
              deathEpoch: 0,
              deathTick: 0,
              dazzleTicksRemaining: 0,
              experience: 0,
              learnedSkills: [],
              level: 1,
              lifeState: 'alive',
              maximumHealth: 50,
              maximumMana: 100,
              nextThreshold: 100,
              pendingOffer: null,
              poisonDamagePerTick: 0,
              poisonTicksRemaining: 0,
              previousThreshold: 0,
              revision: 0,
            },
            velocity: { x: 0, y: 0 },
            walkCyclePrimary: 0,
          },
        },
        primarySpells,
        secondaryAbilities: secondaryModule.createNativeSecondarySimulation(),
        run: {
          eligiblePlayerIds: ['local'],
          gameOverEventId: 0,
          gameOverTicks: 0,
          lastCompletedRunId: null,
          nextGameOverEventId: 1,
          phase: 'active',
          runId,
        },
        tick,
        world: {
          deathEffects: [],
          encounter: null,
          enemies: [],
          enemyEvents: [],
          enemyProjectileEffects: [],
          enemyProjectiles: [],
          gateLeaves: [],
          kind: 'boneyard',
          lanternLightRegistration: null,
          mageLightningPulses: [],
          maggots: [],
          runId,
          waves: null,
        },
      }
    }
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: snapshotAt(1_000, { x: 275, y: 330 }, 6, true),
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
      longAirPathLightCount: typeof airModule.buildNativeAirPathLightSources === 'function'
        ? airModule.buildNativeAirPathLightSources(longAir).length
        : 0,
      renderer,
      rightSnapshot: snapshotAt(1_010, { x: 800, y: 330 }, 18),
    }
    const treeOutline = shadowModule.nativeBoneyardTreeComplexShadowOutline(0)
    return {
      complexShadows: renderer.canvas.dataset.complexShadows,
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      frame: { ...renderer.canvas.__sdrBoneyardFrame },
      longAirPathLightCount: window.__complexShadowProbe.longAirPathLightCount,
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
  assert.equal(left.complexShadows, expectedShadowImplementation)
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
  if (expectedShadowImplementation === 'native-indexed-owner-mesh') {
    assert.equal(
      left.frame.complexShadowActiveMeshCount,
      left.frame.complexShadowCasterCount,
    )
    assert.ok(
      left.frame.complexShadowAllocatedQuadCapacity
        >= left.frame.complexShadowQuadCount,
    )
    assert.equal(left.frame.complexShadowZOrderMismatchCount, 0)
    assert.equal(left.frame.regionLightLogicalSide, 1_600)
    assert.equal(left.frame.regionLightPhysicalSide, 400)
    assert.equal(left.frame.lightProviderCandidateCount, 2)
    assert.equal(
      left.frame.lightMiscTailCandidateCount,
      left.longAirPathLightCount,
    )
  }
  if (left.longAirPathLightCount > 0) {
    assert.ok(left.frame.lightSourceCount >= left.longAirPathLightCount + 1)
  }

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
  if (expectedShadowImplementation === 'native-indexed-owner-mesh') {
    assert.equal(
      right.frame.complexShadowActiveMeshCount,
      right.frame.complexShadowCasterCount,
    )
    assert.equal(right.frame.complexShadowZOrderMismatchCount, 0)
    assert.equal(right.frame.lightProviderCandidateCount, 1)
    assert.equal(right.frame.lightMiscTailCandidateCount, 0)
  }
  assert.ok(right.frame.lightSourceCount < left.frame.lightSourceCount)
  assert.ok(right.changedPixels > 20_000)
  assert.ok(right.channelDelta > 100_000)

  await page.evaluate(() => {
    window.__complexShadowProbe.renderer.destroy()
    document.body.replaceChildren()
  })

  const generated = await page.evaluate(async ({
    measurementFrames,
    startupIterations,
    warmupFrames,
  }) => {
    const [
      economyModule,
      encounterModule,
      rendererModule,
      playerModule,
      secondaryModule,
      spellModule,
      templatesModule,
    ] = await Promise.all([
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/core-kernels/boneyard-encounter.ts'),
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/core-kernels/native-secondary-abilities.ts'),
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
          economy: economyModule.createHubEconomy(0x57fe40),
          footstepTick: 0,
          gaitDegrees: headingIndex * 15,
          headingIndex,
          lighting: {
            driveActive: false,
            lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
            overlayEffectPhase: 0,
          },
          position: {
            x: template.scene.spawn.x,
            y: template.scene.spawn.y,
          },
          primaryCast: playerModule.createIdlePlayerPrimaryCast(),
          progression: {
            activeWeldBuildId: null,
            coldSlowTicksRemaining: 0,
            currentHealth: 50,
            currentMana: 100,
            deathEpoch: 0,
            deathTick: 0,
            dazzleTicksRemaining: 0,
            experience: 0,
            learnedSkills: [],
            level: 1,
            lifeState: 'alive',
            maximumHealth: 50,
            maximumMana: 100,
            nextThreshold: 100,
            pendingOffer: null,
            poisonDamagePerTick: 0,
            poisonTicksRemaining: 0,
            previousThreshold: 0,
            revision: 0,
          },
          velocity: { x: 0, y: 0 },
          walkCyclePrimary: 0,
        },
      },
      primarySpells: spellModule.createPrimarySpellSimulation(),
      secondaryAbilities: secondaryModule.createNativeSecondarySimulation(),
      run: {
        eligiblePlayerIds: ['local'],
        gameOverEventId: 0,
        gameOverTicks: 0,
        lastCompletedRunId: null,
        nextGameOverEventId: 1,
        phase: 'active',
        runId,
      },
      tick,
      world: {
        deathEffects: [],
        encounter: encounter ?? null,
        enemies: [],
        enemyEvents: [],
        enemyProjectileEffects: [],
        enemyProjectiles: [],
        gateLeaves: [],
        kind: 'boneyard',
        lanternLightRegistration: encounter
          ? { managerLane: 'actor', registrationOrdinal: 1 }
          : null,
        mageLightningPulses: [],
        maggots: [],
        runId,
        waves: null,
      },
    })
    const boneyard = {
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
    }
    const createRenderer = () => rendererModule.createBoneyardWorldRenderer({
      boneyard,
      devicePixelRatio: 1,
      initialSnapshot: snapshotAt(2_000),
      playerId: 'local',
      viewport,
    })
    const startupReceipts = []
    for (let iteration = 0; iteration < startupIterations; iteration += 1) {
      const startupRenderer = await createRenderer()
      const frame = startupRenderer.canvas.__sdrBoneyardFrame
      startupReceipts.push({
        frame: {
          frameCount: frame.frameCount,
          lightActiveBucketCount: frame.lightActiveBucketCount,
          lightProviderCandidateCount: frame.lightProviderCandidateCount,
          lightSourceCount: frame.lightSourceCount,
          playerLightRadius: frame.playerLightRadius,
          regionLightPhysicalSide: frame.regionLightPhysicalSide,
        },
        pixels: pixelReceipt(startupRenderer.canvas),
      })
      startupRenderer.destroy()
    }
    const renderer = await createRenderer()
    renderer.canvas.id = 'generated-complex-shadow-probe'
    document.body.append(renderer.canvas)
    const firstFrame = { ...renderer.canvas.__sdrBoneyardFrame }
    for (let frame = 1; frame <= warmupFrames; frame += 1) {
      await new Promise(requestAnimationFrame)
      renderer.render(snapshotAt(2_000 + frame))
    }
    const initialResources = {
      activeMeshes: renderer.canvas.__sdrBoneyardFrame.complexShadowActiveMeshCount,
      allocatedQuadCapacity:
        renderer.canvas.__sdrBoneyardFrame.complexShadowAllocatedQuadCapacity,
      pooledMeshes: renderer.canvas.__sdrBoneyardFrame.complexShadowPooledMeshCount,
    }
    const renderDurations = []
    const frameGaps = []
    const longTasks = []
    const measurementStart = performance.now()
    const observer = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (entry.startTime >= measurementStart) longTasks.push(entry.duration)
      }
    })
    observer.observe({ type: 'longtask' })
    let previousFrameTime = await new Promise(requestAnimationFrame)
    for (let frame = 1; frame <= measurementFrames; frame += 1) {
      const snapshot = snapshotAt(2_000 + warmupFrames + frame)
      const frameTime = await new Promise(requestAnimationFrame)
      frameGaps.push(frameTime - previousFrameTime)
      previousFrameTime = frameTime
      const renderStart = performance.now()
      renderer.render(snapshot)
      renderDurations.push(performance.now() - renderStart)
    }
    await new Promise(requestAnimationFrame)
    observer.disconnect()
    window.__generatedComplexShadowRenderer = renderer
    return {
      averageRenderMs: renderDurations.reduce((sum, value) => sum + value, 0)
        / renderDurations.length,
      firstFrame,
      frame: { ...renderer.canvas.__sdrBoneyardFrame },
      initialResources,
      frameGaps: distribution(frameGaps),
      heapBytes: performance.memory
        ? {
            limit: performance.memory.jsHeapSizeLimit,
            total: performance.memory.totalJSHeapSize,
            used: performance.memory.usedJSHeapSize,
          }
        : null,
      longTasks: {
        count: longTasks.length,
        durationMs: longTasks.reduce((sum, value) => sum + value, 0),
        maximumMs: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      },
      renderDurations: distribution(renderDurations),
      startupReceipts,
    }

    function distribution(values) {
      const ordered = [...values].sort((left, right) => left - right)
      const percentile = (fraction) => ordered[
        Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)
      ]
      return {
        count: ordered.length,
        maximum: ordered.at(-1),
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
      }
    }

    function pixelReceipt(source) {
      const sample = document.createElement('canvas')
      sample.width = source.width
      sample.height = source.height
      const context = sample.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('startup lighting pixel probe has no 2D context')
      context.drawImage(source, 0, 0)
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data
      let hash = 0x811c9dc5
      let nonBlackPixels = 0
      let rgbTotal = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const red = pixels[offset]
        const green = pixels[offset + 1]
        const blue = pixels[offset + 2]
        if (red !== 0 || green !== 0 || blue !== 0) nonBlackPixels += 1
        rgbTotal += red + green + blue
        hash = Math.imul(hash ^ red, 0x01000193)
        hash = Math.imul(hash ^ green, 0x01000193)
        hash = Math.imul(hash ^ blue, 0x01000193)
      }
      return { hash: hash >>> 0, nonBlackPixels, rgbTotal }
    }
  }, {
    measurementFrames: generatedMeasurementFrames,
    startupIterations: generatedStartupIterations,
    warmupFrames: generatedWarmupFrames,
  })
  await page.locator('#generated-complex-shadow-probe').screenshot({
    path: generatedScreenshot,
  })
  assert.ok(generated.frame.staticLayerCount > 100)
  assert.ok(generated.frame.visibleMainLayerCount > 0)
  assert.ok(generated.frame.complexShadowCasterCount > 0)
  assert.ok(generated.frame.complexShadowRecordCount > 0)
  assert.ok(generated.frame.complexShadowQuadCount > 0)
  assert.equal(generated.firstFrame.frameCount, 1)
  assert.ok(generated.firstFrame.lightSourceCount > 0)
  assert.ok(generated.firstFrame.lightActiveBucketCount > 0)
  assert.equal(generated.firstFrame.regionLightLogicalSide, 1_600)
  assert.equal(generated.firstFrame.regionLightPhysicalSide, 400)
  for (const [index, startup] of generated.startupReceipts.entries()) {
    const startupFrame = startup.frame
    assert.equal(startupFrame.frameCount, 1, `startup ${index} frame count`)
    assert.equal(startupFrame.lightProviderCandidateCount, 2, `startup ${index} providers`)
    assert.equal(startupFrame.lightSourceCount, 2, `startup ${index} accepted sources`)
    assert.ok(startupFrame.lightActiveBucketCount > 0, `startup ${index} light grid`)
    assert.ok(startupFrame.playerLightRadius > 0, `startup ${index} player light`)
    assert.equal(startupFrame.regionLightPhysicalSide, 400, `startup ${index} target`)
    assert.ok(startup.pixels.nonBlackPixels > 10_000, `startup ${index} visible pixels`)
    assert.ok(startup.pixels.rgbTotal > 1_000_000, `startup ${index} lighting pixels`)
  }
  assert.equal(
    new Set(generated.startupReceipts.map(({ pixels }) => pixels.hash)).size,
    generated.startupReceipts.length > 0 ? 1 : 0,
    'repeated startup frames must have one deterministic pixel signature',
  )
  if (expectedShadowImplementation === 'native-indexed-owner-mesh') {
    assert.equal(
      generated.frame.complexShadowActiveMeshCount,
      generated.frame.complexShadowCasterCount,
    )
    assert.equal(generated.frame.complexShadowZOrderMismatchCount, 0)
    assert.deepEqual({
      activeMeshes: generated.frame.complexShadowActiveMeshCount,
      allocatedQuadCapacity:
        generated.frame.complexShadowAllocatedQuadCapacity,
      pooledMeshes: generated.frame.complexShadowPooledMeshCount,
    }, generated.initialResources)
  }
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

function boundedInteger(value, name, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`)
  }
  return parsed
}

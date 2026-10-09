import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const viewportWidth = Number(process.env.SDR_SHADOW_VIEWPORT_WIDTH || 1600)
const viewportHeight = Number(process.env.SDR_SHADOW_VIEWPORT_HEIGHT || 900)
const dpr = Number(process.env.SDR_SHADOW_DEVICE_PIXEL_RATIO || 1)
const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const leftScreenshot = process.env.SDR_SHADOW_LEFT_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-left.png'
const rightScreenshot = process.env.SDR_SHADOW_RIGHT_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-right.png'
const generatedScreenshot = process.env.SDR_SHADOW_GENERATED_SCREENSHOT
  || '/tmp/solomon-dark-complex-shadows-generated.png'
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
    deviceScaleFactor: dpr,
    viewport: { height: viewportHeight, width: viewportWidth },
  })
  await page.addInitScript(({ width, height }) => {
    const displayScale = Math.min(1, width / 1600, height / 900)
    window.__visualViewport = { displayScale, width: width / displayScale, height: height / displayScale }
  }, { width: viewportWidth, height: viewportHeight })
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
    const progressionModule = await import('/src/game/core-kernels/player-progression.ts')
    const [airModule, economyModule, rendererModule, playerModule, secondaryModule, shadowModule, spellModule] = await Promise.all([
      import('/src/game/renderer/primary-spell-air-native.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/core-kernels/native-secondary-abilities.ts'),
      import('/src/game/renderer/boneyard-complex-shadows.ts'),
      import('/src/game/core-kernels/primary-spells.ts'),
    ])
    const viewport = window.__visualViewport
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
          { eid: 'goodie-shadow-probe', typeId: 2061, subtype: 0, variant: 0, atlasEntry: 145, pos: { x: 520, y: 370 }, sortBias: 0 },
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
      birthTick: 1_121,
      direction: { x: 1, y: 0 },
      endpoint: { x: 725, y: 330 },
      hurricaneCharge: 0,
      id: 4_501,
      kind: 'air',
      midpoint: { x: 500, y: 330 },
      origin: { x: 275, y: 330 },
      ownerId: 'local',
      painterRegistrations: [1, 2, 3].map(registrationOrdinal => ({
        managerLane: 'actor',
        registrationOrdinal,
      })),
      targetId: null,
      lightRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
      underpowered: false,
      variant: 0,
      worldKey: `boneyard:${runId}`,
    }
    const rawSnapshotAt = (tick, position, headingIndex, includeLongAir = false) => {
      const primarySpells = spellModule.createPrimarySpellSimulation()
      if (includeLongAir) primarySpells.transients.push(longAir)
      return {
        hostPlayerId: 'local',
        materializingPlayerIds: [],
        modEffects: [],
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
            ...playerModule.playerCharacterFacing(headingIndex * 15),
            lighting: {
              driveActive: false,
              lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
              overlayEffectPhase: 0,
            },
            position,
            primaryCast: playerModule.createIdlePlayerPrimaryCast(),
            progression: {
              ...progressionModule.createPlayerProgression(1),
              learnedSkillOrder: [], advancedUnlocks: [], concentrationSkillIds: [null, null],
              weldBuildId: null,
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
          gameOverExitKind: null,
          gameOverExitTicks: null,
          gameOverTicks: 0,
          lastCompletedRunId: null,
          loadoutReadyPlayerIds: [],
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
          spiderSilks: [],
          silkFragments: [],
          spiderRemains: [],
          webbedPlayers: {},
          enemyProjectileEffects: [],
          enemyProjectiles: [],
          gateLeaves: [],
          goodies: [{ id: 9, active: false, exhausted: false, phase: 0, position: { x: 520, y: 370 }, sceneryRegistrationOrdinal: 0, subtype: 0, timer: 0 }],
          kind: 'boneyard',
          lanternLightRegistration: null,
          lanternPosition: null,
          solomonPainterRegistration: null,
          loot: [],
          lootEvents: [],
          mageLightningPulses: [],
          maggots: [],
          runId,
          tutorial: null,
          waves: null,
        },
      }
    }
    const simulation = await import('/src/game/core-server/game-simulation.ts')
    const snapshots = await import('/src/game/host/game-snapshot.ts')
    const defaults = snapshots.createGameSnapshot(simulation.enterBoneyardWorld(
      simulation.createGameSimulation({ local: { discipline: 'arcane', displayName: 'Visual probe', element: 'fire' } }), loaded), 'local')
    const snapshotAt = (...args) => {
      const raw = rawSnapshotAt(...args)
      return { ...defaults, ...raw, players: { local: { ...defaults.players.local, ...raw.players.local,
        progression: { ...defaults.players.local.progression, ...raw.players.local.progression } } },
        world: { ...defaults.world, ...raw.world } }
    }
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      now: () => 1000,
      devicePixelRatio: window.devicePixelRatio,
      initialSnapshot: snapshotAt(1_000, { x: 275, y: 330 }, 6),
      modAssets: [],
      modCatalog: [],
      playerId: 'local',
      viewport,
    })
    renderer.canvas.id = 'complex-shadow-probe'
    document.body.append(renderer.canvas)
    renderer.canvas.style.width = `${viewport.width * viewport.displayScale}px`
    renderer.canvas.style.height = `${viewport.height * viewport.displayScale}px`
    for (let frame = 1; frame <= 120; frame += 1) {
      renderer.render(snapshotAt(1_000 + frame, { x: 275, y: 330 }, 6))
    }
    const capture = () => {
      const copy = document.createElement('canvas')
      copy.width = renderer.canvas.width
      copy.height = renderer.canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(renderer.canvas, 0, 0)
      return context.getImageData(0, 0, copy.width, copy.height).data
    }
    const initialFrame = { ...renderer.canvas.__sdrBoneyardFrame }
    const initialPixels = capture()
    renderer.render(snapshotAt(1_121, { x: 275, y: 330 }, 6, true))
    const latePixels = capture()
    let lateChangedPixels = 0
    let lateChannelDelta = 0
    for (let offset = 0; offset < latePixels.length; offset += 4) {
      const delta = (
        Math.abs(latePixels[offset] - initialPixels[offset])
        + Math.abs(latePixels[offset + 1] - initialPixels[offset + 1])
        + Math.abs(latePixels[offset + 2] - initialPixels[offset + 2])
      )
      if (delta > 3) lateChangedPixels += 1
      lateChannelDelta += delta
    }
    window.__complexShadowProbe = {
      capture,
      snapshotAt,
      loaded,
      initialFrame,
      lateChangedPixels,
      lateChannelDelta,
      leftPixels: latePixels,
      longAirPathLightCount: typeof airModule.buildNativeAirPathLightSources === 'function'
        ? airModule.buildNativeAirPathLightSources(longAir).length
        : 0,
      renderer,
      rightSnapshot: snapshotAt(1_130, { x: 800, y: 330 }, 18),
    }
    const treeOutline = shadowModule.nativeBoneyardTreeComplexShadowOutline(0)
    return {
      raster: { gpu: (() => { const gl = renderer.canvas.getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, antialias: gl.getContextAttributes().antialias } })(), width: renderer.canvas.width, height: renderer.canvas.height, cssWidth: renderer.canvas.getBoundingClientRect().width, cssHeight: renderer.canvas.getBoundingClientRect().height, dpr: window.devicePixelRatio, resolution: renderer.canvas.dataset.resolution, viewport },
      complexShadows: renderer.canvas.dataset.complexShadows,
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      frame: { ...renderer.canvas.__sdrBoneyardFrame },
      initialFrame,
      lateChangedPixels,
      lateChannelDelta,
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
  assert.equal(left.initialFrame.lightProviderCandidateCount, 1)
  assert.equal(left.initialFrame.lightMiscTailCandidateCount, 0)
  assert.equal(left.initialFrame.lightSourceCount, 1)
  assert.ok(left.lateChangedPixels > 20_000)
  assert.ok(left.lateChannelDelta > 100_000)
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
    assert.equal(left.frame.regionLightLogicalSide, expectedRegionTarget(left.raster).logical)
    assert.equal(left.frame.regionLightPhysicalSide, expectedRegionTarget(left.raster).physical)
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

  const fixedStates = []
  for (const state of [
    { name: 'fixed-on', enabled: true, phase: 0, removed: false },
    { name: 'fixed-off', enabled: false, phase: 0, removed: false },
    { name: 'fixed-open-off', enabled: false, phase: 1, removed: false },
    { name: 'fixed-removed-off', enabled: false, phase: 1, removed: true },
    { name: 'fixed-removed-on', enabled: true, phase: 1, removed: true },
    { name: 'fixed-on-restored', enabled: true, phase: 0, removed: false },
  ]) {
    const row = await page.evaluate(async state => {
      const { DEFAULT_GAME_SETTINGS } = await import('/src/game/game-settings.ts')
      const probe = window.__complexShadowProbe
      const fixed = probe.snapshotAt(1600, { x: 400, y: 330 }, 6, false)
      fixed.world.goodies = state.removed ? [] : fixed.world.goodies.map(goodie => ({ ...goodie, phase: state.phase }))
      probe.renderer.setSettings({ ...DEFAULT_GAME_SETTINGS, complexShadows: state.enabled })
      for (let settle = 0; settle < 60; settle += 1) probe.renderer.render(fixed)
      const pixels = probe.capture()
      let hash = 0x811c9dc5
      for (let i = 0; i < pixels.length; i += 1) hash = Math.imul(hash ^ pixels[i], 0x01000193)
      return { state, pixelHash: hash >>> 0, frame: { ...probe.renderer.canvas.__sdrBoneyardFrame }, dataset: { ...probe.renderer.canvas.dataset } }
    }, state)
    fixedStates.push(row)
    await canvas.screenshot({ path: leftScreenshot.replace('-left.png', `-${state.name}.png`) })
  }

  if (process.env.SDR_SHADOW_ASSERT_NATIVE_SCENERY !== '0') {
    for (const row of fixedStates) {
      const shadow = row.frame.sceneryShadows
      assert.ok(shadow, 'candidate must publish its actual retained scenery shadow receipt')
      assert.equal(shadow.zOrderMismatchCount, 0, row.state.name)
      assert.equal(shadow.familyQuads['Tree:tree-root-mask'], 1, 'authored Tree root mask is unconditional')
      const goodie = shadow.goodies.find(value => value.id === 9)
      assert.equal(shadow.directionalFamilyCasters.Goodie ?? 0,
        row.state.enabled && !row.state.removed ? 1 : 0,
        `${row.state.name}: live chest projection must follow actual owner lifetime`)
      if (row.state.removed) {
        assert.equal(goodie, undefined, 'removed chest must lose its live shadow owner')
        assert.equal(shadow.familyQuads['Goodie:scenery-flat-shadow'] ?? 0, 0)
      } else {
        assert.equal(goodie?.phase, row.state.phase)
        assert.equal(goodie?.mode, row.state.enabled ? 'directional' : 'glyph')
        assert.equal(goodie?.owner, 'goodie:9')
      }
      if (!row.state.enabled) {
        assert.equal(shadow.familyQuads['Gravestone:scenery-flat-shadow'], 1)
        assert.equal(shadow.familyQuads['Tree:scenery-flat-shadow'], 2)
        assert.equal(shadow.familyQuads['FenceGrate:fence-flat-shadow'], 1)
        assert.equal(shadow.familyQuads['Fencepost:scenery-flat-shadow'], 2)
        assert.equal(shadow.familyQuads['Goodie:scenery-flat-shadow'] ?? 0, row.state.removed ? 0 : 1)
      }
    }
    assert.deepEqual(fixedStates[0].frame.sceneryShadows.familyQuads,
      fixedStates.at(-1).frame.sceneryShadows.familyQuads, 'on-off-on must restore every family')
    assert.equal(fixedStates[0].frame.complexShadowCasterCount,
      fixedStates.at(-1).frame.complexShadowCasterCount, 'chest restoration must rejoin directional casters')
  }

  const uncommon = []
  if (process.env.SDR_SHADOW_EXTRA_SCENERY !== '0') {
    await page.evaluate(async () => {
      const { createBoneyardWorldRenderer } = await import('/src/game/renderer/boneyard-world-renderer.ts')
      const probe = window.__complexShadowProbe
      const boneyard = { ...probe.loaded, scene: { ...probe.loaded.scene,
        bounds: { x: 0, y: 0, w: 1400, h: 1000 },
        objects: [
          { eid: 'building', typeId: 2040, variant: 0, pos: { x: 850, y: 750 } },
          { eid: 'monument', typeId: 2009, variant: 20, pos: { x: 1050, y: 650 } },
        ],
        fences: [
          { eid: 'broken', typeId: 3005, segmentCode: 1, points: [{ x: 300, y: 400 }, { x: 500, y: 460 }], startPostVariant: 3, endPostVariant: 5 },
          { eid: 'grate', typeId: 3005, segmentCode: 0, points: [{ x: 600, y: 400 }, { x: 750, y: 420 }] },
          { eid: 'rails', typeId: 3005, segmentCode: 4, points: [{ x: 750, y: 420 }, { x: 900, y: 450 }], startPostVariant: 9 },
          { eid: 'wall', typeId: 3005, segmentCode: 3, points: [{ x: 550, y: 550 }, { x: 750, y: 590 }] },
        ],
      } }
      const snapshot = probe.snapshotAt(1800, { x: 700, y: 550 }, 6, false)
      snapshot.world.goodies = []
      probe.renderer.destroy()
      document.body.replaceChildren()
      const renderer = await createBoneyardWorldRenderer({ boneyard,
        devicePixelRatio: devicePixelRatio, viewport: window.__visualViewport, now: () => 1000,
        initialSnapshot: snapshot, modAssets: [], modCatalog: [], playerId: 'local' })
      renderer.canvas.id = 'uncommon-scenery-probe'
      renderer.canvas.style.width = `${window.__visualViewport.width * window.__visualViewport.displayScale}px`
      renderer.canvas.style.height = `${window.__visualViewport.height * window.__visualViewport.displayScale}px`
      document.body.append(renderer.canvas)
      window.__uncommonSceneryProbe = { renderer, snapshot }
    })
    const sceneryCases = [
      { name: 'central-on', enabled: true, position: { x: 700, y: 550 } },
      { name: 'central-off', enabled: false, position: { x: 700, y: 550 } },
      { name: 'central-restored', enabled: true, position: { x: 700, y: 550 } },
      { name: 'broken-near', enabled: true, position: { x: 400, y: 450 } },
      { name: 'landmarks-near', enabled: true, position: { x: 950, y: 700 } },
    ]
    for (const sceneryCase of sceneryCases) {
      const { enabled } = sceneryCase
      const row = await page.evaluate(async ({ enabled, position, name }) => {
        const { DEFAULT_GAME_SETTINGS } = await import('/src/game/game-settings.ts')
        const { renderer, snapshot } = window.__uncommonSceneryProbe
        snapshot.players.local.position = position
        renderer.setSettings({ ...DEFAULT_GAME_SETTINGS, complexShadows: enabled })
        for (let frame = 0; frame < 60; frame += 1) renderer.render(snapshot)
        return { name, enabled, position, frame: { ...renderer.canvas.__sdrBoneyardFrame }, dataset: { ...renderer.canvas.dataset } }
      }, sceneryCase)
      uncommon.push(row)
      if (process.env.SDR_SHADOW_ASSERT_NATIVE_SCENERY !== '0') {
        assert.equal(row.frame.sceneryShadows.zOrderMismatchCount, 0)
        assert.equal(row.frame.complexShadowZOrderMismatchCount, 0)
        assert.equal(row.frame.sceneryShadows.familyQuads['Wall:wall-base-shadow'], 1)
        if (row.name === 'broken-near') {
          assert.equal(row.frame.sceneryShadows.directionalFamilyCasters.Broken, 2,
            'both native Broken halves must project when the player light covers both')
        }
        if (!enabled) {
          for (const family of ['Building:scenery-flat-shadow', 'Monument:scenery-flat-shadow', 'FenceGrate:fence-flat-shadow', 'Rails:fence-flat-shadow']) {
            assert.ok(row.frame.sceneryShadows.familyQuads[family] > 0, family)
          }
        }
      }
      await page.locator('#uncommon-scenery-probe').screenshot({ path: leftScreenshot.replace('-left.png', `-uncommon-${uncommon.length}-${enabled ? 'on' : 'off'}.png`) })
    }
    if (process.env.SDR_SHADOW_ASSERT_NATIVE_SCENERY !== '0') {
      // Admission is local-light dependent; move one real light rather than inventing global illumination.
      for (const family of ['Broken', 'Wall', 'Building', 'Monument', 'Rails', 'FenceGrate', 'Fencepost']) {
        assert.ok(uncommon.some(row => row.enabled && row.frame.sceneryShadows.directionalFamilyCasters[family] > 0),
          `uncommon directional ${family}`)
      }
    }
    await page.evaluate(() => window.__uncommonSceneryProbe.renderer.destroy())
  }

  await page.evaluate(() => {
    window.__complexShadowProbe.renderer.destroy()
    document.body.replaceChildren()
  })

  const generated = await page.evaluate(async ({
    measurementFrames,
    startupIterations,
    warmupFrames,
  }) => {
    const progressionModule = await import('/src/game/core-kernels/player-progression.ts')
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
    const viewport = window.__visualViewport
    const template = templatesModule.NATIVE_GENERATED_BONEYARDS[0]
    const runId = 'generated-complex-shadow-browser-proof'
    const facing = playerModule.playerCharacterFacing(template.scene.spawn.facingDeg)
    const headingIndex = facing.headingIndex
    const encounter = template.scene.solomonDig
      ? encounterModule.createSolomonEncounter(
          template.scene.solomonDig,
          'generated-shadow-proof',
        )
      : undefined
    const rawSnapshotAt = (tick) => ({
      hostPlayerId: 'local',
      materializingPlayerIds: [],
      modEffects: [],
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
          ...facing,
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
              ...progressionModule.createPlayerProgression(1),
              learnedSkillOrder: [], advancedUnlocks: [], concentrationSkillIds: [null, null],
            weldBuildId: null,
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
        gameOverExitKind: null,
        gameOverExitTicks: null,
        gameOverTicks: 0,
        lastCompletedRunId: null,
        loadoutReadyPlayerIds: [],
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
        spiderSilks: [],
        silkFragments: [],
        spiderRemains: [],
        webbedPlayers: {},
        enemyProjectileEffects: [],
        enemyProjectiles: [],
        gateLeaves: [],
        goodies: [],
        kind: 'boneyard',
        lanternPosition: encounter ? template.scene.solomonDig.lanternPosition : null,
        lanternLightRegistration: encounter
          ? { managerLane: 'actor', registrationOrdinal: 2 }
          : null,
        solomonPainterRegistration: encounter
          ? { managerLane: 'actor', registrationOrdinal: 1 }
          : null,
        mageLightningPulses: [],
        maggots: [],
        loot: [],
        lootEvents: [],
        runId,
        tutorial: null,
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
    const simulation = await import('/src/game/core-server/game-simulation.ts')
    const snapshots = await import('/src/game/host/game-snapshot.ts')
    const defaults = snapshots.createGameSnapshot(simulation.enterBoneyardWorld(
      simulation.createGameSimulation({ local: { discipline: 'arcane', displayName: 'Visual probe', element: 'fire' } }), boneyard), 'local')
    const snapshotAt = (...args) => {
      const raw = rawSnapshotAt(...args)
      return { ...defaults, ...raw, players: { local: { ...defaults.players.local, ...raw.players.local,
        progression: { ...defaults.players.local.progression, ...raw.players.local.progression } } },
        world: { ...defaults.world, ...raw.world } }
    }
    const createRenderer = () => rendererModule.createBoneyardWorldRenderer({
      boneyard,
      now: () => 1000,
      devicePixelRatio: window.devicePixelRatio,
      initialSnapshot: snapshotAt(2_000),
      modAssets: [],
      modCatalog: [],
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
    renderer.canvas.style.width = `${viewport.width * viewport.displayScale}px`
    renderer.canvas.style.height = `${viewport.height * viewport.displayScale}px`
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
    const completeRenderDurations = []
    const gl = renderer.canvas.getContext('webgl2')
    const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const queries = []
    for (let frame = 0; frame < 60; frame += 1) {
      const snapshot = snapshotAt(2500 + frame)
      const query = timer ? gl.createQuery() : null
      if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query)
      const started = performance.now()
      renderer.render(snapshot)
      if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(query) }
      gl.finish()
      completeRenderDurations.push(performance.now() - started)
    }
    await new Promise(requestAnimationFrame)
    // Wait for all asynchronous GPU queries; gl.finish wall time is not a GPU timer.
    for (let attempt = 0; timer && attempt < 120
      && queries.some(query => !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)); attempt++) {
      await new Promise(requestAnimationFrame)
    }
    const disjoint = timer ? gl.getParameter(timer.GPU_DISJOINT_EXT) : null
    const gpuTimes = queries.flatMap(query => {
      const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)
      const value = available && !disjoint ? gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6 : null
      gl.deleteQuery(query)
      return value === null ? [] : [value]
    })
    window.__generatedComplexShadowRenderer = renderer
    return {
      raster: { gpu: (() => { const gl = renderer.canvas.getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, antialias: gl.getContextAttributes().antialias } })(), width: renderer.canvas.width, height: renderer.canvas.height, cssWidth: renderer.canvas.getBoundingClientRect().width, cssHeight: renderer.canvas.getBoundingClientRect().height, dpr: window.devicePixelRatio, resolution: renderer.canvas.dataset.resolution, viewport },
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
      glFinishWallDurations: distribution(completeRenderDurations),
      gpuTimer: { supported: Boolean(timer), disjoint, samples: gpuTimes.length, durations: gpuTimes.length ? distribution(gpuTimes) : null },
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
  assert.equal(generated.firstFrame.regionLightLogicalSide, expectedRegionTarget(generated.raster).logical)
  assert.equal(generated.firstFrame.regionLightPhysicalSide, expectedRegionTarget(generated.raster).physical)
  for (const [index, startup] of generated.startupReceipts.entries()) {
    const startupFrame = startup.frame
    assert.equal(startupFrame.frameCount, 1, `startup ${index} frame count`)
    assert.equal(startupFrame.lightProviderCandidateCount, 2, `startup ${index} providers`)
    assert.equal(startupFrame.lightSourceCount, 2, `startup ${index} accepted sources`)
    assert.ok(startupFrame.lightActiveBucketCount > 0, `startup ${index} light grid`)
    assert.ok(startupFrame.playerLightRadius > 0, `startup ${index} player light`)
    assert.equal(startupFrame.regionLightPhysicalSide, expectedRegionTarget(generated.raster).physical, `startup ${index} target`)
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
    fixedStates,
    uncommon,
    screenshots: {
      generated: generatedScreenshot,
      left: leftScreenshot,
      right: rightScreenshot,
    },
    status: 'ok',
    viewport: { width: viewportWidth, height: viewportHeight, dpr },
    errors: { console: consoleErrors, page: pageErrors, responses: failedResponses },
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

function expectedRegionTarget(raster) {
  const resolution = Number(raster.resolution)
  const request = Math.max(1, Math.trunc(Math.max(raster.viewport.width, raster.viewport.height) * resolution * .25))
  const physical = 2 ** Math.ceil(Math.log2(request))
  return { physical, logical: physical / Math.fround(Math.fround(resolution) * Math.fround(Math.fround(.25) * Math.fround(.8))) }
}

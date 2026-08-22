import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const screenshot = process.env.SDR_BUILDING_LIGHTING_SCREENSHOT
  || '/tmp/solomon-dark-building-lighting-20260822.png'

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { height: 900, width: 1_600 },
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

  await page.route(`${baseUrl}/__building-lighting-proof`, (route) => route.fulfill({
    body: '<!doctype html><html><body></body></html>',
    contentType: 'text/html',
    status: 200,
  }))
  await page.goto(`${baseUrl}/__building-lighting-proof`, {
    waitUntil: 'domcontentloaded',
  })

  const receipt = await page.evaluate(async () => {
    document.body.replaceChildren()
    document.body.style.background = '#000'
    document.body.style.margin = '0'
    const [
      assetsModule,
      economyModule,
      rendererModule,
      playerModule,
      secondaryModule,
      settingsModule,
      spellModule,
    ] = await Promise.all([
      import('/src/editor/assets.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/core-kernels/native-secondary-abilities.ts'),
      import('/src/game/game-settings.ts'),
      import('/src/game/core-kernels/primary-spells.ts'),
    ])
    const viewport = { displayScale: 1, height: 900, width: 1_600 }
    const runId = 'building-lighting-browser-proof'
    const buildings = Array.from({ length: 4 }, (_, variant) => ({
      atlasEntries: [148 + variant, 152 + variant],
      eid: `building-${variant}`,
      pos: { x: 185 + variant * 370, y: 610 },
      sortBias: 0,
      typeId: 2_040,
      variant,
    }))
    const monuments = Array.from({ length: 21 }, (_, variant) => ({
      atlasEntry: 156 + variant,
      eid: `monument-${variant}`,
      pos: {
        x: 420 + (variant % 7) * 100,
        y: 100 + Math.floor(variant / 7) * 110,
      },
      sortBias: 0,
      typeId: 2_009,
      variant,
    }))
    const loaded = {
      choice: { id: 'building-lighting-proof', name: 'Building lighting proof', source: 'default' },
      geometrySha256: 'building-lighting-proof',
      runId,
      seed: 'building-lighting-proof',
      sourceSha256: 'building-lighting-proof',
      scene: {
        bounds: { h: 800, w: 1_480, x: 0, y: 0 },
        environmentMode: 0,
        fences: [],
        name: 'Building lighting proof',
        objects: [...buildings, ...monuments],
        roads: [],
        solomonDig: null,
        spawn: { facingDeg: 90, x: 740, y: 400 },
        sprites: [],
        terrain: [],
      },
    }
    const snapshotAt = (tick, position) => ({
      hostPlayerId: 'local',
      modEffects: [],
      players: {
        local: {
          config: {
            discipline: 'arcane',
            displayName: 'Roof Probe',
            element: 'air',
          },
          economy: economyModule.createHubEconomy(0x60e940),
          footstepTick: 0,
          gaitDegrees: 90,
          headingIndex: 6,
          lighting: {
            driveActive: false,
            lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
            overlayEffectPhase: 0,
          },
          position,
          primaryCast: playerModule.createIdlePlayerPrimaryCast(),
          progression: {
            coldSlowTicksRemaining: 0,
            currentHealth: 50,
            currentMana: 100,
            dazzleTicksRemaining: 0,
            deathEpoch: 0,
            deathTick: 0,
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
            weldBuildId: null,
          },
          velocity: { x: 0, y: 0 },
          walkCyclePrimary: 0,
        },
      },
      primarySpells: spellModule.createPrimarySpellSimulation(),
      run: {
        eligiblePlayerIds: ['local'],
        gameOverEventId: 0,
        gameOverTicks: 0,
        lastCompletedRunId: null,
        nextGameOverEventId: 1,
        phase: 'active',
        runId,
      },
      secondaryAbilities: secondaryModule.createNativeSecondarySimulation(),
      tick,
      world: {
        deathEffects: [],
        encounter: null,
        enemies: [],
        enemyEvents: [],
        enemyProjectileEffects: [],
        enemyProjectiles: [],
        gateLeaves: [],
        goodies: [],
        kind: 'boneyard',
        lanternLightRegistration: null,
        loot: [],
        lootEvents: [],
        mageLightningPulses: [],
        maggots: [],
        runId,
        waves: null,
      },
    })
    const settings = {
      ...settingsModule.DEFAULT_GAME_SETTINGS,
      cameraFovPercent: 125,
    }
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: snapshotAt(1_000, { x: 740, y: 400 }),
      modAssets: [],
      modCatalog: [],
      playerId: 'local',
      settings,
      viewport,
    })
    renderer.canvas.id = 'building-lighting-probe'
    document.body.append(renderer.canvas)

    const capture = () => {
      const copy = document.createElement('canvas')
      copy.width = renderer.canvas.width
      copy.height = renderer.canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(renderer.canvas, 0, 0)
      return context.getImageData(0, 0, copy.width, copy.height).data
    }
    const frame = () => ({ ...renderer.canvas.__sdrBoneyardFrame })
    const pixelDifference = (first, second, rect) => {
      const left = Math.max(0, Math.floor(rect.x))
      const top = Math.max(0, Math.floor(rect.y))
      const right = Math.min(renderer.canvas.width, Math.ceil(rect.x + rect.w))
      const bottom = Math.min(renderer.canvas.height, Math.ceil(rect.y + rect.h))
      let changedPixels = 0
      let channelDelta = 0
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const offset = (y * renderer.canvas.width + x) * 4
          const delta = Math.abs(first[offset] - second[offset])
            + Math.abs(first[offset + 1] - second[offset + 1])
            + Math.abs(first[offset + 2] - second[offset + 2])
          if (delta > 3) changedPixels += 1
          channelDelta += delta
        }
      }
      return { changedPixels, channelDelta }
    }
    const screenRect = (object, entry) => {
      const ref = assetsModule.spriteRefFor('DeadHawg', entry)
      const current = frame()
      return {
        h: ref.h * current.cameraZoom,
        w: ref.w * current.cameraZoom,
        x: (object.pos.x - ref.anchorX - current.cameraX) * current.cameraZoom
          + viewport.width / 2,
        y: (object.pos.y - ref.anchorY - current.cameraY) * current.cameraZoom
          + viewport.height / 2,
      }
    }

    const buildingProofs = []
    for (const building of buildings) {
      const far = building.pos.x < 740 ? { x: 1_400, y: 50 } : { x: 80, y: 50 }
      renderer.render(snapshotAt(1_100 + building.variant * 2, far))
      const dark = capture()
      renderer.render(snapshotAt(1_101 + building.variant * 2, {
        x: building.pos.x - 250,
        y: building.pos.y - 100,
      }))
      const lit = capture()
      const litFrame = frame()
      buildingProofs.push({
        baseRoofColorMismatchCount: litFrame.buildingBaseRoofColorMismatchCount,
        difference: pixelDifference(
          dark,
          lit,
          screenRect(building, 152 + building.variant),
        ),
        maximum: litFrame.buildingVertexLightMaximum,
        minimum: litFrame.buildingVertexLightMinimum,
        variant: building.variant,
      })
    }

    renderer.setSettings({ ...settings, complexLighting: false })
    renderer.render(snapshotAt(1_200, { x: 740, y: 400 }))
    const lightingOff = frame()
    renderer.setSettings(settings)
    renderer.render(snapshotAt(1_201, { x: 1_400, y: 750 }))
    const monumentsDark = capture()
    renderer.render(snapshotAt(1_202, { x: 720, y: 225 }))
    const monumentsLit = capture()
    const monumentFrame = frame()
    const monumentProofs = monuments.map((monument) => ({
      difference: pixelDifference(
        monumentsDark,
        monumentsLit,
        screenRect(monument, 156 + monument.variant),
      ),
      variant: monument.variant,
    }))
    renderer.render(snapshotAt(1_300, { x: 675, y: 510 }))

    window.__buildingLightingRenderer = renderer
    return {
      buildingLighting: renderer.canvas.dataset.buildingLighting,
      buildingLightingGrid: renderer.canvas.dataset.buildingLightingGrid,
      buildingProofs,
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      lightingOff,
      monumentFrame,
      monumentProofs,
      renderer: renderer.canvas.dataset.gameRenderer,
      rendererName: renderer.canvas.dataset.rendererName,
    }
  })

  const canvas = page.locator('#building-lighting-probe')
  await canvas.screenshot({ path: screenshot })
  assert.equal(receipt.renderer, 'pixi-webgl')
  assert.match(receipt.rendererName.toLowerCase(), /webgl/)
  assert.equal(receipt.context, 'webgl2')
  assert.equal(receipt.buildingLighting, 'native-elevated-vertex-grid')
  assert.equal(receipt.buildingLightingGrid, '3x3')
  assert.equal(receipt.lightingOff.buildingCount, 4)
  assert.equal(receipt.lightingOff.buildingBaseRoofColorMismatchCount, 0)
  assert.equal(receipt.lightingOff.buildingVertexLightMinimum, 1)
  assert.equal(receipt.lightingOff.buildingVertexLightMaximum, 1)
  assert.deepEqual(receipt.buildingProofs.map(({ variant }) => variant), [0, 1, 2, 3])
  for (const proof of receipt.buildingProofs) {
    assert.equal(proof.baseRoofColorMismatchCount, 0, `Building ${proof.variant} color owner`)
    assert.ok(proof.minimum < proof.maximum, `Building ${proof.variant} vertex range`)
    assert.ok(proof.difference.changedPixels > 100, `Building ${proof.variant} roof pixels`)
    assert.ok(proof.difference.channelDelta > 5_000, `Building ${proof.variant} roof delta`)
  }
  assert.equal(receipt.monumentFrame.monumentVisibleCount, 21)
  assert.deepEqual(receipt.monumentProofs.map(({ variant }) => variant), (
    Array.from({ length: 21 }, (_, variant) => variant)
  ))
  for (const proof of receipt.monumentProofs) {
    assert.ok(proof.difference.changedPixels > 5, `Monument ${proof.variant} pixels`)
    assert.ok(proof.difference.channelDelta > 100, `Monument ${proof.variant} delta`)
  }
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])

  await page.evaluate(() => {
    window.__buildingLightingRenderer.destroy()
    delete window.__buildingLightingRenderer
    document.body.replaceChildren()
  })
  process.stdout.write(`${JSON.stringify({
    ...receipt,
    screenshot,
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
}

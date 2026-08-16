import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const screenshotPath = process.env.SDR_ENEMY_VFX_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-enemy-animation-projectile-vfx-20260815.png')
const skeletonEarlyScreenshotPath = process.env.SDR_SKELETON_ATTACK_EARLY_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-skeleton-attack-early-20260816.png')
const skeletonLateScreenshotPath = process.env.SDR_SKELETON_ATTACK_LATE_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-skeleton-attack-late-20260816.png')

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

  await page.route(`${baseUrl}/__enemy-animation-projectile-vfx-proof`, (route) => (
    route.fulfill({
      body: '<!doctype html><html><body></body></html>',
      contentType: 'text/html',
      status: 200,
    })
  ))
  await page.goto(`${baseUrl}/__enemy-animation-projectile-vfx-proof`, {
    waitUntil: 'domcontentloaded',
  })

  const receipt = await page.evaluate(async () => {
    document.body.replaceChildren()
    document.body.style.background = '#000'
    document.body.style.margin = '0'

    const [
      animationModule,
      economyModule,
      playerModule,
      presentationModule,
      rendererModule,
      spellModule,
    ] = await Promise.all([
      import('/src/game/renderer/native-enemy-animation.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/core-kernels/player-character.ts'),
      import('/src/game/renderer/native-enemy-presentation.ts'),
      import('/src/game/renderer/boneyard-world-renderer.ts'),
      import('/src/game/core-kernels/primary-spells.ts'),
    ])
    const viewport = { displayScale: 1, height: 900, width: 1600 }
    const runId = 'enemy-animation-projectile-vfx-browser-proof'
    const playerPosition = { x: 592, y: 333 }
    const loaded = {
      choice: { id: 'enemy-vfx-proof', name: 'Enemy VFX proof', source: 'default' },
      geometrySha256: 'enemy-vfx-proof',
      runId,
      seed: 'enemy-vfx-proof',
      sourceSha256: 'enemy-vfx-proof',
      scene: {
        bounds: { h: 666, w: 1_184, x: 0, y: 0 },
        environmentMode: 0,
        fences: [],
        name: 'Enemy animation and projectile VFX proof',
        objects: [],
        roads: [],
        solomonDig: null,
        spawn: { facingDeg: 0, ...playerPosition },
        sprites: [],
        terrain: [],
      },
    }
    const radians = (degrees) => degrees * Math.PI / 180
    const makeAnimation = (overrides) => (
      animationModule.nativeEnemyIdleAnimationSample(overrides)
    )
    const enemyLighting = {
      COFFIN: { charge: 0, glow: 0, providerCopies: 1 },
      DEMON: { charge: 0, glow: 0, providerCopies: 1 },
      IMP: { charge: 0, glow: 0.6, providerCopies: 1 },
      SKELETON: { charge: 0, glow: 0, providerCopies: 0 },
      SKELETONARCHER: { charge: 0.8, glow: 0, providerCopies: 0 },
      SKELETONMAGE: { charge: 1, glow: 0, providerCopies: 1 },
      WRAITH: { charge: 0, glow: 0, providerCopies: 0 },
      ZOMBIE: { charge: 0, glow: 0, providerCopies: 0 },
    }
    const makeEnemy = (
      enemyToken,
      id,
      nativeTypeId,
      position,
      animation,
      flags = [],
      armored = false,
    ) => ({
      animation,
      armored,
      currentHealth: 100,
      enemyToken,
      flags,
      headingDeg: 0,
      id,
      lightRegistration: enemyToken === 'ZOMBIE'
        ? null
        : { managerLane: 'actor', registrationOrdinal: id > 5 ? id - 1 : id },
      lighting: enemyLighting[enemyToken],
      maximumHealth: 100,
      nativeTypeId,
      position,
      shieldHealth: 0,
      shieldMaximumHealth: 0,
      spawnTick: 20,
    })
    const mageEffects = [{
      alpha: 1,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 381,
      id: 362,
      offset: { x: 0, y: 0 },
      role: 'mage-lightning-source',
      rotationRadians: 0,
      scale: 1,
    }, {
      alpha: 1,
      atlas: 'BadGuys',
      blendMode: 'add',
      entry: 382,
      id: 363,
      offset: { x: 70, y: 12 },
      role: 'mage-lightning-target',
      rotationRadians: 0,
      scale: 1,
    }]
    const enemiesAt = (advanced) => [
      makeEnemy(
        'SKELETON',
        1,
        1001,
        { x: 300, y: 190 },
        makeAnimation({
          action: 'skeleton-weapon',
          actionProgress: advanced ? 18 : 2,
          gaitPose: advanced ? 3 : 0,
          state: 'action',
        }),
        ['FLAG_ARMOR', 'FLAG_HOODED', 'FLAG_SWORD'],
        true,
      ),
      makeEnemy(
        'SKELETONARCHER',
        2,
        1002,
        { x: 500, y: 185 },
        makeAnimation({
          action: 'archer-shot',
          actionProgress: advanced ? 7 : 1,
          state: 'action',
        }),
        ['FLAG_HELM', 'FLAG_POISON'],
      ),
      makeEnemy(
        'SKELETONMAGE',
        3,
        1003,
        { x: 700, y: 185 },
        makeAnimation({
          action: 'mage-cast-long',
          actionProgress: advanced ? 13 : 2,
          effects: mageEffects,
          state: 'action',
        }),
        ['FLAG_HORNED'],
      ),
      makeEnemy(
        'IMP',
        4,
        1004,
        { x: 880, y: 190 },
        makeAnimation({
          action: 'imp-contact',
          bodyPose: advanced ? 1 : 3,
          impBodyRotationRadians: advanced ? radians(-30) : radians(35),
          impEffectAlpha: advanced ? 0.45 : 0.9,
          impEffectFrame: advanced ? 9 : 4,
          state: 'action',
          verticalOffset: advanced ? -8 : -28,
        }),
      ),
      makeEnemy(
        'ZOMBIE',
        5,
        1006,
        { x: 300, y: 470 },
        makeAnimation({
          action: 'zombie-beat',
          actionProgress: advanced ? 104 : 54,
          state: 'action',
          verticalOffset: advanced ? -8 : 0,
          zombieAngularOffsetDeg: advanced ? 16 : -12,
          zombieAttackSide: advanced ? 1 : 0,
          zombieBodyRotationRadians: advanced ? radians(-12) : radians(8),
          zombieBodyType: 1,
          zombieFlyblownSide: 0,
          zombieFrontArmPose: advanced ? 1 : 0,
          zombieFrontArmRotationRadians: advanced ? radians(-48) : radians(14),
          zombieHeadType: 2,
          zombieHeadRotationRadians: advanced ? radians(22) : radians(-8),
          zombieRearArmPose: advanced ? 0 : 1,
          zombieRearArmRotationRadians: advanced ? radians(12) : radians(-42),
        }),
      ),
      makeEnemy(
        'WRAITH',
        6,
        1007,
        { x: 500, y: 455 },
        makeAnimation({
          action: 'wraith-drain',
          actionProgress: advanced ? 5 : 1,
          alpha: 1,
          state: 'action',
        }),
      ),
      makeEnemy(
        'DEMON',
        7,
        1009,
        { x: 700, y: 455 },
        makeAnimation({
          action: 'demon-bomb',
          actionProgress: advanced ? 7 : 1,
          bodyPose: 1,
          demonFrontJointRotationRadians: advanced ? radians(40) : radians(8),
          demonFrontLimbRotationRadians: advanced ? radians(-40) : radians(-8),
          demonRearJointRotationRadians: advanced ? radians(-40) : radians(-8),
          demonRearLimbRotationRadians: advanced ? radians(40) : radians(8),
          state: 'action',
          verticalOffset: -3,
        }),
      ),
      makeEnemy(
        'COFFIN',
        8,
        1013,
        { x: 880, y: 455 },
        makeAnimation({
          coffinPose: advanced ? 9 : 4,
          coffinSecondaryPose: advanced ? 7 : 2,
          coffinState: 'opening',
          state: 'action',
        }),
      ),
    ]
    const projectile = (id, kind, nativeTypeId, payload, position, overrides = {}) => ({
      ageTicks: 40,
      contactRadius: 10,
      headingDeg: 35,
      homing: kind === 'guided-missile',
      id,
      kind,
      lightRegistration: null,
      lifetimeTicks: 400,
      nativeTypeId,
      ownerActorId: id % 8 + 1,
      payload,
      position,
      speed: 1.5,
      spawnTick: 80,
      verticalOffset: -10,
      visualPhaseDeg: kind === 'guided-missile' ? 540 : 0,
      visualScale: 1.25,
      ...overrides,
    })
    const enemyProjectiles = [
      projectile(101, 'arrow', 0x7da, 'normal', { x: 300, y: 315 }),
      projectile(102, 'arrow', 0x7da, 'fire', { x: 385, y: 315 }, {
        lightRegistration: { managerLane: 'transient', registrationOrdinal: 0 },
      }),
      projectile(103, 'arrow', 0x7da, 'poison', { x: 470, y: 315 }),
      projectile(104, 'firebolt', 0x7eb, 'fire', { x: 555, y: 315 }, {
        lightRegistration: { managerLane: 'transient', registrationOrdinal: 1 },
      }),
      projectile(105, 'guided-missile', 0x7ec, 'cold', { x: 640, y: 315 }, {
        lightRegistration: { managerLane: 'actor', registrationOrdinal: 8 },
      }),
      projectile(106, 'guided-missile', 0x7ec, 'poison', { x: 725, y: 315 }, {
        lightRegistration: { managerLane: 'actor', registrationOrdinal: 9 },
      }),
      projectile(107, 'demon-bomb', 0x7f7, 'none', { x: 810, y: 315 }, {
        lightRegistration: { managerLane: 'actor', registrationOrdinal: 10 },
      }),
      projectile(108, 'poison-pool', 0x806, 'poison', { x: 895, y: 315 }, {
        speed: 0,
        verticalOffset: 0,
        visualScale: 1.6,
      }),
    ]
    const effect = (
      id,
      kind,
      atlas,
      entry,
      blendMode,
      position,
      overrides = {},
    ) => ({
      ageTicks: 3,
      alpha: 0.75,
      atlas,
      blendMode,
      entry,
      id,
      kind,
      lifetimeTicks: 20,
      ownerActorId: id % 8 + 1,
      ownerProjectileId: 100 + id % 8 + 1,
      phaseOriginTicks: 120,
      position,
      rotationRadians: radians(12),
      scale: 1.2,
      spawnTick: 117,
      tint: 0xffffff,
      ...overrides,
    })
    const enemyProjectileEffects = [
      effect(201, 'fire-burst-frame', 'BadGuys', 253, 'add', { x: 280, y: 375 }),
      effect(202, 'fire-burst-glow', 'BadGuys', 110, 'normal', { x: 360, y: 375 }),
      effect(203, 'firebolt-trail', 'BadGuys', 260, 'normal', { x: 440, y: 375 }),
      effect(204, 'guided-impact-main', 'BadGuys', 110, 'add', { x: 520, y: 375 }, {
        alpha: 2,
        scale: 2,
      }),
      effect(205, 'guided-impact-aura-one', 'BadGuys', 111, 'add', { x: 600, y: 375 }, {
        alpha: 2,
        scale: 2,
      }),
      effect(206, 'guided-impact-aura-two', 'BadGuys', 112, 'add', { x: 680, y: 375 }, {
        alpha: 2,
        scale: 2,
      }),
      effect(207, 'demon-fire', 'DeadHawg', 46, 'normal', { x: 760, y: 375 }),
      effect(208, 'poison-pool-fade-outer', 'DeadHawg', 0, 'normal', { x: 840, y: 375 }),
      effect(209, 'poison-pool-fade-inner', 'DeadHawg', 0, 'normal', { x: 920, y: 375 }),
    ]
    const mageLightningPulses = [{
      contact: {
        kind: 'target-attached',
        localOffset: { x: 0, y: 0 },
        targetPlayerId: 'local',
      },
      endpoint: { x: playerPosition.x + 2, y: playerPosition.y - 4 },
      id: 91,
      midpoint: { x: 646, y: 259 },
      ownerActorId: 3,
      seed: 0x5d4a,
      source: { x: 700, y: 185 },
      tick: 120,
    }]
    const snapshotAt = (tick, advanced) => ({
      hostPlayerId: 'local',
      players: {
        local: {
          config: {
            discipline: 'arcane',
            displayName: 'Parity Probe',
            element: 'fire',
          },
          economy: economyModule.createHubEconomy(1),
          footstepTick: 0,
          gaitDegrees: 0,
          headingIndex: 0,
          lighting: {
            driveActive: false,
            lightRegistration: { managerLane: 'actor', registrationOrdinal: 0 },
            overlayEffectPhase: 0,
          },
          position: playerPosition,
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
        enemies: enemiesAt(advanced),
        enemyEvents: [],
        enemyProjectileEffects,
        enemyProjectiles: enemyProjectiles.map((source) => ({
          ...source,
          ageTicks: source.ageTicks + (advanced ? 1 : 0),
          visualPhaseDeg: source.kind === 'guided-missile'
            ? (advanced ? 570 : 540)
            : source.visualPhaseDeg,
        })),
        gateLeaves: [],
        kind: 'boneyard',
        lanternLightRegistration: null,
        mageLightningPulses,
        maggots: [{
          alpha: 1,
          currentHealth: 10,
          deathEpoch: 0,
          deathTick: 0,
          emergenceOrientation: 0,
          emergenceTick: 0,
          headingDeg: 0,
          hitFlash: 0,
          id: 301,
          launchTrajectory: 'edge',
          maximumHealth: 10,
          ownerCoffinActorId: 8,
          pose: advanced ? 1 : 0,
          position: { x: 930, y: 500 },
          spawnTick: 20,
          state: 'bite',
          verticalOffset: 0,
        }],
        runId,
        waves: null,
      },
    })
    const capture = (canvas) => {
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(canvas, 0, 0)
      return context.getImageData(0, 0, copy.width, copy.height).data
    }
    const compare = (first, second) => {
      let changedPixels = 0
      let channelDelta = 0
      for (let offset = 0; offset < second.length; offset += 4) {
        const delta = Math.abs(first[offset] - second[offset])
          + Math.abs(first[offset + 1] - second[offset + 1])
          + Math.abs(first[offset + 2] - second[offset + 2])
        if (delta > 3) changedPixels += 1
        channelDelta += delta
      }
      return { changedPixels, channelDelta }
    }

    const initialSnapshot = snapshotAt(120.25, false)
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot,
      playerId: 'local',
      viewport,
    })
    renderer.canvas.id = 'enemy-animation-projectile-vfx-probe'
    document.body.append(renderer.canvas)
    const initialPixels = capture(renderer.canvas)
    renderer.render(snapshotAt(121.75, true))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const advancedPixels = capture(renderer.canvas)

    const skeletonAttackSnapshotAt = (actionProgress) => {
      const snapshot = snapshotAt(130, false)
      return {
        ...snapshot,
        world: {
          ...snapshot.world,
          enemies: [makeEnemy(
            'SKELETON',
            1,
            1001,
            { x: 300, y: 190 },
            makeAnimation({
              action: 'skeleton-claw-a',
              actionProgress,
              bodyPose: 4,
              gaitPose: 6,
              state: 'action',
            }),
          )],
          enemyProjectileEffects: [],
          enemyProjectiles: [],
          mageLightningPulses: [],
          maggots: [],
        },
      }
    }
    const skeletonEarlySnapshot = skeletonAttackSnapshotAt(0)
    const skeletonLateSnapshot = skeletonAttackSnapshotAt(7)
    const skeletonEarlyRenderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: skeletonEarlySnapshot,
      playerId: 'local',
      viewport,
    })
    const skeletonEarlyPixels = capture(skeletonEarlyRenderer.canvas)
    const skeletonEarlyImage = document.createElement('img')
    skeletonEarlyImage.id = 'skeleton-attack-early-probe'
    skeletonEarlyImage.src = skeletonEarlyRenderer.canvas.toDataURL('image/png')
    document.body.append(skeletonEarlyImage)
    const skeletonLateRenderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: skeletonLateSnapshot,
      playerId: 'local',
      viewport,
    })
    const skeletonLatePixels = capture(skeletonLateRenderer.canvas)
    const skeletonLateImage = document.createElement('img')
    skeletonLateImage.id = 'skeleton-attack-late-probe'
    skeletonLateImage.src = skeletonLateRenderer.canvas.toDataURL('image/png')
    document.body.append(skeletonLateImage)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const skeletonPlanAt = (actionProgress) => presentationModule.nativeEnemyPresentationPlan(
      makeEnemy(
        'SKELETON',
        1,
        1001,
        { x: 300, y: 190 },
        makeAnimation({
          action: 'skeleton-claw-a',
          actionProgress,
          bodyPose: 4,
          gaitPose: 6,
          state: 'action',
        }),
      ),
      130,
      () => [],
    ).layers.map(({ entry, role }) => ({ entry, role }))
    window.__enemyVfxRenderer = renderer
    window.__skeletonEarlyRenderer = skeletonEarlyRenderer
    window.__skeletonLateRenderer = skeletonLateRenderer
    return {
      animationDifference: compare(initialPixels, advancedPixels),
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      frame: structuredClone(renderer.canvas.__sdrBoneyardFrame),
      renderer: renderer.canvas.dataset.gameRenderer,
      rendererName: renderer.canvas.dataset.rendererName,
      skeletonAttackDifference: compare(
        skeletonEarlyPixels,
        skeletonLatePixels,
      ),
      skeletonAttackLayers: {
        early: skeletonPlanAt(0),
        late: skeletonPlanAt(7),
      },
    }
  })

  const expectedFamilies = [
    'COFFIN',
    'DEMON',
    'IMP',
    'SKELETON',
    'SKELETONARCHER',
    'SKELETONMAGE',
    'WRAITH',
    'ZOMBIE',
  ].join(',')
  assert.equal(receipt.renderer, 'pixi-webgl')
  assert.match(receipt.rendererName.toLowerCase(), /webgl/)
  assert.equal(receipt.context, 'webgl2')
  assert.equal(receipt.frame.enemyCount, 8)
  assert.equal(receipt.frame.enemyFamilies, expectedFamilies)
  assert.equal(receipt.frame.enemyProjectileCount, 8)
  assert.equal(receipt.frame.enemyProjectileEffectCount, 9)
  assert.deepEqual(receipt.frame.enemyProjectileIds, [101, 102, 103, 104, 105, 106, 107, 108])
  assert.deepEqual(receipt.frame.enemyProjectileEffectIds, [201, 202, 203, 204, 205, 206, 207, 208, 209])
  assert.equal(receipt.frame.maggotCount, 1)
  assert.equal(receipt.frame.mageLightningCount, 1)
  assert.ok(receipt.animationDifference.changedPixels > 1_000)
  assert.ok(receipt.animationDifference.channelDelta > 10_000)
  assert.ok(
    receipt.skeletonAttackDifference.changedPixels > 100,
    JSON.stringify(receipt.skeletonAttackDifference),
  )
  assert.ok(
    receipt.skeletonAttackDifference.channelDelta > 1_000,
    JSON.stringify(receipt.skeletonAttackDifference),
  )
  assert.deepEqual(receipt.skeletonAttackLayers, {
    early: [
      { entry: 1693, role: 'skeleton-limbs' },
      { entry: 1189, role: 'skeleton-body' },
      { entry: 1477, role: 'skeleton-headgear' },
    ],
    late: [
      { entry: 1693, role: 'skeleton-limbs' },
      { entry: 1315, role: 'skeleton-body' },
      { entry: 1477, role: 'skeleton-headgear' },
    ],
  })
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])

  await page.locator('#enemy-animation-projectile-vfx-probe').screenshot({
    path: screenshotPath,
  })
  await page.locator('#skeleton-attack-early-probe').screenshot({
    path: skeletonEarlyScreenshotPath,
  })
  await page.locator('#skeleton-attack-late-probe').screenshot({
    path: skeletonLateScreenshotPath,
  })
  await page.evaluate(() => {
    window.__enemyVfxRenderer.destroy()
    window.__skeletonEarlyRenderer.destroy()
    window.__skeletonLateRenderer.destroy()
    document.body.replaceChildren()
  })

  console.log(JSON.stringify({
    ...receipt,
    consoleErrors,
    failedResponses,
    pageErrors,
    screenshotPath,
    skeletonEarlyScreenshotPath,
    skeletonLateScreenshotPath,
  }, null, 2))
} finally {
  await browser.close()
}

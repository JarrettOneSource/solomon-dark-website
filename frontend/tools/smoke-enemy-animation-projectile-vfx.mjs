import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { chromium } from 'playwright-core'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4182'
const screenshotPath = process.env.SDR_ENEMY_VFX_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-enemy-animation-projectile-vfx-20260815.png')
const impContactScreenshotPath = process.env.SDR_IMP_CONTACT_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-imp-contact-authority-20260823.png')
const skeletonEarlyScreenshotPath = process.env.SDR_SKELETON_ATTACK_EARLY_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-skeleton-attack-early-20260816.png')
const skeletonLateScreenshotPath = process.env.SDR_SKELETON_ATTACK_LATE_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-skeleton-attack-late-20260816.png')
const skeletonHeadTurnScreenshotPath = process.env.SDR_SKELETON_HEAD_TURN_SCREENSHOT
  || join(tmpdir(), 'solomon-dark-skeleton-head-turn-20260820.png')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')

const browser = await chromium.launch({
  executablePath: chromePath,
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
  await page.addInitScript(installGameAudioSmokeProbe)

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
      ambientAudioModule,
      animationModule,
      assetModule,
      audioAssetsModule,
      audioBrowserModule,
      economyModule,
      enemyProjectionModule,
      enemyStoreModule,
      playerModule,
      presentationModule,
      rendererModule,
      spellModule,
    ] = await Promise.all([
      import('/src/game/boneyard-enemy-ambient-audio.ts'),
      import('/src/game/renderer/native-enemy-animation.ts'),
      import('/src/game/renderer/native-enemy-assets.ts'),
      import('/src/game/game-audio-assets.ts'),
      import('/src/game/game-audio-browser.ts'),
      import('/src/game/core-kernels/hub-economy.ts'),
      import('/src/game/host/project-boneyard-enemies.ts'),
      import('/src/game/core-server/boneyard-enemy-store.ts'),
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
      mageCloak: false,
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
          headFacingOffset: advanced ? -1 : 0,
          state: 'action',
        }),
        ['FLAG_ARMOR', 'FLAG_HOODED', 'FLAG_MACE', 'FLAG_BURNING'],
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
        ['FLAG_HELM', 'FLAG_POISONARROW'],
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
          headFacingOffset: advanced ? 1 : 0,
          state: 'action',
        }),
        ['FLAG_HORNED', 'FLAG_CASTLIGHTNING'],
      ),
      makeEnemy(
        'IMP',
        4,
        1004,
        { x: 880, y: 190 },
        makeAnimation({
          bodyPose: advanced ? 1 : 3,
          impBodyRotationRadians: advanced ? radians(-30) : radians(35),
          impEffectAlpha: advanced ? 0.45 : 0.9,
          impEffectFrame: advanced ? 9 : 4,
          state: 'locomotion',
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
        ['FLAG_ROTTEN'],
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
        ['FLAG_BURNING'],
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
      lightRegistration: kind === 'fire-burst-glow'
        ? { managerLane: 'transient', registrationOrdinal: 11 }
        : null,
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
      effect(207, 'demon-fire', 'DeadHawg', 46, 'add', { x: 760, y: 375 }),
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
      levelUpBarrier: null,
      modEffects: [],
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
            lastDamageTick: null,
            maximumHealth: 50,
            maximumMana: 100,
            nextThreshold: 100,
            pendingOffer: null,
            poisonDamagePerTick: 0,
            poisonTicksRemaining: 0,
            previousThreshold: 0,
            revision: 0,
            sorcerorsCharmAvailable: false,
            skillQuickbar: [null, null, null, null, null, null, null, null],
          },
          velocity: { x: 0, y: 0 },
          walkCyclePrimary: 0,
        },
      },
      primarySpells: spellModule.createPrimarySpellSimulation(),
      secondaryAbilities: {
        actors: [],
        events: [],
        nextActorId: 1,
        nextEventId: 1,
        players: {
          local: {
            castSequence: 0,
            castSpinTicksRemaining: 0,
            cooldownMaximumTicksBySkill: Array(83).fill(0),
            cooldownTicksBySkill: Array(83).fill(0),
            firewalker: false,
            fizzleSequence: 0,
            globalCooldownTicks: 0,
            heldSlot: null,
            lastSkillId: null,
            magicShieldAbsorb: 0,
            magicShieldExplosionDamage: 0,
            magicShieldMaximum: 0,
            magicShieldPulseTicks: 0,
            mindstar: false,
            planeOrbHeld: false,
            planewalkerTicksRemaining: 0,
            regenerate: false,
            reservedMana: 0,
            staffCastTicksRemaining: 0,
            stoneskinTicksRemaining: 0,
          },
        },
        targetEffects: [],
      },
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
        goodies: [],
        kind: 'boneyard',
        lanternLightRegistration: null,
        loot: [],
        lootEvents: [],
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
    const copyCanvas = (canvas) => {
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      const context = copy.getContext('2d', { willReadFrequently: true })
      context.drawImage(canvas, 0, 0)
      return copy
    }
    const cropCanvas = (source, x, y, width, height) => {
      const crop = document.createElement('canvas')
      crop.width = width
      crop.height = height
      crop.getContext('2d').drawImage(
        source,
        x,
        y,
        width,
        height,
        0,
        0,
        width,
        height,
      )
      return crop
    }
    const capture = (canvas) => {
      const copy = copyCanvas(canvas)
      return copy.getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, copy.width, copy.height).data
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

    const initialSnapshot = snapshotAt(120, false)
    const auxiliaryPlans = Object.fromEntries(enemiesAt(true).map((enemy) => [
      enemy.enemyToken,
      presentationModule.nativeEnemyPresentationPlan(
        enemy,
        121.75,
        (atlas, entry) => assetModule.nativeEnemySpriteRecord(atlas, entry).points,
      ).layers.map(({ entry, role }) => ({ entry, role })),
    ]))
    const ambientRequests = ambientAudioModule.nativeBoneyardEnemyAmbientRequests(
      snapshotAt(121.75, true),
      () => 1,
    )
    await Promise.all(ambientAudioModule.BONEYARD_ENEMY_AMBIENT_CUES.map((cue) => (
      audioBrowserModule.loadGameAudioAsset(audioAssetsModule.GAME_AUDIO_SOURCES.loops[cue])
    )))
    const audioEventStart = window.__sdrAudioEvents.length
    const ambientDirector = audioBrowserModule.createBrowserGameAudioDirector()
    ambientDirector.unlock()
    const ambientAudio = new ambientAudioModule.BoneyardEnemyAmbientAudioSynchronizer(
      ambientDirector,
    )
    ambientAudio.update(snapshotAt(121.75, true), () => 1)
    ambientAudio.update({ world: { enemies: [], maggots: [] } }, () => 1)
    ambientAudio.destroy()
    ambientDirector.destroy()
    const ambientAudioEvents = window.__sdrAudioEvents.slice(audioEventStart)
      .filter(({ type }) => type === 'buffer-start' || type === 'buffer-stop')
      .map((event) => ({
        cue: ambientAudioModule.BONEYARD_ENEMY_AMBIENT_CUES.find((cue) => (
          window.__sdrAudioSourceMatches(
            event.src,
            audioAssetsModule.GAME_AUDIO_SOURCES.loops[cue],
          )
        )),
        loop: event.loop,
        type: event.type,
        volume: event.volume,
      }))
    const renderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot,
      modAssets: [],
      modCatalog: [],
      playerId: 'local',
      viewport,
    })
    renderer.canvas.id = 'enemy-animation-projectile-vfx-canvas'
    document.body.append(renderer.canvas)
    const initialPixels = capture(renderer.canvas)
    renderer.consumeEnemyEvent({
      actorId: 4,
      eventId: 899,
      gainScale: 1,
      pitch: 1.05,
      runId,
      sound: 'imp-vocal-1',
      sourcePosition: { x: 880, y: 190 },
      tick: 120.5,
      type: 'enemy-action-sound',
    })
    renderer.consumeEnemyEvent({
      actorId: 4,
      eventId: 900,
      runId,
      targetPlayerId: 'local',
      tick: 120.5,
      type: 'attack-marker',
    })
    renderer.consumeEnemyEvent({
      actorId: 7,
      eventId: 901,
      runId,
      targetPlayerId: 'local',
      tick: 120.5,
      type: 'attack-marker',
    })
    renderer.render(snapshotAt(121.75, true))
    const enemyVfxCopy = copyCanvas(renderer.canvas)
    const advancedPixels = enemyVfxCopy.getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, enemyVfxCopy.width, enemyVfxCopy.height).data
    const enemyVfxImage = document.createElement('img')
    enemyVfxImage.id = 'enemy-animation-projectile-vfx-probe'
    enemyVfxImage.src = enemyVfxCopy.toDataURL('image/png')
    document.body.append(enemyVfxImage)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const impTarget = {
      alive: true,
      collisionRadius: 25,
      connected: true,
      eligible: true,
      headingDeg: 90,
      position: playerPosition,
      velocityPerTick: { x: 0, y: 0 },
    }
    const stepImpAuthority = (store, tick, spawnIntents = []) => (
      enemyStoreModule.stepBoneyardEnemyStore(store, {
        firstProjectileWorldContact: () => null,
        players: { local: impTarget },
        resolveMovement: ({ requestedPosition }) => requestedPosition,
        resolveSpawnIntents: () => spawnIntents,
        tick,
      })
    )
    let impAuthority = stepImpAuthority(
      enemyStoreModule.createBoneyardEnemyStore('imp-browser-authority'),
      0,
      [{
        enemyToken: 'IMP',
        flags: [],
        id: 1,
        locationPolicy: 'anywhere',
        nativeTypeId: 1004,
        position: { x: playerPosition.x + 50, y: playerPosition.y },
        spawnTick: 0,
        waveOrdinal: 10,
      }],
    )
    impAuthority = stepImpAuthority(impAuthority.store, 1)
    const impSnapshot = (store, tick, events = []) => {
      const source = snapshotAt(tick, false)
      return {
        ...source,
        players: {
          ...source.players,
          local: {
            ...source.players.local,
            lighting: {
              ...source.players.local.lighting,
              lightRegistration: { managerLane: 'actor', registrationOrdinal: 100 },
            },
          },
        },
        world: {
          ...source.world,
          deathEffects: enemyProjectionModule.projectBoneyardEnemyDeathEffects(store),
          enemies: enemyProjectionModule.projectBoneyardEnemies(store, tick),
          enemyEvents: events.map((event) => ({ ...event, runId })),
          enemyProjectileEffects:
            enemyProjectionModule.projectBoneyardEnemyProjectileEffects(store),
          enemyProjectiles: enemyProjectionModule.projectBoneyardEnemyProjectiles(store),
          mageLightningPulses: [],
          maggots: enemyProjectionModule.projectBoneyardMaggots(store, tick),
        },
      }
    }
    const impBeforeSnapshot = impSnapshot(impAuthority.store, 1)
    const impRenderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: impBeforeSnapshot,
      modAssets: [],
      modCatalog: [],
      playerId: 'local',
      viewport,
    })
    impRenderer.canvas.id = 'imp-authority-canvas'
    document.body.append(impRenderer.canvas)
    const impBeforeCrop = cropCanvas(copyCanvas(impRenderer.canvas), 760, 350, 220, 200)
    const impBeforePixels = capture(impBeforeCrop)
    impAuthority = stepImpAuthority(impAuthority.store, 2)
    for (const event of impAuthority.events) {
      impRenderer.consumeEnemyEvent({ ...event, runId })
    }
    const impContactSnapshot = impSnapshot(impAuthority.store, 2, impAuthority.events)
    impRenderer.render(impContactSnapshot)
    const impContactCrop = cropCanvas(copyCanvas(impRenderer.canvas), 760, 350, 220, 200)
    const impContactPixels = capture(impContactCrop)
    const impContactImage = document.createElement('img')
    impContactImage.id = 'imp-authority-contact-probe'
    impContactImage.src = impContactCrop.toDataURL('image/png')
    document.body.append(impContactImage)
    const impActor = impAuthority.store.actors[0]
    if (!impActor || impActor.brain.family !== 'imp') {
      throw new Error('controlled Imp authority lost its actor')
    }
    const impAuthorityReceipt = {
      action: impContactSnapshot.world.enemies[0]?.animation.action,
      auxiliaryEffectCount: impRenderer.canvas.__sdrBoneyardFrame.enemyAuxiliaryEffectCount,
      auxiliaryEffectLanes:
        impRenderer.canvas.__sdrBoneyardFrame.enemyAuxiliaryEffectLanes,
      damageCount: impAuthority.playerDamage.length,
      escapeHeadingDeg: impActor.brain.escapeHeadingDeg,
      horizontalSpeed: impActor.brain.horizontalSpeed,
      phase: impActor.brain.phase,
      pixelDifference: compare(impBeforePixels, impContactPixels),
      sounds: impAuthority.events
        .filter(({ type }) => type === 'enemy-action-sound')
        .map(({ sound }) => sound),
      types: impAuthority.events.map(({ type }) => type),
      upperAlpha: impActor.brain.effectAlpha,
      verticalOffset: impActor.brain.verticalOffset,
    }
    impRenderer.destroy()
    impRenderer.canvas.remove()

    const skeletonAttackSnapshotAt = (actionProgress, headFacingOffset = 0) => {
      const snapshot = snapshotAt(130, false)
      return {
        ...snapshot,
        world: {
          ...snapshot.world,
          enemies: [makeEnemy(
            'SKELETON',
            1,
            1001,
            { x: 500, y: 333 },
            makeAnimation({
              action: 'skeleton-claw-a',
              actionProgress,
              bodyPose: 4,
              gaitPose: 6,
              headFacingOffset,
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
    const skeletonHeadTurnSnapshot = skeletonAttackSnapshotAt(7, -1)
    const skeletonRenderer = await rendererModule.createBoneyardWorldRenderer({
      boneyard: loaded,
      devicePixelRatio: 1,
      initialSnapshot: skeletonEarlySnapshot,
      modAssets: [],
      modCatalog: [],
      playerId: 'local',
      viewport,
    })
    const skeletonEarlyCopy = copyCanvas(skeletonRenderer.canvas)
    const skeletonEarlyCrop = cropCanvas(skeletonEarlyCopy, 600, 375, 160, 160)
    const skeletonEarlyPixels = skeletonEarlyCrop
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, skeletonEarlyCrop.width, skeletonEarlyCrop.height).data
    const skeletonEarlyImage = document.createElement('img')
    skeletonEarlyImage.id = 'skeleton-attack-early-probe'
    skeletonEarlyImage.src = skeletonEarlyCrop.toDataURL('image/png')
    document.body.append(skeletonEarlyImage)
    skeletonRenderer.render(skeletonLateSnapshot)
    const skeletonLateCopy = copyCanvas(skeletonRenderer.canvas)
    const skeletonLateCrop = cropCanvas(skeletonLateCopy, 600, 375, 160, 160)
    const skeletonLatePixels = skeletonLateCrop
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, skeletonLateCrop.width, skeletonLateCrop.height).data
    const skeletonLateImage = document.createElement('img')
    skeletonLateImage.id = 'skeleton-attack-late-probe'
    skeletonLateImage.src = skeletonLateCrop.toDataURL('image/png')
    document.body.append(skeletonLateImage)
    skeletonRenderer.render(skeletonHeadTurnSnapshot)
    const skeletonHeadTurnCopy = copyCanvas(skeletonRenderer.canvas)
    const skeletonHeadTurnCrop = cropCanvas(skeletonHeadTurnCopy, 600, 375, 160, 160)
    const skeletonHeadTurnPixels = skeletonHeadTurnCrop
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, skeletonHeadTurnCrop.width, skeletonHeadTurnCrop.height).data
    const skeletonHeadTurnImage = document.createElement('img')
    skeletonHeadTurnImage.id = 'skeleton-head-turn-probe'
    skeletonHeadTurnImage.src = skeletonHeadTurnCrop.toDataURL('image/png')
    document.body.append(skeletonHeadTurnImage)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const skeletonPlanAt = (actionProgress, headFacingOffset = 0) => (
      presentationModule.nativeEnemyPresentationPlan(
        makeEnemy(
          'SKELETON',
          1,
          1001,
          { x: 500, y: 333 },
          makeAnimation({
            action: 'skeleton-claw-a',
            actionProgress,
            bodyPose: 4,
            gaitPose: 6,
            headFacingOffset,
            state: 'action',
          }),
        ),
        130,
        () => [],
      ).layers.map(({ entry, role }) => ({ entry, role }))
    )
    window.__enemyVfxRenderer = renderer
    window.__skeletonRenderer = skeletonRenderer
    return {
      animationDifference: compare(initialPixels, advancedPixels),
      ambientAudioEvents,
      ambientRequests,
      auxiliaryPlans,
      context: renderer.canvas.getContext('webgl2') ? 'webgl2' : 'webgl',
      frame: structuredClone(renderer.canvas.__sdrBoneyardFrame),
      impAuthority: impAuthorityReceipt,
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
      skeletonHeadDifference: compare(
        skeletonLatePixels,
        skeletonHeadTurnPixels,
      ),
      skeletonHeadLayers: {
        base: skeletonPlanAt(7),
        turned: skeletonPlanAt(7, -1),
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
  assert.equal(receipt.frame.enemyAuxiliaryEffectCount, 3)
  assert.deepEqual(receipt.frame.enemyAuxiliaryEffectLanes, [
    'pre-world-queue',
    'world-sorted',
    'post-world-queue',
  ])
  assert.equal(receipt.frame.enemyFamilies, expectedFamilies)
  assert.equal(receipt.frame.enemyProjectileCount, 8)
  assert.equal(receipt.frame.enemyProjectileEffectCount, 9)
  assert.deepEqual(receipt.frame.enemyProjectileIds, [101, 102, 103, 104, 105, 106, 107, 108])
  assert.deepEqual(receipt.frame.enemyProjectileEffectIds, [201, 202, 203, 204, 205, 206, 207, 208, 209])
  assert.equal(receipt.frame.maggotCount, 1)
  assert.equal(receipt.frame.mageLightningCount, 1)
  assert.equal(receipt.impAuthority.action, null)
  assert.equal(receipt.impAuthority.auxiliaryEffectCount, 2)
  assert.deepEqual(receipt.impAuthority.auxiliaryEffectLanes, [
    'pre-world-queue',
    'world-sorted',
  ])
  assert.equal(receipt.impAuthority.damageCount, 1)
  assert.equal(receipt.impAuthority.phase, 'flight')
  assert.ok(receipt.impAuthority.escapeHeadingDeg !== null)
  assert.ok(
    receipt.impAuthority.horizontalSpeed >= 4.5
      && receipt.impAuthority.horizontalSpeed <= 11.25,
  )
  assert.equal(receipt.impAuthority.upperAlpha, 1)
  assert.equal(receipt.impAuthority.verticalOffset, 0)
  assert.deepEqual(receipt.impAuthority.types, [
    'enemy-action-sound',
    'enemy-action-sound',
    'attack-marker',
  ])
  assert.match(receipt.impAuthority.sounds[0], /^imp-vocal-[1-8]$/)
  assert.match(receipt.impAuthority.sounds[1], /^bite-[1-3]$/)
  assert.ok(receipt.impAuthority.pixelDifference.changedPixels > 50)
  assert.ok(receipt.impAuthority.pixelDifference.channelDelta > 1_000)
  assert.deepEqual(receipt.ambientRequests, [
    { cue: 'flyblown-loop', gain: 1 },
    { cue: 'maggots-loop', gain: 0.0025 },
    { cue: 'soul-loop', gain: 1 },
  ])
  const ambientStarts = receipt.ambientAudioEvents.filter(({ type }) => (
    type === 'buffer-start'
  ))
  assert.deepEqual(
    ambientStarts.map(({ cue, loop, type }) => ({ cue, loop, type })),
    [
      { cue: 'flyblown-loop', loop: true, type: 'buffer-start' },
      { cue: 'maggots-loop', loop: true, type: 'buffer-start' },
      { cue: 'soul-loop', loop: true, type: 'buffer-start' },
    ],
  )
  assert.equal(ambientStarts[0]?.volume, 1)
  assert.ok(Math.abs(ambientStarts[1].volume - 0.0025) < 1e-9)
  assert.equal(ambientStarts[2]?.volume, 1)
  assert.deepEqual(
    receipt.ambientAudioEvents.filter(({ type }) => type === 'buffer-stop')
      .map(({ cue }) => cue),
    ['flyblown-loop', 'maggots-loop', 'soul-loop'],
  )
  assert.ok(receipt.auxiliaryPlans.SKELETON.some(({ role }) => (
    role === 'skeleton-mace-head'
  )))
  assert.ok(receipt.auxiliaryPlans.SKELETONARCHER.some(({ role }) => (
    role === 'archer-held-poison-arrow'
  )))
  assert.equal(receipt.auxiliaryPlans.SKELETONMAGE.filter(({ role }) => (
    role.startsWith('mage-lightning-charge:')
  )).length, 4)
  assert.equal(receipt.auxiliaryPlans.ZOMBIE.filter(({ role }) => (
    role.startsWith('zombie-gas-cloud:')
  )).length, 2)
  assert.ok(receipt.auxiliaryPlans.ZOMBIE.filter(({ role }) => (
    role.startsWith('zombie-fly:')
  )).length >= 5)
  assert.ok(receipt.auxiliaryPlans.WRAITH.some(({ role }) => (
    role.startsWith('wraith-soul-wisp:')
  )))
  assert.equal(receipt.auxiliaryPlans.DEMON.filter(({ role }) => (
    role.startsWith('demon-flame:')
  )).length, 5)
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
  assert.ok(
    receipt.skeletonHeadDifference.changedPixels > 10,
    JSON.stringify(receipt.skeletonHeadDifference),
  )
  assert.ok(
    receipt.skeletonHeadDifference.channelDelta > 100,
    JSON.stringify(receipt.skeletonHeadDifference),
  )
  assert.deepEqual(receipt.skeletonHeadLayers, {
    base: [
      { entry: 1693, role: 'skeleton-limbs' },
      { entry: 1315, role: 'skeleton-body' },
      { entry: 1477, role: 'skeleton-headgear' },
    ],
    turned: [
      { entry: 1693, role: 'skeleton-limbs' },
      { entry: 1315, role: 'skeleton-body' },
      { entry: 1494, role: 'skeleton-headgear' },
    ],
  })
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])

  await page.locator('#enemy-animation-projectile-vfx-probe').screenshot({
    path: screenshotPath,
  })
  await page.locator('#imp-authority-contact-probe').screenshot({
    path: impContactScreenshotPath,
  })
  await page.locator('#skeleton-attack-early-probe').screenshot({
    path: skeletonEarlyScreenshotPath,
  })
  await page.locator('#skeleton-attack-late-probe').screenshot({
    path: skeletonLateScreenshotPath,
  })
  await page.locator('#skeleton-head-turn-probe').screenshot({
    path: skeletonHeadTurnScreenshotPath,
  })
  await page.evaluate(() => {
    window.__enemyVfxRenderer.destroy()
    window.__skeletonRenderer.destroy()
    document.body.replaceChildren()
  })

  console.log(JSON.stringify({
    ...receipt,
    consoleErrors,
    failedResponses,
    impContactScreenshotPath,
    pageErrors,
    screenshotPath,
    skeletonEarlyScreenshotPath,
    skeletonHeadTurnScreenshotPath,
    skeletonLateScreenshotPath,
  }, null, 2))
} finally {
  await browser.close()
}

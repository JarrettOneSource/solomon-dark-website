import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { solomonContactContains } from '../src/game/core-kernels/boneyard-encounter.ts'
import { BONEYARD_GATE_INITIAL_SWAY } from '../src/game/core-kernels/boneyard-gate.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import {
  PRIMARY_CAST_ACTION_END_TICK,
  PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  PRIMARY_SPELL_RANK_ONE_MANA_COSTS,
} from '../src/game/core-kernels/primary-spells.ts'
import {
  createBoneyardCollisionWorld,
  firstBoneyardPathBlockProgress,
  resolveBoneyardMovement,
} from '../src/game/core-server/boneyard-collision.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  EntityReplicationReconstructor,
  REPLICATED_ENTITY_TYPES,
} from '../src/game/protocol/entity-replication.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const deterministicSeedBytes = Buffer.alloc(16)
const expectedBoneyardSeed = deterministicSeedBytes.toString('hex')
const FIRE_ENGAGEMENT_MIN_DISTANCE = 70
const FIRE_ENGAGEMENT_MAX_DISTANCE = 135
const COMBAT_ENTRY_GATE_MARGIN = 40
const MINIMUM_SKELETON_COLLISION_RADIUS = 12
const fireCastDriver = { nextReadyTick: 0 }
const screenshotPath = process.env.SDR_GAME_WAVES_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-solomon-waves.png'
const speakingScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-speaking$1')
const combatScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-combat$1')
const archerScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-archer-projectile$1')
const deathScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-death$1')
const gameOverScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-game-over$1')
const loadoutScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-loadout$1')
const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local smoke-test port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  createBoneyardSeedBytes: () => Buffer.from(deterministicSeedBytes),
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
const wire = observeGameWire(page, host.address.url)
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
await page.addInitScript((runtime) => {
  window.solomonDarkRuntime = runtime
}, {
  gameEndpoint: {
    credential,
    kind: 'localhost',
    url: host.address.url,
  },
})
await page.addInitScript(installGameAudioSmokeProbe)

try {
  await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene')
  const initial = await encounterReceipt(scene)
  assert.equal(initial.phase, 'digging')
  assert.equal(initial.wavePhase, 'dormant')
  assert.equal(initial.liveEnemies, 0)
  const loadedBoneyard = await waitForWireValue(
    page,
    wire,
    (receipt) => receipt.loadedBoneyard,
    10_000,
    'the first loaded Boneyard',
  )
  assert.ok(loadedBoneyard?.scene?.solomonDig, 'expected the loaded Solomon Dig scene')
  assert.equal(loadedBoneyard.seed, expectedBoneyardSeed)
  const combatNavigation = {
    bounds: loadedBoneyard.scene.bounds,
    collision: createBoneyardCollisionWorld(loadedBoneyard.scene),
    scene: loadedBoneyard.scene,
  }

  const gateCrossing = await crossNearestEntryGate(page, scene, loadedBoneyard.scene)
  combatNavigation.entryGate = {
    direction: gateCrossing.direction,
    y: gateCrossing.target.y,
  }
  const approach = await walkToSolomon(page, scene, loadedBoneyard.scene)
  assert.notEqual(approach.phase, 'digging')

  await page.waitForFunction(() => (
    Number(document.querySelector('.boneyard-scene')
      ?.getAttribute('data-solomon-voice-event-id')) >= 1
  ), undefined, { timeout: 15_000 })
  const hello = await encounterReceipt(scene)
  assert.equal(hello.phase, 'speaking')
  assert.match(hello.voiceCue, /^solomon-hello-[1-4]$/)
  assert.ok(hello.renderFrame >= 213 && hello.renderFrame <= 227)
  const mouthPoses = [hello.mouthPose]
  const headings = [hello.heading]
  const changedMouthHandle = await page.waitForFunction((initialPose) => {
    const scene = document.querySelector('.boneyard-scene')
    const mouthPose = Number(scene?.getAttribute('data-solomon-mouth-pose'))
    if (
      scene?.getAttribute('data-solomon-phase') !== 'speaking'
      || mouthPose === initialPose
    ) return null
    return {
      heading: Number(scene.getAttribute('data-solomon-heading')),
      mouthPose,
    }
  }, hello.mouthPose, { timeout: 5_000 })
  const animatedSpeech = await changedMouthHandle.jsonValue()
  mouthPoses.push(animatedSpeech.mouthPose)
  headings.push(animatedSpeech.heading)
  assert.ok(
    new Set(mouthPoses).size > 1,
    `expected speaking mouth animation (${mouthPoses.join(', ')})`,
  )
  await page.screenshot({ path: speakingScreenshotPath })
  await page.waitForFunction((cue) => (
    window.__sdrAudioPlaySources?.some((source) => source.includes(cue))
  ), hello.voiceCue, { timeout: 5_000 })

  const escapeKeys = movementKeys({
    x: approach.contactPosition.x - loadedBoneyard.scene.solomonDig.position.x,
    y: approach.contactPosition.y - loadedBoneyard.scene.solomonDig.position.y,
  })
  assert.ok(escapeKeys.length > 0, 'expected a movement direction away from Solomon')
  for (const key of escapeKeys) await page.keyboard.down(key)
  let opening
  let runEdge
  try {
    await page.waitForFunction(() => (
      Number(document.querySelector('.boneyard-scene')
        ?.getAttribute('data-solomon-run-event-id')) === 1
    ), undefined, { timeout: 15_000 })
    runEdge = await encounterReceipt(scene)
    assert.ok(runEdge.phase === 'escaping' || runEdge.phase === 'gone')
    await page.screenshot({ path: screenshotPath })
    await page.waitForFunction(() => {
      const scene = document.querySelector('.boneyard-scene')
      return Number(scene?.getAttribute('data-wave-live-enemy-count')) >= 10
        && window.__sdrAudioPlaySources?.some((source) => source.includes('solomon-laugh-1'))
    }, undefined, { timeout: 10_000 })
    opening = await encounterReceipt(scene)
  } finally {
    for (const key of escapeKeys) await page.keyboard.up(key)
  }
  assert.ok(opening.wavePhase === 'opening' || opening.wavePhase === 'opening-threshold')
  assert.ok(opening.liveEnemies >= 10 && opening.liveEnemies <= 15)
  assert.equal(opening.liveEnemies + opening.pendingSpawnBudget, 15)
  assert.equal(opening.waveOrdinal, 0)

  await installEnemyActionProbe(page)
  const combat = await castUntilEnemyDies(page, { navigation: combatNavigation })
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return scene?.getAttribute('data-last-enemy-event-output') === 'skeleton-shatter'
      && window.__sdrAudioPlaySources?.some((source) => source.includes('skeleton-die'))
  }, undefined, { timeout: 30_000 })
  combat.enemyTerminalOutput = await scene.getAttribute('data-last-enemy-event-output')
  await page.screenshot({ path: combatScreenshotPath })
  const locomotion = await kiteUntilSolomonTaunt(page, combatNavigation)
  const taunt = await encounterReceipt(scene)
  assert.equal(taunt.voiceCue, 'solomon-get-him-boys')
  assert.equal(taunt.voiceEventId, 3)
  assert.ok(taunt.liveEnemies >= 9 && taunt.liveEnemies <= 15)
  const archer = await proveArcherProjectileLifecycle(
    page,
    wire,
    loadedBoneyard.runId,
    archerScreenshotPath,
    combatNavigation,
  )
  const death = await waitForPlayerDeath(page)
  await page.screenshot({ path: deathScreenshotPath })
  const gameOver = page.getByRole('button', { name: 'Game over. Continue to loadout.' })
  await gameOver.waitFor({ timeout: 180_000 })
  const gameOverFrame = await boneyardFrame(page)
  assert.equal(gameOverFrame.runPhase, 'game-over')
  assert.ok(gameOverFrame.runGameOverTicks >= 1_000)
  await page.screenshot({ path: gameOverScreenshotPath })
  await gameOver.click()
  const retainedLoadout = page.locator(
    '.create-menu-scene[data-retained-loadout="true"][data-motion-settled="true"]',
  )
  await retainedLoadout.waitFor({ timeout: 90_000 })
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 30_000 })
  assert.equal(await retainedLoadout.getAttribute('data-element'), 'fire')
  await page.screenshot({ path: loadoutScreenshotPath })

  const firstRunId = gameOverFrame.runId
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.waitForFunction((priorRunId) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.runPhase === 'active' && frame.runId !== priorRunId
  }, firstRunId, { timeout: 30_000 })
  const secondRun = await boneyardFrame(page)
  const secondLoadedBoneyard = await waitForWireValue(
    page,
    wire,
    (receipt) => (
      receipt.loadedBoneyard?.runId !== firstRunId
        ? receipt.loadedBoneyard
        : null
    ),
    10_000,
    'the second loaded Boneyard',
  )
  assert.notEqual(secondRun.runId, firstRunId)
  assert.equal(secondLoadedBoneyard.runId, secondRun.runId)
  assert.equal(secondLoadedBoneyard.seed, expectedBoneyardSeed)
  assert.equal(secondRun.localPlayerHealth, 50)
  assert.equal(secondRun.localPlayerMana, 100)
  assert.equal(secondRun.localPlayerLifeState, 'alive')
  assert.equal(secondRun.enemyCount, 0)
  assert.equal(await scene.getAttribute('data-solomon-phase'), 'digging')

  const audioPlaySources = await page.evaluate(() => (
    [...new Set(window.__sdrAudioPlaySources ?? [])]
  ))
  assert.ok(audioPlaySources.some((source) => source.includes(hello.voiceCue)))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-laugh-1')))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-get-him-boys')))
  assert.ok(audioPlaySources.some((source) => source.includes('throw-fire')))
  assert.ok(audioPlaySources.some((source) => source.includes('skeleton-die')))
  assert.ok(audioPlaySources.some((source) => source.includes('death-guitar')))
  assert.deepEqual(wire.errors, [])
  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    approach,
    archer,
    archerScreenshotPath,
    audioPlaySources,
    combat,
    combatScreenshotPath,
    death,
    deathScreenshotPath,
    errors,
    gateCrossing,
    gameOverFrame,
    gameOverScreenshotPath,
    headings: [...new Set(headings)],
    hello,
    loadoutScreenshotPath,
    locomotion,
    mouthPoses: [...new Set(mouthPoses)],
    opening,
    runEdge,
    screenshotPath,
    secondRun,
    secondLoadedBoneyard: {
      runId: secondLoadedBoneyard.runId,
      seed: secondLoadedBoneyard.seed,
    },
    speakingScreenshotPath,
    status: 'ok',
    taunt,
  })}\n`)
} catch (error) {
  await page.screenshot({ path: screenshotPath.replace(/(\.[^.]+)?$/, '-failure$1') })
  process.stderr.write(`${JSON.stringify({
    body: (await page.locator('body').innerText()).slice(0, 2_000),
    encounter: await currentEncounterReceipt(page),
    errors,
    screenshotPath,
    url: page.url(),
    wire: wireSummary(wire),
  })}\n`)
  throw error
} finally {
  await Promise.all([
    browser.close(),
    host.close(),
    vite.close(),
  ])
}

function observeGameWire(page, endpoint) {
  const endpointUrl = new URL(endpoint).href
  const receipt = {
    descriptors: new Map(),
    errors: [],
    events: new Map(),
    latestSnapshot: null,
    loadedBoneyard: null,
    projectileSamples: new Map(),
    reconstructor: new EntityReplicationReconstructor(),
    retired: new Map(),
    sequence: 0,
    socketCount: 0,
  }
  page.on('websocket', (socket) => {
    if (new URL(socket.url()).href !== endpointUrl) return
    receipt.socketCount += 1
    socket.on('framereceived', ({ payload }) => {
      try {
        recordWireMessage(
          receipt,
          decodeServerGameMessage(Buffer.isBuffer(payload) ? payload.toString() : payload),
        )
      } catch (error) {
        boundedPush(receipt.errors, error instanceof Error ? error.message : String(error), 16)
      }
    })
  })
  return receipt
}

function recordWireMessage(receipt, message) {
  if (message.type === 'server-boneyard-loaded') {
    receipt.loadedBoneyard = message.boneyard
    return
  }
  if (message.type === 'server-welcome') {
    receipt.reconstructor.reset(message.snapshot, message.snapshotSequence)
    receipt.sequence = message.snapshotSequence
    receipt.latestSnapshot = message.snapshot
    recordWireEnemyEvents(receipt, message.snapshot)
    return
  }
  if (message.type !== 'server-snapshot' || message.sequence <= receipt.sequence) return
  recordWireEntityFrame(receipt, message.frame.world.entities, message.sequence)
  const snapshot = receipt.reconstructor.apply(message.frame, message.sequence)
  receipt.sequence = message.sequence
  receipt.latestSnapshot = snapshot
  recordWireEnemyEvents(receipt, snapshot)
}

function recordWireEntityFrame(receipt, entities, sequence) {
  for (const descriptor of entities.spawned) {
    boundedMapSet(
      receipt.descriptors,
      replicatedEntityKey(descriptor[0], descriptor[1]),
      descriptor,
      128,
    )
  }
  for (const sample of entities.samples) {
    if (sample[0] !== REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile) continue
    const prior = receipt.projectileSamples.get(sample[1])
    boundedMapSet(receipt.projectileSamples, sample[1], {
      count: (prior?.count ?? 0) + 1,
      first: prior?.first ?? sample,
      last: sample,
    }, 128)
  }
  for (const [typeId, id] of entities.retired) {
    boundedMapSet(receipt.retired, replicatedEntityKey(typeId, id), sequence, 128)
  }
}

function recordWireEnemyEvents(receipt, snapshot) {
  if (snapshot.world.kind !== 'boneyard') return
  for (const event of snapshot.world.enemyEvents) {
    boundedMapSet(receipt.events, `${event.runId}:${event.eventId}`, event, 512)
  }
}

function replicatedEntityKey(typeId, id) {
  return `${typeId}:${id}`
}

function boundedMapSet(map, key, value, limit) {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  while (map.size > limit) map.delete(map.keys().next().value)
}

function boundedPush(values, value, limit) {
  values.push(value)
  if (values.length > limit) values.splice(0, values.length - limit)
}

async function waitForWireValue(page, wire, read, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (wire.errors.length > 0) {
      throw new Error(`game wire observation failed: ${wire.errors.join('; ')}`)
    }
    const value = read(wire)
    if (value) return value
    await page.waitForTimeout(25)
  }
  throw new Error(`timed out waiting for ${label}: ${JSON.stringify(wireSummary(wire))}`)
}

function wireSummary(wire) {
  return {
    descriptorCount: wire.descriptors.size,
    errors: [...wire.errors],
    eventCount: wire.events.size,
    latestTick: wire.latestSnapshot?.tick ?? null,
    projectileSampleCount: wire.projectileSamples.size,
    retiredCount: wire.retired.size,
    sequence: wire.sequence,
    socketCount: wire.socketCount,
  }
}

async function proveArcherProjectileLifecycle(
  page,
  wire,
  runId,
  screenshotPath,
  navigation,
) {
  const deadline = Date.now() + 900_000
  const killReceipts = []
  const selectedSkillIds = []
  let killCount = 0
  let wave

  while (Date.now() < deadline) {
    await drainPendingSkillOffers(page, selectedSkillIds)
    if (wire.errors.length > 0) {
      throw new Error(`game wire observation failed: ${wire.errors.join('; ')}`)
    }

    const frame = await boneyardFrame(page)
    const snapshot = currentBoneyardSnapshot(wire, runId)
    if (!snapshot) {
      await page.waitForTimeout(25)
      continue
    }
    const archers = snapshot.world.enemies.filter((enemy) => (
      enemy.enemyToken === 'SKELETONARCHER'
    ))
    if (archers.length > 0) {
      if (!frame.enemyFamilies.split(',').includes('SKELETONARCHER')) {
        await page.waitForTimeout(25)
        continue
      }
      wave = await encounterReceipt(page.locator('.boneyard-scene'))
      assert.equal(wave.waveOrdinal, 2)
      assert.equal(wave.waveScheduleIndex, 1)
      break
    }
    assert.equal(
      frame.localPlayerLifeState,
      'alive',
      `player died before the deterministic Archer wave after ${killCount} kills`,
    )

    if (!nearestLivingEnemy(frame)) {
      await page.waitForTimeout(100)
      continue
    }
    const killed = await castUntilEnemyDies(page, {
      deadline,
      navigation,
      selectedSkillIds,
    })
    killCount += 1
    boundedPush(killReceipts, killed, 12)

    const after = await boneyardFrame(page)
    if (after.localPlayerLifeState === 'alive') {
      const nearest = nearestLivingEnemy(after)
      if (nearest && enemyDistance(after, nearest) <= FIRE_ENGAGEMENT_MAX_DISTANCE) {
        await evadeEnemyPack(page, after, navigation, 220)
      }
    }
  }

  assert.ok(wave, `deterministic Archer wave did not materialize: ${JSON.stringify({
    killCount,
    wire: wireSummary(wire),
  })}`)
  return observeArcherProjectileLifecycle(
    page,
    wire,
    runId,
    deadline,
    screenshotPath,
    navigation,
    { killCount, killReceipts, selectedSkillIds, wave },
  )
}

async function observeArcherProjectileLifecycle(
  page,
  wire,
  runId,
  deadline,
  screenshotPath,
  navigation,
  advanceReceipt,
) {
  const discardedProjectileIds = new Set()
  const renderedProjectileTicks = new Map()
  const renderedShotActorIds = new Set()
  let candidate = null
  let reconstructedProjectile = null

  while (Date.now() < deadline) {
    if (wire.errors.length > 0) {
      throw new Error(`game wire observation failed: ${wire.errors.join('; ')}`)
    }
    const snapshot = currentBoneyardSnapshot(wire, runId)
    const frame = await boneyardFrame(page)
    if (!snapshot) {
      await page.waitForTimeout(25)
      continue
    }

    const archerIds = new Set(snapshot.world.enemies
      .filter((enemy) => enemy.enemyToken === 'SKELETONARCHER')
      .map((enemy) => enemy.id))
    for (const enemy of frame.enemySamples) {
      if (archerIds.has(enemy.id) && enemy.action === 'archer-shot') {
        renderedShotActorIds.add(enemy.id)
      }
    }

    if (!candidate) {
      candidate = [...wire.events.values()]
        .filter((event) => (
          event.runId === runId
          && event.type === 'projectile-spawned'
          && archerIds.has(event.actorId)
          && !discardedProjectileIds.has(event.projectileId)
        ))
        .sort((left, right) => left.eventId - right.eventId)[0] ?? null
      reconstructedProjectile = null
    }

    if (candidate) {
      const projectileId = candidate.projectileId
      const activeProjectile = snapshot.world.enemyProjectiles.find((projectile) => (
        projectile.id === projectileId
      ))
      if (activeProjectile) reconstructedProjectile = { ...activeProjectile }
      if (
        frame.enemyProjectileIds.includes(projectileId)
        && !renderedProjectileTicks.has(projectileId)
      ) {
        renderedProjectileTicks.set(projectileId, frame.tick)
        await page.screenshot({ path: screenshotPath })
      }

      const retirement = [...wire.events.values()].find((event) => (
        event.runId === runId
        && event.type === 'projectile-retired'
        && event.projectileId === projectileId
      ))
      const rendered = renderedProjectileTicks.has(projectileId)
      const motion = wire.projectileSamples.get(projectileId)
      const moved = motion
        && motion.last[5] > motion.first[5]
        && (motion.last[2] !== motion.first[2] || motion.last[3] !== motion.first[3])
      const activeInReconstruction = snapshot.world.enemyProjectiles.some((projectile) => (
        projectile.id === projectileId
      ))
      const activeInRenderer = frame.enemyProjectileIds.includes(projectileId)

      if (retirement && !activeInReconstruction && !activeInRenderer) {
        if (
          rendered
          && reconstructedProjectile
          && renderedShotActorIds.has(candidate.actorId)
          && motion?.count >= 2
          && moved
        ) {
          const enemyDescriptor = wire.descriptors.get(replicatedEntityKey(
            REPLICATED_ENTITY_TYPES.boneyardEnemy,
            candidate.actorId,
          ))
          const projectileDescriptor = wire.descriptors.get(replicatedEntityKey(
            REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
            projectileId,
          ))
          assert.ok(enemyDescriptor, 'expected the Archer wire descriptor')
          assert.equal(enemyDescriptor[0], REPLICATED_ENTITY_TYPES.boneyardEnemy)
          assert.equal(enemyDescriptor[1], candidate.actorId)
          assert.equal(enemyDescriptor[2], 1)
          assert.equal(enemyDescriptor[3], 1002)
          assert.ok(projectileDescriptor, 'expected the arrow wire descriptor')
          assert.equal(
            projectileDescriptor[0],
            REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
          )
          assert.equal(projectileDescriptor[1], projectileId)
          assert.equal(projectileDescriptor[2], 0)
          assert.equal(projectileDescriptor[3], 0x7da)
          assert.equal(projectileDescriptor[4], candidate.actorId)
          assert.equal(reconstructedProjectile.kind, 'arrow')
          assert.equal(reconstructedProjectile.nativeTypeId, 0x7da)
          assert.equal(reconstructedProjectile.ownerActorId, candidate.actorId)
          assert.equal(retirement.actorId, candidate.actorId)
          return {
            ...advanceReceipt,
            actorId: candidate.actorId,
            archerDescriptor: [...enemyDescriptor],
            archerShotRendered: true,
            projectileDescriptor: [...projectileDescriptor],
            projectileId,
            projectileMotion: {
              count: motion.count,
              first: [...motion.first],
              last: [...motion.last],
            },
            projectileRenderedTick: renderedProjectileTicks.get(projectileId),
            reconstructedProjectile,
            retirementEventId: retirement.eventId,
            retirementTick: retirement.tick,
            wireRetirementSequence: wire.retired.get(replicatedEntityKey(
              REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile,
              projectileId,
            )) ?? null,
          }
        }
        discardedProjectileIds.add(projectileId)
        candidate = null
        reconstructedProjectile = null
      }
    }

    const focusActorId = candidate?.actorId
      ?? nearestArcherId(frame, archerIds)
    const archer = frame.enemySamples.find((enemy) => enemy.id === focusActorId)
    if (!archer) {
      await page.waitForTimeout(50)
      continue
    }
    const nearest = nearestLivingEnemy(frame)
    const nearestDistance = nearest ? enemyDistance(frame, nearest) : Number.POSITIVE_INFINITY
    if (nearestDistance < FIRE_ENGAGEMENT_MIN_DISTANCE) {
      await evadeEnemyPack(page, frame, navigation, 220)
    } else {
      await page.waitForTimeout(50)
    }
  }

  throw new Error(`Archer projectile lifecycle did not complete: ${JSON.stringify({
    advanceReceipt,
    discardedProjectileIds: [...discardedProjectileIds],
    renderedProjectileTicks: [...renderedProjectileTicks],
    renderedShotActorIds: [...renderedShotActorIds],
    wire: wireSummary(wire),
  })}`)
}

function currentBoneyardSnapshot(wire, runId) {
  const snapshot = wire.latestSnapshot
  return snapshot?.world.kind === 'boneyard' && snapshot.world.runId === runId
    ? snapshot
    : null
}

function nearestArcherId(frame, archerIds) {
  return frame.enemySamples
    .filter((enemy) => archerIds.has(enemy.id) && enemy.lifeState !== 'death')
    .toSorted((left, right) => (
      Math.hypot(left.x - frame.playerX, left.y - frame.playerY)
      - Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
      || left.id - right.id
    ))[0]?.id ?? null
}

async function drainPendingSkillOffers(page, selectedSkillIds = []) {
  const picker = page.locator('.skill-picker-stage')

  while (await picker.count() > 0) {
    await picker.waitFor({ state: 'visible', timeout: 5_000 })
    const offerSequence = Number(await picker.getAttribute('data-offer-sequence'))
    assert.ok(Number.isSafeInteger(offerSequence), 'expected a real skill offer sequence')
    const choices = picker.locator('button[data-skill-id]')
    const skillIds = await choices.evaluateAll((buttons) => (
      buttons.map((button) => Number(button.getAttribute('data-skill-id')))
    ))
    assert.ok(skillIds.length > 0, 'expected a real offered skill choice')
    const nonPrimaryIndex = skillIds.findIndex((skillId) => skillId !== 16)
    const choiceIndex = nonPrimaryIndex >= 0 ? nonPrimaryIndex : 0
    const skillId = skillIds[choiceIndex]
    assert.ok(Number.isSafeInteger(skillId), 'expected a real offered skill id')
    await choices.nth(choiceIndex).click()
    await page.waitForFunction((priorSequence) => {
      const current = document.querySelector('.skill-picker-stage')
      return current === null
        || Number(current.getAttribute('data-offer-sequence')) !== priorSequence
    }, offerSequence, { timeout: 15_000 })
    boundedPush(selectedSkillIds, skillId, 16)
  }
}

async function kiteUntilSolomonTaunt(page, navigation) {
  const first = await boneyardFrame(page)
  const actions = new Set()
  let minimumHealth = first.localPlayerHealth
  let pulseIndex = 0
  const fallbackDirections = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ]
  const deadline = Date.now() + 180_000

  while (Date.now() < deadline) {
    const frame = await boneyardFrame(page)
    minimumHealth = Math.min(minimumHealth, frame.localPlayerHealth)
    for (const enemy of frame.enemySamples) {
      if (enemy.action) actions.add(enemy.action)
    }
    const receipt = await encounterReceipt(page.locator('.boneyard-scene'))
    const hasTaunt = receipt.voiceEventId === 3
      && await page.evaluate(() => window.__sdrAudioPlaySources?.some(
        (source) => source.includes('solomon-get-him-boys'),
      ))
    if (hasTaunt) {
      const movedEnemyIds = await page.evaluate(() => window.__sdrEnemyMovedIds ?? [])
      assert.ok(movedEnemyIds.length > 0, 'expected authoritative enemy locomotion')
      return {
        actions: [...actions],
        endTick: frame.tick,
        minimumHealth,
        movedEnemyIds,
        startTick: first.tick,
      }
    }

    if (frame.localPlayerLifeState === 'alive') {
      const moved = await evadeEnemyPack(page, frame, navigation, 220)
      if (!moved) {
        await pulseMovement(
          page,
          movementKeys(fallbackDirections[pulseIndex % fallbackDirections.length]),
          180,
        )
      }
    } else {
      await page.waitForTimeout(100)
    }
    pulseIndex += 1
  }
  throw new Error('Solomon did not finish the laugh and taunt while combat was active')
}

async function castUntilEnemyDies(page, {
  deadline = Date.now() + 240_000,
  navigation,
  selectedSkillIds = [],
} = {}) {
  assert.ok(navigation, 'combat navigation is required')
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  let acceptedCastCount = 0
  let acceptedTick = null
  let enemyCountBefore = null
  let enemyHealthBefore = null
  let lastAimedTargetId = null
  let manaAfter = null
  let manaBefore = null
  let selectedTargetId = null

  while (Date.now() < deadline) {
    await drainPendingSkillOffers(page, selectedSkillIds)
    let before = await boneyardFrame(page)
    assert.equal(before.localPlayerLifeState, 'alive', 'player died before the combat cast')

    let target = selectedTargetId === null
      ? nearestFireTarget(before, navigation)
      : enemyById(before, selectedTargetId)
    if (!target) {
      if (selectedTargetId !== null && acceptedCastCount > 0) {
        return fireRetirementReceipt({
          acceptedCastCount,
          acceptedTick,
          enemyCountBefore,
          enemyHealthBefore,
          frame: before,
          manaAfter,
          manaBefore,
          selectedSkillIds,
          targetId: selectedTargetId,
        })
      }
      if (!await approachNearestEnemy(page, before, navigation, 220)) {
        await page.waitForTimeout(50)
      }
      continue
    }
    if (target.lifeState === 'death' || target.currentHealth <= 0) {
      assert.notEqual(selectedTargetId, null, 'an uncommitted target cannot already be terminal')
      const retired = await waitForEnemyRetirement(
        page,
        selectedTargetId,
        deadline,
        navigation,
        selectedSkillIds,
      )
      return fireRetirementReceipt({
        acceptedCastCount,
        acceptedTick,
        enemyCountBefore,
        enemyHealthBefore,
        frame: retired,
        manaAfter,
        manaBefore,
        selectedSkillIds,
        targetId: selectedTargetId,
      })
    }

    const distance = enemyDistance(before, target)
    const recovering = before.tick < fireCastDriver.nextReadyTick
    const waitingForMana = before.localPlayerMana + Number.EPSILON
      < PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire
    if (recovering || waitingForMana) {
      await evadeEnemyPack(page, before, navigation, 220)
      continue
    }
    if (!visibleLivingEnemy(before, target) || distance > FIRE_ENGAGEMENT_MAX_DISTANCE) {
      const nearest = nearestLivingEnemy(before)
      if (nearest && enemyDistance(before, nearest) < FIRE_ENGAGEMENT_MAX_DISTANCE) {
        await evadeEnemyPack(page, before, navigation, 220)
      } else {
        await page.waitForTimeout(100)
      }
      continue
    }

    await drainPendingSkillOffers(page, selectedSkillIds)
    before = await boneyardFrame(page)
    target = selectedTargetId === null
      ? nearestFireTarget(before, navigation)
      : enemyById(before, selectedTargetId)
    if (
      !target
      || !visibleLivingEnemy(before, target)
      || !firePathReachesTarget(navigation, before, target)
    ) continue
    const refreshedDistance = enemyDistance(before, target)
    if (
      before.localPlayerMana + Number.EPSILON < PRIMARY_SPELL_RANK_ONE_MANA_COSTS.fire
      || before.tick < fireCastDriver.nextReadyTick
      || refreshedDistance > FIRE_ENGAGEMENT_MAX_DISTANCE
    ) continue

    const castEnemyStates = new Map(before.enemySamples
      .filter((enemy) => enemy.lifeState !== 'death' && enemy.currentHealth > 0)
      .map((enemy) => [enemy.id, {
        currentHealth: enemy.currentHealth,
        lifeState: enemy.lifeState,
      }]))
    const targetPoint = await enemyScreenPoint(canvas, before, target)
    lastAimedTargetId = target.id
    await page.bringToFront()
    await page.mouse.move(targetPoint.x, targetPoint.y)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(35)
    await page.mouse.up({ button: 'left' })

    const acceptanceDeadline = Math.min(deadline, Date.now() + 3_000)
    let accepted = null
    let lastAcceptanceEvasionAt = Date.now()
    while (Date.now() < acceptanceDeadline) {
      await drainPendingSkillOffers(page, selectedSkillIds)
      const frame = await boneyardFrame(page)
      if (frame.localPlayerMana < before.localPlayerMana) {
        accepted = frame
        break
      }
      if (firstDamagedEnemy(frame, castEnemyStates)) {
        // A point-blank Fire projectile can damage and retire between rendered mana samples.
        // In this single-player smoke, that post-click contact is the acceptance witness.
        accepted = frame
        break
      }
      if (Date.now() - lastAcceptanceEvasionAt >= 250) {
        await evadeEnemyPack(page, frame, navigation, 180)
        lastAcceptanceEvasionAt = Date.now()
      } else {
        await page.waitForTimeout(25)
      }
    }
    if (!accepted) continue

    acceptedCastCount += 1
    acceptedTick ??= accepted.tick
    fireCastDriver.nextReadyTick = accepted.tick + PRIMARY_CAST_ACTION_END_TICK
    enemyCountBefore ??= before.enemyCount
    manaBefore ??= before.localPlayerMana
    manaAfter = accepted.localPlayerMana

    const contactDeadline = Math.min(deadline, Date.now() + 5_000)
    let contacted = false
    let lastContactEvasionAt = Date.now()
    let frame = accepted
    while (Date.now() < contactDeadline) {
      await drainPendingSkillOffers(page, selectedSkillIds)
      const contact = firstDamagedEnemy(frame, castEnemyStates)
      if (contact) {
        selectedTargetId = contact.id
        enemyHealthBefore = contact.previous.currentHealth
      }
      if (contact && !contact.current) {
        return fireRetirementReceipt({
          acceptedCastCount,
          acceptedTick,
          enemyCountBefore,
          enemyHealthBefore,
          frame,
          manaAfter,
          manaBefore,
          selectedSkillIds,
          targetId: selectedTargetId,
        })
      }
      if (contact) contacted = true
      if (contact?.current && (
        contact.current.lifeState === 'death'
        || contact.current.currentHealth <= 0
      )) {
        const retired = await waitForEnemyRetirement(
          page,
          selectedTargetId,
          deadline,
          navigation,
          selectedSkillIds,
        )
        return fireRetirementReceipt({
          acceptedCastCount,
          acceptedTick,
          enemyCountBefore,
          enemyHealthBefore,
          frame: retired,
          manaAfter,
          manaBefore,
          selectedSkillIds,
          targetId: selectedTargetId,
        })
      }
      if (contacted) break
      if (Date.now() - lastContactEvasionAt >= 250) {
        await evadeEnemyPack(page, frame, navigation, 180)
        lastContactEvasionAt = Date.now()
      } else {
        await page.waitForTimeout(25)
      }
      frame = await boneyardFrame(page)
    }
    if (!contacted) {
      await evadeEnemyPack(page, await boneyardFrame(page), navigation, 220)
    }
  }

  throw new Error(`Fire combat did not retire its selected enemy: ${JSON.stringify({
    acceptedCastCount,
    aimedTargetId: lastAimedTargetId,
    contactedTargetId: selectedTargetId,
    frame: await boneyardFrame(page),
    selectedSkillIds,
  })}`)
}

async function waitForEnemyRetirement(
  page,
  targetId,
  deadline,
  navigation,
  selectedSkillIds,
) {
  while (Date.now() < deadline) {
    await drainPendingSkillOffers(page, selectedSkillIds)
    const frame = await boneyardFrame(page)
    if (!enemyById(frame, targetId)) return frame
    assert.equal(frame.localPlayerLifeState, 'alive', 'player died before the enemy retired')
    await evadeEnemyPack(page, frame, navigation, 220)
  }
  throw new Error(`enemy ${targetId} did not retire before the combat deadline`)
}

function fireRetirementReceipt({
  acceptedCastCount,
  acceptedTick,
  enemyCountBefore,
  enemyHealthBefore,
  frame,
  manaAfter,
  manaBefore,
  selectedSkillIds,
  targetId,
}) {
  assert.ok(acceptedCastCount > 0, `enemy ${targetId} retired without an accepted Fire cast`)
  return {
    acceptedCastCount,
    acceptedTick,
    attempt: acceptedCastCount,
    enemyCountAfter: frame.enemyCount,
    enemyCountBefore,
    enemyHealthAfter: null,
    enemyHealthBefore,
    enemyLifeState: 'retired',
    manaAfter,
    manaBefore,
    playerHealthAfter: frame.localPlayerHealth,
    selectedSkillIds: [...selectedSkillIds],
    targetId,
  }
}

function enemyById(frame, targetId) {
  return frame.enemySamples.find((enemy) => enemy.id === targetId) ?? null
}

function firstDamagedEnemy(frame, previousById) {
  for (const [id, previous] of previousById) {
    const current = enemyById(frame, id)
    if (
      !current
      || current.currentHealth < previous.currentHealth
      || (current.lifeState === 'death' && previous.lifeState !== 'death')
    ) return { current, id, previous }
  }
  return null
}

function enemyDistance(frame, enemy) {
  return Math.hypot(enemy.x - frame.playerX, enemy.y - frame.playerY)
}

async function evadeEnemyPack(page, frame, navigation, durationMs) {
  const direction = safestCombatDirection(frame, navigation)
  if (!direction) return false
  await pulseMovement(page, movementKeys(direction), durationMs)
  return true
}

async function approachNearestEnemy(page, frame, navigation, durationMs) {
  const direction = nearestEnemyApproachDirection(frame, navigation)
  if (!direction) return false
  await pulseMovement(page, movementKeys(direction), durationMs)
  return true
}

function nearestEnemyApproachDirection(frame, navigation) {
  if (!combatInteriorContains(
    navigation,
    { x: frame.playerX, y: frame.playerY },
    COMBAT_ENTRY_GATE_MARGIN,
  )) {
    return { x: 0, y: navigation.entryGate.direction }
  }
  const nearest = nearestLivingEnemy(frame)
  if (!nearest) return null
  const start = { x: frame.playerX, y: frame.playerY }
  const route = planEnemyApproachPath(
    navigation,
    start,
    { x: nearest.x, y: nearest.y },
  )
  const waypoint = route[1]
  return waypoint ? {
    x: waypoint.x - start.x,
    y: waypoint.y - start.y,
  } : null
}

function safestCombatDirection(frame, navigation) {
  const enemies = frame.enemySamples.filter((enemy) => enemy.lifeState !== 'death')
  if (enemies.length === 0) return null
  const start = { x: frame.playerX, y: frame.playerY }
  if (!combatInteriorContains(navigation, start, COMBAT_ENTRY_GATE_MARGIN)) {
    return { x: 0, y: navigation.entryGate.direction }
  }
  const directions = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
  ]

  for (const probeDistance of [70, 45, 25]) {
    let best = null
    for (const direction of directions) {
      const length = Math.hypot(direction.x, direction.y)
      const unit = { x: direction.x / length, y: direction.y / length }
      const end = {
        x: start.x + unit.x * probeDistance,
        y: start.y + unit.y * probeDistance,
      }
      if (!combatInteriorContains(navigation, end, COMBAT_ENTRY_GATE_MARGIN)) continue
      if (!traversesBoneyard(
        start,
        end,
        navigation.bounds,
        navigation.collision,
      )) continue

      const corridorDistances = enemies.map((enemy) => Math.min(
        ...[0.35, 0.7, 1].map((progress) => Math.hypot(
          enemy.x - (start.x + (end.x - start.x) * progress),
          enemy.y - (start.y + (end.y - start.y) * progress),
        )),
      )).toSorted((left, right) => left - right)
      const nearestClearance = corridorDistances[0] ?? Number.POSITIVE_INFINITY
      const crowdClearance = corridorDistances
        .slice(0, 8)
        .reduce((total, distance) => total + Math.min(distance, 250), 0)
      const edgeClearance = Math.min(
        end.x - navigation.bounds.x,
        navigation.bounds.x + navigation.bounds.w - end.x,
        end.y - navigation.bounds.y,
        navigation.bounds.y + navigation.bounds.h - end.y,
      )
      const score = nearestClearance * 100
        + crowdClearance
        + Math.min(edgeClearance, 150) * 2
      if (!best || score > best.score) best = { direction, score }
    }
    if (best) return best.direction
  }

  const nearest = nearestLivingEnemy(frame)
  return nearest
    ? { x: frame.playerX - nearest.x, y: frame.playerY - nearest.y }
    : null
}

async function waitForPlayerDeath(page) {
  const first = await boneyardFrame(page)
  const actions = new Set()
  const healthSamples = [first.localPlayerHealth]
  let lastApproachAt = 0
  const deadline = Date.now() + 240_000

  while (Date.now() < deadline) {
    const frame = await boneyardFrame(page)
    healthSamples.push(frame.localPlayerHealth)
    for (const enemy of frame.enemySamples) {
      if (enemy.action) actions.add(enemy.action)
    }
    if (frame.runPhase === 'game-over' && frame.localPlayerDeathTick >= 153) {
      assert.equal(Math.min(...healthSamples), 0)
      const probedActions = await page.evaluate(() => window.__sdrEnemyActionSamples ?? [])
      for (const action of probedActions) actions.add(action)
      assert.ok(actions.size > 0, 'expected an enemy attack animation before player death')
      return {
        actions: [...actions],
        deathTick: frame.localPlayerDeathTick,
        finalHealth: frame.localPlayerHealth,
        lifeState: frame.localPlayerLifeState,
        runGameOverTicks: frame.runGameOverTicks,
        runId: frame.runId,
        startHealth: first.localPlayerHealth,
      }
    }
    if (
      frame.localPlayerLifeState === 'alive'
      && Date.now() - lastApproachAt >= 2_000
    ) {
      const target = nearestLivingEnemy(frame)
      if (target) {
        await pulseMovement(page, movementKeys({
          x: target.x - frame.playerX,
          y: target.y - frame.playerY,
        }), 180)
      } else {
        await page.waitForTimeout(180)
      }
      lastApproachAt = Date.now()
    } else {
      await page.waitForTimeout(100)
    }
  }
  throw new Error(`player did not reach terminal death: ${JSON.stringify(await boneyardFrame(page))}`)
}

async function installEnemyActionProbe(page) {
  await page.evaluate(() => {
    const samples = []
    const origins = new Map()
    const movedIds = []
    Object.defineProperty(window, '__sdrEnemyActionSamples', {
      configurable: true,
      value: samples,
    })
    Object.defineProperty(window, '__sdrEnemyMovedIds', {
      configurable: true,
      value: movedIds,
    })
    const observe = () => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      for (const enemy of frame?.enemySamples ?? []) {
        if (enemy.action && !samples.includes(enemy.action)) samples.push(enemy.action)
        const origin = origins.get(enemy.id)
        if (!origin) {
          origins.set(enemy.id, { x: enemy.x, y: enemy.y })
        } else if (
          !movedIds.includes(enemy.id)
          && Math.hypot(enemy.x - origin.x, enemy.y - origin.y) > 2
        ) {
          movedIds.push(enemy.id)
        }
      }
      if (document.querySelector('.boneyard-world-canvas')) requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  })
}

function nearestLivingEnemy(frame) {
  return frame.enemySamples
    .filter((enemy) => enemy.lifeState !== 'death')
    .toSorted((left, right) => (
      Math.hypot(left.x - frame.playerX, left.y - frame.playerY)
      - Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
      || left.id - right.id
    ))[0] ?? null
}

function nearestFireTarget(frame, navigation) {
  return frame.enemySamples
    .filter((enemy) => {
      return visibleLivingEnemy(frame, enemy)
        && enemyDistance(frame, enemy) <= FIRE_ENGAGEMENT_MAX_DISTANCE
        && firePathReachesTarget(navigation, frame, enemy)
    })
    .toSorted((left, right) => (
      enemyDistance(frame, left) - enemyDistance(frame, right)
      || left.id - right.id
    ))[0] ?? null
}

function firePathReachesTarget(navigation, origin, target) {
  const start = { x: origin.playerX ?? origin.x, y: origin.playerY ?? origin.y }
  const end = { x: target.x, y: target.y }
  if (
    !combatInteriorContains(navigation, start)
    || !combatInteriorContains(navigation, end)
  ) return false
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  if (distance === 0) return true
  const worldProgress = firstBoneyardPathBlockProgress(
    start,
    end,
    navigation.bounds,
    navigation.collision,
    PRIMARY_SPELL_FIRE_COLLISION_RADIUS,
  )
  const conservativeActorEntry = Math.max(
    0,
    1 - (
      PRIMARY_SPELL_FIRE_COLLISION_RADIUS + MINIMUM_SKELETON_COLLISION_RADIUS
    ) / distance,
  )
  return worldProgress === null || worldProgress - conservativeActorEntry > 1e-9
}

function combatInteriorContains(navigation, point, margin = 0) {
  const gate = navigation.entryGate
  return !gate || (point.y - gate.y) * gate.direction >= margin
}

function visibleLivingEnemy(frame, enemy) {
  if (enemy.lifeState === 'death') return false
  const x = frame.playerScreenX + (enemy.x - frame.playerX) * 1.35
  const y = frame.playerScreenY + (enemy.y - frame.playerY) * 1.35
  return x >= 30 && x <= 1_570 && y >= 30 && y <= 870
}

async function enemyScreenPoint(canvas, frame, enemy) {
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the Boneyard canvas to have bounds')
  const logicalX = frame.playerScreenX + (enemy.x - frame.playerX) * 1.35
  const logicalY = frame.playerScreenY + (enemy.y - frame.playerY) * 1.35
  return {
    x: bounds.x + logicalX / 1_600 * bounds.width,
    y: bounds.y + logicalY / 900 * bounds.height,
  }
}

async function boneyardFrame(page) {
  return page.locator('.boneyard-world-canvas').evaluate((node) => (
    structuredClone(node.__sdrBoneyardFrame)
  ))
}

async function enterBoneyard(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 30_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 90_000 })
}

async function crossNearestEntryGate(page, scene, boneyardScene) {
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const target = nearestGateCenter(initialGateState, initialX, initialY)
  const initialDirection = Math.sign(target.y - initialY)
  assert.notEqual(initialDirection, 0, 'expected the entry gate to be beyond the player')
  const approachTarget = {
    x: target.x,
    y: target.y - initialDirection * (
      PLAYER_CHARACTER_RADIUS + BONEYARD_GATE_INITIAL_SWAY + 15
    ),
  }
  const aligned = await walkToPoint(
    page,
    scene,
    boneyardScene,
    approachTarget,
    90_000,
    30,
  )
  const direction = Math.sign(target.y - aligned.y)
  assert.notEqual(direction, 0, 'expected the entry gate to be beyond the player')
  const crossingDistance = Math.abs(target.y - aligned.y) + 35
  await holdUntil(page, direction < 0 ? 'w' : 's', () => (
    scene.getAttribute('data-local-player-y').then((value) => (
      (Number(value) - aligned.y) * direction > crossingDistance
    ))
  ), 15_000)
  const finalY = Number(await scene.getAttribute('data-local-player-y'))
  const finalGateState = await scene.getAttribute('data-gate-state')
  assert.ok((finalY - aligned.y) * direction > crossingDistance)
  assert.notEqual(finalGateState, initialGateState)
  return { aligned, direction, finalY, initialX, initialY, target }
}

function nearestGateCenter(serializedState, playerX, playerY) {
  const gates = new Map()
  for (const serialized of serializedState?.split('|') || []) {
    const separator = serialized.lastIndexOf(':')
    if (separator < 0) continue
    const id = serialized.slice(0, separator)
    const [x, y] = serialized.slice(separator + 1).split(',').map(Number)
    const gateId = id.slice(0, id.lastIndexOf(':'))
    if (!Number.isFinite(x) || !Number.isFinite(y) || !gateId) continue
    const tips = gates.get(gateId) || []
    tips.push({ x, y })
    gates.set(gateId, tips)
  }
  const centers = [...gates.values()]
    .filter((tips) => tips.length === 2)
    .map((tips) => ({
      x: (tips[0].x + tips[1].x) / 2,
      y: (tips[0].y + tips[1].y) / 2,
    }))
  assert.ok(centers.length > 0, `expected an entry gate in ${serializedState}`)
  return centers.reduce((nearest, center) => (
    Math.hypot(center.x - playerX, center.y - playerY)
      < Math.hypot(nearest.x - playerX, nearest.y - playerY)
      ? center
      : nearest
  ))
}

async function holdUntil(page, key, predicate, timeoutMs) {
  await page.bringToFront()
  await page.keyboard.down(key)
  const deadline = Date.now() + timeoutMs
  try {
    while (Date.now() < deadline) {
      if (await predicate()) return
      await page.waitForTimeout(50)
    }
    throw new Error(`movement ${key} did not reach its target`)
  } finally {
    await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
}

async function walkToPoint(page, scene, boneyardScene, target, timeoutMs, tolerance = 10) {
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  let route = planPointPath(
    boneyardScene,
    await playerPointReceipt(scene, target),
    target,
  )
  let routeIndex = 1
  let stalledSteps = 0
  while (Date.now() - startedAt < timeoutMs) {
    const before = await playerPointReceipt(scene, target)
    if (before.distance <= tolerance) return { x: before.x, y: before.y }
    while (
      routeIndex < route.length
      && Math.hypot(
        route[routeIndex].x - before.x,
        route[routeIndex].y - before.y,
      ) <= 10
    ) {
      routeIndex += 1
    }
    if (routeIndex >= route.length) {
      route = planPointPath(boneyardScene, before, target)
      routeIndex = 1
      continue
    }
    const waypoint = route[routeIndex]
    const waypointDistance = Math.hypot(
      waypoint.x - before.x,
      waypoint.y - before.y,
    )
    await pulseMovement(page, movementKeys({
      x: waypoint.x - before.x,
      y: waypoint.y - before.y,
    }), movementPulseDuration(waypointDistance))
    const after = await playerPointReceipt(scene, target)
    const nextWaypointDistance = Math.hypot(
      waypoint.x - after.x,
      waypoint.y - after.y,
    )
    if (nextWaypointDistance < waypointDistance - 1) {
      stalledSteps = 0
    } else {
      stalledSteps += 1
      if (stalledSteps >= 6) {
        route = planPointPath(boneyardScene, after, target)
        routeIndex = 1
        stalledSteps = 0
      }
    }
  }
  const final = await playerPointReceipt(scene, target)
  throw new Error(`could not walk to ${JSON.stringify(target)} from ${JSON.stringify(final)}`)
}

async function playerPointReceipt(scene, target) {
  const position = await scene.evaluate((node) => ({
    x: Number(node.getAttribute('data-local-player-x')),
    y: Number(node.getAttribute('data-local-player-y')),
  }))
  return {
    ...position,
    distance: Math.hypot(target.x - position.x, target.y - position.y),
  }
}

async function walkToSolomon(page, scene, boneyardScene) {
  await page.bringToFront()
  await scene.focus()
  const startedAt = Date.now()
  const samples = []
  const initial = await approachReceipt(scene)
  const solomon = { x: initial.solomonX, y: initial.solomonY }
  let route = planSolomonPath(
    boneyardScene,
    { x: initial.playerX, y: initial.playerY },
    solomon,
  )
  const routeNodes = route.length

  while (Date.now() - startedAt < 240_000) {
    const before = await approachReceipt(scene)
    samples.push(before)
    if (before.phase !== 'digging') {
      return {
        contactPosition: { x: before.playerX, y: before.playerY },
        phase: before.phase,
        routeNodes,
        samples: samples.length,
        startPosition: { x: samples[0].playerX, y: samples[0].playerY },
      }
    }
    const playerPosition = { x: before.playerX, y: before.playerY }
    if (solomonContactContains(solomon, playerPosition)) {
      const contactDeadline = Date.now() + 2_000
      while (Date.now() < contactDeadline) {
        await page.waitForTimeout(50)
        const held = await approachReceipt(scene)
        samples.push(held)
        if (held.phase !== 'digging') {
          return {
            contactPosition: { x: held.playerX, y: held.playerY },
            phase: held.phase,
            routeNodes,
            samples: samples.length,
            startPosition: { x: samples[0].playerX, y: samples[0].playerY },
          }
        }
      }
    }
    route = planSolomonPath(boneyardScene, playerPosition, solomon)
    const waypoint = route[1]
    assert.ok(waypoint, 'expected a collision-safe waypoint toward Solomon')
    await driveToSolomonWaypoint(page, scene, waypoint)
  }
  throw new Error(`could not walk to Solomon: ${JSON.stringify(samples.at(-1))}`)
}

async function driveToSolomonWaypoint(page, scene, waypoint) {
  const initial = await approachReceipt(scene)
  const keys = movementKeys({
    x: waypoint.x - initial.playerX,
    y: waypoint.y - initial.playerY,
  })
  assert.ok(keys.length > 0, 'expected movement keys for the Solomon waypoint')
  let closestDistance = Math.hypot(
    waypoint.x - initial.playerX,
    waypoint.y - initial.playerY,
  )
  const deadline = Date.now() + 1_500
  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    while (Date.now() < deadline) {
      const current = await approachReceipt(scene)
      if (current.phase !== 'digging') break
      const distance = Math.hypot(
        waypoint.x - current.playerX,
        waypoint.y - current.playerY,
      )
      if (distance <= 16) break
      if (distance > closestDistance + 2 && closestDistance < 40) break
      closestDistance = Math.min(closestDistance, distance)
      await page.waitForTimeout(25)
    }
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
  // Zero input damps retained native velocity by 0.9 each 10 ms tick. At the
  // 118.75 lane cap, 650 ms leaves less than 0.02 world units of coast.
  await page.waitForTimeout(650)
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
}

function planSolomonPath(scene, start, solomon) {
  return planBoneyardPath(
    scene,
    start,
    solomon,
    (point) => solomonContactContains(solomon, point) ? [] : null,
    'Solomon',
  )
}

function planPointPath(
  scene,
  start,
  target,
  collision = createBoneyardCollisionWorld(scene),
) {
  return simplifyBoneyardPath(
    planBoneyardPath(
      scene,
      start,
      target,
      (point) => (
        Math.hypot(target.x - point.x, target.y - point.y) <= 40
        && traversesBoneyard(point, target, scene.bounds, collision)
          ? [target]
          : null
      ),
      JSON.stringify(target),
      collision,
    ),
    scene.bounds,
    collision,
  )
}

function planEnemyApproachPath(navigation, start, target) {
  return simplifyBoneyardPath(
    planBoneyardPath(
      navigation.scene,
      start,
      target,
      (point) => (
        Math.hypot(target.x - point.x, target.y - point.y)
          <= FIRE_ENGAGEMENT_MAX_DISTANCE
          && firePathReachesTarget(navigation, point, target)
          ? []
          : null
      ),
      `Fire engagement with ${JSON.stringify(target)}`,
      navigation.collision,
    ),
    navigation.bounds,
    navigation.collision,
  )
}

function planBoneyardPath(
  scene,
  start,
  target,
  finish,
  targetLabel,
  collision = createBoneyardCollisionWorld(scene),
) {
  const gridStep = 40
  const directions = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 1 },
  ]
  const startKey = '0,0'
  const parents = new Map([[startKey, null]])
  const points = new Map([[startKey, { ...start }]])
  const queue = [startKey]

  for (let cursor = 0; cursor < queue.length && cursor < 25_000; cursor += 1) {
    const key = queue[cursor]
    const point = points.get(key)
    const tail = finish(point)
    if (tail !== null) {
      return [...reconstructGridPath(key, parents, points), ...tail]
    }
    const [gridX, gridY] = key.split(',').map(Number)
    const orderedDirections = directions.toSorted((first, second) => {
      const firstDistance = Math.hypot(
        start.x + (gridX + first.x) * gridStep - target.x,
        start.y + (gridY + first.y) * gridStep - target.y,
      )
      const secondDistance = Math.hypot(
        start.x + (gridX + second.x) * gridStep - target.x,
        start.y + (gridY + second.y) * gridStep - target.y,
      )
      return firstDistance - secondDistance
    })
    for (const direction of orderedDirections) {
      const nextGridX = gridX + direction.x
      const nextGridY = gridY + direction.y
      const nextKey = `${nextGridX},${nextGridY}`
      if (parents.has(nextKey)) continue
      const next = {
        x: start.x + nextGridX * gridStep,
        y: start.y + nextGridY * gridStep,
      }
      if (!traversesBoneyard(point, next, scene.bounds, collision)) continue
      parents.set(nextKey, key)
      points.set(nextKey, next)
      queue.push(nextKey)
    }
  }
  throw new Error(`no collision-safe route to ${targetLabel} from ${JSON.stringify(start)}`)
}

function traversesBoneyard(start, target, bounds, collision) {
  const distance = Math.hypot(target.x - start.x, target.y - start.y)
  const steps = Math.ceil(distance / 8)
  let current = { ...start }
  for (let step = 1; step <= steps; step += 1) {
    const requested = {
      x: start.x + (target.x - start.x) * step / steps,
      y: start.y + (target.y - start.y) * step / steps,
    }
    const resolved = resolveBoneyardMovement(
      current,
      requested,
      bounds,
      collision,
      PLAYER_CHARACTER_RADIUS,
    )
    if (Math.hypot(resolved.x - requested.x, resolved.y - requested.y) > 0.25) {
      return false
    }
    current = resolved
  }
  return true
}

function reconstructGridPath(goalKey, parents, points) {
  const reversed = []
  let key = goalKey
  while (key !== null) {
    reversed.push(points.get(key))
    key = parents.get(key)
  }
  return reversed.reverse()
}

function simplifyBoneyardPath(path, bounds, collision) {
  const simplified = [path[0]]
  let currentIndex = 0
  while (currentIndex < path.length - 1) {
    let nextIndex = path.length - 1
    while (
      nextIndex > currentIndex + 1
      && !traversesBoneyard(path[currentIndex], path[nextIndex], bounds, collision)
    ) {
      nextIndex -= 1
    }
    simplified.push(path[nextIndex])
    currentIndex = nextIndex
  }
  return simplified
}

function movementPulseDuration(distance) {
  return Math.min(1_000, Math.max(250, Math.round(distance * 8)))
}

async function pulseMovement(page, keys, durationMs) {
  await page.bringToFront()
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    await page.waitForTimeout(durationMs)
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
    await publishStoppedMovement(page)
  }
}

async function publishStoppedMovement(page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'))
    return new Promise((resolve) => requestAnimationFrame(resolve))
  })
}

function movementKeys({ x, y }) {
  const keys = []
  const scale = Math.max(Math.abs(x), Math.abs(y), 1)
  if (Math.abs(x) / scale >= 0.25) keys.push(x > 0 ? 'd' : 'a')
  if (Math.abs(y) / scale >= 0.25) keys.push(y > 0 ? 's' : 'w')
  return keys
}

async function approachReceipt(scene) {
  return scene.evaluate((node) => {
    const playerX = Number(node.getAttribute('data-local-player-x'))
    const playerY = Number(node.getAttribute('data-local-player-y'))
    const solomonX = Number(node.getAttribute('data-solomon-x'))
    const solomonY = Number(node.getAttribute('data-solomon-y'))
    return {
      distance: Math.hypot(solomonX - playerX, solomonY - playerY),
      phase: node.getAttribute('data-solomon-phase'),
      playerX,
      playerY,
      solomonX,
      solomonY,
    }
  })
}

async function encounterReceipt(scene) {
  return scene.evaluate((node) => ({
    heading: Number(node.getAttribute('data-solomon-heading')),
    liveEnemies: Number(node.getAttribute('data-wave-live-enemy-count')),
    mouthPose: Number(node.getAttribute('data-solomon-mouth-pose')),
    pendingSpawnBudget: Number(node.getAttribute('data-wave-pending-spawn-budget')),
    phase: node.getAttribute('data-solomon-phase'),
    renderFrame: Number(document.querySelector('.boneyard-dig-anchor')
      ?.getAttribute('data-frame')),
    runEventId: Number(node.getAttribute('data-solomon-run-event-id')),
    voiceCue: node.getAttribute('data-solomon-voice-cue'),
    voiceEventId: Number(node.getAttribute('data-solomon-voice-event-id')),
    waveOrdinal: Number(node.getAttribute('data-wave-ordinal')),
    wavePhase: node.getAttribute('data-wave-phase'),
    waveScheduleIndex: Number(node.getAttribute('data-wave-schedule-index')),
    waveSpawnDelayTicks: Number(node.getAttribute('data-wave-spawn-delay-ticks')),
  }))
}

async function currentEncounterReceipt(page) {
  const scene = page.locator('.boneyard-scene')
  return await scene.count() === 0 ? null : encounterReceipt(scene)
}

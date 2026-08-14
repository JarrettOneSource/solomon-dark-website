import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import { solomonContactContains } from '../src/game/core-kernels/boneyard-encounter.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import {
  createBoneyardCollisionWorld,
  resolveBoneyardMovement,
} from '../src/game/core-server/boneyard-collision.ts'

const baseUrl = process.env.SDR_GAME_WAVES_SMOKE_URL
  || process.env.SDR_GAME_SMOKE_URL
  || 'http://127.0.0.1:4181'
const screenshotPath = process.env.SDR_GAME_WAVES_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-solomon-waves.png'
const speakingScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-speaking$1')
const combatScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-combat$1')
const deathScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-death$1')
const gameOverScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-game-over$1')
const loadoutScreenshotPath = screenshotPath.replace(/(\.[^.]+)?$/, '-loadout$1')
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
await page.addInitScript(installAudioPlayProbe)

try {
  await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene')
  const initial = await encounterReceipt(scene)
  assert.equal(initial.phase, 'digging')
  assert.equal(initial.wavePhase, 'dormant')
  assert.equal(initial.liveEnemies, 0)
  const loadedBoneyard = await page.evaluate(() => window.__sdrLoadedBoneyard)
  assert.ok(loadedBoneyard?.scene?.solomonDig, 'expected the loaded Solomon Dig scene')

  const gateCrossing = await crossNearestEntryGate(page, scene)
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
  const combat = await castUntilEnemyDies(page)
  await page.screenshot({ path: combatScreenshotPath })
  const locomotion = await kiteUntilSolomonTaunt(page)
  const taunt = await encounterReceipt(scene)
  assert.equal(taunt.voiceCue, 'solomon-get-him-boys')
  assert.equal(taunt.voiceEventId, 3)
  assert.ok(taunt.liveEnemies >= 9 && taunt.liveEnemies <= 15)
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
  assert.notEqual(secondRun.runId, firstRunId)
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
  assert.ok(audioPlaySources.some((source) => source.includes('death-guitar')))
  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    approach,
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
  })}\n`)
  throw error
} finally {
  await page.close()
  await browser.close()
}

async function kiteUntilSolomonTaunt(page) {
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
      const target = nearestLivingEnemy(frame)
      const away = target
        ? { x: frame.playerX - target.x, y: frame.playerY - target.y }
        : fallbackDirections[pulseIndex % fallbackDirections.length]
      const keys = movementKeys(away)
      await pulseMovement(
        page,
        keys.length > 0 ? keys : movementKeys(fallbackDirections[pulseIndex % 4]),
        180,
      )
    } else {
      await page.waitForTimeout(100)
    }
    pulseIndex += 1
  }
  throw new Error('Solomon did not finish the laugh and taunt while combat was active')
}

async function castUntilEnemyDies(page) {
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let before = await boneyardFrame(page)
    const visibilityDeadline = Date.now() + 60_000
    while (
      before.localPlayerLifeState === 'alive'
      && nearestVisibleLivingEnemy(before) === null
      && Date.now() < visibilityDeadline
    ) {
      await page.waitForTimeout(100)
      before = await boneyardFrame(page)
    }
    assert.equal(before.localPlayerLifeState, 'alive', 'player died before the combat cast')
    const target = nearestVisibleLivingEnemy(before)
    assert.ok(target, 'expected a visible opening-wave enemy')
    const targetHealth = target.currentHealth
    const targetId = target.id
    const targetPoint = await enemyScreenPoint(canvas, before, target)
    await page.bringToFront()
    await page.mouse.move(targetPoint.x, targetPoint.y)
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(35)
    await page.mouse.up({ button: 'left' })

    let accepted
    try {
      const acceptedHandle = await page.waitForFunction((manaBefore) => {
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        return frame?.localPlayerMana < manaBefore ? structuredClone(frame) : null
      }, before.localPlayerMana, { timeout: 30_000 })
      accepted = await acceptedHandle.jsonValue()
      await acceptedHandle.dispose()
    } catch {
      await page.waitForFunction((tick) => (
        document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.tick >= tick + 80
      ), before.tick, { timeout: 60_000 })
      continue
    }

    try {
      const hitHandle = await page.waitForFunction(({ enemyCount, health, id }) => {
        const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
        if (!frame) return null
        const enemy = frame.enemySamples.find((candidate) => candidate.id === id)
        if (!enemy && frame.enemyCount < enemyCount) {
          return { frame: structuredClone(frame), retired: true }
        }
        return enemy && (enemy.currentHealth < health || enemy.lifeState === 'death')
          ? { enemy: { ...enemy }, frame: structuredClone(frame), retired: false }
          : null
      }, {
        enemyCount: before.enemyCount,
        health: targetHealth,
        id: targetId,
      }, { timeout: 60_000 })
      const hit = await hitHandle.jsonValue()
      await hitHandle.dispose()
      assert.ok(hit.retired || hit.enemy?.lifeState === 'death' || hit.enemy?.currentHealth <= 0)
      return {
        acceptedTick: accepted.tick,
        attempt,
        enemyCountAfter: hit.frame.enemyCount,
        enemyCountBefore: before.enemyCount,
        enemyHealthAfter: hit.enemy?.currentHealth ?? null,
        enemyHealthBefore: targetHealth,
        enemyLifeState: hit.enemy?.lifeState ?? 'retired',
        manaAfter: accepted.localPlayerMana,
        manaBefore: before.localPlayerMana,
        targetId,
      }
    } catch {
      await page.waitForFunction((tick) => (
        document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.tick >= tick + 80
      ), accepted.tick, { timeout: 60_000 })
    }
  }
  throw new Error('Fire casts never contacted an opening-wave enemy')
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

function nearestVisibleLivingEnemy(frame) {
  return frame.enemySamples
    .filter((enemy) => {
      if (enemy.lifeState === 'death') return false
      const x = frame.playerScreenX + (enemy.x - frame.playerX) * 1.35
      const y = frame.playerScreenY + (enemy.y - frame.playerY) * 1.35
      return x >= 30 && x <= 1_570 && y >= 30 && y <= 870
    })
    .toSorted((left, right) => (
      Math.hypot(left.x - frame.playerX, left.y - frame.playerY)
      - Math.hypot(right.x - frame.playerX, right.y - frame.playerY)
      || left.id - right.id
    ))[0] ?? null
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

function installAudioPlayProbe() {
  const sources = []
  const nativePlay = HTMLMediaElement.prototype.play
  Object.defineProperty(window, '__sdrAudioPlaySources', { value: sources })
  Object.defineProperty(window, '__sdrLoadedBoneyard', {
    configurable: true,
    value: null,
    writable: true,
  })
  HTMLMediaElement.prototype.play = function play() {
    sources.push(this.currentSrc || this.src)
    return nativePlay.call(this)
  }
  const NativeWebSocket = window.WebSocket
  window.WebSocket = class ProbedWebSocket extends NativeWebSocket {
    constructor(...arguments_) {
      super(...arguments_)
      this.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') return
        try {
          const message = JSON.parse(event.data)
          if (message?.type === 'server-boneyard-loaded') {
            window.__sdrLoadedBoneyard = message.boneyard
          }
        } catch {
          // The application protocol owns malformed-frame handling.
        }
      })
    }
  }
}

async function enterBoneyard(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
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

async function crossNearestEntryGate(page, scene) {
  const initialX = Number(await scene.getAttribute('data-local-player-x'))
  const initialY = Number(await scene.getAttribute('data-local-player-y'))
  const initialGateState = await scene.getAttribute('data-gate-state')
  const target = nearestGateCenter(initialGateState, initialX, initialY)
  const aligned = await walkToPoint(page, scene, { x: target.x, y: initialY }, 60_000)
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
  }
}

async function walkToPoint(page, scene, target, timeoutMs) {
  const startedAt = Date.now()
  let stalledSteps = 0
  let wallFollow = null
  while (Date.now() - startedAt < timeoutMs) {
    const before = await playerPointReceipt(scene, target)
    if (before.distance <= 10) return { x: before.x, y: before.y }
    const dx = target.x - before.x
    const dy = target.y - before.y
    let movement = { x: dx, y: dy }
    if (wallFollow) {
      movement = {
        x: dx * 0.25 - dy * wallFollow.sign,
        y: dy * 0.25 + dx * wallFollow.sign,
      }
    }
    await pulseMovement(page, movementKeys(movement), 150)
    const after = await playerPointReceipt(scene, target)
    if (wallFollow && after.distance < wallFollow.blockedDistance - 30) {
      wallFollow = null
      stalledSteps = 0
    } else if (wallFollow) {
      const moved = Math.hypot(after.x - before.x, after.y - before.y)
      wallFollow.stalledSteps = moved < 1 ? wallFollow.stalledSteps + 1 : 0
      if (wallFollow.stalledSteps >= 4) {
        wallFollow = {
          blockedDistance: after.distance,
          sign: -wallFollow.sign,
          stalledSteps: 0,
        }
      }
    } else if (!wallFollow && after.distance < before.distance - 1) {
      stalledSteps = 0
    } else if (!wallFollow) {
      stalledSteps += 1
      if (stalledSteps >= 4) {
        wallFollow = {
          blockedDistance: after.distance,
          sign: 1,
          stalledSteps: 0,
        }
        stalledSteps = 0
      }
    }
  }
  throw new Error(`could not walk to ${JSON.stringify(target)}`)
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
  let routeIndex = 1
  let stalledSteps = 0
  let obstacleEscapeSign = 1

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
    while (
      routeIndex < route.length
      && Math.hypot(
        route[routeIndex].x - before.playerX,
        route[routeIndex].y - before.playerY,
      ) <= 15
    ) {
      routeIndex += 1
    }
    if (routeIndex >= route.length) {
      route = planSolomonPath(boneyardScene, playerPosition, solomon)
      routeIndex = 1
      continue
    }
    const waypoint = route[routeIndex]
    const waypointDistance = Math.hypot(
      waypoint.x - before.playerX,
      waypoint.y - before.playerY,
    )
    const movement = {
      x: waypoint.x - before.playerX,
      y: waypoint.y - before.playerY,
    }
    await pulseMovement(page, movementKeys(movement), 250)
    const after = await approachReceipt(scene)
    if (after.phase !== 'digging') continue
    const moved = Math.hypot(
      after.playerX - before.playerX,
      after.playerY - before.playerY,
    )
    const nextWaypointDistance = Math.hypot(
      waypoint.x - after.playerX,
      waypoint.y - after.playerY,
    )
    if (moved >= 1 && nextWaypointDistance < waypointDistance - 1) {
      stalledSteps = 0
    } else {
      stalledSteps += 1
      if (stalledSteps >= 6) {
        if (after.distance < 400) {
          const radialX = solomon.x - after.playerX
          const radialY = solomon.y - after.playerY
          await pulseMovement(page, movementKeys({
            x: -radialY * obstacleEscapeSign,
            y: radialX * obstacleEscapeSign,
          }), 900)
          obstacleEscapeSign *= -1
        }
        route = planSolomonPath(
          boneyardScene,
          { x: after.playerX, y: after.playerY },
          solomon,
        )
        routeIndex = 1
        stalledSteps = 0
      }
    }
  }
  throw new Error(`could not walk to Solomon: ${JSON.stringify(samples.at(-1))}`)
}

function planSolomonPath(scene, start, solomon) {
  const collision = createBoneyardCollisionWorld(scene)
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
    if (solomonContactContains(solomon, point)) {
      return reconstructGridPath(key, parents, points)
    }
    const [gridX, gridY] = key.split(',').map(Number)
    const orderedDirections = directions.toSorted((first, second) => {
      const firstDistance = Math.hypot(
        start.x + (gridX + first.x) * gridStep - solomon.x,
        start.y + (gridY + first.y) * gridStep - solomon.y,
      )
      const secondDistance = Math.hypot(
        start.x + (gridX + second.x) * gridStep - solomon.x,
        start.y + (gridY + second.y) * gridStep - solomon.y,
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
  throw new Error(`no collision-safe route to Solomon from ${JSON.stringify(start)}`)
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

async function pulseMovement(page, keys, durationMs) {
  for (const key of keys) await page.keyboard.down(key)
  try {
    await page.waitForTimeout(durationMs)
  } finally {
    for (const key of keys.reverse()) await page.keyboard.up(key)
  }
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

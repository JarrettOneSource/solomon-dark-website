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
  await page.waitForFunction((initialPose) => {
    const scene = document.querySelector('.boneyard-scene')
    return scene?.getAttribute('data-solomon-phase') === 'speaking'
      && Number(scene.getAttribute('data-solomon-mouth-pose')) !== initialPose
  }, hello.mouthPose, { timeout: 5_000 })
  const animatedSpeech = await encounterReceipt(scene)
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

  await page.waitForFunction(() => (
    Number(document.querySelector('.boneyard-scene')
      ?.getAttribute('data-solomon-run-event-id')) === 1
  ), undefined, { timeout: 15_000 })
  const runEdge = await encounterReceipt(scene)
  assert.ok(runEdge.phase === 'escaping' || runEdge.phase === 'gone')
  await page.screenshot({ path: screenshotPath })
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return Number(scene?.getAttribute('data-wave-live-enemy-count')) >= 10
      && window.__sdrAudioPlaySources?.some((source) => source.includes('solomon-laugh-1'))
  }, undefined, { timeout: 5_000 })
  const opening = await encounterReceipt(scene)
  assert.ok(opening.wavePhase === 'opening' || opening.wavePhase === 'opening-threshold')
  assert.ok(opening.liveEnemies >= 10 && opening.liveEnemies <= 15)
  assert.equal(opening.liveEnemies + opening.pendingSpawnBudget, 15)
  assert.equal(opening.waveOrdinal, 0)

  await page.waitForFunction(() => (
    Number(document.querySelector('.boneyard-scene')
      ?.getAttribute('data-solomon-voice-event-id')) === 3
    && window.__sdrAudioPlaySources?.some(
      (source) => source.includes('solomon-get-him-boys'),
    )
  ), undefined, { timeout: 5_000 })
  await page.waitForFunction(() => {
    const scene = document.querySelector('.boneyard-scene')
    return scene?.getAttribute('data-wave-phase') === 'opening-threshold'
      && Number(scene.getAttribute('data-wave-live-enemy-count')) === 15
      && Number(scene.getAttribute('data-wave-pending-spawn-budget')) === 0
  }, undefined, { timeout: 15_000 })
  const taunt = await encounterReceipt(scene)
  assert.equal(taunt.voiceCue, 'solomon-get-him-boys')
  assert.equal(taunt.liveEnemies, 15)
  assert.equal(taunt.wavePhase, 'opening-threshold')

  const audioPlaySources = await page.evaluate(() => (
    [...new Set(window.__sdrAudioPlaySources ?? [])]
  ))
  assert.ok(audioPlaySources.some((source) => source.includes(hello.voiceCue)))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-laugh-1')))
  assert.ok(audioPlaySources.some((source) => source.includes('solomon-get-him-boys')))
  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    approach,
    audioPlaySources,
    errors,
    gateCrossing,
    headings: [...new Set(headings)],
    hello,
    mouthPoses: [...new Set(mouthPoses)],
    opening,
    runEdge,
    screenshotPath,
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

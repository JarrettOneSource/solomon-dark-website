import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import {
  hubPortalAt,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
} from '../src/game/core-kernels/hub-regions.ts'
import { HUB_SPAWN } from '../src/game/core-kernels/hub-math.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import {
  NATIVE_HUB_COURTYARD_OBSTACLES,
  NATIVE_HUB_COURTYARD_OBSTACLE_PAINTER_IDS,
} from '../src/game/core-kernels/native-hub-world-membership.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { hubActorDepth } from '../src/game/hub-depth.ts'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4187'
const screenshotRoot = process.env.SDR_GAME_HUB_ROOM_SCREENSHOT_ROOT || '/tmp/solomon-dark-hub-room'
const localCredential = 'hub-room-browser-parity'
const hubPainterDepthBase = hubActorDepth(0)
const localHost = new URL(baseUrl).protocol === 'https:'
  ? null
  : await startGameHost({
      allowedOrigins: [new URL(baseUrl).origin],
      authentication: { credential: localCredential, kind: 'shared' },
      snapshotRate: 100,
    })
const runtime = localHost
  ? {
      gameEndpoint: {
        credential: localCredential,
        kind: 'localhost',
        url: localHost.address.url,
      },
    }
  : await provisionProductionRuntime()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

const allRoomRuns = [
  {
    approach: { x: 628, y: 230 },
    enterKeys: ['w'],
    region: 'storeroom',
  },
  {
    approach: { x: 260, y: 610 },
    enterKeys: ['a', 'w'],
    region: 'mortuary',
  },
  {
    approach: HUB_SPAWN,
    approachPortalClearance: PLAYER_CHARACTER_RADIUS,
    enterKeys: ['w'],
    region: 'office',
  },
  {
    approach: { x: 1800, y: 650 },
    enterKeys: ['d', 'w'],
    region: 'library',
  },
]
const requestedRegion = process.env.SDR_GAME_HUB_ROOM?.trim()
const roomRuns = requestedRegion
  ? allRoomRuns.filter(({ region }) => region === requestedRegion)
  : allRoomRuns
assert.ok(roomRuns.length > 0, `unknown Hub room ${JSON.stringify(requestedRegion)}`)

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const pageErrors = []
  const consoleErrors = []
  const failedResponses = []
  const requestFailures = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText ?? 'unknown'
    const url = request.url()
    if (error === 'net::ERR_ABORTED' && new URL(url).pathname === '/deployment.json') return
    requestFailures.push({ error, url })
  })
  page.on('response', response => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current')
    return route.fulfill({ json: { revision: current } })
  })
  if (runtime) {
    await page.addInitScript((configuration) => {
      window.solomonDarkRuntime = configuration
    }, runtime)
  }

  await enterHub(page)
  const scene = page.locator('.hub-scene[data-renderer-state="ready"]')
  const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  const initialCanvas = await canvas.elementHandle()
  assert.ok(initialCanvas, 'expected the mounted Hub canvas')
  const courtyardLayering = await captureCourtyardLayering(page, canvas)
  // Stand between Teacher Y 710.5 and the independently queued release Y
  // 725.5 so one frame proves the pre/world/post painter split by occlusion.
  const teacherOcclusionTarget = { x: 520, y: 718 }
  assert.ok(localHost, 'Teacher painter proof requires the local authoritative host')
  assert.equal(
    isHubRegionTraversable('courtyard', teacherOcclusionTarget, PLAYER_CHARACTER_RADIUS),
    true,
  )
  const teacherPlayerId = localHost.hostPlayerId()
  assert.ok(teacherPlayerId)
  setHostPlayerPose(localHost, teacherPlayerId, teacherOcclusionTarget, 0)
  await page.waitForFunction((expected) => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame
      && Math.hypot(frame.playerX - expected.x, frame.playerY - expected.y) < 0.1
  }, teacherOcclusionTarget, { timeout: 10_000 })
  assert.equal(
    await moveTo(page, canvas, teacherOcclusionTarget, 6),
    true,
    JSON.stringify(await playerPosition(canvas)),
  )
  const teacherScreenshotPath = `${screenshotRoot}-teacher-release.png`
  const teacher = await captureTeacherRelease(page, canvas, teacherScreenshotPath)
  const receipts = []

  for (const room of roomRuns) {
    assert.equal(await scene.getAttribute('data-hub-region'), 'courtyard')
    process.stdout.write(`Navigating to ${room.region}...\n`)
    let routeWaypoints = 0
    for (const target of room.via ?? []) {
      routeWaypoints += await navigateCourtyard(
        page,
        canvas,
        target,
        target.portalClearance,
      )
      assert.equal(await canvas.getAttribute('data-hub-region'), 'courtyard')
    }
    routeWaypoints += await navigateCourtyard(
      page,
      canvas,
      room.approach,
      room.approachPortalClearance,
    )
    assert.equal(await canvas.getAttribute('data-hub-region'), 'courtyard')
    process.stdout.write(`Staged at ${JSON.stringify(await playerPosition(canvas))}.\n`)
    const entryPath = `${screenshotRoot}-${room.region}-entry.png`
    await page.screenshot({ path: entryPath })
    const entered = await holdUntilTransition(page, canvas, room.enterKeys, room.region)
    await waitForSettledRegion(page, canvas, room.region)
    process.stdout.write(`Entered ${room.region}.\n`)
    const roomPath = `${screenshotRoot}-${room.region}.png`
    await page.screenshot({ path: roomPath })
    const roomPosition = await playerPosition(canvas)
    assert.equal(await scene.getAttribute('data-hub-region'), room.region)
    assert.match(await scene.getAttribute('aria-label') || '', new RegExp(room.region, 'i'))
    const painter = await painterReceipt(canvas, room.region)

    const collision = room.region === 'office'
      ? await verifyOfficeInnerContour(page, canvas)
      : null

    const returned = await holdUntilTransition(page, canvas, ['s'], 'courtyard')
    await waitForSettledRegion(page, canvas, 'courtyard')
    process.stdout.write(`Returned from ${room.region}.\n`)
    receipts.push({
      entered,
      entryScreenshotPath: entryPath,
      ...(collision ? { collision } : {}),
      region: room.region,
      painter,
      roomPosition,
      routeWaypoints,
      returned,
      screenshotPath: roomPath,
    })
  }

  assert.equal(await initialCanvas.evaluate((node) => node.isConnected), true)
  assert.equal(await page.locator('.hub-world-canvas').count(), 1)
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(requestFailures, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    failedResponses,
    pageErrors,
    receipts,
    status: 'ok',
    teacher,
    courtyardLayering,
    requestFailures,
  })}\n`)
} finally {
  await browser.close()
  await localHost?.close()
}

async function provisionProductionRuntime() {
  const origin = new URL(baseUrl)
  if (origin.protocol !== 'https:') return null
  const response = await fetch(new URL('/api/game/sessions', origin), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'x-solomon-dark-session': 'provision',
    },
  })
  const payload = await response.json()
  assert.equal(response.status, 200, JSON.stringify(payload))
  assert.equal(payload.kind, 'remote')
  return { gameEndpoint: payload }
}

async function enterHub(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorialPrompt = page.locator('.stock-prompt-dialog[data-prompt-kind="tutorial"]')
  await tutorialPrompt.waitFor({ state: 'visible', timeout: 30_000 })
  await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
  await tutorialPrompt.waitFor({ state: 'hidden', timeout: 30_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  const hubScene = page.locator('.hub-scene[data-renderer-state="ready"]')
  try {
    await hubScene.waitFor({ timeout: 90_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      url: page.url(),
    })}\n`)
    throw error
  }
  await page.locator('.hub-world-canvas[data-hub-region="courtyard"]').waitFor({ timeout: 30_000 })
}

async function playerPosition(canvas) {
  return canvas.evaluate((node) => ({
    x: node.__sdrHubFrame.playerX,
    y: node.__sdrHubFrame.playerY,
  }))
}

async function captureTeacherRelease(page, canvas, screenshotPath) {
  await page.waitForFunction(() => {
    const burst = document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.teacherBurst
    return burst?.visible === true && burst.coreAlpha > 0
  }, undefined, { timeout: 15_000 })
  const frame = await canvas.evaluate(node => structuredClone(node.__sdrHubFrame))
  const diagnostic = frame.teacherBurst
  assert.ok(diagnostic.ageTicks >= 0 && diagnostic.ageTicks < 10)
  assert.ok(diagnostic.columnAlpha > 0)
  assert.ok(diagnostic.coreAlpha > 0)
  assert.ok(diagnostic.flareAlpha > 0)
  assert.ok(diagnostic.frame >= 0 && diagnostic.frame <= 10)
  assert.ok(diagnostic.frameAlpha > 0)
  const column = frame.painterOrder.find(
    ({ id }) => id === `teacher-column:${diagnostic.releaseIndex}`,
  )
  const frames = frame.painterOrder.find(
    ({ id }) => id === `teacher-frames:${diagnostic.releaseIndex}`,
  )
  assert.ok(column)
  assert.ok(frames)
  assert.equal(column.row, frames.row)
  assert.equal(column.zIndex + 1, frames.zIndex)
  const player = await playerPosition(canvas)
  assert.ok(player.y > 710.5 && player.y < 725.5, JSON.stringify(player))
  await page.screenshot({ path: screenshotPath })
  return { column, diagnostic, frames, player, screenshotPath }
}

async function verifyOfficeInnerContour(page, canvas) {
  const start = await playerPosition(canvas)
  assert.equal(await canvas.getAttribute('data-hub-region'), 'office')
  const enteredAtInnerContour = distance(start, { x: 512, y: 766.6 }) < 0.15
  assert.ok(
    enteredAtInnerContour || distance(start, { x: 512, y: 874 }) < 1,
    JSON.stringify(start),
  )

  const deadline = Date.now() + 5_000
  let last = start
  let stableSince = null
  let sampleCount = 0
  let minimumY = start.y
  try {
    await page.keyboard.down('w')
    while (Date.now() < deadline) {
      const current = await playerPosition(canvas)
      sampleCount += 1
      minimumY = Math.min(minimumY, current.y)
      if (current.y < 800 && distance(current, last) < 0.01) {
        stableSince ??= Date.now()
        if (Date.now() - stableSince >= 500) break
      } else {
        stableSince = null
      }
      last = current
      await page.waitForTimeout(25)
    }
  } finally {
    await page.keyboard.up('w')
  }

  await page.waitForTimeout(350)
  const stopped = await playerPosition(canvas)
  assert.equal(await canvas.getAttribute('data-hub-region'), 'office')
  assert.ok(stableSince, `Office player did not settle at the inner contour: ${JSON.stringify(stopped)}`)
  assert.ok(Math.abs(stopped.x - 512) < 0.01, JSON.stringify(stopped))
  assert.ok(
    Math.abs(stopped.y - 766.6) < 0.15,
    `expected native Office stop y=766.6, got ${stopped.y}`,
  )
  assert.ok(
    enteredAtInnerContour
      ? distance(start, stopped) < 0.15
      : start.y - stopped.y > 100,
    JSON.stringify({ start, stopped }),
  )

  const screenshotPath = `${screenshotRoot}-office-collision.png`
  await page.screenshot({ path: screenshotPath })
  process.stdout.write(`Office inner contour stopped at ${JSON.stringify(stopped)}.\n`)
  return {
    enteredAtInnerContour,
    minimumY,
    nativeSegment: { x1: 450.5, x2: 589.5, y: 741.5 },
    sampleCount,
    screenshotPath,
    start,
    stopped,
  }
}

function planCourtyardRoute(start, target, portalClearance) {
  const step = 15
  const routeRadius = PLAYER_CHARACTER_RADIUS
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ]
  const open = new Map([['0,0', {
    cost: 0,
    estimate: distance(start, target),
    ix: 0,
    iy: 0,
    position: start,
  }]])
  const best = new Map([['0,0', 0]])
  const parents = new Map()
  let goalKey

  for (let visited = 0; open.size > 0 && visited < 100_000; visited += 1) {
    const [key, current] = [...open].reduce((bestEntry, entry) => (
      entry[1].estimate < bestEntry[1].estimate ? entry : bestEntry
    ))
    open.delete(key)
    if (distance(current.position, target) <= step * 1.25) {
      goalKey = key
      break
    }
    for (const [directionX, directionY] of directions) {
      const ix = current.ix + directionX
      const iy = current.iy + directionY
      const nextKey = `${ix},${iy}`
      const delta = { x: directionX * step, y: directionY * step }
      const expected = {
        x: current.position.x + delta.x,
        y: current.position.y + delta.y,
      }
      if (!isSafeCourtyardNavigationPoint(expected, routeRadius, portalClearance)) continue
      const moved = moveWithHubRegionCollisionState(
        'courtyard',
        current.position,
        delta,
        routeRadius,
        0x51a7c011,
      ).position
      if (distance(moved, expected) > 0.01) continue
      const cost = current.cost + Math.hypot(delta.x, delta.y)
      if (cost >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue
      best.set(nextKey, cost)
      parents.set(nextKey, key)
      open.set(nextKey, {
        cost,
        estimate: cost + distance(expected, target),
        ix,
        iy,
        position: expected,
      })
    }
  }
  assert.ok(goalKey, `could not plan a Courtyard route to ${JSON.stringify(target)}`)

  const nodes = []
  for (let key = goalKey; key !== '0,0'; key = parents.get(key)) {
    const [ix, iy] = key.split(',').map(Number)
    nodes.push({ x: start.x + ix * step, y: start.y + iy * step })
  }
  nodes.reverse()
  nodes.push(target)
  return simplifyRoute(start, nodes, routeRadius, portalClearance)
}

function simplifyRoute(start, route, routeRadius, portalClearance) {
  const simplified = []
  let anchor = start
  let nextIndex = 0
  while (nextIndex < route.length) {
    let furthestIndex = route.length - 1
    while (
      furthestIndex > nextIndex
      && !canTraverseLine(anchor, route[furthestIndex], routeRadius, portalClearance)
    ) {
      furthestIndex -= 1
    }
    if (!canTraverseLine(anchor, route[furthestIndex], routeRadius, portalClearance)) {
      return route.slice(nextIndex)
    }
    anchor = route[furthestIndex]
    simplified.push(anchor)
    nextIndex = furthestIndex + 1
  }
  return simplified
}

function canTraverseLine(start, target, routeRadius, portalClearance) {
  const length = distance(start, target)
  const steps = Math.max(1, Math.ceil(length / 5))
  let current = start
  for (let index = 1; index <= steps; index += 1) {
    const expected = {
      x: start.x + (target.x - start.x) * index / steps,
      y: start.y + (target.y - start.y) * index / steps,
    }
    if (!isSafeCourtyardNavigationPoint(expected, routeRadius, portalClearance)) return false
    const moved = moveWithHubRegionCollisionState(
      'courtyard',
      current,
      { x: expected.x - current.x, y: expected.y - current.y },
      routeRadius,
      0x51a7c011,
    ).position
    if (distance(moved, expected) > 0.01) return false
    current = expected
  }
  return true
}

function isSafeCourtyardNavigationPoint(point, routeRadius, portalClearance = 50) {
  const portal = hubPortalAt('courtyard', point, portalClearance)
  return isHubRegionTraversable('courtyard', point, routeRadius)
    && portal?.destination !== 'office'
}

async function navigateCourtyard(page, canvas, target, portalClearance) {
  const start = await playerPosition(canvas)
  if (distance(start, target) <= 60) return 0
  const route = planCourtyardRoute(start, target, portalClearance)
  process.stdout.write(`Planned ${route.length} collision-safe waypoints.\n`)
  for (let index = 0; index < route.length; index += 1) {
    const waypoint = route[index]
    let reached = false
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await moveTo(page, canvas, waypoint)) {
        reached = true
        break
      }
      const current = await playerPosition(canvas)
      process.stdout.write(
        `Waypoint ${index + 1}/${route.length} attempt ${attempt + 1} stopped at ${JSON.stringify(current)} toward ${JSON.stringify(waypoint)}.\n`,
      )
      if (index < route.length - 1 && distance(current, waypoint) <= 65) {
        reached = true
        break
      }
      await sidestep(page, canvas, waypoint, attempt)
    }
    if (!reached) throw new Error(
      `could not reach Courtyard waypoint ${JSON.stringify(waypoint)} from ${JSON.stringify(await playerPosition(canvas))}`,
    )
  }
  assert.ok(
    distance(await playerPosition(canvas), target) <= 60,
    `could not navigate the Courtyard to ${JSON.stringify(target)}`,
  )
  return route.length
}

async function sidestep(page, canvas, target, attempt) {
  const current = await playerPosition(canvas)
  const horizontalTravel = Math.abs(target.x - current.x) >= Math.abs(target.y - current.y)
  const key = horizontalTravel
    ? (attempt % 2 === 0 ? 's' : 'w')
    : (attempt % 2 === 0 ? 'd' : 'a')
  await page.keyboard.down(key)
  await page.waitForTimeout(700)
  await page.keyboard.up(key)
  await page.waitForTimeout(300)
}

async function moveTo(page, canvas, target, arrivalTolerance = 60) {
  const pressed = new Set()
  const deadline = Date.now() + 6_000
  let last = await playerPosition(canvas)
  let lastMovedAt = Date.now()
  let bestRemaining = distance(last, target)
  let lastProgressAt = Date.now()
  try {
    while (Date.now() < deadline) {
      const current = await playerPosition(canvas)
      const remaining = distance(current, target)
      if (remaining <= Math.min(45, arrivalTolerance)) {
        await syncKeys(page, pressed, [])
        await page.waitForTimeout(350)
        if (distance(await playerPosition(canvas), target) <= arrivalTolerance) return true
      }
      if (remaining < bestRemaining - 2) {
        bestRemaining = remaining
        lastProgressAt = Date.now()
      } else if (Date.now() - lastProgressAt > 2_000) return false
      if (distance(current, last) > 0.5) {
        last = current
        lastMovedAt = Date.now()
      } else if (Date.now() - lastMovedAt > 2_000) {
        return false
      }
      const keys = []
      const axisTolerance = Math.min(6, Math.max(1, arrivalTolerance / 2))
      if (target.x - current.x > axisTolerance) keys.push('d')
      if (target.x - current.x < -axisTolerance) keys.push('a')
      if (target.y - current.y > axisTolerance) keys.push('s')
      if (target.y - current.y < -axisTolerance) keys.push('w')
      await syncKeys(page, pressed, keys)
      let sampleDelay = 50
      if (remaining < 60) sampleDelay = arrivalTolerance < 45 ? 10 : 25
      await page.waitForTimeout(sampleDelay)
    }
    return false
  } finally {
    await syncKeys(page, pressed, [])
  }
}

async function holdUntilTransition(page, canvas, keys, destination) {
  const pressed = new Set()
  const samples = []
  const deadline = Date.now() + 10_000
  try {
    await syncKeys(page, pressed, keys)
    while (Date.now() < deadline) {
      const sample = await canvas.evaluate((node) => ({
        alpha: Number(node.dataset.transitionAlpha),
        phase: node.dataset.transitionPhase,
        region: node.dataset.hubRegion,
        x: node.__sdrHubFrame.playerX,
        y: node.__sdrHubFrame.playerY,
      }))
      samples.push(sample)
      const observedFade = samples.some(({ alpha, phase }) => (
        phase === 'outgoing' && alpha > 0 && alpha < 1
      ))
      if ((sample.phase === 'outgoing' && observedFade) || sample.region === destination) {
        return {
          destination,
          observedFade,
          startRegion: samples[0]?.region,
        }
      }
      await page.waitForTimeout(25)
    }
    throw new Error(
      `portal input did not start transition to ${destination}: ${JSON.stringify({
        first: samples[0],
        last: samples.at(-1),
      })}`,
    )
  } finally {
    await syncKeys(page, pressed, [])
  }
}

async function waitForSettledRegion(page, canvas, region) {
  await page.waitForFunction(
    (expected) => {
      const node = document.querySelector('.hub-world-canvas')
      return node?.dataset.hubRegion === expected
        && node.dataset.transitionPhase === 'none'
        && Number(node.dataset.transitionAlpha) === 0
    },
    region,
    { timeout: 15_000 },
  )
  assert.equal(await canvas.getAttribute('data-hub-region'), region)
}

async function captureCourtyardLayering(page, canvas) {
  const fixedObstacleIds = NATIVE_HUB_COURTYARD_OBSTACLE_PAINTER_IDS.map(
    id => `fixed:${id}`,
  )
  const sample = async (label, expectedRow) => {
    const frame = await canvas.evaluate(node => structuredClone(node.__sdrHubFrame))
    const player = frame.painterOrder.find(({ id }) => id === `player:${frame.localPlayerId}`)
    const fomentius = frame.painterOrder.find(({ id }) => id === 'fixed:fomentius')
    assert.equal(frame.collegeObstacleCount, 8)
    assert.equal(player?.row, expectedRow, JSON.stringify({ frame, label }))
    assert.equal(frame.usefulThyngsStackZIndex, hubPainterDepthBase + fomentius?.zIndex)
    assert.deepEqual(frame.usefulThyngsChildDepths, [0, 1, 2, 3])
    assert.ok(frame.usefulThyngsShadowZIndex < frame.usefulThyngsStackZIndex)
    assert.ok(frame.usefulThyngsMarkerZIndex > frame.usefulThyngsStackZIndex)
    assert.ok(frame.usefulThyngsMarkerZIndex < frame.usefulThyngsStackZIndex + 1)
    for (const interactionId of [
      'hagatha', 'annalist', 'fomentius', 'luthacus', 'skorcha', 'teacher',
    ]) {
      const actor = frame.painterOrder.find(({ id }) => id === `fixed:${interactionId}`)
      if (interactionId === 'skorcha' && !actor) continue
      assert.ok(actor)
      assert.equal(
        frame.npcMarkerZIndexes[interactionId],
        hubPainterDepthBase + actor.zIndex + 0.1,
      )
    }
    for (const id of [...fixedObstacleIds, 'fixed:college-statue']) {
      assert.ok(frame.painterOrder.some(layer => layer.id === id), `${label} lost ${id}`)
    }
    const screenshotPath = `${screenshotRoot}-courtyard-layering-${label}.png`
    await page.screenshot({ path: screenshotPath })
    return {
      headingIndex: frame.playerHeadingIndex,
      label,
      painter: player,
      screenshotPath,
      usefulThyngs: {
        childDepths: frame.usefulThyngsChildDepths,
        markerZIndex: frame.usefulThyngsMarkerZIndex,
        painter: fomentius,
        shadowZIndex: frame.usefulThyngsShadowZIndex,
        stackZIndex: frame.usefulThyngsStackZIndex,
      },
      x: frame.playerX,
      y: frame.playerY,
    }
  }

  assert.ok(localHost, 'Courtyard bias proof requires the local authoritative host')
  const playerId = localHost.hostPlayerId()
  assert.ok(playerId)
  const stockSpawn = structuredClone(getPlayerCharacter(localHost.state(), playerId).position)
  setHostPlayerPose(localHost, playerId, stockSpawn, 12)
  await waitForPlayerPainterRow(page, -10)
  const negative = await sample('negative-bias', -10)
  process.stdout.write(`Captured negative Courtyard bias: ${JSON.stringify(negative)}\n`)

  assert.equal(await moveTo(page, canvas, { x: 980, y: stockSpawn.y }, 4), true)
  await waitForPlayerPainterRow(page, 10)
  const positive = await sample('positive-bias', 10)
  process.stdout.write(`Captured positive Courtyard bias: ${JSON.stringify(positive)}\n`)

  assert.equal(await moveTo(page, canvas, { x: 980, y: 190 }, 4), true)
  await waitForPlayerPainterRow(page, 0)
  const zero = await sample('outside-bias', 0)
  process.stdout.write(`Captured zero Courtyard bias: ${JSON.stringify(zero)}\n`)
  const studentCrossings = localHost
    ? await captureStudentObstacleCrossings(page, canvas, localHost)
    : []
  return { negative, positive, studentCrossings, zero }
}

function setHostPlayerPose(host, playerId, position, headingIndex) {
  const state = host.state()
  const player = getPlayerCharacter(state, playerId)
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...player,
      headingIndex,
      position: { ...position },
      velocity: { x: 0, y: 0 },
    }),
  })
}

async function waitForPlayerPainterRow(page, expectedRow) {
  await page.waitForFunction((row) => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    return frame?.painterOrder.find(({ id }) => id === `player:${frame.localPlayerId}`)?.row
      === row
  }, expectedRow, { timeout: 10_000 })
}

async function captureStudentObstacleCrossings(page, canvas, host) {
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') throw new Error('expected Hub host world')
  const population = state.world.studentPopulation
  const originalStudents = population.students
  const source = originalStudents[0]
  assert.ok(source, 'expected one authoritative Student for obstacle crossings')
  const originalSpawningEnabled = population.spawningEnabled
  population.spawningEnabled = false
  const receipts = []
  try {
    for (const obstacle of NATIVE_HUB_COURTYARD_OBSTACLES) {
      const samples = []
      for (const [side, y] of [
        ['above', obstacle.position.y - 70],
        ['below', obstacle.position.y + 70],
      ]) {
        population.store.replaceOrderedStates([{
          ...source,
          currentSpeed: 0,
          desiredSpeed: 0,
          position: { x: obstacle.position.x + 80, y },
          staticCollisionEnabled: false,
          wander: { x: 0, y: 0 },
        }])
        await page.waitForFunction(({ obstacleId, side, studentId }) => {
          const order = document.querySelector('.hub-world-canvas')
            ?.__sdrHubFrame?.painterOrder ?? []
          const obstacleLayer = order.find(layer => layer.id === `fixed:${obstacleId}`)
          const studentLayer = order.find(layer => layer.id === `student:${studentId}`)
          return obstacleLayer && studentLayer && (side === 'above'
            ? studentLayer.row < obstacleLayer.row
            : studentLayer.row > obstacleLayer.row)
        }, { obstacleId: obstacle.id, side, studentId: source.id }, { timeout: 10_000 })
        const frame = await canvas.evaluate(node => structuredClone(node.__sdrHubFrame))
        const obstacleLayer = frame.painterOrder.find(
          ({ id }) => id === `fixed:${obstacle.id}`,
        )
        const studentLayer = frame.painterOrder.find(
          ({ id }) => id === `student:${source.id}`,
        )
        assert.ok(obstacleLayer)
        assert.ok(studentLayer)
        const screenshotPath = obstacle.selector === 0
          ? `${screenshotRoot}-courtyard-arch-student-${side}.png`
          : null
        if (screenshotPath) await page.screenshot({ path: screenshotPath })
        samples.push({ obstacleLayer, screenshotPath, side, studentLayer })
      }
      receipts.push({ id: obstacle.id, samples, selector: obstacle.selector })
    }
  } finally {
    population.store.replaceOrderedStates(originalStudents)
    population.spawningEnabled = originalSpawningEnabled
  }
  return receipts
}

async function painterReceipt(canvas, region) {
  const frame = await canvas.evaluate((node) => structuredClone(node.__sdrHubFrame))
  const order = frame.painterOrder
  assert.ok(order.length > 0)
  assert.deepEqual(
    order.map(({ row }) => row),
    order.map(({ row }) => row).toSorted((left, right) => left - right),
  )
  assert.equal(
    order.find(({ id }) => id === `player:${frame.localPlayerId}`)?.row,
    0,
  )
  assert.ok(order.some(({ id }) => id.startsWith('fixed:')))
  assert.equal(order.some(({ id }) => id.startsWith('scenery:')), false)
  const required = {
    library: [
      'fixed:library-custom-0', 'fixed:library-custom-1',
      'fixed:library-custom-2', 'fixed:librarian', 'fixed:shlorio',
    ],
    mortuary: [
      'fixed:memorator',
      ...Array.from({ length: 10 }, (_, index) => `fixed:mortuary-custom-${index}`),
    ],
    office: ['fixed:office-custom-0', 'fixed:arch-chancellor'],
    storeroom: [
      'fixed:storeroom-custom-0', 'fixed:storeroom-custom-1',
      'fixed:storeroom-custom-2',
    ],
  }[region]
  for (const id of required ?? []) {
    assert.ok(order.some(layer => layer.id === id), `${region} lost ${id}`)
  }
  const markerActors = {
    library: { librarian: 'librarian', shlorio: 'shlorio' },
    mortuary: { memorator: 'memorator' },
    office: { 'arch-chancellor': 'arch-chancellor' },
    storeroom: {},
  }[region]
  for (const [interactionId, actorId] of Object.entries(markerActors ?? {})) {
    const actor = order.find(({ id }) => id === `fixed:${actorId}`)
    assert.ok(actor)
    assert.equal(
      frame.npcMarkerZIndexes[interactionId],
      hubPainterDepthBase + actor.zIndex + 0.1,
    )
  }
  return {
    first: order[0],
    last: order.at(-1),
    layerCount: order.length,
    localPlayer: order.find(({ id }) => id === `player:${frame.localPlayerId}`),
  }
}

async function syncKeys(page, pressed, requested) {
  const next = new Set(requested)
  for (const key of pressed) {
    if (next.has(key)) continue
    await page.keyboard.up(key)
    pressed.delete(key)
  }
  for (const key of next) {
    if (pressed.has(key)) continue
    await page.keyboard.down(key)
    pressed.add(key)
  }
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

import {
  hubPortalAt,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
} from '../src/game/core-kernels/hub-regions.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4187'
const screenshotRoot = process.env.SDR_GAME_HUB_ROOM_SCREENSHOT_ROOT || '/tmp/solomon-dark-hub-room'
const runtime = await provisionProductionRuntime()
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
    approach: { x: 830, y: 920 },
    enterKeys: ['d', 'w'],
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
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
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

    const returned = await holdUntilTransition(page, canvas, ['s'], 'courtyard')
    await waitForSettledRegion(page, canvas, 'courtyard')
    process.stdout.write(`Returned from ${room.region}.\n`)
    receipts.push({
      entered,
      entryScreenshotPath: entryPath,
      region: room.region,
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
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    pageErrors,
    receipts,
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
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
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  await page.locator('.hub-world-canvas[data-hub-region="courtyard"]').waitFor({ timeout: 30_000 })
}

async function playerPosition(canvas) {
  return canvas.evaluate((node) => ({
    x: node.__sdrHubFrame.playerX,
    y: node.__sdrHubFrame.playerY,
  }))
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

async function moveTo(page, canvas, target) {
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
      if (remaining <= 45) {
        await syncKeys(page, pressed, [])
        await page.waitForTimeout(350)
        if (distance(await playerPosition(canvas), target) <= 60) return true
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
      if (target.x - current.x > 6) keys.push('d')
      if (target.x - current.x < -6) keys.push('a')
      if (target.y - current.y > 6) keys.push('s')
      if (target.y - current.y < -6) keys.push('w')
      await syncKeys(page, pressed, keys)
      await page.waitForTimeout(remaining < 60 ? 25 : 50)
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
      }))
      samples.push(sample)
      const observedFade = samples.some(({ alpha, phase }) => (
        phase === 'outgoing' && alpha > 0 && alpha < 1
      ))
      if (sample.phase === 'outgoing' && observedFade) {
        return {
          destination,
          observedFade,
          startRegion: samples[0]?.region,
        }
      }
      await page.waitForTimeout(25)
    }
    throw new Error(`portal input did not start transition to ${destination}`)
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

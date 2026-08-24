import assert from 'node:assert/strict'

import {
  HUB_REGION_DEFINITIONS,
  hubPortalAt,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
} from '../src/game/core-kernels/hub-regions.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'

export async function hubSmokePlayerPosition(canvas) {
  return canvas.evaluate((node) => ({
    x: node.__sdrHubFrame.playerX,
    y: node.__sdrHubFrame.playerY,
  }))
}

export async function navigateHubRegion(
  page,
  canvas,
  region,
  target,
  arrivalRadius = 20,
  log = () => undefined,
) {
  const start = await hubSmokePlayerPosition(canvas)
  const initialRoute = planRoute(region, start, target, arrivalRadius)
  log(`route ${region} ${JSON.stringify(start)} -> ${JSON.stringify(target)} via ${JSON.stringify(initialRoute)}`)
  const deadline = Date.now() + 180_000
  let lastMovementAt = Date.now()
  let stationaryPulses = 0
  let nudgeCount = 0
  while (Date.now() < deadline) {
    assert.equal(await canvas.getAttribute('data-hub-region'), region)
    const current = await hubSmokePlayerPosition(canvas)
    if (distance(current, target) <= arrivalRadius + 5) return
    const route = planRoute(region, current, target, arrivalRadius)
    const waypoint = route[0] ?? target
    const requestedKeys = movementKeys(current, waypoint)
    const keys = stationaryPulses >= 4
      ? navigationNudgeKeys(region, current, target, requestedKeys, nudgeCount++)
      : requestedKeys
    assert.ok(keys.length > 0, `no movement toward ${JSON.stringify(waypoint)} from ${JSON.stringify(current)}`)
    const pressed = new Set()
    try {
      await syncKeys(page, pressed, keys)
      await page.waitForTimeout(stationaryPulses >= 4 ? 250 : 150)
    } finally {
      await syncKeys(page, pressed, [])
    }
    await page.waitForTimeout(100)
    const after = await hubSmokePlayerPosition(canvas)
    if (distance(current, after) >= 0.5) {
      lastMovementAt = Date.now()
      stationaryPulses = 0
    } else {
      stationaryPulses += 1
    }
    if (Date.now() - lastMovementAt > 30_000) {
      throw new Error(
        `navigation stalled in ${region} at ${JSON.stringify(after)} toward ${JSON.stringify(target)}`,
      )
    }
  }
  throw new Error(
    `navigation timed out in ${region} at ${JSON.stringify(await hubSmokePlayerPosition(canvas))}`,
  )
}

export async function holdForHubTransition(page, canvas, keys, destination) {
  const pressed = new Set()
  const deadline = Date.now() + 10_000
  try {
    await syncKeys(page, pressed, keys)
    while (Date.now() < deadline) {
      if (await canvas.getAttribute('data-hub-region') === destination) return
      await page.waitForTimeout(25)
    }
    throw new Error(`portal input did not enter ${destination}`)
  } finally {
    await syncKeys(page, pressed, [])
  }
}

export async function waitForSettledHubRegion(page, canvas, region) {
  await page.waitForFunction((expected) => {
    const node = document.querySelector('.hub-world-canvas')
    return node?.dataset.hubRegion === expected
      && node.dataset.transitionPhase === 'none'
      && Number(node.dataset.transitionAlpha) === 0
  }, region, { timeout: 15_000 })
  assert.equal(await canvas.getAttribute('data-hub-region'), region)
}

function movementKeys(current, target) {
  const keys = []
  if (target.x - current.x > 6) keys.push('d')
  if (target.x - current.x < -6) keys.push('a')
  if (target.y - current.y > 6) keys.push('s')
  if (target.y - current.y < -6) keys.push('w')
  return keys
}

function navigationNudgeKeys(region, current, target, requestedKeys, attempt) {
  const requested = new Set(requestedKeys)
  const horizontal = target.x >= current.x ? ['d', 'a'] : ['a', 'd']
  const vertical = target.y >= current.y ? ['s', 'w'] : ['w', 's']
  const candidates = requested.size === 1 && (requested.has('w') || requested.has('s'))
    ? horizontal
    : requested.size === 1
      ? vertical
      : attempt % 2 === 0
        ? horizontal
        : vertical
  const ordered = attempt % 2 === 0 ? candidates : [...candidates].reverse()
  const key = ordered.find((candidate) => {
    const delta = {
      x: candidate === 'd' ? 35 : candidate === 'a' ? -35 : 0,
      y: candidate === 's' ? 35 : candidate === 'w' ? -35 : 0,
    }
    return safeNavigationPoint(region, { x: current.x + delta.x, y: current.y + delta.y })
  })
  return key ? [key] : requestedKeys
}

function planRoute(region, start, target, arrivalRadius) {
  const step = 10
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ]
  const queue = [{
    ix: 0,
    iy: 0,
    position: start,
  }]
  const seen = new Set(['0,0'])
  const parents = new Map()
  let goalKey
  for (let cursor = 0; cursor < queue.length && cursor < 100_000; cursor += 1) {
    const current = queue[cursor]
    const key = `${current.ix},${current.iy}`
    if (distance(current.position, target) <= arrivalRadius) {
      goalKey = key
      break
    }
    for (const [directionX, directionY] of directions) {
      const ix = current.ix + directionX
      const iy = current.iy + directionY
      const nextKey = `${ix},${iy}`
      if (seen.has(nextKey)) continue
      const delta = { x: directionX * step, y: directionY * step }
      const expected = {
        x: current.position.x + delta.x,
        y: current.position.y + delta.y,
      }
      if (!safeNavigationPoint(region, expected)) continue
      const moved = moveWithHubRegionCollisionState(
        region,
        current.position,
        delta,
        PLAYER_CHARACTER_RADIUS,
        0x51a7c011,
      ).position
      if (distance(moved, expected) > 0.01) continue
      seen.add(nextKey)
      parents.set(nextKey, key)
      queue.push({
        ix,
        iy,
        position: expected,
      })
    }
  }
  assert.ok(goalKey, `could not plan ${region} route to ${JSON.stringify(target)}`)
  const nodes = []
  for (let key = goalKey; key !== '0,0'; key = parents.get(key)) {
    const [ix, iy] = key.split(',').map(Number)
    nodes.push({ x: start.x + ix * step, y: start.y + iy * step })
  }
  nodes.reverse()
  if (arrivalRadius <= 20) nodes.push(target)
  return simplifyRoute(region, start, nodes)
}

function simplifyRoute(region, start, route) {
  const simplified = []
  let anchor = start
  let nextIndex = 0
  while (nextIndex < route.length) {
    let furthest = route.length - 1
    while (furthest > nextIndex && !canTraverseLine(region, anchor, route[furthest])) {
      furthest -= 1
    }
    anchor = route[furthest]
    simplified.push(anchor)
    nextIndex = furthest + 1
  }
  return simplified
}

function canTraverseLine(region, start, target) {
  const steps = Math.max(1, Math.ceil(distance(start, target) / 5))
  let current = start
  for (let index = 1; index <= steps; index += 1) {
    const expected = {
      x: start.x + (target.x - start.x) * index / steps,
      y: start.y + (target.y - start.y) * index / steps,
    }
    if (!safeNavigationPoint(region, expected)) return false
    const moved = moveWithHubRegionCollisionState(
      region,
      current,
      { x: expected.x - current.x, y: expected.y - current.y },
      PLAYER_CHARACTER_RADIUS,
      0x51a7c011,
    ).position
    if (distance(moved, expected) > 0.01) return false
    current = expected
  }
  return true
}

function safeNavigationPoint(region, point) {
  const definition = HUB_REGION_DEFINITIONS[region]
  const maximumY = region === 'courtyard' ? 1800 : definition.height
  if (
    point.x < 0
    || point.y < 0
    || point.x > definition.width
    || point.y > maximumY
  ) return false
  if (!isHubRegionTraversable(region, point, PLAYER_CHARACTER_RADIUS)) return false
  return region !== 'courtyard' || hubPortalAt('courtyard', point, 50)?.destination !== 'office'
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

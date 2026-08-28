import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { EARTH_BOULDER_IDENTITY_ORIENTATION } from '../src/game/core-kernels/primary-spell-earth-orientation.ts'
import {
  canPlaceBoneyardBody,
  firstBoneyardPathBlockProgress,
  withBoneyardGateCollision,
} from '../src/game/core-server/boneyard-collision.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_EARTH_GEOMETRY_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-earth-boulder-geometry')
const credential = randomBytes(32).toString('base64url')
const publicEndpoint = 'wss://smoke.invalid/game-hub'

await mkdir(screenshotRoot, { recursive: true })
const frontend = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await frontend.listen()
const address = frontend.httpServer?.address()
if (!address || typeof address === 'string') {
  await frontend.close()
  throw new Error('Vite did not expose its Earth-geometry acceptance port')
}
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const pageErrors = []
const consoleErrors = []
const failedResponses = []

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(installBrowserProbe, {
    endpoint: host.address.url,
    publicEndpoint,
  })
  await page.route('**/deployment.json*', route => route.fulfill({
    body: JSON.stringify({ commit: 'smoke-local' }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/game/hub', route => route.fulfill({
    body: JSON.stringify({
      credential,
      kind: 'remote',
      sessionKind: 'global-hub',
      url: publicEndpoint,
    }),
    contentType: 'application/json',
    status: 201,
  }))

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /earth/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 90_000 })

  const fixture = injectGravestoneContact(host)
  const wireHandle = await page.waitForFunction(({ advanced, direction, id }) => (
    window.__sdrEarthGeometryFrames.toReversed().find(frame => (
      frame.primarySpells.projectiles.some(effect => (
        effect.kind === 'earth'
        && effect.id === id
        && (effect.position.x - advanced.x) * direction.x
          + (effect.position.y - advanced.y) * direction.y >= 60
      ))
    )) ?? null
  ), {
    advanced: fixture.advanced,
    direction: fixture.direction,
    id: fixture.projectileId,
  }, { timeout: 15_000 })
  const wire = await wireHandle.jsonValue()
  await wireHandle.dispose()
  const renderHandle = await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.primarySpellKinds?.includes('earth')
      ? structuredClone(frame)
      : null
  }, null, { timeout: 15_000 })
  const rendered = await renderHandle.jsonValue()
  await renderHandle.dispose()
  const screenshotPath = `${screenshotRoot}/solomon-earth-gravestone-passage.png`
  await page.screenshot({ path: screenshotPath })

  const projectile = wire.primarySpells.projectiles.find(effect => (
    effect.kind === 'earth' && effect.id === fixture.projectileId
  ))
  assert.ok(projectile)
  assert.ok(
    (projectile.position.x - fixture.advanced.x) * fixture.direction.x
      + (projectile.position.y - fixture.advanced.y) * fixture.direction.y >= 60,
  )
  assert.equal(wire.primarySpells.transients.some(effect => (
    effect.kind === 'earth-impact'
  )), false)
  assert.equal(rendered.primarySpellKinds.includes('earth'), true)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    browserVersion: browser.version(),
    consoleErrors,
    failedResponses,
    fixture,
    projectile,
    pageErrors,
    rendered: {
      painterBandCount: rendered.painterBandCount,
      primarySpellKinds: rendered.primarySpellKinds,
      tick: rendered.tick,
    },
    screenshotPath,
    status: 'ok',
  })}\n`)
} finally {
  await Promise.all([browser.close(), host.close(), frontend.close()])
}

function injectGravestoneContact(host) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const world = state.world
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  const radius = 0.3 * 75
  let fixture = null
  for (const target of world.scenerySpellTargets) {
    const withoutTarget = {
      circles: collision.circles.filter(({ sourceId }) => sourceId !== target.id),
      polygons: collision.polygons.filter(({ sourceId }) => sourceId !== target.id),
      segments: collision.segments.filter(({ sourceId }) => sourceId !== target.id),
    }
    for (let index = 0; index < 32; index += 1) {
      const angle = index * Math.PI / 16
      const direction = { x: Math.cos(angle), y: Math.sin(angle) }
      const advanced = {
        x: Math.fround(target.position.x - direction.x * (radius + 2)),
        y: Math.fround(target.position.y - direction.y * (radius + 2)),
      }
      const velocity = {
        x: Math.fround(direction.x * 3),
        y: Math.fround(direction.y * 3),
      }
      const position = {
        x: Math.fround(advanced.x - velocity.x),
        y: Math.fround(advanced.y - velocity.y),
      }
      const lookahead = {
        x: Math.fround(advanced.x + velocity.x),
        y: Math.fround(advanced.y + velocity.y),
      }
      const longLookahead = {
        x: Math.fround(advanced.x + velocity.x * 20),
        y: Math.fround(advanced.y + velocity.y * 20),
      }
      if (!canPlaceBoneyardBody(position, world.bounds, collision, radius)) continue
      if (!canPlaceBoneyardBody(advanced, world.bounds, collision, radius)) continue
      if (firstBoneyardPathBlockProgress(
        advanced,
        lookahead,
        world.bounds,
        collision,
        radius,
      ) === null) continue
      if (firstBoneyardPathBlockProgress(
        advanced,
        longLookahead,
        world.bounds,
        withoutTarget,
        radius,
      ) !== null) continue
      fixture = { advanced, direction, position, sourceId: target.id, target, velocity }
      break
    }
    if (fixture) break
  }
  assert.ok(fixture, 'generated Boneyard had no isolated Gravestone capsule contact')

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.ok(playerIndex >= 0)
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[playerIndex] = {
    ...locomotions[playerIndex],
    position: { ...fixture.position },
    velocity: { x: 0, y: 0 },
  }
  const projectileId = state.primarySpells.nextId
  const impactId = projectileId + 1
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      locomotions: Object.freeze(locomotions),
    },
    primarySpells: {
      nextId: impactId,
      projectiles: [Object.freeze({
        ageTicks: 1,
        assemblyCharge: 0.3,
        charge: 0.3,
        damage: 10,
        direction: Object.freeze({ ...fixture.direction }),
        flightTicks: 1,
        hitTargetIds: Object.freeze([]),
        id: projectileId,
        kind: 'earth',
        lightRegistration: Object.freeze({
          managerLane: 'actor',
          registrationOrdinal: projectileId,
        }),
        maximumCharge: 0.3,
        orientation: Object.freeze([...EARTH_BOULDER_IDENTITY_ORIENTATION]),
        ownerId: playerId,
        phase: 'flight',
        position: Object.freeze({ ...fixture.position }),
        remainingDamage: 0.9,
        shellCharge: 0.3,
        toughness: 1,
        velocity: Object.freeze({ ...fixture.velocity }),
        worldKey: `boneyard:${world.runId}`,
      })],
      transients: [],
    },
    world: {
      ...world,
      arenaTransition: null,
      encounter: null,
      waves: null,
    },
  })
  return {
    advanced: fixture.advanced,
    direction: fixture.direction,
    lookahead: {
      x: Math.fround(fixture.advanced.x + fixture.velocity.x),
      y: Math.fround(fixture.advanced.y + fixture.velocity.y),
    },
    position: fixture.position,
    projectileId,
    radius,
    sourceId: fixture.sourceId,
    targetPosition: fixture.target.position,
  }
}

function installBrowserProbe({ endpoint, publicEndpoint }) {
  const NativeWebSocket = window.WebSocket
  window.WebSocket = new Proxy(NativeWebSocket, {
    construct(Target, args) {
      if (`${args[0]}` === publicEndpoint) args[0] = endpoint
      return Reflect.construct(Target, args, Target)
    },
  })
  const frames = []
  Object.defineProperty(window, '__sdrEarthGeometryFrames', { value: frames })
  const nativeParse = JSON.parse
  JSON.parse = function (...args) {
    const value = nativeParse.apply(this, args)
    const frame = value?.type === 'server-welcome'
      ? value.snapshot
      : value?.type === 'server-snapshot'
        ? value.frame
        : null
    if (frame?.primarySpells) {
      frames.push(structuredClone(frame))
      if (frames.length > 500) frames.shift()
    }
    return value
  }
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
}

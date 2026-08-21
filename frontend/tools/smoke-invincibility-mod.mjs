import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import {
  spawnBoneyardCustomLootItems,
} from '../src/game/core-server/boneyard-loot-store.ts'
import {
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
} from '../src/game/core-server/game-simulation.ts'
import {
  poisonPlayerEntity,
  replacePlayerCharacter,
  setPlayerEntityMana,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  modConsumableInventoryItem,
} from '../src/game/host/lua/web-lua-content-registry.ts'
import { materializeWebSessionContent } from '../src/game/host/web-mod-content.ts'

const require = createRequire(import.meta.url)
const webRoot = fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url))
const modRoot = process.env.SDR_INVINCIBILITY_MOD_ROOT
if (!modRoot) throw new Error('SDR_INVINCIBILITY_MOD_ROOT is required')
const screenshotRoot = process.env.SDR_INVINCIBILITY_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-dark-invincibility-mod')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const expectedCapabilities = [
  'events.filters.damage',
  'events.filters.resources',
  'items.consumables.register',
  'loot.register',
  'player.resources.owner',
  'sprites.local.read',
  'sprites.local.register',
  'timer.local.scheduler',
]
const expectedContentId = '8068156596081641415'

await mkdir(screenshotRoot, { recursive: true })
const content = await loadInvincibilityContent(resolve(modRoot))
const credential = 'invincibility-mod-browser-parity'
const hostLogs = []
const staticServer = await startStaticServer(webRoot)
const staticAddress = staticServer.address()
if (!staticAddress || typeof staticAddress === 'string') {
  await new Promise(resolveClose => staticServer.close(resolveClose))
  throw new Error('built-game static server did not expose its Invincibility Potion smoke port')
}
const baseUrl = `http://127.0.0.1:${staticAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  content: content.manifest,
  log: entry => hostLogs.push(entry),
  luaWasmPath: require.resolve('wasmoon/dist/glue.wasm'),
  modAssets: content.assets,
  mods: content.modSources,
  snapshotRate: 20,
})
const catalog = host.modCatalog()
assert.equal(catalog.length, 1)
assert.equal(catalog[0]?.name, 'Invincibility Potion')
assert.equal(catalog[0]?.content.contentId, expectedContentId)

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: chromePath,
  headless: true,
})
const [hostContext, guestContext] = await Promise.all([
  browser.newContext({ viewport: { height: 900, width: 1_600 } }),
  browser.newContext({ viewport: { height: 900, width: 1_600 } }),
])
const [hostPage, guestPage] = await Promise.all([
  hostContext.newPage(),
  guestContext.newPage(),
])
const consoleErrors = []
const failedResponses = []
const pageErrors = []

await Promise.all([hostPage, guestPage].map(async (page) => {
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
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
}))

try {
  await enterHub(hostPage, baseUrl, 'Fire')
  await enterHub(guestPage, baseUrl, 'Air')
  await Promise.all([
    waitForPlayers(hostPage, 2),
    waitForPlayers(guestPage, 2),
  ])
  await hostPage.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await Promise.all([
    waitForBoneyard(hostPage, 2),
    waitForBoneyard(guestPage, 2),
  ])

  assert.equal(host.state().world.kind, 'boneyard')
  const hostPlayerId = host.hostPlayerId()
  assert.ok(hostPlayerId)
  const guestPlayerId = host.state().playerEntities.identities
    .map(({ playerId }) => playerId)
    .find(playerId => playerId !== hostPlayerId)
  assert.ok(guestPlayerId)
  const center = arenaCenter(host.state().world.bounds)
  movePlayer(host, hostPlayerId, point(center, -500, -300))
  movePlayer(host, guestPlayerId, point(center, 300, 180))

  const dropPosition = point(center, 0, 0)
  const spawned = spawnBoneyardCustomLootItems(
    host.state().world.loot,
    [modConsumableInventoryItem(catalog[0])],
    dropPosition,
    host.state().tick,
  )
  assert.equal(spawned.rejectedCount, 0)
  const actor = spawned.store.actors.at(-1)
  assert.ok(actor)
  assert.equal(actor.item?.modContent?.contentId, expectedContentId)
  Object.assign(host.state(), {
    world: { ...host.state().world, loot: spawned.store },
  })
  await Promise.all([
    waitForLootCount(hostPage, 1),
    waitForLootCount(guestPage, 1),
  ])
  const groundPath = join(screenshotRoot, 'invincibility-potion-ground.png')
  const groundScreenshot = await guestPage.screenshot({ path: groundPath })
  assert.ok(groundScreenshot.byteLength > 20_000)

  movePlayer(host, guestPlayerId, dropPosition)
  await waitForPickup(host, actor.id)
  await waitUntil(() => backpackContentCount(host, guestPlayerId, expectedContentId) === 1, (
    'guest did not receive the custom potion pickup'
  ))
  await Promise.all([
    waitForLootCount(hostPage, 0),
    waitForLootCount(guestPage, 0),
  ])
  Object.assign(host.state(), {
    playerEntities: setPlayerEntityMana(host.state().playerEntities, guestPlayerId, 10),
  })
  await guestPage.bringToFront()
  await guestPage.keyboard.press('KeyI')
  const inventory = guestPage.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor({ timeout: 10_000 })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
    .waitFor({ timeout: 10_000 })
  const potion = inventory.getByLabel('Backpack').getByRole('button', {
    name: 'Invincibility Potion, quantity 1',
  })
  await potion.waitFor()
  const inventoryPath = join(screenshotRoot, 'invincibility-potion-inventory.png')
  const inventoryScreenshot = await guestPage.screenshot({ path: inventoryPath })
  assert.ok(inventoryScreenshot.byteLength > 20_000)
  await doubleActivateInventoryPointer(guestPage, potion)

  await waitUntil(() => backpackContentCount(host, guestPlayerId, expectedContentId) === 0, (
    'guest custom potion was not consumed'
  ))
  await waitUntil(() => host.state().modEffects.some(effect => (
    effect.playerId === guestPlayerId && effect.contentId === expectedContentId
  )), 'authoritative guest mod effect was not created')
  assert.equal(host.state().modEffects.some(effect => effect.playerId === hostPlayerId), false)
  await guestPage.keyboard.press('KeyI')
  await inventory.waitFor({ state: 'detached', timeout: 10_000 })
  await waitUntil(() => {
    const progression = getPlayerProgression(host.state(), guestPlayerId)
    return progression.currentMana === progression.maximumMana
  }, 'guest mana was not restored after the inventory pause released')
  await Promise.all([
    waitForModEffectCount(hostPage, 1),
    waitForModEffectCount(guestPage, 1),
  ])

  const effectGuestPath = join(screenshotRoot, 'invincibility-potion-guest-effect.png')
  const effectHostPath = join(screenshotRoot, 'invincibility-potion-host-effect.png')
  const [guestEffectScreenshot, hostEffectScreenshot] = await Promise.all([
    guestPage.screenshot({ path: effectGuestPath }),
    hostPage.screenshot({ path: effectHostPath }),
  ])
  assert.ok(guestEffectScreenshot.byteLength > 20_000)
  assert.ok(hostEffectScreenshot.byteLength > 20_000)

  const protectedHealth = getPlayerProgression(host.state(), guestPlayerId).currentHealth
  Object.assign(host.state(), {
    playerEntities: poisonPlayerEntity(
      host.state().playerEntities,
      guestPlayerId,
      30,
      2,
    ),
  })
  const poisonTicks = getPlayerProgression(host.state(), guestPlayerId).poisonTicksRemaining
  assert.ok(poisonTicks > 0)
  await waitUntil(() => (
    getPlayerProgression(host.state(), guestPlayerId).poisonTicksRemaining < poisonTicks - 20
  ), 'authoritative poison lane did not advance', 5_000)
  assert.equal(getPlayerProgression(host.state(), guestPlayerId).currentHealth, protectedHealth)

  const manaBeforeCast = getPlayerProgression(host.state(), guestPlayerId).currentMana
  const castSequence = getPlayerCharacter(host.state(), guestPlayerId).primaryCast.castSequence
  const guestCanvas = guestPage.locator('.boneyard-world-canvas')
  const canvasBounds = await guestCanvas.boundingBox()
  assert.ok(canvasBounds)
  await guestPage.bringToFront()
  await guestPage.mouse.move(
    canvasBounds.x + canvasBounds.width * 0.68,
    canvasBounds.y + canvasBounds.height * 0.48,
  )
  await guestPage.mouse.down({ button: 'left' })
  try {
    await waitUntil(() => (
      getPlayerCharacter(host.state(), guestPlayerId).primaryCast.castSequence > castSequence
    ), 'guest Air cast did not start', 5_000)
    await new Promise(resolve => setTimeout(resolve, 750))
  } finally {
    await guestPage.mouse.up({ button: 'left' })
  }
  assert.equal(getPlayerProgression(host.state(), guestPlayerId).currentMana, manaBeforeCast)
  assert.equal(getPlayerProgression(host.state(), guestPlayerId).currentHealth, protectedHealth)

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])
  const errorLogs = hostLogs.filter(({ level }) => level === 'error')
  assert.deepEqual(errorLogs, [])
  const guestEffect = host.state().modEffects.find(effect => effect.playerId === guestPlayerId)
  assert.ok(guestEffect)
  const canvasReceipt = await Promise.all([hostPage, guestPage].map(page => (
    page.locator('.boneyard-world-canvas').evaluate(node => ({
      context: (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name,
      modEffectCount: Number(node.dataset.modEffectCount),
      rendererName: node.dataset.rendererName,
    }))
  )))

  process.stdout.write(`${JSON.stringify({
    authoritative: {
      contentId: guestEffect.contentId,
      effectOwner: guestEffect.playerId,
      hostPlayerProtected: host.state().modEffects.some(effect => effect.playerId === hostPlayerId),
      manaAfterCast: getPlayerProgression(host.state(), guestPlayerId).currentMana,
      manaBeforeCast,
      poisonHealthAfter: getPlayerProgression(host.state(), guestPlayerId).currentHealth,
      poisonHealthBefore: protectedHealth,
      useId: guestEffect.useId,
    },
    browser: canvasReceipt,
    catalog: catalog.map(entry => ({
      contentId: entry.content.contentId,
      imagePath: entry.content.icon.imagePath,
      name: entry.name,
      nativeSubtype: entry.nativeSubtype,
    })),
    consoleErrors,
    failedResponses,
    hostErrors: errorLogs,
    package: {
      id: content.manifest.mods[0]?.id,
      manifestSha256: content.manifest.manifestSha256,
      version: content.manifest.mods[0]?.version,
    },
    pageErrors,
    screenshots: [groundPath, inventoryPath, effectGuestPath, effectHostPath],
  }, null, 2)}\n`)
} catch (error) {
  const state = host.state()
  process.stderr.write(`${JSON.stringify({
    failure: error instanceof Error ? error.message : String(error),
    hostLogs: hostLogs.filter(({ event }) => (
      !['lua.tick_budget_exceeded', 'replication.baseline_missing'].includes(event)
    )).slice(-100),
    modEffects: state.modEffects,
    players: state.playerEntities.identities.map(({ playerId }) => ({
      economy: getPlayerEconomy(state, playerId).backpack.map(item => ({
        contentId: item.modContent?.contentId ?? null,
        id: item.id,
        name: item.name,
        quantity: item.quantity,
      })),
      playerId,
      progression: getPlayerProgression(state, playerId),
    })),
    world: state.world.kind,
  }, null, 2)}\n`)
  throw error
} finally {
  await Promise.all([
    hostContext.close(),
    guestContext.close(),
  ])
  await browser.close()
  await host.close()
  await new Promise(resolveClose => staticServer.close(resolveClose))
}

async function loadInvincibilityContent(root) {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
  assert.equal(manifest.id, 'canary.lua.invincibility_potion')
  assert.equal(manifest.name, 'Invincibility Potion')
  assert.equal(manifest.version, '0.3.0')
  assert.equal(manifest.runtime?.apiVersion, '0.2.0')
  assert.deepEqual(manifest.runtime.requiredCapabilities, expectedCapabilities)
  const entryScript = await readFile(join(root, manifest.runtime.entryScript), 'utf8')
  const paths = [
    'sprites/invincibility_potion.bundle',
    'sprites/invincibility_potion.png',
  ]
  const files = await Promise.all(paths.map(async path => ({
    bytesBase64: (await readFile(join(root, path))).toString('base64'),
    path,
  })))
  const contentSha256 = createHash('sha256')
    .update(manifest.id)
    .update('\0')
    .update(manifest.version)
    .update('\0')
    .update(entryScript)
    .update('\0')
    .update(files.map(file => `${file.path}:${file.bytesBase64}`).join('\0'))
    .digest('hex')
  const manifestSha256 = createHash('sha256')
    .update(`${manifest.id}\0${manifest.version}\0${contentSha256}`)
    .digest('hex')
  return materializeWebSessionContent({
    manifestSha256,
    mods: [{
      boneyards: [],
      contentSha256,
      entryScript,
      files,
      id: manifest.id,
      name: manifest.name,
      priority: 0,
      requiredCapabilities: manifest.runtime.requiredCapabilities,
      slug: basename(root),
      version: manifest.version,
    }],
  })
}

async function enterHub(page, baseUrl, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: element }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await Promise.all([
    page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 }),
    page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]').waitFor({
      timeout: 60_000,
    }),
  ])
}

async function waitForPlayers(page, count) {
  await page.waitForFunction(expected => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerCount === expected
  ), count, { timeout: 30_000 })
}

async function waitForBoneyard(page, count) {
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  await page.waitForFunction(expected => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === expected
  ), count, { timeout: 30_000 })
}

function movePlayer(host, playerId, position) {
  const state = host.state()
  const player = getPlayerCharacter(state, playerId)
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...player,
      position: { ...position },
      velocity: { x: 0, y: 0 },
    }),
  })
}

function arenaCenter(bounds) {
  return {
    x: Math.fround(bounds.x + bounds.w / 2),
    y: Math.fround(bounds.y + bounds.h / 2),
  }
}

function point(origin, x, y) {
  return Object.freeze({ x: Math.fround(origin.x + x), y: Math.fround(origin.y + y) })
}

async function waitForPickup(host, actorId) {
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard'
      && !world.loot.actors.some(({ id }) => id === actorId)
  }, `loot actor ${actorId} was not picked up`)
}

async function waitForLootCount(page, count) {
  await page.waitForFunction(expected => (
    document.querySelector('.boneyard-world-canvas')?.dataset.lootCount === `${expected}`
  ), count, { timeout: 30_000 })
}

async function waitForModEffectCount(page, count) {
  await page.waitForFunction(expected => (
    document.querySelector('.boneyard-world-canvas')?.dataset.modEffectCount === `${expected}`
  ), count, { timeout: 30_000 })
}

function backpackContentCount(host, playerId, contentId) {
  return getPlayerEconomy(host.state(), playerId).backpack
    .filter(item => item.modContent?.contentId === contentId)
    .reduce((total, item) => total + item.quantity, 0)
}

async function doubleActivateInventoryPointer(page, source) {
  const box = await source.boundingBox()
  assert.ok(box, 'inventory activation source has no browser geometry')
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
}

async function waitUntil(predicate, message, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

async function startStaticServer(root) {
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
  const index = resolve(root, 'index.html')
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
      const relative = pathname === '/' || extname(pathname) === ''
        ? 'index.html'
        : pathname.slice(1)
      const target = resolve(root, relative)
      if (target !== index && !target.startsWith(rootPrefix)) {
        response.writeHead(403)
        response.end()
        return
      }
      const body = await readFile(target)
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType(target),
      })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolveListen()
    })
  })
  return server
}

function contentType(path) {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.webmanifest': 'application/manifest+json',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  })[extname(path)] || 'application/octet-stream'
}

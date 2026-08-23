import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import {
  getPlayerCharacter,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import { spawnBoneyardLootSpecs } from '../src/game/core-server/boneyard-loot-store.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_HAGATHA_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-hagatha-effects'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const failedResponses = []

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
  throw new Error('Vite did not expose its Hagatha smoke port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    if (new URL(request.url()).pathname === '/deployment.json') return
    if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)/.test(request.url())) return
    failedResponses.push(`${request.url()}: ${failure}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current')
    return route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: /Ether/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  installOwnedSelectors(host.state(), playerId, [5])
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  await waitForHost(() => host.state().world.kind === 'boneyard', 'Boneyard authority')
  const player = getPlayerCharacter(host.state(), playerId)
  const world = host.state().world
  if (world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  const seededLoot = spawnBoneyardLootSpecs(world.loot, [
    {
      activationDelayTicks: 0,
      amount: 7,
      id: 1,
      kind: 'gold',
      nativeTypeId: 2012,
      phase: 0,
      position: { x: player.position.x + 200, y: player.position.y },
      source: 'script',
      tier: 2,
    },
    {
      activationDelayTicks: 0,
      id: 2,
      item: {
        equipmentType: null,
        iconRecords: [46],
        id: 1,
        kind: 'health-potion',
        name: 'Last Word Potion',
        nativeSubtype: 0,
        nativeTypeId: 7001,
        quantity: 1,
        rarity: null,
        recipeIndex: null,
      },
      kind: 'sack',
      nativeTypeId: 2013,
      phase: 0,
      position: { x: player.position.x + 225, y: player.position.y },
      source: 'script',
    },
    {
      activationDelayTicks: 0,
      id: 3,
      kind: 'orb',
      nativeTypeId: 2011,
      orbKind: 'mana',
      phase: 0,
      position: { x: player.position.x + 250, y: player.position.y },
      source: 'script',
      value: 0.5,
    },
  ], host.state().tick).store
  Object.assign(host.state(), {
    ...host.state(),
    world: { ...world, loot: seededLoot },
  })

  const canvas = page.locator('.boneyard-world-canvas')
  await canvas.waitFor()
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      ?.seekerSegmentCount !== undefined
  ), undefined, { timeout: 15_000 })
  await page.waitForTimeout(1_000)
  const seekerFrame = await canvas.evaluate((node) => ({
    context: node.getContext('webgl2')?.constructor.name ?? null,
    lootCount: node.__sdrBoneyardFrame.lootCount,
    seekerSegmentCount: node.__sdrBoneyardFrame.seekerSegmentCount,
  }))
  if (seekerFrame.seekerSegmentCount !== 4) {
    process.stderr.write(`${JSON.stringify({
      authorityLoot: host.state().world.kind === 'boneyard'
        ? host.state().world.loot.actors.map(({ id, kind, position }) => ({ id, kind, position }))
        : [],
      authoritySelectors: getPlayerEconomy(host.state(), playerId).ownedPerkSelectors,
      consoleErrors,
      pageErrors,
      seekerFrame,
    })}\n`)
  }
  assert.deepEqual(seekerFrame, {
    context: 'WebGL2RenderingContext',
    lootCount: 3,
    seekerSegmentCount: 4,
  })
  await page.screenshot({ path: `${screenshotRoot}-seeker.png` })

  const audioStart = await page.evaluate(() => window.__sdrAudioEvents.length)
  const goldBeforeArchive = getPlayerEconomy(host.state(), playerId).gold
  const authority = host.state()
  const playerIndex = authority.playerEntities.identities.findIndex(({ playerId: id }) => (
    id === playerId
  ))
  assert.notEqual(playerIndex, -1)
  const progressions = [...authority.playerEntities.progressions]
  progressions[playerIndex] = {
    ...progressions[playerIndex],
    currentHealth: 0,
    deathEpoch: progressions[playerIndex].deathEpoch + 1,
    deathTick: 199,
    lifeState: 'spectating',
  }
  installOwnedSelectors(authority, playerId, [5, 12])
  Object.assign(authority, {
    ...authority,
    playerEntities: { ...authority.playerEntities, progressions },
    run: {
      ...authority.run,
      gameOverEventId: Math.max(1, authority.run.gameOverEventId),
      gameOverTicks: 0,
      nextGameOverEventId: Math.max(2, authority.run.nextGameOverEventId),
      phase: 'game-over',
    },
  })
  await waitForHost(() => host.state().secondaryAbilities.actors.some(({ kind, scale }) => (
    kind === 'mindblast-burst' && scale === 15
  )), 'Last Word Mindblast birth')
  await page.waitForFunction(() => {
    const kinds = document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame?.secondaryAbilityKinds ?? []
    return kinds.includes('mindblast-burst') && kinds.includes('mindblast-shockwave')
  }, undefined, { timeout: 15_000 })
  const lastWordFrame = await canvas.evaluate((node) => ({
    kinds: [...node.__sdrBoneyardFrame.secondaryAbilityKinds],
    lifeState: node.__sdrBoneyardFrame.localPlayerLifeState,
  }))
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${screenshotRoot}-last-word.png` })
  await page.waitForFunction((start) => {
    const events = window.__sdrAudioEvents.slice(start)
    const matches = (name) => events.filter((event) => (
      event.type === 'buffer-start' && window.__sdrAudioSourceMatches(event.src, name)
    ))
    return matches('magic-shield-explode.wav').length >= 1
      && matches('big-fire.wav').length >= 2
  }, audioStart, { timeout: 15_000 })
  await waitForHost(() => (
    getPlayerEconomy(host.state(), playerId).storage.length === 1
  ), 'Last Word Luthacus archive', 20_000)
  const archivedEconomy = getPlayerEconomy(host.state(), playerId)
  assert.equal(archivedEconomy.gold, goldBeforeArchive + 7)
  assert.match(
    archivedEconomy.storage[0].name,
    /^(?:Helvidius|[A-Za-z]+)'s (Earthly Possessions|Stuff|Dead Stuff|Bag|Loot)$/,
  )
  if (host.state().world.kind !== 'boneyard') throw new Error('expected Boneyard world')
  assert.deepEqual(host.state().world.loot.actors.map(({ kind }) => kind), ['orb'])

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    archivedGold: archivedEconomy.gold,
    archivedSackName: archivedEconomy.storage[0].name,
    consoleErrors,
    failedResponses,
    lastWordFrame,
    pageErrors,
    screenshots: [`${screenshotRoot}-seeker.png`, `${screenshotRoot}-last-word.png`],
    seekerFrame,
  })}\n`)
} catch (error) {
  const browserState = await page.evaluate(() => ({
    canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
      className: canvas.className,
      hasBoneyardFrame: '__sdrBoneyardFrame' in canvas,
      seekerSegmentCount: canvas.__sdrBoneyardFrame?.seekerSegmentCount ?? null,
    })),
    scene: document.querySelector('.boneyard-scene')?.getAttribute('data-renderer-state') ?? null,
    url: location.href,
  })).catch(() => null)
  process.stderr.write(`${JSON.stringify({
    browserState,
    consoleErrors,
    failedResponses,
    pageErrors,
  })}\n`)
  throw error
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

function installOwnedSelectors(state, playerId, ownedPerkSelectors) {
  const economy = getPlayerEconomy(state, playerId)
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy,
      ownedPerkSelectors,
    }),
  })
}

async function waitForHost(predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
  Object.defineProperty(window, '__sdrRestoreAudioPreload', {
    value: () => { HTMLMediaElement.prototype.load = nativeLoad },
  })
}

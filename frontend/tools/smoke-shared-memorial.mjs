import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { archiveHubMemorialPortrait } from '../src/game/core-kernels/hub-memorial.ts'
import {
  playerCharacterAt,
  replacePlayerCharacter,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'

const baseUrl = process.env.SDR_SHARED_MEMORIAL_URL || 'http://127.0.0.1:4187'
const screenshotPath = process.env.SDR_SHARED_MEMORIAL_SCREENSHOT
  || '/tmp/solomon-dark-shared-memorial.png'
const browserCredential = randomBytes(32).toString('base64url')
const lateCredential = randomBytes(32).toString('base64url')
const content = {
  assets: [],
  boneyards: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] },
  modSources: [],
  summary: { manifestSha256: '0'.repeat(64), mods: [] },
}
const tickets = new Set([browserCredential, lateCredential])
const pageErrors = []
const consoleErrors = []
const failedResponses = []
const requestFailures = []
const host = await startGameHost({
  allowedOrigins: [new URL(baseUrl).origin],
  authentication: {
    kind: 'tickets',
    claim: (credential) => {
      if (!tickets.delete(credential)) return null
      return { content, leaderboardUserId: null }
    },
  },
  sessionKind: 'global-hub',
  sharedHub: true,
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
let lateSocket = null

try {
  const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`)
  })
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript(([url, credential]) => {
    window.solomonDarkRuntime = {
      gameEndpoint: { credential, kind: 'localhost', url },
    }
  }, [host.address.url, browserCredential])
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await enterHub(page)
  moveBrowserPlayerToMortuary()
  const canvas = page.locator(
    '.hub-world-canvas[data-hub-region="mortuary"][data-game-renderer="pixi-webgl"]',
  )
  await canvas.waitFor({ timeout: 10_000 })
  await page.waitForFunction(() => {
    const node = document.querySelector('.hub-world-canvas')
    return node?.getAttribute('data-memorial-next-age') === '1001'
      && node?.getAttribute('data-memorial-rendered-portraits') === '0'
  })

  const before = JSON.parse(await canvas.getAttribute('data-memorial-portraits'))
  assert.equal(before.length, 10)
  assert.equal(before.every(({ name }) => name === null), true)
  publishCompletedPortrait()
  await page.waitForFunction(() => {
    const node = document.querySelector('.hub-world-canvas')
    if (node?.getAttribute('data-memorial-next-age') !== '1002') return false
    if (node.getAttribute('data-memorial-rendered-portraits') !== '1') return false
    const portraits = JSON.parse(node.getAttribute('data-memorial-portraits') || '[]')
    return portraits[2]?.portraitId === 100 && portraits[2]?.name === 'Memoria'
  }, null, { timeout: 10_000 })
  moveBrowserPlayerToPortrait()
  await page.getByRole('button', { name: 'Hear memorial eulogy' }).click()
  await page.getByText('Memoria (@Archivist), Level 7 Earth Mage.').waitFor()
  await page.getByText(
    'Wave 12 in 0:02:03. 321 monsters slain. 4,567 awesomeness.',
  ).waitFor()
  await page.getByText('Awesomest kill: Horned Skeleton Fire Archer.').waitFor()
  await page.screenshot({ path: screenshotPath })

  lateSocket = await openSocket(host.address.url)
  const welcomePromise = nextMessage(lateSocket, message => message.type === 'server-welcome')
  lateSocket.send(encodeGameMessage({
    character: {
      discipline: 'mind',
      displayName: 'Late Witness',
      element: 'water',
    },
    cheatsEnabled: false,
    credential: lateCredential,
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    protocolVersion: GAME_PROTOCOL_VERSION,
    type: 'client-hello',
  }))
  const welcome = await welcomePromise
  assert.equal(welcome.type, 'server-welcome')
  assert.equal(welcome.snapshot.world.kind, 'hub')
  if (welcome.snapshot.world.kind !== 'hub') assert.fail('late join did not enter the Hub')
  assert.equal(welcome.snapshot.world.memorial.nextAge, 1002)
  assert.equal(
    welcome.snapshot.world.memorial.slots[2]?.portrait?.config.displayName,
    'Memoria',
  )
  assert.equal(welcome.snapshot.world.memorial.slots[2]?.portraitId, 100)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(requestFailures, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    failedResponses,
    lateJoinNextAge: welcome.snapshot.world.memorial.nextAge,
    pageErrors,
    portrait: welcome.snapshot.world.memorial.slots[2],
    requestFailures,
    screenshotPath,
    status: 'ok',
  })}\n`)
} finally {
  lateSocket?.close()
  await browser.close()
  await host.close()
}

async function enterHub(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.count()) {
    await tutorialOffer.getByRole('button', { name: 'NO' }).click()
  }
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
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
}

function moveBrowserPlayerToMortuary() {
  const state = host.state()
  assert.equal(state.playerEntities.identities.length, 1)
  const playerId = state.playerEntities.identities[0].playerId
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') assert.fail('expected shared Hub')
  const player = playerCharacterAt(state.playerEntities, playerId)
  assert.ok(player)
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...player,
      position: { x: 512, y: 904 },
      velocity: { x: 0, y: 0 },
    }),
    world: {
      ...state.world,
      participants: {
        ...state.world.participants,
        [playerId]: { region: 'mortuary', transition: null },
      },
    },
  })
}

function publishCompletedPortrait() {
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  if (state.world.kind !== 'hub') assert.fail('expected shared Hub')
  Object.assign(state, {
    world: {
      ...state.world,
      memorial: archiveHubMemorialPortrait(state.world.memorial, {
        accountUsername: 'Archivist',
        awesomeness: 4_567,
        awesomestKill: 'Horned Skeleton Fire Archer',
        capturedAtTick: state.tick,
        config: {
          discipline: 'arcane',
          displayName: 'Memoria',
          element: 'earth',
        },
        elapsedTicks: 12_345,
        equipment: {
          hat: { primaryTint: 0xffffff, secondaryTint: 0xffffff, selector: 2 },
          robe: { primaryTint: 0x90b390, secondaryTint: 0xffffff, selector: 2 },
          weapon: { kind: 'staff', selector: 1 },
        },
        headingIndex: 12,
        level: 7,
        monstersKilled: 321,
        playerId: 'completed-player',
        portraitScale: 0.925,
        runId: 'completed-run',
        wave: 12,
      }, 0),
    },
  })
}

function moveBrowserPlayerToPortrait() {
  const state = host.state()
  const playerId = state.playerEntities.identities[0].playerId
  const player = playerCharacterAt(state.playerEntities, playerId)
  assert.ok(player)
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...player,
      position: { x: 673, y: 683 },
      velocity: { x: 0, y: 0 },
    }),
  })
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function nextMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for raw client message'))
    }, 30_000)
    const receive = (data) => {
      const message = decodeServerGameMessage(data.toString())
      if (!predicate(message)) return
      cleanup()
      resolve(message)
    }
    const fail = (error) => {
      cleanup()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('message', receive)
      socket.off('error', fail)
    }
    socket.on('message', receive)
    socket.on('error', fail)
  })
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

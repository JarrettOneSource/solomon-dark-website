import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'
import { WebSocket } from 'ws'

import { gameSimulationPlayerRecords } from '../src/game/core-server/game-simulation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const screenshots = {
  boneyardWaiting: process.env.SDR_GAME_PAUSE_BONEYARD_SCREENSHOT
    || '/tmp/solomon-dark-pause-boneyard-waiting.png',
  hubOwner: process.env.SDR_GAME_PAUSE_OWNER_SCREENSHOT
    || '/tmp/solomon-dark-pause-hub-owner.png',
  hubWaiting: process.env.SDR_GAME_PAUSE_WAITING_SCREENSHOT
    || '/tmp/solomon-dark-pause-hub-waiting.png',
}
const errors = []

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
  throw new Error('Vite did not expose its local pause-smoke port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 20,
})
const runtime = {
  gameEndpoint: {
    credential,
    kind: 'localhost',
    url: host.address.url,
  },
}
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
let peer = null
let latePeer = null

try {
  const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  await page.addInitScript((configuration) => {
    window.solomonDarkRuntime = configuration
  }, runtime)
  await enterHub(page, 'Fire')

  peer = await joinRaw({
    discipline: 'mind',
    displayName: 'Vibia',
    element: 'water',
  })
  assert.equal(host.playerCount(), 2)

  const peerSawOwnerPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause !== null
  ))
  await pressPause(page, '.hub-scene')
  const ownerPause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await ownerPause.waitFor()
  const ownerPauseMessage = await peerSawOwnerPause
  assert.equal(ownerPauseMessage.type, 'server-gameplay-pause')
  assert.deepEqual(ownerPauseMessage.pause, {
    ownerDisplayName: 'Helvidius',
    ownerPlayerId: host.hostPlayerId(),
  })
  await page.waitForTimeout(350)

  assert.equal(
    await ownerPause.getByRole('button', { name: 'Game Settings unavailable' }).isDisabled(),
    true,
  )
  const bounds = {}
  for (const action of ['resume', 'settings', 'leave']) {
    bounds[action] = await ownerPause.locator(`[data-pause-action="${action}"]`).boundingBox()
  }
  assert.deepEqual(bounds, {
    leave: { height: 69, width: 353, x: 623.5, y: 491.5 },
    resume: { height: 69, width: 353, x: 623.5, y: 339.5 },
    settings: { height: 69, width: 353, x: 623.5, y: 415.5 },
  })
  assert.equal(
    await ownerPause.locator('.gameplay-pause-dim').evaluate((node) => (
      getComputedStyle(node).backgroundColor
    )),
    'rgba(0, 0, 0, 0.85)',
  )
  await page.screenshot({ path: screenshots.hubOwner })

  const heldHub = simulationReceipt()
  const heldHubFrame = await canvasFrame(page, '.hub-world-canvas')
  await page.waitForTimeout(550)
  assert.deepEqual(simulationReceipt(), heldHub)
  assert.deepEqual(await canvasFrame(page, '.hub-world-canvas'), heldHubFrame)
  assert.equal(await page.locator('.hub-scene').getAttribute('data-presentation-paused'), 'true')

  latePeer = await joinRaw({
    discipline: 'body',
    displayName: 'Decima',
    element: 'earth',
  })
  assert.deepEqual(latePeer.welcome.gameplayPause, ownerPauseMessage.pause)
  assert.equal(latePeer.welcome.snapshot.tick, heldHub.tick)

  const peerSawHubResume = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  await ownerPause.getByRole('button', { name: 'RESUME GAME' }).click()
  await peerSawHubResume
  assert.ok(host.state().tick - heldHub.tick <= 10, 'browser-owner resume replayed paused time')
  await ownerPause.waitFor({ state: 'detached' })
  await assertNormalResumeRate(page)

  const peerPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === peer.welcome.playerId
  ))
  peer.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: true }))
  await peerPause
  const hubWaiting = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="waiting"]',
  )
  await hubWaiting.waitFor()
  await page.waitForTimeout(350)
  assert.match(await hubWaiting.textContent() || '', /Vibia has paused the game\./)
  assert.match(await hubWaiting.textContent() || '', /Waiting for Vibia to resume\./)
  assert.equal(await hubWaiting.getByRole('button').count(), 0)
  await page.screenshot({ path: screenshots.hubWaiting })
  const peerHeldHub = simulationReceipt()
  await page.waitForTimeout(550)
  assert.deepEqual(simulationReceipt(), peerHeldHub)

  const peerSawOwnResume = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  peer.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await peerSawOwnResume
  assert.ok(host.state().tick - peerHeldHub.tick <= 10, 'peer resume replayed paused time')
  await hubWaiting.waitFor({ state: 'detached' })

  const peerLoaded = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await Promise.all([
    peerLoaded,
    page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 }),
  ])

  const peerSawBoneyardPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === host.hostPlayerId()
  ))
  await pressPause(page, '.boneyard-scene')
  const boneyardOwner = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await Promise.all([boneyardOwner.waitFor(), peerSawBoneyardPause])
  const heldBoneyardOwner = simulationReceipt()
  const heldBoneyardOwnerFrame = await canvasFrame(page, '.boneyard-world-canvas')
  await page.waitForTimeout(550)
  assert.deepEqual(simulationReceipt(), heldBoneyardOwner)
  assert.deepEqual(
    await canvasFrame(page, '.boneyard-world-canvas'),
    heldBoneyardOwnerFrame,
  )
  const peerSawBoneyardResume = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  await boneyardOwner.getByRole('button', { name: 'RESUME GAME' }).click()
  await peerSawBoneyardResume
  assert.ok(
    host.state().tick - heldBoneyardOwner.tick <= 10,
    'Boneyard browser-owner resume replayed paused time',
  )
  await boneyardOwner.waitFor({ state: 'detached' })

  const peerBoneyardPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === peer.welcome.playerId
  ))
  peer.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: true }))
  await peerBoneyardPause
  const boneyardWaiting = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="waiting"]',
  )
  await boneyardWaiting.waitFor()
  await page.waitForTimeout(350)
  await page.screenshot({ path: screenshots.boneyardWaiting })
  const heldBoneyardPeer = simulationReceipt()
  const heldBoneyardPeerFrame = await canvasFrame(page, '.boneyard-world-canvas')
  await page.waitForTimeout(550)
  assert.deepEqual(simulationReceipt(), heldBoneyardPeer)
  assert.deepEqual(await canvasFrame(page, '.boneyard-world-canvas'), heldBoneyardPeerFrame)
  assert.equal(
    await page.locator('.boneyard-scene').getAttribute('data-presentation-paused'),
    'true',
  )

  peer.socket.close(1000, 'pause owner left')
  await boneyardWaiting.waitFor({ state: 'detached' })
  await waitForHost(() => host.playerCount() === 2, 'pause-owner departure')
  await waitForHost(() => host.state().tick > heldBoneyardPeer.tick, 'Boneyard disconnect resume')

  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    boneyardResumeTick: host.state().tick,
    heldBoneyardOwnerTick: heldBoneyardOwner.tick,
    heldBoneyardPeerTick: heldBoneyardPeer.tick,
    heldHubTick: heldHub.tick,
    screenshots,
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({ errors })}\n`)
  throw error
} finally {
  peer?.socket.close()
  latePeer?.socket.close()
  await browser.close()
  await host.close()
  await vite.close()
}

async function enterHub(page, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
}

async function pressPause(page, sceneSelector) {
  await page.bringToFront()
  await page.locator(sceneSelector).focus()
  await page.keyboard.press('Escape')
}

async function joinRaw(character) {
  const socket = await openSocket(host.address.url)
  const welcomePromise = nextRawMessage(socket, (message) => message.type === 'server-welcome')
  socket.send(encodeGameMessage({
    type: 'client-hello',
    character,
    credential,
    protocolVersion: GAME_PROTOCOL_VERSION,
  }))
  const welcome = await welcomePromise
  assert.equal(welcome.type, 'server-welcome')
  return { socket, welcome }
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function nextRawMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('timed out waiting for raw peer message'))
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

function simulationReceipt() {
  const state = host.state()
  return {
    players: JSON.stringify(gameSimulationPlayerRecords(state)),
    tick: state.tick,
    world: JSON.stringify(state.world),
  }
}

async function canvasFrame(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const frame = canvas.__sdrHubFrame ?? canvas.__sdrBoneyardFrame
    return frame ? JSON.stringify(frame) : null
  })
}

async function assertNormalResumeRate(page) {
  const resumedAt = host.state().tick
  await page.waitForTimeout(100)
  const delta = host.state().tick - resumedAt
  assert.ok(delta >= 5 && delta <= 20, `unexpected resumed rate: ${delta} ticks per 100 ms`)
}

async function waitForHost(predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`timed out waiting for ${label}`)
}

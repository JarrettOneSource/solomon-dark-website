import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { connectGameClientSession } from '../src/game/client/game-client-session.ts'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const screenshotPath = process.env.SDR_BONEYARD_COLLISION_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-boneyard-player-collision-smoke.png'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
let idleClient

try {
  const hostPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const hostErrors = captureErrors(hostPage)

  await createCharacter(hostPage, 'Fire')
  await hostPage.getByLabel(/College courtyard/).waitFor({ timeout: 30_000 })
  const endpoint = await hostPage.evaluate(async () => {
    const { configuredGameEndpoint } = await import('/src/game/game-bootstrap.ts')
    return configuredGameEndpoint()
  })
  assert.ok(endpoint, 'expected the browser development endpoint')

  idleClient = await connectGameClientSession({
    character: {
      discipline: 'arcane',
      displayName: 'Collision Witness',
      element: 'earth',
    },
    credential: endpoint.credential,
    transport: await connectNodeTransport(endpoint.url, baseUrl),
  })
  assert.equal(idleClient.getSnapshot().world.kind, 'hub')

  const boneyardSnapshot = waitForSnapshot(
    idleClient,
    (snapshot) => snapshot.world.kind === 'boneyard',
    60_000,
  )
  await hostPage.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const hostScene = hostPage.locator('.boneyard-scene[data-renderer-state="ready"]')
  await hostScene.waitFor({ timeout: 60_000 })
  await boneyardSnapshot

  const initialSnapshot = idleClient.getSnapshot()
  const initial = playerPair(initialSnapshot, idleClient.playerId)
  assert.ok(
    playerDistance(initial) < 0.001,
    `expected both players at the shared Boneyard spawn (${JSON.stringify(initial)})`,
  )

  const resolvedSnapshot = waitForSnapshot(
    idleClient,
    (snapshot) => (
      snapshot.world.kind === 'boneyard'
      && playerDistance(playerPair(snapshot, idleClient.playerId)) >= 49
    ),
    5_000,
  )
  await hostPage.bringToFront()
  await hostPage.keyboard.down('d')
  let resolved
  try {
    resolved = playerPair(await resolvedSnapshot, idleClient.playerId)
  } finally {
    await hostPage.keyboard.up('d')
  }
  const resolvedDistance = playerDistance(resolved)
  const passiveDisplacement = Math.hypot(
    resolved.idle.x - initial.idle.x,
    resolved.idle.y - initial.idle.y,
  )

  assert.ok(
    resolvedDistance >= 49,
    `expected radius-25 players to resolve without overlap, got ${resolvedDistance}`,
  )
  assert.ok(
    passiveDisplacement > 5,
    `the idle network client was not pushed (${JSON.stringify({ initial, resolved })})`,
  )
  assert.deepEqual(hostErrors, { console: [], page: [] })

  await hostPage.screenshot({ path: screenshotPath })
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    browserVersion: browser.version(),
    geometrySha256: await hostScene.getAttribute('data-geometry-sha256'),
    initial,
    passiveDisplacement,
    resolved,
    resolvedDistance,
    runId: await hostScene.getAttribute('data-run-id'),
    screenshotPath,
  })}\n`)
} finally {
  idleClient?.destroy()
  await browser.close()
}

function captureErrors(page) {
  const errors = { console: [], page: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  return errors
}

async function createCharacter(page, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 45_000,
  })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
}

function connectNodeTransport(url, origin) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin })
    const closeListeners = new Set()
    const messageListeners = new Set()
    const timeout = setTimeout(() => fail(new Error(`Could not connect to ${url}`)), 10_000)
    const fail = (error) => {
      cleanup()
      if (socket.readyState < WebSocket.CLOSING) socket.close()
      reject(error)
    }
    const cleanup = () => {
      clearTimeout(timeout)
      socket.off('error', fail)
      socket.off('close', fail)
    }
    socket.once('error', fail)
    socket.once('close', fail)
    socket.once('open', () => {
      cleanup()
      socket.on('close', (_code, reason) => {
        const message = reason.toString() || 'connection closed'
        for (const listener of closeListeners) listener(message)
      })
      socket.on('message', (data) => {
        const payload = data.toString()
        for (const listener of messageListeners) listener(payload)
      })
      resolve({
        get readyState() {
          return socket.readyState === WebSocket.OPEN ? 'open' : 'closed'
        },
        close(code = 1000, reason = 'session destroyed') {
          if (socket.readyState < WebSocket.CLOSING) socket.close(code, reason)
        },
        onClose(listener) {
          closeListeners.add(listener)
          return () => closeListeners.delete(listener)
        },
        onMessage(listener) {
          messageListeners.add(listener)
          return () => messageListeners.delete(listener)
        },
        send(payload) {
          socket.send(payload)
        },
      })
    })
  })
}

function waitForSnapshot(session, predicate, timeoutMs) {
  const current = session.getSnapshot()
  if (predicate(current)) return Promise.resolve(current)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe()
      reject(new Error('timed out waiting for an authoritative snapshot'))
    }, timeoutMs)
    const unsubscribe = session.onSnapshot((snapshot) => {
      if (!predicate(snapshot)) return
      clearTimeout(timeout)
      unsubscribe()
      resolve(snapshot)
    })
  })
}

function playerPair(snapshot, idlePlayerId) {
  const hostPlayerId = snapshot.hostPlayerId
  assert.ok(hostPlayerId, 'expected an authoritative host player')
  const host = snapshot.players[hostPlayerId]?.position
  const idle = snapshot.players[idlePlayerId]?.position
  assert.ok(host && idle, 'expected both collision participants in the snapshot')
  return {
    host: { x: host.x, y: host.y },
    idle: { x: idle.x, y: idle.y },
    tick: snapshot.tick,
  }
}

function playerDistance(pair) {
  return Math.hypot(
    pair.host.x - pair.idle.x,
    pair.host.y - pair.idle.y,
  )
}

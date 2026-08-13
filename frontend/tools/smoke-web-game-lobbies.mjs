import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_WEB_LOBBY_SMOKE_URL || 'http://127.0.0.1:5173'
const gatewayUrl = process.env.SDR_WEB_LOBBY_GATEWAY_URL?.trim()
const publicWebSocketOrigin = process.env.SDR_WEB_LOBBY_PUBLIC_ORIGIN?.trim()
const partiesScreenshot = process.env.SDR_WEB_LOBBY_PARTIES_SCREENSHOT
  || '/tmp/solomon-dark-web-playtest-parties.png'
const hubScreenshot = process.env.SDR_WEB_LOBBY_HUB_SCREENSHOT
  || '/tmp/solomon-dark-web-playtest-hub.png'
if (Boolean(gatewayUrl) !== Boolean(publicWebSocketOrigin)) {
  throw new Error('SDR_WEB_LOBBY_GATEWAY_URL and SDR_WEB_LOBBY_PUBLIC_ORIGIN must be set together')
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const hostPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const joinPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const pageErrors = []
const consoleErrors = []
for (const page of [hostPage, joinPage]) {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  if (gatewayUrl && publicWebSocketOrigin) {
    await page.addInitScript(({ gateway, publicOrigin }) => {
      const NativeWebSocket = window.WebSocket
      window.WebSocket = class GatewayWebSocket extends NativeWebSocket {
        constructor(url, protocols) {
          const requested = new URL(String(url))
          const mapped = requested.origin === publicOrigin
            ? new URL(`${requested.pathname}${requested.search}`, gateway).toString()
            : requested.toString()
          if (protocols === undefined) super(mapped)
          else super(mapped, protocols)
        }
      }
    }, { gateway: gatewayUrl, publicOrigin: publicWebSocketOrigin })
  }
}

let createdLobby
try {
  await hostPage.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await hostPage.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await hostPage.getByRole('button', { name: 'Play' }).click()
  const createResponse = hostPage.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/game/lobbies'
  ))
  await hostPage.getByRole('button', { name: 'New Game' }).click()
  const response = await createResponse
  createdLobby = await response.json()
  assert.equal(response.status(), 201, JSON.stringify(createdLobby))
  assert.match(createdLobby.lobbyId, /^[A-Za-z0-9_-]{32}$/)
  assert.equal(typeof createdLobby.credential, 'string')
  await waitForCreate(hostPage)

  await joinPage.goto(`${baseUrl}/parties`, { waitUntil: 'domcontentloaded' })
  await joinPage.getByRole('heading', { name: 'Web Rebuild Playtest' }).waitFor()
  const row = joinPage.locator(`[data-web-game-lobby="${createdLobby.lobbyId}"]`)
  await row.waitFor({ timeout: 10_000 })
  assert.match(await row.innerText(), /Choosing loadout/)
  assert.match(await row.innerText(), /WEB TEST/)
  assert.match(await row.innerText(), /0\/16/)
  await joinPage.screenshot({ path: partiesScreenshot, fullPage: true })

  await row.getByRole('link', { name: 'Join Game' }).click()
  await joinPage.waitForURL(new RegExp(`/game\\?party=${createdLobby.lobbyId}$`))
  assert.equal(await joinPage.getByRole('button', { name: 'Play' }).count(), 0)
  await waitForCreate(joinPage)

  await chooseLoadout(joinPage, 'Earth')
  const joinScene = joinPage.locator('.hub-scene[data-renderer-state="ready"]')
  await joinScene.waitFor({ timeout: 30_000 })
  assert.equal(await joinScene.getAttribute('data-is-host'), 'false')
  await waitForLobby(createdLobby.lobbyId, (lobby) => (
    lobby.phase === 'picking-loadout' && lobby.players === 1
  ))

  await chooseLoadout(hostPage, 'Fire')
  const hostScene = hostPage.locator('.hub-scene[data-renderer-state="ready"]')
  await hostScene.waitFor({ timeout: 30_000 })
  await hostPage.waitForFunction(() => (
    document.querySelector('.hub-scene')?.getAttribute('data-is-host') === 'true'
  ))
  await joinPage.waitForFunction(() => (
    document.querySelector('.hub-scene')?.getAttribute('data-is-host') === 'false'
  ))

  const hostCanvas = hostPage.locator('.hub-world-canvas')
  const joinCanvas = joinPage.locator('.hub-world-canvas')
  await Promise.all([
    waitForPlayers(hostPage, 2),
    waitForPlayers(joinPage, 2),
    waitForLobby(createdLobby.lobbyId, (lobby) => lobby.phase === 'hub' && lobby.players === 2),
  ])
  const hostFrame = await frame(hostCanvas)
  const joinFrame = await frame(joinCanvas)
  assert.equal(hostFrame.hostPlayerId, hostFrame.localPlayerId)
  assert.notEqual(joinFrame.hostPlayerId, joinFrame.localPlayerId)
  assert.equal(joinFrame.hostPlayerId, hostFrame.localPlayerId)

  const guestId = joinFrame.localPlayerId
  const before = joinFrame.playerPositions[guestId].x
  await joinPage.bringToFront()
  await joinPage.keyboard.down('d')
  await joinPage.waitForTimeout(1_000)
  await joinPage.keyboard.up('d')
  await joinPage.waitForFunction(({ id, origin }) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerPositions[id]?.x > origin + 20
  ), { id: guestId, origin: before })
  const moved = await frame(joinCanvas)
  await hostPage.waitForFunction(({ id, origin }) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerPositions[id]?.x > origin + 20
  ), { id: guestId, origin: before })
  const replicated = await frame(hostCanvas)
  assert.ok(moved.playerPositions[guestId].x > before + 20)
  assert.ok(replicated.playerPositions[guestId].x > before + 20)
  await hostPage.screenshot({ path: hubScreenshot })

  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    lobbyId: createdLobby.lobbyId,
    hostPlayerId: hostFrame.localPlayerId,
    guestPlayerId: guestId,
    guestBefore: before,
    guestAfter: moved.playerPositions[guestId].x,
    replicatedGuestAfter: replicated.playerPositions[guestId].x,
    partiesScreenshot,
    hubScreenshot,
    consoleErrors,
    pageErrors,
  })}\n`)
} finally {
  if (createdLobby?.lobbyId && createdLobby?.credential) {
    const cancelled = await fetch(`${baseUrl}/api/game/lobbies/${createdLobby.lobbyId}`, {
      method: 'DELETE',
      headers: { 'x-solomon-dark-host-credential': createdLobby.credential },
    })
    assert.ok(cancelled.ok || cancelled.status === 404)
    await waitForLobbyRemoval(createdLobby.lobbyId)
  }
  await browser.close()
}

async function waitForCreate(page) {
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
}

async function chooseLoadout(page, element) {
  await page.bringToFront()
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
}

async function frame(canvas) {
  return canvas.evaluate((node) => structuredClone(node.__sdrHubFrame))
}

async function waitForPlayers(page, count) {
  await page.waitForFunction((expected) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerCount === expected
  ), count, { timeout: 15_000 })
}

async function lobbies() {
  const response = await fetch(`${baseUrl}/api/game/lobbies`)
  const payload = await response.json()
  assert.equal(response.status, 200, JSON.stringify(payload))
  return payload.items
}

async function waitForLobby(lobbyId, predicate) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const lobby = (await lobbies()).find((candidate) => candidate.id === lobbyId)
    if (lobby && predicate(lobby)) return lobby
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for web lobby ${lobbyId}`)
}

async function waitForLobbyRemoval(lobbyId) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (!(await lobbies()).some((candidate) => candidate.id === lobbyId)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for web lobby ${lobbyId} removal`)
}

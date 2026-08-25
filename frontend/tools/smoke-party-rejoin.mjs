import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import {
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
} from '../src/game/core-server/game-simulation.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const baseUrl = process.env.SDR_PARTY_REJOIN_URL || 'http://127.0.0.1:5310'
const browserOrigin = new URL(baseUrl).origin
const evidenceRoot = process.env.SDR_PARTY_REJOIN_EVIDENCE_DIR?.trim()
const sessionKind = process.env.SDR_PARTY_REJOIN_SESSION_KIND?.trim() || 'global-hub'
if (sessionKind !== 'global-hub' && sessionKind !== 'private-college') {
  throw new Error('SDR_PARTY_REJOIN_SESSION_KIND must be global-hub or private-college')
}
const fakeWebSocketOrigin = 'wss://party-rejoin-direct.invalid'
const emptyContent = {
  assets: [],
  boneyards: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] },
  modSources: [],
  summary: { manifestSha256: '0'.repeat(64), mods: [] },
}
const tickets = new Map()
const host = await startGameHost({
  allowedOrigins: [browserOrigin],
  authentication: {
    kind: 'tickets',
    claim: credential => {
      const admission = tickets.get(credential) ?? null
      tickets.delete(credential)
      return admission
    },
  },
  leaderboardReceiptSecret: 'party-rejoin-browser-receipt-secret-20260824',
  sessionKind,
  sharedHub: sessionKind === 'global-hub',
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const rawClients = []
const pageErrors = []
const consoleErrors = []
const failedResponses = []
const failedRequests = []

try {
  if (evidenceRoot) await mkdir(evidenceRoot, { recursive: true })
  const leader = await enterRawPlayer('Basil', 'earth')
  const member = await enterRawPlayer('Cassia', 'water')
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await context.addInitScript(({ actualUrl, fakeOrigin }) => {
    const NativeWebSocket = window.WebSocket
    window.WebSocket = class PartyRejoinWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        const requested = new URL(String(url))
        const mapped = requested.origin === fakeOrigin ? actualUrl : requested.toString()
        if (protocols === undefined) super(mapped)
        else super(mapped, protocols)
      }
    }
  }, { actualUrl: host.address.url, fakeOrigin: fakeWebSocketOrigin })
  await context.route('**/api/game/hub', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify(endpoint(issueTicket({
        content: emptyContent,
        leaderboardUserId: null,
      }))),
    })
  })
  await context.route('**/api/game/rejoin', async route => {
    const token = route.request().postDataJSON()?.token
    const target = typeof token === 'string' ? host.partyRejoinTarget(token) : null
    if (!target) {
      await route.fulfill({
        contentType: 'application/json',
        status: 404,
        body: JSON.stringify({ error: 'That active party run has ended.' }),
      })
      return
    }
    if (target.status !== 'detached') {
      await route.fulfill({
        contentType: 'application/json',
        status: 409,
        body: JSON.stringify({ error: 'That active-party rejoin is already being claimed.' }),
      })
      return
    }
    const reservationId = randomBytes(24).toString('base64url')
    const rejection = host.reservePartyRejoin(
      token,
      reservationId,
      performance.now() + 30_000,
    )
    assert.equal(rejection, null)
    await route.fulfill({
      contentType: 'application/json',
      status: 201,
      body: JSON.stringify(endpoint(issueTicket({
        content: target.content,
        developerAccess: target.developerAccess,
        leaderboardUserId: target.leaderboardUserId,
        partyRejoinToken: token,
        reservationId,
      }))),
    })
  })

  const page = await context.newPage()
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      failedRequests.push(`${request.failure()?.errorText ?? 'unknown'} ${request.url()}`)
    }
  })

  await page.goto(`${baseUrl}/game`, { timeout: 240_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 240_000 })
  const tutorialPrompt = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialPrompt.isVisible()) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill('Aurelia')
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  const hub = page.locator('.hub-scene[data-renderer-state="ready"]')
  await hub.waitFor({ timeout: 240_000 })
  const hubCanvas = page.locator('.hub-world-canvas')
  const browserPlayerId = await hubCanvas.evaluate(canvas => (
    canvas.__sdrHubFrame.localPlayerId
  ))

  if (sessionKind === 'global-hub') {
    leader.invite(browserPlayerId)
    const invitation = page.locator('[data-party-invitation]')
    await invitation.waitFor()
    await invitation.getByRole('button', { name: 'Accept' }).click()
    leader.invite(member.playerId)
    const memberInvitation = await member.next(message => (
      message.type === 'server-party-state' && message.state.invitations.length === 1
    ))
    member.accept(memberInvitation.state.invitations[0].id)
  }
  await page.waitForFunction(() => (
    document.querySelectorAll('[data-party-member]').length === 3
  ))

  const leaderLoaded = leader.next(message => message.type === 'server-boneyard-loaded')
  const memberLoaded = member.next(message => message.type === 'server-boneyard-loaded')
  leader.startMatch('default-random')
  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyard.waitFor({ timeout: 240_000 })
  const [leaderRun, memberRun] = await Promise.all([leaderLoaded, memberLoaded])
  const runId = await boneyard.getAttribute('data-run-id')
  assert.equal(runId, leaderRun.boneyard.runId)
  assert.equal(runId, memberRun.boneyard.runId)

  const savedRun = await waitForLocalSave(page, record => (
    typeof JSON.parse(record?.document ?? 'null')?.continuation?.summary?.partyRejoinToken
      === 'string'
  ))
  const oldToken = JSON.parse(savedRun.document).continuation.summary.partyRejoinToken
  await boneyard.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor()
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  await waitForHost(() => host.humanPlayerCount() === 2, 'browser departure')
  assert.equal(host.playerCount(), 3)
  assert.equal(host.partyRejoinTarget(oldToken)?.status, 'detached')

  const active = host.playerState(leader.playerId)
  assert.ok(active)
  Object.assign(active, grantGameSimulationPlayerExperience(active, leader.playerId, 300))
  await waitForHost(() => host.playerState(leader.playerId)?.levelUpBarrier !== null, 'peer offers')
  await new Promise(resolve => setTimeout(resolve, 100))
  await resolveAllOffers(leader)
  await resolveAllOffers(member)
  await waitForHost(() => (
    host.playerState(leader.playerId)?.levelUpBarrier === null
    && getPlayerProgression(host.playerState(leader.playerId), leader.playerId).level === 4
  ), 'peer offer completion')

  await page.getByRole('button', { name: 'Play' }).click()
  const rejoinResponse = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/game/rejoin'
  ))
  await page.getByRole('button', { name: 'Last Game' }).click()
  assert.equal((await rejoinResponse).status(), 201)
  await boneyard.waitFor({ timeout: 240_000 })
  assert.equal(await boneyard.getAttribute('data-run-id'), runId)
  assert.equal(host.playerState(browserPlayerId)?.run.runId, runId)

  await waitForHost(() => (
    host.playerState(browserPlayerId)?.levelUpBarrier?.pendingPlayerIds
      .includes(browserPlayerId) === true
  ), 'rejoin catch-up barrier')
  const held = host.playerState(browserPlayerId)
  assert.ok(held)
  const heldTick = held.tick
  const heldEnemies = held.world.kind === 'boneyard'
    ? JSON.stringify(held.world.enemies)
    : null
  await new Promise(resolve => setTimeout(resolve, 300))
  const stillHeld = host.playerState(browserPlayerId)
  assert.equal(stillHeld?.tick, heldTick)
  assert.equal(
    stillHeld?.world.kind === 'boneyard' ? JSON.stringify(stillHeld.world.enemies) : null,
    heldEnemies,
  )

  const picker = page.locator('.skill-picker-stage')
  const offerSequences = []
  for (let index = 0; index < 3; index += 1) {
    await picker.locator('xpath=self::*[@data-picker-phase="settled"]').waitFor({
      timeout: 30_000,
    })
    const sequence = Number(await picker.getAttribute('data-offer-sequence'))
    offerSequences.push(sequence)
    assert.equal(await picker.locator('.skill-picker-action').count(), 3)
    await picker.locator('.skill-picker-action').first().click()
    if (index < 2) {
      await page.waitForFunction(previous => {
        const stage = document.querySelector('.skill-picker-stage')
        return stage?.dataset.pickerPhase === 'settled'
          && Number(stage.dataset.offerSequence) !== previous
      }, sequence, { timeout: 20_000 })
    }
  }
  await picker.waitFor({ state: 'detached', timeout: 20_000 })
  await waitForHost(() => (
    host.playerState(browserPlayerId)?.levelUpBarrier === null
    && (host.playerState(browserPlayerId)?.tick ?? 0) > heldTick
  ), 'run release after catch-up')
  const resumed = host.playerState(browserPlayerId)
  assert.equal(getPlayerProgression(resumed, browserPlayerId).level, 4)
  const rotatedSave = await waitForLocalSave(page, record => {
    const token = JSON.parse(record?.document ?? 'null')?.continuation?.summary
      ?.partyRejoinToken
    return typeof token === 'string' && token !== oldToken
  })
  assert.ok(rotatedSave.revision > savedRun.revision)
  assert.equal(host.partyRejoinTarget(oldToken), null)

  const screenshotPath = evidenceRoot
    ? join(evidenceRoot, `party-rejoin-catch-up-${sessionKind}.png`)
    : null
  if (screenshotPath) await page.screenshot({ path: screenshotPath })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(failedRequests, [])
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    sessionKind,
    browserPlayerId,
    runId,
    heldTick,
    resumedTick: resumed.tick,
    offerSequences,
    saveRevisionBefore: savedRun.revision,
    saveRevisionAfter: rotatedSave.revision,
    screenshotPath,
    pageErrors,
    consoleErrors,
    failedResponses,
    failedRequests,
  })}\n`)
  await context.close()
} finally {
  for (const client of rawClients.splice(0)) await client.close()
  await browser.close()
  await host.close()
}

function endpoint(credential) {
  return {
    kind: 'remote',
    sessionKind,
    url: `${fakeWebSocketOrigin}/game`,
    credential,
  }
}

function issueTicket(admission) {
  const credential = randomBytes(32).toString('base64url')
  tickets.set(credential, admission)
  return credential
}

async function enterRawPlayer(displayName, element) {
  const credential = issueTicket({ content: emptyContent, leaderboardUserId: null })
  const socket = await new Promise((resolve, reject) => {
    const connecting = new WebSocket(host.address.url, { origin: browserOrigin })
    connecting.once('open', () => resolve(connecting))
    connecting.once('error', reject)
  })
  const next = messageQueue(socket)
  socket.send(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character: { discipline: 'arcane', displayName, element },
  }))
  const welcome = await next(message => message.type === 'server-welcome')
  const client = {
    accept(invitationId) {
      socket.send(JSON.stringify({ type: 'client-party-accept', invitationId }))
    },
    close: () => closeSocket(socket),
    invite(targetPlayerId) {
      socket.send(JSON.stringify({ type: 'client-party-invite', targetPlayerId }))
    },
    next,
    playerId: welcome.playerId,
    select(choiceIndex, offer) {
      socket.send(JSON.stringify({
        type: 'client-select-skill',
        choiceIndex,
        offerSequence: offer.sequence,
        skillId: offer.options[choiceIndex].skillId,
      }))
    },
    startMatch(boneyardId) {
      socket.send(JSON.stringify({ type: 'client-start-match', boneyardId }))
    },
  }
  rawClients.push(client)
  return client
}

async function resolveAllOffers(client) {
  while (true) {
    const active = host.playerState(client.playerId)
    if (!active) throw new Error(`host lost ${client.playerId}`)
    const offer = getPlayerProgression(active, client.playerId).pendingOffer
    if (!offer) return
    client.select(0, offer)
    await waitForHost(() => {
      const next = host.playerState(client.playerId)
      return next !== null
        && getPlayerProgression(next, client.playerId).pendingOffer?.sequence !== offer.sequence
    }, `${client.playerId} offer ${offer.sequence}`)
  }
}

function messageQueue(socket) {
  const buffered = []
  const waiters = []
  socket.on('message', data => {
    const message = JSON.parse(data.toString())
    if (message.type === 'server-snapshot') {
      socket.send(JSON.stringify({
        type: 'client-snapshot-ack',
        requireKeyframe: false,
        sequence: message.sequence,
      }))
    }
    const index = waiters.findIndex(({ predicate }) => predicate(message))
    if (index < 0) {
      buffered.push(message)
      return
    }
    const waiter = waiters.splice(index, 1)[0]
    clearTimeout(waiter.timeout)
    waiter.resolve(message)
  })
  return predicate => {
    const index = buffered.findIndex(predicate)
    if (index >= 0) return Promise.resolve(buffered.splice(index, 1)[0])
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timeout: null }
      waiter.timeout = setTimeout(() => {
        const index = waiters.indexOf(waiter)
        if (index >= 0) waiters.splice(index, 1)
        reject(new Error('timed out waiting for raw host message'))
      }, 30_000)
      waiters.push(waiter)
    })
  }
}

async function waitForHost(predicate, label) {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${label}`)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

async function waitForLocalSave(page, predicate) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const record = await page.evaluate(() => new Promise((resolve, reject) => {
      const opened = indexedDB.open('solomon-dark-game-saves', 1)
      opened.onerror = () => reject(opened.error)
      opened.onsuccess = () => {
        const request = opened.result.transaction('slots', 'readonly')
          .objectStore('slots').get(0)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result ?? null)
      }
    }))
    if (predicate(record)) return record
    await page.waitForTimeout(100)
  }
  throw new Error('timed out waiting for local save')
}

function closeSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise(resolve => {
    socket.once('close', resolve)
    socket.close(1000, 'party rejoin smoke complete')
  })
}

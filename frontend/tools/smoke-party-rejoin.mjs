import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'

import {
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
} from '../src/game/core-server/game-simulation.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const staticServer = process.env.SDR_PARTY_REJOIN_URL
  ? null
  : await startStaticClientServer({
      root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
    })
const baseUrl = process.env.SDR_PARTY_REJOIN_URL || staticServer.origin
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
  compiledMods: [],
  manifest: { manifestSha256: '0'.repeat(64), mods: [] },
  modSources: [],
  summary: { manifestSha256: '0'.repeat(64), mods: [] },
}
const tickets = new Map()
const hostErrors = []
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
  log: entry => {
    if (entry.level === 'error') {
      hostErrors.push(entry)
      process.stderr.write(`party-rejoin host error: ${JSON.stringify(entry)}\n`)
    }
  },
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
  await context.route('**/deployment.json*', async route => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
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
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.getAttribute('data-hub-region') === 'courtyard'
      && canvas?.getAttribute('data-transition-phase') === 'none'
  }, null, { timeout: 60_000 })
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
  const leaderParty = await leader.next(message => (
    message.type === 'server-party-state' && message.state.party.memberPlayerIds.length === 3
  ))
  assert.equal(leaderParty.state.party.leaderPlayerId, leader.playerId)

  const leaderLoaded = leader.next(message => message.type === 'server-boneyard-loaded')
  const memberLoaded = member.next(message => message.type === 'server-boneyard-loaded')
  const leaderInitialGrace = leader.next(message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs === null
  ))
  const memberInitialGrace = member.next(message => (
    message.type === 'server-gameplay-resume-grace'
    && message.grace?.reason === 'game-started'
    && message.grace.remainingMs === null
  ))
  leader.startMatch('default-random')
  await waitForHost(() => host.runCount() === 1, 'shared run start')
  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyard.waitFor({ timeout: 240_000 })
  const [leaderRun, memberRun] = await Promise.all([leaderLoaded, memberLoaded])
  const runId = await boneyard.getAttribute('data-run-id')
  assert.equal(runId, leaderRun.boneyard.runId)
  assert.equal(runId, memberRun.boneyard.runId)
  const [leaderStart, memberStart] = await Promise.all([
    leaderInitialGrace,
    memberInitialGrace,
  ])
  const initialWaiting = page.locator(
    '.gameplay-resume-countdown-overlay'
    + '[data-gameplay-resume-grace-reason="game-started"]'
    + '[data-gameplay-resume-grace-phase="waiting"]',
  )
  await initialWaiting.waitFor()
  const initialHeldTick = host.playerState(leader.playerId).tick
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(host.playerState(leader.playerId).tick, initialHeldTick)
  leader.readyResumeGrace(leaderStart.grace.sequence)
  member.readyResumeGrace(memberStart.grace.sequence)
  await initialWaiting.waitFor({ state: 'detached', timeout: 10_000 })
  await waitForHost(
    () => host.playerState(leader.playerId).tick > initialHeldTick,
    'initial all-player grace',
  )

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
  assert.equal(host.capacityParticipantCount(), 3)
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
  assert.equal(host.playerState(browserPlayerId), null)
  assert.equal(host.partyRejoinTarget(oldToken)?.status, 'staging')

  const liveBeforeCatchUp = host.playerState(leader.playerId)
  assert.ok(liveBeforeCatchUp)
  const heldTick = liveBeforeCatchUp.tick
  await new Promise(resolve => setTimeout(resolve, 300))
  const liveDuringCatchUp = host.playerState(leader.playerId)
  assert.equal(liveDuringCatchUp?.tick, heldTick)
  const renderedPlayers = await page.locator('.boneyard-world-canvas').evaluate(canvas => (
    canvas.__sdrBoneyardFrame.playerCount
  ))
  assert.equal(renderedPlayers, 2)
  const stagedScreenshotPath = evidenceRoot
    ? join(evidenceRoot, `party-rejoin-detached-catch-up-${sessionKind}.png`)
    : null
  if (stagedScreenshotPath) await page.screenshot({ path: stagedScreenshotPath })

  const stacked = host.playerState(leader.playerId)
  assert.ok(stacked)
  Object.assign(stacked, grantGameSimulationPlayerExperience(stacked, leader.playerId, 1_000))
  await waitForHost(() => host.playerState(leader.playerId)?.levelUpBarrier !== null, 'stacked peers')
  await resolveAllOffers(leader, false)
  await resolveAllOffers(member, false)
  await waitForHost(() => host.playerState(leader.playerId)?.levelUpBarrier === null, 'stacked peers done')

  const leaderState = host.playerState(leader.playerId)
  const leaderIndex = leaderState.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === leader.playerId
  ))
  assert.ok(leaderIndex >= 0)
  Object.assign(leaderState, {
    playerEntities: {
      ...leaderState.playerEntities,
      progressions: leaderState.playerEntities.progressions.map((progression, index) => (
        index === leaderIndex
          ? { ...progression, currentHealth: 0, lifeState: 'spectating' }
          : progression
      )),
    },
  })
  leader.flushSnapshot()
  leader.setVisibility('private')
  const deadVisualHandle = await page.waitForFunction(playerId => {
    const row = document.querySelector(`[data-ally-id="${playerId}"]`)
    const status = row?.querySelector('.hub-hud-ally-status')
    const backgroundImage = row === null
      ? 'none'
      : getComputedStyle(row, '::after').backgroundImage
    return row?.getAttribute('data-ally-dead') === 'true'
      && status?.textContent === 'DEAD'
      && backgroundImage !== 'none'
      ? {
          connected: row.getAttribute('data-ally-connected'),
          dead: row.getAttribute('data-ally-dead'),
          backgroundImage,
          status: status.textContent,
        }
      : false
  }, leader.playerId)
  const deadVisual = await deadVisualHandle.jsonValue()
  assert.deepEqual({ connected: deadVisual.connected, dead: deadVisual.dead }, {
    connected: 'true',
    dead: 'true',
  })
  assert.equal(deadVisual.status, 'DEAD')

  const deadLeaderCheckpoint = await leader.checkpointBeforeLeave(701)

  const retainedLeaderState = member.next(message => (
    message.type === 'server-party-state'
    && message.state.partyRoster.some(row => (
      row.playerId === leader.playerId && !row.connected
    ))
  ))
  await leader.close()
  const retainedLeader = await retainedLeaderState
  assert.equal(retainedLeader.state.party.leaderPlayerId, leader.playerId)
  assert.deepEqual(new Set(retainedLeader.state.party.memberPlayerIds), new Set([
    leader.playerId,
    browserPlayerId,
    member.playerId,
  ]))
  const disconnectedVisualHandle = await page.waitForFunction(playerId => {
    const row = document.querySelector(`[data-ally-id="${playerId}"]`)
    const signal = row === null ? null : getComputedStyle(row, '::before')
    const dead = row === null ? null : getComputedStyle(row, '::after')
    const status = row?.querySelector('.hub-hud-ally-status')
    return row?.getAttribute('data-ally-connected') === 'false'
      && status?.textContent === 'DISCONNECTED'
      && signal?.backgroundImage !== 'none'
      && dead?.backgroundImage !== 'none'
      ? {
          animationName: signal.animationName,
          backgroundImage: signal.backgroundImage,
          deadBackgroundImage: dead.backgroundImage,
          dead: row.getAttribute('data-ally-dead'),
          status: status.textContent,
        }
      : false
  }, leader.playerId)
  const disconnectedSignal = await disconnectedVisualHandle.jsonValue()
  assert.equal(disconnectedSignal.dead, 'true')
  assert.equal(disconnectedSignal.status, 'DISCONNECTED')
  assert.notEqual(disconnectedSignal.backgroundImage, 'none')
  assert.notEqual(disconnectedSignal.deadBackgroundImage, 'none')
  assert.equal(disconnectedSignal.animationName, 'ally-signal-loss')
  const rosterScreenshotPath = evidenceRoot
    ? join(evidenceRoot, `party-roster-dead-disconnected-${sessionKind}.png`)
    : null
  if (rosterScreenshotPath) await page.screenshot({ path: rosterScreenshotPath })

  const tickAfterPeers = host.playerState(member.playerId).tick
  await new Promise(resolve => setTimeout(resolve, 150))
  assert.equal(host.playerState(member.playerId).tick, tickAfterPeers)

  const picker = page.locator('.skill-picker-stage')
  await picker.waitFor({ state: 'visible', timeout: 30_000 })
  const offerSequences = []
  while (await picker.isVisible()) {
    await picker.locator('xpath=self::*[@data-picker-phase="settled"]').waitFor({
      timeout: 30_000,
    })
    const sequence = Number(await picker.getAttribute('data-offer-sequence'))
    offerSequences.push(sequence)
    assert.equal(await picker.locator('.skill-picker-action').count(), 3)
    await picker.locator('.skill-picker-action').first().click()
    await page.waitForFunction(previous => {
      const stage = document.querySelector('.skill-picker-stage')
      return !stage || (
        stage.dataset.pickerPhase === 'settled'
        && Number(stage.dataset.offerSequence) !== previous
      )
    }, sequence, { timeout: 20_000 })
  }
  assert.ok(offerSequences.length >= 3)
  await picker.waitFor({ state: 'detached', timeout: 20_000 })
  assert.equal(
    await page.locator('.main-menu-page').getAttribute('data-gameplay-resume-grace'),
    'game-rejoined',
  )
  const countdown = page.locator('.gameplay-resume-countdown-overlay')
  await countdown.waitFor({ timeout: 20_000 })
  assert.equal(
    await countdown.getAttribute('data-gameplay-resume-grace-reason'),
    'game-rejoined',
  )
  assert.equal(
    await countdown.getAttribute('data-gameplay-resume-grace-phase'),
    'waiting',
  )
  assert.match(await countdown.textContent() ?? '', /Waiting on players \.\.\./)
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(host.playerState(browserPlayerId)?.tick, heldTick)
  const rejoinSequence = Number(
    await countdown.getAttribute('data-gameplay-resume-grace-sequence'),
  )
  assert.ok(Number.isSafeInteger(rejoinSequence) && rejoinSequence > 0)
  member.readyResumeGrace(rejoinSequence)
  for (const seconds of [3, 2, 1]) {
    await page.locator(
      `.gameplay-resume-countdown-overlay[data-gameplay-resume-grace-seconds="${seconds}"]`,
    ).waitFor({ timeout: 20_000 })
    assert.equal(host.playerState(browserPlayerId)?.tick, heldTick)
  }
  await countdown.waitFor({ state: 'detached', timeout: 20_000 })
  await waitForHost(() => (
    host.playerState(browserPlayerId)?.levelUpBarrier === null
    && (host.playerState(browserPlayerId)?.tick ?? 0) > heldTick
  ), 'run release after catch-up')
  const resumed = host.playerState(browserPlayerId)
  assert.ok(getPlayerProgression(resumed, browserPlayerId).level >= 4)
  const rotatedSave = await waitForLocalSave(page, record => {
    const token = JSON.parse(record?.document ?? 'null')?.continuation?.summary
      ?.partyRejoinToken
    return typeof token === 'string' && token !== oldToken
  })
  const rotatedToken = JSON.parse(rotatedSave.document).continuation.summary.partyRejoinToken
  assert.ok(rotatedSave.revision > savedRun.revision)
  assert.equal(host.partyRejoinTarget(oldToken)?.status, 'connected')

  const browserState = host.playerState(browserPlayerId)
  const browserIndex = browserState.playerEntities.identities.findIndex(({ playerId }) => (
    playerId === browserPlayerId
  ))
  assert.ok(browserIndex >= 0)
  Object.assign(browserState, {
    playerEntities: {
      ...browserState.playerEntities,
      progressions: browserState.playerEntities.progressions.map((progression, index) => (
        index === browserIndex
          ? { ...progression, currentHealth: 0, lifeState: 'spectating' }
          : progression
      )),
    },
  })
  const memberCheckpoint = await member.checkpointBeforeLeave(702)
  const rejoinWait = page.locator(
    '.gameplay-resume-countdown-overlay'
    + '[data-gameplay-resume-grace-reason="party-rejoin-wait"]'
    + '[data-gameplay-resume-grace-phase="waiting"]',
  )
  await member.close()
  await rejoinWait.waitFor({ timeout: 20_000 })
  assert.match(await rejoinWait.textContent() ?? '', /Waiting for players to rejoin/)
  const disconnectedMember = page.locator(
    `[data-ally-id="${member.playerId}"]`
    + '[data-ally-connected="false"]'
    + '[data-ally-status="disconnected"]',
  )
  await disconnectedMember.waitFor()
  assert.equal(
    await disconnectedMember.locator('.hub-hud-ally-status').textContent(),
    'DISCONNECTED',
  )
  const noLivingHeldTick = host.playerState(browserPlayerId).tick
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(host.playerState(browserPlayerId).tick, noLivingHeldTick)
  assert.equal(host.playerState(browserPlayerId).run.phase, 'active')
  const waitingScreenshotPath = evidenceRoot
    ? join(evidenceRoot, `party-rejoin-waiting-and-status-${sessionKind}.png`)
    : null
  if (waitingScreenshotPath) await page.screenshot({ path: waitingScreenshotPath })

  const returnedMember = await reenterRawPlayer(memberCheckpoint, 'Cassia', 'water')
  assert.equal(returnedMember.welcome.gameplayResumeGrace?.reason, 'party-rejoin-wait')
  assert.equal(returnedMember.welcome.gameplayResumeGrace?.remainingMs, null)
  await page.waitForFunction(playerId => {
    const row = document.querySelector(`[data-ally-id="${playerId}"]`)
    return row?.getAttribute('data-ally-connected') === 'true'
      && row.getAttribute('data-ally-dead') === 'false'
      && row.getAttribute('data-ally-status') === 'none'
  }, member.playerId)
  returnedMember.readyResumeGrace(returnedMember.welcome.gameplayResumeGrace.sequence)
  await page.locator(
    '.gameplay-resume-countdown-overlay'
    + '[data-gameplay-resume-grace-reason="party-rejoin-wait"]'
    + '[data-gameplay-resume-grace-phase="countdown"]',
  ).waitFor({ timeout: 20_000 })
  await rejoinWait.waitFor({ state: 'detached', timeout: 20_000 })
  await waitForHost(
    () => host.playerState(browserPlayerId).tick > noLivingHeldTick,
    'party rejoin wait release',
  )

  const returnedLeader = await reenterRawPlayer(deadLeaderCheckpoint, 'Basil', 'earth')
  assert.equal(returnedLeader.welcome.gameplayResumeGrace?.reason, 'game-rejoined')
  const reconnectedDeadLeader = page.locator(
    `[data-ally-id="${leader.playerId}"]`
    + '[data-ally-connected="true"]'
    + '[data-ally-dead="true"]'
    + '[data-ally-status="dead"]',
  )
  await reconnectedDeadLeader.waitFor()
  assert.equal(
    await reconnectedDeadLeader.locator('.hub-hud-ally-status').textContent(),
    'DEAD',
  )
  const leaderRejoinSequence = returnedLeader.welcome.gameplayResumeGrace.sequence
  returnedMember.readyResumeGrace(leaderRejoinSequence)
  returnedLeader.readyResumeGrace(leaderRejoinSequence)
  const leaderCountdown = page.locator(
    '.gameplay-resume-countdown-overlay'
    + '[data-gameplay-resume-grace-reason="game-rejoined"]',
  )
  await leaderCountdown.waitFor({ timeout: 20_000 })
  await leaderCountdown.waitFor({ state: 'detached', timeout: 20_000 })

  const screenshotPath = evidenceRoot
    ? join(evidenceRoot, `party-rejoin-catch-up-${sessionKind}.png`)
    : null
  if (screenshotPath) await page.screenshot({ path: screenshotPath })

  await returnedLeader.close()
  await waitForHost(() => host.humanPlayerCount() === 2 && host.runCount() === 1, 'final pair')
  await boneyard.focus()
  await page.keyboard.press('Escape')
  const finalPause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await finalPause.waitFor()
  await finalPause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  await waitForHost(() => host.humanPlayerCount() === 1 && host.runCount() === 1, 'final peer')
  await returnedMember.close()
  await waitForHost(() => (
    host.humanPlayerCount() === 0
    && host.capacityParticipantCount() === 0
    && host.runCount() === 0
  ), 'final actor retirement')
  assert.equal(host.partyCount(), 0)
  assert.equal(host.partyRejoinTarget(oldToken), null)
  assert.equal(host.partyRejoinTarget(rotatedToken), null)
  assert.deepEqual({
    consoleErrors,
    failedRequests,
    failedResponses,
    hostErrors,
    pageErrors,
  }, {
    consoleErrors: [],
    failedRequests: [],
    failedResponses: [],
    hostErrors: [],
    pageErrors: [],
  })
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
    stagedScreenshotPath,
    rosterScreenshotPath,
    waitingScreenshotPath,
    deadOverlay: deadVisual.backgroundImage,
    disconnectedSignal,
    pageErrors,
    consoleErrors,
    failedResponses,
    failedRequests,
    hostErrors,
  })}\n`)
  await context.close()
} finally {
  for (const client of rawClients.splice(0)) await client.close()
  await browser.close()
  await host.close()
  await staticServer?.close()
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
  const next = messageQueue(socket, displayName)
  socket.send(JSON.stringify({
    type: 'client-hello',
    onlinePreferences: { activityMessages: true, globalChat: true, submitRuns: true },
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character: { discipline: 'arcane', displayName, element },
  }))
  const welcome = await next(message => message.type === 'server-welcome')
  const client = createRawClient(socket, next, welcome)
  rawClients.push(client)
  return client
}

async function reenterRawPlayer(checkpoint, displayName, element) {
  const token = JSON.parse(checkpoint.save).continuation.summary.partyRejoinToken
  const target = host.partyRejoinTarget(token)
  assert.equal(target?.status, 'detached')
  const reservationId = randomBytes(24).toString('base64url')
  assert.equal(
    host.reservePartyRejoin(token, reservationId, performance.now() + 30_000),
    null,
  )
  const credential = issueTicket({
    content: target.content,
    developerAccess: target.developerAccess,
    leaderboardUserId: target.leaderboardUserId,
    partyRejoinToken: token,
    reservationId,
  })
  const socket = await new Promise((resolve, reject) => {
    const connecting = new WebSocket(host.address.url, { origin: browserOrigin })
    connecting.once('open', () => resolve(connecting))
    connecting.once('error', reject)
  })
  const next = messageQueue(socket, `${displayName} rejoin`)
  socket.send(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential,
    character: { discipline: 'arcane', displayName, element },
    save: checkpoint.save,
    saveIntent: 'resume',
  }))
  const welcome = await next(message => message.type === 'server-welcome')
  const client = createRawClient(socket, next, welcome)
  rawClients.push(client)
  return client
}

function createRawClient(socket, next, welcome) {
  let inputSequence = 0
  return {
    accept(invitationId) {
      socket.send(JSON.stringify({ type: 'client-party-accept', invitationId }))
    },
    async checkpointBeforeLeave(requestId) {
      socket.send(JSON.stringify({ type: 'client-save-before-leave', requestId }))
      const response = await next(message => (
        message.type === 'server-save-before-leave' && message.requestId === requestId
      ))
      return next(message => (
        message.type === 'server-save-checkpoint'
        && message.sequence === response.checkpointSequence
      ))
    },
    close: () => closeSocket(socket),
    flushSnapshot() {
      inputSequence += 1
      socket.send(JSON.stringify({
        type: 'client-input',
        input: {
          aim: null,
          cast: { primary: false, quickbar: null },
          movement: { x: 0, y: 0 },
          viewportWidth: 1600,
        },
        sequence: inputSequence,
        targetTick: host.playerState(welcome.playerId).tick + 1,
      }))
    },
    invite(targetPlayerId) {
      socket.send(JSON.stringify({ type: 'client-party-invite', targetPlayerId }))
    },
    next,
    playerId: welcome.playerId,
    readyResumeGrace(sequence) {
      socket.send(JSON.stringify({ type: 'client-resume-grace-ready', sequence }))
    },
    select(choiceIndex, offer) {
      socket.send(JSON.stringify({
        type: 'client-select-skill',
        choiceIndex,
        offerSequence: offer.sequence,
        skillId: offer.options[choiceIndex].skillId,
      }))
    },
    setVisibility(visibility) {
      socket.send(JSON.stringify({ type: 'client-party-settings', visibility }))
    },
    startMatch(boneyardId) {
      socket.send(JSON.stringify({ type: 'client-start-match', boneyardId }))
    },
    welcome,
  }
}

async function resolveAllOffers(client, acknowledgeSkillPickerGrace = true) {
  while (true) {
    const active = host.playerState(client.playerId)
    if (!active) throw new Error(`host lost ${client.playerId}`)
    const progression = getPlayerProgression(active, client.playerId)
    const offer = progression.pendingOffer
    if (!offer) return
    const finalCohortChoice = progression.pendingLevels.length === 1
      && active.levelUpBarrier?.pendingPlayerIds.length === 1
      && active.levelUpBarrier.pendingPlayerIds[0] === client.playerId
    const pendingGrace = acknowledgeSkillPickerGrace && finalCohortChoice
      ? client.next(message => (
          message.type === 'server-gameplay-resume-grace'
          && message.grace?.reason === 'skill-picker-closed'
          && message.grace?.remainingMs === null
        ))
      : null
    client.select(0, offer)
    await waitForHost(() => {
      const next = host.playerState(client.playerId)
      return next !== null
        && getPlayerProgression(next, client.playerId).pendingOffer?.sequence !== offer.sequence
    }, `${client.playerId} offer ${offer.sequence}`)
    if (pendingGrace) {
      const grace = await pendingGrace
      await new Promise(resolve => setTimeout(resolve, 550))
      client.readyResumeGrace(grace.grace.sequence)
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  }
}

function messageQueue(socket, label) {
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
        reject(new Error(
          `timed out waiting for raw host message from ${label}; bufferedTail=${buffered.slice(-64).map(message => (
            message.type === 'server-gameplay-resume-grace'
              ? `${message.type}:${message.grace?.reason ?? 'none'}:${message.grace?.remainingMs ?? 'pending'}`
              : message.type
          )).join(',')}`,
        ))
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

async function moveHubAxis(page, key, axis, target, direction) {
  await page.locator('.main-menu-page[data-hub-player-activity="none"]').waitFor()
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ axis: coordinate, direction: comparison, target: limit }) => {
      const value = document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.[coordinate]
      return typeof value === 'number'
        && (comparison === 'at-least' ? value >= limit : value <= limit)
    }, { axis, direction, target }, { timeout: 15_000 })
  } finally {
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
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

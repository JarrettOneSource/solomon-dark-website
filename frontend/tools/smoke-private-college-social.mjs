import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright-core'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const baseUrl = process.env.SDR_PRIVATE_COLLEGE_SOCIAL_URL || 'http://127.0.0.1:5173'
const gatewayUrl = process.env.SDR_PRIVATE_COLLEGE_SOCIAL_GATEWAY_URL?.trim()
const publicWebSocketOrigin = process.env.SDR_PRIVATE_COLLEGE_SOCIAL_PUBLIC_ORIGIN?.trim()
const evidenceRoot = process.env.SDR_PRIVATE_COLLEGE_SOCIAL_EVIDENCE_DIR?.trim()
if (Boolean(gatewayUrl) !== Boolean(publicWebSocketOrigin)) {
  throw new Error('private-College gateway URL and public origin must be supplied together')
}

const username = `collegesocial${Date.now().toString(36)}`
const registration = await api('/api/auth/register', {
  method: 'POST',
  body: {
    email: `${username}@example.invalid`,
    password: 'correct-horse-battery-staple',
    username,
  },
}, 201)
const token = registration.token
assert.equal(typeof token, 'string')
const mod = await enableFirstPlayableMod(token)
const active = await api('/api/mods/active', { token })
assert.ok(active.mods.length > 0)

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const contexts = []
const pageErrors = []
const consoleErrors = []
const failedResponses = []
const requestFailures = []
const welcomeReceipts = new Map()

try {
  if (evidenceRoot) await mkdir(evidenceRoot, { recursive: true })
  const source = await gamePage('Source Host', {
    settings: { enableCheats: true },
    token,
    viewport: { width: 1440, height: 900 },
  })
  await enterGame(source, {
    displayName: 'Mod Host',
    element: 'Fire',
    local: true,
    expectedAdmissionPath: '/api/game/sessions',
  })
  assert.equal(await source.locator('.main-menu-page').getAttribute('data-session-kind'), 'private-college')
  assert.equal(await source.locator('.main-menu-page').getAttribute('data-session-cheats-enabled'), 'true')
  assert.equal(latestWelcome(source).content.manifestSha256, active.manifestSha256)
  const sourceName = (await source.locator('[data-native-ui-party-chip-name]').first().innerText()).trim()
  assert.ok(sourceName.length > 0)

  const target = await gamePage('Target Guest', {
    settings: { enableCheats: false, enableSharedHub: false },
    viewport: { width: 1280, height: 800 },
  })
  await enterGame(target, {
    displayName: 'Remote Guest',
    element: 'Water',
    local: false,
    expectedAdmissionPath: '/api/game/sessions',
  })
  assert.equal(
    await target.locator('.main-menu-page').getAttribute('data-session-kind'),
    'private-college',
  )

  const resident = await gamePage('Resident Hub Guest', {
    viewport: { width: 1280, height: 800 },
  })
  await enterGame(resident, {
    displayName: 'Resident Guest',
    element: 'Earth',
    local: false,
    expectedAdmissionPath: '/api/game/hub',
  })
  assert.equal(
    await resident.locator('.main-menu-page').getAttribute('data-session-kind'),
    'global-hub',
  )
  const initialHealth = await supervisorHealth()
  if (initialHealth) {
    assert.equal(initialHealth.privateSessions, 2)
    assert.equal(initialHealth.privatePlayers, 2)
    assert.equal(initialHealth.hubPlayers, 1)
  }

  await sendChat(resident, 'global', 'Resident Hub reaches both private Colleges')
  await waitForChatMessage(source, 'global', 'Resident Hub reaches both private Colleges')
  await waitForChatMessage(target, 'global', 'Resident Hub reaches both private Colleges')
  await sendChat(source, 'global', 'Modded College reaches every online session')
  await waitForChatMessage(target, 'global', 'Modded College reaches every online session')
  await waitForChatMessage(resident, 'global', 'Modded College reaches every online session')
  await sendChat(target, 'global', 'Invite me from this message')
  await waitForChatMessage(resident, 'global', 'Invite me from this message')

  const targetMessage = await waitForChatMessage(
    source,
    'global',
    'Invite me from this message',
  )
  const messageReceipt = await targetMessage.evaluate(node => ({
    authorButtons: [...node.querySelectorAll('.game-chat-player-name')]
      .map(button => button.textContent?.trim()),
    senderPlayerId: node.getAttribute('data-sender-player-id'),
  }))
  assert.equal(messageReceipt.authorButtons.length, 1, JSON.stringify(messageReceipt))
  const remoteName = messageReceipt.authorButtons[0]
  assert.ok(remoteName)
  assert.match(messageReceipt.senderPlayerId ?? '', /^player-ref-[A-Za-z0-9_-]{32}$/)
  await targetMessage.locator('.game-chat-player-name').click()
  const remoteCard = source.getByRole('dialog', { name: remoteName })
  await remoteCard.waitFor()
  await remoteCard.getByText('PRIVATE COLLEGE · IN COLLEGE', { exact: true }).waitFor()
  const cardEvidencePath = evidenceRoot ? join(evidenceRoot, 'chat-player-card.png') : null
  if (cardEvidencePath) await source.screenshot({ path: cardEvidencePath })
  await remoteCard.getByRole('button', { name: 'Message', exact: true }).click()

  await sendChat(source, 'whisper', 'Private College whisper before invitation')
  await waitForChatMessage(target, 'whisper', 'Private College whisper before invitation')
  await sendChat(target, 'whisper', 'Private College whisper reply')
  await waitForChatMessage(source, 'whisper', 'Private College whisper reply')
  const ownWhisper = await waitForChatMessage(
    source,
    'whisper',
    'Private College whisper before invitation',
  )
  await ownWhisper.locator('.game-chat-player-name').click()
  const inviteCard = source.getByRole('dialog', { name: remoteName })
  await inviteCard.waitFor()
  await inviteCard.getByRole('button', { name: 'Invite to Party', exact: true }).click()

  const invitation = target.getByRole('dialog', { name: 'Private College invitation' })
  await invitation.waitFor()
  await invitation.getByText(sourceName, { exact: true }).waitFor()
  const invitationEvidencePath = evidenceRoot ? join(evidenceRoot, 'remote-college-invitation.png') : null
  if (invitationEvidencePath) await target.screenshot({ path: invitationEvidencePath })
  await invitation.getByRole('button', { name: 'VIEW & JOIN', exact: true }).click()

  const consent = target.getByRole('dialog', { name: 'Join party consent' })
  await consent.waitFor()
  await consent.getByText(mod.name, { exact: false }).waitFor()
  await consent.getByText('CHEATS ENABLED FOR THIS COLLEGE', { exact: true }).waitFor()
  await consent.getByText('LOCAL HALL ONLY · GLOBAL SCORES OFF', { exact: true }).waitFor()
  const consentEvidencePath = evidenceRoot ? join(evidenceRoot, 'host-policy-consent.png') : null
  if (consentEvidencePath) await target.screenshot({ path: consentEvidencePath })
  await consent.getByRole('button', { name: 'DOWNLOAD & JOIN ONCE', exact: true }).click()

  await target.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 120_000,
  })
  const admitResponse = target.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/game/join/admit'
  ))
  await completeCreate(target, 'Remote Guest', 'Water')
  assert.equal((await admitResponse).status(), 201)
  await target.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 240_000 })
  assert.equal(await target.locator('.main-menu-page').getAttribute('data-session-kind'), 'private-college')
  assert.equal(await target.locator('.main-menu-page').getAttribute('data-session-cheats-enabled'), 'true')
  const targetWelcome = latestWelcome(target)
  assert.equal(targetWelcome.cheatsEnabled, true)
  assert.equal(targetWelcome.content.manifestSha256, active.manifestSha256)
  assert.deepEqual(
    targetWelcome.content.mods.map(({ id, version }) => ({ id, version })),
    active.mods.map(({ id, version }) => ({ id, version })),
  )
  const transferHealth = await waitForSupervisorHealth(health => (
    health.privateSessions === 1
    && health.privatePlayers === 2
    && health.hubPlayers === 1
  ), 'the source private College did not retire after the invited player transferred')
  await source.waitForFunction(() => (
    document.querySelectorAll('[data-native-ui-party-chip="member"]').length === 2
  ), undefined, { timeout: 30_000 })

  await source.getByRole('button', { name: 'Party settings' }).click()
  const partySettings = source.getByRole('dialog', { name: 'Party settings' })
  await partySettings.waitFor()
  assert.equal(await partySettings.getByLabel('PUBLIC').isChecked(), true)
  await partySettings.getByRole('button', { name: 'CLOSE' }).click()
  await partySettings.waitFor({ state: 'detached' })

  const directory = await waitForListedParty(sourceName)
  assert.equal(directory.sessionKind, 'private-college')
  assert.equal(directory.modCount, active.mods.length)
  assert.equal(directory.cheatsEnabled, true)
  assert.equal(directory.memberCount, 2)
  for (const secret of ['joinCode', 'credential', 'manifestSha256', 'playerReference']) {
    assert.doesNotMatch(JSON.stringify(directory), new RegExp(secret, 'i'))
  }

  const viewer = await gamePage('Directory Viewer', {
    viewport: { width: 1440, height: 900 },
  })
  await declineTutorial(viewer)
  await viewer.getByRole('button', { name: 'Explore the Dark Cloud' }).click()
  await viewer.getByRole('tab', { name: 'PARTIES', exact: true }).click()
  const listedRow = viewer.locator(`[data-party-id="${directory.id}"]`)
  await listedRow.waitFor()
  for (const text of [
    'PRIVATE COLLEGE',
    `MODDED · ${active.mods.length}`,
    'CHEATS',
    '2 / 16',
  ]) await listedRow.getByText(text, { exact: true }).waitFor()
  const directoryEvidencePath = evidenceRoot ? join(evidenceRoot, 'dark-cloud-private-party.png') : null
  if (directoryEvidencePath) await viewer.screenshot({ path: directoryEvidencePath })

  assert.deepEqual({ consoleErrors, failedResponses, pageErrors, requestFailures }, {
    consoleErrors: [],
    failedResponses: [],
    pageErrors: [],
    requestFailures: [],
  })
  await closeContext(source.context())
  await closeContext(target.context())
  await closeContext(resident.context())
  const finalHealth = await waitForEmptyHealth()
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    activeManifestSha256: active.manifestSha256,
    cheatPolicy: true,
    directory,
    finalHealth,
    messageReceipt,
    initialHealth,
    sessionKinds: {
      resident: 'global-hub',
      source: 'private-college',
      targetAfterJoin: 'private-college',
      targetBeforeJoin: 'private-college',
    },
    targetWelcome: {
      cheatsEnabled: targetWelcome.cheatsEnabled,
      manifestSha256: targetWelcome.content.manifestSha256,
      mods: targetWelcome.content.mods.map(({ id, version }) => ({ id, version })),
    },
    transferHealth,
    screenshots: {
      card: cardEvidencePath,
      consent: consentEvidencePath,
      directory: directoryEvidencePath,
      invitation: invitationEvidencePath,
    },
    consoleErrors,
    failedResponses,
    pageErrors,
    requestFailures,
  })}\n`)
} finally {
  await fetch(`${baseUrl}/api/mods/${encodeURIComponent(mod.slug)}/subscription`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  }).catch(() => {})
  for (const context of contexts.splice(0)) await context.close()
  await browser.close()
}

async function gamePage(label, { settings, token: accountToken, viewport }) {
  const context = await browser.newContext({ viewport })
  contexts.push(context)
  if (gatewayUrl && publicWebSocketOrigin) {
    await context.addInitScript(({ gateway, publicOrigin }) => {
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
  await context.addInitScript(installGameAudioSmokeProbe)
  await context.addInitScript(({ accountToken, settings }) => {
    if (accountToken) localStorage.setItem('sdr.token', accountToken)
    if (settings) {
      localStorage.setItem('solomon-dark-game-settings-v1', JSON.stringify({
        cameraFovPercent: 100,
        castSecondariesAtMouse: true,
        complexLighting: true,
        complexShadows: true,
        controls: {
          belt1: 'Mouse2', belt2: 'Digit1', belt3: 'Digit2', belt4: 'Digit3',
          belt5: 'Digit4', belt6: 'Digit5', belt7: 'Digit6', belt8: 'Digit7',
          moveDown: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD', moveUp: 'KeyW',
          openChat: 'KeyT', openInventory: 'KeyI', openMenu: 'Escape', openSkills: 'KeyK',
        },
        enableActivityMessages: true,
        enableCheats: settings.enableCheats === true,
        enableGlobalChat: true,
        enableOnlineFeatures: true,
        enableSharedHub: settings.enableSharedHub !== false,
        lightQualityPercent: 100,
        multipleShadows: true,
        musicVolumePercent: 100,
        soundVolumePercent: 100,
        submitRunsToServer: true,
        uiScalePercent: 100,
        zoomEffects: true,
      }))
    }
  }, { accountToken, settings })
  const page = await context.newPage()
  const welcomes = []
  welcomeReceipts.set(page, welcomes)
  page.on('pageerror', error => pageErrors.push(`${label}: ${error.message}`))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(`${label}: ${message.text()}`)
  })
  page.on('response', response => {
    if (response.status() >= 400) {
      failedResponses.push(`${label}: ${response.status()} ${response.url()}`)
    }
  })
  page.on('requestfailed', request => {
    const failure = request.failure()?.errorText ?? 'unknown failure'
    if (failure !== 'net::ERR_ABORTED') {
      requestFailures.push(`${label}: ${failure} ${request.url()}`)
    }
  })
  page.on('websocket', socket => {
    socket.on('framereceived', ({ payload }) => {
      const text = typeof payload === 'string' ? payload : payload.toString('utf8')
      if (!text.includes('"server-welcome"')) return
      try {
        const message = JSON.parse(text)
        if (message?.type === 'server-welcome' && message.observer !== true) {
          welcomes.push(message)
        }
      } catch {
        // The production protocol decoder remains the authority for malformed frames.
      }
    })
  })
  await page.route('**/deployment.json*', route => {
    const revision = new URL(route.request().url()).searchParams.get('current') ?? 'local'
    return route.fulfill({ json: { revision } })
  })
  await page.goto(`${baseUrl}/game`, { timeout: 240_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 240_000 })
  return page
}

async function sendChat(page, channel, message) {
  const chat = page.getByLabel('Game chat')
  if (await chat.getAttribute('data-chat-open') !== 'true') {
    await page.keyboard.press('t')
    await chat.locator('xpath=self::*[@data-chat-open="true"]').waitFor()
  }
  if (await chat.getAttribute('data-chat-channel') !== channel) {
    await chat.getByRole('tab', { name: new RegExp(`^${channel}`, 'i') }).click()
    await chat.locator(`xpath=self::*[@data-chat-channel="${channel}"]`).waitFor()
  }
  const input = chat.getByRole('textbox', { name: 'Chat message' })
  await input.fill(message)
  await input.press('Enter')
  await chat.locator('xpath=self::*[@data-chat-open="false"]').waitFor()
}

function latestWelcome(page) {
  const welcome = welcomeReceipts.get(page)?.at(-1)
  assert.ok(welcome, 'the browser did not observe an authoritative player welcome')
  return welcome
}

async function waitForChatMessage(page, channel, message) {
  const receipt = page.getByLabel('Game chat').locator(
    `[data-message-channel="${channel}"]`,
    { hasText: message },
  )
  await receipt.waitFor()
  return receipt
}

async function enterGame(page, { displayName, element, expectedAdmissionPath, local }) {
  await declineTutorial(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  if (local) {
    const localPrompt = page.getByRole('dialog', { name: 'Local play is active' })
    await localPrompt.waitFor()
    await localPrompt.getByText('CHEATS ENABLED', { exact: true }).waitFor()
    await localPrompt.getByRole('button', { name: 'CONTINUE LOCAL', exact: true }).click()
  }
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 120_000 })
  const admission = page.waitForResponse(response => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === expectedAdmissionPath
  ))
  await completeCreate(page, displayName, element)
  assert.ok([200, 201].includes((await admission).status()))
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 240_000 })
}

async function completeCreate(page, displayName, element) {
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(displayName)
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
}

async function declineTutorial(page) {
  const prompt = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await prompt.isVisible()) {
    await prompt.getByRole('button', { name: 'NO', exact: true }).click()
    await prompt.waitFor({ state: 'detached' })
  }
}

async function waitForListedParty(leader) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const result = await api('/api/game/parties')
    const party = result.items.find(item => item.leader === leader)
    if (party) return party
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`timed out waiting for ${leader}'s public party`)
}

async function enableFirstPlayableMod(accountToken) {
  const catalog = await api('/api/mods?page=1&pageSize=50')
  for (const candidate of catalog.items) {
    await api(`/api/mods/${encodeURIComponent(candidate.slug)}/subscription`, {
      method: 'PUT',
      token: accountToken,
    }, [200, 201])
    const active = await api('/api/mods/active', { token: accountToken })
    const enabled = active.mods.find(item => item.slug === candidate.slug)
    if (enabled) return enabled
    await fetch(`${baseUrl}/api/mods/${encodeURIComponent(candidate.slug)}/subscription`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accountToken}` },
    })
  }
  throw new Error('the Library contains no playable web mod')
}

async function api(path, options = {}, expectedStatus = 200) {
  const headers = new Headers({ accept: 'application/json' })
  if (options.token) headers.set('authorization', `Bearer ${options.token}`)
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  const body = await response.json().catch(() => null)
  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]
  assert.ok(expected.includes(response.status), JSON.stringify(body))
  return body
}

async function closeContext(context) {
  const index = contexts.indexOf(context)
  if (index >= 0) contexts.splice(index, 1)
  await context.close()
}

async function supervisorHealth() {
  if (!gatewayUrl) return null
  const url = new URL('/health', gatewayUrl)
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  const response = await fetch(url)
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  return body
}

async function waitForEmptyHealth() {
  return waitForSupervisorHealth(health => (
    health.sessions === 0
    && health.privateSessions === 0
    && health.hubPlayers === 0
    && health.runs === 0
  ), 'private College social smoke did not release every game session')
}

async function waitForSupervisorHealth(predicate, failureMessage) {
  if (!gatewayUrl) return null
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const health = await supervisorHealth()
    if (predicate(health)) return health
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(failureMessage)
}

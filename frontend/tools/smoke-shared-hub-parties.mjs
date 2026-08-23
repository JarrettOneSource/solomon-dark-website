import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'

const baseUrl = process.env.SDR_SHARED_HUB_SMOKE_URL || 'http://127.0.0.1:5173'
const gatewayUrl = process.env.SDR_SHARED_HUB_GATEWAY_URL?.trim()
const publicWebSocketOrigin = process.env.SDR_SHARED_HUB_PUBLIC_ORIGIN?.trim()
const pointerMode = process.env.SDR_SHARED_HUB_POINTER_MODE?.trim() || 'mobile'
const evidenceRoot = process.env.SDR_SHARED_HUB_EVIDENCE_DIR?.trim()
if (Boolean(gatewayUrl) !== Boolean(publicWebSocketOrigin)) {
  throw new Error('SDR_SHARED_HUB_GATEWAY_URL and SDR_SHARED_HUB_PUBLIC_ORIGIN must be set together')
}
if (pointerMode !== 'desktop' && pointerMode !== 'mobile') {
  throw new Error('SDR_SHARED_HUB_POINTER_MODE must be desktop or mobile')
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const contexts = []
const rawClients = []
const pageErrors = []
const consoleErrors = []

try {
  if (evidenceRoot) await mkdir(evidenceRoot, { recursive: true })
  const host = await enterRawHub('Basil', 'earth')
  const hostBefore = await host.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
  ), 'host Hub snapshot')
  const hostX = hostBefore.frame.players[host.playerId].position.x
  host.sendInput(hostBefore.frame.tick + 1, 1, { x: 1, y: 0 })
  const hostMoved = await host.next((message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.players[host.playerId]?.position.x > hostX + 80
  ), 'host displacement')
  host.sendInput(hostMoved.frame.tick + 1, 2, { x: 0, y: 0 })

  const first = await enterHub('Aurelia', 'Fire', pointerMode === 'mobile'
    ? { width: 844, height: 390, hasTouch: true, useTouch: true }
    : { width: 1600, height: 900, useTouch: false })
  await waitForPlayers(first.page, 2)
  const chat = first.page.getByLabel('Game chat')
  await first.page.keyboard.press('t')
  await chat.locator('xpath=self::*[@data-chat-open="true"]').waitFor()
  assert.equal(await chat.getAttribute('data-chat-channel'), 'global')
  assert.equal(await chat.getAttribute('data-chat-channels'), 'global')
  const singletonChatInput = chat.getByRole('textbox', { name: 'Chat message' })
  await singletonChatInput.press('Tab')
  assert.equal(await chat.getAttribute('data-chat-channel'), 'global')
  assert.equal(
    await singletonChatInput.evaluate(node => document.activeElement === node),
    true,
  )
  const chatSingletonTabEvidencePath = evidenceRoot
    ? join(evidenceRoot, 'chat-hub-singleton-tab.png')
    : null
  if (chatSingletonTabEvidencePath) {
    await first.page.screenshot({ path: chatSingletonTabEvidencePath })
  }
  await singletonChatInput.press('Escape')
  await chat.locator('xpath=self::*[@data-chat-open="false"]').waitFor()

  await first.page.getByRole('button', { name: 'Party settings' }).click()
  const partySettings = first.page.getByRole('dialog', { name: 'Party settings' })
  await partySettings.waitFor()
  const initialPartyId = await partySettings.locator('code').innerText()
  assert.match(initialPartyId, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/)
  await partySettings.getByLabel('PUBLIC').click()
  await first.page.waitForFunction(() => (
    document.querySelector('input[name="party-visibility"]:checked')
      ?.parentElement?.textContent?.trim() === 'PUBLIC'
  ))
  await partySettings.getByRole('button', { name: 'REGENERATE' }).click()
  await first.page.waitForFunction(initial => (
    document.querySelector('.party-settings-code code')?.textContent !== initial
  ), initialPartyId)
  assert.notEqual(await partySettings.locator('code').innerText(), initialPartyId)
  await partySettings.getByRole('button', { name: 'CLOSE' }).click()
  await partySettings.waitFor({ state: 'detached' })

  host.invitePlayer(first.playerId)
  const invitation = first.page.locator('[data-party-invitation]')
  await invitation.waitFor()
  assert.match(await invitation.innerText(), /Basil invited you/)
  const invitationEvidencePath = evidenceRoot ? join(evidenceRoot, 'party-invitation-deny.png') : null
  if (invitationEvidencePath) await first.page.screenshot({ path: invitationEvidencePath })
  await invitation.getByRole('button', { name: 'Deny' }).click()
  await invitation.waitFor({ state: 'detached' })
  assert.equal(await first.page.locator('[data-party-member]').count(), 1)

  host.invitePlayer(first.playerId)
  await invitation.waitFor()
  await invitation.getByRole('button', { name: 'Accept' }).click()
  await waitForPartySize(first.page, 2)
  const hubEvidencePath = evidenceRoot ? join(evidenceRoot, 'hub-nameplates.png') : null
  if (hubEvidencePath) await first.page.screenshot({ path: hubEvidencePath })

  const member = await enterRawHub('Cassia', 'water')
  await waitForPlayers(first.page, 3)
  host.invitePlayer(member.playerId)
  const memberInvitation = await member.next((message) => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ), 'member invitation')
  assert.equal(memberInvitation.state.invitations[0].inviter.displayName, 'Basil')
  member.acceptInvitation(memberInvitation.state.invitations[0].id)
  await waitForPartySize(first.page, 3)

  const outsider = await enterRawHub('Daria', 'air')
  await waitForPlayers(first.page, 4)
  const outsiderParty = await outsider.next((message) => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 1
  ), 'outsider singleton party')
  assert.equal(outsiderParty.state.party.leaderPlayerId, outsider.playerId)

  const hostMessageCountBeforeWhisper = host.chatMessages.length
  const memberMessageCountBeforeWhisper = member.chatMessages.length
  await activatePlayer(first, outsider.playerId)
  const outsiderProfile = first.page.getByRole('dialog', { name: 'Daria' })
  await outsiderProfile.waitFor()
  await outsiderProfile.getByText('Guest wizard', { exact: true }).waitFor()
  const outsiderWhisper = outsider.next((message) => (
    message.type === 'server-chat' && message.text === 'Aurelia private hello'
  ), 'outsider Whisper')
  await outsiderProfile.getByRole('button', { name: 'Message', exact: true }).click()
  await chat.locator('xpath=self::*[@data-chat-open="true"]').waitFor()
  assert.equal(await chat.getAttribute('data-chat-channel'), 'whisper')
  assert.equal(await chat.getAttribute('data-chat-channels'), 'party,global,whisper')
  assert.equal(await chat.getAttribute('data-whisper-target'), outsider.playerId)
  const whisperInput = chat.getByRole('textbox', { name: 'Chat message' })
  await whisperInput.fill('Aurelia private hello')
  await whisperInput.press('Enter')
  const whisperMessage = await outsiderWhisper
  assert.equal(whisperMessage.channel, 'whisper')
  assert.deepEqual(whisperMessage.sender, {
    displayName: 'Aurelia',
    playerId: first.playerId,
  })
  assert.deepEqual(whisperMessage.recipient, {
    displayName: 'Daria',
    playerId: outsider.playerId,
  })
  await chat.locator('[data-message-channel="whisper"]', {
    hasText: 'Aurelia private hello',
  }).waitFor()
  await first.page.waitForTimeout(100)
  assert.equal(host.chatMessages.length, hostMessageCountBeforeWhisper)
  assert.equal(member.chatMessages.length, memberMessageCountBeforeWhisper)

  outsider.sendChat('whisper', 'Daria private reply', first.playerId)
  await chat.locator('[data-message-channel="whisper"]', {
    hasText: 'Daria private reply',
  }).waitFor()
  assert.equal(await chat.getAttribute('data-whisper-target'), outsider.playerId)
  const chatWhisperEvidencePath = evidenceRoot
    ? join(evidenceRoot, 'chat-hub-whisper.png')
    : null
  if (chatWhisperEvidencePath) await first.page.screenshot({ path: chatWhisperEvidencePath })
  await whisperInput.press('Tab')
  assert.equal(await chat.getAttribute('data-chat-channel'), 'party')
  await whisperInput.press('Escape')

  await first.page.keyboard.press('t')
  await chat.locator('xpath=self::*[@data-chat-open="true"]').waitFor()
  assert.equal(await chat.getAttribute('data-chat-channel'), 'party')
  assert.equal(await chat.getAttribute('data-chat-channels'), 'party,global,whisper')
  // GameChat renders data-chat-open in the commit that opens it, but the Hub
  // only learns about it through GameChat's onOpenChange effect one commit
  // later, so wait for the gameplay gate instead of reading it in the same tick.
  await first.page.locator('.hub-scene[data-gameplay-input-blocked="true"]').waitFor({
    timeout: 5_000,
  })
  const chatInput = chat.getByRole('textbox', { name: 'Chat message' })
  await waitForRest(first.page)
  const frameBeforeTyping = await frame(first.page)
  const positionBeforeTyping = { x: frameBeforeTyping.playerX, y: frameBeforeTyping.playerY }
  await chatInput.fill('wasd')
  await first.page.waitForTimeout(150)
  const frameAfterTyping = await frame(first.page)
  const positionAfterTyping = { x: frameAfterTyping.playerX, y: frameAfterTyping.playerY }
  // Hub reconciliation may nudge an idle wizard by a sub-pixel amount; a leaked
  // WASD walk covers many pixels in 150 ms, so only that scale is a failure.
  const typingDrift = Math.hypot(
    positionAfterTyping.x - positionBeforeTyping.x,
    positionAfterTyping.y - positionBeforeTyping.y,
  )
  assert.ok(typingDrift < 2, `typing in chat moved the wizard ${typingDrift}px`)

  const hostPartyChat = host.next((message) => (
    message.type === 'server-chat' && message.text === 'Aurelia party hello'
  ), 'host party chat')
  const memberPartyChat = member.next((message) => (
    message.type === 'server-chat' && message.text === 'Aurelia party hello'
  ), 'member party chat')
  await chatInput.fill('Aurelia party hello')
  await chatInput.press('Enter')
  const [hostPartyMessage, memberPartyMessage] = await Promise.all([
    hostPartyChat,
    memberPartyChat,
  ])
  assert.equal(hostPartyMessage.channel, 'party')
  assert.equal(memberPartyMessage.sender.playerId, first.playerId)
  await chat.locator('[data-message-channel="party"]', {
    hasText: 'Aurelia party hello',
  }).waitFor()
  await first.page.waitForTimeout(100)
  assert.equal(
    outsider.chatMessages.some(message => message.text === 'Aurelia party hello'),
    false,
  )

  await chatInput.press('Tab')
  assert.equal(await chat.getAttribute('data-chat-channel'), 'global')
  const hostGlobalChat = host.next((message) => (
    message.type === 'server-chat' && message.text === 'Aurelia global hello'
  ), 'host global chat')
  const memberGlobalChat = member.next((message) => (
    message.type === 'server-chat' && message.text === 'Aurelia global hello'
  ), 'member global chat')
  const outsiderGlobalChat = outsider.next((message) => (
    message.type === 'server-chat' && message.text === 'Aurelia global hello'
  ), 'outsider global chat')
  await chatInput.fill('Aurelia global hello')
  await chatInput.press('Enter')
  const globalChatMessages = await Promise.all([
    hostGlobalChat,
    memberGlobalChat,
    outsiderGlobalChat,
  ])
  assert.equal(new Set(globalChatMessages.map(message => message.sequence)).size, 1)
  assert.equal(globalChatMessages.every(message => message.channel === 'global'), true)

  const hostReply = 'Basil global reply'
  host.sendChat('global', hostReply)
  await chat.locator('[data-message-channel="global"]', { hasText: hostReply }).waitFor()
  const chatHubEvidencePath = evidenceRoot ? join(evidenceRoot, 'chat-hub-global.png') : null
  if (chatHubEvidencePath) await first.page.screenshot({ path: chatHubEvidencePath })
  await chatInput.press('Escape')
  await chat.locator('xpath=self::*[@data-chat-open="false"]').waitFor()
  await chat.locator('xpath=self::*[@data-chat-faded="true"]').waitFor({ timeout: 7_000 })
  await first.page.waitForTimeout(700)
  const fadedOpacity = Number(await chat.locator('.game-chat-panel').evaluate(node => (
    getComputedStyle(node).opacity
  )))
  assert.ok(fadedOpacity <= 0.05, `chat faded opacity remained ${fadedOpacity}`)
  outsider.sendChat('global', 'Daria wakes the chat')
  await chat.locator('[data-message-channel="global"]', {
    hasText: 'Daria wakes the chat',
  }).waitFor()
  assert.equal(await chat.getAttribute('data-chat-faded'), 'false')

  const outsiderHub = outsider.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
  ), 'outsider Hub snapshot')
  const firstBoneyard = first.page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const hostLoaded = host.next(
    (message) => message.type === 'server-boneyard-loaded',
    'host Boneyard materialization',
  )
  const memberLoaded = member.next(
    (message) => message.type === 'server-boneyard-loaded',
    'member Boneyard materialization',
  )
  host.startMatch('default-random')
  await firstBoneyard.waitFor({ timeout: 240_000 })
  const [hostRun, memberRun] = await Promise.all([hostLoaded, memberLoaded])
  const firstRunId = await firstBoneyard.getAttribute('data-run-id')
  assert.ok(firstRunId)
  assert.equal(hostRun.boneyard.runId, firstRunId)
  assert.equal(memberRun.boneyard.runId, firstRunId)
  const hostBoneyard = await host.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'boneyard'
  ), 'host Boneyard snapshot')
  const memberBoneyard = await member.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'boneyard'
  ), 'member Boneyard snapshot')
  const hostRunX = hostBoneyard.frame.players[host.playerId].position.x
  const memberRunX = memberBoneyard.frame.players[member.playerId].position.x
  host.sendInput(hostBoneyard.frame.tick + 1, 3, { x: -1, y: 0 })
  member.sendInput(memberBoneyard.frame.tick + 1, 1, { x: 1, y: 0 })
  const hostSeparated = await host.next((message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'boneyard'
    && message.frame.players[host.playerId]?.position.x < hostRunX - 60
  ), 'host Boneyard separation')
  const memberSeparated = await member.next((message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'boneyard'
    && message.frame.players[member.playerId]?.position.x > memberRunX + 60
  ), 'member Boneyard separation')
  host.sendInput(hostSeparated.frame.tick + 1, 4, { x: 0, y: 0 })
  member.sendInput(memberSeparated.frame.tick + 1, 2, { x: 0, y: 0 })
  await first.page.waitForTimeout(250)
  const boneyardLighting = await firstBoneyard.evaluate((scene) => {
    const canvas = scene.querySelector('.boneyard-environment-light')
    if (!(canvas instanceof HTMLCanvasElement)) {
      return {
        environmentMode: Number(scene.dataset.environmentMode),
        maximumAlpha: 0,
        nonzeroPixels: 0,
        present: false,
      }
    }
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let maximumAlpha = 0
    let nonzeroPixels = 0
    for (let index = 3; index < pixels.length; index += 4) {
      const alpha = pixels[index]
      if (alpha > 0) nonzeroPixels += 1
      if (alpha > maximumAlpha) maximumAlpha = alpha
    }
    return {
      environmentMode: Number(scene.dataset.environmentMode),
      maximumAlpha,
      nonzeroPixels,
      present: true,
    }
  })
  const boneyardEvidencePath = evidenceRoot ? join(evidenceRoot, 'boneyard-nameplates.png') : null
  if (boneyardLighting.present) {
    assert.ok(
      boneyardLighting.maximumAlpha <= 28,
      `overlapping direct player light reached alpha ${boneyardLighting.maximumAlpha}`,
    )
  }
  if (boneyardEvidencePath) await first.page.screenshot({ path: boneyardEvidencePath })
  const boneyardWithoutDirectLightPath = evidenceRoot && boneyardLighting.present
    ? join(evidenceRoot, 'boneyard-without-direct-player-light.png')
    : null
  if (boneyardWithoutDirectLightPath) {
    await first.page.locator('.boneyard-environment-light').evaluate((canvas) => {
      canvas.style.visibility = 'hidden'
    })
    await first.page.screenshot({ path: boneyardWithoutDirectLightPath })
    await first.page.locator('.boneyard-environment-light').evaluate((canvas) => {
      canvas.style.visibility = ''
    })
  }

  await first.page.keyboard.press('t')
  await chat.locator('xpath=self::*[@data-chat-open="true"]').waitFor()
  assert.equal(await chat.getAttribute('data-chat-channel'), 'party')
  assert.equal(await chat.getAttribute('data-chat-channels'), 'party,whisper')
  await firstBoneyard.locator('xpath=self::*[@data-gameplay-input-blocked="true"]').waitFor({
    timeout: 5_000,
  })
  const runChatInput = chat.getByRole('textbox', { name: 'Chat message' })
  const hostRunChat = host.next((message) => (
    message.type === 'server-chat' && message.text === 'Party run hello'
  ), 'host run chat')
  const memberRunChat = member.next((message) => (
    message.type === 'server-chat' && message.text === 'Party run hello'
  ), 'member run chat')
  const outsiderMessageCountBeforeRunChat = outsider.chatMessages.length
  await runChatInput.fill('Party run hello')
  await runChatInput.press('Enter')
  await Promise.all([hostRunChat, memberRunChat])
  await first.page.waitForTimeout(100)
  assert.equal(outsider.chatMessages.length, outsiderMessageCountBeforeRunChat)
  await runChatInput.press('Tab')
  assert.equal(await chat.getAttribute('data-chat-channel'), 'whisper')
  await runChatInput.press('Tab')
  assert.equal(await chat.getAttribute('data-chat-channel'), 'party')
  const chatBoneyardEvidencePath = evidenceRoot
    ? join(evidenceRoot, 'chat-boneyard-party.png')
    : null
  if (chatBoneyardEvidencePath) await first.page.screenshot({ path: chatBoneyardEvidencePath })
  await runChatInput.press('Escape')

  const outsiderBefore = await outsiderHub
  const outsiderX = outsiderBefore.frame.players[outsider.playerId].position.x
  outsider.sendInput(outsiderBefore.frame.tick + 1, 1, { x: 1, y: 0 })
  const outsiderAfter = await outsider.next((message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.players[outsider.playerId]?.position.x > outsiderX + 15
  ), 'outsider Hub movement')
  outsider.sendInput(outsiderAfter.frame.tick + 1, 2, { x: 0, y: 0 })

  const healthDuringRun = await supervisorHealth()
  if (healthDuringRun) {
    assert.equal(healthDuringRun.hubPlayers, 1)
    assert.equal(healthDuringRun.parties, 2)
    assert.equal(healthDuringRun.runs, 1)
  }
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])

  await host.close()
  await member.close()
  await outsider.close()
  for (const context of contexts.splice(0)) await context.close()
  const finalHealth = await waitForEmptyHealth()
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    pointerMode,
    partyLeaderPlayerId: host.playerId,
    browserPartyMemberPlayerId: first.playerId,
    secondPartyMemberPlayerId: member.playerId,
    remainingHubPlayerId: outsider.playerId,
    runId: firstRunId,
    hubEvidencePath,
    invitationEvidencePath,
    boneyardEvidencePath,
    boneyardLighting,
    boneyardWithoutDirectLightPath,
    chatBoneyardEvidencePath,
    chatHubEvidencePath,
    chatSingletonTabEvidencePath,
    chatWhisperEvidencePath,
    chatFadedOpacity: fadedOpacity,
    chatGlobalSequence: globalChatMessages[0].sequence,
    chatPartySequence: hostPartyMessage.sequence,
    chatWhisperSequence: whisperMessage.sequence,
    remainingHubBeforeX: outsiderX,
    remainingHubAfterX: outsiderAfter.frame.players[outsider.playerId].position.x,
    healthDuringRun,
    finalHealth,
    consoleErrors,
    pageErrors,
  })}\n`)
} finally {
  for (const client of rawClients.splice(0)) await client.close()
  for (const context of contexts.splice(0)) await context.close()
  await browser.close()
}

async function enterHub(displayName, element, viewport, existingContext) {
  const { width, height, useTouch = false, ...device } = viewport
  const context = existingContext
    ?? await browser.newContext({ viewport: { width, height }, ...device })
  if (!existingContext) contexts.push(context)
  const page = await context.newPage()
  if (existingContext) await page.setViewportSize({ width, height })
  page.on('pageerror', (error) => pageErrors.push(`${displayName}: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${displayName}: ${message.text()}`)
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
  await page.goto(`${baseUrl}/game`, {
    timeout: 240_000,
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 240_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  const admission = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/game/hub'
  ))
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(displayName)
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  assert.equal((await admission).status(), 201)
  try {
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 240_000 })
  } catch (error) {
    const rendererError = await page.locator('.hub-renderer-error').textContent().catch(() => null)
    throw new Error(
      `${displayName} Hub renderer did not become ready${rendererError ? `: ${rendererError}` : ''}`,
      { cause: error },
    )
  }
  await page.evaluate(() => {
    window.requestAnimationFrame = (callback) => window.setTimeout(
      () => callback(performance.now()),
      50,
    )
    window.cancelAnimationFrame = (handle) => window.clearTimeout(handle)
  })
  const current = await frame(page)
  return { context, page, playerId: current.localPlayerId, touch: useTouch }
}

async function activatePlayer(client, targetPlayerId) {
  const canvas = client.page.locator('.hub-world-canvas')
  const target = await canvas.evaluate((node, playerId) => ({
    logicalHeight: Number(node.dataset.viewportHeight),
    logicalWidth: Number(node.dataset.viewportWidth),
    position: structuredClone(node.__sdrHubFrame.playerScreenPositions[playerId]),
  }), targetPlayerId)
  assert.ok(target.position, `missing screen position for ${targetPlayerId}`)
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  const x = bounds.x + (target.position.x - 48) * bounds.width / target.logicalWidth
  const y = bounds.y + target.position.y * bounds.height / target.logicalHeight
  if (client.touch) await client.page.touchscreen.tap(x, y)
  else await client.page.mouse.click(x, y)
}

async function enterRawHub(displayName, element) {
  const response = await fetch(`${baseUrl}/api/game/hub`, {
    method: 'POST',
    headers: { 'x-solomon-dark-session': 'enter-hub' },
  })
  const admission = await response.json()
  assert.equal(response.status, 201, JSON.stringify(admission))
  const requested = new URL(admission.url)
  const socketUrl = gatewayUrl
    ? new URL(`${requested.pathname}${requested.search}`, gatewayUrl).toString()
    : requested.toString()
  const socket = await new Promise((resolve, reject) => {
    const connecting = new WebSocket(socketUrl, { origin: new URL(baseUrl).origin })
    connecting.once('open', () => resolve(connecting))
    connecting.once('error', reject)
  })
  const next = rawMessageQueue(socket)
  const chatMessages = []
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString())
    if (message.type === 'server-chat') chatMessages.push(message)
  })
  socket.send(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: admission.credential,
    character: { discipline: 'arcane', displayName, element },
  }))
  const welcome = await next((message) => message.type === 'server-welcome')
  const client = {
    acceptInvitation(invitationId) {
      socket.send(JSON.stringify({
        type: 'client-party-accept',
        invitationId,
      }))
    },
    denyInvitation(invitationId) {
      socket.send(JSON.stringify({
        type: 'client-party-deny',
        invitationId,
      }))
    },
    close: () => closeRawSocket(socket),
    chatMessages,
    invitePlayer(targetPlayerId) {
      socket.send(JSON.stringify({
        type: 'client-party-invite',
        targetPlayerId,
      }))
    },
    next,
    playerId: welcome.playerId,
    sendInput(targetTick, sequence, movement) {
      socket.send(JSON.stringify({
        type: 'client-input',
        input: { aim: null, cast: { primary: false, quickbar: null }, movement },
        sequence,
        targetTick,
      }))
    },
    sendChat(channel, text, targetPlayerId) {
      socket.send(JSON.stringify({
        type: 'client-chat',
        channel,
        ...(targetPlayerId === undefined ? {} : { targetPlayerId }),
        text,
      }))
    },
    startMatch(boneyardId) {
      socket.send(JSON.stringify({
        type: 'client-start-match',
        boneyardId,
      }))
    },
    socket,
  }
  rawClients.push(client)
  return client
}

function rawMessageQueue(socket) {
  const buffered = []
  const waiters = []
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString())
    if (message.type === 'server-snapshot') {
      socket.send(JSON.stringify({
        type: 'client-snapshot-ack',
        requireKeyframe: false,
        sequence: message.sequence,
      }))
    }
    const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message))
    if (waiterIndex < 0) {
      buffered.push(message)
      return
    }
    const [waiter] = waiters.splice(waiterIndex, 1)
    clearTimeout(waiter.timeout)
    waiter.resolve(message)
  })
  return (predicate, label = 'raw game message') => {
    const bufferedIndex = buffered.findIndex(predicate)
    if (bufferedIndex >= 0) return Promise.resolve(buffered.splice(bufferedIndex, 1)[0])
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), 240_000)
      waiters.push({ predicate, reject, resolve, timeout })
    })
  }
}

function closeRawSocket(socket) {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise((resolve) => {
    socket.once('close', resolve)
    socket.close(1000, 'smoke complete')
  })
}

async function frame(page) {
  return page.locator('.hub-world-canvas').evaluate((node) => (
    structuredClone(node.__sdrHubFrame)
  ))
}

async function waitForRest(page) {
  // activatePlayer() clicks the world, so a click-to-move walk may still be in
  // flight; the typing check only means something once the wizard stands still.
  await page.waitForFunction(() => {
    const node = document.querySelector('.hub-world-canvas')
    const current = node?.__sdrHubFrame
    if (!current) return false
    const previous = node.__sdrRestProbe
    if (!previous || previous.x !== current.playerX || previous.y !== current.playerY) {
      node.__sdrRestProbe = { at: performance.now(), x: current.playerX, y: current.playerY }
      return false
    }
    return performance.now() - previous.at >= 250
  }, undefined, { polling: 100, timeout: 15_000 })
}

async function waitForPlayers(page, count) {
  await page.waitForFunction((expected) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerCount === expected
  ), count, { timeout: 15_000 })
}

async function waitForPartySize(page, size) {
  await page.waitForFunction((expected) => (
    document.querySelectorAll('[data-party-member]').length === expected
  ), size, { timeout: 15_000 })
}

async function supervisorHealth() {
  if (!gatewayUrl) return null
  const url = new URL('/health', gatewayUrl)
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  const response = await fetch(url)
  const payload = await response.json()
  assert.equal(response.status, 200, JSON.stringify(payload))
  return payload
}

async function waitForEmptyHealth() {
  if (!gatewayUrl) return null
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const health = await supervisorHealth()
    if (health.sessions === 0 && health.hubPlayers === 0 && health.runs === 0) return health
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('shared Hub did not release all browser players')
}

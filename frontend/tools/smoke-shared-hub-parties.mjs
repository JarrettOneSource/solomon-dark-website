import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import { HUB_PLAYER_SELECTION_HALF_WIDTH, selectHubPlayerAtPoint } from '../src/game/hub-player-selection.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'

// stepInFront: the tapped wizard's clearance from the pile, the snapshots a
// wizard may stand still before its step counts as stopped by a wall, and the
// deadline for getting clear (the smoke runs at top level, so these sit above
// the flow that uses them)
const TAP_CLEAR_MARGIN = 12
const STILL_SNAPSHOTS = 10
const STEP_CLEAR_DEADLINE_MS = 45_000

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
const browserClients = []
const pageErrors = []
const consoleErrors = []

try {
  if (evidenceRoot) await mkdir(evidenceRoot, { recursive: true })
  const host = await enterRawHub('Basil', 'earth')
  const hostBefore = await host.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
  ), 'host Hub snapshot')
  const hostX = hostBefore.frame.players[host.playerId].position.x
  host.sendInput(hostBefore.frame.tick + 1, { x: 1, y: 0 })
  const hostMoved = await host.next((message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.players[host.playerId]?.position.x > hostX + 80
  ), 'host displacement')
  host.sendInput(hostMoved.frame.tick + 1, { x: 0, y: 0 })

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
  // the visibility radios are controlled by the host's party state: a click
  // sends client-party-settings and the dialog shows PUBLIC once the host
  // echoes server-party-state, so the read-back waits for that echo instead
  // of asserting the synchronous flip locator.check() expects (main's step
  // passes only when the echo beats Playwright's read-back)
  const publicVisibility = partySettings.getByLabel('PUBLIC')
  assert.equal(await publicVisibility.isChecked(), false, 'a fresh party starts private')
  await publicVisibility.click()
  await first.page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-label="Party settings"]')
    const label = Array.from(dialog?.querySelectorAll('label') ?? [])
      .find(candidate => candidate.textContent?.trim() === 'PUBLIC')
    return label?.querySelector('input[type="radio"]')?.checked === true
  }, undefined, { timeout: 15_000 })
  assert.equal(await publicVisibility.isChecked(), true)
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
  assert.equal(await first.page.locator('.hub-party-roster').getAttribute('data-party-size'), '1')

  host.invitePlayer(first.playerId)
  await invitation.waitFor()
  await invitation.getByRole('button', { name: 'Accept' }).click()
  await waitForPartySize(first.page, 2)
  const hubEvidencePath = evidenceRoot ? join(evidenceRoot, 'hub-nameplates.png') : null
  if (hubEvidencePath) await first.page.screenshot({ path: hubEvidencePath })

  const member = await enterRawHub('Cassia', 'water')
  await waitForPlayers(first.page, 3)
  await stepInFront(member)
  await activatePlayer(first, member.playerId)
  const memberProfile = first.page.getByRole('dialog', { name: 'Cassia' })
  await waitForProfileCard(first.page, memberProfile, 'Cassia')
  // Aurelia accepted Basil's invitation, so Basil leads the party: her card
  // for Cassia offers Message but no invite (the host rejects a member's
  // invite as not-leader, and the card hides it), and the leader invites
  await memberProfile.getByRole('button', { name: 'Message' }).waitFor()
  assert.equal(
    await memberProfile.getByRole('button', { name: 'Invite to Party' }).count(),
    0,
    'a party member who is not the leader gets no invite action',
  )
  await memberProfile.getByRole('button', { name: 'Close' }).click()
  await first.page.locator('[data-profile-player]').waitFor({ state: 'detached' })
  host.invitePlayer(member.playerId)
  const memberInvitation = await member.next((message) => (
    message.type === 'server-party-state' && message.state.invitations.length === 1
  ), 'member invitation')
  assert.equal(memberInvitation.state.invitations[0].inviter.displayName, 'Basil')
  member.acceptInvitation(memberInvitation.state.invitations[0].id)
  await waitForPartySize(first.page, 3)

  // The compact strip lists both party mates; the party sheet opens from the
  // pill and a member row opens that member's Player Card.
  await waitForAllyCount(first.page, 2)
  const partyToggle = first.page.locator('[data-party-toggle]')
  assert.equal(await partyToggle.getAttribute('aria-expanded'), 'false')
  await partyToggle.click()
  const partySheet = first.page.getByRole('dialog', { name: 'Party' })
  await partySheet.waitFor()
  assert.equal(await partySheet.locator('[data-party-member]').count(), 3)
  assert.equal(
    await partySheet.locator('[data-party-member][data-party-leader="true"]').getAttribute('data-party-member'),
    host.playerId,
  )
  const partySheetEvidencePath = evidenceRoot ? join(evidenceRoot, 'party-sheet.png') : null
  if (partySheetEvidencePath) await first.page.screenshot({ path: partySheetEvidencePath })
  await partySheet.locator(`[data-party-member="${member.playerId}"] .hub-party-member-open`).click()
  const memberCard = first.page.getByRole('dialog', { name: 'Cassia' })
  await memberCard.waitFor()
  assert.equal(await first.page.getByRole('dialog', { name: 'Party' }).count(), 0)
  const memberCardEvidencePath = evidenceRoot ? join(evidenceRoot, 'party-member-card.png') : null
  if (memberCardEvidencePath) await first.page.screenshot({ path: memberCardEvidencePath })
  await memberCard.getByRole('button', { name: 'Close' }).click()
  await first.page.locator('[data-profile-player]').waitFor({ state: 'detached' })

  // A crowd: five more wizards join through the leader's invitations, so the
  // strip folds behind "+N more", the sheet lists everyone in join order, and
  // both shrink back the moment the crowd leaves.
  const crowd = []
  for (const [name, element] of [
    ['Eamon', 'earth'], ['Fiora', 'fire'], ['Gideon', 'ether'], ['Hester', 'water'], ['Ilse', 'air'],
  ]) {
    const wizard = await enterRawHub(name, element)
    host.invitePlayer(wizard.playerId)
    const crowdInvitation = await wizard.next((message) => (
      message.type === 'server-party-state' && message.state.invitations.length === 1
    ), `${name} invitation`)
    assert.equal(crowdInvitation.state.invitations[0].inviter.displayName, 'Basil')
    wizard.acceptInvitation(crowdInvitation.state.invitations[0].id)
    crowd.push(wizard)
  }
  await waitForPlayers(first.page, 8)
  await waitForPartySize(first.page, 8)
  const allies = first.page.locator('.hub-hud-allies')
  await waitForAllyCount(first.page, 7)
  // compactPartyRosterRowLimit caps the strip at six rows with a mouse and
  // three on touch; compactPartyRosterRowsThatFit folds it further to what
  // stacks above the movement joystick, which on the 844x390 phone leaves room
  // for one row and the overflow pill (round 8d: a third row reached the
  // joystick). The last row yields to the overflow count.
  const crowdFold = pointerMode === 'mobile' ? { rows: 1, hidden: 6 } : { rows: 5, hidden: 2 }
  const moreButton = first.page.locator('.hub-party-more')
  await moreButton.waitFor()
  assert.equal(await allies.locator('.hub-hud-ally-row').count(), crowdFold.rows)
  assert.equal(await moreButton.getAttribute('data-party-hidden-count'), String(crowdFold.hidden))
  // textContent, not innerText: the touch stylesheet uppercases the label
  assert.equal((await moreButton.textContent()).trim(), `+${crowdFold.hidden} more`)
  const viewport = first.page.viewportSize()
  const compactBounds = await first.page.locator('.hub-party-compact').boundingBox()
  assert.ok(
    compactBounds.y + compactBounds.height <= viewport.height,
    `the folded strip must stay inside the viewport (${JSON.stringify(compactBounds)})`,
  )
  if (first.touch) {
    const joystickBounds = await first.page.locator('[data-joystick="movement"]').boundingBox()
    assert.equal(
      rectsOverlap(compactBounds, joystickBounds),
      false,
      'the folded strip must not reach the movement joystick',
    )
    // the fold is the joystick's doing: count the rows that stack between the
    // strip's top and 8px above the joystick from the HUD's own geometry
    const pillsBounds = await first.page.locator('.hub-party-pills').boundingBox()
    const rowBounds = await allies.locator('.hub-hud-ally-row').first().boundingBox()
    const strip = await first.page.locator('.hub-party-roster').evaluate((root) => ({
      allyGap: parseFloat(getComputedStyle(root.querySelector('.hub-hud-allies')).rowGap),
      columnGap: parseFloat(getComputedStyle(root.querySelector('.hub-party-compact')).rowGap),
      rowsFit: root.getAttribute('data-party-rows-fit'),
    }))
    const room = joystickBounds.y - 8 - compactBounds.y - pillsBounds.height - strip.columnGap
    const rowsThatFit = Math.floor((room + strip.allyGap) / (rowBounds.height + strip.allyGap))
    assert.equal(
      strip.rowsFit,
      String(rowsThatFit),
      `the strip must fold to the rows that fit above the joystick (${room}px of room, ${rowBounds.height}px rows)`,
    )
    assert.equal(
      Math.min(3, rowsThatFit) - 1,
      crowdFold.rows,
      `the phone fold must follow the joystick's room (${rowsThatFit} rows fit)`,
    )
  } else {
    const chat = first.page.locator('.game-chat')
    assert.equal(await chat.count(), 1, 'the desktop Hub shows its chat')
    assert.equal(
      rectsOverlap(compactBounds, await chat.boundingBox()),
      false,
      'the folded strip must not reach the chat',
    )
  }
  const crowdStripEvidencePath = evidenceRoot ? join(evidenceRoot, 'party-crowd-strip.png') : null
  if (crowdStripEvidencePath) await first.page.screenshot({ path: crowdStripEvidencePath })
  await moreButton.click()
  const crowdSheet = first.page.getByRole('dialog', { name: 'Party' })
  await crowdSheet.waitFor()
  const crowdMembers = crowdSheet.locator('[data-party-member]')
  assert.equal(await crowdMembers.count(), 8)
  assert.deepEqual(
    await crowdMembers.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-party-member'))),
    [host.playerId, first.playerId, member.playerId, ...crowd.map((wizard) => wizard.playerId)],
    'the sheet lists members in join order',
  )
  const sheetBounds = await crowdSheet.boundingBox()
  assert.ok(
    sheetBounds.y >= 0 && sheetBounds.y + sheetBounds.height <= viewport.height,
    `the sheet must fit the viewport (${JSON.stringify(sheetBounds)})`,
  )
  await crowdMembers.last().scrollIntoViewIfNeeded()
  const lastMemberBounds = await crowdMembers.last().boundingBox()
  assert.ok(
    lastMemberBounds.y >= sheetBounds.y
      && lastMemberBounds.y + lastMemberBounds.height <= sheetBounds.y + sheetBounds.height + 1,
    `the last member row must scroll into the sheet (${JSON.stringify(lastMemberBounds)})`,
  )
  const crowdSheetEvidencePath = evidenceRoot ? join(evidenceRoot, 'party-crowd-sheet.png') : null
  if (crowdSheetEvidencePath) await first.page.screenshot({ path: crowdSheetEvidencePath })
  await crowdSheet.getByRole('button', { name: 'Close party' }).click()
  await crowdSheet.waitFor({ state: 'detached' })
  for (const wizard of crowd) await wizard.close()
  await waitForPartySize(first.page, 3)
  await waitForPlayers(first.page, 3)
  await waitForAllyCount(first.page, 2)
  assert.equal(await moreButton.count(), 0, 'the overflow button leaves with the crowd')

  const outsider = await enterRawHub('Daria', 'air')
  await waitForPlayers(first.page, 4)
  const outsiderParty = await outsider.next((message) => (
    message.type === 'server-party-state'
    && message.state.party.memberPlayerIds.length === 1
  ), 'outsider singleton party')
  assert.equal(outsiderParty.state.party.leaderPlayerId, outsider.playerId)

  const hostMessageCountBeforeWhisper = host.chatMessages.length
  const memberMessageCountBeforeWhisper = member.chatMessages.length
  await stepInFront(outsider)
  await activatePlayer(first, outsider.playerId)
  const outsiderProfile = first.page.getByRole('dialog', { name: 'Daria' })
  await waitForProfileCard(first.page, outsiderProfile, 'Daria')
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
  host.sendInput(hostBoneyard.frame.tick + 1, { x: -1, y: 0 })
  member.sendInput(memberBoneyard.frame.tick + 1, { x: 1, y: 0 })
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
  host.sendInput(hostSeparated.frame.tick + 1, { x: 0, y: 0 })
  member.sendInput(memberSeparated.frame.tick + 1, { x: 0, y: 0 })
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
  outsider.sendInput(outsiderBefore.frame.tick + 1, { x: 1, y: 0 })
  const outsiderAfter = await outsider.next((message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.players[outsider.playerId]?.position.x > outsiderX + 15
  ), 'outsider Hub movement')
  outsider.sendInput(outsiderAfter.frame.tick + 1, { x: 0, y: 0 })

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
} catch (error) {
  await captureFailure()
  throw error
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
  // shared-Hub admission begins only behind the post-loadout loading screen:
  // New Game and the whole Create flow must not request a ticket
  const isAdmissionRequest = (request) => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/game/hub'
  )
  let earlyAdmissionRequests = 0
  const countEarlyAdmission = (request) => {
    if (isAdmissionRequest(request)) earlyAdmissionRequests += 1
  }
  page.on('request', countEarlyAdmission)
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(displayName)
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  page.off('request', countEarlyAdmission)
  assert.equal(earlyAdmissionRequests, 0, `${displayName} requested admission before the loadout`)
  const admission = page.waitForResponse((response) => isAdmissionRequest(response.request()))
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
  const client = { context, displayName, page, playerId: current.localPlayerId, touch: useTouch }
  browserClients.push(client)
  return client
}

async function activatePlayer(client, targetPlayerId) {
  const canvas = client.page.locator('.hub-world-canvas')
  const target = await canvas.evaluate((node, playerId) => ({
    logicalHeight: Number(node.dataset.viewportHeight),
    logicalWidth: Number(node.dataset.viewportWidth),
    position: structuredClone(node.__sdrHubFrame.playerScreenPositions[playerId]),
    sameRegionPlayers: Object.keys(node.__sdrHubFrame.playerScreenPositions),
    worldPositions: structuredClone(node.__sdrHubFrame.playerPositions),
  }), targetPlayerId)
  assert.ok(target.position, `missing screen position for ${targetPlayerId}`)
  // the product resolves a world tap through selectHubPlayerAtPoint (the
  // frontmost wizard whose hit box holds the point); the smoke asks the same
  // rule first so a tap that would open somebody else's card fails by name
  const sameRegion = new Set(target.sameRegionPlayers)
  const predicted = selectHubPlayerAtPoint({
    players: Object.fromEntries(Object.entries(target.worldPositions)
      .map(([playerId, position]) => [playerId, { position }])),
    world: {
      participants: Object.fromEntries(Object.keys(target.worldPositions)
        .map((playerId) => [playerId, { region: sameRegion.has(playerId) ? 'same' : 'elsewhere' }])),
    },
  }, client.playerId, target.worldPositions[targetPlayerId])
  assert.equal(
    predicted,
    targetPlayerId,
    `a tap at ${targetPlayerId}'s feet would open ${predicted}'s card instead (drawn in front); `
    + JSON.stringify(await describeHubState(client.page)),
  )
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  // the tap lands on the wizard's feet anchor; HubScene resolves it through
  // the same hit box the renderer draws, frontmost (greatest y) wizard first
  const x = bounds.x + target.position.x * bounds.width / target.logicalWidth
  const y = bounds.y + target.position.y * bounds.height / target.logicalHeight
  // the world renderer owns the pointer at that point: a HUD layer sitting
  // over the wizard would swallow the tap before the scene's capture handler
  const covering = await client.page.evaluate(([pointX, pointY]) => {
    const describe = (element) => {
      const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/) : []
      return [element.tagName.toLowerCase(), ...classes].join('.')
    }
    const stack = document.elementsFromPoint(pointX, pointY)
    return {
      onWorld: stack[0]?.closest('.hub-world-renderer') != null,
      scene: { ...document.querySelector('.hub-scene')?.dataset },
      stack: stack.slice(0, 4).map(describe),
    }
  }, [x, y])
  if (!covering.onWorld) {
    throw new Error(
      `the tap on ${targetPlayerId} at ${Math.round(x)},${Math.round(y)} is covered by `
      + `${JSON.stringify(covering.stack)}; ${JSON.stringify(await describeHubState(client.page))}`,
    )
  }
  if (client.touch) await client.page.touchscreen.tap(x, y)
  else await client.page.mouse.click(x, y)
}


// A tap at a wizard's feet opens the frontmost wizard whose selection box
// holds that point (selectHubPlayerAtPoint), so a tapped raw wizard first
// steps clear of the spawn pile: every other wizard in its region ends up
// behind it by a margin or outside the selection half-width. Walking forward
// alone runs out of floor at the courtyard's bottom wall (round 8d: Cassia
// stopped 1.4px short of the margin), so the step leaves the pile sideways as
// well, tries the flat walk each way when a wall stops it, and fails by name
// with every position when it cannot get clear.
async function stepInFront(client) {
  const wizards = (frame) => {
    const region = frame.world.participants[client.playerId]?.region
    return Object.entries(frame.players)
      .filter(([playerId]) => (
        playerId !== client.playerId && frame.world.participants[playerId]?.region === region
      ))
      .map(([playerId, player]) => ({ playerId, x: player.position.x, y: player.position.y }))
  }
  const crowding = (frame) => {
    const own = frame.players[client.playerId].position
    return wizards(frame).filter((other) => (
      Math.abs(other.x - own.x) <= HUB_PLAYER_SELECTION_HALF_WIDTH + TAP_CLEAR_MARGIN
      && other.y + TAP_CLEAR_MARGIN > own.y
    ))
  }
  let snapshot = client.latestSnapshot()?.frame.world.kind === 'hub'
    ? client.latestSnapshot()
    : await client.next((message) => (
      message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
    ), `${client.playerId}'s first Hub snapshot`)
  const pile = crowding(snapshot.frame)
  if (pile.length === 0) return
  // sideways toward the pile's nearer clear edge and forward while the floor
  // allows; then flat along the wall, either way
  const own = snapshot.frame.players[client.playerId].position
  const clearance = HUB_PLAYER_SELECTION_HALF_WIDTH + TAP_CLEAR_MARGIN + 1
  const leftEdge = Math.min(...pile.map((other) => other.x)) - clearance
  const rightEdge = Math.max(...pile.map((other) => other.x)) + clearance
  const side = own.x - leftEdge <= rightEdge - own.x ? -1 : 1
  const plans = [
    { x: side * Math.SQRT1_2, y: Math.SQRT1_2 },
    { x: side, y: 0 },
    { x: -side, y: 0 },
  ]
  let plan = 0
  let last = own
  let still = 0
  const started = Date.now()
  const fail = (message) => {
    client.sendInput(snapshot.frame.tick + 1, { x: 0, y: 0 })
    const position = snapshot.frame.players[client.playerId].position
    throw new Error(
      `${message}: ${client.playerId} at ${JSON.stringify(position)} after walking `
      + `${JSON.stringify(plans.slice(0, plan + 1))}; wizards ${JSON.stringify(wizards(snapshot.frame))}`,
    )
  }
  client.sendInput(snapshot.frame.tick + 1, plans[plan])
  for (;;) {
    const previous = snapshot
    snapshot = await client.next((message) => (
      message.type === 'server-snapshot'
      && message.sequence > previous.sequence
      && message.frame.world.kind === 'hub'
    ), `${client.playerId}'s next Hub snapshot`)
    if (crowding(snapshot.frame).length === 0) break
    const position = snapshot.frame.players[client.playerId].position
    still = Math.hypot(position.x - last.x, position.y - last.y) < 0.25 ? still + 1 : 0
    last = position
    if (still >= STILL_SNAPSHOTS) {
      plan += 1
      if (plan === plans.length) fail('a wall stops the step clear of the Hub crowd')
      still = 0
      client.sendInput(snapshot.frame.tick + 1, plans[plan])
    }
    if (Date.now() - started >= STEP_CLEAR_DEADLINE_MS) fail('the Hub crowd still covers the tapped wizard')
  }
  client.sendInput(snapshot.frame.tick + 1, { x: 0, y: 0 })
}

async function waitForProfileCard(page, card, displayName) {
  try {
    await card.waitFor({ timeout: 15_000 })
  } catch (error) {
    throw new Error(
      `the tap did not open ${displayName}'s Player Card; ${JSON.stringify(await describeHubState(page))}`,
      { cause: error },
    )
  }
}

async function enterRawHub(displayName, element) {
  // the backend's `game-sessions` policy admits six wizards per minute per
  // address; the eight-member crowd needs more than that from one machine,
  // so a raw admission waits for the next fixed window instead of failing
  let response
  let admission
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(`${baseUrl}/api/game/hub`, {
      method: 'POST',
      headers: { 'x-solomon-dark-session': 'enter-hub' },
    })
    admission = await response.json()
    if (response.status !== 429) break
    assert.ok(attempt < 16, `${displayName}: shared Hub admission stayed rate-limited for over a minute`)
    if (attempt === 0) console.error(`${displayName}: shared Hub admission rate-limited; waiting for the next window`)
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
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
  let latestSnapshot = null
  let inputSequence = 0
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString())
    if (message.type === 'server-chat') chatMessages.push(message)
    if (message.type === 'server-snapshot') latestSnapshot = message
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
    // next() hands out buffered messages oldest-first; position checks that
    // must not act on a stale frame read the latest snapshot instead
    latestSnapshot: () => latestSnapshot,
    next,
    playerId: welcome.playerId,
    sendInput(targetTick, movement) {
      inputSequence += 1
      socket.send(JSON.stringify({
        type: 'client-input',
        input: { aim: null, cast: { primary: false, quickbar: null }, movement },
        sequence: inputSequence,
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

// Everything the party strip and the world need to agree on, for failure
// messages: the strip's count and rows, the sheet's rows, how many wizards the
// world holds and how many share the viewer's region, every dialog on screen,
// and whether any surface scrolled (a scrolled scene puts wizards off-screen).
function describeHubState(page) {
  return page.evaluate(() => {
    const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
    const rows = (root) => [...root?.querySelectorAll('[data-presence]') ?? []].map((row) => ({
      member: row.getAttribute('data-party-member'),
      presence: row.getAttribute('data-presence'),
      text: row.textContent.trim().replace(/\s+/g, ' ').slice(0, 40),
    }))
    const scrollOf = (selector) => {
      const node = selector === 'document' ? document.scrollingElement : document.querySelector(selector)
      return node ? [node.scrollLeft, node.scrollTop] : null
    }
    return {
      allyCount: document.querySelector('.hub-hud-allies')?.getAttribute('data-ally-count') ?? null,
      allyRows: rows(document.querySelector('.hub-hud-allies')),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((node) => (
        node.getAttribute('aria-label')
        ?? document.getElementById(node.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()
        ?? null
      )),
      layout: Object.fromEntries(
        ['.hub-party-compact', '.hub-party-more', '[data-joystick="movement"]', '.game-chat'].map((selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect()
          return [selector, rect ? [rect.x, rect.y, rect.width, rect.height].map(Math.round) : null]
        }),
      ),
      playerPositions: frame ? structuredClone(frame.playerPositions) : null,
      partyRowsFit: document.querySelector('.hub-party-roster')?.getAttribute('data-party-rows-fit') ?? null,
      partySize: document.querySelector('.hub-party-roster')?.getAttribute('data-party-size') ?? null,
      playerCount: frame?.playerCount ?? null,
      sameRegionPlayers: frame ? Object.keys(frame.playerScreenPositions) : null,
      scene: { ...document.querySelector('.hub-scene')?.dataset },
      scroll: {
        document: scrollOf('document'),
        frame: scrollOf('.hub-native-frame'),
        scene: scrollOf('.hub-scene'),
        surface: scrollOf('.game-surface'),
      },
      sheetRows: rows(document.getElementById('hub-party-sheet')),
    }
  })
}

async function waitForAllyCount(page, count) {
  try {
    await page.locator('.hub-hud-allies').locator(`xpath=self::*[@data-ally-count="${count}"]`)
      .waitFor({ timeout: 15_000 })
  } catch (error) {
    throw new Error(
      `the strip never showed ${count} allies; ${JSON.stringify(await describeHubState(page))}`,
      { cause: error },
    )
  }
}

async function captureFailure() {
  if (!evidenceRoot) return
  for (const client of browserClients) {
    if (client.page.isClosed()) continue
    const state = await describeHubState(client.page).catch((error) => ({ error: String(error) }))
    await writeFile(join(evidenceRoot, `failure-${client.displayName}.json`), JSON.stringify(state, null, 2))
    await client.page.screenshot({ path: join(evidenceRoot, `failure-${client.displayName}.png`) })
      .catch((error) => console.error(`${client.displayName}: failure screenshot failed: ${error.message}`))
  }
}

async function waitForPlayers(page, count) {
  await page.waitForFunction((expected) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerCount === expected
  ), count, { timeout: 15_000 })
}

function rectsOverlap(first, second) {
  assert.ok(first && second, 'expected both element bounds')
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y
}

async function waitForPartySize(page, size) {
  await page.waitForFunction((expected) => (
    document.querySelector('.hub-party-roster')?.getAttribute('data-party-size') === String(expected)
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

import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import {
  MOBILE_JOYSTICK_BASE,
  MOBILE_JOYSTICK_KNOB,
  mobileQuickbarSlotPlacement,
  mobileQuickbarSlotSize,
} from '../src/game/mobile-quickbar-layout.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'

// Mobile compact-HUD journey. Boots one iPhone XR-class landscape touch page
// (896 x 414 CSS px, DPR 2 by default) through Hub solo, a party invitation,
// the party panel, the party settings dialog, a member card, open chat, and a
// party Boneyard run with both joysticks held. Every stop captures a settled
// screenshot plus a geometry receipt for each touch-HUD member, and the stops
// assert the compact layout contract recorded in
// docs/game-native-parity-re.md (2026-08-22 compact touch HUD entry): the
// 2x2 quickbar banks sit between each joystick and the centre dock without
// overlap, the dock keeps its pre-change positions, the social chrome stays
// within its compact envelopes, and the run ends with empty error arrays.
// The Hub map control is not a stop: with one catalogued Boneyard it starts
// the run directly (the picker needs two), so it stays out of this system.
const baseUrl = process.env.SDR_MOBILE_HUD_URL || 'http://127.0.0.1:5173'
const evidenceRoot = process.env.SDR_MOBILE_HUD_EVIDENCE_DIR || '/tmp/solomon-mobile-hud-compact'
const width = Number(process.env.SDR_MOBILE_HUD_WIDTH || 896)
const height = Number(process.env.SDR_MOBILE_HUD_HEIGHT || 414)
const deviceScaleFactor = Number(process.env.SDR_MOBILE_HUD_DPR || 2)
// The backend only issues wss:// admissions; a local stack rewrites them onto
// the plain supervisor socket exactly like smoke-shared-hub-parties.mjs does.
const gatewayUrl = process.env.SDR_MOBILE_HUD_GATEWAY_URL?.trim()
const publicWebSocketOrigin = process.env.SDR_MOBILE_HUD_PUBLIC_ORIGIN?.trim()
const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) '
  + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

const MEMBER_SELECTORS = Object.freeze({
  allies: '.hub-hud-allies',
  allyRows: '.hub-hud-ally-row',
  backpack: '.hub-hud-backpack-button',
  chatOpen: '.game-chat-open',
  chatPanel: '.game-chat-panel',
  countBlue: '.hub-hud-count-blue',
  countRed: '.hub-hud-count-red',
  diagnostics: '.hub-hud-diagnostics',
  help: '.hub-hud-help',
  joystickMovement: '[data-joystick="movement"]',
  joystickMovementKnob: '[data-joystick="movement"] .game-touch-joystick-knob',
  joystickPrimary: '[data-joystick="primary"]',
  joystickPrimaryKnob: '[data-joystick="primary"] .game-touch-joystick-knob',
  loadout: '.hub-hud-loadout',
  map: '.hub-hud-map',
  meterHealth: '.hub-hud-meter-health',
  meterMana: '.hub-hud-meter-mana',
  partyInvitation: '[data-party-invitation]',
  partyMembers: '.hub-party-member-open',
  partyPanel: '.hub-party-panel',
  partySettingsDialog: '.party-settings-dialog',
  partySettingsOpen: '.hub-party-settings-open',
  playerProfile: '.hub-player-profile',
  potionBlue: '.hub-hud-potion-button-blue',
  potionRed: '.hub-hud-potion-button-red',
  quickbarSlots: '.hub-hud-quickbar-slot',
  selectedSkills: '.hub-hud-selected-skill',
  skull: '.hub-hud-skull',
  tome: '.hub-hud-tome-button',
  xp: '.hub-hud-xp',
})

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const pageErrors = []
const consoleErrors = []
const rawClients = []
const receipts = {}
let page = null

try {
  await mkdir(evidenceRoot, { recursive: true })
  const context = await browser.newContext({
    deviceScaleFactor,
    hasTouch: true,
    isMobile: process.env.SDR_MOBILE_HUD_IS_MOBILE !== '0',
    userAgent: IPHONE_USER_AGENT,
    viewport: { width, height },
  })
  page = await context.newPage()
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
  if (process.env.SDR_MOBILE_HUD_TRACE === '1') {
    const traced = (url) => url.includes('/api/game/')
    page.on('request', (request) => {
      if (traced(request.url())) console.log(`→ ${request.method()} ${request.url()}`)
    })
    page.on('response', (response) => {
      if (traced(response.url())) console.log(`← ${response.status()} ${response.url()}`)
    })
    page.on('requestfailed', (request) => {
      if (traced(request.url())) console.log(`✗ ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`)
    })
  }

  const playerId = await enterHub(page, 'Aurelia', 'Water')
  const solo = await capture(page, 'hub-solo')
  assertHubLayout(solo, 'hub-solo', { primaryJoystick: false })
  assertPartyPanelEnvelope(solo, 'hub-solo', { maxHeight: 120, maxWidth: 170 })

  // Leader view of the settings dialog (invite code, requests, privacy).
  await page.locator(MEMBER_SELECTORS.partySettingsOpen).tap()
  const soloSettings = page.locator(MEMBER_SELECTORS.partySettingsDialog)
  await soloSettings.waitFor({ timeout: 10_000 })
  const soloSettingsStop = await capture(page, 'hub-solo-settings')
  assertDialogFits(soloSettingsStop.members.partySettingsDialog[0], 'hub-solo-settings', { minWidth: 300 })
  await soloSettings.getByRole('button', { name: /close/i }).click()
  await soloSettings.waitFor({ state: 'detached', timeout: 10_000 })

  const leader = await enterRawHub('Basil', 'earth')
  await leader.next((message) => (
    message.type === 'server-snapshot' && message.frame.world.kind === 'hub'
  ), 'leader Hub snapshot')
  leader.invitePlayer(playerId)
  const invitation = page.locator(MEMBER_SELECTORS.partyInvitation)
  await invitation.waitFor({ timeout: 15_000 })
  const invited = await capture(page, 'hub-invitation')
  assertHubLayout(invited, 'hub-invitation', { primaryJoystick: false })
  assertPartyPanelEnvelope(invited, 'hub-invitation', { maxHeight: 190, maxWidth: 170 })
  assert.equal(invited.members.partyInvitation.length, 1, 'hub-invitation: invitation card present')
  await invitation.getByRole('button', { name: 'Accept' }).click()
  await waitForPartySize(page, 2)
  await page.locator('.hub-hud-allies[data-ally-count="1"]').waitFor({ timeout: 15_000 })
  const party = await capture(page, 'hub-party')
  assertHubLayout(party, 'hub-party', { primaryJoystick: false })
  assertPartyPanelEnvelope(party, 'hub-party', { maxHeight: 150, maxWidth: 170 })
  assert.equal(party.members.partyMembers.length, 2, 'hub-party: two member rows')
  const allyRows = party.members.allyRows.filter((row) => row.visible)
  assert.equal(allyRows.length, 1, 'hub-party: one ally roster row')
  assertEnvelope(allyRows[0], 'hub-party ally row', { maxHeight: 27, maxWidth: 145 })
  assertOverlapFree(
    [[`allies`, party.members.allies[0]], [`partyPanel`, party.members.partyPanel[0]], [`meterHealth`, party.members.meterHealth[0]], [`meterMana`, party.members.meterMana[0]]],
    'hub-party',
  )

  await page.locator(MEMBER_SELECTORS.partySettingsOpen).tap()
  const settings = page.locator(MEMBER_SELECTORS.partySettingsDialog)
  await settings.waitFor({ timeout: 10_000 })
  const settingsStop = await capture(page, 'hub-party-settings')
  assertDialogFits(settingsStop.members.partySettingsDialog[0], 'hub-party-settings', { minWidth: 300 })
  await settings.getByRole('button', { name: /close/i }).click()
  await settings.waitFor({ state: 'detached', timeout: 10_000 })

  await page.locator(MEMBER_SELECTORS.partyMembers).first().tap()
  const profile = page.locator(MEMBER_SELECTORS.playerProfile)
  await profile.waitFor({ timeout: 10_000 })
  const cardStop = await capture(page, 'hub-player-card')
  const card = cardStop.members.playerProfile[0]
  assert.ok(card?.visible, 'hub-player-card: card visible')
  assertEnvelope(card, 'hub-player-card card', { maxHeight: 270, maxWidth: 320 })
  assert.ok(card.x >= 0 && card.y >= 0 && card.x + card.width <= width && card.y + card.height <= height,
    `hub-player-card: card inside the viewport ${JSON.stringify(card)}`)
  await profile.locator('.hub-player-profile-close').click()
  await profile.waitFor({ state: 'detached', timeout: 10_000 })

  await page.locator(MEMBER_SELECTORS.chatOpen).tap()
  await page.locator('.game-chat[data-chat-open="true"]').waitFor({ timeout: 10_000 })
  const chatStop = await capture(page, 'hub-chat-open')
  assert.ok(chatStop.members.chatPanel[0]?.visible, 'hub-chat-open: chat panel visible')
  await page.locator('.game-chat-close').click()
  await page.locator('.game-chat[data-chat-open="false"]').waitFor({ timeout: 10_000 })

  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const leaderLoaded = leader.next(
    (message) => message.type === 'server-boneyard-loaded',
    'leader Boneyard materialization',
  )
  leader.startMatch('default-random')
  await boneyard.waitFor({ timeout: 240_000 })
  await leaderLoaded
  await page.locator(MEMBER_SELECTORS.joystickPrimary).waitFor({ timeout: 15_000 })
  const runIdle = await capture(page, 'run-idle')
  assertHubLayout(runIdle, 'run-idle', { primaryJoystick: true })

  const cdp = await context.newCDPSession(page)
  const movement = rectCenter(await page.locator(MEMBER_SELECTORS.joystickMovement).boundingBox())
  const primary = rectCenter(await page.locator(MEMBER_SELECTORS.joystickPrimary).boundingBox())
  const movementBounds = await page.locator(MEMBER_SELECTORS.joystickMovement).boundingBox()
  const reach = movementBounds.width * 0.3
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 11, x: movement.x, y: movement.y },
      { id: 22, x: primary.x, y: primary.y },
    ],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { id: 11, x: movement.x + reach, y: movement.y - reach * 0.4 },
      { id: 22, x: primary.x + reach, y: primary.y },
    ],
  })
  const runHeld = await capture(page, 'run-held')
  const heldKnob = rectCenter(runHeld.members.joystickMovementKnob[0])
  assert.ok(heldKnob.x > movement.x + reach * 0.5, `run-held: movement knob deflected (${heldKnob.x} vs base ${movement.x})`)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const runReleased = await capture(page, 'run-released')
  const releasedKnob = rectCenter(runReleased.members.joystickMovementKnob[0])
  assert.ok(Math.abs(releasedKnob.x - movement.x) < 1 && Math.abs(releasedKnob.y - movement.y) < 1,
    `run-released: movement knob recentred (${releasedKnob.x}, ${releasedKnob.y}) vs (${movement.x}, ${movement.y})`)
  assertHubLayout(runReleased, 'run-released', { primaryJoystick: true })

  receipts.errors = { consoleErrors, pageErrors }
  receipts.layoutContract = layoutContract()
  receipts.viewport = { deviceScaleFactor, height, width }
  await writeFile(join(evidenceRoot, 'receipt.json'), `${JSON.stringify(receipts, null, 2)}\n`)
  console.log(`mobile compact HUD journey captured ${Object.keys(receipts).length - 3} stops under ${evidenceRoot}`)
  if (process.env.SDR_MOBILE_HUD_ALLOW_ERRORS !== '1') {
    assert.deepEqual(pageErrors, [], 'page errors')
    assert.deepEqual(consoleErrors, [], 'console errors')
  }
} catch (error) {
  if (page) await page.screenshot({ path: join(evidenceRoot, 'failure.png') }).catch(() => {})
  await writeFile(join(evidenceRoot, 'failure.json'), `${JSON.stringify({
    consoleErrors,
    error: error instanceof Error ? error.message : String(error),
    pageErrors,
    stops: Object.keys(receipts),
  }, null, 2)}\n`).catch(() => {})
  throw error
} finally {
  for (const client of rawClients) client.close()
  await browser.close()
}

async function capture(page, label) {
  const geometry = await settledGeometry(page)
  await page.screenshot({ path: join(evidenceRoot, `${label}.png`) })
  receipts[label] = geometry
  return geometry
}

async function settledGeometry(page) {
  let previous = ''
  let stable = 0
  let geometry = null
  for (let sample = 0; sample < 120; sample += 1) {
    geometry = await readGeometry(page)
    const key = JSON.stringify(geometry)
    stable = key === previous ? stable + 1 : 0
    previous = key
    if (stable >= 6) return geometry
    await page.waitForTimeout(50)
  }
  assert.fail('HUD geometry never settled')
}

function readGeometry(page) {
  return page.evaluate((selectors) => {
    const round = (value) => Math.round(value * 100) / 100
    const members = {}
    for (const [name, selector] of Object.entries(selectors)) {
      members[name] = [...document.querySelectorAll(selector)].map((node) => {
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const entry = {
          height: round(rect.height),
          visible: rect.width > 0 && rect.height > 0
            && style.display !== 'none' && style.visibility !== 'hidden'
            && Number(style.opacity) > 0,
          width: round(rect.width),
          x: round(rect.x),
          y: round(rect.y),
        }
        const slot = node.getAttribute('data-slot')
        if (slot !== null) entry.slot = Number(slot)
        const bank = node.getAttribute('data-quickbar-bank')
        if (bank !== null) entry.bank = bank
        return entry
      })
    }
    const frame = document.querySelector('.hub-native-frame, .boneyard-native-frame')
    const hud = document.querySelector('.hub-hud')
    return {
      displayScale: frame ? getComputedStyle(frame).getPropertyValue('--hud-display-scale').trim() : null,
      members,
      uiScale: hud ? getComputedStyle(hud).getPropertyValue('--game-ui-scale').trim() : null,
      window: { height: window.innerHeight, width: window.innerWidth },
    }
  }, MEMBER_SELECTORS)
}

function rectCenter(rect) {
  assert.ok(rect, 'expected element bounds')
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

// Expected screen-pixel layout for this viewport, derived from the same module the
// quickbar renders from. Matches the ledger's membership inventory.
function layoutContract() {
  const displayScale = Math.min(width / 1600, height / 900)
  const logicalWidth = width / displayScale
  const uiScale = 1
  const slotSize = mobileQuickbarSlotSize(logicalWidth, uiScale)
  const dock = (logicalLeftFromCentre) => (logicalWidth / 2 + logicalLeftFromCentre) * displayScale
  return {
    displayScale,
    dock: { backpackX: dock(-105), potionBlueX: dock(115), potionRedX: dock(-215), tomeX: dock(5), size: 100 * displayScale },
    joystick: { base: MOBILE_JOYSTICK_BASE * displayScale, knob: MOBILE_JOYSTICK_KNOB * displayScale },
    logicalWidth,
    slotSize: slotSize * displayScale,
    slots: Array.from({ length: 8 }, (_, slot) => {
      const placement = mobileQuickbarSlotPlacement(slot, slotSize)
      const x = placement.bank === 'left'
        ? placement.inset * displayScale
        : width - (placement.inset + slotSize) * displayScale
      return {
        bank: placement.bank,
        height: slotSize * displayScale,
        slot,
        width: slotSize * displayScale,
        x,
        y: height - (placement.bottom + slotSize) * displayScale,
      }
    }),
  }
}

function assertHubLayout(geometry, label, { primaryJoystick }) {
  const contract = layoutContract()
  const tolerance = 0.75
  const near = (actual, expected, what) => assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: ${what} expected ${expected.toFixed(2)} got ${actual}`,
  )
  assert.equal(Number(geometry.displayScale).toFixed(4), contract.displayScale.toFixed(4), `${label}: display scale`)
  const slots = [...geometry.members.quickbarSlots].sort((a, b) => a.slot - b.slot)
  assert.equal(slots.length, 8, `${label}: eight quickbar slots`)
  for (const actual of slots) {
    const expected = contract.slots[actual.slot]
    assert.ok(actual.visible, `${label}: slot ${actual.slot} visible`)
    assert.equal(actual.bank, expected.bank, `${label}: slot ${actual.slot} bank`)
    near(actual.x, expected.x, `slot ${actual.slot} x`)
    near(actual.y, expected.y, `slot ${actual.slot} y`)
    near(actual.width, expected.width, `slot ${actual.slot} width`)
    near(actual.height, expected.height, `slot ${actual.slot} height`)
  }
  const dockMembers = [
    ['potionRed', contract.dock.potionRedX],
    ['backpack', contract.dock.backpackX],
    ['tome', contract.dock.tomeX],
    ['potionBlue', contract.dock.potionBlueX],
  ]
  for (const [name, expectedX] of dockMembers) {
    const [member] = geometry.members[name]
    assert.ok(member?.visible, `${label}: ${name} visible`)
    near(member.x, expectedX, `${name} x`)
    near(member.width, contract.dock.size, `${name} width`)
    near(member.height, contract.dock.size, `${name} height`)
  }
  const [movement] = geometry.members.joystickMovement
  assert.ok(movement?.visible, `${label}: movement joystick visible`)
  near(movement.width, contract.joystick.base, 'movement joystick base')
  near(geometry.members.joystickMovementKnob[0].width, contract.joystick.knob, 'movement joystick knob')
  const primary = geometry.members.joystickPrimary[0]
  if (primaryJoystick) {
    assert.ok(primary?.visible, `${label}: primary joystick visible`)
    near(primary.width, contract.joystick.base, 'primary joystick base')
    near(geometry.members.joystickPrimaryKnob[0].width, contract.joystick.knob, 'primary joystick knob')
  } else {
    assert.equal(primary, undefined, `${label}: Hub has no primary joystick`)
  }
  // The moved members (joysticks, banks) may not touch each other nor any of the
  // unchanged dock members; the dock's own overlays (counts on bottles) are pre-existing.
  const moved = [['movement', movement], ...slots.map((slot) => [`slot${slot.slot}`, slot])]
  if (primaryJoystick) moved.push(['primary', primary])
  const fixed = [
    ...dockMembers.map(([name]) => [name, geometry.members[name][0]]),
    ['xp', geometry.members.xp[0]],
    ['countRed', geometry.members.countRed[0]],
    ['countBlue', geometry.members.countBlue[0]],
  ].filter(([, rect]) => rect?.visible)
  assertOverlapFree(moved, label)
  assertOverlapFree(moved, label, fixed)
  const band = [...moved, ...fixed]
  for (const [name, rect] of band) {
    if (!rect?.visible) continue
    assert.ok(rect.x >= -0.01 && rect.y >= -0.01 && rect.x + rect.width <= width + 0.01 && rect.y + rect.height <= height + 0.01,
      `${label}: ${name} inside the viewport ${JSON.stringify(rect)}`)
  }
  const [chatOpen] = geometry.members.chatOpen
  assert.ok(chatOpen?.visible, `${label}: chat opener visible`)
  assertEnvelope(chatOpen, `${label} chat opener`, { maxHeight: 32, maxWidth: 32 })
}

function assertPartyPanelEnvelope(geometry, label, envelope) {
  const [panel] = geometry.members.partyPanel
  assert.ok(panel?.visible, `${label}: party panel visible`)
  assertEnvelope(panel, `${label} party panel`, envelope)
  const [chatOpen] = geometry.members.chatOpen
  assertOverlapFree([['chatOpen', chatOpen], ['partyPanel', panel], ['meterHealth', geometry.members.meterHealth[0]], ['meterMana', geometry.members.meterMana[0]]], label)
}

// Modal dialogs must land at screen scale (not the 0.46 frame scale) and fit the viewport.
function assertDialogFits(dialog, label, { minWidth }) {
  assert.ok(dialog?.visible, `${label}: dialog visible`)
  assert.ok(dialog.width >= minWidth, `${label}: dialog ${dialog.width} px wide renders below screen scale (min ${minWidth})`)
  assert.ok(dialog.x >= 0 && dialog.y >= 0 && dialog.x + dialog.width <= width && dialog.y + dialog.height <= height,
    `${label}: dialog inside the viewport ${JSON.stringify(dialog)}`)
}

function assertEnvelope(rect, label, { maxHeight, maxWidth }) {
  assert.ok(rect.width <= maxWidth + 0.01 && rect.height <= maxHeight + 0.01,
    `${label}: ${rect.width} x ${rect.height} exceeds ${maxWidth} x ${maxHeight}`)
}

// Without `against`, every pair inside `entries` must be disjoint; with it, every entry
// must be disjoint from every member of `against`.
function assertOverlapFree(entries, label, against = null) {
  const rects = entries.filter(([, rect]) => rect)
  const others = against ? against.filter(([, rect]) => rect) : rects
  for (let a = 0; a < rects.length; a += 1) {
    for (let b = against ? 0 : a + 1; b < others.length; b += 1) {
      const [nameA, ra] = rects[a]
      const [nameB, rb] = others[b]
      if (nameA === nameB) continue
      const overlapX = Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x)
      const overlapY = Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y)
      assert.ok(overlapX <= 0.5 || overlapY <= 0.5,
        `${label}: ${nameA} overlaps ${nameB} by ${overlapX.toFixed(2)} x ${overlapY.toFixed(2)}`)
    }
  }
}

async function enterHub(page, displayName, element) {
  await page.goto(`${baseUrl}/game`, { timeout: 240_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 240_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('textbox', { name: 'Wizard name' }).fill(displayName)
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 240_000 })
  await page.locator(MEMBER_SELECTORS.joystickMovement).waitFor({ timeout: 15_000 })
  return page.locator('.hub-world-canvas').evaluate((node) => node.__sdrHubFrame.localPlayerId)
}

async function enterRawHub(displayName, element) {
  const response = await fetch(`${baseUrl}/api/game/hub`, {
    headers: { 'x-solomon-dark-session': 'enter-hub' },
    method: 'POST',
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
  socket.send(JSON.stringify({
    type: 'client-hello',
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
    cheatsEnabled: false,
    protocolVersion: GAME_PROTOCOL_VERSION,
    credential: admission.credential,
    character: { discipline: 'arcane', displayName, element },
  }))
  const welcome = await next((message) => message.type === 'server-welcome', 'welcome')
  const client = {
    close: () => socket.close(),
    invitePlayer(targetPlayerId) {
      socket.send(JSON.stringify({ type: 'client-party-invite', targetPlayerId }))
    },
    next,
    playerId: welcome.playerId,
    startMatch(boneyardId) {
      socket.send(JSON.stringify({ type: 'client-start-match', boneyardId }))
    },
  }
  rawClients.push(client)
  return client
}

function rawMessageQueue(socket) {
  const pending = []
  const waiters = []
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString())
    const index = waiters.findIndex((waiter) => waiter.predicate(message))
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1)
      waiter.resolve(message)
      return
    }
    pending.push(message)
    if (pending.length > 400) pending.shift()
  })
  return (predicate, label) => new Promise((resolve, reject) => {
    const index = pending.findIndex(predicate)
    if (index >= 0) {
      resolve(pending.splice(index, 1)[0])
      return
    }
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), 240_000)
    waiters.push({
      predicate,
      resolve: (message) => {
        clearTimeout(timer)
        resolve(message)
      },
    })
  })
}

async function waitForPartySize(page, size) {
  await page.waitForFunction((expected) => (
    document.querySelectorAll('[data-party-member]').length === expected
  ), size, { timeout: 15_000 })
}

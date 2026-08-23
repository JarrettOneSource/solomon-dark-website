import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { chromium } from 'playwright-core'
import { WebSocket } from 'ws'

import {
  MOBILE_JOYSTICK_BASE,
  MOBILE_JOYSTICK_KNOB,
  mobileQuickbarBankLayout,
  mobileQuickbarSlotPlacement,
} from '../src/game/mobile-quickbar-layout.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'

// Mobile compact-HUD journey. Boots one iPhone XR-class landscape touch page
// (896 x 414 CSS px, DPR 2 by default) through Hub solo, orientation round
// trips, the touch pause skull, a party invitation, the party chip (collapsed
// and expanded), the party settings dialog, a member card, open chat, and a
// party Boneyard run with the pause skull and both joysticks held. Every stop
// captures a settled screenshot plus a geometry receipt for each touch-HUD
// member, and the stops assert the contract recorded in
// docs/game-native-parity-re.md (2026-08-23 reopened touch HUD entry): the
// top-left row (44 px pause skull, 30 px chat opener, party chip 6 px under
// the skull) in stage pixels, the enlarged dock with the quickbar banks beside
// it without overlap, rotation returning to the identical layout, dialogs
// fitting the 896 x 366 Safari viewport, the ally roster continuing the
// social column under the party chip and yielding while the column is open
// (owner picks, 2026-08-23 round 4), and empty error arrays.
// The Hub map control is not a stop: with one catalogued Boneyard it starts
// the run directly (the picker needs two), so it stays out of this system.
const baseUrl = process.env.SDR_MOBILE_HUD_URL || 'http://127.0.0.1:5173'
const evidenceRoot = process.env.SDR_MOBILE_HUD_EVIDENCE_DIR || '/tmp/solomon-mobile-hud-compact'
const width = Number(process.env.SDR_MOBILE_HUD_WIDTH || 896)
const height = Number(process.env.SDR_MOBILE_HUD_HEIGHT || 414)
// Safari keeps its address bar in landscape on the iPhone XR: the page sees 896 x 366.
const shortHeight = Number(process.env.SDR_MOBILE_HUD_SHORT_HEIGHT || 366)
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
  partyMembersList: '.hub-party-members',
  partySettingsGear: '.hub-party-settings-gear',
  partyToggle: '.hub-party-toggle',
  pauseOverlay: '.gameplay-pause-overlay',
  selectedSkills: '.hub-hud-selected-skill',
  skull: '.hub-hud-skull',
  skullButton: '.hub-hud-skull-button',
  tome: '.hub-hud-tome-button',
  xp: '.hub-hud-xp',
})

// Dimensions that are intrinsic text, not layout: the FPS readout is left-anchored and its width
// follows the digit count ("9 FPS" vs "58 FPS"), so only its anchor and height prove the round trip.
const CONTENT_SIZED = { diagnostics: ['width'] }

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
  assertCluster(solo, 'hub-solo', { expanded: false })
  assertEnvelope(solo.members.partyPanel[0], 'hub-solo party chip', { maxHeight: 24, maxWidth: 124 })
  assertAllyColumn(solo, 'hub-solo', { hidden: false, rows: 0, top: 82 })

  // Orientation round trip: portrait and back must reproduce the landscape layout exactly.
  await page.setViewportSize({ width: height, height: width })
  const portrait = await capture(page, 'hub-solo-portrait')
  assert.equal(portrait.window.width, height, 'hub-solo-portrait: viewport width')
  await page.setViewportSize({ width, height })
  const rotatedBack = await capture(page, 'hub-solo-rotated-back')
  assertHubLayout(rotatedBack, 'hub-solo-rotated-back', { primaryJoystick: false })
  assertSameMembers(solo, rotatedBack, 'hub-solo-rotated-back')

  // Safari keeps its address bar in landscape (896 x 366): the row is in stage pixels, so
  // nothing moves, and the leader's settings dialog must still fit.
  await page.setViewportSize({ width, height: shortHeight })
  const soloShort = await capture(page, 'hub-solo-short')
  assert.equal(soloShort.window.height, shortHeight, 'hub-solo-short: viewport height')
  assertCluster(soloShort, 'hub-solo-short', { expanded: false })
  assertAllyColumn(soloShort, 'hub-solo-short', { hidden: false, rows: 0, top: 82 })
  await page.locator(MEMBER_SELECTORS.partySettingsOpen).tap()
  const shortSettings = page.locator(MEMBER_SELECTORS.partySettingsDialog)
  await shortSettings.waitFor({ timeout: 10_000 })
  const shortSettingsStop = await capture(page, 'hub-solo-settings-short')
  assertDialogFits(shortSettingsStop.members.partySettingsDialog[0], 'hub-solo-settings-short', { minWidth: 300 }, shortHeight)
  await shortSettings.getByRole('button', { name: /close/i }).click()
  await shortSettings.waitFor({ state: 'detached', timeout: 10_000 })
  await page.setViewportSize({ width, height })
  const soloRestored = await capture(page, 'hub-solo-restored')
  assertHubLayout(soloRestored, 'hub-solo-restored', { primaryJoystick: false })
  assertSameMembers(solo, soloRestored, 'hub-solo-restored')

  // The pause skull is a real control on touch: tap → pause menu → RESUME.
  await pauseRoundTrip(page, 'hub-pause')

  // Leader view of the settings dialog (visibility, Party ID, requests) in both skins.
  await page.locator(MEMBER_SELECTORS.partySettingsOpen).tap()
  const soloSettings = page.locator(MEMBER_SELECTORS.partySettingsDialog)
  await soloSettings.waitFor({ timeout: 10_000 })
  const soloSettingsStop = await capture(page, 'hub-solo-settings')
  const soloDialog = soloSettingsStop.members.partySettingsDialog[0]
  assertDialogFits(soloDialog, 'hub-solo-settings', { minWidth: 300 }, height)
  assert.ok(soloSettingsStop.members.partySettingsGear.length === 1, 'hub-solo-settings: the gear opener is the inline SVG')
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
  assertCluster(invited, 'hub-invitation', { expanded: false })
  assertEnvelope(invited.members.partyPanel[0], 'hub-invitation party column', { maxHeight: 100, maxWidth: 160 })
  assert.equal(invited.members.partyInvitation.length, 1, 'hub-invitation: invitation card present')
  // The invitation toast extends the column under the chip: the roster yields.
  assertAllyColumn(invited, 'hub-invitation', { hidden: true, rows: 0, top: 82 })
  await invitation.getByRole('button', { name: 'Accept' }).click()
  await waitForPartySize(page, 2)
  await page.locator('.hub-hud-allies[data-ally-count="1"]').waitFor({ timeout: 15_000 })
  const party = await capture(page, 'hub-party')
  assertHubLayout(party, 'hub-party', { primaryJoystick: false })
  assertCluster(party, 'hub-party', { expanded: false })
  assertEnvelope(party.members.partyPanel[0], 'hub-party party chip', { maxHeight: 24, maxWidth: 124 })
  // Collapsed chip: the partner's health bar sits directly under it in the column.
  assertAllyColumn(party, 'hub-party', { hidden: false, rows: 1, top: 82 })

  await page.locator(MEMBER_SELECTORS.partyToggle).tap()
  await page.locator(`${MEMBER_SELECTORS.partyMembersList}:not([hidden])`).waitFor({ timeout: 10_000 })
  const expanded = await capture(page, 'hub-party-expanded')
  assertHubLayout(expanded, 'hub-party-expanded', { primaryJoystick: false })
  assertCluster(expanded, 'hub-party-expanded', { expanded: true })
  assertEnvelope(expanded.members.partyPanel[0], 'hub-party-expanded party column', { maxHeight: 72, maxWidth: 124 })
  assert.equal(expanded.members.partyMembers.filter((row) => row.visible).length, 2, 'hub-party-expanded: two member rows')
  // The 96 px member card hangs from the chip as a tab (no gap), and the roster yields to it.
  const [expandedToggle] = expanded.members.partyToggle
  const [expandedList] = expanded.members.partyMembersList
  nearRect(expandedList, { width: 96, x: expandedToggle.x, y: expandedToggle.y + expandedToggle.height }, 'hub-party-expanded member card')
  assertAllyColumn(expanded, 'hub-party-expanded', { hidden: true, rows: 1, top: 82 })
  assertOverlapFree(
    [[`allies`, expanded.members.allies[0]], [`partyPanel`, expanded.members.partyPanel[0]], [`meterHealth`, expanded.members.meterHealth[0]], [`meterMana`, expanded.members.meterMana[0]]],
    'hub-party-expanded',
  )

  await page.locator(MEMBER_SELECTORS.partySettingsOpen).tap()
  const settings = page.locator(MEMBER_SELECTORS.partySettingsDialog)
  await settings.waitFor({ timeout: 10_000 })
  const settingsStop = await capture(page, 'hub-party-settings')
  assertDialogFits(settingsStop.members.partySettingsDialog[0], 'hub-party-settings', { minWidth: 300 }, height)
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
  assertSkullButton(runIdle, 'run-idle')
  // A run has no party chip: the roster takes the chip's anchor.
  assertAllyColumn(runIdle, 'run-idle', { hidden: false, rows: 1, top: 54 })
  await pauseRoundTrip(page, 'run-pause')

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
  assertAllyColumn(runReleased, 'run-released', { hidden: false, rows: 1, top: 54 })

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

// Tap the skull, expect the pause menu, resume through its own RESUME action.
async function pauseRoundTrip(page, label) {
  await page.locator(MEMBER_SELECTORS.skullButton).tap()
  const overlay = page.locator(MEMBER_SELECTORS.pauseOverlay)
  await overlay.waitFor({ timeout: 10_000 })
  const paused = await capture(page, label)
  assert.ok(paused.members.pauseOverlay[0]?.visible, `${label}: pause menu visible after the skull tap`)
  await page.locator('[data-pause-action="resume"]').tap()
  await overlay.waitFor({ state: 'detached', timeout: 10_000 })
  const resumed = await settledGeometry(page)
  assert.equal(resumed.members.pauseOverlay.length, 0, `${label}: pause menu closed by RESUME`)
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
        if (node.hasAttribute('hidden')) entry.hidden = true
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
  const bank = mobileQuickbarBankLayout(logicalWidth, uiScale)
  const slotSize = bank.size
  const dock = (logicalLeftFromCentre) => (logicalWidth / 2 + logicalLeftFromCentre) * displayScale
  return {
    displayScale,
    // 2026-08-23 dock, owner pick B: potions 100, backpack / tome 130 root px, zero-gap
    // order from the centre (-230 | -130 | 0 | 130).
    dock: {
      backpack: { size: 130 * displayScale, x: dock(-130) },
      potionBlue: { size: 100 * displayScale, x: dock(130) },
      potionRed: { size: 100 * displayScale, x: dock(-230) },
      tome: { size: 130 * displayScale, x: dock(0) },
    },
    joystick: { base: MOBILE_JOYSTICK_BASE * displayScale, knob: MOBILE_JOYSTICK_KNOB * displayScale },
    logicalWidth,
    slotSize: slotSize * displayScale,
    slots: Array.from({ length: 8 }, (_, slot) => {
      const placement = mobileQuickbarSlotPlacement(slot, bank)
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
  const dockMembers = ['potionRed', 'backpack', 'tome', 'potionBlue'].map((name) => [name, contract.dock[name]])
  for (const [name, expected] of dockMembers) {
    const [member] = geometry.members[name]
    assert.ok(member?.visible, `${label}: ${name} visible`)
    near(member.x, expected.x, `${name} x`)
    near(member.width, expected.size, `${name} width`)
    near(member.height, expected.size, `${name} height`)
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

// Top-left row in stage pixels (the stage is already safe-area inset): 44 px pause skull
// at (4, 4) with 36 px art, 30 px chat opener at (56, 11), party chip at (6, 54) with a
// 22 px pill and a 22 px gear; the 96 px member card hangs from the pill as a tab only
// while expanded, and the ally roster continues the column at (6, 82) otherwise.
function assertSkullButton(geometry, label) {
  const [button] = geometry.members.skullButton
  assert.ok(button?.visible, `${label}: pause skull button visible`)
  nearRect(button, { height: 44, width: 44, x: 4, y: 4 }, `${label} pause skull button`)
  const [art] = geometry.members.skull
  assert.ok(Math.abs(art.width - 36) <= 0.75, `${label}: skull art ${art.width} px wide (expected 36)`)
}

function assertCluster(geometry, label, { expanded }) {
  assertSkullButton(geometry, label)
  const [chatOpen] = geometry.members.chatOpen
  assert.ok(chatOpen?.visible, `${label}: chat opener visible`)
  nearRect(chatOpen, { height: 30, width: 30, x: 56, y: 11 }, `${label} chat opener`)
  const [panel] = geometry.members.partyPanel
  assert.ok(panel?.visible, `${label}: party panel visible`)
  assert.ok(Math.abs(panel.x - 6) <= 0.75 && Math.abs(panel.y - 54) <= 0.75,
    `${label}: party chip at (${panel.x}, ${panel.y}), expected (6, 54)`)
  const [toggle] = geometry.members.partyToggle
  assert.ok(toggle?.visible, `${label}: party chip toggle visible`)
  assert.ok(Math.abs(toggle.height - 22) <= 0.75, `${label}: party chip ${toggle.height} px tall (expected 22)`)
  const [gear] = geometry.members.partySettingsOpen
  if (gear) nearRect(gear, { height: 22, width: 22 }, `${label} party gear`)
  const [list] = geometry.members.partyMembersList
  assert.equal(Boolean(list?.visible), expanded, `${label}: member card ${expanded ? 'expanded' : 'collapsed'}`)
  assertOverlapFree([
    ['skullButton', geometry.members.skullButton[0]],
    ['chatOpen', chatOpen],
    ['partyPanel', panel],
    ['meterHealth', geometry.members.meterHealth[0]],
    ['meterMana', geometry.members.meterMana[0]],
    ['allies', geometry.members.allies[0]],
    ['joystickMovement', geometry.members.joystickMovement[0]],
  ], label)
}

// The ally roster is the social column's tail: at `top` in screen pixels (Hub 82 under the
// chip, Boneyard 54 at the chip's anchor), `rows` visible health bars no wider than the
// chip-and-gear row, and the `hidden` attribute set while the Hub party column is open
// (member card, invitation toast, action error). Hidden means no row renders.
function assertAllyColumn(geometry, label, { hidden, rows, top }) {
  const [roster] = geometry.members.allies
  assert.ok(roster, `${label}: ally roster mounted`)
  assert.equal(Boolean(roster.hidden), hidden, `${label}: ally roster ${hidden ? 'hidden' : 'shown'}`)
  const visibleRows = geometry.members.allyRows.filter((row) => row.visible)
  assert.equal(visibleRows.length, hidden ? 0 : rows, `${label}: ${hidden ? 0 : rows} visible ally rows`)
  if (hidden) {
    assert.ok(!roster.visible, `${label}: hidden ally roster does not render`)
    return
  }
  nearRect(roster, { x: 6, y: top }, `${label} ally roster`)
  if (rows === 0) return
  assert.ok(roster.visible, `${label}: ally roster visible`)
  for (const row of visibleRows) assertEnvelope(row, `${label} ally row`, { maxHeight: 25, maxWidth: 120 })
}

function nearRect(rect, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assert.ok(Math.abs(rect[key] - value) <= 0.75, `${label}: ${key} ${rect[key]} (expected ${value})`)
  }
}

// Every member must come back to the same screen rectangle after an orientation change.
function assertSameMembers(before, after, label) {
  for (const [name, rects] of Object.entries(before.members)) {
    const next = after.members[name]
    const intrinsic = CONTENT_SIZED[name] ?? []
    assert.equal(next.length, rects.length, `${label}: ${name} count ${rects.length} -> ${next.length}`)
    rects.forEach((rect, index) => {
      for (const key of ['x', 'y', 'width', 'height']) {
        if (intrinsic.includes(key)) continue
        assert.ok(Math.abs(rect[key] - next[index][key]) <= 0.75,
          `${label}: ${name}[${index}].${key} ${rect[key]} -> ${next[index][key]}`)
      }
    })
  }
}

// Modal dialogs must land at screen scale (not the 0.46 frame scale) and fit the viewport.
function assertDialogFits(dialog, label, { minWidth }, viewportHeight) {
  assert.ok(dialog?.visible, `${label}: dialog visible`)
  assert.ok(dialog.width >= minWidth, `${label}: dialog ${dialog.width} px wide renders below screen scale (min ${minWidth})`)
  assert.ok(dialog.x >= 0 && dialog.y >= 0 && dialog.x + dialog.width <= width && dialog.y + dialog.height <= viewportHeight,
    `${label}: dialog inside the ${width} x ${viewportHeight} viewport ${JSON.stringify(dialog)}`)
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

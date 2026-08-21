import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'
import { WebSocket } from 'ws'

import {
  GAME_FIXED_TICK_SECONDS,
  gameSimulationPlayerRecords,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import {
  playerSkillRuntimeAt,
  replacePlayerEconomy,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  GAME_PROTOCOL_VERSION,
  decodeServerGameMessage,
  encodeGameMessage,
} from '../src/game/protocol/game-protocol.ts'
import { PAUSE_MENU_ACTION_BOUNDS } from '../src/game/pause-menu-contract.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const screenshots = {
  boneyardWaiting: process.env.SDR_GAME_PAUSE_BONEYARD_SCREENSHOT
    || '/tmp/solomon-dark-pause-boneyard-waiting.png',
  hubOwner: process.env.SDR_GAME_PAUSE_OWNER_SCREENSHOT
    || '/tmp/solomon-dark-pause-hub-owner.png',
  inventoryOwner: process.env.SDR_GAME_PAUSE_INVENTORY_SCREENSHOT
    || '/tmp/solomon-dark-pause-inventory-owner.png',
  skillSettings: process.env.SDR_GAME_SKILL_SETTINGS_SCREENSHOT
    || '/tmp/solomon-dark-pause-skill-settings.png',
  hubWaiting: process.env.SDR_GAME_PAUSE_WAITING_SCREENSHOT
    || '/tmp/solomon-dark-pause-hub-waiting.png',
  leavePressed: process.env.SDR_GAME_PAUSE_LEAVE_PRESSED_SCREENSHOT
    || '/tmp/solomon-dark-pause-leave-pressed.png',
  resumePressed: process.env.SDR_GAME_PAUSE_RESUME_PRESSED_SCREENSHOT
    || '/tmp/solomon-dark-pause-resume-pressed.png',
  settingsPressed: process.env.SDR_GAME_PAUSE_SETTINGS_PRESSED_SCREENSHOT
    || '/tmp/solomon-dark-pause-settings-pressed.png',
  skillBookOwner: process.env.SDR_GAME_PAUSE_SKILL_BOOK_SCREENSHOT
    || '/tmp/solomon-dark-pause-skill-book-owner.png',
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
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
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
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript((configuration) => {
    window.solomonDarkRuntime = configuration
  }, runtime)
  await enterHub(page, 'Fire')
  grantLearnedSkill(57)

  peer = await joinRaw({
    discipline: 'mind',
    displayName: 'Vibia',
    element: 'water',
  })
  assert.equal(host.playerCount(), 2)

  const modalPauseEdges = []
  const observeModalPause = (data) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-gameplay-pause') modalPauseEdges.push(message.pause?.source ?? null)
  }
  peer.socket.on('message', observeModalPause)
  const peerSawInventoryPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.source === 'inventory'
  ))
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  const inventoryPause = await peerSawInventoryPause
  assert.equal(inventoryPause.type, 'server-gameplay-pause')
  assert.equal(inventoryPause.pause.ownerPlayerId, host.hostPlayerId())
  assert.equal(await page.locator('.gameplay-pause-stage').count(), 0)
  const heldBookWorld = simulationReceipt()
  await page.waitForTimeout(350)
  assert.deepEqual(simulationReceipt(), heldBookWorld)
  await page.screenshot({ path: screenshots.inventoryOwner })

  const peerSawSkillBookPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.source === 'skill-book'
  ))
  await page.keyboard.press('k')
  const skillBook = page.getByRole('dialog', { name: 'Skills' })
  await skillBook.waitFor()
  await peerSawSkillBookPause
  await inventory.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.gameplay-pause-stage').count(), 0)
  await page.waitForTimeout(350)
  assert.deepEqual(simulationReceipt(), heldBookWorld)
  await page.screenshot({ path: screenshots.skillBookOwner })

  const peerSawBookResume = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  await skillBook.getByRole('button', { name: 'Close skills' }).click()
  await Promise.all([
    peerSawBookResume,
    skillBook.waitFor({ state: 'detached' }),
  ])
  peer.socket.off('message', observeModalPause)
  assert.deepEqual(modalPauseEdges, ['inventory', 'skill-book', null])
  await assertNormalResumeRate(page)

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
  assert.equal(ownerPauseMessage.pause.ownerPlayerId, host.hostPlayerId())
  assert.equal(
    ownerPauseMessage.pause.ownerDisplayName,
    await ownerPause.getAttribute('data-gameplay-pause-owner-name'),
  )
  assert.ok(ownerPauseMessage.pause.ownerDisplayName.length > 0)
  await page.waitForTimeout(350)

  assert.equal(
    await ownerPause.getByRole('button', { name: 'GAME SETTINGS' }).isEnabled(),
    true,
  )
  assert.equal(await ownerPause.getAttribute('data-gameplay-pause-reveal'), '1')
  const pauseCanvas = ownerPause.locator('canvas[data-pause-renderer="native-simple-menu"]')
  await pauseCanvas.waitFor()
  assert.deepEqual(await pauseCanvas.evaluate((canvas) => ({
    height: canvas.height,
    renderer: canvas.dataset.gameRenderer,
    width: canvas.width,
  })), {
    height: 900,
    renderer: 'pixi-webgl',
    width: 1600,
  })
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
  const idlePauseFrame = await pauseCompositeFrame(page)
  const resumeButton = ownerPause.getByRole('button', { name: 'RESUME GAME' })
  await resumeButton.focus()
  await resumeButton.hover()
  const hoverPauseFrame = await pauseCompositeFrame(page)
  assert.ok(hoverPauseFrame.equals(idlePauseFrame))
  assert.deepEqual(await resumeButton.evaluate((button) => {
    const computed = getComputedStyle(button)
    return {
      color: computed.color,
      fontSize: computed.fontSize,
      outlineStyle: computed.outlineStyle,
    }
  }), { color: 'rgba(0, 0, 0, 0)', fontSize: '0px', outlineStyle: 'none' })
  const pressedFrames = [await capturePressedAction({
    action: 'resume',
    ownerPause,
    page,
    path: screenshots.resumePressed,
    pauseCanvas,
  })]
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
  const firstHubResumeStartedAt = performance.now()
  await ownerPause.getByRole('button', { name: 'RESUME GAME' }).click()
  await peerSawHubResume
  assertNoCatchUp(heldHub.tick, firstHubResumeStartedAt, 'browser-owner Hub resume')
  await ownerPause.waitFor({ state: 'detached' })
  await assertNormalResumeRate(page)

  const peerSawSettingsPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === host.hostPlayerId()
  ))
  await pressPause(page, '.hub-scene')
  const settingsPause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await Promise.all([settingsPause.waitFor(), peerSawSettingsPause])
  await page.waitForTimeout(350)
  const settingsCanvas = settingsPause.locator('canvas[data-pause-renderer="native-simple-menu"]')
  await settingsCanvas.waitFor()
  pressedFrames.push(await capturePressedAction({
    action: 'settings',
    ownerPause: settingsPause,
    page,
    path: screenshots.settingsPressed,
    pauseCanvas: settingsCanvas,
  }))

  const peerSawSettingsResume = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  await settingsPause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
  await settingsDialog.waitFor()
  await settingsPause.waitFor({ state: 'detached' })
  const concentrationSelector = settingsDialog.getByRole('region', {
    name: 'Select Concentration',
  })
  await concentrationSelector.getByRole('button', { name: 'Channel Mana' }).click()
  await waitForHost(() => (
    playerSkillRuntimeAt(host.state().playerEntities, host.hostPlayerId())
      ?.concentrationSkillIdA === 57
  ), 'concentration selection')
  const primarySelector = settingsDialog.getByRole('region', { name: 'Select Primary Attack' })
  assert.equal(
    await primarySelector.getByRole('button', { name: 'Fireball, selected' })
      .getAttribute('aria-pressed'),
    'true',
  )
  await page.screenshot({ path: screenshots.skillSettings })
  const settingsHeldHub = simulationReceipt()
  await page.waitForTimeout(550)
  assert.deepEqual(simulationReceipt(), settingsHeldHub)
  const hubResumeStartedAt = performance.now()
  await settingsDialog.getByRole('button', { name: 'Done' }).click()
  await peerSawSettingsResume
  assertNoCatchUp(settingsHeldHub.tick, hubResumeStartedAt, 'browser-owner Hub resume')
  await assertNormalResumeRate(page)

  const peerSawLeavePause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === host.hostPlayerId()
  ))
  await pressPause(page, '.hub-scene')
  const leavePause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await Promise.all([leavePause.waitFor(), peerSawLeavePause])
  await page.waitForTimeout(350)
  const leaveCanvas = leavePause.locator('canvas[data-pause-renderer="native-simple-menu"]')
  await leaveCanvas.waitFor()
  pressedFrames.push(await capturePressedAction({
    action: 'leave',
    ownerPause: leavePause,
    page,
    path: screenshots.leavePressed,
    pauseCanvas: leaveCanvas,
  }))
  assert.equal(new Set(pressedFrames).size, 3)

  const leaveTestHeldHub = simulationReceipt()
  const peerSawLeaveTestResume = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause === null
  ))
  const leaveTestResumeStartedAt = performance.now()
  await leavePause.getByRole('button', { name: 'RESUME GAME' }).click()
  await peerSawLeaveTestResume
  assertNoCatchUp(
    leaveTestHeldHub.tick,
    leaveTestResumeStartedAt,
    'post-Leave-press Hub resume',
  )
  await leavePause.waitFor({ state: 'detached' })

  const peerPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === peer.welcome.playerId
  ))
  peer.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'pause-menu',
  }))
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
  const peerHubResumeStartedAt = performance.now()
  peer.socket.send(encodeGameMessage({ type: 'client-gameplay-pause', paused: false }))
  await peerSawOwnResume
  assertNoCatchUp(peerHeldHub.tick, peerHubResumeStartedAt, 'peer Hub resume')
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
  const boneyardResumeStartedAt = performance.now()
  await boneyardOwner.getByRole('button', { name: 'RESUME GAME' }).click()
  await peerSawBoneyardResume
  assertNoCatchUp(
    heldBoneyardOwner.tick,
    boneyardResumeStartedAt,
    'browser-owner Boneyard resume',
  )
  await boneyardOwner.waitFor({ state: 'detached' })

  const peerBoneyardPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === peer.welcome.playerId
  ))
  peer.socket.send(encodeGameMessage({
    type: 'client-gameplay-pause',
    paused: true,
    source: 'pause-menu',
  }))
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
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
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
    cheatsEnabled: false,
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

function grantLearnedSkill(skillId) {
  const state = host.state()
  const playerId = host.hostPlayerId()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[skillId] = 1
  effectiveRanks[skillId] = 1
  const skillBooks = [...state.playerEntities.skillBooks]
  const progressions = [...state.playerEntities.progressions]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: [...sourceBook.learnedSkillOrder, skillId],
    permanentRanks,
  }
  progressions[index] = {
    ...progressions[index],
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions,
      skillBooks,
    }, playerId, getPlayerEconomy(state, playerId)),
  })
}

async function canvasFrame(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const frame = canvas.__sdrHubFrame ?? canvas.__sdrBoneyardFrame
    return frame ? JSON.stringify(frame) : null
  })
}

async function pauseCompositeFrame(page) {
  return page.screenshot({
    clip: { height: 500, width: 500, x: 550, y: 210 },
  })
}

async function capturePressedAction({
  action,
  ownerPause,
  page,
  path,
  pauseCanvas,
}) {
  const button = ownerPause.locator(`[data-pause-action="${action}"]`)
  const priorRevision = Number(await pauseCanvas.getAttribute('data-pause-frame-revision'))
  await button.dispatchEvent('pointerdown', {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse',
  })
  await page.waitForFunction(
    (pressedAction) => {
      const stage = document.querySelector('.gameplay-pause-stage')
      const overlay = document.querySelector('[data-pause-pressed-record="102"]')
      return stage?.getAttribute('data-gameplay-pause-pressed') === pressedAction
        && overlay?.getAttribute('data-pause-pressed-action') === pressedAction
    },
    action,
  )
  assert.equal(
    await pauseCanvas.getAttribute('data-pause-body-records'),
    '101,101,101',
  )
  assert.equal(
    Number(await pauseCanvas.getAttribute('data-pause-frame-revision')),
    priorRevision,
  )
  await settleBrowserPaint(page)
  const overlay = ownerPause.locator(
    `[data-pause-pressed-record="102"][data-pause-pressed-action="${action}"]`,
  )
  assert.deepEqual(await overlay.boundingBox(), {
    height: 85,
    width: 365,
    x: PAUSE_MENU_ACTION_BOUNDS[action].left - 6,
    y: PAUSE_MENU_ACTION_BOUNDS[action].top - 6,
  })
  const pressedFrame = await overlay.screenshot()
  await writeFile(path, pressedFrame)
  await button.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  await page.waitForFunction(() => (
    document.querySelector('.gameplay-pause-stage')
      ?.getAttribute('data-gameplay-pause-pressed') === 'none'
    && document.querySelector('[data-pause-pressed-record="102"]') === null
  ))
  return pressedFrame.toString('base64')
}

async function settleBrowserPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(
    () => requestAnimationFrame(resolve),
  )))
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
  Object.defineProperty(window, '__sdrRestoreAudioPreload', {
    value: () => { HTMLMediaElement.prototype.load = nativeLoad },
  })
}

async function assertNormalResumeRate(page) {
  const resumedAt = host.state().tick
  await page.waitForTimeout(100)
  const delta = host.state().tick - resumedAt
  assert.ok(delta >= 5 && delta <= 20, `unexpected resumed rate: ${delta} ticks per 100 ms`)
}

function assertNoCatchUp(heldTick, resumedAtMs, label) {
  const elapsedMs = performance.now() - resumedAtMs
  const tickDelta = host.state().tick - heldTick
  const maxNormalTicks = Math.ceil(elapsedMs / (GAME_FIXED_TICK_SECONDS * 1000)) + 2
  assert.ok(
    tickDelta <= maxNormalTicks,
    `${label} advanced ${tickDelta} ticks in ${elapsedMs.toFixed(1)} ms`,
  )
}

async function waitForHost(predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`timed out waiting for ${label}`)
}

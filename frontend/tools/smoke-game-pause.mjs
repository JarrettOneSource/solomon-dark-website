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
} from '../src/game/core-server/game-simulation.ts'
import { HUB_TRADER_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'
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
  hubDialogue: process.env.SDR_GAME_PAUSE_HUB_DIALOGUE_SCREENSHOT
    || '/tmp/solomon-dark-pause-hub-dialogue-live.png',
  largeHubInventory: process.env.SDR_GAME_PAUSE_LARGE_INVENTORY_SCREENSHOT
    || '/tmp/solomon-dark-large-hub-inventory.png',
  largeHubPause: process.env.SDR_GAME_PAUSE_LARGE_SCREENSHOT
    || '/tmp/solomon-dark-large-hub-pause.png',
  leavePressed: process.env.SDR_GAME_PAUSE_LEAVE_PRESSED_SCREENSHOT
    || '/tmp/solomon-dark-pause-leave-pressed.png',
  resumePressed: process.env.SDR_GAME_PAUSE_RESUME_PRESSED_SCREENSHOT
    || '/tmp/solomon-dark-pause-resume-pressed.png',
  resumeCountdown: process.env.SDR_GAME_RESUME_COUNTDOWN_SCREENSHOT
    || '/tmp/solomon-dark-resume-countdown.png',
  restartCountdown: process.env.SDR_GAME_RESTART_COUNTDOWN_SCREENSHOT
    || '/tmp/solomon-dark-restart-countdown.png',
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
  resetWhenEmpty: true,
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
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await enterHub(page, 'Fire')

  await page.setViewportSize({ height: 1200, width: 1920 })
  const largeHubScene = page.locator('.hub-scene')
  await largeHubScene.getByRole('button', { name: /Open inventory/ }).click()
  const largeHubInventory = page.getByRole('dialog', { name: 'Inventory' })
  await largeHubInventory.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor()
  await assertFixedUiGeometry(
    page,
    page.locator('.hub-native-ui-overlay'),
    largeHubInventory,
    largeHubInventory.locator('.hub-inventory-native-canvas'),
  )
  await dragScaledInventoryItem(
    page,
    largeHubInventory,
    largeHubInventory.getByRole('button', { exact: true, name: 'Weapon, Staff' }).first(),
    { x: 800, y: 650 },
  )
  const largeBackpackStaff = largeHubInventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Staff, quantity 1',
  })
  await largeBackpackStaff.waitFor()
  await largeBackpackStaff.dblclick()
  await largeHubInventory.getByRole('button', {
    exact: true,
    name: 'Weapon, Staff',
  }).first().waitFor()
  assert.equal(
    await page.locator('.main-menu-page').getAttribute('data-hub-player-activity'),
    'occupied',
  )
  await assertLiveHub(page, 'large Hub Inventory')
  await page.screenshot({ path: screenshots.largeHubInventory })
  await page.keyboard.press('i')
  await largeHubInventory.waitFor({ state: 'detached' })
  await page.locator(
    '.main-menu-page[data-hub-player-activity="none"]',
  ).waitFor()
  await assertLiveHub(
    page,
    'large Hub Inventory close',
    100,
  )

  await pressPause(page, '.hub-scene')
  const largeHubPause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await largeHubPause.waitFor()
  await assertNonMusicMuted(page, true)
  await page.waitForTimeout(350)
  await assertFixedUiGeometry(
    page,
    largeHubPause,
    largeHubPause.locator('.gameplay-pause-native-stage'),
    largeHubPause.locator('.gameplay-pause-canvas'),
  )
  assertBoxClose(
    await largeHubPause.locator('.gameplay-pause-dim').boundingBox(),
    { height: 1200, width: 1920, x: 0, y: 0 },
  )
  await assertLiveHub(page, 'large Hub Pause Menu')
  await page.screenshot({ path: screenshots.largeHubPause })
  await largeHubPause.dispatchEvent('keydown', { key: 'Escape', repeat: true })
  await largeHubPause.dispatchEvent('keydown', { altKey: true, key: 'Escape' })
  assert.equal(await largeHubPause.count(), 1)
  await page.keyboard.press('Escape')
  await largeHubPause.waitFor({ state: 'detached' })
  await assertNonMusicMuted(page, false)
  await assertLiveHub(page, 'large Hub Pause Menu close', 100)
  await page.setViewportSize({ height: 900, width: 1600 })
  await page.waitForFunction(() => (
    document.querySelector('.hub-scene')?.getAttribute('data-viewport-width') === '1600'
  ))

  peer = await joinRaw({
    discipline: 'mind',
    displayName: 'Vibia',
    element: 'water',
  })
  assert.equal(host.capacityParticipantCount(), 2)

  const modalPauseEdges = []
  const observeModalPause = (data) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-gameplay-pause') modalPauseEdges.push(message.pause?.source ?? null)
  }
  peer.socket.on('message', observeModalPause)
  const peerSawInventoryActivity = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === 'occupied'
  ))
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await assertNonMusicMuted(page, false)
  await peerSawInventoryActivity
  assert.equal(await page.locator('.gameplay-pause-stage').count(), 0)
  await assertLiveHub(page, 'Hub Inventory', 350)
  await page.screenshot({ path: screenshots.inventoryOwner })

  await page.keyboard.press('k')
  const skillBook = page.getByRole('dialog', { name: 'Skills' })
  await skillBook.waitFor()
  await assertNonMusicMuted(page, false)
  await inventory.waitFor({ state: 'detached' })
  assert.equal(await page.locator('.gameplay-pause-stage').count(), 0)
  assert.equal(
    await page.locator('.main-menu-page').getAttribute('data-hub-player-activity'),
    'occupied',
  )
  await assertLiveHub(page, 'Hub Skill Book', 350)
  await page.screenshot({ path: screenshots.skillBookOwner })

  const peerSawBookClear = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === null
  ))
  await skillBook.getByRole('button', { name: 'Close skills' }).click()
  await Promise.all([
    peerSawBookClear,
    skillBook.waitFor({ state: 'detached' }),
  ])
  const peerSawSelectorActivity = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === 'occupied'
  ))
  await page.getByRole('button', {
    name: 'Select primary attack, current Fireball',
  }).click()
  const compactSelector = page.getByRole('dialog', { name: 'Select Primary Attack' })
  await Promise.all([compactSelector.waitFor(), peerSawSelectorActivity])
  await assertNonMusicMuted(page, true)
  await assertLiveHub(page, 'Hub compact skill selector', 350)
  const peerSawSelectorClear = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === null
  ))
  await page.keyboard.press('Escape')
  await Promise.all([compactSelector.waitFor({ state: 'detached' }), peerSawSelectorClear])
  await assertNonMusicMuted(page, false)
  assert.deepEqual(modalPauseEdges, [])
  peer.socket.off('message', observeModalPause)

  peer.socket.send(encodeGameMessage({
    type: 'client-hub-activity',
    activity: 'paused',
  }))
  await page.waitForFunction((playerId) => {
    const canvas = document.querySelector('.hub-world-canvas')
    const ids = (canvas?.getAttribute('data-hub-activity-player-ids') ?? '')
      .split(',').filter(Boolean)
    const states = (canvas?.getAttribute('data-hub-activity-states') ?? '')
      .split(',').filter(Boolean)
    const index = ids.indexOf(playerId)
    return index >= 0 && states[index] === 'paused'
  }, peer.welcome.playerId)
  await activateHubPlayer(page, peer.welcome.playerId)
  const pausedPeerCard = page.getByRole('dialog', { name: 'Vibia' })
  await pausedPeerCard.waitFor()
  await pausedPeerCard.getByText('Paused', { exact: true }).waitFor()
  assert.equal(
    await pausedPeerCard.locator('[data-profile-activity]').getAttribute('data-profile-activity'),
    'paused',
  )
  await pausedPeerCard.getByRole('button', { name: 'Close' }).click()
  await pausedPeerCard.waitFor({ state: 'detached' })
  peer.socket.send(encodeGameMessage({
    type: 'client-hub-activity',
    activity: null,
  }))
  await page.waitForFunction((playerId) => !(
    document.querySelector('.hub-world-canvas')
      ?.getAttribute('data-hub-activity-player-ids') ?? ''
  ).split(',').includes(playerId), peer.welcome.playerId)

  const hubPauseEdges = []
  const observeHubPause = (data) => {
    const message = decodeServerGameMessage(data.toString())
    if (message.type === 'server-gameplay-pause') hubPauseEdges.push(message.pause)
  }
  peer.socket.on('message', observeHubPause)
  const peerSawOwnerPaused = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === 'paused'
  ))
  await pressPause(page, '.hub-scene')
  const ownerPause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await Promise.all([ownerPause.waitFor(), peerSawOwnerPaused])
  await assertNonMusicMuted(page, true)
  assert.equal(
    await ownerPause.getAttribute('data-gameplay-pause-owner-id'),
    host.hostPlayerId(),
  )
  assert.ok((await ownerPause.getAttribute('data-gameplay-pause-owner-name') || '').length > 0)
  assert.equal(
    await page.locator('.main-menu-page').getAttribute('data-hub-player-activity'),
    'paused',
  )
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
  const idlePauseRender = await pauseCanvas.evaluate((canvas) => ({
    bodyRecords: canvas.dataset.pauseBodyRecords,
    frameRevision: canvas.dataset.pauseFrameRevision,
  }))
  const resumeButton = ownerPause.getByRole('button', { name: 'RESUME GAME' })
  await resumeButton.focus()
  await resumeButton.hover()
  const hoverPauseRender = await pauseCanvas.evaluate((canvas) => ({
    bodyRecords: canvas.dataset.pauseBodyRecords,
    frameRevision: canvas.dataset.pauseFrameRevision,
  }))
  assert.deepEqual(hoverPauseRender, idlePauseRender)
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

  const liveHubPause = await assertLiveHub(page, 'Hub Pause Menu', 550)
  assert.deepEqual(hubPauseEdges, [])

  latePeer = await joinRaw({
    discipline: 'body',
    displayName: 'Decima',
    element: 'earth',
  })
  assert.equal(latePeer.welcome.gameplayPause, null)
  assert.equal(latePeer.welcome.snapshot.world.kind, 'hub')
  assert.equal(
    latePeer.welcome.snapshot.world.participants[host.hostPlayerId()]?.activity,
    'paused',
  )
  assert.ok(latePeer.welcome.snapshot.tick >= liveHubPause.after.tick)

  const peerSawOwnerClear = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === null
  ))
  await ownerPause.getByRole('button', { name: 'RESUME GAME' }).click()
  await Promise.all([ownerPause.waitFor({ state: 'detached' }), peerSawOwnerClear])
  await assertNonMusicMuted(page, false)
  await assertLiveHub(page, 'Hub Pause Menu close', 100)
  assert.deepEqual(hubPauseEdges, [])

  await pressPause(page, '.hub-scene')
  const settingsPause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await settingsPause.waitFor()
  await assertNonMusicMuted(page, true)
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

  await settingsPause.getByRole('button', { name: 'GAME SETTINGS' }).click()
  await page.getByRole('dialog', { name: 'Settings' }).waitFor()
  await assertNonMusicMuted(page, true)
  const settingsDialog = page.locator('.game-settings-dialog')
  await settingsPause.waitFor({ state: 'detached' })
  await setRange(settingsDialog.getByRole('slider', { name: 'CAMERA FOV' }), 125)
  await setRange(settingsDialog.getByRole('slider', { name: 'UI SCALE' }), 150)
  assert.equal(await page.locator('.hub-scene').getAttribute('data-camera-zoom'), '0.96')
  assert.equal(await page.locator('.hub-hud').getAttribute('data-ui-scale'), '1.5')
  await settingsDialog.getByRole('button', { name: 'TWEAK GAME' }).click()
  const complexLighting = settingsDialog.getByRole('button', { name: 'COMPLEX LIGHTING' })
  assert.equal(await complexLighting.getAttribute('aria-pressed'), 'true')
  await complexLighting.click()
  assert.equal(await complexLighting.getAttribute('aria-pressed'), 'false')
  await settingsDialog.getByRole('button', { name: 'BACK' }).click()
  await assertLiveHub(page, 'Hub Pause Menu settings', 550)
  assert.deepEqual(hubPauseEdges, [])
  await settingsDialog.getByRole('button', { name: 'Done' }).click()
  await assertNonMusicMuted(page, false)
  await assertLiveHub(page, 'Hub Pause Menu settings close', 100)

  await pressPause(page, '.hub-scene')
  const leavePause = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await leavePause.waitFor()
  await assertNonMusicMuted(page, true)
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

  await assertLiveHub(page, 'Hub Pause Menu Leave-row press')
  await leavePause.getByRole('button', { name: 'RESUME GAME' }).click()
  await leavePause.waitFor({ state: 'detached' })
  await assertNonMusicMuted(page, false)

  moveHostPlayerTo({
    x: HUB_TRADER_GEOMETRY.fomentius.position.x - 70,
    y: HUB_TRADER_GEOMETRY.fomentius.position.y,
  })
  const talkToFomentius = page.getByRole('button', { name: 'Talk to Fomentius' })
  await talkToFomentius.waitFor()
  const peerSawDialogueActivity = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === 'occupied'
  ))
  await talkToFomentius.click()
  const fomentiusDialogue = page.getByRole('dialog', { name: 'Talking to Fomentius' })
  await Promise.all([fomentiusDialogue.waitFor(), peerSawDialogueActivity])
  await fomentiusDialogue.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor()
  await page.screenshot({ path: screenshots.hubDialogue })
  await assertLiveHub(page, 'Fomentius dialogue', 550)
  assert.equal(await page.locator('.hub-scene').getAttribute('data-modal-open'), 'true')
  assert.equal(await page.locator('.hub-scene').getAttribute('data-hub-ui-surface'), 'dialogue')
  assert.equal(
    await page.locator('.main-menu-page').getAttribute('data-hub-player-activity'),
    'occupied',
  )
  assert.deepEqual(hubPauseEdges, [])
  const peerSawDialogueClear = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-snapshot'
    && message.frame.world.kind === 'hub'
    && message.frame.world.participants[host.hostPlayerId()]?.activity === null
  ))
  await page.keyboard.press('Escape')
  await Promise.all([fomentiusDialogue.waitFor({ state: 'detached' }), peerSawDialogueClear])

  const rawHubPause = simulationReceipt()
  for (const source of ['pause-menu', 'inventory', 'skill-book', 'skill-selector']) {
    peer.socket.send(encodeGameMessage({
      type: 'client-gameplay-pause',
      paused: true,
      source,
    }))
  }
  await assertLiveHub(page, 'rejected raw Hub Pause Menu request', 550)
  assert.ok(host.state().tick > rawHubPause.tick)
  assert.equal(await page.locator('.gameplay-pause-stage').count(), 0)
  assert.deepEqual(hubPauseEdges, [])
  peer.socket.off('message', observeHubPause)

  const peerLoaded = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-boneyard-loaded'
  ))
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await Promise.all([
    peerLoaded,
    page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 }),
  ])

  await page.setViewportSize({ height: 1080, width: 2560 })
  const largeBoneyard = page.locator('.boneyard-scene')
  await largeBoneyard.getByRole('button', { name: /Open inventory/ }).click()
  const largeBoneyardInventory = page.getByRole('dialog', { name: 'Inventory' })
  await largeBoneyardInventory.locator(
    '.hub-inventory-native-canvas[data-native-reveal="settled"]',
  ).waitFor()
  await assertFixedUiGeometry(
    page,
    page.locator('.hub-native-ui-overlay'),
    largeBoneyardInventory,
    largeBoneyardInventory.locator('.hub-inventory-native-canvas'),
  )
  const largeBoneyardInventoryHeldTick = host.state().tick
  await page.keyboard.press('i')
  await largeBoneyardInventory.waitFor({ state: 'detached' })
  await assertResumeCountdown(
    page,
    largeBoneyardInventoryHeldTick,
    'inventory-closed',
    screenshots.resumeCountdown,
  )

  await page.keyboard.press('k')
  const boneyardSkillBook = page.getByRole('dialog', { name: 'Skills' })
  await boneyardSkillBook.waitFor()
  await page.locator('.skill-book-stage[data-transition-phase="settled"]').waitFor()
  const boneyardSkillBookHeldTick = host.state().tick
  await boneyardSkillBook.getByRole('button', { name: 'Close skills' }).click()
  await boneyardSkillBook.waitFor({ state: 'detached' })
  await assertResumeCountdown(
    page,
    boneyardSkillBookHeldTick,
    'skill-book-closed',
  )

  await largeBoneyard.getByRole('button', {
    name: 'Select primary attack, current Fireball',
  }).click()
  const boneyardSelector = page.getByRole('dialog', { name: 'Select Primary Attack' })
  await boneyardSelector.waitFor()
  await page.locator('.hud-skill-selector-stage[data-renderer-state="ready"]').waitFor()
  const boneyardSelectorHeldTick = host.state().tick
  await page.keyboard.press('Escape')
  await boneyardSelector.waitFor({ state: 'detached' })
  await assertResumeCountdown(
    page,
    boneyardSelectorHeldTick,
    'skill-selector-closed',
  )

  const peerSawBoneyardPause = nextRawMessage(peer.socket, (message) => (
    message.type === 'server-gameplay-pause' && message.pause?.ownerPlayerId === host.hostPlayerId()
  ))
  await pressPause(page, '.boneyard-scene')
  const boneyardOwner = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await Promise.all([boneyardOwner.waitFor(), peerSawBoneyardPause])
  await assertNonMusicMuted(page, true)
  await page.waitForTimeout(350)
  await assertFixedUiGeometry(
    page,
    boneyardOwner,
    boneyardOwner.locator('.gameplay-pause-native-stage'),
    boneyardOwner.locator('.gameplay-pause-canvas'),
  )
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
  await assertNonMusicMuted(page, false)
  await assertResumeCountdown(
    page,
    heldBoneyardOwner.tick,
    'pause-menu-closed',
  )

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
  await assertNonMusicMuted(page, true)
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
  await assertNonMusicMuted(page, false)
  await waitForHost(() => host.capacityParticipantCount() === 2, 'pause-owner departure')
  await waitForHost(() => host.state().tick > heldBoneyardPeer.tick, 'Boneyard disconnect resume')

  latePeer.socket.close(1000, 'solo restart setup')
  latePeer = null
  await waitForHost(() => host.humanPlayerCount() === 1, 'solo restart owner')
  await pressPause(page, '.boneyard-scene')
  const restartLeave = page.locator(
    '.gameplay-pause-stage[data-gameplay-pause-view="owner"]',
  )
  await restartLeave.waitFor()
  await restartLeave.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  await waitForHost(() => host.humanPlayerCount() === 0, 'empty restart host')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Last Game' }).click()
  const restartedCountdown = page.locator(
    '.gameplay-resume-countdown-overlay[data-gameplay-resume-grace-reason="game-restarted"]',
  )
  await restartedCountdown.waitFor({ timeout: 90_000 })
  const heldRestartTick = host.state().tick
  await assertResumeCountdown(
    page,
    heldRestartTick,
    'game-restarted',
    screenshots.restartCountdown,
  )

  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    boneyardResumeTick: host.state().tick,
    heldBoneyardOwnerTick: heldBoneyardOwner.tick,
    heldBoneyardPeerTick: heldBoneyardPeer.tick,
    heldRestartTick,
    liveHubPauseEndTick: liveHubPause.after.tick,
    liveHubPauseStartTick: liveHubPause.before.tick,
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

async function activateHubPlayer(page, playerId) {
  const canvas = page.locator('.hub-world-canvas')
  const target = await canvas.evaluate((node, targetPlayerId) => ({
    logicalHeight: Number(node.dataset.viewportHeight),
    logicalWidth: Number(node.dataset.viewportWidth),
    position: structuredClone(node.__sdrHubFrame.playerScreenPositions[targetPlayerId]),
  }), playerId)
  assert.ok(target.position, `missing Hub screen position for ${playerId}`)
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  await page.mouse.click(
    bounds.x + (target.position.x - 48) * bounds.width / target.logicalWidth,
    bounds.y + target.position.y * bounds.height / target.logicalHeight,
  )
}

async function setRange(locator, value) {
  await locator.fill(`${value}`)
}

async function assertNonMusicMuted(page, expected) {
  await page.waitForFunction((muted) => (
    document.querySelector('.main-menu-page')?.getAttribute('data-game-sounds-muted')
      === `${muted}`
  ), expected, { timeout: 5_000 })
}

async function enterHub(page, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
    await tutorialOffer.waitFor({ state: 'detached' })
  }
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
    profile: { accountUsername: null, highestWave: null, totalPlaytimeMs: null },
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

function moveHostPlayerTo(position) {
  const state = host.state()
  const playerId = host.hostPlayerId()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.ok(index >= 0)
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = {
    ...locomotions[index],
    position: { ...position },
    velocity: { x: 0, y: 0 },
  }
  Object.assign(state, {
    ...state,
    playerEntities: { ...state.playerEntities, locomotions },
  })
}

async function canvasFrame(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const frame = canvas.__sdrHubFrame ?? canvas.__sdrBoneyardFrame
    return frame ? JSON.stringify(frame) : null
  })
}

async function assertLiveHub(page, label, durationMs = 350) {
  const before = simulationReceipt()
  const beforeFrame = await canvasFrame(page, '.hub-world-canvas')
  await page.waitForTimeout(durationMs)
  const after = simulationReceipt()
  const afterFrame = await canvasFrame(page, '.hub-world-canvas')
  const minimumTicks = Math.max(1, Math.floor(durationMs / 100))
  assert.ok(
    after.tick - before.tick >= minimumTicks,
    `${label} advanced only ${after.tick - before.tick} ticks in ${durationMs} ms`,
  )
  assert.notEqual(afterFrame, beforeFrame, `${label} retained one presentation frame`)
  assert.equal(
    await page.locator('.hub-scene').getAttribute('data-presentation-paused'),
    'false',
  )
  return { after, before }
}

async function assertFixedUiGeometry(page, overlay, stage, canvas) {
  const viewport = page.viewportSize()
  assert.ok(viewport)
  const scale = Math.min(viewport.width / 1600, viewport.height / 900)
  const expectedStage = {
    height: 900 * scale,
    width: 1600 * scale,
    x: (viewport.width - 1600 * scale) / 2,
    y: (viewport.height - 900 * scale) / 2,
  }
  assertBoxClose(await overlay.boundingBox(), {
    height: viewport.height,
    width: viewport.width,
    x: 0,
    y: 0,
  })
  assertBoxClose(await stage.boundingBox(), expectedStage)
  assertBoxClose(await canvas.boundingBox(), expectedStage)
}

function assertBoxClose(actual, expected, epsilon = 0.01) {
  assert.ok(actual)
  for (const key of ['height', 'width', 'x', 'y']) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) <= epsilon,
      `${key}: ${actual[key]} is not within ${epsilon} of ${expected[key]}`,
    )
  }
}

async function dragScaledInventoryItem(page, inventory, source, nativeDestination) {
  const sourceBox = await source.boundingBox()
  const stageBox = await inventory.boundingBox()
  assert.ok(sourceBox)
  assert.ok(stageBox)
  const destination = {
    x: stageBox.x + nativeDestination.x * stageBox.width / 1600,
    y: stageBox.y + nativeDestination.y * stageBox.height / 900,
  }
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 4 })
  assert.match(await inventory.getAttribute('data-native-inventory-dragging') || '', /^equipment:weapon$/)
  await page.mouse.up()
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

function assertNoCatchUp(heldTick, resumedAtMs, label) {
  const elapsedMs = performance.now() - resumedAtMs
  const tickDelta = host.state().tick - heldTick
  const maxNormalTicks = Math.ceil(elapsedMs / (GAME_FIXED_TICK_SECONDS * 1000)) + 2
  assert.ok(
    tickDelta <= maxNormalTicks,
    `${label} advanced ${tickDelta} ticks in ${elapsedMs.toFixed(1)} ms`,
  )
}

async function assertResumeCountdown(page, heldTick, reason, screenshotPath = null) {
  const countdown = page.locator(
    `.gameplay-resume-countdown-overlay[data-gameplay-resume-grace-reason="${reason}"]`,
  )
  await countdown.waitFor()
  for (const seconds of [3, 2, 1]) {
    await page.locator(
      `.gameplay-resume-countdown-overlay[data-gameplay-resume-grace-reason="${reason}"]`
      + `[data-gameplay-resume-grace-seconds="${seconds}"]`,
    ).waitFor()
    assert.equal(host.state().tick, heldTick)
    if (seconds === 3 && screenshotPath) {
      await page.waitForTimeout(100)
      assert.equal(await countdown.getAttribute('data-gameplay-resume-grace-seconds'), '3')
      await page.screenshot({ path: screenshotPath })
    }
  }
  await countdown.waitFor({ state: 'detached' })
  const resumedTick = host.state().tick
  const resumedAtMs = performance.now()
  await waitForHost(() => host.state().tick > resumedTick, `${reason} grace expiry`)
  await new Promise(resolve => setTimeout(resolve, 60))
  assertNoCatchUp(resumedTick, resumedAtMs, `${reason} post-grace tick rate`)
}

async function waitForHost(predicate, label, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`timed out waiting for ${label}`)
}

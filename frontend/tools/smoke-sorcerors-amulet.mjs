import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'

import {
  createGameSimulation,
  enterBoneyardWorld,
} from '../src/game/core-server/game-simulation.ts'
import { spawnBoneyardCustomLootItems } from '../src/game/core-server/boneyard-loot-store.ts'
import {
  NATIVE_TUTORIAL_AMULET_DESCRIPTION,
  NATIVE_TUTORIAL_WAVE_BATCHES,
  nativeTutorialAmuletItem,
} from '../src/game/core-kernels/native-tutorial.ts'
import { materializeStockTutorial } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'

const injectedBaseUrl = process.env.SDR_TUTORIAL_AMULET_URL
const injectedEndpointUrl = process.env.SDR_TUTORIAL_AMULET_ENDPOINT_URL
const injectedEndpointCredential = process.env.SDR_TUTORIAL_AMULET_ENDPOINT_CREDENTIAL
if (Boolean(injectedEndpointUrl) !== Boolean(injectedEndpointCredential)) {
  throw new Error('Tutorial amulet endpoint URL and credential must be set together')
}
if (Boolean(injectedBaseUrl) !== Boolean(injectedEndpointUrl)) {
  throw new Error('Tutorial amulet base URL and endpoint must be set together')
}
const staticServer = injectedBaseUrl ? null : await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const baseUrl = injectedBaseUrl || staticServer.origin
const localCredential = injectedEndpointCredential || randomBytes(32).toString('base64url')
const localHost = injectedEndpointUrl ? null : await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { credential: localCredential, kind: 'shared' },
  resetWhenEmpty: true,
  snapshotRate: 100,
})
const endpointUrl = injectedEndpointUrl || localHost.address.url
const endpointCredential = injectedEndpointCredential || localCredential
const screenshotRoot = process.env.SDR_TUTORIAL_AMULET_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-sorcerors-amulet'
const [viewportWidth, viewportHeight] = (process.env.SDR_TUTORIAL_AMULET_VIEWPORT || '1600x900')
  .split('x')
  .map(Number)
const allowSparsePresentation = process.env.SDR_TUTORIAL_AMULET_ALLOW_SPARSE_PRESENTATION === '1'
assert.ok(Number.isFinite(viewportWidth) && viewportWidth > 0)
assert.ok(Number.isFinite(viewportHeight) && viewportHeight > 0)

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({
  hasTouch: process.env.SDR_TUTORIAL_AMULET_TOUCH === '1',
  isMobile: process.env.SDR_TUTORIAL_AMULET_TOUCH === '1',
  viewport: { height: viewportHeight, width: viewportWidth },
})
await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }))
const consoleErrors = []
const failedResponses = []
const pageErrors = []
const wireErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() })
  }
})
page.on('websocket', (socket) => {
  socket.on('socketerror', (error) => wireErrors.push(String(error)))
})
await page.addInitScript(bypassStartupAudioPreload)
await page.addInitScript(([url, credential]) => {
  window.solomonDarkRuntime = {
    gameEndpoint: {
      credential,
      kind: url.startsWith('wss:') ? 'remote' : 'localhost',
      sessionKind: url.startsWith('wss:') ? 'private-college' : 'standalone',
      url,
    },
  }
}, [endpointUrl, endpointCredential])

try {
  const fixture = tutorialStageEightSave()
  await seedLocalSave(page, fixture.record)
  consoleErrors.length = 0
  failedResponses.length = 0
  pageErrors.length = 0
  wireErrors.length = 0
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await page.getByRole('button', { name: 'Play' }).click()
  const lastGame = page.getByRole('button', { name: 'Last game' })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()

  const boneyard = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  await boneyard.waitFor({ timeout: 90_000 })
  await boneyard.locator('xpath=self::*[@data-tutorial-stage="8"]').waitFor()
  const hud = page.locator('.hub-hud')
  const backpackButton = page.locator('.hub-hud-backpack-button')
  const skillsButton = page.locator('.hub-hud-tome-button')
  assert.equal(await hud.getAttribute('data-tutorial-inventory'), 'false')
  assert.equal(await hud.getAttribute('data-tutorial-skills'), 'false')
  assert.equal(await backpackButton.isVisible(), false)
  assert.equal(await skillsButton.isVisible(), false)
  assert.equal(await page.locator('.tutorial-overlay[data-stage="8"] .tutorial-instruction').count(), 0)
  const worldPointer = page.locator('.tutorial-overlay[data-stage="8"] .tutorial-pointer')
  await worldPointer.waitFor()
  const stageEightBlink = await samplePointerBlink(page, worldPointer)
  if (allowSparsePresentation) {
    assert.ok(stageEightBlink.hidden + stageEightBlink.visible > 0, JSON.stringify(stageEightBlink))
  } else {
    assert.ok(stageEightBlink.hidden > 0, JSON.stringify(stageEightBlink))
    assert.ok(stageEightBlink.visible > 0, JSON.stringify(stageEightBlink))
  }
  const visiblePointer = await page.waitForFunction(() => {
    const pointer = document.querySelector('.tutorial-overlay[data-stage="8"] .tutorial-pointer')
    if (!(pointer instanceof HTMLElement) || getComputedStyle(pointer).opacity !== '1') return null
    const bounds = pointer.getBoundingClientRect()
    return {
      bounds: {
        bottom: bounds.bottom,
        height: bounds.height,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        width: bounds.width,
      },
      dataset: { ...pointer.dataset },
      opacity: getComputedStyle(pointer).opacity,
    }
  })
  const stageEightPointerReceipt = await visiblePointer.jsonValue()
  await visiblePointer.dispose()
  assert.ok(stageEightPointerReceipt.bounds.right > 0)
  assert.ok(stageEightPointerReceipt.bounds.bottom > 0)
  assert.ok(stageEightPointerReceipt.bounds.left < viewportWidth)
  assert.ok(stageEightPointerReceipt.bounds.top < viewportHeight)
  await page.screenshot({ path: `${screenshotRoot}-stage-8-pointer.png` })

  await boneyard.focus()
  await page.keyboard.down('w')
  try {
    await boneyard.locator('xpath=self::*[@data-tutorial-stage="9"]').waitFor({ timeout: 8_000 })
  } finally {
    await page.keyboard.up('w')
  }
  const stageNineInstruction = (await page.locator(
    '.tutorial-overlay[data-stage="9"] .sr-only',
  ).innerText()).replaceAll(/\s+/g, ' ').trim()
  assert.equal(
    stageNineInstruction,
    "ACCESS YOUR INVENTORY. Click here or press 'I' to open the inventory screen",
  )
  assert.equal(await hud.getAttribute('data-tutorial-inventory'), 'true')
  assert.equal(await hud.getAttribute('data-tutorial-skills'), 'false')
  assert.equal(await backpackButton.isVisible(), true)
  assert.equal(await backpackButton.isDisabled(), false)
  assert.equal(await skillsButton.isVisible(), false)
  await page.waitForFunction(() => {
    const pointer = document.querySelector('[data-tutorial-pointer="inventory"]')
    return pointer instanceof HTMLElement && getComputedStyle(pointer).opacity === '1'
  }, undefined, { timeout: 10_000 })
  await page.screenshot({ path: `${screenshotRoot}-stage-9-inventory-prompt.png` })
  const pickupSaved = await waitForLocalSave(page, (record) => {
    if (!record || record.revision <= fixture.record.revision) return false
    const document = JSON.parse(record.document)
    const simulation = document.continuation?.simulation
    return simulation?.world?.tutorial?.stage === 9
      && simulation?.playerEntities?.economies?.[0]?.backpack?.some((item) => (
        item?.name === "Sorceror's Amulet"
      ))
  })

  await boneyard.focus()
  if (process.env.SDR_TUTORIAL_AMULET_TOUCH === '1') await backpackButton.click()
  else await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
    .waitFor({ timeout: 10_000 })
  await boneyard.locator('xpath=self::*[@data-tutorial-stage="10"]').waitFor()
  const callouts = page.locator('.tutorial-modal-callouts[data-stage="10"]')
  await callouts.waitFor()
  assert.equal(await callouts.locator('[data-tutorial-callout="equipment"]').count(), 1)
  assert.equal(await callouts.locator('[data-tutorial-callout="backpack"]').count(), 1)

  const guidance = {
    amuletCell: await measurePaintedPointerLanding(
      page,
      '[data-tutorial-pointer="modal-backpack"]',
      '[data-inventory-owner="backpack"][aria-label^="Sorceror\'s Amulet,"]',
    ),
    amuletSink: await measurePaintedPointerLanding(
      page,
      '[data-tutorial-pointer="modal-equipment"]',
      '[data-equipment-slot="amulet"]',
    ),
  }
  assert.ok(guidance.amuletCell.insideX, JSON.stringify(guidance))
  assert.ok(
    Math.abs(guidance.amuletCell.tipY - guidance.amuletCell.targetTop)
      <= Math.max(2, guidance.amuletCell.targetHeight * 0.12),
    JSON.stringify(guidance),
  )
  assert.ok(
    guidance.amuletSink.distanceToTarget <= guidance.amuletSink.targetHeight * 0.4,
    JSON.stringify(guidance),
  )
  await page.screenshot({ path: `${screenshotRoot}-stage-10-amulet-guidance.png` })

  const amulet = inventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: "Sorceror's Amulet, quantity 1",
  })
  await amulet.waitFor()
  await amulet.click()
  await inventory.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]')
    .waitFor({ timeout: 5_000 })
  await page.screenshot({ path: `${screenshotRoot}-stage-10-item-info.png` })

  await page.waitForTimeout(550)
  await amulet.dblclick()
  const equipped = inventory.getByRole('button', {
    exact: true,
    name: "Amulet, Sorceror's Amulet",
  }).first()
  await equipped.waitFor({ timeout: 5_000 })
  const saved = await waitForLocalSave(page, (record) => {
    if (!record || record.revision <= fixture.record.revision) return false
    const document = JSON.parse(record.document)
    const simulation = document.continuation?.simulation
    return simulation?.playerEntities?.economies?.[0]?.equipment?.amulet?.name
      === "Sorceror's Amulet"
      && simulation?.playerEntities?.skillRuntimes?.[0]
        ?.equipmentModifiers?.classDamageMultiplier?.[0] === 1.100000023841858
  })
  const savedDocument = JSON.parse(saved.document)
  const savedAmulet = savedDocument.continuation.simulation
    .playerEntities.economies[0].equipment.amulet
  const classDamageMultipliers = savedDocument.continuation.simulation
    .playerEntities.skillRuntimes[0].equipmentModifiers.classDamageMultiplier
  assert.deepEqual(savedAmulet.nativeEffects, [
    { kind: 2, magnitude: 10, operator: 2, target: 0 },
  ])
  assert.deepEqual(classDamageMultipliers, [
    1.100000023841858, 1, 1, 1, 1, 1, 1, 1,
  ])
  await page.screenshot({ path: `${screenshotRoot}-stage-10-equipped.png` })

  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'detached' })
  await boneyard.locator('xpath=self::*[@data-tutorial-stage="11"]').waitFor({ timeout: 5_000 })
  assert.equal(await hud.getAttribute('data-tutorial-inventory'), 'true')
  assert.equal(await hud.getAttribute('data-tutorial-skills'), 'false')
  assert.equal(await backpackButton.isVisible(), true)
  assert.equal(await skillsButton.isVisible(), false)

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(wireErrors, [])
  process.stdout.write(`${JSON.stringify({
    browserVersion: browser.version(),
    callouts: {
      backpack: true,
      equipment: true,
    },
    classDamageMultipliers,
    consoleErrors,
    failedResponses,
    fixtureSha256: fixture.record.sha256,
    guidance,
    itemInfoLines: [
      "Sorceror's Amulet",
      NATIVE_TUTORIAL_AMULET_DESCRIPTION,
      'Ether Damage +10.0%',
    ],
    pageErrors,
    saveRevision: saved.revision,
    screenshotPaths: [
      `${screenshotRoot}-stage-8-pointer.png`,
      `${screenshotRoot}-stage-9-inventory-prompt.png`,
      `${screenshotRoot}-stage-10-amulet-guidance.png`,
      `${screenshotRoot}-stage-10-item-info.png`,
      `${screenshotRoot}-stage-10-equipped.png`,
    ],
    stageNineInstruction,
    stageEightBlink,
    stageEightPointerReceipt,
    pickupSaveRevision: pickupSaved.revision,
    viewport: { height: viewportHeight, width: viewportWidth },
    wireErrors,
  }, null, 2)}\n`)
} finally {
  await browser.close()
  await localHost?.close()
  await staticServer?.close()
}

function tutorialStageEightSave() {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 19))
  let state = enterBoneyardWorld(
    createGameSimulation({ owner: {
      discipline: 'arcane',
      displayName: 'Sirmin',
      element: 'ether',
    } }),
    loadedBoneyard,
  )
  assert.equal(state.world.kind, 'boneyard')
  assert.ok(state.world.tutorial)
  const position = state.playerEntities.locomotions[0].position
  const spawned = spawnBoneyardCustomLootItems(
    state.world.loot,
    [nativeTutorialAmuletItem()],
    { x: position.x, y: position.y - 160 },
    state.tick,
  )
  assert.equal(spawned.rejectedCount, 0)
  state = {
    ...state,
    world: {
      ...state.world,
      loot: spawned.store,
      tutorial: {
        ...state.world.tutorial,
        dialogueArmed: false,
        introActive: false,
        introBlend: 1,
        introDelayTicksRemaining: 0,
        introFade: 0,
        introMovementTicksRemaining: 0,
        inventoryOpened: false,
        inventorySeen: false,
        itemDropArmed: false,
        stage: 8,
        stageTicks: 25,
        waveOrdinal: 2,
        waveSpawnCursor: NATIVE_TUTORIAL_WAVE_BATCHES[2].length,
        waveTicks: 1_400,
      },
    },
  }
  const document = createGameSaveDocument({
    integrity: 'global-clean',
    loadedBoneyard,
    mods: [],
    modState: {},
    playerId: 'owner',
    state,
  })
  return {
    document,
    record: {
      document,
      formatVersion: WEB_GAME_SAVE_SCHEMA_VERSION,
      revision: 1,
      sha256: createHash('sha256').update(document).digest('hex'),
      slot: WEB_GAME_SAVE_SLOT,
      updatedAtUtc: new Date().toISOString(),
    },
  }
}

async function seedLocalSave(target, record) {
  await target.goto(new URL('/deployment.json', baseUrl).href, { waitUntil: 'domcontentloaded' })
  await target.evaluate((seed) => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains('slots')) {
        open.result.createObjectStore('slots', { keyPath: 'slot' })
      }
    }
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(seed)
      transaction.onabort = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    }
  }), record)
}

async function waitForLocalSave(target, predicate) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const record = await target.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('solomon-dark-game-saves', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const request = open.result.transaction('slots', 'readonly')
          .objectStore('slots').get(0)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result ?? null)
      }
    }))
    if (predicate(record)) return record
    await target.waitForTimeout(100)
  }
  throw new Error('timed out waiting for the Tutorial amulet checkpoint')
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

async function samplePointerBlink(page, pointer) {
  if (allowSparsePresentation) {
    const opacity = Number(await pointer.evaluate((element) => getComputedStyle(element).opacity))
    return {
      hidden: opacity <= 0.01 ? 1 : 0,
      intermediate: opacity > 0.01 && opacity < 0.99 ? 1 : 0,
      visible: opacity >= 0.99 ? 1 : 0,
    }
  }
  const receipt = { hidden: 0, intermediate: 0, visible: 0 }
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    const opacity = Number(await pointer.evaluate((element) => getComputedStyle(element).opacity))
    if (opacity <= 0.01) receipt.hidden += 1
    else if (opacity >= 0.99) receipt.visible += 1
    else receipt.intermediate += 1
    await page.waitForTimeout(10)
  }
  return receipt
}

function measurePaintedPointerLanding(page, pointerSelector, targetSelector) {
  return page.evaluate(({ expectedPointer, expectedTarget }) => {
    const pointer = document.querySelector(expectedPointer)
    const target = document.querySelector(expectedTarget)
    if (!(pointer instanceof HTMLElement)) throw new Error(`missing ${expectedPointer}`)
    if (!(target instanceof HTMLElement)) throw new Error(`missing ${expectedTarget}`)
    const marker = document.createElement('b')
    Object.assign(marker.style, {
      height: '1px',
      left: '29px',
      pointerEvents: 'none',
      position: 'absolute',
      top: '2px',
      width: '1px',
    })
    pointer.append(marker)
    const markerRect = marker.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    marker.remove()
    const tipX = markerRect.left + markerRect.width / 2
    const tipY = markerRect.top + markerRect.height / 2
    const distanceX = Math.max(targetRect.left - tipX, 0, tipX - targetRect.right)
    const distanceY = Math.max(targetRect.top - tipY, 0, tipY - targetRect.bottom)
    return {
      distanceToTarget: Math.hypot(distanceX, distanceY),
      insideX: tipX >= targetRect.left && tipX <= targetRect.right,
      targetBottom: targetRect.bottom,
      targetHeight: targetRect.height,
      targetLeft: targetRect.left,
      targetRight: targetRect.right,
      targetTop: targetRect.top,
      targetWidth: targetRect.width,
      tipX,
      tipY,
    }
  }, { expectedPointer: pointerSelector, expectedTarget: targetSelector })
}

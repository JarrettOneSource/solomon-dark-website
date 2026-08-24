import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

import { chromium } from 'playwright-core'

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
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'

const baseUrl = process.env.SDR_TUTORIAL_AMULET_URL || 'http://127.0.0.1:4195'
const endpointUrl = process.env.SDR_TUTORIAL_AMULET_ENDPOINT_URL
const endpointCredential = process.env.SDR_TUTORIAL_AMULET_ENDPOINT_CREDENTIAL
const screenshotRoot = process.env.SDR_TUTORIAL_AMULET_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-sorcerors-amulet'
assert.ok(endpointUrl && endpointCredential, 'Tutorial amulet endpoint is required')

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
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
    gameEndpoint: { credential, kind: 'localhost', url },
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
  const worldPointer = page.locator('.tutorial-overlay[data-stage="8"] .tutorial-pointer')
  await worldPointer.waitFor()
  await page.waitForFunction(() => {
    const pointer = document.querySelector('.tutorial-overlay[data-stage="8"] .tutorial-pointer')
    return pointer && getComputedStyle(pointer).opacity === '1'
  })
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
  await page.screenshot({ path: `${screenshotRoot}-stage-9-inventory-prompt.png` })

  await boneyard.focus()
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
    .waitFor({ timeout: 10_000 })
  await boneyard.locator('xpath=self::*[@data-tutorial-stage="10"]').waitFor()
  const callouts = page.locator('.tutorial-modal-callouts[data-stage="10"]')
  await callouts.waitFor()
  assert.equal(await callouts.locator('.tutorial-callout-equipment').count(), 1)
  assert.equal(await callouts.locator('.tutorial-callout-backpack').count(), 1)

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
      `${screenshotRoot}-stage-10-item-info.png`,
      `${screenshotRoot}-stage-10-equipped.png`,
    ],
    stageNineInstruction,
    wireErrors,
  }, null, 2)}\n`)
} finally {
  await browser.close()
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
  throw new Error('timed out waiting for the equipped Tutorial amulet checkpoint')
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

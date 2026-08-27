import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  DOWSING_EQUIPMENT_RECIPES,
  NATIVE_DYE_SWATCHES,
  createEquipmentInventoryItem,
  nativeDyeCommittedTint,
} from '../src/game/core-kernels/hub-economy.ts'
import {
  createGameSimulation,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { HUB_TRADER_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  WEB_GAME_SAVE_SCHEMA_VERSION,
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const screenshotRoot = process.env.SDR_SACKS_DYES_SCREENSHOT_ROOT
  || '/tmp/solomon-dark-sacks-dyes'
await mkdir(dirname(screenshotRoot), { recursive: true })
const SAVE_PLAYER_ID = 'sacks-dyes-owner'
const CHARACTER = {
  discipline: 'arcane',
  displayName: 'Sackwright',
  element: 'fire',
}
const IDS = Object.freeze({
  clickRingOne: 40_017,
  clickRingTwo: 40_018,
  destinationSack: 40_006,
  dyeCarrier: 40_011,
  dyeInnerSack: 40_010,
  dyeOne: 40_007,
  dyeTwo: 40_008,
  mergePotion: 40_014,
  mergeStack: 40_015,
  mergeSack: 40_016,
  movableKey: 40_002,
  movableSack: 40_003,
  movableSackKey: 40_004,
  rootKey: 40_001,
  sourceSack: 40_005,
  storageKey: 40_012,
  storageSack: 40_013,
  target: 40_009,
})
const ALL_SWATCH_ROWS = Object.freeze(NATIVE_DYE_SWATCHES.map((_, index) => index))
const seeded = createSeededSave()
const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = 'sacks-dyes-browser-acceptance-credential'
const gameHost = await startGameHost({
  allowedOrigins: [staticServer.origin],
  authentication: { kind: 'shared', credential },
  snapshotRate: 20,
})
const baseUrl = staticServer.origin
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: chromePath,
  headless: true,
})
const page = await browser.newPage({ viewport: { height: 900, width: 1_600 } })
const consoleErrors = []
const failedResponses = []
const pageErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({ status: response.status(), url: response.url() })
  }
})
await page.addInitScript(installGameAudioSmokeProbe)
await page.addInitScript(bypassStartupAudioPreload)
await page.addInitScript(({ gameCredential, gameUrl }) => {
  window.solomonDarkRuntime = {
    gameEndpoint: { credential: gameCredential, kind: 'localhost', url: gameUrl },
  }
}, { gameCredential: credential, gameUrl: gameHost.address.url })

try {
  await seedLocalSave(page, seeded.record)
  await enterSavedHub(page)

  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor({ timeout: 10_000 })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const sackAudioBefore = {
    close: await inventorySoundCount(page, 'backpack-close.wav'),
    open: await inventorySoundCount(page, 'backpack-open.wav'),
  }

  const item = (id) => inventory.locator(`[data-inventory-item-id="${id}"]`)
  const backpackItem = (id) => inventory.locator(
    `[data-inventory-owner="backpack"][data-inventory-item-id="${id}"]`,
  )
  const equipmentSlot = (slot) => inventory.locator(`[data-equipment-slot="${slot}"]`).first()

  await backpackItem(IDS.clickRingOne).click()
  await backpackItem(IDS.clickRingOne).locator('xpath=self::*[@data-selected="true"]').waitFor()
  await equipmentSlot('ring-0').click()
  await waitForSavedEconomy(page, (economy) => (
    economy.equipment.rings[0]?.id === IDS.clickRingOne
  ))
  await inventory.locator(
    `[data-inventory-owner="equipment"][data-equipment-slot="ring-0"]`
      + `[data-inventory-item-id="${IDS.clickRingOne}"]`,
  ).waitFor()

  await backpackItem(IDS.clickRingTwo).click()
  await equipmentSlot('hat').click()
  await inventory.locator(
    `xpath=self::*[@data-native-inventory-selection="backpack:${IDS.clickRingTwo}"]`,
  ).waitFor()
  assert.equal((await savedEconomy(page)).equipment.rings[0]?.id, IDS.clickRingOne)

  await equipmentSlot('ring-0').click()
  await waitForSavedEconomy(page, (economy) => (
    economy.equipment.rings[0]?.id === IDS.clickRingTwo
    && flatten(economy.backpack).filter(({ id }) => id === IDS.clickRingOne).length === 1
  ))
  await inventory.locator('[data-inventory-empty-space="true"]').click({
    position: { x: 800, y: 450 },
  })
  await inventory.locator('xpath=self::*[@data-native-inventory-selection=""]').waitFor()

  const equippedRingTwo = inventory.locator(
    `[data-inventory-owner="equipment"][data-equipment-slot="ring-0"]`
      + `[data-inventory-item-id="${IDS.clickRingTwo}"]`,
  ).first()
  await dragToStagePoint(page, inventory, equippedRingTwo, { x: 1_200, y: 750 })
  await waitForSavedEconomy(page, (economy) => (
    economy.equipment.rings[0] === null
    && flatten(economy.backpack).filter(({ id }) => id === IDS.clickRingTwo).length === 1
  ))
  await dragTo(page, backpackItem(IDS.clickRingOne), equipmentSlot('ring-1'))
  await waitForSavedEconomy(page, (economy) => (
    economy.equipment.rings[1]?.id === IDS.clickRingOne
  ))
  await page.screenshot({ path: `${screenshotRoot}-inventory-equip-interactions.png` })

  assert.equal(await item(IDS.rootKey).getAttribute('data-parent-sack-id'), '')
  assert.equal(await item(IDS.movableKey).count(), 0)

  await openSack(page, inventory, item(IDS.destinationSack), IDS.destinationSack)
  assert.equal(await inventory.locator('[data-inventory-owner="backpack"]').count(), 0)
  await returnFromSack(inventory, '')

  await dragTo(page, item(IDS.rootKey), item(IDS.sourceSack))
  await item(IDS.rootKey).waitFor({ state: 'detached' })

  await openSack(page, inventory, item(IDS.sourceSack), IDS.sourceSack)
  await waitForParent(item(IDS.movableKey), IDS.sourceSack)
  await dragToStagePoint(page, inventory, item(IDS.movableKey), { x: 1_200, y: 750 })
  await item(IDS.movableKey).waitFor({ state: 'detached' })
  await dragToStagePoint(page, inventory, item(IDS.movableSack), { x: 1_200, y: 750 })
  await item(IDS.movableSack).waitFor({ state: 'detached' })
  await returnFromSack(inventory, '')

  await dragTo(page, item(IDS.movableKey), item(IDS.destinationSack))
  await item(IDS.movableKey).waitFor({ state: 'detached' })
  await dragTo(page, item(IDS.movableSack), item(IDS.destinationSack))
  await item(IDS.movableSack).waitFor({ state: 'detached' })

  await openSack(page, inventory, item(IDS.destinationSack), IDS.destinationSack)
  await waitForParent(item(IDS.movableKey), IDS.destinationSack)
  await waitForParent(item(IDS.movableSack), IDS.destinationSack)
  await openSack(page, inventory, item(IDS.movableSack), IDS.movableSack, [IDS.destinationSack])
  assert.equal(
    await item(IDS.movableSackKey).getAttribute('data-parent-sack-id'),
    String(IDS.movableSack),
  )
  await returnFromSack(inventory, String(IDS.destinationSack))
  await dragToStagePoint(page, inventory, item(IDS.movableKey), { x: 1_200, y: 750 })
  await item(IDS.movableKey).waitFor({ state: 'detached' })
  await returnFromSack(inventory, '')
  await waitForParent(item(IDS.movableKey), null)

  await dragTo(page, item(IDS.mergePotion), item(IDS.mergeSack))
  await item(IDS.mergePotion).waitFor({ state: 'detached' })
  await openSack(page, inventory, item(IDS.mergeSack), IDS.mergeSack)
  await item(IDS.mergeStack)
    .locator('xpath=self::*[@aria-label="Health Potion, quantity 5"]')
    .waitFor()
  await page.screenshot({ path: `${screenshotRoot}-sack-movement.png` })
  await returnFromSack(inventory, '')

  await openSack(page, inventory, item(IDS.dyeCarrier), IDS.dyeCarrier)
  await openSack(page, inventory, item(IDS.dyeInnerSack), IDS.dyeInnerSack, [IDS.dyeCarrier])
  const dyeOne = item(IDS.dyeOne)
  await doubleActivate(page, dyeOne)
  await waitForDyePhase(inventory, 'mix')
  assert.equal(await inventory.locator('[data-native-dye-swatch]').count(), 18)
  await inventory.locator('[data-native-dye-swatch="0"]').click()
  await inventory.locator('[data-native-dye-swatch="0"][data-selected-pulse="true"]').waitFor()
  await page.waitForTimeout(225)
  assert.equal(
    await inventory.locator('[data-native-dye-swatch="0"]').getAttribute('data-selected-pulse'),
    'false',
  )
  assert.equal(
    await inventory.locator('.hub-inventory-native-canvas').getAttribute('data-native-dye-pulse'),
    '0.00',
  )
  await inventory.locator(`[data-native-dye-target="${IDS.target}"]`).click()
  await waitForDyePhase(inventory, 'layer')
  await inventory.getByRole('button', { name: 'Cancel layer choice' }).click()
  await waitForDyePhase(inventory, 'target')
  await inventory.getByRole('button', { name: 'Cancel Fabric Dye' }).click()
  await waitForDyeClosed(inventory)
  assert.equal(await item(IDS.dyeOne).count(), 1)
  assert.equal(await item(IDS.dyeTwo).count(), 1)
  const cancelledTarget = await savedTarget(page, IDS.target)
  assert.ok(cancelledTarget)
  assert.deepEqual(cancelledTarget.iconTints, seeded.initialStoredTints)
  assert.equal(await dyeAudioCount(page), 0)

  await doubleActivate(page, item(IDS.dyeOne))
  await waitForDyePhase(inventory, 'mix')
  for (const row of ALL_SWATCH_ROWS) {
    await inventory.locator(`[data-native-dye-swatch="${row}"]`).click()
  }
  assert.equal(
    await inventory.getAttribute('data-native-dye-selections'),
    ALL_SWATCH_ROWS.join(','),
  )
  await page.screenshot({ path: `${screenshotRoot}-dye-all-swatches.png` })
  await inventory.locator(`[data-native-dye-target="${IDS.target}"]`).click()
  await waitForDyePhase(inventory, 'layer')
  await waitForDyeSettled(inventory)
  await page.screenshot({ path: `${screenshotRoot}-dye-cloth-choice.png` })
  await inventory.getByRole('button', { name: 'Dye cloth' }).click()
  await waitForDyeClosed(inventory)
  await item(IDS.dyeOne).waitFor({ state: 'detached' })
  const expectedCloth = nativeDyeCommittedTint(ALL_SWATCH_ROWS)
  assert.notEqual(expectedCloth, null)
  await waitForSavedTarget(page, IDS.target, (target) => (
    target.iconTints?.[0] === expectedCloth
    && target.iconTints?.[1] === seeded.initialTints[1]
  ))
  assert.equal(await dyeAudioCount(page), 1)

  await doubleActivate(page, item(IDS.dyeTwo))
  await waitForDyePhase(inventory, 'mix')
  await inventory.locator('[data-native-dye-swatch="1"]').click()
  await inventory.locator('[data-native-dye-swatch="9"]').click()
  await inventory.locator(`[data-native-dye-target="${IDS.target}"]`).click()
  await waitForDyePhase(inventory, 'layer')
  await waitForDyeSettled(inventory)
  await page.screenshot({ path: `${screenshotRoot}-dye-trim-choice.png` })
  await inventory.getByRole('button', { name: 'Dye trim' }).click()
  await waitForDyeClosed(inventory)
  await item(IDS.dyeTwo).waitFor({ state: 'detached' })
  const expectedTrim = nativeDyeCommittedTint([1, 9])
  assert.notEqual(expectedTrim, null)
  const dyedTarget = await waitForSavedTarget(page, IDS.target, (target) => (
    target.iconTints?.[0] === expectedCloth && target.iconTints?.[1] === expectedTrim
  ))
  assert.deepEqual(dyedTarget.iconTints, [expectedCloth, expectedTrim])
  assert.equal(await dyeAudioCount(page), 2)

  await doubleActivate(page, item(IDS.target))
  await waitForSavedEconomy(page, (economy) => economy.equipment.robe?.id === IDS.target)
  await page.screenshot({ path: `${screenshotRoot}-dyed-robe-inventory.png` })
  await returnFromSack(inventory, String(IDS.dyeCarrier))
  await returnFromSack(inventory, '')
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'detached' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  await page.screenshot({ path: `${screenshotRoot}-dyed-robe-character.png` })

  const luthacusPrompt = page.locator('.game-interact-prompt[data-interaction-target="hub:luthacus"]')
  await luthacusPrompt.waitFor({ timeout: 10_000 })
  await luthacusPrompt.click()
  const dialogue = page.getByRole('dialog', { name: 'Talking to Luthacus' })
  await dialogue.waitFor()
  await dialogue.getByRole('button', { name: 'Skip' }).click()
  await dialogue.getByRole('button', { name: 'Done' }).waitFor()
  await dialogue.getByRole('button', { name: 'Examine Items' }).click()
  const storage = page.getByRole('dialog', { name: "LUTHACUS' SCAVENGED GOODS" })
  await storage.waitFor()
  await storage.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const storageKey = storage.locator(
    `[data-inventory-owner="storage"][data-inventory-item-id="${IDS.storageKey}"]`,
  )
  const storageSack = storage.locator(
    `[data-inventory-owner="storage"][data-inventory-item-id="${IDS.storageSack}"]`,
  )
  assert.equal(await storageKey.count(), 0)
  await storageSack.click()
  await storageSack.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await page.screenshot({ path: `${screenshotRoot}-take-click-again.png` })
  await storage.locator('[data-store-empty-slot]').first().click()
  assert.equal(await storage.locator('[data-inventory-owner="storage"][data-selected="true"]').count(), 0)
  await doubleActivate(page, storageSack)
  await storageSack.waitFor({ state: 'detached' })
  const backpackStorageSack = storage.locator(
    `[data-inventory-owner="backpack"][data-inventory-item-id="${IDS.storageSack}"]`,
  )
  await backpackStorageSack.waitFor()
  await waitForSavedEconomy(page, (economy) => (
    flatten(economy.backpack).some(({ id }) => id === IDS.storageKey)
    && flatten(economy.backpack).some(({ id }) => id === IDS.storageSack)
    && flatten(economy.storage).every(({ id }) => id !== IDS.storageSack)
  ))
  await openSack(page, storage, backpackStorageSack, IDS.storageSack)
  const backpackStorageKey = storage.locator(
    `[data-inventory-owner="backpack"][data-inventory-item-id="${IDS.storageKey}"]`,
  )
  await backpackStorageKey.waitFor()
  assert.equal(await backpackStorageKey.getAttribute('data-parent-sack-id'), String(IDS.storageSack))
  await page.screenshot({ path: `${screenshotRoot}-luthacus-recursive-storage.png` })

  const sackAudio = {
    close: await inventorySoundCount(page, 'backpack-close.wav') - sackAudioBefore.close,
    open: await inventorySoundCount(page, 'backpack-open.wav') - sackAudioBefore.open,
  }
  assert.deepEqual(sackAudio, { close: 8, open: 8 })

  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    audioEvents: await dyeAudioCount(page),
    consoleErrors,
    dyedTarget: dyedTarget.iconTints,
    failedResponses,
    pageErrors,
    sackAudio,
    screenshots: [
      `${screenshotRoot}-inventory-equip-interactions.png`,
      `${screenshotRoot}-sack-movement.png`,
      `${screenshotRoot}-dye-all-swatches.png`,
      `${screenshotRoot}-dye-cloth-choice.png`,
      `${screenshotRoot}-dye-trim-choice.png`,
      `${screenshotRoot}-dyed-robe-inventory.png`,
      `${screenshotRoot}-dyed-robe-character.png`,
      `${screenshotRoot}-take-click-again.png`,
      `${screenshotRoot}-luthacus-recursive-storage.png`,
    ],
    status: 'ok',
    swatches: ALL_SWATCH_ROWS,
  }, null, 2)}\n`)
} finally {
  await browser.close()
  await gameHost.close()
  await staticServer.close()
}

function createSeededSave() {
  const initial = createGameSimulation({ [SAVE_PLAYER_ID]: CHARACTER })
  const economy = getPlayerEconomy(initial, SAVE_PLAYER_ID)
  const robeRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ iconTints, type }) => (
    type === 'robe' && iconTints.every((tint) => tint !== null)
  ))
  if (!robeRecipe) throw new Error('Sack/Dye acceptance requires a tinted native robe recipe')
  const ringRecipes = DOWSING_EQUIPMENT_RECIPES.filter(({ type }) => type === 'ring')
  if (ringRecipes.length < 2) throw new Error('Inventory acceptance requires two native ring recipes')
  const target = createEquipmentInventoryItem(robeRecipe, IDS.target)
  const clickRingOne = createEquipmentInventoryItem(ringRecipes[0], IDS.clickRingOne)
  const clickRingTwo = createEquipmentInventoryItem(ringRecipes[1], IDS.clickRingTwo)
  const rootKey = inventoryItem(IDS.rootKey, 'Wizard Key', 'key', 7012, 1, [43])
  const movableKey = inventoryItem(IDS.movableKey, 'Wizard Key', 'key', 7012, 1, [43])
  const movableSackKey = inventoryItem(
    IDS.movableSackKey,
    'Wizard Key',
    'key',
    7012,
    1,
    [43],
  )
  const movableSack = sack(IDS.movableSack, 'Movable Sack', [movableSackKey])
  const sourceSack = sack(IDS.sourceSack, 'Source Sack', [movableKey, movableSack])
  const destinationSack = sack(IDS.destinationSack, 'Destination Sack', [])
  const dyeOne = inventoryItem(IDS.dyeOne, 'Fabric Dye Kit', 'dye', 7012, 0, [42])
  const dyeTwo = inventoryItem(IDS.dyeTwo, 'Fabric Dye Kit', 'dye', 7012, 0, [42])
  const dyeInnerSack = sack(IDS.dyeInnerSack, 'Dye Inner Sack', [dyeOne, dyeTwo, target])
  const dyeCarrier = sack(IDS.dyeCarrier, 'Dye Carrier', [dyeInnerSack])
  const storageKey = inventoryItem(IDS.storageKey, 'Wizard Key', 'key', 7012, 1, [43])
  const storageSack = sack(IDS.storageSack, 'Storage Sack', [storageKey])
  const mergePotion = inventoryItem(
    IDS.mergePotion,
    'Health Potion',
    'health-potion',
    7001,
    0,
    [46],
    undefined,
    2,
  )
  const mergeStack = inventoryItem(
    IDS.mergeStack,
    'Health Potion',
    'health-potion',
    7001,
    0,
    [46],
    undefined,
    3,
  )
  const mergeSack = sack(IDS.mergeSack, 'Potion Sack', [mergeStack])
  const seededEconomy = {
    ...economy,
    backpack: [
      rootKey,
      sourceSack,
      destinationSack,
      dyeCarrier,
      mergePotion,
      mergeSack,
      clickRingOne,
      clickRingTwo,
    ],
    collegeIntroPending: false,
    nextItemId: 50_000,
    storage: [storageSack],
  }
  const playerEntities = replacePlayerEconomy(
    initial.playerEntities,
    SAVE_PLAYER_ID,
    seededEconomy,
  )
  const playerIndex = playerEntities.identities.findIndex(({ playerId }) => (
    playerId === SAVE_PLAYER_ID
  ))
  const traderPosition = HUB_TRADER_GEOMETRY.luthacus.position
  const positionedEntities = {
    ...playerEntities,
    locomotions: playerEntities.locomotions.map((locomotion, index) => index === playerIndex
      ? {
          ...locomotion,
          position: { x: traderPosition.x - 30, y: traderPosition.y },
          velocity: { x: 0, y: 0 },
        }
      : locomotion),
  }
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId: SAVE_PLAYER_ID,
    state: {
      ...initial,
      playerEntities: positionedEntities,
      world: initial.world.kind === 'hub'
        ? {
            ...initial.world,
            participants: Object.fromEntries(Object.entries(initial.world.participants).map(
              ([playerId, participant]) => [playerId, {
                ...participant,
                collegeIntro: null,
                region: 'courtyard',
                transition: null,
              }],
            )),
          }
        : initial.world,
    },
  })
  return {
    initialStoredTints: target.iconTints,
    initialTints: robeRecipe.iconTints,
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

function inventoryItem(
  id,
  name,
  kind,
  nativeTypeId,
  nativeSubtype,
  iconRecords,
  contents,
  quantity = 1,
) {
  return {
    ...(contents === undefined ? {} : { contents }),
    equipmentType: null,
    iconRecords,
    id,
    kind,
    name,
    nativeSelector: nativeSubtype,
    nativeSubtype,
    nativeTypeId,
    quantity,
    rarity: null,
    recipeIndex: null,
  }
}

function sack(id, name, contents) {
  return inventoryItem(id, name, 'sack', 7008, 0, [70], contents)
}

async function seedLocalSave(target, record) {
  await target.goto(new URL('/', baseUrl).href, { waitUntil: 'domcontentloaded' })
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
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    }
  }), record)
}

async function enterSavedHub(target) {
  await target.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await target.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await target.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await target.getByRole('button', { name: 'Play' }).click()
  const lastGame = target.getByRole('button', { name: 'Last game' })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  await target.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
}

async function dragTo(targetPage, source, destination) {
  const box = await destination.boundingBox()
  assert.ok(box, 'Sack/Dye drag destination has no browser geometry')
  await dragToPoint(targetPage, source, {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  })
}

async function dragToStagePoint(targetPage, dialog, source, point) {
  const stage = await dialog.boundingBox()
  assert.ok(stage, 'Sack/Dye native stage has no browser geometry')
  await dragToPoint(targetPage, source, {
    x: stage.x + point.x * stage.width / 1_600,
    y: stage.y + point.y * stage.height / 900,
  })
}

async function dragToPoint(targetPage, source, point) {
  const box = await source.boundingBox()
  assert.ok(box, 'Sack/Dye drag source has no browser geometry')
  await targetPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await targetPage.mouse.down()
  await targetPage.mouse.move(point.x, point.y, { steps: 12 })
  await targetPage.mouse.up()
}

async function doubleActivate(targetPage, target) {
  const box = await target.boundingBox()
  assert.ok(box, 'Sack/Dye activation target has no browser geometry')
  await targetPage.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
}

async function openSack(targetPage, inventory, target, sackId, parentPath = []) {
  await doubleActivate(targetPage, target)
  const path = [...parentPath, sackId].join('/')
  await inventory.locator(`xpath=self::*[@data-native-sack-path="${path}"]`).waitFor()
  await inventory.locator('xpath=self::*[@data-native-sack-transition=""]').waitFor({
    timeout: 5_000,
  })
}

async function returnFromSack(inventory, path) {
  await inventory.locator('[data-inventory-resume="true"]').click()
  await inventory.locator(`xpath=self::*[@data-native-sack-path="${path}"]`).waitFor()
  await inventory.locator('xpath=self::*[@data-native-sack-transition=""]').waitFor({
    timeout: 5_000,
  })
}

async function waitForParent(target, parentSackId) {
  await target.locator(`xpath=self::*[@data-parent-sack-id="${parentSackId ?? ''}"]`).waitFor()
}

async function waitForDyePhase(inventory, phase) {
  await inventory.locator(`[data-native-dye-phase="${phase}"]`).waitFor({ state: 'attached' })
}

async function waitForDyeSettled(inventory) {
  await inventory.locator(
    '.hub-inventory-native-canvas[data-native-dye-opacity="1.00"]',
  ).waitFor()
}

async function waitForDyeClosed(inventory) {
  await inventory.locator('[data-native-dye-phase]').waitFor({ state: 'detached' })
  await inventory.locator('xpath=self::*[@data-native-dye-modal=""]').waitFor()
}

async function dyeAudioCount(targetPage) {
  return targetPage.evaluate(() => window.__sdrAudioEvents.filter((event) => (
    (event.type === 'buffer-start' || event.type === 'play')
    && window.__sdrAudioSourceMatches(event.src, 'dye.wav')
  )).length)
}

async function inventorySoundCount(targetPage, source) {
  return targetPage.evaluate((filename) => window.__sdrAudioEvents.filter((event) => (
    (event.type === 'buffer-start' || event.type === 'play')
    && window.__sdrAudioSourceMatches(event.src, filename)
  )).length, source)
}

async function savedTarget(targetPage, itemId) {
  const economy = await savedEconomy(targetPage)
  return flatten(economy.backpack).find(({ id }) => id === itemId) ?? null
}

async function waitForSavedTarget(targetPage, itemId, predicate) {
  let matched = null
  await waitForSavedEconomy(targetPage, (economy) => {
    const target = flatten(economy.backpack).find(({ id }) => id === itemId) ?? null
    if (!target || !predicate(target)) return false
    matched = target
    return true
  })
  return matched
}

async function waitForSavedEconomy(targetPage, predicate) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const economy = await savedEconomy(targetPage)
    if (predicate(economy)) return economy
    await targetPage.waitForTimeout(100)
  }
  throw new Error('timed out waiting for the Sack/Dye save checkpoint')
}

async function savedEconomy(targetPage) {
  const record = await targetPage.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    }
  }))
  if (!record) throw new Error('Sack/Dye local save is missing')
  return JSON.parse(record.document).continuation.simulation.playerEntities.economies[0]
}

function flatten(items) {
  return items.flatMap((item) => [item, ...flatten(item.contents ?? [])])
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

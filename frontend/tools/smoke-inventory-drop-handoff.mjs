import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { HUB_INVENTORY_GRID, hubInventorySlotPosition } from '../src/game/renderer/hub-inventory-render-contract.ts'

const screenshotRoot = process.env.SDR_INVENTORY_DROP_SCREENSHOT_ROOT
  || await mkdtemp(join(tmpdir(), 'solomon-inventory-drop-'))
await mkdir(screenshotRoot, { recursive: true })
const receipts = []
const playerId = 'inventory-drop-owner'
const ringId = 40_001
const character = { discipline: 'arcane', displayName: 'Drop', element: 'ether' }
const initial = createGameSimulation({ [playerId]: character })
const economy = getPlayerEconomy(initial, playerId)
const ring = {
  id: ringId,
  equipmentType: 'ring',
  generatedLevel: 0,
  iconRecords: [52],
  kind: 'equipment',
  name: 'Ring of Managrind',
  nativeEffects: [{ kind: 9, magnitude: 1, operator: 0, target: 0 }],
  nativeSelector: 0,
  nativeSubtype: null,
  nativeTypeId: 7002,
  quantity: 1,
  rarity: null,
  recipeIndex: null,
}
const document = createGameSaveDocument({
  integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId,
  state: {
    ...initial,
    world: {
      ...initial.world,
      participants: Object.fromEntries(Object.entries(initial.world.participants).map(([id, participant]) => (
        [id, { ...participant, collegeIntro: null, region: 'courtyard', transition: null }]
      ))),
    },
    playerEntities: replacePlayerEconomy(initial.playerEntities, playerId, {
      ...economy, backpack: [{ ...ring, inventorySlot: 0 }], collegeIntroPending: false, tutorialPending: false,
      equipment: { ...economy.equipment, rings: [null, null, null] },
      nextItemId: 50_000,
    }),
  },
})
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = 'inventory-drop-browser-acceptance'
const host = await startGameHost({
  allowedOrigins: [server.origin], authentication: { kind: 'shared', credential }, snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.setDefaultTimeout(15_000)
const errors = { console: [], page: [], responses: [] }
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('pageerror', error => errors.page.push(error.message))
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
let holdingSnapshots = false
let pendingMessages = []
let socket
await page.routeWebSocket(host.address.url, ws => {
  socket = ws
  const serverSocket = ws.connectToServer()
  serverSocket.onMessage(message => {
    if (holdingSnapshots) pendingMessages.push(message)
    else ws.send(message)
  })
})
function releaseSnapshots() {
  holdingSnapshots = false
  for (const message of pendingMessages) socket.send(message)
  pendingMessages = []
}
await page.addInitScript(({ credential: gameCredential, url }) => {
  window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', credential: gameCredential, url } }
}, { credential, url: host.address.url })
try {
  await page.goto(server.origin)
  await page.evaluate(record => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' })
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(record)
      transaction.oncomplete = () => { open.result.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  }), { document, revision: 1, slot: WEB_GAME_SAVE_SLOT })
  await page.goto(`${server.origin}/game`)
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await exerciseInventory(inventory, 'hub')
  await closeInventory(inventory)
  for (const [trader, title] of [
    ['Fomentius', "FOMENTIUS' USEFUL THYNGS"],
    ['Luthacus', "LUTHACUS' SCAVENGED GOODS"],
    ['Shlorio', "SHLORIO'S DISCOUNT DOWSING"],
  ]) {
    await page.getByRole('button', { name: `Open ${trader} interaction`, exact: true }).click()
    const service = page.getByRole('dialog', { name: title, exact: true })
    await exerciseInventory(service, trader.toLowerCase())
    await service.getByRole('button', { name: 'Done', exact: true }).click()
    await service.waitFor({ state: 'hidden' })
    await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  }
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: /Open inventory/ }).click()
  await exerciseInventory(inventory, 'boneyard')
  await closeInventory(inventory)
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
  console.log(JSON.stringify({ receipts, errors, screenshotRoot, status: 'ok' }))
} catch (error) {
  console.log(JSON.stringify({ body: await page.locator('body').innerText(), errors }))
  await page.screenshot({ path: join(screenshotRoot, 'failure.png') })
  throw error
} finally {
  await browser.close()
  await host.close()
  await server.close()
}

async function exerciseInventory(inventory, scene) {
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const source = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ringId}"]`)
  const point = await cellCenter(inventory, 8)
  const box = await source.boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  const clip = { x: box.x + 14, y: box.y + 14, width: box.width - 28, height: box.height - 28 }
  const held = await pixelHash(clip, `${scene}-held`)
  holdingSnapshots = true
  const sequence = getPlayerEconomy(host.state(), host.hostPlayerId()).actionFeedback?.sequence ?? 0
  await page.mouse.up()
  await waitForHostFeedback(sequence)
  const released = await pixelHash(clip, `${scene}-released`)
  assert.equal(released, held, `${scene}: released item flashed in its previous slot before host feedback`)
  releaseSnapshots()
  await source.locator('xpath=self::*[@data-inventory-slot="8"]').waitFor()
  receipts.push({ scene, sourceSuppressedUntilFeedback: true, destinationSlot: 8 })
}

async function cellCenter(inventory, slot) {
  const stage = await inventory.boundingBox()
  const cell = hubInventorySlotPosition(slot)
  assert.ok(stage)
  return {
    x: stage.x + (cell.x + HUB_INVENTORY_GRID.cellSize / 2) * stage.width / 1600,
    y: stage.y + (cell.y + HUB_INVENTORY_GRID.cellSize / 2) * stage.height / 900,
  }
}

async function pixelHash(clip, name) {
  const image = await page.screenshot({ clip, path: join(screenshotRoot, `${name}.png`) })
  return createHash('sha256').update(image).digest('hex')
}

async function waitForHostFeedback(sequence) {
  const deadline = Date.now() + 5_000
  while ((getPlayerEconomy(host.state(), host.hostPlayerId()).actionFeedback?.sequence ?? 0) <= sequence) {
    assert.ok(Date.now() < deadline, 'host did not process the release')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

async function closeInventory(inventory) {
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await inventory.waitFor({ state: 'hidden' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
}

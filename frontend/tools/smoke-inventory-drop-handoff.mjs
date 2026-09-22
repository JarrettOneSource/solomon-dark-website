import assert from 'node:assert/strict'
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
import { HUB_INVENTORY_GRID, HUB_SHOP_GRID, HUB_UNFORGE_TARGET, hubInventorySlotPosition } from '../src/game/renderer/hub-inventory-render-contract.ts'
import { DOWSING_EQUIPMENT_RECIPES, createEquipmentInventoryItem, findInventoryItem } from '../src/game/core-kernels/hub-economy.ts'

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
const equipmentCases = [
  ['hat', 40_002], ['robe', 40_003], ['staff', 40_004],
  ['wand', 40_005], ['amulet', 40_006],
].map(([type, id], index) => ({
  ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES.find(recipe => recipe.type === type && recipe.level === 0), id),
  inventorySlot: index + 1,
}))
const potion = economy.backpack.find(item => item.kind === 'mana-potion')
assert.ok(potion)
const makeSack = (id, inventorySlot, contents = []) => ({
  ...potion, id, inventorySlot, contents, iconRecords: [70], kind: 'sack',
  name: 'Sack', nativeSubtype: 0, nativeTypeId: 7008, quantity: 1,
})
const backpack = [
  { ...ring, inventorySlot: 0 }, ...equipmentCases,
  { ...ring, id: 40_007, inventorySlot: 6, generatedLevel: 50 },
  { ...potion, id: 40_008, inventorySlot: 7, quantity: 1 },
  { ...potion, id: 40_009, inventorySlot: 8, quantity: 1 },
  makeSack(40_010, 9, [makeSack(40_011, 0)]),
  { ...ring, id: 40_012, inventorySlot: 10 },
  makeSack(40_013, 11),
]
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
      ...economy, backpack, ownedPerkSelectors: [19], storage: [{ ...ring, id: 40_020 }], collegeIntroPending: false, tutorialPending: false,
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
  await teardownHandoff(inventory)
  await closeInventory(inventory)
  for (const [trader, title] of [
    ['Fomentius', "FOMENTIUS' USEFUL THYNGS"],
    ['Hagatha', "HAGATHA'S CHARMS AND CURSES"],
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
  console.log(JSON.stringify({ receipts, body: await page.locator('body').innerText(), errors }))
  await page.screenshot({ path: join(screenshotRoot, 'failure.png') })
  throw error
} finally {
  releaseSnapshots()
  await browser.close()
  await host.close()
  await server.close()
}

async function exerciseInventory(inventory, scene) {
  await inventory.locator('xpath=self::*[@data-renderer-state="ready"]').waitFor()
  // A retained canvas can still expose the previous surface's settled flag
  // until this owner's first presentation frame starts its native reveal.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const item = (id, owner = 'backpack') => inventory.locator(`[data-inventory-owner="${owner}"][data-inventory-item-id="${id}"]`).first()
  const equipment = slot => inventory.locator(`[data-equipment-slot="${slot}"]`).first()
  const slot = Number(await item(ringId).getAttribute('data-inventory-slot')) === 20 ? 21 : 20
  await releaseItem(inventory, item(ringId), await cellCenter(inventory, slot), `${scene}-blank`)
  assert.equal(Number(await item(ringId).getAttribute('data-inventory-slot')), slot)
  await releaseItem(inventory, item(ringId), await center(equipment('ring-0')), `${scene}-equip`)
  await item(ringId, 'equipment').waitFor()
  await releaseItem(inventory, item(ringId, 'equipment'), await cellCenter(inventory, 25), `${scene}-unequip`)
  await item(ringId).waitFor()
  if (scene === 'hub') {
    for (const slot of ['ring-1', 'ring-2']) {
      await releaseItem(inventory, item(ringId), await center(equipment(slot)), `hub-${slot}`)
      await releaseItem(inventory, item(ringId, 'equipment'), await cellCenter(inventory, 25), `hub-${slot}-remove`)
    }
    for (const entry of equipmentCases) {
      const slot = ['staff', 'wand'].includes(entry.equipmentType) ? 'weapon' : entry.equipmentType
      await releaseItem(inventory, item(entry.id), await center(equipment(slot)), `hub-${entry.equipmentType}`)
      await item(entry.id, 'equipment').waitFor()
    }
    await releaseItem(inventory, item(40_012), await center(equipment('ring-0')), 'hub-occupied-setup')
    await releaseItem(inventory, item(ringId), await center(equipment('ring-0')), 'hub-occupied-equipment')
    assert.ok(findInventoryItem(currentEconomy().backpack, 40_012))
    await releaseItem(inventory, item(ringId, 'equipment'), await cellCenter(inventory, 25), 'hub-occupied-remove')
    await releaseItem(inventory, item(40_007), await center(equipment('ring-0')), 'hub-rejected-level', false)
    await releaseItem(inventory, item(40_008), await center(item(40_009)), 'hub-stack')
    assert.equal(findInventoryItem(currentEconomy().backpack, 40_009).quantity, 2)
    await releaseItem(inventory, item(ringId), await center(item(40_012)), 'hub-ordinary-swap', true, true)
    await releaseItem(inventory, item(ringId), await center(item(40_010)), 'hub-sack')
    await openSack(inventory, item(40_010), '40010')
    await releaseItem(inventory, item(ringId), await center(item(40_011)), 'hub-nested-sack')
    await openSack(inventory, item(40_011), '40010/40011')
    await releaseItem(inventory, item(ringId), await cellCenter(inventory, 12), 'hub-nested-blank')
    await releaseItem(inventory, item(ringId), await cellCenter(inventory, 0), 'hub-nested-parent')
    await inventory.getByRole('button', { name: 'Return to parent inventory', exact: true }).click()
    await waitForSack(inventory, '40010')
    await releaseItem(inventory, item(ringId), await cellCenter(inventory, 0), 'hub-root-parent')
    await inventory.getByRole('button', { name: 'Return to parent inventory', exact: true }).click()
    await waitForSack(inventory, '')
    await releaseItem(inventory, item(40_013), await stagePoint(inventory, ...HUB_UNFORGE_TARGET.center), 'hub-empty-sack-unforge')
    assert.equal(findInventoryItem(currentEconomy().backpack, 40_013), null)
    await inventory.getByRole('button', { name: 'OKAY', exact: true }).click()
    await protectedClothing(inventory)
    await restoreAndCancel(inventory, item(ringId))
  }
  if (scene === 'luthacus') {
    await releaseItem(inventory, item(ringId), await stagePoint(inventory, HUB_SHOP_GRID.left + 36, HUB_SHOP_GRID.top + 36), 'storage-deposit')
    await item(ringId, 'storage').waitFor()
    await releaseItem(inventory, item(ringId, 'storage'), await cellCenter(inventory, 25), 'storage-withdraw')
    await item(ringId).waitFor()
  }
  await page.screenshot({ path: join(screenshotRoot, `${scene}-inventory.png`) })
}

function currentEconomy() {
  return getPlayerEconomy(host.state(), host.hostPlayerId())
}

async function releaseItem(inventory, source, point, name, accepted = true, flyby = false) {
  await source.locator('xpath=self::*[not(@disabled)]').waitFor()
  const box = await source.boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  const clip = { x: box.x + 14, y: box.y + 14, width: Math.max(1, box.width - 28), height: Math.max(1, box.height - 28) }
  const held = await captureSourcePixels(clip, `${name}-held`)
  holdingSnapshots = true
  const sequence = currentEconomy().actionFeedback?.sequence ?? 0
  await page.mouse.up()
  await waitForHostFeedback(sequence)
  if (flyby) await page.waitForTimeout(150) // Native trailing fades finish at tick 29.
  const released = await captureSourcePixels(clip, `${name}-released`)
  const maxChannelDifference = pixelDifference(released, held)
  // Companion reveal can still change the dark slot by up to five levels.
  // A returning item changes foreground channels by over 100 levels.
  assert.ok(maxChannelDifference <= 8, `${name}: released item flashed in its previous slot before host feedback (${maxChannelDifference})`)
  assert.equal(currentEconomy().actionFeedback.accepted, accepted, `${name}: wrong host result`)
  releaseSnapshots()
  await page.waitForFunction(() => {
    const stage = document.querySelector('.hub-native-ui-stage')
    return stage?.getAttribute('data-native-inventory-dragging') === ''
      && !stage.querySelector('[data-inventory-item-id][disabled]')
  })
  if (!accepted) assert.ok(pixelDifference(await captureSourcePixels(clip, `${name}-restored`), held) > 8)
  receipts.push({ name, sourceSuppressedUntilFeedback: true, accepted, maxChannelDifference })
}

async function openSack(inventory, source, path) {
  await source.dblclick()
  await waitForSack(inventory, path)
}

async function waitForSack(inventory, path) {
  await page.waitForFunction(path => {
    const stage = document.querySelector('.hub-native-ui-stage')
    return stage?.getAttribute('data-native-sack-path') === path
      && stage.getAttribute('data-native-sack-transition') === ''
  }, path)
}

async function protectedClothing(inventory) {
  for (const [slot, id] of [['hat', 40_002], ['robe', 40_003]]) {
    const source = inventory.locator(`[data-inventory-owner="equipment"][data-inventory-item-id="${id}"]`).first()
    const point = await stagePoint(inventory, 750, 420)
    await page.mouse.click(point.x, point.y)
    const from = await center(source)
    const to = await cellCenter(inventory, 25)
    const sequence = currentEconomy().actionFeedback.sequence
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.mouse.up()
    await inventory.getByRole('button', { name: 'OKAY', exact: true }).click()
    assert.equal(currentEconomy().actionFeedback.sequence, sequence)
    assert.equal(currentEconomy().equipment[slot].id, id)
    receipts.push({ name: `${slot}-removal-refused`, noMutation: true })
  }
}

async function teardownHandoff(inventory) {
  const source = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ringId}"]`)
  const from = await center(source)
  const to = await cellCenter(inventory, 30)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  holdingSnapshots = true
  const sequence = currentEconomy().actionFeedback.sequence
  await page.mouse.up()
  await waitForHostFeedback(sequence)
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await inventory.waitFor({ state: 'hidden' })
  releaseSnapshots()
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  await page.getByRole('button', { name: /Open inventory/ }).click()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  assert.equal(await inventory.getAttribute('data-native-inventory-dragging'), '')
  assert.equal(await source.getAttribute('data-inventory-slot'), '30')
  receipts.push({ name: 'close-pending-drop-and-reopen', noLeakedDrag: true })
}

async function restoreAndCancel(inventory, source) {
  const sequence = currentEconomy().actionFeedback.sequence
  const point = await stagePoint(inventory, 750, 420)
  await page.mouse.move(...Object.values(await center(source)))
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(350)
  assert.equal(currentEconomy().actionFeedback.sequence, sequence)
  await source.locator('xpath=self::*[not(@disabled)]').waitFor()
  await page.mouse.move(...Object.values(await center(source)))
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  await source.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })
  await page.mouse.up()
  assert.equal(currentEconomy().actionFeedback.sequence, sequence)
  receipts.push({ name: 'invalid-restore-and-pointer-cancel', noMutation: true })
}

async function center(locator) {
  const box = await locator.boundingBox()
  assert.ok(box)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function stagePoint(inventory, x, y) {
  const stage = await inventory.boundingBox()
  assert.ok(stage)
  return { x: stage.x + x * stage.width / 1600, y: stage.y + y * stage.height / 900 }
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

async function captureSourcePixels(clip, name) {
  const image = await page.screenshot({ clip, path: join(screenshotRoot, `${name}.png`) })
  return page.evaluate(async encoded => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
  }, image.toString('base64'))
}

function pixelDifference(a, b) {
  assert.equal(a.length, b.length)
  return a.reduce((peak, value, index) => Math.max(peak, Math.abs(value - b[index])), 0)
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

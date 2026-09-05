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
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { HUB_INVENTORY_GRID, HUB_PRIMARY_SPELL_PANE, hubInventorySlotPosition } from '../src/game/renderer/hub-inventory-render-contract.ts'

const screenshotRoot = process.env.SDR_INVENTORY_STATS_SCREENSHOT_ROOT
  || await mkdtemp(join(tmpdir(), 'solomon-inventory-stats-'))
await mkdir(screenshotRoot, { recursive: true })
const receipts = []
const playerId = 'inventory-stats-owner'
const ringId = 40_001
const character = { discipline: 'arcane', displayName: 'Stats', element: 'ether' }
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
      ...economy, backpack: [], collegeIntroPending: false, tutorialPending: false,
      equipment: { ...economy.equipment, rings: [ring, null, null] },
      nextItemId: 50_000,
    }),
  },
})
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = 'inventory-stats-browser-acceptance'
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
  const canvas = inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]')
  await canvas.waitFor()
  await waitForRecovery(canvas, 11)
  const equippedRing = inventory.locator(`[data-inventory-owner="equipment"][data-inventory-item-id="${ringId}"]`)
  const backpackRing = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ringId}"]`)
  for (const gesture of ['double-activation', 'drag']) {
    await equippedRing.waitFor()
    const equippedPixels = await captureRecovery(canvas, scene, `${scene}-${gesture}-equipped`)
    if (gesture === 'double-activation') await equippedRing.dblclick()
    else {
      const stage = await inventory.boundingBox()
      const cell = hubInventorySlotPosition(5)
      assert.ok(stage)
      await dragTo(equippedRing, {
        x: stage.x + (cell.x + HUB_INVENTORY_GRID.cellSize / 2) * stage.width / 1600,
        y: stage.y + (cell.y + HUB_INVENTORY_GRID.cellSize / 2) * stage.height / 900,
      })
    }
    await backpackRing.waitFor()
    await waitForRecovery(canvas, 10)
    const removed = JSON.parse(await canvas.getAttribute('data-native-primary-spell-lines'))
    const id = host.hostPlayerId()
    const authoritative = createGameSnapshot(host.state(), id).players[id].progression.inventoryStats
    assert.equal(authoritative.manaRecoveryPerSecond, 10)
    assert.equal(removed[3].text, 'mana heal: 10.0', `${scene}: removal must refresh the open inventory`)
    const removedPixels = await captureRecovery(canvas, scene, `${scene}-${gesture}-removed`)
    assert.notEqual(removedPixels, equippedPixels, `${scene}: the visible recovery text must change after removal`)
    const target = await inventory.locator('[data-equipment-slot="ring-0"]').boundingBox()
    assert.ok(target)
    await dragTo(backpackRing, { x: target.x + target.width / 2, y: target.y + target.height / 2 })
    await equippedRing.waitFor()
    await waitForRecovery(canvas, 11)
    receipts.push({ scene, gesture, equippedRecovery: 11, removedRecovery: 10, reequippedRecovery: 11 })
  }
}

async function captureRecovery(canvas, scene, name) {
  const image = await canvas.screenshot({ path: join(screenshotRoot, `${name}.png`) })
  const [left, top, width, height] = HUB_PRIMARY_SPELL_PANE.bodyRect
  const pixels = await page.evaluate(async ({ encoded, rect }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const decoded = document.createElement('canvas')
    decoded.width = image.width
    decoded.height = image.height
    const context = decoded.getContext('2d')
    context.drawImage(image, 0, 0)
    return Array.from(context.getImageData(...rect).data)
  }, {
    encoded: image.toString('base64'),
    rect: [left + (scene === 'hub' || scene === 'boneyard' ? 0 : HUB_PRIMARY_SPELL_PANE.companionShift), top, width / 2, height],
  })
  assert.ok(pixels.some((value, index) => index % 4 !== 3 && value !== 0), `${scene}: the primary stats pane must be visible`)
  return createHash('sha256').update(Buffer.from(pixels)).digest('hex')
}

async function waitForRecovery(canvas, expected) {
  await page.waitForFunction(({ selector, text }) => {
    const serialized = document.querySelector(selector)?.getAttribute('data-native-primary-spell-lines')
    return serialized && JSON.parse(serialized)[3]?.text === text
  }, {
    selector: '.hub-inventory-native-canvas[data-native-reveal="settled"]',
    text: `mana heal: ${expected.toFixed(1)}`,
  })
  assert.equal(JSON.parse(await canvas.getAttribute('data-native-primary-spell-lines'))[3].text, `mana heal: ${expected.toFixed(1)}`)
}

async function dragTo(source, point) {
  const box = await source.boundingBox()
  assert.ok(box)
  await source.locator('xpath=self::*[not(@disabled)]').waitFor()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  await page.mouse.up()
}

async function closeInventory(inventory) {
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await inventory.waitFor({ state: 'hidden' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
}

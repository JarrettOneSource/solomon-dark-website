import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { createGameSimulation, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'
import { acceptItemSets, installActiveSetBonusProbe, inspectActiveSetBonusCard } from './item-set-smoke-acceptance.mjs'

const output = process.env.SDR_ACTIVE_SET_OUTPUT
assert.ok(output, 'SDR_ACTIVE_SET_OUTPUT must identify task-owned browser output')
await mkdir(output, { recursive: true })
const mobile = process.env.SDR_ACTIVE_SET_TOUCH === '1'
const server = process.env.SDR_ACTIVE_SET_CLIENT_URL ? null : await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const origin = process.env.SDR_ACTIVE_SET_CLIENT_URL?.replace(/\/$/, '') ?? server.origin
const owner = 'active-set-owner'
const config = { discipline: 'arcane', displayName: 'Sets', element: 'water' }
let initial = createGameSimulation({ [owner]: config })
const economy = getPlayerEconomy(initial, owner)
initial = { ...initial,
  world: { ...initial.world, participants: Object.fromEntries(Object.entries(initial.world.participants).map(([id, row]) =>
    [id, { ...row, collegeIntro: null, region: 'courtyard', transition: null }])) },
  playerEntities: replacePlayerEconomy(initial.playerEntities, owner, {
    ...economy, collegeIntroPending: false, tutorialPending: false,
  }),
}
const document = createGameSaveDocument({
  integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: owner, state: initial,
})
const credential = 'active-set-browser-acceptance'
const host = await startGameHost({
  allowedOrigins: [origin], authentication: { kind: 'shared', credential }, snapshotRate: 20,
  createBoneyardSeedBytes: () => Buffer.alloc(16),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage(mobile
  ? { viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
const touchSession = mobile ? await page.context().newCDPSession(page) : null
page.setDefaultTimeout(15_000)
const errors = { console: [], page: [], responses: [] }
const receipts = []
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('pageerror', error => errors.page.push(error.message))
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
await page.addInitScript(installActiveSetBonusProbe)
await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } },
  { kind: 'localhost', credential, url: host.address.url })
let failure = null
let failureContext = null
try {
  await page.route('**/__active_set_seed', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Active set save fixture</title>',
  }))
  if (!process.env.SDR_ACTIVE_SET_CLIENT_URL) await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await page.goto(`${origin}/__active_set_seed`)
  await page.evaluate(record => new Promise((resolveSave, reject) => {
    const request = indexedDB.open('solomon-dark-game-saves', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('slots', { keyPath: 'slot' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const transaction = request.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(record)
      transaction.oncomplete = () => { request.result.close(); resolveSave() }
      transaction.onerror = () => reject(transaction.error)
    }
  }), { document, revision: 1, slot: WEB_GAME_SAVE_SLOT })
  await page.goto(`${origin}/game`)
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  await activate(page.getByRole('button', { name: 'Play', exact: true }))
  await activate(page.getByRole('button', { name: 'Last game', exact: true }))
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]')
    .waitFor({ timeout: 90_000 })
  assert.equal(host.hostPlayerId(), owner)
  for (const scene of ['hub', 'boneyard']) {
    if (scene === 'boneyard') {
      await enterBoneyard(page)
      await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
    }
    const folder = join(output, scene)
    await mkdir(folder, { recursive: true })
    const sets = await acceptItemSets({ page, host, playerId: owner,
      waitUntil: (predicate, message) => waitUntil(predicate, message, 10_000), screenshotRoot: folder, activate })
    receipts.push({ scene, sets })
    await acceptCompatibleSets(scene)
  }
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
} catch (error) {
  failure = `${error.name}: ${error.message}`
  failureContext = {
    body: await page.locator('body').innerText(),
    surfaces: await page.locator('.hub-scene, .boneyard-scene, .hub-native-ui-stage').evaluateAll(nodes => (
      nodes.map(node => ({ className: node.className, data: { ...node.dataset } }))
    )),
    world: host.state().world.kind,
    run: host.state().run,
    economyFeedback: getPlayerEconomy(host.state(), owner).actionFeedback,
  }
  await page.screenshot({ path: join(output, 'failure.png') })
  throw error
} finally {
  await writeFile(join(output, 'receipt.json'), JSON.stringify({
    receipts, errors, failure, failureContext, mobile, origin, browser: browser.version(),
    qualification: 'Declared local continuation/backpack fixtures, real built client and authoritative equipment transactions. Touch is Chrome emulation, not a physical-device claim. Live URL uses the served production client with an isolated local acceptance host.',
  }, null, 2) + '\n')
  await browser.close()
  await host.close()
  await server?.close()
}

async function activate(target) {
  if (mobile) await target.tap()
  else await target.click()
}

async function openInventory() {
  await activate(page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]')
    .getByRole('button', { name: /Open inventory/ }))
}

async function acceptCompatibleSets(scene) {
  const original = getPlayerEconomy(host.state(), owner)
  const items = [20, 21, 22, 23, 24].map((recipe, inventorySlot) => ({
    ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[recipe], 80_000 + recipe), inventorySlot,
  }))
  const sack = {
    contents: [], equipmentType: null, iconRecords: [70], id: 80_100, inventorySlot: 5,
    kind: 'sack', name: 'Acceptance Sack', nativeSubtype: 0, nativeTypeId: 7008,
    quantity: 1, rarity: null, recipeIndex: null,
  }
  const state = host.state()
  Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, owner, {
    ...original, backpack: [...items, sack], nextItemId: 81_000, revision: original.revision + 1,
  }) })
  await openInventory()
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  let ring = 0
  for (const item of items) {
    const slot = item.equipmentType === 'ring' ? `ring-${ring++}` : item.equipmentType
    const cell = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${item.id}"]`)
    await activate(cell)
    await cell.locator('xpath=self::*[@data-selected="true"]').waitFor()
    await activate(inventory.locator(`[data-equipment-slot="${slot}"]`).first())
    await inventory.locator(`[data-equipment-slot="${slot}"][data-inventory-item-id="${item.id}"]`).first().waitFor()
  }
  const indicator = inventory.getByRole('status', { name: 'Active set bonuses' })
  const expected = ['Set Bonus Active:', 'Burning Man', 'Ring of fire explodes enemies',
    'Frostburn Jewels', 'Ring of Ice does frostburn damage', 'Water Cast Speed +10.0%']
  await indicator.waitFor({ state: 'attached' })
  assert.deepEqual(await indicator.locator('p').allTextContents(), expected)
  await activate(inventory.locator('[data-inventory-empty-space="true"]'))
  const visibleCard = await inspectActiveSetBonusCard(page)
  await page.screenshot({ path: join(output, `${scene}-compatible.png`) })
  const sackCell = inventory.locator('[data-inventory-owner="backpack"][data-inventory-item-id="80100"]')
  if (mobile) {
    const box = await sackCell.boundingBox()
    assert.ok(box)
    await Promise.all(['touchStart', 'touchEnd', 'touchStart', 'touchEnd'].map(type => (
      touchSession.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{
          x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1,
        }],
      })
    )))
  } else await sackCell.dblclick()
  await inventory.locator('xpath=self::*[@data-native-sack-path="80100"][@data-native-sack-transition=""]').waitFor()
  assert.deepEqual(await indicator.locator('p').allTextContents(), expected)
  await activate(inventory.locator('[data-inventory-parent-holder="true"]'))
  await inventory.locator('xpath=self::*[@data-native-sack-path=""][@data-native-sack-transition=""]').waitFor()
  await activate(inventory.getByRole('button', { name: 'Close inventory', exact: true }))
  await inventory.waitFor({ state: 'hidden' })
  await openInventory()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  assert.deepEqual(await indicator.locator('p').allTextContents(), expected)
  await activate(inventory.getByRole('button', { name: 'Close inventory', exact: true }))
  await inventory.waitFor({ state: 'hidden' })
  receipts.push({ scene, compatibleSets: true, sackRootAndReturn: true, closeAndReopen: true, visibleCard })
  const current = host.state()
  Object.assign(current, { playerEntities: replacePlayerEconomy(current.playerEntities, owner, {
    ...original, revision: getPlayerEconomy(current, owner).revision + 1,
  }) })
}

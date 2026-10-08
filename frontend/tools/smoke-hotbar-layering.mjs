import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { nativeHudModalSlideLayout } from '../src/game/native-hud-layout.ts'
import { modalHotbarLayout } from '../src/game/hotbar-controls-presentation.ts'

const output = process.env.SDR_HOTBAR_SCREENSHOT_ROOT
  || await mkdtemp(join(tmpdir(), 'solomon-hotbar-layering-'))
await mkdir(output, { recursive: true })
const touch = process.env.SDR_HOTBAR_TOUCH === '1'
const reproduceDom = process.env.SDR_HOTBAR_REPRODUCE_DOM === '1'
const playerId = 'hotbar-layering-owner'
const initial = createGameSimulation({ [playerId]: {
  discipline: 'arcane', displayName: 'Hotbar Layering', element: 'ether',
} })
const economy = getPlayerEconomy(initial, playerId)
const wand = { ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[2], 40_001), inventorySlot: 27 }
// Native inventory addresses are column-major: these are bottom-row cells.
const arrowWands = [11, 51].map((inventorySlot, index) => ({
  ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[2], 40_002 + index), inventorySlot,
}))
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
      ...economy, collegeIntroPending: false, tutorialPending: false,
      backpack: [...economy.backpack, wand, ...arrowWands], nextItemId: 50_000,
    }),
  },
})
const server = await startStaticClientServer({ root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)) })
const credential = randomBytes(32).toString('base64url')
const host = await startGameHost({ allowedOrigins: [server.origin], authentication: { kind: 'shared', credential }, snapshotRate: 20 })
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: touch ? { width: 844, height: 390 } : { width: 1600, height: 900 }, hasTouch: touch })
page.setDefaultTimeout(15_000)
const errors = { console: [], page: [], responses: [], requests: [] }
const receipts = []
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('pageerror', error => errors.page.push(error.message))
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
page.on('requestfailed', request => {
  const failure = request.failure()?.errorText ?? 'unknown'
  if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)|\/deployment\.json/.test(request.url())) return
  errors.requests.push(`${failure} ${request.url()}`)
})
await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
await page.addInitScript(({ credential: token, url }) => {
  window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', credential: token, url } }
}, { credential, url: host.address.url })
try {
  const setupUrl = `${server.origin}/__hotbar_layer_fixture__`
  await page.route(setupUrl, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><link rel="icon" href="data:,"><title>Save setup</title>' }))
  await page.goto(setupUrl)
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
  await page.unroute(setupUrl)
  await page.goto(`${server.origin}/game`)
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 60_000 })
  if (reproduceDom) {
    // Reintroduce the former DOM painter above the canvas as a red control.
    await page.addStyleTag({ content: '.hotbar-controls[data-modal] .hotbar-dots { clip-path: none; width: auto; height: auto; overflow: visible; }' })
  }
  await exercise('College')
  await exerciseServices()
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  await exercise('Boneyard')
  for (const values of Object.values(errors)) assert.deepEqual(values, [])
  console.log(JSON.stringify({ touch, reproduceDom, receipts, errors, output }))
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  console.error(JSON.stringify({ errors, output }))
  throw error
} finally {
  await page.close()
  await browser.close()
  await host.close()
  await server.close()
}

async function settledInventory() {
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  return inventory
}
async function hotbarPixels(stage, control = null) {
  const bounds = await stage.boundingBox()
  assert.ok(bounds)
  const layout = modalHotbarLayout(nativeHudModalSlideLayout(1600, 900, 1).belt)
  const points = [0, 1, 2].map(bank => ({
    x: bounds.x + (800 + (bank - 1) * 20) * bounds.width / 1600,
    y: bounds.y + (layout.dotsTop + 5.5) * bounds.height / 900,
  }))
  if (control !== null) points.splice(0, points.length, {
    x: bounds.x + ((control === 0 ? layout.previous : layout.next) + 17) * bounds.width / 1600,
    y: bounds.y + (layout.top + 8) * bounds.height / 900,
  })
  const screenshot = await page.screenshot()
  return page.evaluate(async ({ encoded, points }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    return points.map(({ x, y }) => Array.from(context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data).slice(0, 3))
  }, { encoded: screenshot.toString('base64'), points })
}
async function assertActive(stage, scene) {
  const bank = Number(await stage.locator('.hotbar-controls').getAttribute('data-hotbar-bank'))
  await stage.getByRole('img', { name: `Hotbar ${bank + 1} of 3` }).waitFor({ state: 'attached' })
  const pixels = await hotbarPixels(stage)
  assert.ok(pixels[bank][0] > 120 && pixels[bank][1] > 100, `${scene}: active canvas dot missing: ${JSON.stringify(pixels)}`)
  return bank
}
async function exercise(scene) {
  await page.getByRole('button', { name: /Open inventory/ }).click()
  let inventory = await settledInventory()
  await assertActive(inventory, `${scene} inventory`)
  const covered = await assertForeground(inventory, scene)
  await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
  const skills = page.getByRole('dialog', { name: 'Skills', exact: true })
  await skills.locator('xpath=self::*[@data-transition-phase="settled"]').locator('.skill-book-canvas').waitFor()
  for (let index = 0; index < 3; index += 1) {
    const bank = await assertActive(skills, `${scene} skills`)
    await skills.getByRole('button', { name: 'Next hotbar', exact: true }).click()
    await skills.locator(`.hotbar-controls[data-hotbar-bank="${(bank + 1) % 3}"]`).waitFor()
  }
  const bank = await assertActive(skills, `${scene} skills after forward cycle`)
  await skills.getByRole('button', { name: 'Previous hotbar', exact: true }).focus()
  await page.keyboard.press('Enter')
  await skills.locator(`.hotbar-controls[data-hotbar-bank="${(bank + 2) % 3}"]`).waitFor()
  await page.screenshot({ path: join(output, `${scene.toLowerCase()}-skills.png`) })
  await page.keyboard.press('i')
  inventory = await settledInventory()
  await inventory.locator(`.hotbar-controls[data-hotbar-bank="${(bank + 2) % 3}"]`).waitFor()
  // Book replacement may retain the existing inventory selection; do not alter that contract.
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: /Open inventory/ }).click()
  inventory = await settledInventory()
  await assertActive(inventory, `${scene} inventory reopening`)
  assert.equal(await inventory.getByRole('tooltip').count(), 0, `${scene}: stale tooltip after reopening`)
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'hidden' })
  receipts.push({ scene, tooltipBanks: covered, skillsArrowCycle: 'pass', keyboardArrow: 'pass', replacementAndReopening: 'pass' })
}

async function selectWand(stage, itemId) {
  await stage.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${itemId}"]`).first().click()
  await stage.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]').waitFor()
  await page.waitForTimeout(250)
}
async function assertForeground(stage, scene) {
  await selectWand(stage, wand.id)
  for (let index = 0; index < 3; index += 1) {
    const pixels = await hotbarPixels(stage)
    assert.deepEqual(pixels, [[0, 0, 0], [0, 0, 0], [0, 0, 0]], `${scene}: dots paint through the opaque Wand tooltip`)
    await page.keyboard.press('r')
  }
  await page.screenshot({ path: join(output, `${scene.toLowerCase()}-tooltip.png`) })
  for (const [index, item] of arrowWands.entries()) {
    await selectWand(stage, item.id)
    const pixels = await hotbarPixels(stage, index)
    assert.deepEqual(pixels, [[0, 0, 0]], `${scene}: arrow ${index} paints through the opaque Wand tooltip`)
  }
  return 3
}
async function exerciseServices() {
  for (const [trader, title] of [
    ['Hagatha', "HAGATHA'S CHARMS AND CURSES"],
    ['Fomentius', "FOMENTIUS' USEFUL THYNGS"],
    ['Luthacus', "LUTHACUS' SCAVENGED GOODS"],
    ['Shlorio', "SHLORIO'S DISCOUNT DOWSING"],
  ]) {
    await page.getByRole('button', { name: `Open ${trader} interaction`, exact: true }).click()
    const service = page.getByRole('dialog', { name: title, exact: true })
    await service.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
    const bank = await assertActive(service, trader)
    await service.getByRole('button', { name: 'Next hotbar', exact: true }).click()
    await service.locator(`.hotbar-controls[data-hotbar-bank="${(bank + 1) % 3}"]`).waitFor()
    await assertActive(service, `${trader} after cycle`)
    const tooltipBanks = await assertForeground(service, trader)
    await service.getByRole('button', { name: 'Done', exact: true }).click()
    await service.waitFor({ state: 'detached' })
    await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
    receipts.push({ trader, tooltipBanks, arrowOcclusion: 'pass', arrowCycle: 'pass', teardown: 'pass' })
  }
}

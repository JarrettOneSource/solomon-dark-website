import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer, preview } from 'vite'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { createGameSimulation, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createEquipmentInventoryItem, DOWSING_EQUIPMENT_RECIPES, findInventoryItem } from '../src/game/core-kernels/hub-economy.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.SDR_DOWSING_SCREENSHOT_ROOT || await mkdtemp(join(tmpdir(), 'solomon-dowsing-'))
await mkdir(output, { recursive: true })
const mobile = process.env.SDR_DOWSING_MOBILE === '1'
const built = process.env.SDR_DOWSING_BUILT === '1'
const credential = randomBytes(32).toString('base64url')
const owner = 'report39-owner'
const itemId = 90039
const staffId = 90040
const ringId = 90041
const potionId = 90042
const sackId = 90050
const character = { discipline: 'arcane', displayName: 'Dowsing', element: 'water' }
const initial = createGameSimulation({ [owner]: character })
const economy = getPlayerEconomy(initial, owner)
const recipe = DOWSING_EQUIPMENT_RECIPES.find(row => row.name === 'Cloudcover Hood')
assert.ok(recipe)
const hood = { ...createEquipmentInventoryItem(recipe, itemId), inventorySlot: 24 }
const staff = { ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[33], staffId), inventorySlot: 28 }
const ring = { ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[35], ringId), inventorySlot: 0 }
const potion = { ...economy.backpack.find(item => item.kind === 'health-potion'), id: potionId, inventorySlot: 32 }
const sack = { ...economy.fomentiusStock.find(item => item.kind === 'sack'),
  id: sackId, inventorySlot: 36, quantity: 1, contents: [ring] }
delete sack.price
const document = createGameSaveDocument({
  integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: owner,
  state: {
    ...initial,
    world: {
      ...initial.world,
      participants: Object.fromEntries(Object.entries(initial.world.participants).map(([id, value]) => [id, {
        ...value, collegeIntro: null, region: 'courtyard', transition: null,
      }])),
    },
    playerEntities: replacePlayerEconomy(initial.playerEntities, owner, {
      ...economy, backpack: [hood, staff, potion, sack], collegeIntroPending: false, tutorialPending: false,
      gold: 20000, nextItemId: 90100,
    }),
  },
})
const vite = built
  ? await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } })
  : await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
if (!built) await vite.listen()
const baseUrl = `http://127.0.0.1:${vite.httpServer.address().port}`
const host = await startGameHost({ allowedOrigins: [baseUrl], authentication: { kind: 'shared', credential }, snapshotRate: 20 })
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'), headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const page = await browser.newPage(mobile
  ? { viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
  : { viewport: { width: 1600, height: 900 } })
const touch = mobile ? await page.context().newCDPSession(page) : null
const receipts = []
await page.addInitScript(installGameAudioSmokeProbe)
const errors = { page: [], console: [], responses: [] }
page.on('pageerror', error => errors.page.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
try {
  await page.route('**/__report39_seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Report39 fixture</title>' }))
  await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { kind: 'localhost', credential, url: host.address.url },
  })
  await page.goto(`${baseUrl}/__report39_seed`)
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
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 180000 })
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90000 })
  for (const [trader, title] of [
    ['Hagatha', "HAGATHA'S CHARMS AND CURSES"],
    ['Fomentius', "FOMENTIUS' USEFUL THYNGS"],
    ['Luthacus', "LUTHACUS' SCAVENGED GOODS"],
    ['Shlorio', "SHLORIO'S DISCOUNT DOWSING"],
  ]) {
    const service = await openService(trader, title)
    const item = backpackItem(service, itemId)
    await activate(item)
    receipts.push({ trader, tooltip: await assertTooltipPaint(service) })
    await page.screenshot({ path: join(output, `${trader.toLowerCase()}-tooltip.png`) })
    await closeService(service)
  }

  let service = await openDowsing()
  const unchanged = structuredClone(ownerEconomy())
  await dropReference(service, unchanged.equipment.hat.id, 'equipment')
  await dropReference(service, itemId)
  assert.deepEqual(ownerEconomy().backpack, unchanged.backpack)
  assert.deepEqual(ownerEconomy().equipment, unchanged.equipment)
  assert.equal(ownerEconomy().gold, unchanged.gold)
  assert.deepEqual(ownerEconomy().rng, unchanged.rng)
  await page.screenshot({ path: join(output, 'reference.png') })
  const targeted = await roll(service)
  assert.ok(targeted.dowsingOffers.length >= 5 && targeted.dowsingOffers.length <= 6)
  assert.ok(targeted.dowsingOffers.slice(0, 2).every(offer => [17, 18, 19].includes(offer.recipeIndex)))
  assert.ok(targeted.dowsingOffers.slice(2).every(offer => [5, 6, 11, 20, 40].includes(offer.recipeIndex)))
  assert.ok(findInventoryItem(targeted.backpack, itemId))
  await page.screenshot({ path: join(output, 'targeted-results.png') })
  // Reference changes are disabled in the rolled state.
  await dragToReference(service, staffId)
  assert.equal(await service.getAttribute('data-native-dowsing-reference'), `${itemId}`)
  assert.deepEqual(ownerEconomy().dowsingOffers, targeted.dowsingOffers)
  const firstOffer = service.getByRole('button', { name: /^Buy .* for \d+ gold$/ }).first()
  const purchasedRecipe = targeted.dowsingOffers[0].recipeIndex
  await activate(firstOffer)
  await firstOffer.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await activate(firstOffer)
  await firstOffer.waitFor({ state: 'detached' })
  assert.equal(ownerEconomy().dowsingRolled, true)
  assert.deepEqual(ownerEconomy().dowsingOffers, [])
  assert.ok(ownerEconomy().backpack.some(item => item.recipeIndex === purchasedRecipe))
  assert.equal(await service.getByRole('button', { name: /^DOWSE/ }).count(), 0)
  await closeService(service)

  service = await openDowsing()
  assert.equal(await service.getAttribute('data-native-dowsing-reference'), '')
  await dropReference(service, itemId)
  await dropReference(service, staffId)
  const setless = await roll(service)
  assert.ok(setless.dowsingOffers.length > 0)
  assert.ok(setless.dowsingOffers.every(offer => [8, 18, 34].includes(offer.recipeIndex)))
  await closeService(service)

  service = await openDowsing()
  const sackControl = backpackItem(service, sackId)
  if (mobile) {
    const box = await sackControl.boundingBox()
    assert.ok(box)
    // Enqueue one ordered gesture; separate round trips can exceed the native
    // 500-ms window while a headless renderer is busy painting the first tap.
    const acknowledgements = []
    for (const type of ['touchStart', 'touchEnd', 'touchStart', 'touchEnd']) {
      acknowledgements.push(touch.send('Input.dispatchTouchEvent', {
        type, touchPoints: type === 'touchEnd' ? [] : [{
          x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1,
        }],
      }))
    }
    await Promise.all(acknowledgements)
  } else await sackControl.dblclick()
  await service.locator(`xpath=self::*[@data-native-sack-path="${sackId}"][@data-native-sack-transition=""]`).waitFor()
  await dropReference(service, ringId)
  const nested = await roll(service)
  assert.ok(nested.dowsingOffers.length > 0)
  assert.ok(nested.dowsingOffers.every(offer => DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex].type === 'ring'))
  assert.ok(findInventoryItem(nested.backpack, ringId))
  await closeService(service)

  service = await openDowsing()
  await dropReference(service, potionId)
  const emptyBefore = structuredClone(ownerEconomy())
  const empty = await roll(service, true)
  assert.deepEqual(empty.dowsingOffers, [])
  assert.equal(empty.gold, emptyBefore.gold - emptyBefore.dowsingFee)
  assert.deepEqual(empty.backpack, emptyBefore.backpack)
  assert.equal(await service.getByRole('button', { name: /^DOWSE/ }).count(), 0)
  await page.screenshot({ path: join(output, 'empty-result.png') })
  await closeService(service)
  service = await openDowsing()
  assert.equal(await service.getAttribute('data-native-dowsing-reference'), '')

  const state = host.state()
  state.playerEntities = replacePlayerEconomy(state.playerEntities, host.hostPlayerId(), {
    ...ownerEconomy(), gold: 0, revision: ownerEconomy().revision + 1,
  })
  await service.locator('[data-player-gold="0"]').waitFor({ state: 'attached' })
  const beforeRejection = structuredClone(ownerEconomy())
  await activate(service.getByRole('button', { name: /^DOWSE/ }))
  await service.getByRole('alert').waitFor()
  assert.deepEqual(ownerEconomy(), beforeRejection)
  await activate(service.getByRole('button', { name: 'OKAY', exact: true }))
  await closeService(service)
  assert.deepEqual(errors, { page: [], console: [], responses: [] })
  const receipt = { status: 'ok', browser: browser.version(), mobile, built, tooltips: receipts,
    targetedOffers: targeted.dowsingOffers, setlessOffers: setless.dowsingOffers,
    nestedOffers: nested.dowsingOffers, emptyResultChargedOnce: true,
    referenceItemPreserved: true, purchaseRequiresReopen: true, insufficientGoldUnchanged: true, errors }
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') })
  console.error(JSON.stringify({ body: (await page.locator('body').innerText()).slice(0, 1500), errors }))
  throw error
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

function ownerEconomy() { return getPlayerEconomy(host.state(), host.hostPlayerId()) }
function backpackItem(service, id) {
  return service.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${id}"]`)
}
async function activate(locator) { if (mobile) await locator.tap(); else await locator.click() }
async function openService(trader, title) {
  await activate(page.getByRole('button', { name: `Open ${trader} interaction`, exact: true }))
  const service = page.getByRole('dialog', { name: title, exact: true })
  await service.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  return service
}
async function openDowsing() {
  const service = await openService('Shlorio', "SHLORIO'S DISCOUNT DOWSING")
  await service.getByRole('button', { name: /^DOWSE/ }).waitFor()
  return service
}
async function closeService(service) {
  await activate(service.getByRole('button', { name: 'Done', exact: true }))
  await service.waitFor({ state: 'detached' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
}
async function dragToReference(service, id, owner = 'backpack') {
  const canvas = service.locator('.hub-inventory-native-canvas')
  const canvasBox = await canvas.boundingBox()
  const sourceBox = await service.locator(
    `[data-inventory-owner="${owner}"][data-inventory-item-id="${id}"]`,
  ).first().boundingBox()
  assert.ok(canvasBox && sourceBox)
  const from = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 }
  const to = { x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + 175.5 / 900 * canvasBox.height }
  if (touch) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] })
    for (let step = 1; step <= 12; step += 1) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12, id: 1,
      }] })
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.mouse.up()
  }
  await service.locator('xpath=self::*[@data-native-inventory-dragging=""]').waitFor()
}
async function dropReference(service, id, owner = 'backpack') {
  const eventStart = await page.evaluate(() => window.__sdrAudioEvents.length)
  await dragToReference(service, id, owner)
  await service.locator(`xpath=self::*[@data-native-dowsing-reference="${id}"]`).waitFor()
  const cues = await page.evaluate(start => window.__sdrAudioEvents.slice(start)
    .filter(event => event.type === 'buffer-start')
    .flatMap(event => ['backpack-open.wav', 'backpack-close.wav'].filter(source => (
      window.__sdrAudioSourceMatches(event.src, source)
    ))), eventStart)
  assert.deepEqual(cues, ['backpack-open.wav', 'backpack-close.wav'])
}
async function roll(service, empty = false) {
  const button = service.getByRole('button', { name: /^DOWSE/ })
  await activate(button)
  await button.waitFor({ state: 'detached' })
  if (!empty) await service.getByRole('button', { name: /^Buy .* for \d+ gold$/ }).first().waitFor()
  assert.equal(ownerEconomy().dowsingRolled, true)
  return structuredClone(ownerEconomy())
}
async function assertTooltipPaint(service) {
  const canvas = service.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]')
  await canvas.waitFor()
  const box = await canvas.boundingBox()
  assert.ok(box)
  // Cloudcover Hood in slot24 puts this opaque padding above the service field.
  // In the reported failure the field overpainted this strip and the item name.
  const image = await page.screenshot({ clip: {
    x: box.x + 548 / 1600 * box.width, y: box.y + 350 / 900 * box.height,
    width: 8 / 1600 * box.width, height: 52 / 900 * box.height,
  } })
  const receipt = await page.evaluate(async encoded => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${encoded}`)).blob())
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width; canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0); bitmap.close()
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let opaqueBlack = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) <= 8) opaqueBlack += 1
    }
    return { opaqueBlack, pixels: pixels.length / 4 }
  }, image.toString('base64'))
  assert.ok(receipt.opaqueBlack / receipt.pixels > 0.98, 'service panel obscured the selected item tooltip')
  return receipt
}

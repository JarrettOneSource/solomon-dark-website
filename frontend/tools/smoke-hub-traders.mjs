import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  createGameSimulation,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import {
  WEB_GAME_SAVE_SLOT,
} from '../src/game/save/game-save-contract.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

import {
  hubPortalAt,
  isHubRegionTraversable,
  moveWithHubRegionCollisionState,
} from '../src/game/core-kernels/hub-regions.ts'
import {
  HUB_CAMERA_SCALE,
  hubRegionCameraOrigin,
} from '../src/game/core-kernels/hub-math.ts'
import { PLAYER_CHARACTER_RADIUS } from '../src/game/core-kernels/player-character.ts'
import { DOWSING_EQUIPMENT_RECIPES } from '../src/game/core-kernels/hub-economy.ts'
import { GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { HUB_TRADER_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'

const hostElement = process.env.SDR_GAME_TRADER_HOST_ELEMENT || 'Fire'
const screenshotRoot = process.env.SDR_GAME_TRADER_SCREENSHOT_ROOT || '/tmp/solomon-dark-hub-trader'
const singleClient = process.env.SDR_GAME_TRADER_SINGLE_CLIENT === '1'
const hagathaCapacityOnly = process.argv.includes('--hagatha-capacity-only')
const hagathaLayoutOnly = process.argv.includes('--hagatha-layout-only')
const focusedHagatha = hagathaCapacityOnly || hagathaLayoutOnly
const dowsingMessageOnly = process.argv.includes('--dowsing-message-only')
const focusedSave = focusedHagatha || dowsingMessageOnly
const rendererLifecycleOnly = process.argv.includes('--renderer-lifecycle-only')
const productionBuild = process.env.SDR_GAME_TRADER_PRODUCTION === '1'
let staticServer = null
let gameHost = null
let gameCredential = null
let baseUrl = process.env.SDR_GAME_TRADER_SMOKE_URL || 'http://127.0.0.1:4189'
if (productionBuild && !process.env.SDR_GAME_TRADER_SMOKE_URL) {
  staticServer = await startStaticClientServer({
    root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
  })
  gameCredential = focusedSave
    ? 'focused-msgbox-browser-acceptance'
    : 'hub-trader-browser-acceptance'
  gameHost = await startGameHost({
    allowedOrigins: [staticServer.origin],
    authentication: { kind: 'shared', credential: gameCredential },
    snapshotRate: 20,
  })
  baseUrl = staticServer.origin
}
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const hostPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const guestPage = await browser.newPage({ viewport: { width: 960, height: 540 } })
if (gameHost && gameCredential) {
  for (const page of [hostPage, guestPage]) {
    await page.addInitScript(({ credential, gameUrl }) => {
      window.solomonDarkRuntime = {
        gameEndpoint: { credential, kind: 'localhost', url: gameUrl },
      }
    }, { credential: gameCredential, gameUrl: gameHost.address.url })
  }
}
const abortedRequests = []
const browserErrors = []
const failedRequests = []
const failedResponses = []
for (const page of [hostPage, guestPage]) {
  if (focusedHagatha) {
    await page.addInitScript((key) => {
      const current = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(key, JSON.stringify({ ...current, enableCheats: true }))
    }, GAME_SETTINGS_STORAGE_KEY)
  }
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(bypassStartupAudioPreload)
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket
    window.__sdrSmokeKeyEvents = []
    window.__sdrSmokeWebGlContextLosses = []
    window.__sdrSmokeWebSocketEvents = []
    document.addEventListener('webglcontextlost', (event) => {
      window.__sdrSmokeWebGlContextLosses.push(event.target?.className ?? 'unknown')
    }, true)
    for (const type of ['keydown', 'keyup']) {
      window.addEventListener(type, (event) => {
        window.__sdrSmokeKeyEvents.push({
          code: event.code,
          hidden: document.hidden,
          type,
        })
      })
    }
    window.WebSocket = new Proxy(NativeWebSocket, {
      construct(Target, argumentsList) {
        const socket = Reflect.construct(Target, argumentsList)
        socket.addEventListener('open', () => {
          window.__sdrSmokeWebSocketEvents.push({ type: 'open', url: socket.url })
        })
        socket.addEventListener('message', (event) => {
          if (typeof event.data !== 'string' || !event.data.includes('disconnect')) return
          window.__sdrSmokeWebSocketEvents.push({ data: event.data, type: 'message' })
        })
        socket.addEventListener('close', (event) => {
          window.__sdrSmokeWebSocketEvents.push({
            clean: event.wasClean,
            code: event.code,
            reason: event.reason,
            type: 'close',
          })
        })
        socket.addEventListener('error', () => {
          window.__sdrSmokeWebSocketEvents.push({ type: 'error' })
        })
        return socket
      },
    })
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const failure = `${request.method()} ${request.url()}: ${request.failure()?.errorText || 'failed'}`
    if (request.failure()?.errorText === 'net::ERR_ABORTED') abortedRequests.push(failure)
    else failedRequests.push(failure)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(`${message.text()} @ ${message.location().url}`)
    }
  })
}

try {
  if (focusedSave) {
    step('seeding the focused cheat-mode Hub save')
    await seedLocalSave(hostPage, createHagathaCapacitySave(dowsingMessageOnly ? 0 : 100_000))
    step('entering the saved host Hub')
    await enterSavedHub(hostPage)
  } else {
    step('preloading both game clients')
    await Promise.all([loadGame(hostPage), ...(singleClient ? [] : [loadGame(guestPage)])])
    step('entering host Hub')
    await enterHub(hostPage, hostElement)
  }
  if (!singleClient) {
    step('entering guest Hub')
    await enterHub(guestPage, 'Earth')
    await Promise.all([waitForPlayers(hostPage, 2), waitForPlayers(guestPage, 2)])
    step('two participants replicated')
  }

  const canvas = hostPage.locator('.hub-world-canvas')
  if (!singleClient) assert.equal(await inventoryGold(guestPage), 500)
  await focusPage(hostPage)
  const hostStartingGold = await inventoryGold(hostPage, true)
  assert.equal(hostStartingGold, dowsingMessageOnly ? 0 : focusedHagatha ? 100_000 : 500)
  step(dowsingMessageOnly
    ? 'focused host restored the zero-gold Dowsing save'
    : focusedHagatha
      ? 'focused host restored the cheat-funded 100,000 gold save'
      : 'both participants start with the retail 500 gold')
  if (dowsingMessageOnly) {
    const dowsingNotice = await exerciseDowsingInsufficientGoldNotice(hostPage)
    assert.deepEqual(browserErrors, [])
    assert.deepEqual(failedRequests, [])
    assert.deepEqual(failedResponses, [])
    assert.deepEqual(await hostPage.evaluate(() => window.__sdrSmokeWebGlContextLosses), [])
    const receipt = {
      abortedRequests,
      browserErrors,
      dowsingNotice,
      failedRequests,
      failedResponses,
      host: await pageReceipt(hostPage),
      status: 'ok',
    }
    await writeFile(`${screenshotRoot}-dowsing-message-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(receipt)}\n`)
    step('focused Dowsing insufficient-gold MsgBox receipt complete')
    await gameHost?.close()
    await browser.close()
    await staticServer?.close()
    process.exit(0)
  }
  if (focusedHagatha) {
    await hostPage.locator('.main-menu-page[data-session-cheats-enabled="true"]').waitFor()
    const hagathaCapacity = await exerciseHagathaCapacity(hostPage)
    const protectedGarmentNotices = await exerciseProtectedGarmentNotices(hostPage)
    const sharedButtons = hagathaCapacityOnly
      ? await exerciseSharedButtonSiblings(hostPage)
      : null
    assert.deepEqual(browserErrors, [])
    assert.deepEqual(failedRequests, [])
    assert.deepEqual(failedResponses, [])
    assert.deepEqual(await hostPage.evaluate(() => window.__sdrSmokeWebGlContextLosses), [])
    const receipt = {
      abortedRequests,
      browserErrors,
      failedRequests,
      failedResponses,
      hagathaCapacity,
      host: await pageReceipt(hostPage),
      protectedGarmentNotices,
      sharedButtons,
      status: 'ok',
    }
    const receiptKind = hagathaLayoutOnly ? 'hagatha-layout' : 'hagatha-capacity'
    await writeFile(`${screenshotRoot}-${receiptKind}-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`)
    process.stdout.write(`${JSON.stringify(receipt)}\n`)
    step('focused Tonic-inclusive Hagatha capacity receipt complete')
    await browser.close()
    await gameHost?.close()
    await staticServer?.close()
    process.exit(0)
  }
  const rendererLifecycle = await exerciseRetainedInventoryRenderer(hostPage)
  if (rendererLifecycleOnly) {
    assert.deepEqual(browserErrors, [])
    assert.deepEqual(failedRequests, [])
    assert.deepEqual(failedResponses, [])
    assert.deepEqual(await hostPage.evaluate(() => window.__sdrSmokeWebGlContextLosses), [])
    await writeFile(`${screenshotRoot}-receipt.json`, `${JSON.stringify({
      abortedRequests,
      browserErrors,
      failedRequests,
      failedResponses,
      host: await pageReceipt(hostPage),
      rendererLifecycle,
    }, null, 2)}\n`)
    step('focused native UI renderer lifecycle receipt complete')
    await browser.close()
    process.exit(0)
  }
  await fundTraderSmoke(hostPage)
  await exerciseStarterInventory(hostPage)

  step('walking to Fomentius')
  await navigateRegion(hostPage, canvas, 'courtyard', HUB_TRADER_GEOMETRY.fomentius.position, 70)
  await activateTraderByPointer(hostPage, canvas, 'fomentius')
  const fomentiusDialogue = hostPage.getByRole('dialog', { name: 'Talking to Fomentius' })
  await fomentiusDialogue.waitFor()
  assert.match(await fomentiusDialogue.innerText(), /Hello Hello!/)
  assert.match(await fomentiusDialogue.innerText(), /\*very legal\* herbal potion/)
  await waitForNativeSurfaceSettled(fomentiusDialogue)
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-dialogue.png` })
  await assertInputBlocked(hostPage, canvas)
  await advanceDialogue(fomentiusDialogue)
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-choices.png` })
  await fomentiusDialogue.locator('[data-service-trader="fomentius"]').click()
  const fomentius = hostPage.getByRole('dialog', { name: "FOMENTIUS' USEFUL THYNGS" })
  await fomentius.waitFor()
  await waitForNativeSurfaceSettled(fomentius)
  const stockCell = fomentius.getByRole('button', { name: /^Buy Mana Potion for \d+ gold$/ }).first()
  const stockLabel = await stockCell.getAttribute('aria-label')
  const stock = parsePurchaseLabel(stockLabel)
  const beforeFomentius = await dialogGold(fomentius)
  await stockCell.hover()
  await assertTooltip(fomentius, [stock.name, 'Double-click to drink', `Price: ${stock.price}`])
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-hover-tooltip.png` })
  await stockCell.click()
  await stockCell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await assertTooltip(fomentius, [stock.name, 'Double-click to drink', `Price: ${stock.price}`])
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-selected.png` })
  const fomentiusEmptyCell = fomentius.locator('[data-store-empty-slot]').first()
  await fomentiusEmptyCell.hover()
  assert.equal(await fomentius.getByRole('tooltip').count(), 0)
  await stockCell.hover()
  await assertTooltip(fomentius, [stock.name, 'Double-click to drink', `Price: ${stock.price}`])
  await fomentiusEmptyCell.hover()
  await stockCell.focus()
  await assertTooltip(fomentius, [stock.name, 'Double-click to drink', `Price: ${stock.price}`])
  await fomentiusEmptyCell.click()
  assert.equal(await fomentius.locator('[data-selected="true"]').count(), 0)
  await stockCell.click()
  await stockCell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await stockCell.click()
  await waitForDialogGold(fomentius, beforeFomentius - stock.price)
  const secondStockCell = fomentius.getByRole('button', { name: /^Buy Mana Potion for \d+ gold$/ }).first()
  const secondStock = parsePurchaseLabel(await secondStockCell.getAttribute('aria-label'))
  await secondStockCell.click()
  await secondStockCell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await secondStockCell.click()
  await waitForDialogGold(fomentius, beforeFomentius - stock.price - secondStock.price)
  const purchasedMana = fomentius.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 3',
  })
  await purchasedMana.waitFor()
  await purchasedMana.click()
  await purchasedMana.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.waitForTimeout(250)
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-purchased-item-info.png` })
  await doubleActivateInventoryPointer(hostPage, purchasedMana)
  await fomentius.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 2',
  }).waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius.png` })
  step('Fomentius purchases remained selectable and activatable in the companion InventoryScreen')
  await fomentius.getByRole('button', { name: 'Done' }).click()
  await assertBackpackQuantity(hostPage, stock.name, stock.name === 'Mana Potion' ? 2 : 1)

  await navigateRegion(hostPage, canvas, 'courtyard', HUB_TRADER_GEOMETRY.luthacus.position, 60)
  await openNearbyTrader(hostPage, 'luthacus')
  const luthacusDialogue = hostPage.getByRole('dialog', { name: 'Talking to Luthacus' })
  await luthacusDialogue.waitFor()
  assert.match(await luthacusDialogue.innerText(), /Official Unreal Crime Scene Investigator/)
  await advanceDialogue(luthacusDialogue)
  assert.equal(await luthacusDialogue.getByRole('button', { name: 'Examine Items' }).count(), 1)
  assert.equal(await luthacusDialogue.getByText('Outfit me Randomly').count(), 0)
  await luthacusDialogue.getByRole('button', { name: 'Examine Items' }).click()
  const luthacus = hostPage.getByRole('dialog', { name: "LUTHACUS' SCAVENGED GOODS" })
  await luthacus.waitFor()
  await waitForNativeSurfaceSettled(luthacus)
  const goldBeforeStorage = await dialogGold(luthacus)
  const backpackItem = luthacus.getByLabel('Backpack').getByRole('button', {
    name: new RegExp(`^${escapeRegExp(stock.name)}, quantity `),
  })
  await backpackItem.click()
  await backpackItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-luthacus-selected.png` })
  await doubleActivateInventoryPointer(hostPage, backpackItem)
  await luthacus.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  }).waitFor()
  assert.equal(await luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    name: /^Mana Potion, quantity /,
  }).count(), 0)
  step('Luthacus backpack double activation retained ordinary potion use')

  const remainingBackpackItem = luthacus.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  })
  await dragInventoryPointer(hostPage, luthacus, remainingBackpackItem, { x: 575, y: 92.5 })
  const storedItem = luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    name: new RegExp(`^${escapeRegExp(stock.name)}, quantity `),
  })
  await storedItem.waitFor()
  await storedItem.hover()
  const luthacusTooltip = await assertTooltip(luthacus, [stock.name, 'Double-click to drink'])
  assert.doesNotMatch(luthacusTooltip, /Price:/)
  await hostPage.screenshot({ path: `${screenshotRoot}-luthacus-hover-tooltip.png` })
  assert.equal(await dialogGold(luthacus), goldBeforeStorage)
  await activateInventoryPointer(hostPage, storedItem)
  await storedItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
  const selectedLuthacusTooltip = await assertTooltip(luthacus, [stock.name, 'Double-click to drink'])
  assert.doesNotMatch(selectedLuthacusTooltip, /Price:/)
  await hostPage.screenshot({ path: `${screenshotRoot}-luthacus-selected-tooltip.png` })
  await doubleActivateInventoryPointer(hostPage, storedItem)
  await remainingBackpackItem.waitFor()
  assert.equal(await luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    name: new RegExp(`^${escapeRegExp(stock.name)}, quantity `),
  }).count(), 0)

  await dragInventoryPointer(hostPage, luthacus, remainingBackpackItem, { x: 575, y: 92.5 })
  const storedForDragReturn = luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  })
  await storedForDragReturn.waitFor()
  await dragInventoryPointer(hostPage, luthacus, storedForDragReturn, { x: 800, y: 650 })
  await remainingBackpackItem.waitFor()
  await dragInventoryPointer(hostPage, luthacus, remainingBackpackItem, { x: 800, y: 450 })
  await remainingBackpackItem.waitFor()
  assert.equal(await luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  }).count(), 0)
  await hostPage.screenshot({ path: `${screenshotRoot}-luthacus.png` })
  step('Luthacus asymmetric activation, both drag directions, and invalid restore complete')
  await luthacus.getByRole('button', { name: 'Done' }).click()

  await navigateRegion(hostPage, canvas, 'courtyard', HUB_TRADER_GEOMETRY.hagatha.position, 45)
  await openNearbyTrader(hostPage, 'hagatha')
  const hagathaDialogue = hostPage.getByRole('dialog', { name: 'Talking to Hagatha' })
  await hagathaDialogue.waitFor()
  assert.match(await hagathaDialogue.innerText(), /charms, blessings, curses and talismans/)
  await waitForNativeSurfaceSettled(hagathaDialogue)
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-dialogue.png` })
  await advanceDialogue(hagathaDialogue)
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-choices.png` })
  await hagathaDialogue.getByRole('button', { name: 'Charm Prices?' }).click()
  assert.match(await hagathaDialogue.innerText(), /less expensive if I've mixed them up recently/)
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-prices.png` })
  await advanceDialogue(hagathaDialogue)
  await hagathaDialogue.locator('[data-service-trader="hagatha"]').click()
  const hagatha = hostPage.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES" })
  await hagatha.waitFor()
  await waitForNativeSurfaceSettled(hagatha)
  const lifeCharm = hagatha.locator('[data-hagatha-selector="0"]')
  const lifeCharmPrice = parseInt((await lifeCharm.locator('.hub-trader-price').innerText()).replace(/\D/g, ''), 10)
  const beforeHagatha = await dialogGold(hagatha)
  await lifeCharm.hover()
  await assertTooltip(hagatha, [
    'LIFE CHARM',
    'Maximum life is always increased by 25%.',
    `Price: ${lifeCharmPrice}`,
    'High price due to first mixing.',
  ])
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-offer-hover-tooltip.png` })
  await lifeCharm.click()
  await lifeCharm.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await assertTooltip(hagatha, [
    'LIFE CHARM',
    'Maximum life is always increased by 25%.',
    `Price: ${lifeCharmPrice}`,
    'High price due to first mixing.',
  ])
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-selected.png` })
  await lifeCharm.click()
  await waitForDialogGold(hagatha, beforeHagatha - lifeCharmPrice)
  await lifeCharm.waitFor({ state: 'detached' })
  assert.match(await hagatha.locator('.hub-charm-capacity').innerText(), /1 \/ 3/)
  const ownedLifeCharm = hagatha.locator('[data-owned-hagatha-selector="0"]')
  await ownedLifeCharm.hover()
  await assertTooltip(hagatha, [
    'LIFE CHARM',
    'Maximum life is always increased by 25%.',
  ])
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-owned-hover-tooltip.png` })
  const hagathaCompanionItem = hagatha.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Mana Potion, quantity 1',
  })
  await hagathaCompanionItem.click()
  await hagathaCompanionItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.waitForTimeout(250)
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-companion-item-info.png` })
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha.png` })
  step('Hagatha purchase retained the independent companion InventoryScreen selection owner')
  await hagatha.getByRole('button', { name: 'Done' }).click()

  await navigateRegion(hostPage, canvas, 'courtyard', { x: 1800, y: 650 })
  await holdUntilTransition(hostPage, canvas, ['d', 'w'], 'library')
  await waitForSettledRegion(hostPage, canvas, 'library')
  await navigateRegion(hostPage, canvas, 'library', HUB_TRADER_GEOMETRY.shlorio.position, 60)
  await openNearbyTrader(hostPage, 'shlorio')
  const shlorioDialogue = hostPage.getByRole('dialog', { name: 'Talking to Shlorio' })
  await shlorioDialogue.waitFor()
  assert.match(await shlorioDialogue.innerText(), /luminiferous ether/)
  await waitForNativeSurfaceSettled(shlorioDialogue)
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-dialogue.png` })
  await advanceDialogue(shlorioDialogue)
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-choices.png` })
  await shlorioDialogue.getByRole('button', { name: 'Dowsing Prices?' }).click()
  assert.match(await shlorioDialogue.innerText(), /vapor burns/)
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-prices.png` })
  await advanceDialogue(shlorioDialogue)
  await shlorioDialogue.locator('[data-service-trader="shlorio"]').click()
  const shlorio = hostPage.getByRole('dialog', { name: "SHLORIO'S DISCOUNT DOWSING" })
  await shlorio.waitFor()
  await waitForNativeSurfaceSettled(shlorio)
  const dowse = shlorio.getByRole('button', { name: /DOWSE\s+650 gold/ })
  const beforeDowsing = await dialogGold(shlorio)
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-preroll.png` })
  const flashCanvas = shlorio.locator('.hub-inventory-native-canvas')
  const dowseBox = await dowse.boundingBox()
  assertBoxNear(dowseBox, { height: 69, width: 250, x: 675, y: 265.5 })
  await hostPage.mouse.click(640, 300)
  await hostPage.waitForTimeout(50)
  assert.equal(await dialogGold(shlorio), beforeDowsing)
  assert.equal(await shlorio.getByRole('button', { name: /DOWSE\s+650 gold/ }).count(), 1)

  const flashDataPromise = waitForDowsingFlashDataUrl(flashCanvas)
  await hostPage.mouse.move(dowseBox.x + dowseBox.width / 2, dowseBox.y + dowseBox.height / 2)
  await hostPage.mouse.down()
  await shlorio.locator('xpath=self::*[@data-native-pressed-control="dowsing"]').waitFor()
  await flashCanvas.locator('xpath=self::*[@data-native-pressed-body-record="102"]').waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-dowse-pressed.png` })
  await hostPage.mouse.up()
  const flashDataUrl = await flashDataPromise
  assert.match(flashDataUrl, /^data:image\/png;base64,/)
  await writeFile(
    `${screenshotRoot}-shlorio-flash.png`,
    Buffer.from(flashDataUrl.slice(flashDataUrl.indexOf(',') + 1), 'base64'),
  )
  await shlorio.locator('.hub-inventory-native-canvas[data-dowsing-flash="idle"]').waitFor({ state: 'attached', timeout: 5_000 })
  await waitForDialogGold(shlorio, beforeDowsing - 650)
  const dowsingCell = shlorio.getByRole('button', { name: /^Buy .* for \d+ gold$/ }).first()
  await dowsingCell.waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-results.png` })
  const dowsingItem = parsePurchaseLabel(await dowsingCell.getAttribute('aria-label'))
  await dowsingCell.hover()
  await assertTooltip(shlorio, [dowsingItem.name, `Price: ${dowsingItem.price}`])
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-hover-tooltip.png` })
  await dowsingCell.click()
  await dowsingCell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await assertTooltip(shlorio, [dowsingItem.name, `Price: ${dowsingItem.price}`])
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-selected.png` })
  const purchaseFlashDataPromise = waitForDowsingFlashDataUrl(flashCanvas)
  await dowsingCell.click()
  const purchaseFlashDataUrl = await purchaseFlashDataPromise
  assert.match(purchaseFlashDataUrl, /^data:image\/png;base64,/)
  await writeFile(
    `${screenshotRoot}-shlorio-purchase-flash.png`,
    Buffer.from(purchaseFlashDataUrl.slice(purchaseFlashDataUrl.indexOf(',') + 1), 'base64'),
  )
  await shlorio.locator('.hub-inventory-native-canvas[data-dowsing-flash="idle"]').waitFor({ state: 'attached', timeout: 5_000 })
  await waitForDialogGold(shlorio, beforeDowsing - 650 - dowsingItem.price)
  await shlorio.getByRole('button', { name: /DOWSE\s+\d+ gold/ }).waitFor()
  const equipmentSlot = equipmentSlotForDowsingItem(dowsingItem.name)
  const shlorioPurchasedItem = shlorio.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: `${dowsingItem.name}, quantity 1`,
  })
  await shlorioPurchasedItem.waitFor()
  await shlorioPurchasedItem.click()
  await shlorioPurchasedItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.waitForTimeout(250)
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-purchased-item-info.png` })
  const shlorioEquipmentTarget = shlorio.locator(`[data-equipment-slot="${equipmentSlot}"]`).first()
  await dragInventoryPointer(hostPage, shlorio, shlorioPurchasedItem, shlorioEquipmentTarget)
  const shlorioEquipped = shlorio.getByRole('button', {
    exact: true,
    name: `${equipmentSlotLabel(equipmentSlot)}, ${dowsingItem.name}`,
  }).first()
  await shlorioEquipped.waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-companion-equipped.png` })
  if (equipmentSlot === 'hat' || equipmentSlot === 'robe') {
    const starterName = equipmentSlot === 'hat' ? 'Hat' : 'Robe'
    const displacedStarter = shlorio.getByLabel('Backpack').getByRole('button', {
      exact: true,
      name: `${starterName}, quantity 1`,
    })
    await displacedStarter.waitFor()
    await dragInventoryPointer(hostPage, shlorio, displacedStarter, shlorioEquipmentTarget)
  } else {
    await dragInventoryPointer(hostPage, shlorio, shlorioEquipped, { x: 800, y: 650 })
  }
  await shlorioPurchasedItem.waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-purchased.png` })
  step('Shlorio purchase remained selectable, inspectable, draggable, and equippable in place')
  let finalHostGold = beforeDowsing - 650 - dowsingItem.price
  let insufficientFee = 0
  for (let cycle = 0; cycle < 10; cycle += 1) {
    const nextDowse = shlorio.getByRole('button', { name: /DOWSE\s+[\d,]+ gold/ })
    await nextDowse.waitFor()
    const fee = parseDowsingFee(await nextDowse.getAttribute('aria-label'))
    if (finalHostGold < fee) {
      insufficientFee = fee
      await nextDowse.click()
      const notice = shlorio.getByRole('alert')
      await notice.waitFor()
      assert.match(await notice.innerText(), /NOT ENOUGH GOLD!/)
      assert.match(await notice.innerText(), /endless, swirling, impossible colors/)
      assert.equal(await dialogGold(shlorio), finalHostGold)
      await waitForNativeNoticeSettled(shlorio)
      await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-insufficient-gold.png` })
      const okay = shlorio.getByRole('button', { name: 'OKAY' })
      const okayBox = await okay.boundingBox()
      assertBoxNear(okayBox, { height: 69, width: 196, x: 702, y: 397.5 })
      await hostPage.mouse.click(650, 432)
      await hostPage.waitForTimeout(50)
      assert.equal(await notice.isVisible(), true)
      assert.equal(await dialogGold(shlorio), finalHostGold)
      await hostPage.mouse.move(okayBox.x + okayBox.width / 2, okayBox.y + okayBox.height / 2)
      await hostPage.mouse.down()
      await shlorio.locator('xpath=self::*[@data-native-pressed-control="message-primary"]').waitFor()
      await flashCanvas.locator('xpath=self::*[@data-native-pressed-body-record="102"]').waitFor()
      await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-insufficient-gold-pressed.png` })
      await hostPage.mouse.up()
      await shlorio.getByRole('button', { name: 'Done' }).click()
      break
    }
    await nextDowse.click()
    finalHostGold -= fee
    await waitForDialogGold(shlorio, finalHostGold)
    await shlorio.getByRole('button', { name: /^Buy .* for \d+ gold$/ }).first().waitFor()
    await shlorio.getByRole('button', { name: 'Done' }).click()
    await shlorio.waitFor({ state: 'hidden' })
    await openNearbyTrader(hostPage, 'shlorio')
    await shlorioDialogue.waitFor()
    await advanceDialogue(shlorioDialogue)
    await shlorioDialogue.locator('[data-service-trader="shlorio"]').click()
    await shlorio.waitFor()
    await waitForNativeSurfaceSettled(shlorio)
  }
  assert.ok(insufficientFee > finalHostGold, JSON.stringify({ finalHostGold, insufficientFee }))

  await hostPage.keyboard.press('i')
  const inventory = hostPage.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  assert.equal(await inventory.getByRole('button', { name: /^Equip / }).count(), 0)
  const unforgeTintSamples = []
  for (let sample = 0; sample < 6; sample += 1) {
    unforgeTintSamples.push(await inventory.locator('canvas.hub-inventory-native-canvas').evaluate((canvas) => (
      Number.parseInt(canvas.dataset.nativeUnforgeTint ?? '', 16)
    )))
    await hostPage.waitForTimeout(220)
  }
  assert.ok(unforgeTintSamples.every(Number.isFinite), JSON.stringify(unforgeTintSamples))
  assert.ok(new Set(unforgeTintSamples).size >= 3, JSON.stringify(unforgeTintSamples))
  assert.ok(unforgeTintSamples.every((tint) => (tint & 0xffff) === 0xffff), JSON.stringify(unforgeTintSamples))

  const equipmentItem = inventory.getByLabel('Backpack').getByRole('button', {
    name: `${dowsingItem.name}, quantity 1`,
  })
  await equipmentItem.click()
  await equipmentItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.waitForTimeout(250)
  await hostPage.screenshot({ path: `${screenshotRoot}-inventory-equipment-item-info.png` })
  const equipmentTarget = inventory.locator(`[data-equipment-slot="${equipmentSlot}"]`).first()
  await dragInventoryPointer(hostPage, inventory, equipmentItem, equipmentTarget)
  const equipped = inventory.getByRole('button', {
    exact: true,
    name: `${equipmentSlotLabel(equipmentSlot)}, ${dowsingItem.name}`,
  }).first()
  await equipped.waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-inventory-equipped.png` })
  if (equipmentSlot === 'hat' || equipmentSlot === 'robe') {
    const starterName = equipmentSlot === 'hat' ? 'Hat' : 'Robe'
    const displacedStarter = inventory.getByLabel('Backpack').getByRole('button', {
      exact: true,
      name: `${starterName}, quantity 1`,
    })
    await displacedStarter.waitFor()
    await dragInventoryPointer(hostPage, inventory, displacedStarter, equipmentTarget)
    await inventory.getByRole('button', {
      exact: true,
      name: `${equipmentSlotLabel(equipmentSlot)}, ${starterName}`,
    }).waitFor()
    await equipmentItem.waitFor()
  } else {
    await dragInventoryPointer(hostPage, inventory, equipped, { x: 800, y: 650 })
    await equipmentItem.waitFor()
    await inventory.getByRole('button', {
      exact: true,
      name: `${equipmentSlotLabel(equipmentSlot)}, empty`,
    }).first().waitFor()
  }
  assert.equal(await inventory.getByRole('button', { name: 'Done' }).count(), 0)
  await clickInventoryStagePoint(hostPage, inventory, { x: 1562, y: 868 })
  await inventory.waitFor()
  await equipmentItem.waitFor()

  await dragInventoryPointer(hostPage, inventory, equipmentItem, { x: 1550, y: 450 })
  await equipmentItem.waitFor()
  assert.equal(await inventory.getByRole('alert').count(), 0)
  await dragInventoryPointer(hostPage, inventory, equipmentItem, { x: 1000, y: 850 })
  await equipmentItem.waitFor()
  assert.equal(await inventory.getByRole('alert').count(), 0)

  await dragInventoryPointer(hostPage, inventory, equipmentItem, { x: 1550, y: 850 })
  let unforgeNotice = inventory.getByRole('alert')
  await unforgeNotice.waitFor()
  assert.match(await unforgeNotice.innerText(), /REALLY UNFORGE THIS\?/)
  assert.match(await unforgeNotice.innerText(), /utterly destroys the item/i)
  await waitForNativeNoticeSettled(inventory)
  await hostPage.screenshot({ path: `${screenshotRoot}-inventory-unforge-confirm.png` })
  await inventory.getByRole('button', { name: 'CANCEL' }).click()
  await equipmentItem.waitFor()
  assert.equal(await inventory.getByRole('alert').count(), 0)

  const unforgeAudioStart = await hostPage.evaluate(() => window.__sdrAudioEvents.length)
  await dragInventoryPointer(hostPage, inventory, equipmentItem, { x: 1550, y: 850 })
  await inventory.getByRole('button', { name: 'UNFORGE' }).click()
  unforgeNotice = inventory.getByRole('alert')
  await unforgeNotice.waitFor()
  await waitForNativeNoticeSettled(inventory)
  const unforgeText = await unforgeNotice.innerText()
  assert.match(unforgeText, /UNFORGED|FAILED UNFORGING!/)
  assert.match(unforgeText, /Unforging bonus:|Spellbreaking fizzles!/)
  const expectedUnforgeCue = unforgeText.includes('FAILED UNFORGING!') ? 'fizzle.wav' : 'unforge.wav'
  await hostPage.waitForFunction(({ start, cue }) => (
    window.__sdrAudioEvents.slice(start).some((event) => (
      event.type === 'buffer-start'
      && window.__sdrAudioSourceMatches(event.src, cue)
    ))
  ), { start: unforgeAudioStart, cue: expectedUnforgeCue })
  await hostPage.screenshot({ path: `${screenshotRoot}-inventory-unforge-result.png` })
  await inventory.getByRole('button', { name: 'OKAY' }).click()
  await equipmentItem.waitFor({ state: 'detached' })
  finalHostGold = await dialogGold(inventory)
  step(`native unforge corner, cancel, destruction, result, and ${expectedUnforgeCue} complete`)
  await closeInventory(hostPage, inventory)

  assert.equal(await inventoryGold(hostPage), finalHostGold)
  if (!singleClient) {
    await focusPage(guestPage)
    assert.equal(await inventoryGold(guestPage), 500)
    await guestPage.keyboard.press('i')
    const guestInventory = guestPage.getByRole('dialog', { name: 'Inventory' })
    await guestInventory.waitFor()
    await waitForNativeSurfaceSettled(guestInventory)
    assert.equal(await guestInventory.getByLabel(/Health Potion, quantity 1/).count(), 1)
    assert.equal(await guestInventory.getByLabel(/Mana Potion, quantity 1/).count(), 1)
    await guestInventory.getByRole('button', { exact: true, name: 'Hat, Hat' }).waitFor()
    await guestInventory.getByRole('button', { exact: true, name: 'Robe, Robe' }).waitFor()
    await guestInventory.getByRole('button', { exact: true, name: 'Weapon, Staff' }).first().waitFor()
    await guestPage.screenshot({ path: `${screenshotRoot}-guest-isolated.png` })
  }

  assert.deepEqual(browserErrors, [])
  assert.deepEqual(failedRequests, [])
  assert.deepEqual(failedResponses, [])
  process.stdout.write(`${JSON.stringify({
    abortedRequests,
    browserErrors,
    dowsingItem,
    equipmentSlot,
    finalHostGold,
    failedRequests,
    failedResponses,
    guestGold: singleClient ? null : 500,
    singleClient,
    status: 'ok',
    stock,
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    abortedRequests,
    browserErrors,
    failedRequests,
    failedResponses,
    guest: singleClient ? null : await pageReceipt(guestPage),
    host: await pageReceipt(hostPage),
  })}\n`)
  throw error
} finally {
  await gameHost?.close()
  await browser.close()
  await staticServer?.close()
}

async function pageReceipt(page) {
  return {
    body: (await page.locator('body').innerText()).slice(0, 2_000),
    hub: await page.locator('.hub-scene').evaluateAll((nodes) => nodes.map((node) => ({
      region: node.dataset.hubRegion,
      renderer: node.dataset.rendererState,
    }))),
    url: page.url(),
    keyEvents: await page.evaluate(() => window.__sdrSmokeKeyEvents.slice(-20)),
    playerPosition: await page.locator('.hub-world-canvas').count() > 0
      ? await playerPosition(page.locator('.hub-world-canvas'))
      : null,
    sceneState: await page.locator('.hub-scene').evaluateAll((nodes) => nodes.map((node) => ({
      inputBlocked: node.dataset.gameplayInputBlocked,
      modalOpen: node.dataset.modalOpen,
      region: node.dataset.hubRegion,
    }))),
    webGlContextLosses: await page.evaluate(() => window.__sdrSmokeWebGlContextLosses),
    webSocketEvents: await page.evaluate(() => window.__sdrSmokeWebSocketEvents),
  }
}

function step(message) {
  process.stdout.write(`[hub-traders] ${message}\n`)
}

async function assertTooltip(dialog, fragments) {
  const tooltip = dialog.getByRole('tooltip')
  await tooltip.waitFor()
  const text = await tooltip.innerText()
  for (const fragment of fragments) assert.ok(text.includes(fragment), JSON.stringify({ fragment, text }))
  assert.equal(await dialog.getAttribute('data-native-tooltip'), text)
  return text
}

async function enterHub(page, element) {
  await focusPage(page)
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await continueLocalPlay(page)
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'New Game' }).click()
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  try {
    await create.waitFor({ timeout: 30_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      create: await page.locator('.create-menu-scene').evaluateAll((nodes) => nodes.map((node) => ({
        finalizing: node.dataset.finalizing,
        handsReady: node.dataset.handsReady,
        motionSettled: node.dataset.motionSettled,
        phase: node.dataset.phase,
      }))),
      hub: await page.locator('.hub-scene').evaluateAll((nodes) => nodes.map((node) => ({
        region: node.dataset.hubRegion,
        renderer: node.dataset.rendererState,
      }))),
      url: page.url(),
    })}\n`)
    throw error
  }
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  try {
    await page.getByLabel(/College courtyard/).waitFor({ timeout: 90_000 })
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.hub-world-canvas')
      return canvas?.getAttribute('data-hub-region') === 'courtyard'
        && canvas?.getAttribute('data-transition-phase') === 'none'
    }, null, { timeout: 90_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      browserErrors,
      hub: await page.locator('.hub-scene').evaluateAll((nodes) => nodes.map((node) => ({
        region: node.dataset.hubRegion,
        renderer: node.dataset.rendererState,
      }))),
      webSocketEvents: await page.evaluate(() => window.__sdrSmokeWebSocketEvents),
      url: page.url(),
    })}\n`)
    throw error
  }
}

async function declineTutorialOffer(page) {
  const offer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await offer.isVisible()) {
    await offer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
}

async function continueLocalPlay(page) {
  const action = page.getByRole('button', { exact: true, name: 'CONTINUE LOCAL' })
  if (await action.isVisible()) await action.click()
}

function createHagathaCapacitySave(gold = 100_000) {
  const playerId = 'hagatha-capacity-owner'
  const character = {
    discipline: 'arcane',
    displayName: 'Capacitus',
    element: 'fire',
  }
  const initial = createGameSimulation({ [playerId]: character })
  const economy = getPlayerEconomy(initial, playerId)
  const playerEntities = replacePlayerEconomy(initial.playerEntities, playerId, {
    ...economy,
    collegeIntroPending: false,
    gold,
    tutorialPending: false,
  })
  const state = {
    ...initial,
    playerEntities,
    world: initial.world.kind === 'hub'
      ? {
          ...initial.world,
          participants: Object.fromEntries(Object.entries(initial.world.participants).map(
            ([id, participant]) => [id, {
              ...participant,
              collegeIntro: null,
              region: 'courtyard',
              transition: null,
            }],
          )),
        }
      : initial.world,
  }
  const document = createGameSaveDocument({
    integrity: 'local-only',
    loadedBoneyard: null,
    mods: [],
    modState: {},
    playerId,
    state,
  })
  return {
    document,
    revision: 1,
    slot: WEB_GAME_SAVE_SLOT,
  }
}

async function seedLocalSave(page, record) {
  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'domcontentloaded' })
  await page.evaluate((seed) => new Promise((resolve, reject) => {
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

async function enterSavedHub(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  await page.getByRole('button', { name: 'Play' }).click()
  const continueLocal = page.getByRole('button', { exact: true, name: 'CONTINUE LOCAL' })
  const lastGame = page.getByRole('button', { name: 'Last game' })
  const requiresConsent = await Promise.race([
    continueLocal.waitFor({ timeout: 180_000 }).then(() => true),
    lastGame.waitFor({ timeout: 180_000 }).then(() => false),
  ])
  if (requiresConsent) await continueLocal.click()
  await lastGame.waitFor({ timeout: 180_000 })
  assert.equal(await lastGame.isEnabled(), true)
  await lastGame.click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
}

async function loadGame(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
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

async function focusPage(page) {
  await page.bringToFront()
  await page.waitForFunction(() => document.visibilityState === 'visible' && document.hasFocus(), null, {
    timeout: 10_000,
  })
}

async function inventoryGold(page, markRendererOwner = false) {
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  if (markRendererOwner) {
    await inventory.locator('.hub-inventory-native-canvas').evaluate((canvas) => {
      canvas.dataset.sdrInventoryRendererOwner = 'scene'
    })
  }
  const gold = await dialogGold(inventory)
  await closeInventory(page, inventory)
  return gold
}

async function exerciseRetainedInventoryRenderer(page) {
  const services = [
    ['Hagatha', "HAGATHA'S CHARMS AND CURSES"],
    ['Fomentius', "FOMENTIUS' USEFUL THYNGS"],
    ['Luthacus', "LUTHACUS' SCAVENGED GOODS"],
    ['Shlorio', "SHLORIO'S DISCOUNT DOWSING"],
  ]
  let hagathaPixels = null
  const serviceReceipts = []
  for (const [trader, title] of services) {
    await page.getByRole('button', { name: `Open ${trader} interaction` }).click()
    const service = page.getByRole('dialog', { name: title })
    await service.waitFor()
    await waitForNativeSurfaceSettled(service)
    const canvas = service.locator('.hub-inventory-native-canvas')
    assert.equal(
      await canvas.getAttribute('data-sdr-inventory-renderer-owner'),
      'scene',
      `standalone Inventory and ${trader} must retain one scene-local renderer`,
    )
    if (trader === 'Hagatha') {
      const companionItem = service.getByLabel('Backpack').getByRole('button', {
        exact: true,
        name: 'Mana Potion, quantity 1',
      })
      await companionItem.click()
      await companionItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
      await page.waitForTimeout(4_250)
      hagathaPixels = await nativeUiCentralPixelReceipt(page)
      assert.ok(hagathaPixels.nonBlackPixels > 50_000, JSON.stringify(hagathaPixels))
      assert.ok(hagathaPixels.rgbTotal > 5_000_000, JSON.stringify(hagathaPixels))
      await page.screenshot({ path: `${screenshotRoot}-hagatha-after-inventory-lifetime.png` })
    }
    const resume = service.locator('[data-inventory-resume="true"]')
    const resumeBox = await resume.boundingBox()
    assert.ok(resumeBox, `${trader} companion backpack control has no browser geometry`)
    const resumeHit = await page.evaluate(({ x, y }) => (
      document.elementFromPoint(x, y)?.getAttribute('data-inventory-resume')
    ), {
      x: resumeBox.x + resumeBox.width / 2,
      y: resumeBox.y + resumeBox.height / 2,
    })
    assert.equal(resumeHit, 'true')
    serviceReceipts.push({ rendererOwner: 'scene', resumeHit, trader })
    await resume.click()
    await service.waitFor({ state: 'detached' })
  }
  step('standalone Inventory and all four services retained one painted native UI renderer')
  return { hagathaPixels, services: serviceReceipts }
}

async function nativeUiCentralPixelReceipt(page) {
  const screenshot = await page.screenshot({
    clip: { height: 820, width: 800, x: 400, y: 0 },
  })
  return page.evaluate(async (source) => {
    const image = new Image()
    const loaded = new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true })
      image.addEventListener('error', reject, { once: true })
    })
    image.src = `data:image/png;base64,${source}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let nonBlackPixels = 0
    let rgbTotal = 0
    for (let offset = 0; offset < data.length; offset += 4) {
      const total = data[offset] + data[offset + 1] + data[offset + 2]
      if (total > 24) nonBlackPixels += 1
      rgbTotal += total
    }
    return { nonBlackPixels, rgbTotal }
  }, screenshot.toString('base64'))
}

async function fundTraderSmoke(page, gold = 10_000) {
  await page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key) || '{}')
    localStorage.setItem(key, JSON.stringify({ ...current, enableCheats: true }))
    window.dispatchEvent(new StorageEvent('storage', { key }))
  }, GAME_SETTINGS_STORAGE_KEY)
  await page.waitForFunction(() => Boolean(window.solomonDark?.lua), null, {
    timeout: 10_000,
  })
  const result = await page.evaluate((gold) => (
    window.solomonDark.lua.execute(`sd.player.set_gold(${gold})`)
  ), gold)
  assert.equal(result.ok, true, result.error)
  await page.waitForTimeout(100)
  assert.equal(await inventoryGold(page), gold)
  step('host received an explicit Lua-funded trader test bankroll')
}

async function exerciseHagathaCapacity(page) {
  await page.getByRole('button', { name: 'Open Hagatha interaction' }).click()
  let hagatha = page.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES" })
  await hagatha.waitFor()
  await waitForNativeSurfaceSettled(hagatha)
  hagatha = await captureHagathaCapacityPresentation(page, hagatha, 3)
  const initialOfferLayout = await hagathaOfferLayout(hagatha, [0, 1, 6, 7])
  assertBoxNear(initialOfferLayout[0], { height: 72, width: 72, x: 539, y: 56.5 })
  assertBoxNear(initialOfferLayout[1], { height: 72, width: 72, x: 614, y: 56.5 })
  assertBoxNear(initialOfferLayout[6], { height: 72, width: 72, x: 989, y: 56.5 })
  assertBoxNear(initialOfferLayout[7], { height: 72, width: 72, x: 539, y: 131.5 })

  const purchases = []
  let postPurchaseOfferLayout = null
  for (const [selector, count, capacity] of [
    [27, 1, 6],
    [0, 2, 6],
    [1, 3, 6],
    [2, 4, 6],
    [3, 5, 6],
    [4, 6, 6],
  ]) {
    purchases.push(await buyHagathaSelector(page, hagatha, selector, count, capacity))
    if (selector === 0) {
      postPurchaseOfferLayout = await hagathaOfferLayout(hagatha, [1, 2])
      assertBoxNear(postPurchaseOfferLayout[1], { height: 72, width: 72, x: 539, y: 56.5 })
      assertBoxNear(postPurchaseOfferLayout[2], { height: 72, width: 72, x: 614, y: 56.5 })
    }
    if (selector === 27) {
      hagatha = await captureHagathaCapacityPresentation(page, hagatha, capacity)
    }
  }

  const owned = hagatha.getByLabel('Owned Charms and Curses')
  const fullMindTonic = await rejectHagathaSelector(
    page,
    hagatha,
    27,
    /head to explode/,
    'hagatha-capacity-full-tonic',
    true,
  )
  assert.equal(await owned.locator('[data-owned-hagatha-selector]').count(), 6)

  await owned.locator('[data-owned-hagatha-selector="4"]').click()
  await hagatha.locator('.hub-charm-capacity').filter({ hasText: '5 / 6' }).waitFor()
  purchases.push(await buyHagathaSelector(page, hagatha, 27, 6, 9))
  hagatha = await captureHagathaCapacityPresentation(page, hagatha, 9)
  for (const [selector, count] of [[4, 7], [5, 8], [6, 9]]) {
    purchases.push(await buyHagathaSelector(page, hagatha, selector, count, 9))
  }

  const expectedOutcomes = [27, 0, 1, 2, 3, 27, 4, 5, 6]
  const outcomes = await owned.locator('[data-owned-hagatha-selector]').evaluateAll((nodes) => (
    nodes.map(node => Number(node.getAttribute('data-owned-hagatha-selector')))
  ))
  assert.deepEqual(outcomes, expectedOutcomes)
  assert.match(await hagatha.locator('.hub-charm-capacity').innerText(), /9 \/ 9/)

  const rejectedSelector = 9
  const ordinaryFullMind = await rejectHagathaSelector(
    page,
    hagatha,
    rejectedSelector,
    /Thaumic Covalence Meridian/,
    'hagatha-capacity-rejected',
  )
  assert.equal(await owned.locator('[data-owned-hagatha-selector]').count(), 9)

  await hagatha.getByRole('button', { name: 'Done' }).click()
  await hagatha.waitFor({ state: 'detached' })
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Open Hagatha interaction' }).click()
  const reopened = page.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES" })
  await reopened.waitFor()
  await waitForNativeSurfaceSettled(reopened)
  await page.waitForTimeout(500)
  assert.equal(await reopened.getByLabel('Owned Charms and Curses')
    .locator('[data-owned-hagatha-selector]').count(), 9)
  await page.screenshot({ path: `${screenshotRoot}-hagatha-capacity-nine-cells.png` })
  const bundle = reopened.locator('[data-hagatha-selector="-1"]')
  await bundle.waitFor()
  assert.match(await bundle.getAttribute('aria-label'), /Buy BARGAIN BUNDLE/)
  await bundle.hover()
  const bundleTooltip = await assertTooltip(reopened, [
    'BARGAIN BUNDLE',
    'TONIC',
    "SEEKER'S CHARM",
    'REVELATION CHARM',
  ])
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${screenshotRoot}-hagatha-capacity-bundle.png` })
  await reopened.getByRole('button', { name: 'Done' }).click()
  await reopened.waitFor({ state: 'detached' })
  const revelationStarterRanks = await captureRevelationStarterRanks(page)

  return {
    bundleTooltip,
    capacity: 9,
    fullMindTonic,
    goldAfterRejection: ordinaryFullMind.goldBefore,
    initialOfferLayout,
    ordinaryFullMind,
    outcomes,
    presentationCapacities: [3, 6, 9],
    purchases,
    postPurchaseOfferLayout,
    rejectedSelector,
    revelationStarterRanks,
  }
}

async function captureRevelationStarterRanks(page) {
  await page.getByRole('button', { name: 'Open skills' }).click()
  const skills = page.getByRole('dialog', { name: 'Skills' })
  await skills.waitFor()
  await page.locator(
    '.skill-book-stage[role="dialog"][aria-label="Skills"]'
      + '[data-transition-phase="settled"][data-renderer-state="ready"]',
  ).waitFor({ timeout: 10_000 })
  const entries = {
    fireball: skills.locator('[data-skill-id="16"]'),
    ringOfFire: skills.locator('[data-skill-id="21"]'),
  }
  const labels = {}
  for (const [name, entry] of Object.entries(entries)) {
    await entry.waitFor()
    labels[name] = await entry.getAttribute('aria-label')
  }
  assert.match(labels.fireball, /^Fireball, rank 2(?:,|$)/)
  assert.match(labels.ringOfFire, /^Ring of Fire, rank 2(?:,|$)/)
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${screenshotRoot}-hagatha-revelation-fire-starters.png` })
  await skills.getByRole('button', { name: 'Close skills' }).click()
  await skills.waitFor({ state: 'detached' })
  return labels
}

async function rejectHagathaSelector(
  page,
  hagatha,
  selector,
  expectedCopy,
  screenshotSuffix,
  captureButton = false,
) {
  const offer = hagatha.locator(`[data-hagatha-selector="${selector}"]`)
  const goldBefore = await dialogGold(hagatha)
  await offer.click()
  await offer.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await offer.click()
  const notice = hagatha.getByRole('alert')
  await notice.waitFor()
  await waitForNativeNoticeSettled(hagatha)
  assert.match(await notice.innerText(), /YOUR MIND IS FULL!/)
  assert.match(await notice.innerText(), expectedCopy)
  assert.equal(await dialogGold(hagatha), goldBefore)

  const okay = hagatha.getByRole('button', { name: 'OKAY' })
  const buttonBox = await okay.boundingBox()
  const expectedLayout = selector === 27
    ? {
        action: { height: 69, width: 196, x: 702, y: 381 },
        frame: '528.5,174.5,543,351',
        panel: '577.5,224.5,445,251',
      }
    : {
        action: { height: 69, width: 196, x: 702, y: 414 },
        frame: '531.5,141.5,537,417',
        panel: '580.5,191.5,439,317',
      }
  assertBoxNear(buttonBox, expectedLayout.action)
  assert.equal(await hagatha.getAttribute('data-native-msgbox-action'), [
    expectedLayout.action.x,
    expectedLayout.action.y,
    expectedLayout.action.width,
    expectedLayout.action.height,
  ].join(','))
  assert.equal(await hagatha.getAttribute('data-native-msgbox-frame'), expectedLayout.frame)
  assert.equal(await hagatha.getAttribute('data-native-msgbox-panel'), expectedLayout.panel)
  const idleChrome = captureButton ? await nativeButtonChromeReceipt(page, buttonBox) : null
  await page.screenshot({ path: `${screenshotRoot}-${screenshotSuffix}.png` })

  let pressedChrome = null
  if (captureButton) {
    await page.mouse.move(
      buttonBox.x + buttonBox.width / 2,
      buttonBox.y + buttonBox.height / 2,
    )
    await page.mouse.down()
    await hagatha.locator(
      'xpath=self::*[@data-native-pressed-control="message-primary"]',
    ).waitFor()
    pressedChrome = await nativeButtonChromeReceipt(page, buttonBox)
    await page.screenshot({ path: `${screenshotRoot}-${screenshotSuffix}-pressed.png` })
    await page.mouse.up()
  } else {
    await okay.click()
  }
  await notice.waitFor({ state: 'detached' })
  return { buttonBox, goldBefore, idleChrome, pressedChrome, selector }
}

async function hagathaOfferLayout(hagatha, selectors) {
  return Object.fromEntries(await Promise.all(selectors.map(async (selector) => {
    const box = await hagatha.locator(`[data-hagatha-selector="${selector}"]`).boundingBox()
    assert.ok(box, `Hagatha selector ${selector} has no browser geometry`)
    return [selector, box]
  })))
}

async function exerciseProtectedGarmentNotices(page) {
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  const receipts = {}
  for (const spec of [
    {
      action: { height: 69, width: 196, x: 702, y: 534.5 },
      copy: /jaunty angle/,
      frame: '530,221,540,458',
      item: 'Hat, Hat',
      key: 'hat',
      panel: '579,271,442,358',
      title: /A WIZARD WOULD NEVER REMOVE HIS HAT!/,
    },
    {
      action: { height: 69, width: 196, x: 702, y: 543 },
      copy: /avoidable disintegration/,
      frame: '535.5,212.5,529,475',
      item: 'Robe, Robe',
      key: 'robe',
      panel: '584.5,262.5,431,375',
      title: /A WIZARD WOULD NEVER REMOVE HIS ROBE!/,
    },
  ]) {
    const item = inventory.getByRole('button', { exact: true, name: spec.item })
    await dragInventoryPointer(page, inventory, item, { x: 800, y: 650 })
    const notice = inventory.getByRole('alert')
    await notice.waitFor()
    await waitForNativeNoticeSettled(inventory)
    assert.match(await notice.innerText(), spec.title)
    assert.match(await notice.innerText(), spec.copy)
    assert.equal(await inventory.getAttribute('data-native-msgbox-frame'), spec.frame)
    assert.equal(await inventory.getAttribute('data-native-msgbox-panel'), spec.panel)
    const okay = inventory.getByRole('button', { name: 'OKAY' })
    const buttonBox = await okay.boundingBox()
    assertBoxNear(buttonBox, spec.action)
    assert.equal(await inventory.getAttribute('data-native-msgbox-action'), [
      spec.action.x,
      spec.action.y,
      spec.action.width,
      spec.action.height,
    ].join(','))
    const idleChrome = await nativeButtonChromeReceipt(page, buttonBox)
    await page.screenshot({ path: `${screenshotRoot}-inventory-${spec.key}-warning.png` })
    await page.mouse.move(
      buttonBox.x + buttonBox.width / 2,
      buttonBox.y + buttonBox.height / 2,
    )
    await page.mouse.down()
    await inventory.locator(
      'xpath=self::*[@data-native-pressed-control="message-primary"]',
    ).waitFor()
    const pressedChrome = await nativeButtonChromeReceipt(page, buttonBox)
    await page.screenshot({ path: `${screenshotRoot}-inventory-${spec.key}-warning-pressed.png` })
    await page.mouse.up()
    await notice.waitFor({ state: 'detached' })
    await inventory.getByRole('button', { exact: true, name: spec.item }).waitFor()
    receipts[spec.key] = { buttonBox, idleChrome, pressedChrome }
  }
  await closeInventory(page, inventory)
  return receipts
}

async function nativeButtonChromeReceipt(page, bodyBox) {
  const surround = {
    height: bodyBox.height + 16,
    width: bodyBox.width + 12,
    x: bodyBox.x - 6,
    y: bodyBox.y - 6,
  }
  const screenshot = await page.screenshot({ clip: surround })
  const receipt = await page.evaluate(async ({ height, source, width }) => {
    const image = new Image()
    const loaded = new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true })
      image.addEventListener('error', reject, { once: true })
    })
    image.src = `data:image/png;base64,${source}`
    await loaded
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, width, height).data
    const matchingPixels = (left, top, right, bottom, predicate) => {
      let count = 0
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const offset = (y * width + x) * 4
          const red = data[offset]
          const green = data[offset + 1]
          const blue = data[offset + 2]
          if (predicate(red, green, blue)) count += 1
        }
      }
      return count
    }
    const brightPixels = (left, top, right, bottom) => matchingPixels(
      left,
      top,
      right,
      bottom,
      (red, green, blue) => red + green + blue > 150,
    )
    const goldPixels = (left, top, right, bottom) => matchingPixels(
      left,
      top,
      right,
      bottom,
      (red, green, blue) => red > 110 && green > 75 && blue < 125 && red > blue * 1.2,
    )
    return {
      bottomConnectorBright: brightPixels(70, height - 10, width - 70, height),
      bottomConnectorGold: goldPixels(70, height - 10, width - 70, height),
      leftEndBright: brightPixels(0, 0, 70, height),
      leftEndGold: goldPixels(0, 0, 70, height),
      rightEndBright: brightPixels(width - 70, 0, width, height),
      rightEndGold: goldPixels(width - 70, 0, width, height),
      topConnectorBright: brightPixels(70, 0, width - 70, 10),
      topConnectorGold: goldPixels(70, 0, width - 70, 10),
    }
  }, {
    height: Math.round(surround.height),
    source: screenshot.toString('base64'),
    width: Math.round(surround.width),
  })
  assert.ok(receipt.leftEndBright > 300, JSON.stringify(receipt))
  assert.ok(receipt.rightEndBright > 300, JSON.stringify(receipt))
  assert.ok(receipt.topConnectorBright > 20, JSON.stringify(receipt))
  assert.ok(receipt.bottomConnectorBright > 20, JSON.stringify(receipt))
  return receipt
}

async function exerciseDowsingInsufficientGoldNotice(page) {
  const canvas = page.locator('.hub-world-canvas')
  await navigateRegion(page, canvas, 'courtyard', { x: 1800, y: 650 })
  await holdUntilTransition(page, canvas, ['d', 'w'], 'library')
  await waitForSettledRegion(page, canvas, 'library')
  await navigateRegion(page, canvas, 'library', HUB_TRADER_GEOMETRY.shlorio.position, 60)
  await openNearbyTrader(page, 'shlorio')
  const dialogue = page.getByRole('dialog', { name: 'Talking to Shlorio' })
  await dialogue.waitFor()
  await waitForNativeSurfaceSettled(dialogue)
  await advanceDialogue(dialogue)
  await dialogue.locator('[data-service-trader="shlorio"]').click()
  const shlorio = page.getByRole('dialog', { name: "SHLORIO'S DISCOUNT DOWSING" })
  await shlorio.waitFor()
  await waitForNativeSurfaceSettled(shlorio)
  const dowse = shlorio.getByRole('button', { name: /DOWSE\s+650 gold/ })
  assertBoxNear(await dowse.boundingBox(), { height: 69, width: 250, x: 675, y: 265.5 })
  await dowse.click()

  const notice = shlorio.getByRole('alert')
  await notice.waitFor()
  await waitForNativeNoticeSettled(shlorio)
  assert.match(await notice.innerText(), /NOT ENOUGH GOLD!/)
  assert.match(await notice.innerText(), /endless, swirling, impossible colors/)
  assert.equal(await shlorio.getAttribute('data-native-msgbox-panel'), '585.5,208,429,284')
  assert.equal(await shlorio.getAttribute('data-native-msgbox-frame'), '536.5,158,527,384')
  assert.equal(await shlorio.getAttribute('data-native-msgbox-action'), '702,397.5,196,69')

  const okay = shlorio.getByRole('button', { name: 'OKAY' })
  const buttonBox = await okay.boundingBox()
  assertBoxNear(buttonBox, { height: 69, width: 196, x: 702, y: 397.5 })
  const idleChrome = await nativeButtonChromeReceipt(page, buttonBox)
  await page.screenshot({ path: `${screenshotRoot}-shlorio-insufficient-gold.png` })
  await page.mouse.move(
    buttonBox.x + buttonBox.width / 2,
    buttonBox.y + buttonBox.height / 2,
  )
  await page.mouse.down()
  await shlorio.locator(
    'xpath=self::*[@data-native-pressed-control="message-primary"]',
  ).waitFor()
  const pressedChrome = await nativeButtonChromeReceipt(page, buttonBox)
  await page.screenshot({ path: `${screenshotRoot}-shlorio-insufficient-gold-pressed.png` })
  await page.mouse.up()
  await notice.waitFor({ state: 'detached' })
  await shlorio.getByRole('button', { name: 'Done' }).click()
  await shlorio.waitFor({ state: 'detached' })
  return { buttonBox, idleChrome, pressedChrome }
}

async function exerciseSharedButtonSiblings(page) {
  const canvas = page.locator('.hub-world-canvas')
  await navigateRegion(page, canvas, 'courtyard', { x: 1800, y: 650 })
  await holdUntilTransition(page, canvas, ['d', 'w'], 'library')
  await waitForSettledRegion(page, canvas, 'library')
  await navigateRegion(page, canvas, 'library', HUB_TRADER_GEOMETRY.shlorio.position, 60)
  await openNearbyTrader(page, 'shlorio')
  const dialogue = page.getByRole('dialog', { name: 'Talking to Shlorio' })
  await dialogue.waitFor()
  await waitForNativeSurfaceSettled(dialogue)
  await advanceDialogue(dialogue)
  await dialogue.locator('[data-service-trader="shlorio"]').click()
  const shlorio = page.getByRole('dialog', { name: "SHLORIO'S DISCOUNT DOWSING" })
  await shlorio.waitFor()
  await waitForNativeSurfaceSettled(shlorio)
  const dowse = shlorio.getByRole('button', { name: /DOWSE\s+650 gold/ })
  const dowseBox = await dowse.boundingBox()
  assertBoxNear(dowseBox, { height: 69, width: 250, x: 675, y: 265.5 })
  await page.screenshot({ path: `${screenshotRoot}-shlorio-dowse-shared-button-idle.png` })
  const dowseIdleChrome = await nativeButtonChromeReceipt(page, dowseBox)
  await page.mouse.move(
    dowseBox.x + dowseBox.width / 2,
    dowseBox.y + dowseBox.height / 2,
  )
  await page.mouse.down()
  await shlorio.locator('xpath=self::*[@data-native-pressed-control="dowsing"]').waitFor()
  const dowsePressedChrome = await nativeButtonChromeReceipt(page, dowseBox)
  await page.screenshot({ path: `${screenshotRoot}-shlorio-dowse-shared-button-pressed.png` })
  await page.mouse.up()
  await shlorio.getByRole('button', { name: /^Buy .* for \d+ gold$/ }).first().waitFor()
  await shlorio.getByRole('button', { name: 'Done' }).click()
  await shlorio.waitFor({ state: 'detached' })

  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  const equippedStaff = inventory.getByRole('button', { exact: true, name: 'Weapon, Staff' }).first()
  await dragInventoryPointer(page, inventory, equippedStaff, { x: 800, y: 650 })
  const backpackStaff = inventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Staff, quantity 1',
  })
  await backpackStaff.waitFor()
  await dragInventoryPointer(page, inventory, backpackStaff, { x: 1550, y: 850 })
  const unforgeNotice = inventory.getByRole('alert')
  await unforgeNotice.waitFor()
  await waitForNativeNoticeSettled(inventory)
  assert.match(await unforgeNotice.innerText(), /REALLY UNFORGE THIS\?/)
  const unforge = inventory.getByRole('button', { name: 'UNFORGE' })
  const cancel = inventory.getByRole('button', { name: 'CANCEL' })
  const unforgeBox = await unforge.boundingBox()
  const cancelBox = await cancel.boundingBox()
  assertBoxNear(unforgeBox, { height: 69, width: 197, x: 595, y: 573 })
  assertBoxNear(cancelBox, { height: 69, width: 197, x: 811, y: 573 })
  const unforgeIdleChrome = await nativeButtonChromeReceipt(page, unforgeBox)
  await page.mouse.move(
    cancelBox.x + cancelBox.width / 2,
    cancelBox.y + cancelBox.height / 2,
  )
  await page.mouse.down()
  await inventory.locator(
    'xpath=self::*[@data-native-pressed-control="message-secondary"]',
  ).waitFor()
  const cancelPressedChrome = await nativeButtonChromeReceipt(page, cancelBox)
  await page.screenshot({ path: `${screenshotRoot}-inventory-unforge-shared-button-pressed.png` })
  await page.mouse.up()
  await unforgeNotice.waitFor({ state: 'detached' })
  await closeInventory(page, inventory)

  return {
    dowsing: { buttonBox: dowseBox, idleChrome: dowseIdleChrome, pressedChrome: dowsePressedChrome },
    unforge: {
      cancelBox,
      cancelPressedChrome,
      idleChrome: unforgeIdleChrome,
      unforgeBox,
    },
  }
}

async function captureHagathaCapacityPresentation(page, hagatha, capacity) {
  assert.match(await hagatha.locator('.hub-charm-capacity').innerText(), new RegExp(`/ ${capacity}$`))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${screenshotRoot}-hagatha-capacity-${capacity}.png` })
  await hagatha.getByRole('button', { name: 'Done' }).click()
  await hagatha.waitFor({ state: 'detached' })

  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  for (const expectedPage of [1, 2]) {
    await inventory.locator('[data-native-stats-arrow="down"]').click()
    await inventory.locator(
      `xpath=self::*[@data-native-stats-page="${expectedPage}"]`,
    ).waitFor()
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${screenshotRoot}-inventory-capacity-${capacity}.png` })
  await closeInventory(page, inventory)

  await page.getByRole('button', { name: 'Open Hagatha interaction' }).click()
  const reopened = page.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES" })
  await reopened.waitFor()
  await waitForNativeSurfaceSettled(reopened)
  return reopened
}

async function buyHagathaSelector(page, hagatha, selector, expectedCount, expectedCapacity) {
  const offer = hagatha.locator(`[data-hagatha-selector="${selector}"]`)
  const price = Number.parseInt(
    (await offer.locator('.hub-trader-price').innerText()).replace(/\D/g, ''),
    10,
  )
  const goldBefore = await dialogGold(hagatha)
  await offer.click()
  await offer.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await offer.evaluate(node => node.click())
  await hagatha.locator('.hub-charm-capacity').filter({
    hasText: `${expectedCount} / ${expectedCapacity}`,
  }).waitFor()
  await hagatha.getByLabel('Owned Charms and Curses')
    .locator('[data-owned-hagatha-selector]').nth(expectedCount - 1).waitFor()
  await waitForDialogGold(hagatha, goldBefore - price)
  const emptySlot = hagatha.locator('[data-store-empty-slot]').first()
  if (await emptySlot.count() > 0) await emptySlot.click()
  return { capacity: expectedCapacity, count: expectedCount, price, selector }
}

async function exerciseStarterInventory(page) {
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  assert.equal(await inventory.getByRole('button', { name: /^Equip / }).count(), 0)
  await page.screenshot({ path: `${screenshotRoot}-inventory.png` })

  const healthPotion = inventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Health Potion, quantity 1',
  })
  await activateInventoryPointer(page, healthPotion)
  await healthPotion.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await page.waitForTimeout(650)
  await page.screenshot({ path: `${screenshotRoot}-inventory-health-item-info.png` })
  await doubleActivateInventoryPointer(page, healthPotion)
  await healthPotion.waitFor({ state: 'detached' })
  step('native potion double-activation consumed exactly one stack member')

  const equippedStaff = inventory.getByRole('button', {
    exact: true,
    name: 'Weapon, Staff',
  }).first()
  await dragInventoryPointer(page, inventory, equippedStaff, { x: 800, y: 650 }, async () => {
    assert.match(await inventory.getAttribute('data-native-inventory-dragging'), /^equipment:weapon$/)
    await page.screenshot({ path: `${screenshotRoot}-inventory-staff-held.png` })
  })
  const backpackStaff = inventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Staff, quantity 1',
  })
  await backpackStaff.waitFor()
  assert.equal(await inventory.getByRole('button', { exact: true, name: 'Weapon, empty' }).count(), 2)
  await dragInventoryPointer(
    page,
    inventory,
    backpackStaff,
    inventory.locator('[data-equipment-slot="weapon"]').first(),
  )
  await inventory.getByRole('button', { exact: true, name: 'Weapon, Staff' }).first().waitFor()

  await dragInventoryPointer(
    page,
    inventory,
    inventory.getByRole('button', { exact: true, name: 'Weapon, Staff' }).first(),
    { x: 800, y: 250 },
  )
  await inventory.getByRole('button', { exact: true, name: 'Weapon, Staff' }).first().waitFor()
  assert.equal(await inventory.getByLabel('Backpack').getByRole('button', {
    exact: true,
    name: 'Staff, quantity 1',
  }).count(), 0)

  await dragInventoryPointer(
    page,
    inventory,
    inventory.getByRole('button', { exact: true, name: 'Hat, Hat' }),
    { x: 800, y: 650 },
  )
  const hatNotice = inventory.getByRole('alert')
  await hatNotice.waitFor()
  assert.match(await hatNotice.innerText(), /A WIZARD WOULD NEVER REMOVE HIS HAT!/)
  assert.match(await hatNotice.innerText(), /jaunty angle/)
  await page.screenshot({ path: `${screenshotRoot}-inventory-hat-warning.png` })
  await inventory.getByRole('button', { name: 'OKAY' }).click()
  await inventory.getByRole('button', { exact: true, name: 'Hat, Hat' }).waitFor()
  await closeInventory(page, inventory)
  step('native drag, invalid release, and protected Hat branches complete')
}

async function assertBackpackQuantity(page, name, quantity) {
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  assert.equal(await inventory.getByLabel(`${name}, quantity ${quantity}`).count(), 1)
  await closeInventory(page, inventory)
}

async function dialogGold(dialog) {
  return Number(await dialog.locator('[data-player-gold]').getAttribute('data-player-gold'))
}

async function closeInventory(page, inventory) {
  assert.equal(await inventory.getByRole('button', { name: 'Done' }).count(), 0)
  await page.keyboard.press('i')
  await inventory.waitFor({ state: 'hidden' })
  await page.locator(
    '.hub-scene[data-gameplay-input-blocked="false"][data-presentation-paused="false"]',
  ).waitFor({ timeout: 10_000 })
}

async function clickInventoryStagePoint(page, inventory, point) {
  const stageBox = await inventory.boundingBox()
  assert.ok(stageBox, 'inventory stage has no browser geometry')
  await page.mouse.click(
    stageBox.x + point.x / 1600 * stageBox.width,
    stageBox.y + point.y / 900 * stageBox.height,
  )
}

async function waitForDialogGold(dialog, expected) {
  await dialog.locator(`[data-player-gold="${expected}"]`).waitFor({ timeout: 30_000 })
  assert.equal(await dialogGold(dialog), expected)
}

async function waitForNativeSurfaceSettled(dialog) {
  await dialog.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({
    state: 'attached',
    timeout: 10_000,
  })
}

async function waitForNativeNoticeSettled(dialog) {
  await dialog.locator('.hub-inventory-native-canvas[data-native-notice-reveal="settled"]').waitFor({
    state: 'attached',
    timeout: 10_000,
  })
}

async function advanceDialogue(dialog) {
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.getByRole('button', { name: 'Done' }).waitFor()
  assert.equal(await dialog.getAttribute('data-native-chat-phase'), 'choices')
}

async function openNearbyTrader(page, trader) {
  const prompt = page.locator(`.game-interact-prompt[data-interaction-target="hub:${trader}"]`)
  await prompt.waitFor({ timeout: 10_000 })
  await prompt.click()
}

async function activateTraderByPointer(page, canvas, trader) {
  const position = await playerPosition(canvas)
  const box = await canvas.boundingBox()
  assert.ok(box)
  const origin = hubRegionCameraOrigin('courtyard', position, { width: 1600, height: 900 })
  const actor = HUB_TRADER_GEOMETRY[trader].position
  const screen = {
    x: box.x + (actor.x - origin.x) * HUB_CAMERA_SCALE * box.width / 1600,
    y: box.y + (actor.y - origin.y) * HUB_CAMERA_SCALE * box.height / 900,
  }
  await page.mouse.click(screen.x, screen.y)
}

async function assertInputBlocked(page, canvas) {
  assert.equal(
    await page.locator('.hub-scene').getAttribute('data-gameplay-input-blocked'),
    'true',
  )
  const before = await playerPosition(canvas)
  await page.keyboard.down('d')
  await page.waitForTimeout(500)
  await page.keyboard.up('d')
  await page.waitForTimeout(100)
  const after = await playerPosition(canvas)
  assert.ok(distance(before, after) < 2, JSON.stringify({ before, after }))
}

async function waitForPlayers(page, expected) {
  await page.waitForFunction((count) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame.playerCount === count
  ), expected, { timeout: 15_000 })
}

async function playerPosition(canvas) {
  return canvas.evaluate((node) => ({
    x: node.__sdrHubFrame.playerX,
    y: node.__sdrHubFrame.playerY,
  }))
}

async function navigateRegion(page, canvas, region, target, arrivalRadius = 20) {
  const start = await playerPosition(canvas)
  const initialRoute = planRoute(region, start, target, arrivalRadius)
  step(`route ${region} ${JSON.stringify(start)} -> ${JSON.stringify(target)} via ${JSON.stringify(initialRoute)}`)
  const deadline = Date.now() + 180_000
  let lastMovementAt = Date.now()
  let stationaryPulses = 0
  let nudgeCount = 0
  let pulseCount = 0
  while (Date.now() < deadline) {
    assert.equal(await canvas.getAttribute('data-hub-region'), region)
    const current = await playerPosition(canvas)
    const remaining = distance(current, target)
    if (remaining <= arrivalRadius + 5) return
    const route = planRoute(region, current, target, arrivalRadius)
    const waypoint = route[0] ?? target
    const requestedKeys = movementKeys(current, waypoint)
    const keys = stationaryPulses >= 4
      ? navigationNudgeKeys(region, current, target, requestedKeys, nudgeCount++)
      : requestedKeys
    assert.ok(keys.length > 0, `no movement toward ${JSON.stringify(waypoint)} from ${JSON.stringify(current)}`)
    const pressed = new Set()
    try {
      await syncKeys(page, pressed, keys)
      await page.waitForTimeout(stationaryPulses >= 4 ? 250 : 150)
    } finally {
      await syncKeys(page, pressed, [])
    }
    await page.waitForTimeout(100)
    const after = await playerPosition(canvas)
    if (distance(current, after) >= 0.5) {
      lastMovementAt = Date.now()
      stationaryPulses = 0
    } else {
      stationaryPulses += 1
    }
    pulseCount += 1
    if (pulseCount % 20 === 0) {
      step(`navigation ${region} ${JSON.stringify(await playerPosition(canvas))}; ${remaining.toFixed(1)} remaining`)
    }
    if (Date.now() - lastMovementAt > 30_000) {
      throw new Error(
        `navigation stalled in ${region} at ${JSON.stringify(await playerPosition(canvas))} toward ${JSON.stringify(target)}`,
      )
    }
  }
  throw new Error(
    `navigation timed out in ${region} at ${JSON.stringify(await playerPosition(canvas))} toward ${JSON.stringify(target)}`,
  )
}

function movementKeys(current, target) {
  const keys = []
  if (target.x - current.x > 6) keys.push('d')
  if (target.x - current.x < -6) keys.push('a')
  if (target.y - current.y > 6) keys.push('s')
  if (target.y - current.y < -6) keys.push('w')
  return keys
}

function navigationNudgeKeys(region, current, target, requestedKeys, attempt) {
  const requested = new Set(requestedKeys)
  const horizontal = target.x >= current.x ? ['d', 'a'] : ['a', 'd']
  const vertical = target.y >= current.y ? ['s', 'w'] : ['w', 's']
  const candidates = requested.size === 1 && (requested.has('w') || requested.has('s'))
    ? horizontal
    : requested.size === 1
      ? vertical
      : attempt % 2 === 0
        ? horizontal
        : vertical
  const ordered = attempt % 2 === 0 ? candidates : [...candidates].reverse()
  const key = ordered.find((candidate) => {
    const delta = {
      x: candidate === 'd' ? 35 : candidate === 'a' ? -35 : 0,
      y: candidate === 's' ? 35 : candidate === 'w' ? -35 : 0,
    }
    return safeNavigationPoint(region, { x: current.x + delta.x, y: current.y + delta.y })
  })
  return key ? [key] : requestedKeys
}

function planRoute(region, start, target, arrivalRadius) {
  const step = 10
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ]
  const open = new Map([['0,0', {
    cost: 0,
    estimate: distance(start, target),
    ix: 0,
    iy: 0,
    position: start,
  }]])
  const best = new Map([['0,0', 0]])
  const parents = new Map()
  let goalKey
  for (let visited = 0; open.size > 0 && visited < 100_000; visited += 1) {
    const [key, current] = [...open].reduce((closest, entry) => (
      entry[1].estimate < closest[1].estimate ? entry : closest
    ))
    open.delete(key)
    if (distance(current.position, target) <= arrivalRadius) {
      goalKey = key
      break
    }
    for (const [directionX, directionY] of directions) {
      const ix = current.ix + directionX
      const iy = current.iy + directionY
      const nextKey = `${ix},${iy}`
      const delta = { x: directionX * step, y: directionY * step }
      const expected = {
        x: current.position.x + delta.x,
        y: current.position.y + delta.y,
      }
      if (!safeNavigationPoint(region, expected)) continue
      const moved = moveWithHubRegionCollisionState(
        region,
        current.position,
        delta,
        PLAYER_CHARACTER_RADIUS,
        0x51a7c011,
      ).position
      if (distance(moved, expected) > 0.01) continue
      const cost = current.cost + Math.hypot(delta.x, delta.y)
      if (cost >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue
      best.set(nextKey, cost)
      parents.set(nextKey, key)
      open.set(nextKey, {
        cost,
        estimate: cost + Math.max(0, distance(expected, target) - arrivalRadius),
        ix,
        iy,
        position: expected,
      })
    }
  }
  assert.ok(goalKey, `could not plan ${region} route to ${JSON.stringify(target)}`)
  const nodes = []
  for (let key = goalKey; key !== '0,0'; key = parents.get(key)) {
    const [ix, iy] = key.split(',').map(Number)
    nodes.push({ x: start.x + ix * step, y: start.y + iy * step })
  }
  nodes.reverse()
  if (arrivalRadius <= 20) nodes.push(target)
  return simplifyRoute(region, start, nodes)
}

function simplifyRoute(region, start, route) {
  const simplified = []
  let anchor = start
  let nextIndex = 0
  while (nextIndex < route.length) {
    let furthest = route.length - 1
    while (furthest > nextIndex && !canTraverseLine(region, anchor, route[furthest])) {
      furthest -= 1
    }
    anchor = route[furthest]
    simplified.push(anchor)
    nextIndex = furthest + 1
  }
  return simplified
}

function canTraverseLine(region, start, target) {
  const steps = Math.max(1, Math.ceil(distance(start, target) / 5))
  let current = start
  for (let index = 1; index <= steps; index += 1) {
    const expected = {
      x: start.x + (target.x - start.x) * index / steps,
      y: start.y + (target.y - start.y) * index / steps,
    }
    if (!safeNavigationPoint(region, expected)) return false
    const moved = moveWithHubRegionCollisionState(
      region,
      current,
      { x: expected.x - current.x, y: expected.y - current.y },
      PLAYER_CHARACTER_RADIUS,
      0x51a7c011,
    ).position
    if (distance(moved, expected) > 0.01) return false
    current = expected
  }
  return true
}

function safeNavigationPoint(region, point) {
  if (!isHubRegionTraversable(region, point, PLAYER_CHARACTER_RADIUS)) return false
  return region !== 'courtyard' || hubPortalAt('courtyard', point, 50)?.destination !== 'office'
}

async function holdUntilTransition(page, canvas, keys, destination) {
  const pressed = new Set()
  const deadline = Date.now() + 10_000
  try {
    await syncKeys(page, pressed, keys)
    while (Date.now() < deadline) {
      const region = await canvas.getAttribute('data-hub-region')
      if (region === destination) return
      await page.waitForTimeout(25)
    }
    throw new Error(`portal input did not enter ${destination}`)
  } finally {
    await syncKeys(page, pressed, [])
  }
}

async function waitForSettledRegion(page, canvas, region) {
  await page.waitForFunction((expected) => {
    const node = document.querySelector('.hub-world-canvas')
    return node?.dataset.hubRegion === expected
      && node.dataset.transitionPhase === 'none'
      && Number(node.dataset.transitionAlpha) === 0
  }, region, { timeout: 15_000 })
  assert.equal(await canvas.getAttribute('data-hub-region'), region)
}

async function syncKeys(page, pressed, requested) {
  const next = new Set(requested)
  for (const key of pressed) {
    if (next.has(key)) continue
    await page.keyboard.up(key)
    pressed.delete(key)
  }
  for (const key of next) {
    if (pressed.has(key)) continue
    await page.keyboard.down(key)
    pressed.add(key)
  }
}

function waitForDowsingFlashDataUrl(canvas) {
  return canvas.evaluate((node) => new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error('timed out waiting for the dowsing flash'))
    }, 15_000)
    const capture = () => {
      if (node.dataset.dowsingFlash !== 'active') return
      window.clearTimeout(timeout)
      observer.disconnect()
      resolve(node.toDataURL('image/png'))
    }
    const observer = new MutationObserver(capture)
    observer.observe(node, { attributeFilter: ['data-dowsing-flash'], attributes: true })
    capture()
  }))
}

function assertBoxNear(actual, expected, tolerance = 0.05) {
  assert.ok(actual, 'native action has no browser geometry')
  for (const field of ['height', 'width', 'x', 'y']) {
    assert.ok(
      Math.abs(actual[field] - expected[field]) <= tolerance,
      JSON.stringify({ actual, expected, field, tolerance }),
    )
  }
}

function parsePurchaseLabel(label) {
  const match = /^Buy (.+) for (\d+) gold$/.exec(label || '')
  assert.ok(match, `invalid purchase label ${JSON.stringify(label)}`)
  return { name: match[1], price: Number(match[2]) }
}

async function dragInventoryPointer(page, inventory, source, destination, whileHeld) {
  const sourceBox = await source.boundingBox()
  const stageBox = await inventory.boundingBox()
  assert.ok(sourceBox, 'native inventory drag source has no browser geometry')
  assert.ok(stageBox, 'native inventory stage has no browser geometry')
  let destinationPoint
  if (typeof destination.boundingBox === 'function') {
    const destinationBox = await destination.boundingBox()
    assert.ok(destinationBox, 'inventory drag destination has no browser geometry')
    destinationPoint = {
      x: destinationBox.x + destinationBox.width / 2,
      y: destinationBox.y + destinationBox.height / 2,
    }
  } else {
    destinationPoint = {
      x: stageBox.x + destination.x * stageBox.width / 1600,
      y: stageBox.y + destination.y * stageBox.height / 900,
    }
  }
  const sourcePoint = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2,
  }
  await page.mouse.move(sourcePoint.x, sourcePoint.y)
  await page.mouse.down()
  await page.mouse.move(sourcePoint.x + 15, sourcePoint.y, { steps: 3 })
  await page.waitForFunction(() => (
    document.querySelector('.hub-native-ui-stage')
      ?.dataset.nativeInventoryDragging !== ''
  ))
  await page.mouse.move(destinationPoint.x, destinationPoint.y, { steps: 6 })
  if (whileHeld) await whileHeld()
  await page.mouse.up()
  await page.waitForFunction(() => (
    document.querySelector('.hub-native-ui-stage')
      ?.dataset.nativeInventoryDragging === ''
  ))
}

async function activateInventoryPointer(page, source) {
  const box = await source.boundingBox()
  assert.ok(box, 'inventory activation source has no browser geometry')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
}

async function doubleActivateInventoryPointer(page, source) {
  const box = await source.boundingBox()
  assert.ok(box, 'inventory double-activation source has no browser geometry')
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2)
}

function equipmentSlotForDowsingItem(name) {
  const recipe = DOWSING_EQUIPMENT_RECIPES.find((candidate) => candidate.name === name)
  assert.ok(recipe, `dowsing item ${JSON.stringify(name)} has no native equipment recipe`)
  switch (recipe.type) {
    case 'amulet': return 'amulet'
    case 'hat': return 'hat'
    case 'ring': return 'ring-0'
    case 'robe': return 'robe'
    case 'staff':
    case 'wand': return 'weapon'
    default: throw new Error(`unsupported dowsing equipment type ${JSON.stringify(recipe.type)}`)
  }
}

function equipmentSlotLabel(slot) {
  return {
    amulet: 'Amulet',
    hat: 'Hat',
    'ring-0': 'Ring I',
    robe: 'Robe',
    weapon: 'Weapon',
  }[slot]
}

function parseDowsingFee(label) {
  const match = /^DOWSE ([\d,]+) gold$/.exec(label || '')
  assert.ok(match, `invalid dowsing label ${JSON.stringify(label)}`)
  return Number(match[1].replaceAll(',', ''))
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

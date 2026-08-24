import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

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

const baseUrl = process.env.SDR_GAME_TRADER_SMOKE_URL || 'http://127.0.0.1:4189'
const hostElement = process.env.SDR_GAME_TRADER_HOST_ELEMENT || 'Fire'
const screenshotRoot = process.env.SDR_GAME_TRADER_SCREENSHOT_ROOT || '/tmp/solomon-dark-hub-trader'
const singleClient = process.env.SDR_GAME_TRADER_SINGLE_CLIENT === '1'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const hostPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const guestPage = await browser.newPage({ viewport: { width: 960, height: 540 } })
const browserErrors = []
for (const page of [hostPage, guestPage]) {
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(bypassStartupAudioPreload)
  await page.route('**/deployment.json?*', async (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    await route.fulfill({ json: { revision } })
  })
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket
    window.__sdrSmokeKeyEvents = []
    window.__sdrSmokeWebSocketEvents = []
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
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(`${message.text()} @ ${message.location().url}`)
    }
  })
}

try {
  step('preloading both game clients')
  await Promise.all([loadGame(hostPage), ...(singleClient ? [] : [loadGame(guestPage)])])
  step('entering host Hub')
  await enterHub(hostPage, hostElement)
  if (!singleClient) {
    step('entering guest Hub')
    await enterHub(guestPage, 'Earth')
    await Promise.all([waitForPlayers(hostPage, 2), waitForPlayers(guestPage, 2)])
    step('two participants replicated')
  }

  const canvas = hostPage.locator('.hub-world-canvas')
  if (!singleClient) assert.equal(await inventoryGold(guestPage), 500)
  await focusPage(hostPage)
  const hostStartingGold = await inventoryGold(hostPage)
  assert.equal(hostStartingGold, 500)
  step('both participants start with the retail 500 gold')
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
  assert.equal(await fomentius.getByRole('tooltip').count(), 0)
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-selected.png` })
  await fomentius.locator('[data-store-empty-slot]').first().click()
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
  assert.equal(await hagatha.getByRole('tooltip').count(), 0)
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
  assert.equal(await shlorio.getByRole('tooltip').count(), 0)
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
  process.stdout.write(`${JSON.stringify({
    browserErrors,
    dowsingItem,
    equipmentSlot,
    finalHostGold,
    guestGold: singleClient ? null : 500,
    singleClient,
    status: 'ok',
    stock,
  })}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    browserErrors,
    guest: await pageReceipt(guestPage),
    host: await pageReceipt(hostPage),
  })}\n`)
  throw error
} finally {
  await browser.close()
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
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  try {
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
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

async function inventoryGold(page) {
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  const gold = await dialogGold(inventory)
  await closeInventory(page, inventory)
  return gold
}

async function fundTraderSmoke(page) {
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
  ), 10_000)
  assert.equal(result.ok, true, result.error)
  await page.waitForTimeout(100)
  assert.equal(await inventoryGold(page), 10_000)
  step('host received an explicit Lua-funded trader test bankroll')
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

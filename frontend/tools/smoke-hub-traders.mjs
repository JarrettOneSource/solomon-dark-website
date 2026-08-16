import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

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
import { HUB_TRADER_GEOMETRY } from '../src/game/hub-inventory-presentation.ts'

const baseUrl = process.env.SDR_GAME_TRADER_SMOKE_URL || 'http://127.0.0.1:4189'
const screenshotRoot = process.env.SDR_GAME_TRADER_SCREENSHOT_ROOT || '/tmp/solomon-dark-hub-trader'
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const hostPage = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const guestPage = await browser.newPage({ viewport: { width: 960, height: 540 } })
const browserErrors = []
for (const page of [hostPage, guestPage]) {
  await page.addInitScript(bypassStartupAudioPreload)
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
    if (message.type() === 'error') browserErrors.push(message.text())
  })
}

try {
  step('preloading both game clients')
  await Promise.all([loadGame(hostPage), loadGame(guestPage)])
  step('entering host Hub')
  await enterHub(hostPage, 'Fire')
  step('entering guest Hub')
  await enterHub(guestPage, 'Earth')
  await Promise.all([waitForPlayers(hostPage, 2), waitForPlayers(guestPage, 2)])
  step('two participants replicated')

  const canvas = hostPage.locator('.hub-world-canvas')
  const guestStartingGold = await inventoryGold(guestPage)
  assert.equal(guestStartingGold, 10_000)
  await focusPage(hostPage)
  const hostStartingGold = await inventoryGold(hostPage)
  assert.equal(hostStartingGold, 10_000)
  step('both participants start with 10,000 gold')

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
  const stockCell = fomentius.getByRole('button', { name: /^Buy .* for \d+ gold$/ }).first()
  const stockLabel = await stockCell.getAttribute('aria-label')
  const stock = parsePurchaseLabel(stockLabel)
  const beforeFomentius = await dialogGold(fomentius)
  await stockCell.click()
  await stockCell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius-selected.png` })
  await stockCell.click()
  await waitForDialogGold(fomentius, beforeFomentius - stock.price)
  await hostPage.screenshot({ path: `${screenshotRoot}-fomentius.png` })
  step('Fomentius purchase complete')
  await fomentius.getByRole('button', { name: 'Done' }).click()
  await assertBackpackQuantity(hostPage, stock.name, stock.name === 'Health Potion' || stock.name === 'Mana Potion' ? 2 : 1)

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
  await backpackItem.click()
  const storedItem = luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    name: new RegExp(`^${escapeRegExp(stock.name)}, quantity `),
  })
  await storedItem.waitFor()
  assert.equal(await dialogGold(luthacus), goldBeforeStorage)
  await storedItem.click()
  await storedItem.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await storedItem.click()
  await backpackItem.waitFor()
  assert.equal(await luthacus.getByLabel('Scavenged Goods').getByRole('button', {
    name: new RegExp(`^${escapeRegExp(stock.name)}, quantity `),
  }).count(), 0)
  await hostPage.screenshot({ path: `${screenshotRoot}-luthacus.png` })
  step('Luthacus round trip complete')
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
  await lifeCharm.click()
  await lifeCharm.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha-selected.png` })
  await lifeCharm.click()
  await waitForDialogGold(hagatha, beforeHagatha - lifeCharmPrice)
  await lifeCharm.waitFor({ state: 'detached' })
  assert.match(await hagatha.locator('.hub-charm-capacity').innerText(), /1 \/ 3/)
  await hostPage.screenshot({ path: `${screenshotRoot}-hagatha.png` })
  step('Hagatha purchase complete')
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
  const [flashDataUrl] = await Promise.all([
    flashCanvas.evaluate((canvas) => new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        observer.disconnect()
        reject(new Error('timed out waiting for the dowsing flash'))
      }, 15_000)
      const capture = () => {
        if (canvas.dataset.dowsingFlash !== 'active') return
        window.clearTimeout(timeout)
        observer.disconnect()
        resolve(canvas.toDataURL('image/png'))
      }
      const observer = new MutationObserver(capture)
      observer.observe(canvas, { attributeFilter: ['data-dowsing-flash'], attributes: true })
      capture()
    })),
    dowse.click(),
  ])
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
  await dowsingCell.click()
  await dowsingCell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-selected.png` })
  await dowsingCell.click()
  await waitForDialogGold(shlorio, beforeDowsing - 650 - dowsingItem.price)
  await shlorio.getByRole('button', { name: /DOWSE\s+\d+ gold/ }).waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-shlorio-purchased.png` })
  step('Shlorio purchase complete')
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
      await shlorio.getByRole('button', { name: 'OKAY' }).click()
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
  const equipmentItem = inventory.getByLabel('Backpack').getByRole('button', {
    name: `${dowsingItem.name}, quantity 1`,
  })
  await equipmentItem.click()
  const equipAction = inventory.getByRole('button', { name: /^Equip / }).first()
  const equipmentSlot = (await equipAction.innerText()).replace(/^Equip /, '')
  await equipAction.click()
  const equipped = inventory.getByRole('button', {
    exact: true,
    name: `${equipmentSlot}, ${dowsingItem.name}`,
  })
  await equipped.waitFor()
  await hostPage.screenshot({ path: `${screenshotRoot}-inventory-equipped.png` })
  await equipped.click()
  await equipmentItem.waitFor()
  await inventory.getByRole('button', {
    exact: true,
    name: `${equipmentSlot}, empty`,
  }).waitFor()
  await inventory.getByRole('button', { name: 'Done' }).click()

  assert.equal(await inventoryGold(hostPage), finalHostGold)
  await focusPage(guestPage)
  assert.equal(await inventoryGold(guestPage), 10_000)
  await guestPage.keyboard.press('i')
  const guestInventory = guestPage.getByRole('dialog', { name: 'Inventory' })
  await guestInventory.waitFor()
  await waitForNativeSurfaceSettled(guestInventory)
  assert.equal(await guestInventory.getByLabel(/Health Potion, quantity 1/).count(), 1)
  assert.equal(await guestInventory.getByLabel(/Mana Potion, quantity 1/).count(), 1)
  await guestPage.screenshot({ path: `${screenshotRoot}-guest-isolated.png` })

  assert.deepEqual(browserErrors, [])
  process.stdout.write(`${JSON.stringify({
    browserErrors,
    dowsingItem,
    equipmentSlot,
    finalHostGold,
    guestGold: 10_000,
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

async function enterHub(page, element) {
  await focusPage(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  try {
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
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
  await inventory.getByRole('button', { name: 'Done' }).click()
  return gold
}

async function assertBackpackQuantity(page, name, quantity) {
  await page.keyboard.press('i')
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.waitFor()
  await waitForNativeSurfaceSettled(inventory)
  assert.equal(await inventory.getByLabel(`${name}, quantity ${quantity}`).count(), 1)
  await inventory.getByRole('button', { name: 'Done' }).click()
}

async function dialogGold(dialog) {
  return Number(await dialog.locator('[data-player-gold]').getAttribute('data-player-gold'))
}

async function waitForDialogGold(dialog, expected) {
  await dialog.locator(`[data-player-gold="${expected}"]`).waitFor({ timeout: 10_000 })
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
  const prompt = page.locator(`.hub-trader-interact[data-hub-trader="${trader}"]`)
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

function parsePurchaseLabel(label) {
  const match = /^Buy (.+) for (\d+) gold$/.exec(label || '')
  assert.ok(match, `invalid purchase label ${JSON.stringify(label)}`)
  return { name: match[1], price: Number(match[2]) }
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

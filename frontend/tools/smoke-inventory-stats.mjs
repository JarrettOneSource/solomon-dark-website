import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { generateNativeRandomEquipmentEffects } from '../src/game/core-kernels/native-random-equipment.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { createGameSimulation, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { HUB_INVENTORY_GRID, HUB_PRIMARY_SPELL_PANE, hubInventorySlotPosition, hubOwnedPerkSlotRect } from '../src/game/renderer/hub-inventory-render-contract.ts'

const screenshotRoot = process.env.SDR_INVENTORY_STATS_SCREENSHOT_ROOT
  || await mkdtemp(join(tmpdir(), 'solomon-inventory-stats-'))
await mkdir(screenshotRoot, { recursive: true })
const receipts = []
const mobile = process.env.SDR_INVENTORY_STATS_MOBILE === '1'
const playerId = 'inventory-stats-owner'
const ringId = 40_001
const ownedPerks = [27, 6, 27, 0, 1, 2, 3, 4, 5]
const weapons = ['wand', 'staff'].map((type, index) => {
  const generated = generateNativeRandomEquipmentEffects(createNativeRng(252), type, 1, {
    advancedUnlocks: new Array(8).fill(false),
  })
  assert.deepEqual(generated.effects, [{ kind: 3, magnitude: 5, operator: 0, target: 0 }])
  return {
    id: 40_002 + index, kind: 'equipment', equipmentType: type,
    generatedLevel: generated.itemLevel, iconRecords: [type === 'wand' ? 78 : 72],
    name: generated.name, nativeEffects: generated.effects, nativeSelector: 0,
    nativeSubtype: null, nativeTypeId: type === 'wand' ? 7011 : 7004,
    quantity: 1, rarity: null, recipeIndex: null,
  }
})
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
      ...economy, backpack: weapons, gold: 30_000, collegeIntroPending: false, tutorialPending: false,
      ownedPerkSelectors: ownedPerks, tonicPurchases: 2, charmCapacity: 9,
      equipment: { ...economy.equipment, rings: [ring, null, null] },
      nextItemId: 50_000,
    }),
  },
})
const liveOrigin = process.env.SDR_INVENTORY_STATS_LIVE_URL
  ? new URL(process.env.SDR_INVENTORY_STATS_LIVE_URL).origin : null
const server = liveOrigin ? { origin: liveOrigin, close: async () => {} } : await startClientServer()
const credential = 'inventory-stats-browser-acceptance'
const host = await startGameHost({
  allowedOrigins: [server.origin], authentication: { kind: 'shared', credential }, snapshotRate: 20,
  createBoneyardSeedBytes: () => Buffer.alloc(16),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage(mobile
  ? { viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1600, height: 900 } })
const touchSession = mobile ? await page.context().newCDPSession(page) : null
page.setDefaultTimeout(15_000)
const errors = { console: [], page: [], responses: [] }
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('pageerror', error => errors.page.push(error.message))
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
await page.addInitScript(({ credential: gameCredential, url }) => {
  window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', credential: gameCredential, url } }
}, { credential, url: host.address.url })
try {
  await page.route('**/__inventory_seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Inventory fixture</title>' }))
  if (!liveOrigin) await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await page.goto(`${server.origin}/__inventory_seed`)
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
  await inventory.getByRole('button', { name: 'Scroll player stats', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await waitForStatsOffset(320)
  await inventory.getByRole('button', { name: 'Open skills', exact: true }).click()
  const skills = page.getByRole('dialog', { name: 'Skills', exact: true })
  await skills.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor()
  await skills.getByRole('button', { name: 'Open inventory', exact: true }).click()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  await waitForStatsOffset(0)
  receipts.push({ scene: 'hub', replacement: 'inventory-skills-inventory', reopenedOffset: 0 })
  await closeInventory(inventory)
  for (const [trader, title] of [
    ['Fomentius', "FOMENTIUS' USEFUL THYNGS"],
    ['Luthacus', "LUTHACUS' SCAVENGED GOODS"],
    ['Shlorio', "SHLORIO'S DISCOUNT DOWSING"],
  ]) {
    await page.getByRole('button', { name: `Open ${trader} interaction`, exact: true }).click()
    const service = page.getByRole('dialog', { name: title, exact: true })
    await exerciseInventory(service, trader.toLowerCase())
    if (trader === 'Shlorio') {
      const dowse = service.getByRole('button', { name: /^DOWSE/ })
      if (mobile) await dowse.tap(); else await dowse.click()
      await dowse.waitFor({ state: 'detached' })
      assert.equal(getPlayerEconomy(host.state(), host.hostPlayerId()).dowsingRolled, true)
      await exerciseStatsScroll(service, 'shlorio-result')
    }
    await service.getByRole('button', { name: 'Done', exact: true }).click()
    await service.waitFor({ state: 'hidden' })
    await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()
  }
  await page.getByRole('button', { name: 'Open Hagatha interaction', exact: true }).click()
  const hagatha = page.getByRole('dialog', { name: "HAGATHA'S CHARMS AND CURSES", exact: true })
  await hagatha.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  assert.equal(await hagatha.getByRole('button', { name: 'Scroll player stats', exact: true }).count(), 0)
  assert.equal(await hagatha.locator('.hub-inventory-native-canvas').getAttribute('data-native-stats-offset-y'), null)
  await hagatha.getByRole('button', { name: 'Done', exact: true }).click()
  await hagatha.waitFor({ state: 'hidden' })
  receipts.push({ scene: 'hagatha', fixedPane: true })
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: /Open inventory/ }).click()
  await exerciseInventory(inventory, 'boneyard')
  await closeInventory(inventory)
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
  console.log(JSON.stringify({ receipts, errors, screenshotRoot, status: 'ok', mobile, browser: browser.version(),
    clientOrigin: server.origin, gameHost: 'isolated local fixture' }))
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
  await exerciseStatsScroll(inventory, scene)
  await waitForRecovery(canvas, 11)
  const equippedRing = inventory.locator(`[data-inventory-owner="equipment"][data-inventory-item-id="${ringId}"]`)
  const backpackRing = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ringId}"]`)
  for (const gesture of ['double-activation', 'drag']) {
    await equippedRing.waitFor()
    const equippedPixels = await captureRecovery(canvas, scene, `${scene}-${gesture}-equipped`)
    if (gesture === 'double-activation') await doubleActivate(equippedRing)
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
  for (const weapon of weapons) {
    const backpackWeapon = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${weapon.id}"]`)
    const equippedWeapon = inventory.locator(`[data-inventory-owner="equipment"][data-inventory-item-id="${weapon.id}"]`).first()
    await waitForMelee(canvas, 0.5, 1)
    const before = await captureRecovery(canvas, scene, `${scene}-${weapon.equipmentType}-before`, true)
    if (mobile) await backpackWeapon.tap(); else await backpackWeapon.click()
    await backpackWeapon.locator('xpath=self::*[@data-selected="true"]').waitFor()
    await inventory.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]').waitFor()
    await canvas.screenshot({ path: join(screenshotRoot, `${scene}-${weapon.equipmentType}-item-info.png`) })
    await doubleActivate(backpackWeapon)
    await equippedWeapon.waitFor()
    await waitForMelee(canvas, 5.5, 6)
    const equipped = await captureRecovery(canvas, scene, `${scene}-${weapon.equipmentType}-equipped`, true)
    assert.notEqual(equipped, before, `${scene}: the rendered melee range must change`)
    const id = host.hostPlayerId()
    const stats = createGameSnapshot(host.state(), id).players[id].progression.inventoryStats
    assert.equal(stats.meleeDamageMinimum, 5.5)
    assert.equal(stats.meleeDamageMaximum, 6)
    await doubleActivate(equippedWeapon)
    await backpackWeapon.waitFor()
    await waitForMelee(canvas, 0.5, 1)
    receipts.push({ scene, weapon: weapon.name, equippedMelee: [5.5, 6], removedMelee: [0.5, 1] })
    console.log(`${scene}: ${weapon.name} displayed, equipped and removed`)
  }
}

async function exerciseStatsScroll(inventory, scene) {
  const canvas = inventory.locator('.hub-inventory-native-canvas')
  const swipe = inventory.getByRole('button', { name: 'Scroll player stats', exact: true })
  const selector = '.hub-inventory-native-canvas'
  const readOffset = async () => Number(await canvas.getAttribute('data-native-stats-offset-y'))
  for (const [from, to, gesture] of [[0, 1, 'wheel'], [1, 2, 'keyboard'], [2, 1, 'held-drag'], [1, 0, 'arrow']]) {
    assert.equal(await readOffset(), from * 320, `${scene}: start at settled page ${from}`)
    if (gesture === 'wheel') await swipe.hover()
    else if (gesture === 'keyboard') await swipe.focus()
    else if (gesture === 'arrow') await inventory.getByRole('button', { name: 'Previous player stats page', exact: true }).click({ trial: true })
    const measurement = page.evaluate(({ selector, origin, target }) => new Promise(resolve => {
      const samples = []
      const start = performance.now()
      let changedAt = null
      function sample(now) {
        const canvas = document.querySelector(selector)
        const offset = Number(canvas?.getAttribute('data-native-stats-offset-y'))
        const semanticOffset = Number(document.querySelector('[aria-label="Player Stats Pages"]')?.getAttribute('data-native-stats-offset'))
        samples.push({ elapsedMs: now - start, offset, semanticOffset })
        if (offset !== origin && changedAt === null) changedAt = now
        if (changedAt !== null && offset === target) resolve({ completed: true, samples, durationMs: now - changedAt })
        else if (now - start > 3_000) resolve({ completed: false, samples, durationMs: null })
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    }), { selector, origin: from * 320, target: to * 320 })
    if (gesture === 'wheel') {
      await page.mouse.wheel(0, 120)
    } else if (gesture === 'keyboard') {
      await page.keyboard.press('ArrowDown')
    } else if (gesture === 'held-drag') {
      const bounds = await swipe.boundingBox()
      assert.ok(bounds)
      const point = { x: bounds.x + bounds.width * 0.98, y: bounds.y + bounds.height / 2 }
      if (touchSession) {
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] })
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + bounds.height * 0.06, id: 1 }] })
      } else {
        await page.mouse.move(point.x, point.y)
        await page.mouse.down()
        await page.mouse.move(point.x, point.y + bounds.height * 0.06)
      }
      await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('data-native-stats-page') === '1', '[aria-label="Player Stats Pages"]')
      if (touchSession) {
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + bounds.height * 0.15, id: 1 }] })
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      } else {
        await page.mouse.move(point.x, point.y + bounds.height * 0.15)
        await page.mouse.up()
      }
      assert.equal(await inventory.locator('[aria-label="Player Stats Pages"]').getAttribute('data-native-stats-page'), '1', `${scene}: one held press must advance only one page`)
    } else await inventory.getByRole('button', { name: 'Previous player stats page', exact: true }).click()
    const result = await measurement
    console.log(JSON.stringify({ scene, gesture, from, to, ...result }))
    assert.equal(result.completed, true, `${scene}: ${gesture} must reach its exact target within the original observation bound`)
    assert.ok(result.samples.every(({ offset, semanticOffset }) => offset === semanticOffset), `${scene}: painted content and hit rectangles share their offset`)
    assert.ok(result.samples.some(({ offset }) => offset > Math.min(from, to) * 320 && offset < Math.max(from, to) * 320), `${scene}: visible intermediate offset`)
    assert.ok(result.durationMs >= 280 && result.durationMs <= 500, `${scene}: native recurrence duration ${result.durationMs}`)
    assert.equal(await readOffset(), to * 320)
    const arrows = await inventory.locator('[data-native-stats-arrow]').evaluateAll(nodes => nodes.map(node => ({
      direction: node.dataset.nativeStatsArrow,
      top: Number.parseFloat(node.style.top),
    })))
    assert.deepEqual(arrows, to === 0 ? [{ direction: 'down', top: 361 }]
      : to === 1 ? [{ direction: 'down', top: 361 }, { direction: 'up', top: 101 }]
        : [{ direction: 'up', top: 101 }], `${scene}: all indicator rows follow their page`)
    if (to === 2) {
      await page.waitForFunction(expected => [...document.querySelectorAll('[aria-label="Player Stats Pages"] [data-owned-hagatha-selector]')]
        .map(node => Number(node.dataset.ownedHagathaSelector)).join(',') === expected.join(','), ownedPerks)
      const cells = await inventory.locator('[aria-label="Player Stats Pages"] [data-owned-hagatha-selector]').evaluateAll(nodes => nodes.map(node => [
        Number.parseFloat(node.style.left), Number.parseFloat(node.style.top),
        Number.parseFloat(node.style.width), Number.parseFloat(node.style.height),
      ]))
      const companion = scene !== 'hub' && scene !== 'boneyard'
      assert.deepEqual(cells, ownedPerks.map((_, index) => {
        const [left, top, width, height] = hubOwnedPerkSlotRect(index)
        return [left - (companion ? 0 : 53), top, width, height]
      }), `${scene}: all nine perk hit rectangles match the displayed cells`)
    }
    await canvas.screenshot({ path: join(screenshotRoot, `${scene}-stats-page-${to}.png`) })
    receipts.push({ scene, gesture, from, to, ...result })
  }
}

async function waitForStatsOffset(offset) {
  await page.waitForFunction(expected => Number(document.querySelector('.hub-inventory-native-canvas')?.dataset.nativeStatsOffsetY) === expected, offset)
}

async function captureRecovery(canvas, scene, name, melee = false) {
  const image = await canvas.screenshot({ path: join(screenshotRoot, `${name}.png`) })
  const [left, top, width, height] = melee ? HUB_PRIMARY_SPELL_PANE.meleeBodyRect : HUB_PRIMARY_SPELL_PANE.bodyRect
  const pixels = await page.evaluate(async ({ encoded, rect }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const decoded = document.createElement('canvas')
    decoded.width = image.width
    decoded.height = image.height
    const context = decoded.getContext('2d')
    context.drawImage(image, 0, 0)
    const scaleX = image.width / 1600
    const scaleY = image.height / 900
    return Array.from(context.getImageData(
      Math.round(rect[0] * scaleX), Math.round(rect[1] * scaleY),
      Math.round(rect[2] * scaleX), Math.round(rect[3] * scaleY),
    ).data)
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
  if (touchSession) {
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    for (let step = 1; step <= 12; step += 1) {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: start.x + (point.x - start.x) * step / 12,
        y: start.y + (point.y - start.y) * step / 12,
      }] })
    }
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    return
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(point.x, point.y, { steps: 12 })
  await page.mouse.up()
}

async function doubleActivate(target) {
  if (!mobile) return target.dblclick()
  const box = await target.boundingBox()
  assert.ok(box)
  // Match the Dowsing journey: separate Playwright tap round trips can miss
  // the native 500-ms window while the first selection is being rendered.
  const acknowledgements = []
  for (const type of ['touchStart', 'touchEnd', 'touchStart', 'touchEnd']) {
    acknowledgements.push(touchSession.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{
        x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1,
      }],
    }))
  }
  await Promise.all(acknowledgements)
}

async function waitForMelee(canvas, minimum, maximum) {
  const expected = { text: `${minimum.toFixed(1)} - ${maximum.toFixed(1)}`, unit: ' / whack' }
  await page.waitForFunction(expected => {
    const value = document.querySelector('.hub-inventory-native-canvas[data-native-reveal="settled"]')?.dataset.nativeMeleeDamageLine
    return value === JSON.stringify(expected)
  }, expected)
  assert.deepEqual(JSON.parse(await canvas.getAttribute('data-native-melee-damage-line')), expected)
}

async function startClientServer() {
  if (process.env.SDR_INVENTORY_STATS_DEV !== '1') return startStaticClientServer({
    root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
  })
  const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 } })
  await vite.listen()
  return { origin: `http://127.0.0.1:${vite.httpServer.address().port}`, close: () => vite.close() }
}

async function closeInventory(inventory) {
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await inventory.waitFor({ state: 'hidden' })
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
}

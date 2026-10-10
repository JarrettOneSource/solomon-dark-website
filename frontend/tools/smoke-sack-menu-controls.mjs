import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  DOWSING_EQUIPMENT_RECIPES, FOMENTIUS_STOCK_DEFINITIONS, NATIVE_SKILL_BOOK_DEFINITIONS,
  createEquipmentInventoryItem, createFomentiusInventoryItem, createNativeSkillBookInventoryItem,
  findInventoryItem,
} from '../src/game/core-kernels/hub-economy.ts'
import { getPlayerBelt, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { GameWelcomeReceiver } from '../src/game/protocol/game-welcome-transfer.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { enterElementHub, enterBoneyard, startElementHub, waitUntil } from './game-smoke-navigation.mjs'
import { observeGoldPlacementWire } from './smoke-loot-gold-placement.mjs'

const output = process.env.SDR_SACK_MENU_OUTPUT
assert.ok(output, 'Set SDR_SACK_MENU_OUTPUT to the task-owned evidence directory')
const headless = process.env.SDR_SACK_MENU_HEADLESS ?? '0'
assert.ok(['0', '1'].includes(headless), 'SDR_SACK_MENU_HEADLESS must be 0 (headed) or 1')
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: headless === '1', args: ['--autoplay-policy=no-user-gesture-required'],
})
const journeys = []
try {
  for (const scenario of [
    { name: 'desktop-rebound', width: 1600, height: 900, touch: false, inventory: 'b', skills: 'v', menu: 'm' },
    { name: 'touch-landscape', width: 844, height: 390, touch: true, inventory: 'i', skills: 'c', menu: 'Escape' },
    { name: 'touch-portrait', width: 390, height: 844, touch: true, inventory: 'b', skills: 'v', menu: 'm', portrait: true },
  ]) journeys.push(await journey(scenario))
  await writeFile(`${output}/receipt.json`, JSON.stringify({ status: 'ok', browser: browser.version(), headed: headless === '0', journeys }, null, 2))
} finally {
  await browser.close()
  await server.close()
}

async function journey(scenario) {
  const errors = { host: [], page: [], console: [], responses: [], requests: [], wire: [], teardown: [] }
  const rawRequestFailures = []
  let lifecyclePhase = 'startup'
  let intentionalOperation = null
  const credential = randomBytes(32).toString('base64url')
  const host = await startGameHost({
    allowedOrigins: [server.origin], authentication: { kind: 'shared', credential },
    sessionKind: 'standalone', snapshotRate: 20, createBoneyardSeedBytes: () => Buffer.alloc(16),
    log: event => { if (event.level === 'error') errors.host.push({ event: event.event, message: event.message }) },
  })
  const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height },
    hasTouch: scenario.touch, isMobile: scenario.touch, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const wire = observeGoldPlacementWire(page, host.address.url)
  const sentActions = []
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => {
    const error = request.failure()?.errorText
    const url = new URL(request.url()), method = request.method(), resourceType = request.resourceType()
    const lifecycleAbort = lifecyclePhase === 'navigation/reload' || lifecyclePhase === 'closing context'
    const expectedAbort = error === 'net::ERR_ABORTED' && method === 'GET'
      && url.origin === server.origin && lifecycleAbort && intentionalOperation !== null
      && (url.pathname === '/deployment.json'
        || (['media', 'fetch', 'xhr'].includes(resourceType) && /\.(?:mp3|ogg|wav)$/.test(url.pathname)))
    rawRequestFailures.push({ url: request.url(), error, method, resourceType,
      navigationRequest: request.isNavigationRequest(), lifecyclePhase, intentionalOperation,
      pageUrl: page.url(), viewport: page.viewportSize(), scenario: scenario.name,
      expectedAbort, at: new Date().toISOString() })
    if (!expectedAbort) errors.requests.push(`${request.url()}: ${error}`)
  })
  page.on('websocket', socket => {
    socket.on('socketerror', error => errors.wire.push(String(error)))
    const receiver = new GameWelcomeReceiver()
    socket.on('close', () => receiver.close())
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = receiver.receivePayload(String(payload), () => {})
        if (message?.type === 'server-error') errors.wire.push(message.message)
      } catch (error) { errors.wire.push(error.message) }
    })
    socket.on('framesent', ({ payload }) => {
      const message = JSON.parse(String(payload))
      if (message.type === 'client-hub-action') sentActions.push(message.action)
    })
  })
  const code = key => key === 'Escape' ? key : `Key${key.toUpperCase()}`
  await page.addInitScript(({ endpoint, settingsKey, controls }) => {
    window.solomonDarkRuntime = { gameEndpoint: endpoint }
    localStorage.setItem(settingsKey, JSON.stringify(controls))
    window.__sackPageTimings = []
    let active = null
    new MutationObserver(() => {
      const stage = document.querySelector('.hub-native-ui-stage[data-native-sack-transition]')
      const phase = stage?.dataset.nativeSackTransition
      if (phase && !active) active = { phase, path: stage.dataset.nativeSackPath, at: performance.now() }
      else if (active && phase === '') {
        window.__sackPageTimings.push({ phase: active.phase, path: active.path, milliseconds: performance.now() - active.at })
        active = null
      } else if (!stage) active = null
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-native-sack-transition'] })
  }, {
    endpoint: { credential, kind: 'localhost', url: host.address.url }, settingsKey: GAME_SETTINGS_STORAGE_KEY,
    controls: { ...DEFAULT_GAME_SETTINGS, controls: { ...DEFAULT_GAME_SETTINGS.controls,
      openInventory: code(scenario.inventory), openSkills: code(scenario.skills), openMenu: code(scenario.menu) } },
  })
  await page.route('**/deployment.json*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  const receipt = { scenario: scenario.name, errors, rawRequestFailures, scenes: [], services: [], renameTargets: [] }
  let failure = null
  try {
    lifecyclePhase = 'navigation/reload'
    intentionalOperation = 'Navigate from a new page through character creation into the College'
    if (scenario.portrait) {
      await page.goto(`${server.origin}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
      const rotate = page.getByRole('status').filter({ hasText: 'Rotate your device to landscape' })
      await rotate.waitFor({ timeout: 90_000 })
      assert.equal(await page.locator('.main-menu-stage').evaluate(node => getComputedStyle(node).visibility), 'hidden')
      await page.screenshot({ path: `${output}/${scenario.name}-rotate-gate.png` })
      receipt.orientation = 'Portrait rotate gate preserved; gameplay continues only after landscape rotation'
      scenario = { ...scenario, width: 844, height: 390 }
      await page.setViewportSize({ width: scenario.width, height: scenario.height })
      await rotate.waitFor({ state: 'hidden' })
      await startElementHub(page, 'Fire')
    } else await enterElementHub(page, server.origin, 'Fire')
    lifecyclePhase = 'active journey'
    intentionalOperation = null
    const playerId = host.hostPlayerId()
    assert.ok(playerId)
    const priorRevision = getPlayerEconomy(host.state(), playerId).revision
    const ids = grantFixture(host, playerId)
    const fixture = getPlayerEconomy(host.state(), playerId)
    assert.equal(fixture.revision, priorRevision + 1, 'Fixture must advance the ordinary economy projection revision')
    await waitUntil(() => {
      assert.deepEqual(wire.errors, [])
      const economy = wire.snapshot?.players[playerId]?.economy
      return economy?.revision === fixture.revision && economy.gold === fixture.gold
        && findInventoryItem(economy.backpack, ids.outer) !== null
    }, 'Sack fixture did not reach owner before Inventory pause', 10000)
    assert.deepEqual(wire.snapshot.players[playerId].economy.backpack, fixture.backpack)
    const inventoryHud = page.getByRole('button', { name: `Open inventory, ${fixture.gold} gold`, exact: true })
    await inventoryHud.waitFor({ timeout: 10000 })
    receipt.fixtureAlignment = { liveRevision: fixture.revision,
      wireRevision: wire.snapshot.players[playerId].economy.revision,
      gold: fixture.gold, hudLabel: await inventoryHud.getAttribute('aria-label') }
    const original = findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner)
    const originalBelt = getPlayerBelt(host.state(), playerId)
    let inventory = await openInventory(page, scenario)
    await inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ids.outer}"]`).waitFor()
    await openSack(page, inventory, ids.outer, [ids.outer], scenario)
    await openSack(page, inventory, ids.inner, [ids.outer, ids.inner], scenario)
    await activate(inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ids.robe}"]`), scenario)
    assert.equal(await inventory.locator('[data-inventory-rename-open]').count(), 0,
      'A selected non-Sack must not fall back to renaming its open parent')
    await clearInventorySelection(inventory)
    assert.equal(await inventory.locator('[data-inventory-rename-open]').getAttribute('data-inventory-rename-open'), String(ids.inner))
    receipt.renameButton = await proveRenameButtonGeometry(inventory)
    const beforeCancel = sentActions.length
    const dialogScroll = await dialogScrollState(inventory)
    await activate(inventory.locator('[data-inventory-rename-open]'), scenario)
    let dialog = page.getByRole('dialog', { name: 'Rename Sack', exact: true })
    const nameField = dialog.getByRole('textbox', { name: 'Sack name' })
    receipt.dialogGeometry = [await proveDialogGeometry(dialog, nameField, scenario, dialogScroll)]
    await nameField.fill('discard this name')
    await activate(dialog.getByRole('button', { name: 'CANCEL', exact: true }), scenario)
    await dialog.waitFor({ state: 'hidden' })
    assert.deepEqual(await dialogScrollState(inventory), dialogScroll, 'Restoring rename focus scrolled an ancestor')
    assert.equal(sentActions.length, beforeCancel, 'Cancel transmitted an action')
    assert.deepEqual(findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner), original)

    await activate(inventory.locator('[data-inventory-rename-open]'), scenario)
    await nameField.fill('   ')
    receipt.dialogGeometry.push(await proveDialogGeometry(dialog, nameField, scenario, dialogScroll))
    assert.equal(await dialog.getByRole('button', { name: 'SAVE', exact: true }).isDisabled(), true)
    await page.keyboard.press('Enter')
    assert.equal(sentActions.length, beforeCancel, 'Blank name was submitted')
    await nameField.fill('')
    await nameField.pressSequentially('x'.repeat(40))
    assert.equal((await nameField.inputValue()).length, 32)
    await nameField.fill('')
    // Real key events must not open Skills, navigate, or activate belt slots.
    const typed = `${scenario.inventory}${scenario.skills}${scenario.menu === 'Escape' ? 'm' : scenario.menu}123 supplies`
    await nameField.pressSequentially(typed)
    assert.equal(await nameField.inputValue(), typed, 'A capture-phase shortcut swallowed text entry')
    assert.equal(sentActions.length, beforeCancel, 'Typing transmitted an inventory or belt action')
    assert.equal(await page.locator('.skill-book-stage').count(), 0)
    assert.equal(await inventory.getAttribute('data-native-sack-path'), `${ids.outer}/${ids.inner}`)
    assert.deepEqual(getPlayerBelt(host.state(), playerId), originalBelt)
    await nameField.fill('火の袋')
    await nameField.press('Shift+Tab')
    assert.equal(await dialog.getByRole('button', { name: 'CANCEL', exact: true }).evaluate(node => node === document.activeElement), true)
    await page.keyboard.press('Tab')
    assert.equal(await nameField.evaluate(node => node === document.activeElement), true)
    receipt.dialogGeometry.push(await proveDialogGeometry(dialog, nameField, scenario, dialogScroll))
    await page.screenshot({ path: `${output}/${scenario.name}-rename-dialog.png` })
    await activate(dialog.getByRole('button', { name: 'SAVE', exact: true }), scenario)
    await dialog.waitFor({ state: 'hidden' })
    await waitUntil(() => findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner)?.name === '火の袋', 'Rename did not reach authority', 10000)
    assert.deepEqual(findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner), { ...original, name: '火の袋' })
    await page.waitForFunction(name => {
      const data = document.querySelector('.hub-inventory-native-canvas')?.dataset
      return data?.nativeSackCaption === name && data.nativeSackCaptionFont === 'browser'
        && data.nativeSackCaptionVisible === 'true'
    }, '火の袋')
    await page.screenshot({ path: `${output}/${scenario.name}-unicode-caption.png` })
    receipt.renameTargets.push({ id: ids.inner, name: '火の袋', owner: 'nested backpack', font: 'browser' })

    await activate(inventory.locator('[data-inventory-rename-open]'), scenario)
    await nameField.fill('Escape cancels editing')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner)?.name, '火の袋')
    await page.keyboard.down(scenario.inventory)
    await page.keyboard.down(scenario.inventory)
    await settlePath(inventory, String(ids.outer))
    await page.keyboard.down(scenario.inventory)
    assert.equal(await inventory.getAttribute('data-native-sack-path'), String(ids.outer))
    await page.keyboard.up(scenario.inventory)
    await activate(inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ids.inner}"]`), scenario)
    await page.waitForFunction(() => {
      const data = document.querySelector('.hub-inventory-native-canvas')?.dataset
      return data?.nativeItemInfo === 'visible' && Number(data.sackNameBrowserFallbacks) > 0
        && data.nativeSackCaptionFont === 'stock'
    })
    await page.screenshot({ path: `${output}/${scenario.name}-unicode-item-title.png` })
    await clearInventorySelection(inventory)
    // Parent-cell first-press and release must still perform one 370 ms traversal.
    await activate(inventory.locator('[data-inventory-parent-holder="true"]'), scenario)
    await settlePath(inventory, '')
    await page.keyboard.press(scenario.inventory)
    await inventory.waitFor({ state: 'hidden' })
    await ready(page)
    const document = await savedDocument(page, ids.inner, '火の袋')
    const restored = restoreGameSaveDocument(document)
    assert.equal(findInventoryItem(getPlayerEconomy(restored.state, restored.playerId).backpack, ids.inner)?.name, '火の袋')
    receipt.persisted = true
    if (!scenario.portrait) {
      await serviceJourney(page, host, playerId, ids, scenario, receipt)
      await dyeJourney(page, host, playerId, ids, scenario)
      lifecyclePhase = 'navigation/reload'
      intentionalOperation = 'Enter the Boneyard from the College'
      await enterBoneyard(page)
      await ready(page)
      lifecyclePhase = 'active journey'
      intentionalOperation = null
      await waitUntil(() => findInventoryItem(wire.snapshot?.players[playerId]?.economy?.backpack ?? [], ids.inner) !== null,
        'Boneyard inventory did not replicate', 10000)
      inventory = await openInventory(page, scenario)
      await openSack(page, inventory, ids.outer, [ids.outer], scenario)
      await openSack(page, inventory, ids.inner, [ids.outer, ids.inner], scenario)
      const tick = host.state().tick
      await page.waitForTimeout(450)
      assert.equal(host.state().tick, tick, 'Inventory did not hold the Boneyard tick')
      await rename(page, inventory, 'Run supplies', scenario)
      assert.equal(findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner)?.name, 'Run supplies')
      // Menu closes all nested bags. A held repeat must not open Pause afterward.
      await page.keyboard.down(scenario.menu)
      await inventory.waitFor({ state: 'hidden' })
      await page.keyboard.down(scenario.menu)
      await page.keyboard.up(scenario.menu)
      await ready(page)
      await waitUntil(() => host.state().tick > tick, 'Boneyard did not resume after Menu', 10000)
      inventory = await openInventory(page, scenario)
      assert.equal(await inventory.getAttribute('data-native-sack-path'), '')
      await doubleActivate(inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ids.outer}"]`), scenario)
      await inventory.locator('xpath=self::*[@data-native-sack-transition="open"]').waitFor()
      await page.keyboard.press('Escape')
      await inventory.waitFor({ state: 'hidden' })
      await ready(page)
      await page.keyboard.press(scenario.skills)
      const skills = page.locator('.skill-book-stage[data-transition-phase="settled"]')
      await skills.waitFor({ timeout: 10000 })
      await page.keyboard.press(scenario.menu)
      await skills.waitFor({ state: 'hidden' })
      await ready(page)
      await page.keyboard.press(scenario.skills)
      await skills.waitFor()
      await page.keyboard.press('Escape')
      await skills.waitFor({ state: 'hidden' })
      await ready(page)
      inventory = await openInventory(page, scenario)
      await doubleActivate(inventory.locator(`[data-inventory-item-id="${ids.book}"]`).first(), scenario)
      const picker = page.getByRole('dialog', { name: /Select a skill/ })
      await picker.locator('.skill-picker-stage[data-reveal-interactive="true"]').waitFor({ timeout: 15000 })
      for (const key of ['Escape', scenario.menu, scenario.inventory, scenario.skills]) {
        await page.keyboard.press(key)
        assert.equal(await picker.isVisible(), true, `${key} dismissed a mandatory choice`)
      }
      await page.screenshot({ path: `${output}/${scenario.name}-mandatory-picker.png` })
      await activate(picker.locator('.skill-picker-action').first(), scenario)
      await picker.waitFor({ state: 'hidden' })
      await ready(page)
      receipt.scenes.push('Boneyard nested rename, pause/resume, optional Skills, mandatory choice')
    }
    receipt.scenes.push('College nested inventory and save restoration')
    receipt.timings = await page.evaluate(() => window.__sackPageTimings)
    assert.ok(receipt.timings.length >= 4)
    for (const timing of receipt.timings) assert.ok(timing.milliseconds >= 340 && timing.milliseconds <= 750,
      `Sack transition escaped the existing 370 ms model: ${JSON.stringify(timing)}`)
    errors.wire.push(...wire.errors)
    for (const [kind, entries] of Object.entries(errors)) assert.deepEqual(entries, [], kind)
    await page.screenshot({ path: `${output}/${scenario.name}-complete.png` })
  } catch (error) {
    failure = error
    await page.screenshot({ path: `${output}/${scenario.name}-failure.png` }).catch(() => {})
  } finally {
    lifecyclePhase = 'closing context'
    intentionalOperation = 'Close this journey’s owned browser context and standalone host'
    await context.close().catch(error => { errors.teardown.push({ resource: 'browser context', error: error.stack }); failure ??= error })
    await host.close().catch(error => { errors.teardown.push({ resource: 'standalone host', error: error.stack }); failure ??= error })
  }
  if (failure === null) {
    try {
      for (const [kind, entries] of Object.entries(errors)) assert.deepEqual(entries, [], kind)
    } catch (error) { failure = error }
  }
  await writeFile(`${output}/${scenario.name}${failure ? '-failure' : ''}.json`,
    JSON.stringify({ ...receipt, ...(failure ? { error: failure.stack, wireErrors: wire.errors } : {}) }, null, 2))
  if (failure) throw failure
  return receipt
}

function grantFixture(host, playerId) {
  const state = host.state(), economy = getPlayerEconomy(state, playerId)
  const ids = { outer: 104_101, inner: 104_102, kit: 104_103, robe: 104_104, storage: 104_105, storedInner: 104_106, book: 104_107 }
  const kit = createFomentiusInventoryItem(FOMENTIUS_STOCK_DEFINITIONS.find(row => row.kind === 'dye'), ids.kit)
  const robe = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES.find(row => row.type === 'robe'), ids.robe)
  const book = createNativeSkillBookInventoryItem(NATIVE_SKILL_BOOK_DEFINITIONS.find(row => row.nativeSubtype === 2), ids.book)
  const sack = (id, name, contents, inventorySlot = 0) => ({ id, name, contents, inventorySlot,
    kind: 'sack', nativeTypeId: 7008, nativeSubtype: 0, equipmentType: null,
    iconRecords: [70], quantity: 1, rarity: null, recipeIndex: null })
  const inner = sack(ids.inner, "Sackwright's Supplies", [{ ...kit, inventorySlot: 0 }, { ...robe, inventorySlot: 1 }])
  const outer = sack(ids.outer, "Sackwright's Possessions", [inner])
  Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
    ...economy, backpack: [outer, { ...book, inventorySlot: 1 }],
    storage: [sack(ids.storage, "Sackwright's Keepsakes", [sack(ids.storedInner, 'Nested keepsakes', [])])],
    gold: 500_000, nextItemId: 104_108, revision: economy.revision + 1,
  }) })
  return ids
}

async function serviceJourney(page, host, playerId, ids, scenario, receipt) {
  for (const trader of ['fomentius', 'hagatha', 'luthacus', 'shlorio']) {
    await activate(page.locator(`[data-hub-shortcut="${trader}"]`), scenario)
    const inventory = page.locator('.hub-native-ui-overlay[data-surface-kind="service"] .hub-native-ui-stage')
    await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
    if (trader === 'luthacus') {
      await activate(inventory.locator(`[data-inventory-owner="storage"][data-inventory-item-id="${ids.storage}"]`), scenario)
      await rename(page, inventory, '保存袋', scenario)
      assert.equal(findInventoryItem(getPlayerEconomy(host.state(), playerId).storage, ids.storage)?.name, '保存袋')
      await inventory.locator(`[data-inventory-owner="storage"][data-inventory-item-id="${ids.storage}"]`).focus()
      await page.waitForFunction(() => Number(document.querySelector('.hub-inventory-native-canvas')?.dataset.sackNameBrowserFallbacks) > 0)
      await page.screenshot({ path: `${output}/${scenario.name}-unicode-storage-title.png` })
      receipt.renameTargets.push({ id: ids.storage, owner: 'storage', name: '保存袋', font: 'browser' })
    }
    if (trader === 'hagatha') {
      const purchase = inventory.getByRole('button', { name: /^Buy .* for .* gold$/ }).first()
      await doubleActivate(purchase, scenario)
      await waitUntil(() => getPlayerEconomy(host.state(), playerId).actionFeedback?.action === 'buy-hagatha', 'Hagatha purchase did not settle', 10000)
      assert.equal(getPlayerEconomy(host.state(), playerId).actionFeedback.accepted, true)
    }
    await openSack(page, inventory, ids.outer, [ids.outer], scenario)
    assert.equal(await inventory.locator('[data-inventory-rename-open]').getAttribute('data-inventory-rename-open'), String(ids.outer),
      'A stale opposite-pane selection displaced the current Sack rename target')
    if (trader === 'fomentius') {
      await activate(inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${ids.inner}"]`), scenario)
      assert.equal(await inventory.locator('[data-inventory-rename-open]').getAttribute('data-inventory-rename-open'), String(ids.inner))
      await activate(inventory.getByRole('button', { name: /^Buy .* for .* gold$/ }).first(), scenario)
      assert.equal(await inventory.locator('[data-inventory-rename-open]').count(), 0,
        'An unowned shop selection must not fall back to a stale owned Sack in the companion')
      await clearInventorySelection(inventory)
      await rename(page, inventory, 'Travel gear', scenario)
      assert.equal(findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.outer)?.name, 'Travel gear')
      receipt.renameTargets.push({ id: ids.outer, owner: 'backpack root', name: 'Travel gear' })
    }
    await page.keyboard.press(scenario.inventory)
    await settlePath(inventory, '')
    await openSack(page, inventory, ids.outer, [ids.outer], scenario)
    await page.keyboard.press(scenario.menu)
    await inventory.waitFor({ state: 'hidden' })
    if (trader === 'hagatha') await waitUntil(() => getPlayerEconomy(host.state(), playerId).actionFeedback?.action === 'close-hagatha', 'Hagatha close cleanup was omitted', 10000)
    await ready(page)
    if (trader === 'shlorio') {
      await activate(page.locator('[data-hub-shortcut="shlorio"]'), scenario)
      await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
      await activate(inventory.getByRole('button', { name: /^DOWSE / }), scenario)
      await waitUntil(() => getPlayerEconomy(host.state(), playerId).dowsingRolled, 'Dowsing did not roll', 10000)
      await openSack(page, inventory, ids.outer, [ids.outer], scenario)
      await page.keyboard.press('Escape')
      await inventory.waitFor({ state: 'hidden' })
      await waitUntil(() => !getPlayerEconomy(host.state(), playerId).dowsingRolled, 'Dowsing close cleanup was omitted', 10000)
      await ready(page)
    }
    receipt.services.push(trader)
  }
}

async function dyeJourney(page, host, playerId, ids, scenario) {
  const inventory = await openInventory(page, scenario)
  await openSack(page, inventory, ids.outer, [ids.outer], scenario)
  await openSack(page, inventory, ids.inner, [ids.outer, ids.inner], scenario)
  const before = findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner)
  await doubleActivate(inventory.locator(`[data-inventory-item-id="${ids.kit}"]`).first(), scenario)
  const dye = inventory.locator('[data-native-dye-phase]')
  await dye.waitFor({ state: 'attached' })
  await activate(inventory.locator('[data-native-dye-swatch="1"]'), scenario)
  await activate(inventory.locator(`[data-native-dye-target="${ids.robe}"]`), scenario)
  await dye.locator('xpath=self::*[@data-native-dye-phase="layer"]').waitFor({ state: 'attached' })
  await page.keyboard.press(scenario.menu)
  await dye.locator('xpath=self::*[@data-native-dye-phase="target"]').waitFor({ state: 'attached' })
  await page.keyboard.press('Escape')
  await dye.waitFor({ state: 'detached' })
  assert.equal(await inventory.isVisible(), true)
  assert.deepEqual(findInventoryItem(getPlayerEconomy(host.state(), playerId).backpack, ids.inner), before)
  await page.keyboard.press(scenario.menu)
  await inventory.waitFor({ state: 'hidden' })
  await ready(page)
}

async function rename(page, inventory, name, scenario) {
  await activate(inventory.locator('[data-inventory-rename-open]'), scenario)
  const dialog = page.getByRole('dialog', { name: 'Rename Sack', exact: true })
  await dialog.getByRole('textbox', { name: 'Sack name' }).fill(name)
  await activate(dialog.getByRole('button', { name: 'SAVE', exact: true }), scenario)
  await dialog.waitFor({ state: 'hidden' })
}
async function clearInventorySelection(inventory) {
  const clear = inventory.getByRole('button', { name: 'Deselect inventory item', exact: true })
  await clear.focus()
  await clear.press('Enter')
}
async function proveRenameButtonGeometry(inventory) {
  const geometry = await inventory.locator('[data-inventory-rename-open]').evaluate(button => {
    const rect = element => {
      const box = element.getBoundingClientRect()
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, height: box.height }
    }
    return { body: rect(button),
      leftChrome: rect(button.querySelector('[data-native-ui-node="native-button:end-left"]')),
      rightChrome: rect(button.querySelector('[data-native-ui-node="native-button:end-right"]')),
      glyphs: [...button.querySelectorAll('[data-native-ui-node="native-button:label"] [data-native-ui-glyph]')].map(rect),
      unsupported: button.querySelector('[data-native-ui-node="native-button:label"]').dataset.nativeUiUnsupported ?? '',
    }
  })
  assert.equal(geometry.unsupported, '')
  assert.equal(geometry.glyphs.length, 'RENAMESACK'.length)
  for (const glyph of geometry.glyphs) {
    assert.ok(glyph.left >= geometry.leftChrome.right - 1 && glyph.right <= geometry.rightChrome.left + 1,
      `Rename glyph overlaps the native end caps: ${JSON.stringify(geometry)}`)
    assert.ok(glyph.top >= geometry.body.top && glyph.bottom <= geometry.body.bottom,
      'Rename glyph escaped the button body')
  }
  assert.ok(Math.abs(geometry.leftChrome.height - geometry.body.height * 85 / 69) < 1,
    'Rename chrome must use the supported native scale for the compact button height')
  const parent = await inventory.locator('[data-inventory-parent-holder="true"]').boundingBox()
  assert.ok(parent && geometry.leftChrome.bottom <= parent.y + 1, 'Rename chrome overlaps the Sack grid')
  return geometry
}
async function openInventory(page, scenario) {
  await activate(page.getByRole('button', { name: /Open inventory/ }), scenario)
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor({ timeout: 10000 })
  return inventory
}
async function openSack(page, inventory, id, path, scenario) {
  await doubleActivate(inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${id}"]`), scenario)
  await settlePath(inventory, path.join('/'))
}
async function settlePath(inventory, path) {
  await inventory.locator(`xpath=self::*[@data-native-sack-path="${path}"]`).waitFor()
  await inventory.locator('xpath=self::*[@data-native-sack-transition=""]').waitFor()
}
async function ready(page) {
  await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 15000 })
  await page.locator('.hub-native-ui-overlay, .skill-book-stage, .skill-picker-stage').waitFor({ state: 'hidden' })
}
async function activate(locator, scenario) { if (scenario.touch) await locator.tap(); else await locator.click() }
async function doubleActivate(locator, scenario) {
  await activate(locator, scenario)
  await locator.page().waitForTimeout(60)
  await activate(locator, scenario)
}
async function dialogScrollState(locator) {
  return locator.evaluate(element => {
    const ancestors = []
    for (let node = element.closest('.hub-native-ui-overlay'); node && ancestors.length < 12; node = node.parentElement) {
      ancestors.push({ tag: node.tagName, id: node.id, className: String(node.className).slice(0, 160),
        scrollLeft: node.scrollLeft, scrollTop: node.scrollTop })
    }
    return { windowX: window.scrollX, windowY: window.scrollY, ancestors }
  })
}
async function proveDialogGeometry(dialog, field, scenario, expectedScroll) {
  await dialog.waitFor()
  assert.ok(Number.parseFloat(await field.evaluate(node => getComputedStyle(node).fontSize)) >= 16)
  const scroll = await dialogScrollState(dialog)
  assert.deepEqual(scroll, expectedScroll, 'Rename focus or Tab traversal scrolled an overflow ancestor')
  const art = await dialog.evaluate(root => {
    // Direct plan nodes include unlabelled footer arrows, without treating clipped atlas internals as visible art.
    const nodes = [...root.querySelector('.hub-sack-rename-art').children,
      ...root.querySelectorAll('[data-native-ui-glyph], [data-native-ui-node$=":end-left"], [data-native-ui-node$=":end-right"]')]
    const rects = nodes.map(node => {
      const box = node.getBoundingClientRect()
      return { label: node.dataset.nativeUiNode ?? node.dataset.nativeUiGlyph ?? node.tagName,
        left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
    }).filter(box => box.width > 0 && box.height > 0)
    const outside = rects.filter(box => box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1)
    return { count: rects.length, outside: outside.slice(0, 12), outsideCount: outside.length,
      bounds: { left: Math.min(...rects.map(box => box.left)), top: Math.min(...rects.map(box => box.top)),
        right: Math.max(...rects.map(box => box.right)), bottom: Math.max(...rects.map(box => box.bottom)) } }
  })
  assert.equal(art.outsideCount, 0, `Full native frame or glyphs escape the viewport: ${JSON.stringify(art)}`)
  const controls = []
  for (const target of [field, dialog.getByRole('button', { name: 'SAVE', exact: true }), dialog.getByRole('button', { name: 'CANCEL', exact: true })]) {
    const box = await target.boundingBox()
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= scenario.width + 1
      && box.y + box.height <= scenario.height + 1, JSON.stringify(box))
    assert.ok(box.height >= 40, 'Rename text and action targets must remain usable without stage downscaling')
    controls.push(box)
  }
  const fieldRow = await dialog.locator('.hub-sack-rename-field').boundingBox()
  assert.ok(fieldRow && fieldRow.y + fieldRow.height <= controls[1].y, 'Rename field or validation message overlaps the actions')
  return { art, controls, fieldRow, scroll }
}
async function savedDocument(page, itemId, name) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const record = await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('solomon-dark-game-saves', 1)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const request = open.result.transaction('slots', 'readonly').objectStore('slots').get(0)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => { resolve(request.result); open.result.close() }
      }
    }))
    if (record?.document) {
      const restored = restoreGameSaveDocument(record.document)
      if (findInventoryItem(getPlayerEconomy(restored.state, restored.playerId).backpack, itemId)?.name === name) return record.document
    }
    await page.waitForTimeout(100)
  }
  throw new Error('Renamed Sack did not reach the durable browser save')
}

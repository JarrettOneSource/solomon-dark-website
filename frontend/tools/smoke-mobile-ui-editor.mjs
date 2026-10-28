import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

import { chromium } from 'playwright-core'
import { openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { startGameHost } from '../src/game/host/game-host.ts'
import { getPlayerBelt, getPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { bindPlayerEntityBeltItem, bindPlayerEntitySkillQuickbar, replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { unequipInventorySlot } from '../src/game/core-kernels/hub-economy.ts'
import { nativeSkillCategory, nativeSkillIconRecord } from '../src/game/core-kernels/player-progression.ts'
import { MOBILE_UI_ELEMENT_IDS, MOBILE_UI_GRID_SIZE, MOBILE_UI_LAYOUT_STORAGE_KEY } from '../src/game/mobile-ui-layout.ts'

// Run after the production build. The real editor and HUD use an isolated game host.
const evidence = process.env.SDR_MOBILE_UI_EVIDENCE || '/tmp/solomon-mobile-ui-editor'
await mkdir(evidence, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = randomBytes(32).toString('base64url')
const host = await startGameHost({
  allowedOrigins: [server.origin],
  authentication: { kind: 'shared', credential },
  sessionKind: 'private-college',
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'],
  headless: true,
})
const errors = { page: [], console: [], responses: [], requests: [] }
let currentPage

try {
  const context = await browser.newContext({
    viewport: { width: 896, height: 414 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
  })
  const page = await openGame(context)
  currentPage = page
  await openEditor(page)
  const editor = page.locator('.mobile-ui-editor')
  const dock = editor.locator('.mobile-ui-editor-dock')
  await dock.getByRole('button', { name: /^ADJUST/ }).tap()
  await exerciseGridGuides(page, editor)
  await dock.getByRole('button', { name: 'RESET LAYOUT', exact: true }).tap()
  await dock.getByRole('button', { name: 'SAVE', exact: true }).tap()
  await page.getByRole('button', { name: 'CUSTOMIZE MOBILE UI', exact: true }).tap()
  await editor.waitFor()
  const control = (id) => editor.locator(`[data-mobile-ui-editor-element="${id}"]`)
  const value = (id) => control(id).getAttribute('aria-label')
  const undo = dock.getByRole('button', { name: 'UNDO', exact: true })
  const redo = dock.getByRole('button', { name: 'REDO', exact: true })
  assert.equal(await undo.isDisabled(), true)
  await dock.getByRole('button', { name: /^ADJUST/ }).tap()
  const picker = editor.getByRole('combobox', { name: 'Selected mobile UI element' })
  assert.equal(await picker.locator('option').count(), MOBILE_UI_ELEMENT_IDS.length)
  for (const id of MOBILE_UI_ELEMENT_IDS) {
    await picker.selectOption(id)
    assert.equal(await editor.getAttribute('data-selected-element'), id)
    assert.equal(await control(id).getAttribute('aria-pressed'), 'true')
  }
  assert.equal(await undo.isDisabled(), true, 'selection does not create an edit')
  await picker.selectOption('inventory')
  const original = await value('inventory')
  await editor.getByRole('button', { name: 'Make control larger' }).tap()
  assert.notEqual(await value('inventory'), original)
  const resized = await value('inventory')
  await undo.tap()
  assert.equal(await value('inventory'), original)
  await redo.tap()
  assert.equal(await value('inventory'), resized)
  await editor.getByRole('button', { name: 'Rotate control right' }).tap()
  const rotated = await value('inventory')
  assert.match(rotated, /rotation 15 degrees/)
  await editor.getByRole('button', { name: 'RESET THIS CONTROL' }).tap()
  assert.equal(await value('inventory'), original)
  await undo.tap()
  assert.equal(await value('inventory'), rotated)
  await dock.getByRole('button', { name: 'RESET LAYOUT' }).tap()
  assert.equal(await editor.getAttribute('data-restoring-default'), 'true')
  await undo.tap()
  assert.equal(await value('inventory'), rotated, 'a full reset is undoable')
  await editor.getByRole('button', { name: 'Straighten control' }).tap()
  assert.equal(await redo.isDisabled(), true, 'a new edit clears redo')
  const beforeAccessibleClick = await value('inventory')
  await editor.getByRole('button', { name: 'Make control larger' }).dispatchEvent('click')
  await undo.dispatchEvent('click')
  assert.equal(await value('inventory'), beforeAccessibleClick, 'assistive activation creates its own undo step')
  await page.screenshot({ path: `${evidence}/phone-adjustments.png`, scale: 'css' })

  const targetSizes = await dock.locator('button, select, input').evaluateAll((nodes) =>
    nodes.map((node) => ({ name: node.getAttribute('aria-label') || node.textContent, height: node.getBoundingClientRect().height })))
  assert.ok(targetSizes.every((target) => target.height >= 44), JSON.stringify(targetSizes))
  await dock.getByRole('button', { name: /^ADJUST/ }).tap()
  await dock.locator('[data-mobile-ui-grid-toggle]').tap()

  const movementBefore = await value('leftJoystick')
  const movement = await center(control('leftJoystick'))
  await page.mouse.move(movement.x, movement.y)
  await page.mouse.down()
  await page.mouse.move(movement.x + 24, movement.y - 32, { steps: 8 })
  await page.mouse.up()
  const moved = await value('leftJoystick')
  assert.notEqual(moved, movementBefore)
  await undo.tap()
  assert.equal(await value('leftJoystick'), movementBefore, 'one undo reverses the whole drag')
  await redo.tap()
  assert.equal(await value('leftJoystick'), moved)

  const cdp = await context.newCDPSession(page)
  const pinchCenter = await center(control('leftJoystick'))
  const first = { id: 11, x: pinchCenter.x - 12, y: pinchCenter.y }
  const second = { id: 12, x: pinchCenter.x + 12, y: pinchCenter.y }
  await touch(cdp, 'touchStart', [first, second])
  first.x -= 8
  second.x += 8
  await touch(cdp, 'touchMove', [first, second])
  await page.waitForFunction(() => document.querySelector('[data-mobile-ui-editor-element="leftJoystick"]').getAttribute('aria-label').includes('scale 1.67'))
  await touch(cdp, 'touchEnd', [first])
  const pinched = await value('leftJoystick')
  second.y -= 20
  await touch(cdp, 'touchMove', [second])
  await touch(cdp, 'touchEnd', [])
  assert.notEqual(await value('leftJoystick'), pinched, 'remaining finger continues dragging after pinch')
  await undo.tap()
  assert.equal(await value('leftJoystick'), moved, 'pinch and remaining-finger drag form one undo step')

  for (const viewport of [{ width: 667, height: 375 }, { width: 896, height: 366 }]) {
    await page.setViewportSize(viewport)
    await assertCanvasFits(page, viewport)
    await dock.getByRole('button', { name: /^ADJUST/ }).tap()
    await assertDockFits(dock, viewport)
    await page.screenshot({ path: `${evidence}/phone-${viewport.width}x${viewport.height}.png`, scale: 'css' })
    await dock.getByRole('button', { name: /^ADJUST/ }).tap()
  }
  await page.setViewportSize({ width: 414, height: 896 })
  await page.locator('.game-orientation-hint').waitFor({ state: 'visible' })
  await page.setViewportSize({ width: 896, height: 414 })
  await assertCanvasFits(page, { width: 896, height: 414 })
  assert.equal(await value('leftJoystick'), moved, 'orientation changes preserve custom transforms')
  assert.equal(await page.evaluate(key => localStorage.getItem(key), MOBILE_UI_LAYOUT_STORAGE_KEY), null)
  await dock.getByRole('button', { name: 'SAVE', exact: true }).tap()
  await page.locator('.game-settings-dialog[data-settings-page="root"]').waitFor()
  const saved = await page.evaluate(key => localStorage.getItem(key), MOBILE_UI_LAYOUT_STORAGE_KEY)
  assert.ok(saved)
  assert.deepEqual(Object.keys(JSON.parse(saved).elements).sort(), [...MOBILE_UI_ELEMENT_IDS].sort())
  await page.getByRole('button', { name: 'CUSTOMIZE MOBILE UI', exact: true }).tap()
  await editor.waitFor()
  assert.equal(await value('leftJoystick'), moved, 'saved layout reopens unchanged')
  await dock.getByRole('button', { name: 'SAVE', exact: true }).tap()
  await page.getByRole('button', { name: 'DONE', exact: true }).tap()
  await exerciseHud(page, cdp)
  await context.close()

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await desktop.addInitScript(({ key, saved }) => localStorage.setItem(key, saved), { key: MOBILE_UI_LAYOUT_STORAGE_KEY, saved })
  const desktopPage = await openGame(desktop)
  currentPage = desktopPage
  await openEditor(desktopPage)
  const desktopEditor = desktopPage.locator('.mobile-ui-editor')
  assert.equal(await desktopEditor.getAttribute('data-editor-presentation'), 'windowed')
  await desktopEditor.getByRole('combobox').selectOption('inventory')
  const desktopInventory = desktopEditor.locator('[data-mobile-ui-editor-element="inventory"]')
  const desktopBefore = await desktopInventory.getAttribute('aria-label')
  await desktopEditor.getByRole('button', { name: 'Make control larger' }).click()
  await desktopEditor.getByRole('button', { name: 'Make control larger' }).press('Control+z')
  assert.equal(await desktopInventory.getAttribute('aria-label'), desktopBefore)
  await desktopEditor.getByRole('button', { name: 'RESET LAYOUT' }).click()
  await desktopEditor.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await exerciseGridGuides(desktopPage, desktopEditor)
  await desktopEditor.getByRole('button', { name: 'RESET LAYOUT' }).click()
  await desktopPage.screenshot({ path: `${evidence}/desktop-editor.png`, scale: 'css' })
  await desktopPage.getByRole('button', { name: 'SAVE', exact: true }).click()
  assert.equal(await desktopPage.evaluate(key => localStorage.getItem(key), MOBILE_UI_LAYOUT_STORAGE_KEY), null)
  await desktop.close()
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
  console.log(JSON.stringify({ status: 'passed', controls: MOBILE_UI_ELEMENT_IDS.length, targetSizes, errors }))
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: `${evidence}/failure.png`, scale: 'css' })
  console.error(JSON.stringify(errors))
  throw error
} finally {
  await browser.close()
  await host.close()
  await server.close()
}

async function openGame(context) {
  const page = await context.newPage()
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) errors.requests.push(`${request.url()} ${request.failure()?.errorText}`)
  })
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
  })
  await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 240000 })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  return page
}

async function openEditor(page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.locator('.game-settings-group[aria-label="CONTROLS"]').getByRole('button', { name: 'CUSTOMIZE MOBILE UI', exact: true }).click()
  await page.locator('.mobile-ui-editor').waitFor()
}

async function center(locator) {
  const bounds = await locator.boundingBox()
  assert.ok(bounds)
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

async function touch(cdp, type, touchPoints) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
}

async function assertCanvasFits(page, viewport) {
  await page.waitForFunction(({ width, height }) => {
    const canvas = document.querySelector('.mobile-ui-editor-page').getBoundingClientRect()
    return Math.abs(canvas.width - width) < 1 && Math.abs(canvas.height - height) < 1
  }, viewport)
  await assertDockFits(page.locator('.mobile-ui-editor-dock'), viewport)
}

async function assertDockFits(dock, viewport) {
  const bounds = await dock.boundingBox()
  assert.ok(bounds.x >= 7 && bounds.y >= 7 && bounds.x + bounds.width <= viewport.width - 7
    && bounds.y + bounds.height <= viewport.height - 7, JSON.stringify(bounds))
}

async function exerciseHud(page, cdp) {
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: /^New game$/i }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor()
  await page.getByRole('textbox', { name: 'Wizard name' }).fill('Aurelia')
  await page.getByRole('button', { name: 'water', exact: true }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 240000 })
  const joystick = page.locator('[data-joystick="movement"]')
  const potionIconCenter = await center(page.locator('.hub-hud-quickbar-slot[data-entry-kind="health-potion"] .hub-hud-belt-item-icon'))
  const potionSlotCenter = await center(page.locator('.hub-hud-quickbar-slot[data-entry-kind="health-potion"]'))
  assert.ok(Math.abs(potionIconCenter.x - potionSlotCenter.x) < 0.75
    && Math.abs(potionIconCenter.y - potionSlotCenter.y) < 0.75, 'mobile potion icon is centered in its slot')
  await exerciseBeltSlots(page, cdp)
  assert.equal(await joystick.locator('.game-touch-joystick-label').innerText(), 'MOVE')
  const point = await center(joystick)
  const initialX = await page.locator('.hub-world-canvas').evaluate(node => node.__sdrHubFrame.playerX)
  await touch(cdp, 'touchStart', [{ id: 21, x: point.x + 30, y: point.y }])
  await page.waitForFunction(x => document.querySelector('.hub-world-canvas').__sdrHubFrame.playerX > x + 1, initialX)
  assert.equal(await joystick.getAttribute('data-active'), 'true')
  await page.screenshot({ path: `${evidence}/mobile-hud-active.png`, scale: 'css' })
  await touch(cdp, 'touchEnd', [])
  assert.equal(await joystick.getAttribute('data-active'), 'false')
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.waitFor()
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await inventory.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]').waitFor({ timeout: 240000 })
  // Use the established fixture to complete Solomon's authentic combat prelude.
  await openBoneyardCombat(host, host.hostPlayerId())
  await page.locator('.boneyard-scene[data-combat-enabled="true"]').waitFor()
  const aim = page.locator('[data-joystick="primary"]')
  assert.equal(await aim.locator('.game-touch-joystick-label').innerText(), 'AIM / CAST')
  const aimPoint = await center(aim)
  const primaryCast = () => {
    const id = host.hostPlayerId()
    return getPlayerCharacter(host.playerState(id), id).primaryCast
  }
  await touch(cdp, 'touchStart', [{ id: 22, x: aimPoint.x + 30, y: aimPoint.y }])
  await waitUntil(() => primaryCast().held && primaryCast().aimDirection.x > 0.95, 'primary joystick aims and holds', 10000)
  await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame.primarySpellKinds.includes('water'))
  await page.screenshot({ path: `${evidence}/mobile-primary-cast.png`, scale: 'css' })
  await touch(cdp, 'touchEnd', [])
  await waitUntil(() => !primaryCast().held, 'primary joystick releases', 10000)
  assert.equal(await aim.getAttribute('data-active'), 'false')
  await page.screenshot({ path: `${evidence}/mobile-boneyard.png`, scale: 'css' })
}

async function exerciseGridGuides(page, editor) {
  const picker = editor.getByRole('combobox', { name: 'Selected mobile UI element' })
  const grid = editor.locator('.mobile-ui-editor-page')
  assert.equal(await grid.getAttribute('data-grid-visible'), 'true')
  assert.equal(await grid.evaluate(node => getComputedStyle(node).backgroundSize.split(',')[0].trim()), `${MOBILE_UI_GRID_SIZE}px ${MOBILE_UI_GRID_SIZE}px`)
  for (const id of MOBILE_UI_ELEMENT_IDS) {
    await picker.selectOption(id)
    for (const move of ['right', 'down']) {
      await editor.getByRole('button', { name: `Move control ${move}`, exact: true }).click()
      const proof = await editor.evaluate((root, { id, step }) => {
        const canvas = root.querySelector('.mobile-ui-editor-page')
        const pageBox = canvas.getBoundingClientRect()
        const zoom = pageBox.width / parseFloat(canvas.style.width)
        const bounds = root.querySelector(`[data-mobile-ui-editor-element="${id}"]`).getBoundingClientRect()
        return [...root.querySelectorAll('.mobile-ui-editor-snap-guide')].map(node => {
          const line = node.getBoundingClientRect()
          const axis = node.getAttribute('data-snap-guide-axis')
          const position = parseFloat(axis === 'x' ? node.style.left : node.style.top)
          const anchors = axis === 'x'
            ? [bounds.left, (bounds.left + bounds.right) / 2, bounds.right]
            : [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom]
          const drawn = axis === 'x' ? line.left + line.width / 2 : line.top + line.height / 2
          const origin = axis === 'x' ? pageBox.left : pageBox.top
          return {
            kind: node.getAttribute('data-snap-guide-kind'),
            alignmentError: Math.min(...anchors.map(anchor => Math.abs(anchor - drawn))),
            coordinateError: Math.abs(drawn - (origin + position * zoom)),
            gridRemainder: position % step,
          }
        })
      }, { id, step: MOBILE_UI_GRID_SIZE })
      assert.ok(proof.length > 0, `${id}: visible snap guides after ${move}`)
      for (const line of proof) {
        assert.ok(line.alignmentError < 0.75 && line.coordinateError < 0.75, `${id}: ${JSON.stringify(line)}`)
        if (line.kind === 'grid') assert.ok(Math.abs(line.gridRemainder) < 1e-6)
      }
      if (id === 'meters' && move === 'down') {
        await page.screenshot({ path: `${evidence}/${await editor.getAttribute('data-editor-presentation')}-visible-grid-guides.png`, scale: 'css' })
      }
      await editor.getByRole('button', { name: 'Rotate control right', exact: true }).click()
      assert.equal(await editor.locator('.mobile-ui-editor-snap-guide').count(), 0, 'fine adjustments clear obsolete guides')
    }
  }
  await page.screenshot({ path: `${evidence}/${await editor.getAttribute('data-editor-presentation')}-grid-guides.png`, scale: 'css' })
}

async function exerciseBeltSlots(page, cdp) {
  const id = host.hostPlayerId()
  const state = host.playerState(id)
  const index = state.playerEntities.identities.findIndex(identity => identity.playerId === id)
  const originalBelt = getPlayerBelt(state, id)
  const originalBook = state.playerEntities.skillBooks[index]
  const originalRuntime = state.playerEntities.skillRuntimes[index]
  const originalEconomy = getPlayerEconomy(state, id)
  const originalSecondary = state.secondaryAbilities.players[id]
  const skills = [8, 16, 24, 32, 40, 57, 58, 59]
  const ranks = [...originalBook.permanentRanks]
  const effective = [...originalBook.effectiveRanks]
  for (const skill of skills) { ranks[skill] = 1; effective[skill] = 1 }
  const books = [...state.playerEntities.skillBooks]
  books[index] = {
    ...originalBook,
    permanentRanks: ranks,
    effectiveRanks: effective,
    learnedSkillOrder: [...new Set([...originalBook.learnedSkillOrder, ...skills])],
  }
  let entities = replacePlayerEconomy({ ...state.playerEntities, skillBooks: books }, id, originalEconomy)
  for (let slot = 0; slot < skills.length; slot += 1) entities = bindPlayerEntitySkillQuickbar(entities, id, skills[slot], slot)
  Object.assign(state, { playerEntities: entities })
  const selection = () => {
    const current = host.playerState(id).playerEntities
    return {
      primary: current.skillBooks[index].primarySkillId,
      concentrations: [current.skillRuntimes[index].concentrationSkillIdA, current.skillRuntimes[index].concentrationSkillIdB],
    }
  }
  for (let slot = 0; slot < skills.length; slot += 1) {
    const skill = skills[slot]
    const button = page.locator(`.hub-scene .hub-hud-quickbar-slot[data-slot="${slot}"]`)
    await button.locator(`.hub-hud-quickbar-skill-icon[data-record="${nativeSkillIconRecord(skill, null)}"]`).waitFor()
    await assertCenteredIcon(button)
    const before = selection()
    const point = await center(button)
    await touch(cdp, 'touchStart', [{ id: 30 + slot, ...point }])
    await touch(cdp, 'touchCancel', [])
    await delay(80)
    assert.deepEqual(selection(), before, `slot ${slot + 1}: canceled presses do not activate`)
    await button.tap()
    await waitUntil(() => {
      const selected = selection()
      return nativeSkillCategory(skill) === 1 ? selected.primary === skill : selected.concentrations.includes(skill)
    }, `slot ${slot + 1} activates skill ${skill}`, 10000)
  }
  await page.screenshot({ path: `${evidence}/eight-live-slot-icons.png`, scale: 'css' })
  const cooling = host.playerState(id)
  const secondary = cooling.secondaryAbilities.players[id]
  assert.ok(secondary)
  const cooldownTicks = [...secondary.cooldownTicksBySkill]
  const cooldownMaximums = [...secondary.cooldownMaximumTicksBySkill]
  cooldownTicks[35] = 20000
  cooldownMaximums[35] = 20000
  Object.assign(cooling, {
    playerEntities: bindPlayerEntitySkillQuickbar(cooling.playerEntities, id, 35, 0),
    secondaryAbilities: { ...cooling.secondaryAbilities, players: {
      ...cooling.secondaryAbilities.players,
      [id]: { ...secondary, cooldownTicksBySkill: cooldownTicks, cooldownMaximumTicksBySkill: cooldownMaximums },
    } },
  })
  const coolingSlot = page.locator('.hub-scene .hub-hud-quickbar-slot[data-slot="0"][data-icon-alpha="0.25"]')
  await coolingSlot.locator('.hub-hud-quickbar-cooldown').waitFor()
  assert.equal(await coolingSlot.getAttribute('aria-disabled'), 'true')
  const sectorPoint = await center(coolingSlot.locator('.hub-hud-quickbar-cooldown'))
  const coolingPoint = await center(coolingSlot)
  assert.ok(Math.abs(sectorPoint.x - coolingPoint.x) < 0.75 && Math.abs(sectorPoint.y - coolingPoint.y) < 0.75)
  const runtimeIcons = await slotIconRecords(page.locator('.hub-scene'))
  await page.locator('.game-menu-skull').tap()
  await page.getByRole('button', { name: 'GAME SETTINGS', exact: true }).tap()
  await page.getByRole('button', { name: 'CUSTOMIZE MOBILE UI', exact: true }).tap()
  const editor = page.locator('.mobile-ui-editor')
  await editor.waitFor()
  const previewIcons = await editor.locator('[data-mobile-ui-editor-element^="slot"] .hub-hud-quickbar-skill-icon').evaluateAll(nodes => nodes.map(node => ({
    record: node.getAttribute('data-record'),
    opacity: getComputedStyle(node).opacity,
    filter: getComputedStyle(node).filter,
    background: getComputedStyle(node).backgroundImage,
    position: getComputedStyle(node).backgroundPosition,
  })))
  assert.deepEqual(previewIcons, runtimeIcons, 'editor uses the actual belt atlas records, trims, and scene color')
  assert.equal(await editor.locator('[data-mobile-ui-editor-element="slot1"] .hub-hud-quickbar-cooldown').count(), 1)
  await page.screenshot({ path: `${evidence}/equipped-belt-preview.png`, scale: 'css' })
  await editor.getByRole('button', { name: 'SAVE', exact: true }).tap()
  await page.getByRole('button', { name: 'DONE', exact: true }).tap()
  await page.locator('.hub-scene[data-gameplay-input-blocked="false"]').waitFor()

  const current = host.playerState(id)
  const economy = getPlayerEconomy(current, id)
  const health = economy.backpack.find(item => item.nativeTypeId === 7001 && item.nativeSubtype === 0)
  assert.ok(health && economy.equipment.hat && economy.equipment.weapon)
  const withoutWeapon = unequipInventorySlot(economy, 'weapon')
  assert.equal(withoutWeapon.accepted, true)
  const stocked = { ...withoutWeapon.state, backpack: withoutWeapon.state.backpack.map(item => item.id === health.id ? { ...item, quantity: 3 } : item) }
  let mixed = replacePlayerEconomy(current.playerEntities, id, stocked)
  mixed = bindPlayerEntityBeltItem(mixed, id, health.id, 2)
  mixed = bindPlayerEntityBeltItem(mixed, id, health.id, 6)
  mixed = bindPlayerEntityBeltItem(mixed, id, economy.equipment.weapon.id, 5)
  mixed = bindPlayerEntityBeltItem(mixed, id, economy.equipment.hat.id, 7)
  Object.assign(current, { playerEntities: mixed })
  const firstPotion = page.locator('.hub-scene .hub-hud-quickbar-slot[data-slot="2"][data-entry-kind="health-potion"]')
  const duplicatePotion = page.locator('.hub-scene .hub-hud-quickbar-slot[data-slot="6"][data-entry-kind="health-potion"]')
  const hat = page.locator('.hub-scene .hub-hud-quickbar-slot[data-slot="7"][data-entry-kind="item"]')
  const weapon = page.locator('.hub-scene .hub-hud-quickbar-slot[data-slot="5"][data-entry-kind="item"]')
  await firstPotion.waitFor()
  await duplicatePotion.waitFor()
  await hat.waitFor()
  await weapon.waitFor()
  assert.equal(await firstPotion.getAttribute('data-mobile-ui-element'), 'healthPotion')
  assert.equal(await duplicatePotion.getAttribute('data-mobile-ui-element'), 'slot7')
  const firstBox = await firstPotion.boundingBox()
  const duplicateBox = await duplicatePotion.boundingBox()
  assert.ok(firstBox.x + firstBox.width <= duplicateBox.x || duplicateBox.x + duplicateBox.width <= firstBox.x
    || firstBox.y + firstBox.height <= duplicateBox.y || duplicateBox.y + duplicateBox.height <= firstBox.y, 'duplicate potion bindings remain independently reachable')
  for (const button of [firstPotion, duplicatePotion, hat, weapon]) await assertCenteredIcon(button)
  assert.deepEqual(await hat.locator('[data-native-ui-record]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-native-ui-record'))),
    economy.equipment.hat.iconRecords.map(record => `Inventory.${record}`))
  await page.screenshot({ path: `${evidence}/item-and-duplicate-potion-slots.png`, scale: 'css' })
  await firstPotion.tap()
  await waitUntil(() => getPlayerEconomy(host.playerState(id), id).backpack.find(item => item.id === health.id)?.quantity === 2, 'dedicated potion button consumes one potion', 10000)
  await duplicatePotion.tap()
  await waitUntil(() => getPlayerEconomy(host.playerState(id), id).backpack.find(item => item.id === health.id)?.quantity === 1, 'duplicate potion slot consumes one potion', 10000)
  await weapon.tap()
  await waitUntil(() => getPlayerEconomy(host.playerState(id), id).equipment.weapon?.id === economy.equipment.weapon.id, 'item slot equips its bound item', 10000)

  const end = host.playerState(id)
  const belts = [...end.playerEntities.belts]
  const restoredBooks = [...end.playerEntities.skillBooks]
  const restoredRuntimes = [...end.playerEntities.skillRuntimes]
  belts[index] = originalBelt
  restoredBooks[index] = originalBook
  restoredRuntimes[index] = originalRuntime
  Object.assign(end, { playerEntities: replacePlayerEconomy({ ...end.playerEntities, belts, skillBooks: restoredBooks, skillRuntimes: restoredRuntimes }, id, originalEconomy) })
  Object.assign(end, { secondaryAbilities: { ...end.secondaryAbilities, players: { ...end.secondaryAbilities.players, [id]: originalSecondary } } })
  await page.locator('.hub-scene .hub-hud-quickbar-slot[data-slot="3"][data-entry-kind="health-potion"]').waitFor()
}

async function slotIconRecords(root) {
  return root.locator('.hub-hud-quickbar-skill-icon').evaluateAll(nodes => nodes.map(node => ({
    record: node.getAttribute('data-record'),
    opacity: getComputedStyle(node).opacity,
    filter: getComputedStyle(node).filter,
    background: getComputedStyle(node).backgroundImage,
    position: getComputedStyle(node).backgroundPosition,
  })))
}

async function assertCenteredIcon(button) {
  const icon = button.locator('.hub-hud-belt-item-icon, .hub-hud-quickbar-skill-icon').first()
  const controlPoint = await center(button)
  const iconPoint = await center(icon)
  assert.ok(Math.abs(controlPoint.x - iconPoint.x) < 0.75 && Math.abs(controlPoint.y - iconPoint.y) < 0.75,
    `slot icon center ${JSON.stringify(iconPoint)} matches ${JSON.stringify(controlPoint)}`)
}

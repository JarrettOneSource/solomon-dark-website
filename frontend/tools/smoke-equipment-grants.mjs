import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import {
  createEquipmentInventoryItem,
  DOWSING_EQUIPMENT_RECIPES,
} from '../src/game/core-kernels/hub-economy.ts'
import {
  getPlayerCharacter,
  getPlayerEconomy,
} from '../src/game/core-server/game-simulation.ts'
import {
  replacePlayerCharacter,
  replacePlayerEconomy,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { openBoneyardCombat } from './game-smoke-navigation.mjs'

// Mac-only acceptance: seed owned inventory, then use the production Inventory,
// SkillScreen, client transport, authoritative input and real renderer.
const screenshotRoot = process.env.SDR_GRANT_SCREENSHOT_ROOT || '/tmp/solomon-dark-equipment-grants'
await mkdir(screenshotRoot, { recursive: true })
const credential = randomBytes(32).toString('base64url')
const staticServer = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const host = await startGameHost({
  allowedOrigins: [staticServer.origin],
  authentication: { kind: 'shared', credential },
  // Reuse the deterministic arena from secondary-ability acceptance; this
  // journey exercises equipment grants, not random Boneyard generation.
  createBoneyardSeedBytes: () => Buffer.alloc(16),
  snapshotRate: 100,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const pageErrors = []
const consoleErrors = []
const failedResponses = []
const receipts = []

try {
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
  })
  await page.route('**/deployment.json*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await page.goto(`${staticServer.origin}/game`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeAdmission(page, host)
  await page.getByRole('button', { name: /Fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const index = host.state().playerEntities.identities.findIndex(row => row.playerId === playerId)
  const book = () => host.state().playerEntities.skillBooks[index]
  const runtime = () => host.state().playerEntities.skillRuntimes[index]
  const belt = () => host.state().playerEntities.belts[index]
  const permanent = [...book().permanentRanks]
  const original = getPlayerEconomy(host.state(), playerId)
  const strangler = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[15], 90_015)
  const replacementRecipe = DOWSING_EQUIPMENT_RECIPES.find(row => row.type === 'amulet' && row.level === 0)
  assert.ok(replacementRecipe)
  const replacement = createEquipmentInventoryItem(replacementRecipe, 90_100)
  const replacementRing = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[14], 90_102)
  const ring = {
    ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[0], 90_101),
    generatedLevel: 1,
    iconRecords: [52],
    name: 'Ingenious Acceptance Ring',
    nativeEffects: [
      { kind: 4, magnitude: 1, operator: 0, target: 8 },
      { kind: 4, magnitude: 1, operator: 0, target: 57 },
    ],
    nativeSelector: 0,
    rarity: null,
    recipeIndex: null,
  }
  const seed = economy => {
    const state = host.state()
    Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, playerId, economy) })
  }
  seed({
    ...original,
    backpack: [
      ...original.backpack,
      ...[strangler, replacement, ring, replacementRing].map((item, offset) => ({
        ...item, inventorySlot: original.backpack.length + offset,
      })),
    ],
    nextItemId: 100_000,
    revision: original.revision + 1,
  })
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  const skills = page.getByRole('dialog', { name: 'Skills' })
  const openInventory = async () => {
    await page.getByRole('button', { name: /Open inventory/ }).click()
    await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  }
  const equip = async (item, slot) => {
    const cell = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${item.id}"]`)
    await cell.click()
    await cell.locator('xpath=self::*[@data-selected="true"]').waitFor()
    await inventory.locator(`[data-equipment-slot="${slot}"]`).first().click()
    await inventory.locator(`[data-equipment-slot="${slot}"][data-inventory-item-id="${item.id}"]`).first().waitFor()
  }
  const openSkillsFromInventory = async () => {
    await inventory.getByRole('button', { name: 'Open skills' }).click()
    await skills.locator('xpath=self::*[@data-transition-phase="settled"]').waitFor()
  }
  const closeInventory = async () => {
    await page.keyboard.press('Escape')
    await inventory.waitFor({ state: 'hidden' })
    await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  }
  const closeSkills = async () => {
    await page.keyboard.press('Escape')
    await skills.waitFor({ state: 'hidden' })
    await page.locator('.hub-scene[data-gameplay-input-blocked="false"], .boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  }

  await openInventory()
  await equip(strangler, 'amulet')
  await waitUntil(() => book().effectiveRanks[11] === 1 && belt()[1]?.skillId === 11, 'rank-one grant and first empty slot')
  assert.equal(book().permanentRanks[11], 0)
  await openSkillsFromInventory()
  const leviathan = skills.getByRole('button', { name: /Call Leviathan, rank 1/ })
  await leviathan.waitFor()
  await skills.getByRole('button', { name: /Belt 2, Call Leviathan/ }).waitFor()
  await leviathan.hover()
  await page.screenshot({ path: join(screenshotRoot, 'hub-granted-leviathan-rank-one.png') })
  await leviathan.dragTo(skills.getByRole('button', { name: /Belt 8, empty/ }))
  await skills.getByRole('button', { name: /Belt 8, Call Leviathan/ }).waitFor()
  assert.equal(belt()[7].skillId, 11)
  receipts.push({ scene: 'hub', grant: 11, permanent: 0, effective: 1, automaticSlot: 1, manualDuplicateSlot: 7 })
  await closeSkills()

  await openInventory()
  await equip(ring, 'ring-0')
  await openSkillsFromInventory()
  await skills.getByRole('button', { name: /Magic Missile, rank 1/ }).click()
  await waitUntil(() => book().primarySkillId === 8, 'item-granted primary selection')
  const concentration = skills.getByRole('button', { name: /Channel Mana, rank 1/ })
  await concentration.click()
  await waitUntil(() => runtime().concentrationSkillIdA === 57, 'item-granted concentration selection')
  await concentration.dragTo(skills.getByRole('button', { name: /Belt 6, empty/ }))
  await skills.getByRole('button', { name: /Belt 6, Channel Mana/ }).waitFor()
  assert.equal(book().permanentRanks[8], 0)
  assert.equal(book().permanentRanks[57], 0)
  receipts.push({ scene: 'hub', primaryFromItem: 8, concentrationFromItem: 57, concentrationManualSlot: 5 })
  await page.screenshot({ path: join(screenshotRoot, 'hub-primary-and-concentration-grants.png') })
  await closeSkills()

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  await openBoneyardCombat(host, playerId)
  await page.mouse.move(1_050, 450)
  const beforeCast = host.state().secondaryAbilities.players[playerId]?.castSequence ?? 0
  await page.keyboard.down('1')
  try {
    await waitUntil(() => {
      const secondary = host.state().secondaryAbilities.players[playerId]
      return secondary?.castSequence > beforeCast && secondary.lastSkillId === 11
        && host.state().secondaryAbilities.actors.some(actor => actor.ownerId === playerId && actor.skillId === 11)
    }, 'real input summons Call Leviathan actors', 20_000)
  } finally {
    await page.keyboard.up('1')
  }
  const cast = host.state().secondaryAbilities.players[playerId]
  const actors = host.state().secondaryAbilities.actors.filter(actor => actor.ownerId === playerId && actor.skillId === 11)
  receipts.push({ scene: 'boneyard', castSequence: cast.castSequence, actorKinds: actors.map(actor => actor.kind), cooldown: cast.cooldownTicksBySkill[11] })
  await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.secondaryAbilitySamples.some(actor => actor.kind === 'leviathan'
      && actor.leviathanCompositePlan?.mask.scale > 0)
  }, undefined, { timeout: 10_000 })
  receipts.push(await page.locator('.boneyard-world-canvas').evaluate(node => ({
    scene: 'boneyard-renderer',
    primitives: node.__sdrBoneyardFrame.secondaryAbilityPrimitiveCount,
    renderedKinds: [...new Set(node.__sdrBoneyardFrame.secondaryAbilitySamples.map(actor => actor.kind))],
  })))
  await page.screenshot({ path: join(screenshotRoot, 'boneyard-granted-leviathan-cast.png') })

  await openInventory()
  await equip(replacement, 'amulet')
  await waitUntil(() => book().effectiveRanks[11] === 0 && belt()[1] === null && belt()[7] === null, 'unequip removes both temporary bindings')
  assert.equal(book().learnedSkillOrder.includes(11), false)
  await equip(strangler, 'amulet')
  await waitUntil(() => book().effectiveRanks[11] === 1 && belt()[1]?.skillId === 11, 're-equip reacquires the first empty slot')
  assert.equal(belt()[7], null)
  await closeInventory()
  const equipped = getPlayerEconomy(host.state(), playerId)
  const beforeRevelationTick = host.state().tick
  seed({ ...equipped, ownedPerkSelectors: [6], revision: equipped.revision + 1 })
  // Publish fixture changes through a real unpaused tick, not an out-of-band
  // host mutation while the inventory has legitimately paused snapshots.
  await waitUntil(() => book().effectiveRanks[11] === 2 && host.state().tick > beforeRevelationTick, 'Revelation raises the temporary grant')
  await openInventory()
  await openSkillsFromInventory()
  await skills.getByRole('button', { name: /Call Leviathan, rank 2/ }).hover()
  await page.screenshot({ path: join(screenshotRoot, 'boneyard-granted-leviathan-revelation.png') })
  assert.deepEqual(book().permanentRanks, permanent)
  receipts.push({ scene: 'boneyard', removed: true, reacquiredSlot: 1, revelationRank: 2, permanentRanksUnchanged: true })
  await closeSkills()
  await openInventory()
  await equip(replacementRing, 'ring-0')
  await waitUntil(() => book().effectiveRanks[8] === 0 && book().effectiveRanks[57] === 0
    && book().primarySkillId === 16 && runtime().concentrationSkillIdA !== 57
    && belt()[5] === null, 'removing a source clears concentration and restores an available primary')
  await openSkillsFromInventory()
  assert.equal(await skills.getByRole('button', { name: /Magic Missile, rank/ }).count(), 0)
  assert.equal(await skills.getByRole('button', { name: /Channel Mana, rank/ }).count(), 0)
  receipts.push({ scene: 'boneyard', removedPrimaryAndConcentration: true, primaryAfterRemoval: book().primarySkillId })
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  console.log(JSON.stringify({ receipts, pageErrors, consoleErrors, failedResponses }))
} catch (error) {
  await page.screenshot({ path: join(screenshotRoot, 'failure.png') }).catch(() => {})
  console.error(JSON.stringify({ pageErrors, consoleErrors, failedResponses, receipts }))
  throw error
} finally {
  await browser.close()
  await host.close()
  await staticServer.close()
}

async function waitUntil(predicate, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`)
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

async function waitForHost(predicate, label, timeoutMs) {
  return waitUntil(predicate, label, timeoutMs)
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

async function enterCreateAfterCollegeAdmission(page, host) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    page.locator('.hub-scene[data-renderer-state="ready"]')
      .waitFor({ timeout: 90_000 })
      .then(() => 'hub'),
  ])
  if (first === 'create') return

  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const state = host.state()
  assert.equal(state.world.kind, 'hub')
  const participant = state.world.participants[playerId]
  if (participant?.collegeIntro) {
    state.world = {
      ...state.world,
      participants: {
        ...state.world.participants,
        [playerId]: {
          collegeIntro: {
            ...participant.collegeIntro,
            contactCounter: 0,
            coverAlpha: 0,
            dialogueSequence: participant.collegeIntro.dialogueSequence + 1,
            officeSpeed: 0.5,
            pathCursor: 6,
            phase: 'arch-dialogue',
            titleCursor: 5,
          },
          region: 'office',
          transition: null,
        },
      },
    }
    state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
      ...getPlayerCharacter(state, playerId),
      position: { x: 522.5, y: 530 },
      velocity: { x: 0, y: 0 },
    })
    const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
    await dialog.waitFor({ timeout: 15_000 })
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.getByRole('button', { name: 'Solomon Dark?' }).click()
    await waitForHost(() => (
      host.state().world.kind === 'hub'
      && host.state().world.participants[playerId]?.collegeIntro === null
    ), 'College dialogue acknowledgement', 10_000)
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    await dialog.getByRole('button', { name: 'Skip' }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  }

  const office = host.state()
  assert.equal(office.world.kind, 'hub')
  office.playerEntities = replacePlayerCharacter(office.playerEntities, playerId, {
    ...getPlayerCharacter(office, playerId),
    position: { x: 512, y: 900 },
    velocity: { x: 0, y: 0 },
  })
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
}

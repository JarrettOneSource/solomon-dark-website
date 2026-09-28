import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'
import { DOWSING_EQUIPMENT_RECIPES, createEquipmentInventoryItem } from '../src/game/core-kernels/hub-economy.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { freezeNativeBelt } from '../src/game/core-kernels/native-belt.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const output = process.env.SDR_INVENTORY_BELT_OUTPUT
  ?? '/tmp/solomon-inventory-belt-actions'
const touch = process.env.SDR_INVENTORY_BELT_TOUCH === '1'
await mkdir(output, { recursive: true })
const server = await startStaticClientServer({
  root: fileURLToPath(new URL('../../backend/wwwroot/', import.meta.url)),
})
const credential = randomBytes(32).toString('base64url')
const host = await startGameHost({
  allowedOrigins: [server.origin],
  authentication: { kind: 'shared', credential },
  createBoneyardSeedBytes: () => Buffer.alloc(16),
  snapshotRate: 20,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({
  viewport: touch ? { width: 844, height: 390 } : { width: 1600, height: 900 },
  hasTouch: touch,
})
page.setDefaultTimeout(15_000)
const errors = { console: [], page: [], responses: [], requests: [] }
page.on('console', message => {
  if (message.type() === 'error') errors.console.push(message.text())
})
page.on('pageerror', error => errors.page.push(error.message))
page.on('response', response => {
  if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
})
page.on('requestfailed', request => {
  const failure = request.failure()?.errorText ?? 'unknown'
  if (failure === 'net::ERR_ABORTED' && /\.(?:mp3|ogg)(?:\?|$)|\/deployment\.json/.test(request.url())) return
  errors.requests.push(`${failure} ${request.url()}`)
})
await page.route('**/deployment.json*', async route => {
  const revision = new URL(route.request().url()).searchParams.get('current')
  await route.fulfill({ body: JSON.stringify({ revision }), contentType: 'application/json', status: 200 })
})
await page.addInitScript(({ token, url }) => {
  window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', credential: token, url } }
}, { token: credential, url: host.address.url })

try {
  await page.goto(`${server.origin}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
  }
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Fire' }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const ringIds = armHubRingBelt(playerId)
  await page.locator('.hub-hud-quickbar-slot[data-slot="6"][data-entry-kind="item"]').waitFor()
  await page.locator('.hub-hud-quickbar-slot[data-slot="7"][data-entry-kind="item"]').waitFor()
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const hubInventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await hubInventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  await activate(hubInventory.getByRole('button', {
    name: 'Activate belt slot 7; drag to remove', exact: true,
  }))
  await waitUntil(() => playerEconomy().equipment.rings[0]?.id === ringIds[0])
  await hubInventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await hubInventory.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Open Fomentius interaction' }).click()
  const service = page.getByRole('dialog', { name: "FOMENTIUS' USEFUL THYNGS" })
  await service.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  await activate(service.getByRole('button', {
    name: 'Activate belt slot 8; drag to remove', exact: true,
  }))
  await waitUntil(() => playerEconomy().equipment.rings[1]?.id === ringIds[1])
  await service.getByRole('button', { name: 'Done' }).click()
  await service.waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose a Boneyard' })
  if (await picker.count()) await picker.getByRole('button').first().click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]')
    .waitFor({ timeout: 90_000 })
  armBeltSkills(playerId)
  await page.locator('.hub-hud-quickbar-slot[data-slot="7"][data-entry-kind="skill"]').waitFor()
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const iceButton = inventory.getByRole('button', {
    name: 'Activate belt slot 8; drag to remove', exact: true,
  })
  await iceButton.waitFor()
  const frozenTick = host.state().tick
  await page.waitForTimeout(100)
  assert.equal(host.state().tick, frozenTick, 'Inventory did not hold the Boneyard world')
  const manaBefore = playerProgression().currentMana
  const before = await beltCrop(iceButton, 'ready-ice.png')
  await activate(iceButton)
  await waitUntil(() => host.state().secondaryAbilities.players[playerId]?.castSequence === 1)
  await page.waitForTimeout(100)
  assert.equal(host.state().tick, frozenTick, 'Inventory cast advanced the frozen world')
  const first = host.state().secondaryAbilities.players[playerId]
  assert.ok(first.cooldownTicksBySkill[35] > 0)
  assert.ok(host.state().secondaryAbilities.actors.some(({ kind }) => kind === 'freeze-wave'))
  const freezeActorId = host.state().secondaryAbilities.actors.find(({ kind }) => (
    kind === 'freeze-wave'
  )).id
  assert.ok(playerProgression().currentMana < manaBefore)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const after = await beltCrop(iceButton, 'cooldown-ice.png')
  const pixels = await comparePixels(before, after)
  assert.ok(pixels.changedChannels > 500, `Inventory cooldown pixels did not change: ${JSON.stringify(pixels)}`)
  assert.ok(pixels.redAfter > pixels.redBefore + 25, `Inventory cooldown fan did not turn red: ${JSON.stringify(pixels)}`)
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 15_000 })
  await waitUntil(() => host.state().tick > frozenTick + 5)
  const resumedFreezeAge = host.state().secondaryAbilities.actors.find(({ id }) => (
    id === freezeActorId
  ))?.ageTicks
  assert.ok((resumedFreezeAge ?? 0) > 0, 'the paused FreezeWave did not continue after Inventory closed')
  await waitUntil(() => host.state().secondaryAbilities.players[playerId]?.globalCooldownTicks === 0, 10_000)
  await page.getByRole('button', { name: /Open inventory/ }).click()
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const secondFrozenTick = host.state().tick
  await page.keyboard.press('Digit6')
  await waitUntil(() => host.state().secondaryAbilities.players[playerId]?.castSequence === 2)
  assert.equal(host.state().tick, secondFrozenTick, 'Inventory key cast advanced the frozen world')
  assert.equal(host.state().secondaryAbilities.players[playerId]?.lastSkillId, 21)
  assert.ok(host.state().secondaryAbilities.actors.some(({ kind }) => kind === 'moving-fire'))
  await inventory.locator(`[data-equipment-slot="ring-0"][data-inventory-item-id="${ringIds[0]}"]`).first().dblclick()
  await waitUntil(() => playerEconomy().equipment.rings[0] === null
    && playerEconomy().backpack.some(({ id }) => id === ringIds[0]))
  assert.equal(playerEconomy().equipment.rings[1]?.id, ringIds[1])
  assert.equal(host.state().tick, secondFrozenTick)
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [] })
  console.log(JSON.stringify({
    status: 'ok', browser: browser.version(), touch,
    frozenTicks: [frozenTick, secondFrozenTick], ringIds,
    ringOfIceCooldown: first.cooldownTicksBySkill[35], resumedFreezeAge, pixels,
    screenshots: [before.sha256, after.sha256], errors,
  }))
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', errors, tick: host.state().tick }))
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  await browser.close()
  await host.close()
  await server.close()
}

function playerProgression() {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === host.hostPlayerId())
  assert.notEqual(index, -1)
  return state.playerEntities.progressions[index]
}

async function activate(button) {
  if (touch) await button.tap()
  else await button.click()
}

function playerEconomy() {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === host.hostPlayerId())
  assert.notEqual(index, -1)
  return state.playerEntities.economies[index]
}

function armHubRingBelt(playerId) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const economy = state.playerEntities.economies[index]
  const recipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')
  assert.ok(recipe)
  const firstRing = {
    ...createEquipmentInventoryItem(recipe, economy.nextItemId),
    inventorySlot: 30,
  }
  const secondRing = {
    ...createEquipmentInventoryItem(recipe, economy.nextItemId + 1),
    inventorySlot: 31,
  }
  const belts = [...state.playerEntities.belts]
  belts[index] = freezeNativeBelt(belts[index].map((entry, slot) => (
    slot === 6 ? { kind: 'item', itemId: firstRing.id, nativeTypeId: firstRing.nativeTypeId }
      : slot === 7 ? { kind: 'item', itemId: secondRing.id, nativeTypeId: secondRing.nativeTypeId }
        : entry
  )))
  state.playerEntities = replacePlayerEconomy({ ...state.playerEntities, belts }, playerId, {
    ...economy,
    backpack: [...economy.backpack, firstRing, secondRing],
    nextItemId: secondRing.id + 1,
  })
  return [firstRing.id, secondRing.id]
}

function armBeltSkills(playerId) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const book = state.playerEntities.skillBooks[index]
  const permanentRanks = [...book.permanentRanks]
  const effectiveRanks = [...book.effectiveRanks]
  const learnedSkillOrder = [...book.learnedSkillOrder]
  for (const id of [21, 35]) {
    if ((permanentRanks[id] ?? 0) === 0 && !learnedSkillOrder.includes(id)) {
      learnedSkillOrder.push(id)
    }
    permanentRanks[id] = 1
    effectiveRanks[id] = 1
  }
  const skillBooks = [...state.playerEntities.skillBooks]
  skillBooks[index] = {
    ...book,
    permanentRanks,
    effectiveRanks,
    learnedSkillOrder,
  }
  const belts = [...state.playerEntities.belts]
  belts[index] = freezeNativeBelt(belts[index].map((entry, slot) => (
    slot === 6 ? { kind: 'skill', skillId: 21 }
      : slot === 7 ? { kind: 'skill', skillId: 35 }
        : entry
  )))
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index],
    currentHealth: 1_000_000,
    currentMana: 10_000,
    maximumHealth: 1_000_000,
    maximumMana: 10_000,
    revision: progressions[index].revision + 1,
  }
  state.playerEntities = replacePlayerEconomy({
    ...state.playerEntities,
    belts,
    progressions,
    skillBooks,
  }, playerId, state.playerEntities.economies[index])
}

async function waitUntil(predicate, timeoutMs = 5_000) {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Inventory belt authority did not reach expected state')
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

async function beltCrop(button, name) {
  const box = await button.boundingBox()
  assert.ok(box)
  const bytes = await page.screenshot({
    clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) },
    path: join(output, name),
  })
  return { encoded: bytes.toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') }
}

async function comparePixels(before, after) {
  return page.evaluate(async ({ encoded }) => {
    const pixels = []
    for (const text of encoded) {
      const bytes = Uint8Array.from(atob(text), character => character.charCodeAt(0))
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      pixels.push(context.getImageData(0, 0, image.width, image.height).data)
      image.close()
    }
    let changedChannels = 0
    const red = [0, 0]
    for (let index = 0; index < pixels[0].length; index += 4) {
      for (let image = 0; image < 2; image += 1) {
        const [r, g, b] = pixels[image].slice(index, index + 3)
        if (r > 40 && r > g * 1.5 && r > b * 1.5) red[image] += 1
      }
      for (let channel = 0; channel < 3; channel += 1) {
        if (Math.abs(pixels[0][index + channel] - pixels[1][index + channel]) > 8) changedChannels += 1
      }
    }
    return { changedChannels, redBefore: red[0], redAfter: red[1] }
  }, { encoded: [before.encoded, after.encoded] })
}

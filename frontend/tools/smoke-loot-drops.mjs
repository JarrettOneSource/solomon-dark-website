import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import {
  createServer as createViteServer,
  preview as createVitePreviewServer,
} from 'vite'

import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import {
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  NATIVE_LOOT_OPEN_PLACEMENT,
  createNativeLootItemIds,
  materializeNativeLootScriptAction,
  rollNativeEnemyLoot,
} from '../src/game/core-kernels/native-loot.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import {
  spawnBoneyardLootSpecs,
} from '../src/game/core-server/boneyard-loot-store.ts'
import {
  getPlayerCharacter,
  getPlayerEconomy,
  getPlayerProgression,
} from '../src/game/core-server/game-simulation.ts'
import {
  damagePlayerEntity,
  replacePlayerCharacter,
  setPlayerEntityMana,
} from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_LOOT_SCREENSHOT_ROOT
  || join(tmpdir(), 'solomon-dark-loot-drops')
const chromePath = process.env.SDR_CHROME_PATH || (process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : '/usr/bin/google-chrome')
const useBuiltFrontend = process.env.SDR_LOOT_BUILT === '1'
const ALL_DISABLED = Object.freeze({
  gold: 4,
  item: 4,
  orb: 4,
  potion: 4,
  powerup: 4,
  specificItem: 0,
})

await mkdir(screenshotRoot, { recursive: true })
const credential = 'loot-drop-browser-parity'
const viteConfig = {
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
}
const vite = useBuiltFrontend
  ? await createVitePreviewServer({
      ...viteConfig,
      preview: { host: '127.0.0.1', port: 0 },
    })
  : await createViteServer({
      ...viteConfig,
      server: { host: '127.0.0.1', port: 0 },
    })
if (!useBuiltFrontend) await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its loot-drop smoke port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: chromePath,
  headless: true,
})
const [hostContext, guestContext] = await Promise.all([
  browser.newContext({ viewport: { height: 900, width: 1_600 } }),
  browser.newContext({ viewport: { height: 900, width: 1_600 } }),
])
const [hostPage, guestPage] = await Promise.all([
  hostContext.newPage(),
  guestContext.newPage(),
])
const consoleErrors = []
const failedResponses = []
const pageErrors = []

await Promise.all([hostPage, guestPage].map(async (page) => {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current')
    return route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
}))

try {
  const page = hostPage
  await enterHub(hostPage, baseUrl, 'Fire')
  await enterHub(guestPage, baseUrl, 'Air')
  await Promise.all([
    waitForPlayers(hostPage, 2),
    waitForPlayers(guestPage, 2),
  ])
  await hostPage.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await Promise.all([
    waitForBoneyard(hostPage, 2),
    waitForBoneyard(guestPage, 2),
  ])
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  const playerId = host.hostPlayerId()
  assert.ok(playerId, 'the browser player must own the authoritative host slot')
  assert.equal(host.state().world.kind, 'boneyard')
  const guestPlayerId = host.state().playerEntities.identities
    .map(({ playerId: connectedPlayerId }) => connectedPlayerId)
    .find((connectedPlayerId) => connectedPlayerId !== playerId)
  assert.ok(guestPlayerId, 'the second browser must own a distinct authoritative slot')

  const center = arenaCenter(host.state().world.bounds)
  movePlayer(host, playerId, center)
  movePlayer(host, guestPlayerId, point(center, 450, 300))
  prepareOrbDeficits(host, playerId)
  const materialized = materializeProofDrops(host, center)
  const before = {
    backpackIds: new Set(getPlayerEconomy(host.state(), playerId).backpack.map(({ id }) => id)),
    ringNameCount: backpackNameCount(
      host,
      playerId,
      materialized.ringItem.name,
    ),
    robeNameCount: backpackNameCount(host, playerId, materialized.robeItem.name),
    gold: getPlayerEconomy(host.state(), playerId).gold,
    health: getPlayerProgression(host.state(), playerId).currentHealth,
    healthPotionQuantity: backpackKindQuantity(host, playerId, 'health-potion'),
    mana: getPlayerProgression(host.state(), playerId).currentMana,
  }
  assert.ok(before.health > 0)
  assert.equal(before.mana, 0)

  const spawned = spawnProofDrops(host, materialized)
  assert.equal(spawned.rejectedCount, 0)
  assert.deepEqual(spawned.actors.map(({ kind }) => kind), [
    'gold', 'sack', 'sack', 'sack', 'orb', 'orb', 'bonus',
  ])
  assert.deepEqual(spawned.actors.filter(({ kind }) => kind === 'sack')
    .map(({ item, source }) => ({ equipmentType: item?.equipmentType, source })), [
    { equipmentType: null, source: 'script' },
    { equipmentType: 'ring', source: 'enemy' },
    { equipmentType: 'robe', source: 'enemy' },
  ])
  assert.deepEqual(spawned.actors.filter(({ kind }) => kind === 'orb')
    .map(({ orbKind }) => orbKind), ['health', 'mana'])
  assert.equal(spawned.actors.at(-1)?.bonusKind, 2)

  await waitForLootCount(page, spawned.actors.length)
  await waitUntil(() => settled(host, spawned.ids), 'loot actors did not settle')
  await Promise.all([
    waitForAudio(page, 'drop-coins'),
    waitForAudio(page, 'drop-potion'),
    waitForAnyAudio(page, ['drop-bag-1', 'drop-bag-2']),
  ])

  const visualPath = join(screenshotRoot, 'loot-families-visible.png')
  const visualScreenshot = await page.screenshot({ path: visualPath })
  assert.ok(visualScreenshot.byteLength > 20_000)

  const goldEffectStart = nextLootEffectId(host)
  movePlayer(host, playerId, spawned.gold.position)
  await waitForPickup(host, spawned.gold.id)
  await waitUntil(() => (
    getPlayerEconomy(host.state(), playerId).gold === before.gold + 10
  ), 'Gold pickup did not credit the authoritative economy')
  await waitUntil(() => nextLootEffectId(host) === goldEffectStart + 2, (
    'Gold pickup did not allocate its two native additive effects'
  ))
  const goldEffectEnd = nextLootEffectId(host)
  const goldMessage = await waitForBitmapMessage(page, '10 GOLD')
  await waitForAudio(page, 'pickup-coin')

  movePlayer(host, playerId, spawned.potion.position)
  await waitForPickup(host, spawned.potion.id)
  await waitUntil(() => (
    backpackKindQuantity(host, playerId, 'health-potion') === before.healthPotionQuantity + 1
  ), (
    'Potion pickup did not append to the authoritative backpack'
  ))
  const potionMessage = await waitForBitmapMessage(page, 'Health Potion')

  movePlayer(host, playerId, spawned.ring.position)
  await waitForPickup(host, spawned.ring.id)
  await waitUntil(() => (
    backpackNameCount(host, playerId, materialized.ringItem.name)
      === before.ringNameCount + 1
  ), (
    'enemy Ring pickup did not append to the authoritative backpack'
  ))
  const ringMessage = await waitForBitmapMessage(page, materialized.ringItem.name)

  movePlayer(host, playerId, spawned.robe.position)
  await waitForPickup(host, spawned.robe.id)
  await waitUntil(() => (
    backpackNameCount(host, playerId, materialized.robeItem.name)
      === before.robeNameCount + 1
  ), (
    'enemy Robe pickup did not append to the authoritative backpack'
  ))
  const robeMessage = await waitForBitmapMessage(page, materialized.robeItem.name)
  await waitForAudioCount(page, 'pickup-bag', 3)

  const healthOrbEffectStart = nextLootEffectId(host)
  movePlayer(host, playerId, spawned.healthOrb.position)
  await waitForPickup(host, spawned.healthOrb.id)
  await waitUntil(() => (
    getPlayerProgression(host.state(), playerId).currentHealth > before.health
  ), 'Health Orb did not restore authoritative health')
  await waitUntil(() => nextLootEffectId(host) >= healthOrbEffectStart + 1, (
    'Health Orb pickup did not allocate its native fade effect'
  ))
  const healthOrbEffectEnd = nextLootEffectId(host)

  const manaOrbEffectStart = nextLootEffectId(host)
  movePlayer(host, playerId, spawned.manaOrb.position)
  await waitForPickup(host, spawned.manaOrb.id)
  await waitUntil(() => (
    getPlayerProgression(host.state(), playerId).currentMana > before.mana
  ), 'Mana Orb did not restore authoritative mana')
  await waitUntil(() => nextLootEffectId(host) >= manaOrbEffectStart + 1, (
    'Mana Orb pickup did not allocate its native fade effect'
  ))
  const manaOrbEffectEnd = nextLootEffectId(host)
  await waitForAudioCount(page, 'goto-orb', 2)

  movePlayer(host, playerId, spawned.powerup.position)
  await waitForPickup(host, spawned.powerup.id)
  await waitUntil(() => (
    getPlayerProgression(host.state(), playerId).damageX4TicksRemaining > 0
  ), 'Damage x4 Powerup did not update authoritative progression')
  const powerupMessage = await waitForBitmapMessage(page, 'DAMAGE x4')

  await waitForLootCount(page, 0)
  const collectedPath = join(screenshotRoot, 'loot-families-collected.png')
  const collectedScreenshot = await page.screenshot({ path: collectedPath })
  assert.ok(collectedScreenshot.byteLength > 20_000)
  const terminalFade = await proveTerminalBonusFade({
    guestPage,
    guestPlayerId,
    host,
    hostPage,
    hostPlayerId: playerId,
    position: point(center, 0, 250),
  })

  const after = {
    backpack: getPlayerEconomy(host.state(), playerId).backpack
      .filter(({ id }) => !before.backpackIds.has(id))
      .map(({ id, kind, name }) => ({ id, kind, name })),
    damageX4TicksRemaining: getPlayerProgression(host.state(), playerId)
      .damageX4TicksRemaining,
    gold: getPlayerEconomy(host.state(), playerId).gold,
    health: getPlayerProgression(host.state(), playerId).currentHealth,
    healthPotionQuantity: backpackKindQuantity(host, playerId, 'health-potion'),
    mana: getPlayerProgression(host.state(), playerId).currentMana,
    ringNameCount: backpackNameCount(host, playerId, materialized.ringItem.name),
    robeNameCount: backpackNameCount(host, playerId, materialized.robeItem.name),
  }
  const audio = await lootAudioReceipt(page)
  assert.equal(audio['drop-coins'], 1)
  assert.equal(audio['drop-potion'], 1)
  assert.equal(audio['pickup-coin'], 1)
  assert.equal(audio['pickup-bag'], 3)
  assert.equal(audio['goto-orb'], 2)
  assert.equal(audio['drop-bag-1'] + audio['drop-bag-2'], 2)
  const contention = await proveCanonicalPickupContention({
    guestPage,
    guestPlayerId,
    host,
    hostPage,
    hostPlayerId: playerId,
    position: point(center, 0, 250),
  })
  assert.deepEqual({ consoleErrors, failedResponses, pageErrors }, {
    consoleErrors: [],
    failedResponses: [],
    pageErrors: [],
  })

  process.stdout.write(`${JSON.stringify({
    after,
    audio,
    browser: await canvas.evaluate((node) => ({
      context: (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name,
      rendererName: node.dataset.rendererName,
    })),
    consoleErrors,
    contention,
    effects: {
      gold: { count: goldEffectEnd - goldEffectStart, firstEffectId: goldEffectStart },
      healthOrb: {
        count: healthOrbEffectEnd - healthOrbEffectStart,
        firstEffectId: healthOrbEffectStart,
      },
      manaOrb: {
        count: manaOrbEffectEnd - manaOrbEffectStart,
        firstEffectId: manaOrbEffectStart,
      },
    },
    failedResponses,
    messages: {
      gold: goldMessage,
      potion: potionMessage,
      powerup: powerupMessage,
      ring: ringMessage,
      robe: robeMessage,
    },
    pageErrors,
    proof: spawned.actors.map((actor) => ({
      bonusKind: actor.bonusKind,
      equipmentType: actor.item?.equipmentType ?? null,
      id: actor.id,
      item: actor.item?.name ?? null,
      kind: actor.kind,
      orbKind: actor.orbKind,
      position: actor.position,
      source: actor.source,
    })),
    screenshots: [visualPath, collectedPath],
    terminalFade,
    useBuiltFrontend,
  }, null, 2)}\n`)
} finally {
  await host.close()
  await Promise.all([
    hostContext.close(),
    guestContext.close(),
  ])
  await browser.close()
  await vite.close()
}

async function enterHub(page, baseUrl, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const tutorialPrompt = page.locator('.stock-prompt-dialog[data-prompt-kind="tutorial"]')
  if (await tutorialPrompt.isVisible()) {
    await tutorialPrompt.getByRole('button', { name: 'NO' }).click()
    await tutorialPrompt.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: element }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await Promise.all([
    page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 }),
    page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]').waitFor({
      timeout: 60_000,
    }),
  ])
}

async function waitForPlayers(page, count) {
  await page.waitForFunction((expected) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerCount === expected
  ), count, { timeout: 30_000 })
}

async function waitForBoneyard(page, count) {
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  await page.waitForFunction((expected) => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === expected
  ), count, { timeout: 30_000 })
}

function prepareOrbDeficits(host, playerId) {
  const state = host.state()
  const progression = getPlayerProgression(state, playerId)
  let playerEntities = damagePlayerEntity(
    state.playerEntities,
    playerId,
    Math.max(1, Math.min(25, progression.currentHealth - 1)),
    state.tick,
  )
  playerEntities = setPlayerEntityMana(playerEntities, playerId, 0)
  Object.assign(state, { playerEntities })
}

function materializeProofDrops(host, center) {
  const source = host.state().world.loot
  const itemIds = createNativeLootItemIds(source.nextItemId)
  const positions = {
    gold: point(center, -150, 0),
    healthOrb: point(center, -75, 100),
    manaOrb: point(center, 0, 100),
    potion: point(center, -75, -100),
    powerup: point(center, 150, 0),
    ring: point(center, 0, -100),
    robe: point(center, 75, -100),
  }
  let lastSuccessfulItemLevel = source.lastSuccessfulItemLevel
  let sharedRng = source.sharedRng
  const drops = []
  const accept = (result) => {
    drops.push(...result.drops)
    lastSuccessfulItemLevel = result.lastSuccessfulItemLevel
    sharedRng = result.sharedRng
    return result
  }
  const input = (sourcePosition, actorSeed = 1, itemIdSource = itemIds) => ({
    actorSeed,
    arena: {
      disableMask: 0,
      itemLevelMaximum: 9_999,
      itemLevelMinimum: -9_999,
      lastSuccessfulItemLevel,
      level: 12,
      mode: 1,
      specialSuppression: false,
    },
    dropDelayContext: 0,
    explicitGoldAmount: null,
    inventoryHasHealthPotion: false,
    itemIds: itemIdSource,
    key: { current: source.nextKeyDropLevel, level: 12, remaining: 0 },
    nearbyMaskTwoCount: 0,
    participant: {
      advancedUnlocks: new Array(8).fill(false),
      level: 12,
      modifiers: NATIVE_LOOT_DEFAULT_MODIFIERS,
      ownedRecipeIndexes: [],
      slot: 0,
    },
    placement: NATIVE_LOOT_OPEN_PLACEMENT,
    policies: ALL_DISABLED,
    sceneForcesHealthPotion: false,
    sharedRng,
    sourcePosition,
    worldBadguyCount: 0,
    worldHasHealthPotionSack: false,
  })

  const gold = accept(materializeNativeLootScriptAction(
    input(positions.gold),
    { amount: 10, kind: 'drop-gold' },
  ))
  const potion = accept(materializeNativeLootScriptAction(
    input(positions.potion),
    { kind: 'drop-potion', subtype: 0 },
  ))
  const ring = accept(ordinaryEnemyItemRoll(input, positions.ring, 'ring'))
  const robe = accept(ordinaryEnemyItemRoll(input, positions.robe, 'robe'))
  const healthOrb = accept(forcedRoll(
    input,
    positions.healthOrb,
    'orb',
    (drop) => drop.orbKind === 'health',
  ))
  const manaOrb = accept(forcedRoll(
    input,
    positions.manaOrb,
    'orb',
    (drop) => drop.orbKind === 'mana',
  ))
  const powerup = accept(forcedSharedRoll(
    input,
    positions.powerup,
    'powerup',
    (drop) => drop.bonusKind === 2,
  ))
  assert.equal(gold.drops.length, 1)
  assert.equal(potion.drops.length, 1)
  assert.equal(ring.drops.length, 1)
  assert.equal(robe.drops.length, 1)
  assert.equal(healthOrb.drops.length, 1)
  assert.equal(manaOrb.drops.length, 1)
  assert.equal(powerup.drops.length, 1)
  return {
    drops: Object.freeze(drops),
    lastSuccessfulItemLevel,
    nextItemId: itemIds.peek(),
    ringItem: ring.drops[0].item,
    robeItem: robe.drops[0].item,
    sharedRng,
  }
}

function ordinaryEnemyItemRoll(input, sourcePosition, equipmentType) {
  const sharedSeed = equipmentType === 'ring' ? 7 : 6
  const base = input(sourcePosition, 110)
  const result = rollNativeEnemyLoot({
    ...base,
    arena: {
      ...base.arena,
      lastSuccessfulItemLevel: 10,
      level: 10,
      mode: 0,
    },
    policies: {
      gold: 0,
      item: 0,
      orb: 0,
      potion: 0,
      powerup: 0,
      specificItem: 0,
    },
    sharedRng: createNativeRng(sharedSeed),
  })
  assert.equal(result.selectedCategory, 'item')
  assert.equal(result.drops.length, 1)
  assert.equal(result.drops[0].kind, 'sack')
  assert.equal(result.drops[0].source, 'enemy')
  assert.equal(result.drops[0].item?.equipmentType, equipmentType)
  assert.equal(result.drops[0].item?.recipeIndex, null)
  return result
}

function forcedRoll(input, sourcePosition, category, matches) {
  const policies = { ...ALL_DISABLED, [category]: 3 }
  for (let actorSeed = 0; actorSeed < 10_000; actorSeed += 1) {
    const probe = rollNativeEnemyLoot({
      ...input(sourcePosition, actorSeed, createNativeLootItemIds(1)),
      policies,
    })
    if (!matches(probe.drops[0])) continue
    const result = rollNativeEnemyLoot({ ...input(sourcePosition, actorSeed), policies })
    assert.equal(result.selectedCategory, category)
    return result
  }
  throw new Error(`Could not find a deterministic ${category} browser proof seed`)
}

function forcedSharedRoll(input, sourcePosition, category, matches) {
  const policies = { ...ALL_DISABLED, [category]: 3 }
  for (let seed = 1; seed < 10_000; seed += 1) {
    const seededRng = createNativeRng(seed)
    const probe = rollNativeEnemyLoot({
      ...input(sourcePosition, 0, createNativeLootItemIds(1)),
      policies,
      sharedRng: seededRng,
    })
    if (!matches(probe.drops[0])) continue
    const result = rollNativeEnemyLoot({
      ...input(sourcePosition, 0),
      policies,
      sharedRng: seededRng,
    })
    assert.equal(result.selectedCategory, category)
    return result
  }
  throw new Error(`Could not find a deterministic shared ${category} browser proof seed`)
}

function spawnProofDrops(host, materialized) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const sourceActorCount = state.world.loot.actors.length
  const prepared = {
    ...state.world.loot,
    lastSuccessfulItemLevel: materialized.lastSuccessfulItemLevel,
    nextItemId: materialized.nextItemId,
    sharedRng: materialized.sharedRng,
  }
  const result = spawnBoneyardLootSpecs(prepared, materialized.drops, state.tick)
  const actors = result.store.actors.slice(sourceActorCount)
  assert.equal(actors.length, 7)
  Object.assign(state, { world: { ...state.world, loot: result.store } })
  return {
    actors,
    gold: actors[0],
    healthOrb: actors[4],
    ids: new Set(actors.map(({ id }) => id)),
    manaOrb: actors[5],
    potion: actors[1],
    powerup: actors[6],
    rejectedCount: result.rejectedCount,
    ring: actors[2],
    robe: actors[3],
  }
}

async function proveCanonicalPickupContention({
  guestPage,
  guestPlayerId,
  host,
  hostPage,
  hostPlayerId,
  position,
}) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  assert.equal(state.playerEntities.identities[0]?.playerId, hostPlayerId)
  const itemIds = createNativeLootItemIds(state.world.loot.nextItemId)
  const materialized = materializeNativeLootScriptAction({
    actorSeed: 0,
    arena: {
      disableMask: 0,
      itemLevelMaximum: 9_999,
      itemLevelMinimum: -9_999,
      lastSuccessfulItemLevel: state.world.loot.lastSuccessfulItemLevel,
      level: 12,
      mode: 1,
      specialSuppression: false,
    },
    dropDelayContext: 0,
    explicitGoldAmount: null,
    inventoryHasHealthPotion: false,
    itemIds,
    key: {
      current: state.world.loot.nextKeyDropLevel,
      level: 12,
      remaining: 0,
    },
    nearbyMaskTwoCount: 0,
    participant: {
      advancedUnlocks: new Array(8).fill(false),
      level: 12,
      modifiers: NATIVE_LOOT_DEFAULT_MODIFIERS,
      ownedRecipeIndexes: [],
      slot: 0,
    },
    placement: NATIVE_LOOT_OPEN_PLACEMENT,
    policies: ALL_DISABLED,
    sceneForcesHealthPotion: false,
    sharedRng: state.world.loot.sharedRng,
    sourcePosition: position,
    worldBadguyCount: 0,
    worldHasHealthPotionSack: false,
  }, { amount: 1, kind: 'drop-gold' })
  assert.equal(materialized.drops.length, 1)
  const spawned = spawnBoneyardLootSpecs({
    ...state.world.loot,
    nextItemId: itemIds.peek(),
    sharedRng: materialized.sharedRng,
  }, materialized.drops, state.tick)
  assert.equal(spawned.rejectedCount, 0)
  const actor = spawned.store.actors.at(-1)
  assert.ok(actor)
  Object.assign(state, { world: { ...state.world, loot: spawned.store } })
  movePlayer(host, hostPlayerId, point(position, -100, 0))
  movePlayer(host, guestPlayerId, point(position, 100, 0))
  await waitForLootCount(hostPage, 1)
  await waitForLootCount(guestPage, 1)
  await waitUntil(() => settled(host, new Set([actor.id])), (
    'contention Gold actor did not settle'
  ))

  const before = {
    guest: getPlayerEconomy(host.state(), guestPlayerId).gold,
    host: getPlayerEconomy(host.state(), hostPlayerId).gold,
  }
  movePlayer(host, hostPlayerId, point(position, -25, 0))
  movePlayer(host, guestPlayerId, point(position, 25, 0))
  await waitForPickup(host, actor.id)
  await waitUntil(() => (
    getPlayerEconomy(host.state(), hostPlayerId).gold === before.host + 1
  ), 'canonical first participant did not receive contested Gold')
  assert.equal(getPlayerEconomy(host.state(), guestPlayerId).gold, before.guest)
  await waitForLootCount(hostPage, 0)
  await waitForLootCount(guestPage, 0)
  return {
    actorId: actor.id,
    guestGoldAfter: getPlayerEconomy(host.state(), guestPlayerId).gold,
    guestGoldBefore: before.guest,
    hostGoldAfter: getPlayerEconomy(host.state(), hostPlayerId).gold,
    hostGoldBefore: before.host,
    winnerPlayerId: hostPlayerId,
  }
}

async function proveTerminalBonusFade({
  guestPage,
  guestPlayerId,
  host,
  hostPage,
  hostPlayerId,
  position,
}) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  movePlayer(host, hostPlayerId, point(position, -250, 0))
  movePlayer(host, guestPlayerId, point(position, 250, 0))
  const spawnedAtTick = state.tick
  const spawned = spawnBoneyardLootSpecs(state.world.loot, [{
    activationDelayTicks: 0,
    bonusKind: 2,
    id: 0,
    kind: 'bonus',
    nativeTypeId: 2038,
    phase: 0,
    position,
    source: 'script',
  }], spawnedAtTick)
  assert.equal(spawned.rejectedCount, 0)
  const actor = spawned.store.actors.at(-1)
  assert.ok(actor)
  Object.assign(state, { world: { ...state.world, loot: spawned.store } })
  await Promise.all([
    waitForLootCount(hostPage, 1),
    waitForLootCount(guestPage, 1),
  ])
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard'
      && !world.loot.actors.some(({ id }) => id === actor.id)
  }, 'terminal Bonus did not retire on its native lifetime', 30_000)
  await Promise.all([
    waitForLootCount(hostPage, 0),
    waitForLootCount(guestPage, 0),
  ])
  const retiredAtTick = host.state().tick
  assert.ok(retiredAtTick - spawnedAtTick >= 1_300)
  for (const page of [hostPage, guestPage]) {
    assert.equal(await page.locator('.game-runtime-error').count(), 0)
    assert.equal(await page.locator('.boneyard-scene[data-renderer-state="ready"]').count(), 1)
  }
  return {
    actorId: actor.id,
    elapsedTicks: retiredAtTick - spawnedAtTick,
    expectedTerminalAlpha: 6.705522537231445e-7,
    guestSceneReady: true,
    hostSceneReady: true,
  }
}

function movePlayer(host, playerId, position) {
  const state = host.state()
  const player = getPlayerCharacter(state, playerId)
  Object.assign(state, {
    playerEntities: replacePlayerCharacter(state.playerEntities, playerId, {
      ...player,
      position: { ...position },
      velocity: { x: 0, y: 0 },
    }),
  })
}

function arenaCenter(bounds) {
  return {
    x: Math.fround(bounds.x + bounds.w / 2),
    y: Math.fround(bounds.y + bounds.h / 2),
  }
}

function point(origin, x, y) {
  return Object.freeze({ x: Math.fround(origin.x + x), y: Math.fround(origin.y + y) })
}

function settled(host, ids) {
  const world = host.state().world
  if (world.kind !== 'boneyard') return false
  const actors = world.loot.actors.filter(({ id }) => ids.has(id))
  return actors.length === ids.size && actors.every((actor) => (
    actor.kind === 'gold'
      ? !actor.scatterActive && actor.activationDelayTicks < 1
      : actor.kind === 'sack'
        ? actor.bounceVelocity === 0 && actor.activationDelayTicks < 1
        : actor.alpha >= 1
  ))
}

async function waitForPickup(host, actorId) {
  await waitUntil(() => {
    const world = host.state().world
    return world.kind === 'boneyard'
      && !world.loot.actors.some(({ id }) => id === actorId)
  }, `loot actor ${actorId} was not picked up`)
}

async function waitForLootCount(page, count) {
  await page.bringToFront()
  await page.waitForFunction((expected) => (
    document.querySelector('.boneyard-world-canvas')?.dataset.lootCount === `${expected}`
  ), count, { timeout: 30_000 })
}

function backpackKindQuantity(host, playerId, kind) {
  return getPlayerEconomy(host.state(), playerId).backpack
    .filter((item) => item.kind === kind)
    .reduce((total, item) => total + item.quantity, 0)
}

function backpackNameCount(host, playerId, name) {
  return getPlayerEconomy(host.state(), playerId).backpack
    .filter((item) => item.name === name).length
}

function nextLootEffectId(host) {
  const world = host.state().world
  if (world.kind !== 'boneyard') throw new Error('loot effect proof left the Boneyard')
  return world.loot.nextEffectId
}

async function waitForBitmapMessage(page, text) {
  const message = page.locator(`.boneyard-loot-messages > span[aria-label=${JSON.stringify(text)}]`)
  await message.waitFor({ timeout: 5_000 })
  const receipt = await message.evaluate((node) => {
    const glyphs = [...node.querySelectorAll('.boneyard-loot-bitmap-text > i')]
    return {
      glyphCount: glyphs.length,
      maskImage: glyphs[0] ? getComputedStyle(glyphs[0]).maskImage : 'none',
      opacity: getComputedStyle(node).opacity,
      text: node.getAttribute('aria-label'),
      transform: getComputedStyle(node).transform,
    }
  })
  assert.ok(receipt.glyphCount > 0)
  assert.notEqual(receipt.maskImage, 'none')
  return receipt
}

async function waitForAudio(page, stem) {
  await waitForAudioCount(page, stem, 1)
}

async function waitForAnyAudio(page, stems) {
  await page.waitForFunction((expectedStems) => expectedStems.some((stem) => (
    window.__sdrAudioEvents.some((event) => (
      (event.type === 'buffer-start' || event.type === 'play')
      && window.__sdrAudioSourceMatches(event.src, `/game/audio/sfx/${stem}.wav`)
    ))
  )), stems, { timeout: 10_000 })
}

async function waitForAudioCount(page, stem, count) {
  await page.waitForFunction(({ expectedCount, expectedStem }) => (
    window.__sdrAudioEvents.filter((event) => (
      (event.type === 'buffer-start' || event.type === 'play')
      && window.__sdrAudioSourceMatches(event.src, `/game/audio/sfx/${expectedStem}.wav`)
    )).length >= expectedCount
  ), { expectedCount: count, expectedStem: stem }, { timeout: 10_000 })
}

async function lootAudioReceipt(page) {
  return page.evaluate(() => Object.fromEntries([
    'drop-bag-1',
    'drop-bag-2',
    'drop-coins',
    'drop-potion',
    'goto-orb',
    'pickup-bag',
    'pickup-coin',
  ].map((stem) => [stem, window.__sdrAudioEvents.filter((event) => (
    (event.type === 'buffer-start' || event.type === 'play')
    && window.__sdrAudioSourceMatches(event.src, `/game/audio/sfx/${stem}.wav`)
  )).length])))
}

async function waitUntil(predicate, message, timeoutMs = 10_000) {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

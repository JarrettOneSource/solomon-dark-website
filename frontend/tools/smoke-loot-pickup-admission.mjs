import assert from 'node:assert/strict'
import { join } from 'node:path'
import { DOWSING_EQUIPMENT_RECIPES, createEquipmentInventoryItem } from '../src/game/core-kernels/hub-economy.ts'
import { createNativeLootItemIds, miscItem } from '../src/game/core-kernels/native-loot-items.ts'
import { createBoneyardLootStore } from '../src/game/core-server/boneyard-loot-store.ts'
import { createBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'

export async function provePickupAdmission({ host, hostPage, guestPage, hostPlayerId, guestPlayerId,
  position, movePlayer, waitUntil, waitForLootCount, spawnAuthoritativeLootSpecs,
  screenshotRoot, wires, soundCount }) {
  movePlayer(host, hostPlayerId, position)
  movePlayer(host, guestPlayerId, { x: position.x + 300, y: position.y + 300 })
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  const economy = getPlayerEconomy(state, hostPlayerId)
  const ring = { ...createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES.find(recipe =>
    recipe.type === 'ring' && recipe.level === 0), 40_000), inventorySlot: 0 }
  const ids = createNativeLootItemIds(100)
  const backpack = [ring, ...Array.from({ length: 2047 }, (_, index) => ({
    ...miscItem(ids, 1), inventorySlot: index + 1,
  }))]
  Object.assign(state, {
    playerEntities: replacePlayerEconomy(state.playerEntities, hostPlayerId, {
      ...economy, backpack, nextItemId: 50_000, revision: economy.revision + 1,
      equipment: { ...economy.equipment, rings: [null, null, null] },
    }),
    world: { ...state.world, waves: null, encounter: null, arenaTransition: null,
      enemies: createBoneyardEnemyStore('pickup-admission-browser'),
      loot: createBoneyardLootStore('pickup-admission-browser'), lootEvents: [] },
  })
  const item = { ...miscItem(createNativeLootItemIds(90_000), 1), name: 'Retained Admission Key' }
  const spawned = spawnAuthoritativeLootSpecs(state, state.world.loot, [{
    activationDelayTicks: 0, id: 1, item, kind: 'sack', nativeTypeId: 2013,
    phase: 0, position: { x: position.x - 25, y: position.y + 10 }, source: 'script',
  }], state.tick)
  assert.equal(spawned.rejectedCount, 0)
  Object.assign(state, { world: { ...state.world, loot: spawned.store } })
  const actorId = spawned.store.actors[0].id
  const startTick = host.state().tick
  const beforeAudio = await soundCount(hostPage, '/game/audio/sfx/pickup-bag.wav')
  await Promise.all([waitForLootCount(hostPage, 1), waitForLootCount(guestPage, 1)])
  await waitUntil(() => host.state().tick >= startTick + 100, 'retained carrier did not run for 100 ticks')
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).backpack.length, 2048)
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).nextItemId, 50_000)
  assert.deepEqual(host.state().world.loot.actors[0].item, item)
  assert.equal(host.state().world.loot.actors[0].id, actorId)
  assert.equal(host.state().world.lootEvents.some(event => event.type === 'loot-pickup'), false)
  assert.equal(await soundCount(hostPage, '/game/audio/sfx/pickup-bag.wav'), beforeAudio)
  await waitUntil(() => wires.every(wire => wire.snapshot?.world.kind === 'boneyard'
    && wire.snapshot.world.loot.some(actor => actor.id === actorId)), 'both clients must receive retained carrier')
  const retainedAtTick = host.state().tick
  await hostPage.bringToFront()
  await hostPage.screenshot({ path: join(screenshotRoot, 'full-backpack-retained.png') })

  await hostPage.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = hostPage.getByRole('dialog', { name: 'Inventory', exact: true })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  await hostPage.screenshot({ path: join(screenshotRoot, 'full-backpack-inventory.png') })
  const source = inventory.locator('[data-inventory-owner="backpack"][data-inventory-item-id="40000"]').first()
  const target = inventory.locator('[data-equipment-slot="ring-0"]').first()
  const from = await source.boundingBox(), to = await target.boundingBox()
  assert.ok(from); assert.ok(to)
  const feedbackSequence = getPlayerEconomy(host.state(), hostPlayerId).actionFeedback?.sequence ?? 0
  await hostPage.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await hostPage.mouse.down()
  await hostPage.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await hostPage.mouse.up()
  await waitUntil(() => getPlayerEconomy(host.state(), hostPlayerId).equipment.rings[0]?.id === ring.id,
    'normal inventory drag did not equip the ring and free its root slot')
  assert.ok(getPlayerEconomy(host.state(), hostPlayerId).actionFeedback.sequence > feedbackSequence)
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).actionFeedback.accepted, true)
  await inventory.getByRole('button', { name: 'Close inventory', exact: true }).click()
  await inventory.waitFor({ state: 'hidden' })
  await waitUntil(() => !host.state().world.loot.actors.some(actor => actor.id === actorId),
    'carrier did not transfer after the ordinary inventory action freed capacity')
  await Promise.all([waitForLootCount(hostPage, 0), waitForLootCount(guestPage, 0)])
  const picked = getPlayerEconomy(host.state(), hostPlayerId).backpack.filter(entry => entry.name === item.name)
  assert.equal(picked.length, 1)
  assert.equal(picked[0].id, 50_000)
  assert.equal(picked[0].inventorySlot, 0)
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).backpack.length, 2048)
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).nextItemId, 50_001)
  assert.equal(getPlayerEconomy(host.state(), guestPlayerId).backpack.some(entry => entry.name === item.name), false)
  await waitUntil(async () => await soundCount(hostPage, '/game/audio/sfx/pickup-bag.wav') === beforeAudio + 1,
    'accepted pickup must play its ordinary bag sound exactly once')
  const acceptedAtTick = host.state().tick
  await hostPage.screenshot({ path: join(screenshotRoot, 'full-backpack-collected.png') })
  await waitUntil(() => host.state().tick >= acceptedAtTick + 100, 'post-pickup stability window did not advance')
  assert.equal(await soundCount(hostPage, '/game/audio/sfx/pickup-bag.wav'), beforeAudio + 1)
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).nextItemId, 50_001)
  assert.equal(getPlayerEconomy(host.state(), hostPlayerId).backpack.filter(entry => entry.name === item.name).length, 1)
  assert.deepEqual(wires.map(wire => wire.errors), [[], []])
  return { actorId, startTick, retainedAtTick, acceptedAtTick, finalTick: host.state().tick,
    rootEntries: 2048, transferredItemId: picked[0].id, transferredSlot: picked[0].inventorySlot,
    ordinaryAction: 'drag backpack ring to ring-0', pickupAudioDelta: 1,
    bothClientsRetainedAndRetired: true, wireErrors: wires.map(wire => wire.errors),
    screenshots: ['full-backpack-retained.png', 'full-backpack-collected.png'] }
}

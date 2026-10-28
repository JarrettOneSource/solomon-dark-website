import assert from 'node:assert/strict'
import { join } from 'node:path'
import { buyHagathaPerk } from '../src/game/core-kernels/hub-economy.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { createBoneyardWaveDirector } from '../src/game/core-kernels/boneyard-wave-director.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { createBoneyardLootStore } from '../src/game/core-server/boneyard-loot-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { getPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { openBoneyardCombat } from './game-smoke-navigation.mjs'

/** Conditional native seed witnesses, not random run trials or forced Item policies. */
export async function proveItemCharm({
  host, hostPage, guestPage, hostPlayerId, guestPlayerId, position,
  movePlayer, waitUntil, screenshotRoot, wires,
}) {
  await openBoneyardCombat(host, hostPlayerId)
  const initial = host.state(), world = initial.world
  assert.equal(world.kind, 'boneyard')
  const center = resolveBoneyardSpawnPosition(position, world.bounds, world.collision, 60)
  const observers = [-180, 180].map(offset => resolveBoneyardSpawnPosition(
    { x: center.x + offset, y: center.y }, world.bounds, world.collision, 25,
  ))
  // Fix wave/level to avoid unrelated encounter and level-up interruptions.
  // Actual death selection, charm ownership, loot and pickup run normally.
  Object.assign(initial, { playerEntities: { ...initial.playerEntities,
    progressions: initial.playerEntities.progressions.map(row => ({ ...row, level: 75 })),
  }, world: { ...world, encounter: { ...world.encounter, phase: 'gone', targetPlayerId: null },
    enemies: createBoneyardEnemyStore('item-charm-browser'), enemyEvents: [],
    loot: createBoneyardLootStore('item-charm-browser'), lootEvents: [],
    waves: { ...createBoneyardWaveDirector('item-charm-fixture'),
      phase: 'interwave', interwaveDelayTicks: 100000, waveOrdinal: 10 },
  } })
  const receipts = []
  const resetPositions = () => {
    movePlayer(host, hostPlayerId, observers[0])
    movePlayer(host, guestPlayerId, observers[1])
  }
  resetPositions()
  purchaseFixtureCharm(host, hostPlayerId, true)
  purchaseFixtureCharm(host, guestPlayerId, false)
  receipts.push(await death('other-player-charm', 2535, false))
  purchaseFixtureCharm(host, hostPlayerId, false)
  purchaseFixtureCharm(host, guestPlayerId, true)
  receipts.push(await death('charmed-native-miss', 0, false))
  receipts.push(await death('credited-player-charm', 2535, true))
  const sack = host.state().world.loot.actors.find(actor => actor.kind === 'sack')
  assert.ok(sack?.item?.kind === 'equipment')
  const item = sack.item
  const firstBefore = getPlayerEconomy(host.state(), hostPlayerId).backpack
  const guestEconomy = getPlayerEconomy(host.state(), guestPlayerId)
  const guestBefore = guestEconomy.backpack
  const inventoryItemId = guestEconomy.nextItemId
  assert.ok(guestBefore.every(row => row.id !== inventoryItemId))
  movePlayer(host, guestPlayerId, resolveBoneyardSpawnPosition(sack.position, world.bounds, world.collision, 25))
  await waitUntil(() => getPlayerEconomy(host.state(), guestPlayerId).backpack.some(row => row.id === inventoryItemId),
    'Guest did not collect its naturally selected Item')
  const collected = getPlayerEconomy(host.state(), guestPlayerId).backpack
  assert.equal(collected.length, guestBefore.length + 1)
  assert.equal(collected.filter(row => row.id === inventoryItemId).length, 1)
  assert.equal(collected.find(row => row.id === inventoryItemId).name, item.name)
  assert.deepEqual(collected.find(row => row.id === inventoryItemId).nativeEffects, item.nativeEffects)
  assert.deepEqual(getPlayerEconomy(host.state(), hostPlayerId).backpack, firstBefore)
  await waitUntil(() => wires.every(wire => wire.snapshot?.world.kind === 'boneyard'
    && !wire.snapshot.world.loot.some(row => row.id === sack.id)), 'Both clients must retire the picked-up Sack')
  await guestPage.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = guestPage.getByRole('dialog', { name: 'Inventory' })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  const cell = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${inventoryItemId}"]`)
  await cell.click()
  await cell.locator('xpath=self::*[@data-selected="true"]').waitFor()
  await inventory.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]').waitFor()
  await guestPage.screenshot({ path: join(screenshotRoot, 'item-charm-collected-equipment.png') })
  for (let page = 0; page < 2; page += 1) {
    await inventory.getByRole('button', { name: 'Next player stats page' }).click()
    await inventory.locator(`xpath=self::*[@data-native-stats-page="${page + 1}"]`).waitFor()
  }
  await inventory.getByRole('button', { name: 'Inspect ITEM CHARM' }).waitFor()
  assert.equal(await inventory.getByRole('button', { name: 'Remove ITEM CHARM' }).count(), 0)
  await guestPage.screenshot({ path: join(screenshotRoot, 'item-charm-boneyard-inspection.png') })
  assert.ok(getPlayerEconomy(host.state(), guestPlayerId).ownedPerkSelectors.includes(3))
  await inventory.locator('[data-inventory-resume="true"]').click()
  await inventory.waitFor({ state: 'hidden' })
  purchaseFixtureCharm(host, guestPlayerId, false)
  resetPositions()
  receipts.push(await death('same-seed-without-charm', 2535, false))
  for (const wire of wires) assert.deepEqual(wire.errors, [])
  return { receipts, collectedItem: { name: item.name, nativeTypeId: item.nativeTypeId },
    replicatedToTwoClients: true, inventoryPickupCount: 1, boneyardInspectionOnly: true,
    otherPlayerInventoryUnchanged: true,
    fixture: 'Wave10/player75; actor seeds0/2535 and shared RNG100; ordinary policies; economic purchase API; College-only removal verified separately',
  }

  async function death(name, actorSeed, expectItem) {
    resetPositions()
    const state = host.state(), order = createNativeWorldManagerOrder(state.worldManagerOrder)
    const players = Object.fromEntries(state.playerEntities.identities.map(({ playerId }) => [playerId, {
      alive: true, collisionRadius: 25, connected: true, eligible: true,
      position: getPlayerCharacter(state, playerId).position, velocityPerTick: { x: 0, y: 0 },
    }]))
    const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore(`item-charm-${name}-${state.tick}`), {
      projectileWorldBlocked: () => false, players, registerWorldPainter: order.register,
      resolveMovement: ({ requestedPosition }) => requestedPosition,
      resolveSpawnIntents: () => [{ enemyToken: 'SKELETON', flags: [], id: 1,
        locationPolicy: 'anywhere', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
        position: center, spawnTick: state.tick, waveOrdinal: 10 }],
      rollLootSeed: () => actorSeed, tick: state.tick,
    })
    const enemy = spawned.store.actors[0]
    assert.ok(enemy)
    assert.equal(enemy.lootSeed, actorSeed)
    const killed = damageBoneyardEnemy(spawned.store, { actorId: enemy.id,
      amount: enemy.currentHealth, sourcePlayerId: guestPlayerId, tick: state.tick,
      registerWorldPainter: order.register })
    assert.equal(killed.killed, true)
    Object.assign(state, { world: { ...state.world, enemies: killed.store, enemyEvents: [],
      loot: { ...createBoneyardLootStore(`item-charm-loot-${name}`), sharedRng: createNativeRng(100) },
      lootEvents: [],
    }, worldManagerOrder: order.state() })
    const startTick = state.tick
    await waitUntil(() => host.state().tick > startTick && host.state().world.enemies.actors.length === 0,
      'Native death reward did not finish')
    const current = host.state()
    const items = current.world.loot.actors.filter(row => row.kind === 'sack' && row.item?.kind === 'equipment')
    assert.equal(items.length, Number(expectItem), name)
    if (expectItem) {
      const actor = items[0]
      assert.equal(actor.source, 'enemy')
      assert.equal(current.world.loot.lastSuccessfulItemLevel, 10)
      await waitUntil(() => wires.every(wire => wire.snapshot?.world.kind === 'boneyard'
        && wire.snapshot.world.loot.some(row => row.id === actor.id && row.itemNativeTypeId === actor.item.nativeTypeId)),
      'Both clients must receive the actual Item Sack')
      for (const page of [hostPage, guestPage]) {
        await page.waitForFunction(() => Number(document.querySelector('.boneyard-world-canvas')?.dataset.lootCount) > 0)
        assert.equal(await page.locator('.boneyard-world-canvas').evaluate(node =>
          (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name), 'WebGL2RenderingContext')
      }
      await guestPage.screenshot({ path: join(screenshotRoot, `${name}-ground.png`) })
    }
    return { name, actorSeed, itemCount: items.length,
      creditedPlayerId: guestPlayerId,
      hostCharm: getPlayerEconomy(current, hostPlayerId).ownedPerkSelectors.includes(3),
      killerCharm: getPlayerEconomy(current, guestPlayerId).ownedPerkSelectors.includes(3),
      itemName: items[0]?.item.name ?? null }
  }
}

function purchaseFixtureCharm(host, playerId, enabled) {
  const state = host.state(), economy = getPlayerEconomy(state, playerId)
  const source = { ...economy, gold: 10000, ownedPerkSelectors: [] }
  const bought = enabled ? buyHagathaPerk(source, 3) : null
  if (bought) assert.equal(bought.accepted, true)
  const result = bought?.state ?? source
  Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
    ...result, revision: economy.revision + 1,
  }) })
}


export async function proveItemCharmCollege({ host, page, playerId, waitUntil, screenshotRoot }) {
  assert.equal(host.state().world.kind, 'hub')
  purchaseFixtureCharm(host, playerId, true)
  await page.getByRole('button', { name: /Open inventory/ }).click()
  const inventory = page.getByRole('dialog', { name: 'Inventory' })
  await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
  for (let next = 1; next <= 2; next += 1) {
    await inventory.getByRole('button', { name: 'Next player stats page' }).click()
    await inventory.locator(`xpath=self::*[@data-native-stats-page="${next}"]`).waitFor()
  }
  const before = getPlayerEconomy(host.state(), playerId)
  assert.ok(before.ownedPerkSelectors.includes(3))
  const remove = inventory.getByRole('button', { name: 'Remove ITEM CHARM' })
  await remove.waitFor()
  await page.screenshot({ path: join(screenshotRoot, 'item-charm-college-before-removal.png') })
  await remove.click()
  await remove.waitFor({ state: 'detached' })
  await waitUntil(() => !getPlayerEconomy(host.state(), playerId).ownedPerkSelectors.includes(3),
    'College removal did not reach the authority')
  const after = getPlayerEconomy(host.state(), playerId)
  assert.equal(after.gold, before.gold)
  assert.deepEqual(after.backpack, before.backpack)
  await page.screenshot({ path: join(screenshotRoot, 'item-charm-college-after-removal.png') })
  await inventory.locator('[data-inventory-resume="true"]').click()
  await inventory.waitFor({ state: 'hidden' })
  return { scene: 'hub', removedThroughInventory: true, goldUnchanged: true, backpackUnchanged: true }
}

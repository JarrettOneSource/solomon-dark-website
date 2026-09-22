import assert from 'node:assert/strict'
import { join } from 'node:path'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { nativeFacultyRecipe } from '../src/game/core-kernels/native-survival-faculty.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { getPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'

export async function proveDireBossDrops({
  host, hostPage, guestPage, hostPlayerId, guestPlayerId, position,
  movePlayer, waitUntil, screenshotRoot, wires,
}) {
  const initial = host.state()
  const world = initial.world
  assert.equal(world.kind, 'boneyard')
  const sourceSha256 = world.waves.bossEncounters.find(row => row.kind === 'faculty').sourceSha256
  const center = resolveBoneyardSpawnPosition(position, world.bounds, world.collision, 60)
  const observers = [-150, 150].map(offset => resolveBoneyardSpawnPosition(
    { x: center.x + offset, y: center.y }, world.bounds, world.collision, 25,
  ))
  // Keep repeated boss rewards from opening an unrelated mandatory level-up modal.
  Object.assign(initial, { playerEntities: { ...initial.playerEntities,
    progressions: initial.playerEntities.progressions.map(progression => ({ ...progression, level: 75 })),
  }, world: {
    ...world, encounter: { ...world.encounter, phase: 'gone', targetPlayerId: null },
    enemies: createBoneyardEnemyStore('dire-loot-browser'), enemyEvents: [],
    loot: { ...world.loot, actors: [], effects: [], goodies: [] }, lootEvents: [],
    waves: { ...world.waves, phase: 'interwave', interwaveDelayTicks: 100_000,
      waveOrdinal: 1, portalScriptPhase: 'retired', slumpgutPhase: 'retired',
      bossEncounters: world.waves.bossEncounters.map(row => ({ ...row, phase: 'retired' })) },
  } })
  const receipts = []
  for (const [name, expected] of [
    ['Dire Sirmin', [11, 12, 13, 14, 15]],
    ['Dire Lucritius', [20, 21, 3]],
    ['Dire Aliss', [16, 17, 18, 19]],
  ]) {
    const state = host.state()
    const economy = getPlayerEconomy(state, hostPlayerId)
    Object.assign(state, { playerEntities: replacePlayerEconomy(state.playerEntities, hostPlayerId, {
      ...economy, backpack: [], revision: economy.revision + 1,
    }) })
    const collectedRecipes = []
    for (let member = 0; member < expected.length; member += 1) {
      movePlayer(host, hostPlayerId, observers[0])
      movePlayer(host, guestPlayerId, observers[1])
      const guestBefore = getPlayerEconomy(host.state(), guestPlayerId).backpack
      const { actorId, killedAt } = killFaculty(host, hostPlayerId, sourceSha256, name, center)
      await waitUntil(() => host.state().world.loot.actors.some(actor => actor.kind === 'sack'),
        `${name}: death did not materialize an Item`, 20_000)
      const afterDeath = host.state()
      assert.ok(afterDeath.tick - killedAt >= 250, 'Faculty must retain its complete native death clock')
      assert.ok(!afterDeath.world.enemies.actors.some(actor => actor.id === actorId))
      const sacks = afterDeath.world.loot.actors.filter(actor => actor.kind === 'sack')
      assert.equal(sacks.length, 1)
      const sack = sacks[0]
      const item = sack.item
      assert.equal(sack.source, 'enemy')
      assert.ok(expected.includes(item.recipeIndex), `${name}: unrelated ${item.name}`)
      assert.ok(!collectedRecipes.includes(item.recipeIndex), `${name}: repeated before pool completion`)
      assert.ok(afterDeath.world.loot.actors.some(actor => actor.kind === 'gold'), 'supplemental Gold missing')
      await waitUntil(() => wires.every(({ snapshot, errors }) => {
        assert.deepEqual(errors, [])
        return snapshot?.world.kind === 'boneyard' && snapshot.world.loot.some(actor => actor.id === sack.id)
      }), 'both clients must receive the Sack')
      for (const wire of wires) {
        assert.deepEqual(wire.errors, [])
        const replicated = wire.snapshot.world.loot.find(actor => actor.id === sack.id)
        assert.equal(replicated.itemNativeTypeId, item.nativeTypeId)
        assert.equal(replicated.itemNativeSubtype, item.nativeSubtype)
        assert.equal(replicated.source, 'enemy')
      }
      for (const page of [hostPage, guestPage]) {
        await page.waitForFunction(() => Number(document.querySelector('.boneyard-world-canvas')?.dataset.lootCount) > 0)
        const context = await page.locator('.boneyard-world-canvas').evaluate(node => (
          (node.getContext('webgl2') || node.getContext('webgl'))?.constructor.name
        ))
        assert.equal(context, 'WebGL2RenderingContext')
      }
      if (member === 0) await hostPage.screenshot({ path: join(screenshotRoot, `${name}-ground.png`) })
      movePlayer(host, hostPlayerId, resolveBoneyardSpawnPosition(sack.position, world.bounds, world.collision, 25))
      await waitUntil(() => getPlayerEconomy(host.state(), hostPlayerId).backpack.some(candidate => candidate.recipeIndex === item.recipeIndex),
        `${name}: dropped item was not credited to inventory`)
      assert.equal(getPlayerEconomy(host.state(), hostPlayerId).backpack.filter(candidate => candidate.recipeIndex === item.recipeIndex).length, 1)
      const collected = getPlayerEconomy(host.state(), hostPlayerId).backpack.find(candidate => candidate.recipeIndex === item.recipeIndex)
      assert.equal(collected.name, item.name)
      assert.deepEqual(getPlayerEconomy(host.state(), guestPlayerId).backpack, guestBefore)
      await waitUntil(() => wires.every(({ snapshot }) => snapshot?.world.kind === 'boneyard'
        && !snapshot.world.loot.some(actor => actor.id === sack.id)), 'both clients must retire the collected Sack')
      collectedRecipes.push(item.recipeIndex)
      await hostPage.getByRole('button', { name: /Open inventory/ }).click()
      const inventory = hostPage.getByRole('dialog', { name: 'Inventory' })
      await inventory.locator('.hub-inventory-native-canvas[data-native-reveal="settled"]').waitFor()
      const cell = inventory.locator(`[data-inventory-owner="backpack"][data-inventory-item-id="${collected.id}"]`)
      await cell.click()
      await cell.locator('xpath=self::*[@data-selected="true"]').waitFor()
      await inventory.locator('.hub-inventory-native-canvas[data-native-item-info="visible"]').waitFor()
      await hostPage.screenshot({ path: join(screenshotRoot, `${name}-${item.recipeIndex}-inventory.png`) })
      await inventory.locator('[data-inventory-resume="true"]').click()
      await inventory.waitFor({ state: 'hidden' })
      const current = host.state()
      Object.assign(current, { world: { ...current.world,
        loot: { ...current.world.loot, actors: [], effects: [] },
      } })
    }
    assert.deepEqual(collectedRecipes.toSorted(), expected.toSorted())
    receipts.push({ name, collectedRecipes, nativeDeathTicks: 250, guestDuplicates: 0 })
  }
  return { sourceSha256, receipts, replicatedToTwoWebGL2Clients: true, inventoryItemInfoPanels: true }
}

function killFaculty(host, playerId, sourceSha256, name, position) {
  const state = host.state()
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const players = Object.fromEntries(state.playerEntities.identities.map(({ playerId: id }) => [id, {
    alive: true, collisionRadius: 25, connected: true, eligible: true,
    position: getPlayerCharacter(state, id).position, velocityPerTick: { x: 0, y: 0 },
  }]))
  const spawned = stepBoneyardEnemyStore({ ...state.world.enemies, lastStepTick: state.tick - 1 }, {
    projectileWorldBlocked: () => false, players, registerWorldPainter: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      authoredRecipe: nativeFacultyRecipe(sourceSha256, name), enemyToken: 'DIREFACULTY',
      flags: [], id: state.world.enemies.nextActorId, locationPolicy: 'anywhere', nativeTypeId: 1010,
      position, spawnTick: state.tick, waveOrdinal: 32,
    }],
    rollLootSeed: () => 1, tick: state.tick,
  })
  const enemy = spawned.store.actors.find(actor => actor.config.recipeName === name)
  assert.ok(enemy)
  const killed = damageBoneyardEnemy(spawned.store, {
    actorId: enemy.id, amount: enemy.currentHealth,
    registerWorldPainter: order.register, sourcePlayerId: playerId, tick: state.tick,
  })
  assert.equal(killed.killed, true)
  Object.assign(state, { world: { ...state.world, enemies: killed.store }, worldManagerOrder: order.state() })
  return { actorId: enemy.id, killedAt: state.tick }
}

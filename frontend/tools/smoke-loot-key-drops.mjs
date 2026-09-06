import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { createBoneyardLootStore } from '../src/game/core-server/boneyard-loot-store.ts'
import {
  createBoneyardEnemyStore, stepBoneyardEnemyStore,
} from '../src/game/core-server/boneyard-enemy-store.ts'
import { getPlayerCharacter, getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'

export async function proveKeyDrops({
  host, hostPage, guestPage, hostPlayerId, guestPlayerId, position,
  movePlayer, waitUntil, waitForLootCount, screenshotRoot, wires,
}) {
  const state = host.state()
  const world = state.world
  assert.equal(world.kind, 'boneyard')
  assert.ok(world.waves)
  assert.ok(world.encounter)
  assert.ok(world.arenaTransition)
  const chest = world.loot.goodies[0]
  assert.ok(chest)
  const loot = createBoneyardLootStore('browser-key-rates', [{
    eid: chest.eid,
    position: chest.position,
    rewardSeed: 13,
    sceneryRegistrationOrdinal: chest.sceneryRegistrationOrdinal,
    subtype: 0,
  }])
  const wave = loot.nextKeyDropLevel
  assert.equal(wave, 7)
  Object.assign(state, { world: {
    ...world,
    encounter: { ...world.encounter, phase: 'gone', targetPlayerId: null },
    enemies: createBoneyardEnemyStore('browser-key-rates'),
    enemyEvents: [],
    loot: { ...loot, sharedRng: createNativeRng(100) },
    lootEvents: [],
    waves: {
      ...world.waves,
      phase: 'interwave', interwaveDelayTicks: 100_000,
      portalScriptPhase: 'retired', slumpgutPhase: 'retired', waveOrdinal: wave,
    },
  } })
  movePlayer(host, hostPlayerId, { x: position.x - 150, y: position.y })
  movePlayer(host, guestPlayerId, { x: position.x + 150, y: position.y })
  const before = keyCount(host, hostPlayerId)
  const guestBefore = keyCount(host, guestPlayerId)

  killEnemy(host, hostPlayerId, position)
  await waitUntil(() => host.state().world.loot.actors.some(isKey),
    'ordinary enemy death did not produce the instruction-predicted Wizard Key')
  const key = host.state().world.loot.actors.find(isKey)
  assert.equal(key.source, 'enemy')
  const nextThreshold = host.state().world.loot.nextKeyDropLevel
  assert.ok(nextThreshold >= 15 && nextThreshold <= 25)
  await Promise.all([hostPage, guestPage].map((page) => waitForLootCount(page, 1)))
  await waitUntil(() => wires.every(({ snapshot }) => (
    snapshot?.world.kind === 'boneyard' && snapshot.world.loot.some(({ id }) => id === key.id)
  )), 'both clients did not receive the enemy Key')
  for (const wire of wires) {
    assert.deepEqual(wire.errors, [])
    const replicated = wire.snapshot.world.loot.find(({ id }) => id === key.id)
    assert.equal(replicated.itemNativeTypeId, 7012)
    assert.equal(replicated.itemNativeSubtype, 1)
    assert.equal(replicated.source, 'enemy')
  }
  await hostPage.screenshot({ path: join(screenshotRoot, 'enemy-key-visible.png') })

  killEnemy(host, hostPlayerId, { x: position.x + 75, y: position.y })
  await waitUntil(() => host.state().world.enemies.actors.length === 0,
    'second probe enemy did not retire')
  assert.equal(host.state().world.loot.actors.filter(isKey).length, 1)
  assert.equal(host.state().world.loot.nextKeyDropLevel, nextThreshold)
  movePlayer(host, hostPlayerId, key.position)
  await waitUntil(() => keyCount(host, hostPlayerId) === before + 1,
    'enemy Key was not credited through ground pickup')
  assert.equal(keyCount(host, guestPlayerId), guestBefore)

  const current = host.state()
  const player = getPlayerCharacter(current, hostPlayerId)
  Object.assign(current, { playerEntities: replacePlayerCharacter(
    current.playerEntities, hostPlayerId, {
      ...player, headingIndex: 0,
      position: { x: chest.position.x, y: chest.position.y + 35 },
      velocity: { x: 0, y: 0 },
    },
  ) })
  const unlock = hostPage.getByRole('button', { name: 'Unlock locked chest' })
  await unlock.waitFor({ state: 'visible' })
  await unlock.click()
  await waitUntil(() => host.state().world.loot.goodies[0].exhausted,
    'chest did not consume the dropped Key and finish opening')
  assert.equal(keyCount(host, hostPlayerId), before)
  assert.equal(keyCount(host, guestPlayerId), guestBefore)
  const rewardGold = host.state().world.loot.actors.filter(({ kind, source }) => (
    kind === 'gold' && source === 'goodie'
  ))
  assert.ok(rewardGold.length > 0)
  await hostPage.screenshot({ path: join(screenshotRoot, 'enemy-key-chest-open.png') })
  return {
    wave, actorSeed: 311, nextThreshold, keyId: key.id,
    keysFromTwoDeaths: 1, keyCollected: true, keyConsumed: true,
    chestExhausted: true, chestGoldActors: rewardGold.length,
    hostKeys: keyCount(host, hostPlayerId), guestKeys: keyCount(host, guestPlayerId),
  }
}

function isKey(actor) {
  return actor.item?.nativeTypeId === 7012 && actor.item.nativeSubtype === 1
}

function keyCount(host, playerId) {
  return getPlayerEconomy(host.state(), playerId).backpack
    .filter((item) => item.nativeTypeId === 7012 && item.nativeSubtype === 1)
    .reduce((count, item) => count + item.quantity, 0)
}

function killEnemy(host, playerId, position) {
  const state = host.state()
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const players = Object.fromEntries(state.playerEntities.identities.map(({ playerId: id }) => [id, {
    alive: true, collisionRadius: 25, connected: true, eligible: true,
    position: getPlayerCharacter(state, id).position, velocityPerTick: { x: 0, y: 0 },
  }]))
  const spawned = stepBoneyardEnemyStore({
    ...state.world.enemies,
    // Insert this probe between host ticks without resetting actor/event allocators.
    lastStepTick: state.tick - 1,
  }, {
    projectileWorldBlocked: () => false,
    players, registerWorldPainter: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON', flags: [], id: 1, locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position, spawnTick: state.tick, waveOrdinal: state.world.waves.waveOrdinal,
    }],
    rollLootSeed: () => 311,
    tick: state.tick,
  })
  const enemy = spawned.store.actors[0]
  assert.ok(enemy)
  const killed = damageBoneyardEnemy(spawned.store, {
    actorId: enemy.id, amount: enemy.currentHealth,
    registerWorldPainter: order.register, sourcePlayerId: playerId, tick: state.tick,
  })
  assert.equal(killed.killed, true)
  Object.assign(state, {
    world: { ...state.world, enemies: killed.store },
    worldManagerOrder: order.state(),
  })
}

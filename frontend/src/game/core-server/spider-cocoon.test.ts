import assert from 'node:assert/strict'
import test from 'node:test'
import { applyNativeWebbed } from '../core-kernels/native-webbed.ts'
import { createBoneyardEnemyStore, boneyardEnemyLiveCount, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { addNativeCocoon } from './enemies/construction.ts'
import { damageBoneyardEnemy } from './enemies/damage.ts'
import { boneyardEnemyBodies } from './boneyard-world-placement.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import { createGameSimulation, enterBoneyardWorld, gameSimulationPlayerRecords } from './game-simulation.ts'
import { applyPlayerContacts } from './player-contact-system.ts'
import { createNativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'

test('the target-owned Cocoon is a projectile target, stays out of physical crowd and wave counts, and takes web HP damage', () => {
  const position = { x: 200, y: 300 }
  const players = { player: {
    alive: true, connected: true, eligible: true, headingDeg: 90,
    collisionRadius: 25, position, velocityPerTick: { x: 0, y: 0 },
  } }
  const first = applyNativeWebbed(null, 10)
  const web = applyNativeWebbed(applyNativeWebbed(first, 50), 10)
  const initial = { ...createBoneyardEnemyStore('cocoon-contact'), webbedPlayers: { player: web } }
  const born = addNativeCocoon(initial, 'player', position, players, 0).store
  assert.equal(born.actors.length, 1)
  assert.equal(boneyardEnemyLiveCount(born), 0)
  assert.deepEqual(boneyardEnemyBodies(born), [])
  const moved = stepBoneyardEnemyStore(born, {
    projectileWorldBlocked: () => false, players, resolveMovement: (request) => request.requestedPosition,
    resolveSpawnIntents: () => [], tick: 1,
  }).store
  assert.deepEqual(moved.actors[0].position, { x: Math.fround(260.1), y: Math.fround(300.1) })
  const damaged = damageBoneyardEnemy(moved, { actorId: born.actors[0].id, amount: 10, sourcePlayerId: 'player', tick: 1 })
  assert.equal(damaged.healthDamage, 0)
  assert.equal(damaged.killed, false)
  assert.equal(damaged.store.webbedPlayers.player.cocoonHealth, 40)
  assert.equal(damaged.store.actors[0].currentHealth, 999_999)
  const released = damageBoneyardEnemy(damaged.store, { actorId: born.actors[0].id, amount: 40, magic: true, sourcePlayerId: 'player', tick: 1 })
  assert.equal(released.killed, true)
  assert.deepEqual(released.store.webbedPlayers, {})
  assert.equal(released.store.deathEffects.filter((effect) => effect.role === 'cocoon-fragment').length, 12)
  assert.equal(released.store.deathEffects.filter((effect) => effect.role === 'cocoon-bouncer').length, 7)
  assert.ok(released.store.deathEffects.filter((effect) => effect.role === 'cocoon-bouncer').every((effect) => effect.scaleY === 0.75))
  assert.deepEqual(released.store.deathEffects.find((effect) => effect.role === 'cocoon-flash')!.position, position)
  assert.equal(released.events.filter((event) => event.type === 'cocoon-released').length, 1)
  assert.ok(released.events.some((event) => event.sound === 'disintegrate'))
})

test('accepted Silk contacts accumulate one target-owned Cocoon and preserve the Magic Shield status branch', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 67))!
  const initial = enterBoneyardWorld(createGameSimulation({ owner: {
    displayName: 'Silk target', element: 'fire', discipline: 'arcane',
  } }), loaded)
  const players = gameSimulationPlayerRecords(initial)
  const order = createNativeWorldManagerOrder(initial.worldManagerOrder)
  const contact = {
    actorId: 1, playerId: 'owner', eventId: 1, webbedStrength: 20,
    physicalDamage: 1, magicDamage: 0, coldSlowTicks: 0, dazzleTicks: 0,
    poisonDamage: 0, poisonDuration: 0,
  }
  let source: Pick<typeof initial, 'world' | 'playerEntities' | 'secondaryAbilities'> = initial
  for (let tick = 1; tick <= 3; tick += 1) {
    source = applyPlayerContacts(source, players, [{ ...contact, eventId: tick }], tick, undefined, order.register)
    if (source.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
    assert.equal(source.world.enemies.webbedPlayers.owner.severity, tick)
    assert.equal(source.world.enemies.actors.filter(actor => actor.brain.family === 'cocoon').length, tick === 3 ? 1 : 0)
  }
  const shielded = applyPlayerContacts({
    ...initial,
    secondaryAbilities: {
      ...initial.secondaryAbilities,
      players: { owner: { ...createNativeSecondaryPlayerState(), magicShieldAbsorb: 100, magicShieldMaximum: 100 } },
    },
  }, players, [contact], 1, undefined, order.register)
  if (shielded.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  assert.equal(shielded.world.enemies.webbedPlayers.owner.severity, 1)
  assert.equal(shielded.secondaryAbilities.players.owner.magicShieldAbsorb, 75)
  assert.equal(shielded.playerEntities.progressions[0]!.currentHealth, initial.playerEntities.progressions[0]!.currentHealth)
})

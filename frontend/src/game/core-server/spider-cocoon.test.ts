import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeSilk } from '../core-kernels/native-silk.ts'
import { grantPlayerSkillRanks, nativeSecondaryAbilityRankStats } from '../core-kernels/player-progression.ts'
import { playerSkillDerivedStatsAt, replacePlayerEconomy } from './player-entity-store.ts'
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

test('accepted unshielded Silk contacts accumulate one Cocoon while Magic Shield rejects incoming Webbed', () => {
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
  assert.equal(shielded.world.enemies.webbedPlayers.owner, undefined)
  assert.equal(shielded.secondaryAbilities.players.owner.magicShieldAbsorb, 75)
  assert.equal(shielded.playerEntities.progressions[0]!.currentHealth, initial.playerEntities.progressions[0]!.currentHealth)
})

// Retail 0.72.5 magic_shield.cfg: include equipment ranks above the learning cap.
const SHIELD_CAPACITIES = [25, 50, 100, 200, 250, 300, 350, 400, 450, 500, 550, 600] as const
for (const [index, capacity] of SHIELD_CAPACITIES.entries()) {
  test(`Silk preserves stock rank-${index + 1} Shield capacity and blocks its incoming Webbed`, () => {
    assert.equal(nativeSecondaryAbilityRankStats(54, index + 1).values.mAbsorb, capacity)
    const source = shieldContactScene(capacity)
    const result = receiveSilk(source)
    assert.equal(result.secondaryAbilities.players.owner.magicShieldAbsorb, capacity - 25)
    assert.equal(result.playerEntities.progressions[0]!.currentHealth, source.playerEntities.progressions[0]!.currentHealth)
    assert.equal(result.world.enemies.webbedPlayers.owner, undefined)
    assert.equal(result.world.enemies.actors.some(actor => actor.brain.family === 'cocoon'), false)
    assert.equal(result.secondaryAbilities.events.filter(event => event.cue === 'pop-shield').length, index === 0 ? 1 : 0)
  })
}

test('Silk shield loss is independent of the Cocoon-health payload', () => {
  for (const strength of [10, 50, 250]) {
    for (const shield of [0, 100]) {
      const source = shieldContactScene(shield)
      const result = receiveSilk(source, strength)
      assert.equal(result.secondaryAbilities.players.owner.magicShieldAbsorb, shield === 0 ? 0 : 75)
      assert.equal(result.playerEntities.progressions[0]!.currentHealth,
        source.playerEntities.progressions[0]!.currentHealth - (shield === 0 ? 1 : 0))
      assert.equal(result.world.enemies.webbedPlayers.owner?.severity, shield === 0 ? 1 : undefined)
    }
  }
})

test('a breaking Shield blocks its Silk modifier but the next contact in the same batch does not', () => {
  for (const shield of [1, 24, 25]) {
    const source = shieldContactScene(shield)
    const contact = collideSilk(source)
    const order = createNativeWorldManagerOrder(source.worldManagerOrder)
    const result = applyPlayerContacts(source, gameSimulationPlayerRecords(source),
      [contact, { ...contact, eventId: contact.eventId + 1 }], 1, undefined, order.register)
    assert.equal(result.world.kind, 'boneyard')
    if (result.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
    assert.equal(result.secondaryAbilities.players.owner.magicShieldAbsorb, 0)
    assert.equal(result.playerEntities.progressions[0]!.currentHealth,
      source.playerEntities.progressions[0]!.currentHealth - 1, 'breaking hit cannot overflow into health')
    assert.equal(result.world.enemies.webbedPlayers.owner.severity, 1)
    assert.equal(result.secondaryAbilities.events.filter(event => event.cue === 'pop-shield').length, 1)
    assert.equal(result.secondaryAbilities.actors.filter(actor => actor.kind === 'shield-break').length, 20)
  }
})

test('Shield filters only incoming Webbed, preserving previously accumulated restraint', () => {
  const source = shieldContactScene(25)
  const web = applyNativeWebbed(applyNativeWebbed(null, 10), 10)
  source.world = { ...source.world, enemies: { ...source.world.enemies, webbedPlayers: { owner: web } } }
  const result = receiveSilk(source, 250)
  assert.deepEqual(result.world.enemies.webbedPlayers.owner, web)
  assert.equal(result.world.enemies.actors.some(actor => actor.brain.family === 'cocoon'), false)
})

test('physical resistance reduces the 25-point Silk shield hit while Harden armor does not', () => {
  for (const effectKind of [null, 18, 19] as const) {
    const source = shieldContactScene(100)
    const economy = source.playerEntities.economies[0]!
    assert.ok(economy.equipment.weapon)
    source.playerEntities = replacePlayerEconomy(source.playerEntities, 'owner', {
      ...economy, equipment: { ...economy.equipment, weapon: {
        ...economy.equipment.weapon, recipeIndex: null,
        nativeEffects: effectKind === null ? [] : [{ kind: effectKind, magnitude: 25, operator: 2, target: 0 }],
      } },
    })
    source.playerEntities = { ...source.playerEntities,
      skillRuntimes: source.playerEntities.skillRuntimes.map(runtime => ({ ...runtime, harden: { armor: 100, coating: 1 } })),
    }
    const derived = playerSkillDerivedStatsAt(source.playerEntities, 'owner')!
    if (effectKind === 18) assert.equal(derived.damageResistance, 0.25)
    const result = receiveSilk(source)
    assert.equal(result.secondaryAbilities.players.owner.magicShieldAbsorb,
      100 - Math.fround(25 * (1 - derived.damageResistance) * derived.incomingDamageFactor))
    assert.equal(result.world.enemies.webbedPlayers.owner, undefined)
  }
})

test('real Silk collision emits an explicitly source-less contact rather than its parent Spider', () => {
  const source = shieldContactScene(25)
  const contact = collideSilk(source)
  assert.equal(contact.source, null)
  assert.equal(contact.actorId, source.world.enemies.actors[0]!.id, 'retain semantic event ownership')
  assert.equal(contact.physicalDamage, 1, 'Shield-specific conversion belongs to the current receiver state')
})

test('source-less Silk Deflect preserves facing and never retaliates against the nearby parent Spider', () => {
  for (const shield of [0, 25]) {
    const source = shieldContactScene(shield)
    source.playerEntities = { ...source.playerEntities,
      skillBooks: source.playerEntities.skillBooks.map(book => grantPlayerSkillRanks(book, 68, 1)),
      skillRuntimes: source.playerEntities.skillRuntimes.map(runtime => ({ ...runtime, concentrationSkillIdA: 68 })),
    }
    source.secondaryAbilities = { ...source.secondaryAbilities, rng: createNativeRng(121) }
    const before = gameSimulationPlayerRecords(source).owner!
    const result = receiveSilk(source)
    assert.equal(result.deflectPitchesByEventId.size, 1)
    assert.equal(result.resolvedPlayers.owner!.headingIndex, before.headingIndex)
    assert.deepEqual(result.reflectedEnemyDamage, [])
    assert.equal(result.secondaryAbilities.players.owner.magicShieldAbsorb, shield)
    assert.equal(result.world.enemies.webbedPlayers.owner, undefined)
  }
})


test('a Silk break still triggers Explosive Shield without admitting Webbed', () => {
  const source = shieldContactScene(25)
  source.secondaryAbilities.players.owner.magicShieldExplosionDamage = 12.5
  const result = receiveSilk(source)
  assert.equal(result.world.enemies.webbedPlayers.owner, undefined)
  assert.equal(result.secondaryAbilities.actors.filter(actor => actor.kind === 'shield-break').length, 20)
  assert.equal(result.secondaryAbilities.actors.find(actor => actor.kind === 'shield-explosion')!.damage, 12.5)
  assert.equal(result.secondaryAbilities.events.filter(event => event.cue === 'magic-shield-explode').length, 1)
})

test('Stoneskin rejects unshielded Webbed and does not prevent an active Shield from absorbing the hit', () => {
  for (const shield of [0, 25]) {
    const source = shieldContactScene(shield)
    source.secondaryAbilities.players.owner.stoneskinTicksRemaining = 100
    const result = receiveSilk(source)
    assert.equal(result.world.enemies.webbedPlayers.owner, undefined)
    assert.equal(result.playerEntities.progressions[0]!.currentHealth, source.playerEntities.progressions[0]!.currentHealth)
    assert.equal(result.secondaryAbilities.players.owner.magicShieldAbsorb, 0)
  }
})

function shieldContactScene(shield: number) {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 67))!
  const initial = enterBoneyardWorld(createGameSimulation({ owner: {
    displayName: 'Silk Shield target', element: 'fire', discipline: 'arcane',
  } }), loaded)
  if (initial.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const position = gameSimulationPlayerRecords(initial).owner!.position
  const order = createNativeWorldManagerOrder(initial.worldManagerOrder)
  const enemies = stepBoneyardEnemyStore(initial.world.enemies, {
    projectileWorldBlocked: () => false, players: {}, registerWorldPainter: order.register,
    resolveMovement: request => request.requestedPosition,
    resolveSpawnIntents: () => [{ enemyToken: 'SPIDER', flags: [], id: 1, locationPolicy: 'anywhere',
      nativeTypeId: 2057, position: { x: position.x + 30, y: position.y }, spawnTick: 0, waveOrdinal: 1 }],
    tick: 0,
  }).store
  return { ...initial, world: { ...initial.world, enemies }, worldManagerOrder: order.state(),
    secondaryAbilities: { ...initial.secondaryAbilities, players: { owner: {
      ...createNativeSecondaryPlayerState(), magicShieldAbsorb: shield, magicShieldMaximum: shield,
    } } },
  }
}

function collideSilk(source: ReturnType<typeof shieldContactScene>, strength = 20) {
  const position = gameSimulationPlayerRecords(source).owner!.position
  const created = createNativeSilk(position, { position, velocityPerTick: { x: 0, y: 0 } }, strength, createNativeRng(10))
  const ownerActorId = source.world.enemies.actors[0]!.id
  const collided = stepBoneyardEnemyStore({ ...source.world.enemies, actors: [], silks: [{
    id: 1, ownerActorId, spawnTick: 0, nativeCellBindingOrder: 1, nativeRegistrationOrder: 1,
    painterRegistration: { managerLane: 'actor', registrationOrdinal: 100 }, state: created.state,
  }] }, {
    projectileWorldBlocked: () => false,
    players: { owner: { alive: true, connected: true, eligible: true, position,
      collisionRadius: 25, velocityPerTick: { x: 0, y: 0 } } },
    resolveMovement: request => request.requestedPosition, resolveSpawnIntents: () => [], tick: 1,
  })
  assert.equal(collided.playerDamage.length, 1)
  assert.equal(collided.store.silks.length, 0, 'impact retires Silk exactly once')
  return collided.playerDamage[0]!
}

function receiveSilk(source: ReturnType<typeof shieldContactScene>, strength = 20) {
  const order = createNativeWorldManagerOrder(source.worldManagerOrder)
  const result = applyPlayerContacts(source, gameSimulationPlayerRecords(source),
    [collideSilk(source, strength)], 1, undefined, order.register)
  if (result.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  return { ...result, world: result.world }
}

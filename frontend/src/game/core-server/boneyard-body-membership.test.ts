import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveActorMotion } from '../core-kernels/actor-physics.ts'
import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { BONEYARD_WAVE_ENEMY_TYPES, type BoneyardWaveEnemyToken } from '../core-kernels/boneyard-wave-schema.ts'
import { applyNativeSecondaryTargetEffect, createNativeSecondarySimulation } from '../core-kernels/native-secondary-abilities.ts'
import { NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256, nativePortalRecipe } from '../core-kernels/native-survival-portal.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { createBoneyardWorld } from './boneyard-world-construction.ts'
import { applyBoneyardEtherDrainForces, applyBoneyardPlayerKnockbacks, applyBoneyardSecondaryEnemyKnockbacks,
  boneyardEnemyBodies, moveBoneyardKnockbackAreaTarget, spawnPlayerCharacterInBoneyard } from './boneyard-world-placement.ts'
import { boneyardEnemyActorFlags, type BoneyardEnemyStore } from './enemies/model.ts'

const context = { players: {}, projectileWorldBlocked: () => false,
  resolveSpawnIntents: () => [],
  resolveMovement: (request: { requestedPosition: Readonly<{ x: number; y: number }> }) => request.requestedPosition }

function spawn(token: BoneyardWaveEnemyToken, flags: readonly string[] = []): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('recipient-contract'), {
    ...context, tick: 0, resolveSpawnIntents: () => [{ enemyToken: token,
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[token], flags,
      ...(token === 'PORTAL' ? { authoredRecipe: nativePortalRecipe(Object.values(NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256)[0]!.phases[0]!) } : {}), id: 1, locationPolicy: 'anywhere',
      position: { x: 100, y: 100 }, spawnTick: 0, waveOrdinal: 40 }],
  }).store
}

const recipients = [
  ['SKELETON', true], ['SKELETONARCHER', true], ['SKELETONMAGE', true],
  ['IMP', true], ['ZOMBIE', true], ['WRAITH', false], ['DEMONSKULL', true],
  ['DEMON', true], ['DIREFACULTY', true], ['HEARTMONGER', true], ['SPIDER', true],
  ['PORTAL', true], ['COFFIN', null], ['COCOON', null],
] as const

for (const [token, expected] of recipients) {
  test(`${token} native physical receipt is independent of hostile query membership`, () => {
    const store = spawn(token)
    const bodies = boneyardEnemyBodies(store)
    assert.equal(bodies.length, expected === null ? 0 : 1)
    if (expected !== null) assert.equal(bodies[0]!.collisionRecipient ?? true, expected)
    assert.equal(boneyardEnemyActorFlags(store.actors[0]!), token === 'COFFIN' ? 0 : 2)
    const dying = { ...store, actors: store.actors.map(actor => ({ ...actor, lifeState: 'dying' as const })) }
    assert.deepEqual(boneyardEnemyBodies(dying), [])
  })
}

test('the recipient census covers every authored enemy token', () => {
  assert.deepEqual(recipients.map(([token]) => token).sort(), Object.keys(BONEYARD_WAVE_ENEMY_TYPES).sort())
})

for (const flags of [[], ['FLAG_FAST'], ['FLAG_SLOW'], ['FLAG_BURNING']]) {
  for (const [status, patch] of [
    ['normal', {}], ['cold-aura', { coldSlowFactor: 0.2, coldSlowTicks: 600, coldSlowMaterial: true }],
    ['frozen', { frozenTicks: 600 }],
  ] as const) {
    test(`Wraith receipt stays disabled for ${flags.join('+') || 'ordinary'} ${status}`, () => {
      const initial = spawn('WRAITH', flags)
      const actor = initial.actors[0]!
      const effect = applyNativeSecondaryTargetEffect(createNativeSecondarySimulation(), 'recipient-contract', actor.id, patch)
      const store = stepBoneyardEnemyStore(initial, { ...context, tick: 2,
        abilityEffects: { [actor.id]: effect.targetEffects[0]! } }).store
      const bodies = boneyardEnemyBodies(store)
      assert.equal(bodies[0]!.collisionRecipient, false)
      assert.equal(boneyardEnemyActorFlags(store.actors[0]!), 2)
      assert.equal(bodies[0]!.radius, 15)
    })
  }
}

function maggotStore(): BoneyardEnemyStore {
  const initial = spawn('COFFIN')
  const coffin = initial.actors[0]!
  assert.equal(coffin.brain.family, 'coffin')
  if (coffin.brain.family !== 'coffin') throw new Error('expected Coffin')
  return stepBoneyardEnemyStore({ ...initial, actors: [{ ...coffin,
    brain: { ...coffin.brain, phase: 'opening', phaseTicksRemaining: 1 } }] }, { ...context, tick: 1 }).store
}

for (const movementPhase of ['emerging', 'crawl'] as const) {
  for (const combatActive of [false, true]) {
    test(`Maggot ${movementPhase} combat=${combatActive} is a force root but not a recipient`, () => {
      const initial = maggotStore()
      const maggot = { ...initial.maggots[0]!, position: { x: 100, y: 100 }, movementPhase, combatActive }
      const store = { ...initial, maggots: [maggot] }
      const body = boneyardEnemyBodies(store).find(candidate => candidate.id === `enemy-${maggot.id}`)!
      assert.equal(body.collisionRecipient, false)
      const moved = resolveActorMotion([{ ...body, driven: true, delta: { x: 4, y: 3 } }], {
        canPlace: () => true, move: (_id, p, delta) => ({ x: p.x + delta.x, y: p.y + delta.y }),
      }, () => true)
      assert.deepEqual(moved[0]!.position, { x: 104, y: 103 })
      assert.equal(boneyardEnemyBodies({ ...store, maggots: [{ ...maggot, lifeState: 'dying' }] })
        .some(candidate => candidate.id === body.id), false)
    })
  }
}

function worldFixture(enemies = spawn('WRAITH')) {
  const loaded: LoadedBoneyard = {
    choice: { id: 'default-random', name: 'Recipient fixture', source: 'default' },
    geometrySha256: 'b'.repeat(64), sourceSha256: 'c'.repeat(64), runId: 'recipient-run', seed: 'recipient-seed',
    scene: { bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2,
      fences: [], objects: [], roads: [], solomonDig: null, sprites: [], terrain: [],
      name: 'Recipient fixture', spawn: { facingDeg: 0, x: 60, y: 100 } },
  }
  const order = createNativeWorldManagerOrder()
  const world = createBoneyardWorld(loaded, order.register('actor'), order.register('actor'))
  return { ...world, arenaTransition: null, encounter: null, waves: null, enemies, lanternPosition: null }
}

test('player knockback crosses a Wraith without moving the Wraith', () => {
  const world = worldFixture()
  const player = spawnPlayerCharacterInBoneyard({ discipline: 'arcane', displayName: 'Recipient', element: 'water' }, world)
  const result = applyBoneyardPlayerKnockbacks({ player }, world.enemies,
    [{ actorId: 1, delta: { x: 35, y: 0 }, eventId: 1, playerId: 'player' }],
    {}, world.bounds, world.collision, null)
  assert.deepEqual(result.players.player!.position, { x: 95, y: 100 })
  assert.deepEqual(result.enemies.actors[0]!.position, world.enemies.actors[0]!.position)
})

for (const force of ['secondary', 'area', 'ether-drain'] as const) {
  test(`${force} preserves Wraith driven-root motion and scenery collision`, () => {
    const initial = worldFixture()
    const world = { ...initial, collision: { ...initial.collision,
      circles: [{ sourceId: 'wall', center: { x: 155, y: 100 }, radius: 10 }] } }
    const target = world.enemies.actors[0]!
    const delta = { x: 50, y: 0 }
    const moved = force === 'secondary'
      ? applyBoneyardSecondaryEnemyKnockbacks(world, {}, [{ delta, sourceActorId: 9, targetId: target.id }], {})
      : force === 'area'
        ? moveBoneyardKnockbackAreaTarget(world, {}, target.id, delta, 9, {}).world
        : applyBoneyardEtherDrainForces(world, {}, createNativeSecondarySimulation(), [{
          sourceActorId: 9, target: { kind: 'enemy', id: target.id, registrationOrdinal: target.nativeRegistrationOrder },
          delta, consume: false, amount: 0, damageFlags: 0x10a, magicContact: false, ownerId: 'player', hitStrength: 0,
        }], {}).world
    assert.ok(moved.enemies.actors[0]!.position.x > 100)
    assert.ok(moved.enemies.actors[0]!.position.x < 140, 'force root must still respect scenery')
  })
}


test('scaled Wraith retains its damage-query radius while remaining a nonrecipient', () => {
  const initial = spawn('WRAITH')
  const actor = initial.actors[0]!
  const store = { ...initial, actors: [{ ...actor, config: { ...actor.config, scale: 2, collisionRadius: 30 } }] }
  assert.equal(boneyardEnemyBodies(store)[0]!.radius, 30)
  assert.equal(boneyardEnemyBodies(store)[0]!.collisionRecipient, false)
  assert.equal(boneyardEnemyActorFlags(store.actors[0]!), 2)
})

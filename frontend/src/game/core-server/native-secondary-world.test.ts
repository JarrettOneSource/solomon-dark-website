import assert from 'node:assert/strict'
import test from 'node:test'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { createNativeFacultyAction } from '../core-kernels/native-faculty-actions.ts'
import { createNativeDarkFireballs } from '../core-kernels/native-faculty-spells.ts'
import { createNativeGuidedMissile } from '../core-kernels/native-guided-missile.ts'
import type { NativeRngState } from '../core-kernels/native-rng.ts'
import { createNativeRng, drawNativeFloat, drawNativeInteger } from '../core-kernels/native-rng.ts'
import { applyNativeSecondaryTargetEffect, createNativeSecondarySimulation } from '../core-kernels/native-secondary-abilities.ts'
import { projectBoneyardEnemies } from '../host/project-boneyard-enemies.ts'
import type { BoneyardCollisionWorld } from './boneyard-collision.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import type { BoneyardEnemyProjectile, BoneyardEnemyStoreStepContext } from './enemies/model.ts'
import {
  boneyardNativeSecondaryDampenCandidates,
  boneyardNativeSecondaryTarget,
  boneyardNativeSecondaryTargets,
  resolveBoneyardNativeSecondaryCombat,
  resolveBoneyardNativeTeleport,
  resolveNativeCollisionAdjustedPosition,
} from './native-secondary-world.ts'

const BOUNDS = Object.freeze({ h: 400, w: 400, x: 0, y: 0 })
const EMPTY_COLLISION: BoneyardCollisionWorld = Object.freeze({
  circles: Object.freeze([]),
  polygons: Object.freeze([]),
  segments: Object.freeze([]),
})

function consumeShuffle(source: NativeRngState, count: number): NativeRngState {
  let rng = source
  for (let index = 0; index < count; index += 1) {
    rng = drawNativeInteger(rng, count).state
  }
  return rng
}

test('Arena Teleport selects the unique farthest 100-unit inset lattice cell', () => {
  const source = createNativeRng(123)
  const result = resolveBoneyardNativeTeleport(source, {
    bodies: [{ position: { x: 100, y: 100 }, radius: 10 }],
    bounds: BOUNDS,
    collision: EMPTY_COLLISION,
  })

  assert.deepEqual(result.position, { x: 200, y: 200 })
  assert.deepEqual(result.rng, consumeShuffle(source, 4))
})

test('Arena Teleport consumes Y then X when every shuffled cell score is zero', () => {
  const source = createNativeRng(2)
  const shuffled = consumeShuffle(source, 4)
  const y = drawNativeFloat(shuffled, BOUNDS.h)
  const x = drawNativeFloat(y.state, BOUNDS.w)
  const result = resolveBoneyardNativeTeleport(source, {
    bodies: [],
    bounds: BOUNDS,
    collision: EMPTY_COLLISION,
  })

  assert.deepEqual(result, {
    position: { x: Math.fround(x.value), y: Math.fround(y.value) },
    rng: x.state,
  })
})

test('Arena Teleport retries blocked points with exact elliptical ring geometry', () => {
  const source = createNativeRng(123)
  const shuffled = consumeShuffle(source, 4)
  const firstPhase = drawNativeFloat(shuffled, 360)
  const expansion = drawNativeFloat(firstPhase.state, 1)
  const secondPhase = drawNativeFloat(expansion.state, 360)
  const horizontalRadius = Math.fround(80)
  const verticalRadius = Math.fround(80 * 0.800000011920929)
  const radians = secondPhase.value * Math.PI / 180
  const result = resolveBoneyardNativeTeleport(source, {
    bodies: [{ position: { x: 100, y: 100 }, radius: 10 }],
    bounds: BOUNDS,
    collision: {
      ...EMPTY_COLLISION,
      circles: [{ center: { x: 200, y: 200 }, radius: 0 }],
    },
  })

  assert.deepEqual(result, {
    position: {
      x: Math.fround(200 + Math.fround(
        Math.fround(Math.sin(radians)) * horizontalRadius,
      )),
      y: Math.fround(200 + Math.fround(
        -Math.fround(Math.cos(radians)) * verticalRadius,
      )),
    },
    rng: secondPhase.state,
  })
})

test('shared native collision adjustment changes ring sample count and preserves RNG order', () => {
  const source = createNativeRng(44)
  const checked: { x: number; y: number }[] = []
  const result = resolveNativeCollisionAdjustedPosition(
    source,
    { x: 200, y: 200 },
    25,
    (position) => {
      checked.push(position)
      return checked.length === 13
    },
  )

  const firstPhase = drawNativeFloat(source, 360)
  const firstExpansion = drawNativeFloat(firstPhase.state, 1)
  const secondPhase = drawNativeFloat(firstExpansion.state, 360)
  const secondExpansion = drawNativeFloat(secondPhase.state, 1)
  const thirdPhase = drawNativeFloat(secondExpansion.state, 360)
  assert.equal(checked.length, 13)
  assert.deepEqual(result.rng, thirdPhase.state)
  assert.deepEqual(checked[0], { x: 200, y: 200 })
})

test('secondary target membership begins on the Coffin rising edge', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('secondary-coffin'), {
    projectileWorldBlocked: () => false,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'COFFIN',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.COFFIN,
      position: { x: 100, y: 100 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  }).store
  const coffin = spawned.actors[0]!
  assert.equal(coffin.brain.family, 'coffin')
  if (coffin.brain.family !== 'coffin') throw new Error('expected Coffin brain')

  assert.deepEqual(boneyardNativeSecondaryTargets(spawned, coffin.position, 1), [])
  assert.equal(boneyardNativeSecondaryTarget(spawned, coffin.id), null)

  const risen = {
    ...spawned,
    actors: [{
      ...coffin,
      brain: {
        ...coffin.brain,
        phase: 'rising' as const,
        phaseTick: 0,
        phaseTicksRemaining: 11,
      },
    }],
  }
  assert.deepEqual(
    boneyardNativeSecondaryTargets(risen, coffin.position, 1).map(({ id, nativeFlags }) => ({
      id,
      nativeFlags,
    })),
    [{ id: coffin.id, nativeFlags: 0x2 }],
  )
  assert.equal(boneyardNativeSecondaryTarget(risen, coffin.id)?.nativeFlags, 0x2)
})

test('Dampen cancels all five native magic variants without calling their impact programs', () => {
  const projectiles: readonly BoneyardEnemyProjectile[] = [
    enemyProjectile(1, 'arrow', 0x7da, 'normal'),
    enemyProjectile(2, 'firebolt', 0x7eb, 'fire'),
    enemyProjectile(3, 'guided-missile', 0x7ec, 'cold'),
    enemyProjectile(4, 'demon-bomb', 0x7f7, 'none'),
    enemyProjectile(5, 'poison-pool', 0x806, 'poison'),
    enemyProjectile(6, 'guided-missile', 0x7ec, 'poison'),
  ]
  const common = { ageTicks: 0, damage: 10, ownerActorId: 50, spawnTick: 0,
    painterRegistration: { managerLane: 'actor', registrationOrdinal: 10 } as const }
  const skull = { ...common, ...createNativeGuidedMissile(createNativeRng(8), { x: 1, y: 1 }, 0, 1.5).state,
    kind: 'skull-missile' as const, id: 7, targetPlayerId: null }
  const dark = { ...common, ...createNativeDarkFireballs({ x: 1, y: 1 }, 0, false, null, createNativeRng(9)).spells[0]!,
    kind: 'dark-fireball' as const, id: 8, groundFireDamage: 1 }
  const source = { ...createBoneyardEnemyStore('dampen-projectile-membership'),
    bossSpells: [skull, dark], projectiles }
  const candidates = boneyardNativeSecondaryDampenCandidates(source, { x: 0, y: 0 })
  assert.deepEqual(candidates.projectiles.map(({ id }) => id), [2, 3, 6, 7, 8])
  assert.deepEqual(candidates.projectiles.map(({ kind }) => kind), [
    'firebolt', 'guided-missile', 'guided-missile', 'skull-missile', 'dark-fireball',
  ])
  const canceled = resolveBoneyardNativeSecondaryCombat(source, {
    damage: [], dampenedCasterTargetIds: [], dispelledShieldTargetIds: [], headingPerturbations: [],
    removedProjectileIds: candidates.projectiles.map(({ id }) => id),
  }, 0)
  assert.deepEqual(canceled.enemies.projectiles.map(({ id }) => id), [1, 4, 5])
  assert.deepEqual(canceled.enemies.bossSpells, [])
  assert.deepEqual(canceled.enemies.projectileEffects, [])
  assert.deepEqual(canceled.enemies.deathEffects, [])
  assert.deepEqual(canceled.events, [])
})

test('Dampen interrupts Mage and Faculty casts while their walking and casting-delay clocks continue', () => {
  const context: BoneyardEnemyStoreStepContext = {
    projectileWorldBlocked: () => false,
    players: { player: { alive: true, collisionRadius: 25, connected: true, eligible: true,
      headingDeg: 0, position: { x: 300, y: 0 }, velocityPerTick: { x: 0, y: 0 } } },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => (['SKELETONMAGE', 'DIREFACULTY'] as const).map((enemyToken, index) => ({
      enemyToken, flags: [], id: index + 1, locationPolicy: 'anywhere',
      nativeTypeId: enemyToken === 'SKELETONMAGE' ? 1003 : 1010,
      position: { x: index * 20, y: 0 }, spawnTick: 0, waveOrdinal: 1,
    })),
    tick: 0,
  }
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('dampen-casters'), context).store
  const casting = { ...spawned, actors: spawned.actors.map(actor => ({ ...actor, bodyPose: 2,
    brain: actor.brain.family === 'mage' ? { ...actor.brain, actionProgress: 4, phase: 'cast' as const }
      : actor.brain.family === 'faculty' ? { ...actor.brain,
          action: createNativeFacultyAction('lightning', createNativeRng(2)).action,
          handMask: 3, headingLocked: true, phase: 'cast' as const } : actor.brain,
  })) }
  const candidates = boneyardNativeSecondaryDampenCandidates(casting, { x: 0, y: 0 })
  assert.deepEqual(candidates.casterTargetIds, [1, 2])
  const dampened = resolveBoneyardNativeSecondaryCombat(casting, {
    damage: [], dampenedCasterTargetIds: candidates.casterTargetIds,
    dispelledShieldTargetIds: [], headingPerturbations: [], removedProjectileIds: [],
  }, 0).enemies
  for (const actor of dampened.actors) {
    if (actor.brain.family !== 'mage' && actor.brain.family !== 'faculty') throw new Error('caster required')
    assert.equal(actor.brain.phase, 'range-control')
    assert.equal(actor.brain.disabledPrimaryTicks, actor.brain.family === 'mage' ? 600 : 500)
    assert.equal(dampened.deathEffects.filter(effect => effect.ownerActorId === actor.id && effect.role === 'dampen-caster-smoke').length, 72)
    assert.equal(dampened.deathEffects.filter(effect => effect.ownerActorId === actor.id && effect.role === 'dampen-caster-flash').length, 1)
    if (actor.brain.family === 'faculty') {
      assert.equal(actor.brain.action, null)
      assert.equal(actor.brain.handMask, 0)
      assert.equal(actor.brain.headingLocked, true)
    }
  }
  let frozenEffects = createNativeSecondarySimulation()
  for (const actor of dampened.actors) frozenEffects = applyNativeSecondaryTargetEffect(
    frozenEffects, 'boneyard:test', actor.id, { frozenTicks: 100, frozenTimeScale: 0 },
  )
  const frozen = stepBoneyardEnemyStore(dampened, { ...context, resolveSpawnIntents: () => [], tick: 1,
    abilityEffects: Object.fromEntries(frozenEffects.targetEffects.map(effect => [effect.targetId, effect])),
  }).store
  for (const actor of frozen.actors) {
    const original = dampened.actors.find(({ id }) => actor.id === id)!
    if (actor.brain.family !== 'mage' && actor.brain.family !== 'faculty') throw new Error('caster required')
    assert.equal(actor.brain.disabledPrimaryTicks, actor.brain.family === 'mage' ? 599 : 499)
    assert.deepEqual(actor.position, original.position)
  }
  let advanced = dampened
  for (let tick = 1; tick <= 10; tick += 1) advanced = stepBoneyardEnemyStore(advanced, {
    ...context, resolveSpawnIntents: () => [], tick,
  }).store
  for (const actor of advanced.actors) {
    const original = dampened.actors.find(({ id }) => id === actor.id)!
    if (actor.brain.family !== 'mage' && actor.brain.family !== 'faculty') throw new Error('caster required')
    assert.equal(actor.brain.disabledPrimaryTicks, actor.brain.family === 'mage' ? 590 : 490)
    assert.equal(actor.brain.phase, 'range-control')
    assert.notDeepEqual(actor.position, original.position)
  }
})

test('Earthquake applies its exact signed heading perturbation at the enemy-store boundary', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('earthquake-heading'), {
    projectileWorldBlocked: () => false,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags: [],
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 100, y: 100 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  }).store
  const actor = spawned.actors[0]!
  const source = {
    ...spawned,
    actors: [{ ...actor, headingDeg: 5 }],
  }

  const result = resolveBoneyardNativeSecondaryCombat(source, {
    damage: [],
    dampenedCasterTargetIds: [],
    dispelledShieldTargetIds: [],
    headingPerturbations: [{ deltaDegrees: -15, targetId: actor.id }],
    removedProjectileIds: [],
  }, 1)

  assert.equal(result.enemies.actors[0]!.headingDeg, Math.fround(350))
})

function enemyProjectile(
  id: number,
  kind: BoneyardEnemyProjectile['kind'],
  nativeTypeId: BoneyardEnemyProjectile['nativeTypeId'],
  payload: BoneyardEnemyProjectile['payload'],
): BoneyardEnemyProjectile {
  const painterRegistration = {
    managerLane: kind === 'arrow' || kind === 'firebolt' ? 'transient' as const : 'actor' as const,
    registrationOrdinal: id,
  }
  const base = {
    ageTicks: 8,
    bounceVelocity: 0,
    chillTumbleAccumulator: 0,
    coldSlowTicks: 0,
    contactRadius: 8,
    damage: 1,
    secondaryDamage: 0,
    headingDeg: 90,
    hitPlayerIds: [],
    homing: false,
    id,
    lastStepTick: 0,
    lightRegistration: kind === 'arrow' ? null : painterRegistration,
    lifetimeTicks: 300,
    minimumSpeed: 0,
    nativeCellBindingOrder: id,
    nativeRegistrationOrder: id,
    nativeTypeId,
    ownerActorId: 3,
    painterRegistration,
    payload,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: id * 10, y: 0 },
    settledTicksRemaining: 0,
    spawnTick: 0,
    speed: 5,
    targetPlayerId: null,
    turnSpeed: kind === 'guided-missile' ? 1 : 0,
    verticalOffset: 0,
    verticalVelocity: 0,
    visualPhaseDeg: 15,
    visualScale: 1,
  }
  return kind === 'arrow' ? { ...base, kind, velocity: { x: 5, y: 0 } } : { ...base, kind }
}

test('Spider Ether Drain capture preserves rewards while suppressing sound and corpse only within the strict field radius', () => {
  const context = {
    projectileWorldBlocked: () => false,
    players: {},
    resolveMovement: ({ requestedPosition }: { requestedPosition: { x: number; y: number } }) => requestedPosition,
    resolveSpawnIntents: () => [],
    tick: 2,
  }
  for (const [etherDrain, distance, captured] of [
    [true, 39.999, true],
    [true, 40, false],
    [true, 40.001, false],
    [false, 0, false],
  ] as const) {
    const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('spider-capture'), {
      ...context,
      resolveSpawnIntents: () => [{
        enemyToken: 'SPIDER', flags: [], id: 1, locationPolicy: 'anywhere',
        nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SPIDER,
        position: { x: 100, y: 100 }, spawnTick: 1, waveOrdinal: 4,
      }],
      tick: 1,
    }).store
    const spider = spawned.actors[0]!
    const hit = resolveBoneyardNativeSecondaryCombat(spawned, {
      damage: [{ amount: 100, etherDrain, kind: 'magic', ownerId: 'player', sourceActorId: 1, targetId: spider.id }],
      dampenedCasterTargetIds: [], dispelledShieldTargetIds: [], headingPerturbations: [], removedProjectileIds: [],
    }, 1, undefined, undefined, undefined, [{ x: spider.position.x + distance, y: spider.position.y }])
    assert.equal(projectBoneyardEnemies(hit.enemies, 1).length, captured ? 0 : 1)
    const retired = stepBoneyardEnemyStore(hit.enemies, context)
    assert.equal(retired.store.actors.length, 0)
    assert.equal(retired.rewards.length, 1)
    assert.equal(retired.rewards[0]!.experience, 12.75)
    assert.equal(retired.retired.length, 1)
    assert.equal(retired.events.filter((event) => event.sound === 'spider-die').length, captured ? 0 : 1)
    assert.equal(retired.store.spiderRemains.length, captured ? 0 : 1)
    const next = stepBoneyardEnemyStore(retired.store, { ...context, tick: 3 })
    assert.deepEqual(next.rewards, [])
  }
})

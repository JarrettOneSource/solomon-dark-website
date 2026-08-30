import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from '../core-kernels/native-rng.ts'
import type { BoneyardCollisionWorld } from './boneyard-collision.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyProjectile,
} from './boneyard-enemy-store.ts'
import {
  boneyardNativeSecondaryDampenCandidates,
  boneyardNativeSecondaryTarget,
  boneyardNativeSecondaryTargets,
  resolveNativeCollisionAdjustedPosition,
  resolveBoneyardNativeSecondaryCombat,
  resolveBoneyardNativeTeleport,
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
    firstProjectileWorldContact: () => null,
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

test('Dampen selects only the four native hostile-magic projectile families', () => {
  const projectiles: readonly BoneyardEnemyProjectile[] = [
    enemyProjectile(1, 'arrow', 0x7da, 'normal'),
    enemyProjectile(2, 'firebolt', 0x7eb, 'fire'),
    enemyProjectile(3, 'guided-missile', 0x7ec, 'cold'),
    enemyProjectile(4, 'demon-bomb', 0x7f7, 'none'),
    enemyProjectile(5, 'poison-pool', 0x806, 'poison'),
  ]
  const source = {
    ...createBoneyardEnemyStore('dampen-projectile-membership'),
    projectiles,
  }

  assert.deepEqual(
    boneyardNativeSecondaryDampenCandidates(source, { x: 0, y: 0 })
      .projectiles.map(({ id }) => id),
    [2, 3],
  )
})

test('Earthquake applies its exact signed heading perturbation at the enemy-store boundary', () => {
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('earthquake-heading'), {
    firstProjectileWorldContact: () => null,
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
  return {
    ageTicks: 8,
    bounceVelocity: 0,
    chillTumbleAccumulator: 0,
    coldSlowTicks: 0,
    contactRadius: 8,
    damage: 1,
    headingDeg: 90,
    hitPlayerIds: [],
    homing: false,
    id,
    kind,
    lastStepTick: 0,
    lightRegistration: null,
    lifetimeTicks: 300,
    minimumSpeed: 0,
    nativeCellBindingOrder: id,
    nativeRegistrationOrder: id,
    nativeTypeId,
    ownerActorId: 3,
    painterRegistration: { managerLane: 'actor', registrationOrdinal: id },
    payload,
    poisonDamage: 0,
    poisonDuration: 0,
    position: { x: id * 10, y: 0 },
    settledTicksRemaining: 0,
    spawnTick: 0,
    speed: 5,
    targetPlayerId: null,
    verticalOffset: 0,
    verticalVelocity: 0,
    visualPhaseDeg: 15,
    visualScale: 1,
  }
}

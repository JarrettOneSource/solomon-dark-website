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
} from './boneyard-enemy-store.ts'
import {
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

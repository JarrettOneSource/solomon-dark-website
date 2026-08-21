import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  NativeWeldHailstonesState,
  NativeWeldProjectileState,
} from '../core-kernels/native-weld-primary-runtime.ts'
import type { PrimarySpellSimulationState } from '../core-kernels/primary-spells.ts'
import {
  copyPrimarySpellState,
  interpolatePrimarySpellState,
} from './primary-spell-presentation.ts'

const projectile = {
  ageTicks: 10,
  ballLightningAcceleration: null,
  basePresentationPhaseDegrees: 35,
  buildId: 1000,
  castPlaybackRate: 1,
  castSoundVariant: null,
  charge: 1,
  contactsRemaining: 1,
  damage: 8,
  direction: { x: 1, y: 0 },
  flightTicks: 10,
  frostPulseAspect: null,
  frostPresentationLanes: null,
  frostTurnDegrees: null,
  groundSparkNativeAgeTicks: null,
  groundSparkTurnTicksRemaining: null,
  headingDegrees: 90,
  hitTargetIds: ['enemy:1'],
  id: 1,
  kind: 'weld',
  lightRegistration: { managerLane: 'actor', registrationOrdinal: 1 },
  ownerId: 'wizard',
  phase: 'flight',
  position: { x: 40, y: 50 },
  presentationSeed: 17,
  projectileIndex: 0,
  secondaryPresentationPhaseDegrees: null,
  speed: 3,
  targetId: 'enemy:2',
  turnAccumulator: 1,
  turnInput: 2,
  underpowered: false,
  vector: [4, 8, 10, 1, 1, 0, 0, 0, 0],
  velocity: { x: 3, y: 0 },
  worldKey: 'boneyard:weld',
} satisfies NativeWeldProjectileState

const hailstones = {
  ageTicks: 20,
  birthTick: 1,
  buildId: 1008,
  collisionRadius: 50,
  damage: 7,
  direction: { x: 1, y: 0 },
  id: 2,
  kind: 'weld-persistent',
  lightRegistration: { managerLane: 'actor', registrationOrdinal: 2 },
  maximumScale: 1.5,
  origin: { x: 100, y: 200 },
  ownerId: 'wizard',
  phase: 'flight',
  releaseAgeTicks: 20,
  releaseFadeScale: 1.25,
  pulseSequence: 20,
  pushback: 0.2,
  rocks: [{
    damageRemaining: 7,
    decay: 0.95,
    localPosition: { x: 1, y: 2, z: 3 },
    phase: 0.25,
    rockId: 0,
    releaseOffset: { x: 1, y: 40 },
    spriteRecord: 168,
    visualScale: 0.2,
  }],
  scale: 0.75,
  toughness: 1.5,
  vector: [7, 2, 1, 1.5, 0.2, 0.5],
  widen: 0.5,
  worldKey: 'boneyard:weld',
} satisfies NativeWeldHailstonesState

function state(
  projectileState: NativeWeldProjectileState,
  hailstoneState: NativeWeldHailstonesState,
): PrimarySpellSimulationState {
  return {
    nextId: 3,
    projectiles: [projectileState],
    transients: [hailstoneState],
  }
}

test('weld presentation copies every replicated mutable lane', () => {
  const source = state(projectile, hailstones)
  const copy = copyPrimarySpellState(source)
  const copiedProjectile = copy.projectiles[0]
  const copiedHail = copy.transients[0]
  assert.ok(copiedProjectile?.kind === 'weld')
  assert.ok(copiedHail?.kind === 'weld-persistent' && copiedHail.buildId === 1008)

  assert.notEqual(copiedProjectile.direction, projectile.direction)
  assert.notEqual(copiedProjectile.hitTargetIds, projectile.hitTargetIds)
  assert.notEqual(copiedProjectile.vector, projectile.vector)
  assert.notEqual(copiedHail.direction, hailstones.direction)
  assert.notEqual(copiedHail.rocks, hailstones.rocks)
  assert.notEqual(copiedHail.rocks[0], hailstones.rocks[0])
  assert.notEqual(copiedHail.rocks[0]!.localPosition, hailstones.rocks[0]!.localPosition)
  assert.notEqual(copiedHail.rocks[0]!.releaseOffset, hailstones.rocks[0]!.releaseOffset)
})

test('weld presentation interpolates projectile and released carrier motion', () => {
  const newerProjectile = {
    ...projectile,
    ageTicks: 12,
    position: { x: 50, y: 60 },
  }
  const newerHailstones = {
    ...hailstones,
    ageTicks: 22,
    origin: { x: 120, y: 180 },
    releaseAgeTicks: 22,
    releaseFadeScale: 1.5,
    scale: 1,
  }
  const halfway = interpolatePrimarySpellState(
    state(projectile, hailstones),
    state(newerProjectile, newerHailstones),
    0.5,
    { newerTick: 12, olderTick: 10, targetTick: 11 },
  )
  const halfwayProjectile = halfway.projectiles[0]
  const halfwayHail = halfway.transients[0]
  assert.ok(halfwayProjectile?.kind === 'weld')
  assert.ok(halfwayHail?.kind === 'weld-persistent' && halfwayHail.buildId === 1008)
  assert.deepEqual(halfwayProjectile.position, { x: 45, y: 55 })
  assert.equal(halfwayProjectile.ageTicks, 11)
  assert.deepEqual(halfwayHail.origin, { x: 110, y: 190 })
  assert.equal(halfwayHail.releaseAgeTicks, 21)
  assert.equal(halfwayHail.releaseFadeScale, 1.375)
  assert.equal(halfwayHail.scale, 0.875)
})

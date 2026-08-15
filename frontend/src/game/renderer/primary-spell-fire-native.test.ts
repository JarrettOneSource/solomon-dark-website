import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeFirePatch } from '../core-kernels/primary-spell-fire-effects.ts'
import {
  nativeFireParticleFadeStep,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import type {
  PrimarySpellFireImpactState,
  PrimarySpellFireProjectileState,
  PrimarySpellFireEmberState,
  PrimarySpellFireGoodImpState,
  PrimarySpellFireParticleState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_FIREBALL_CORE_RECORD,
  NATIVE_FIREBALL_FRAME_FIRST,
  NATIVE_FIRE_IMPACT_FRAME_FIRST,
  NATIVE_FIRE_PATCH_FRAME_FIRST,
  NATIVE_FIRE_PARTICLE_FRAME_FIRST,
  nativeFireballLightSource,
  nativeFireballPlan,
  nativeFireEmberPlan,
  nativeFireGoodImpLightSource,
  nativeFireGoodImpPlan,
  nativeFireImpactLightSource,
  nativeFireImpactPlan,
  nativeFirePatchPlan,
  nativeFireParticlePlan,
} from './primary-spell-fire-native.ts'

function fireball(
  ageTicks: number,
  direction = { x: 0, y: -1 },
  underpowered = false,
): PrimarySpellFireProjectileState {
  return {
    ageTicks,
    charge: 1,
    damage: 4,
    direction,
    flightTicks: ageTicks,
    id: 17,
    kind: 'fire',
    ownerId: 'caster',
    phase: 'flight',
    position: { x: 400, y: 300 },
    underpowered,
    velocity: { x: direction.x * 4.5, y: direction.y * 4.5 },
    worldKey: 'hub:courtyard',
  }
}

function particle(id: number, ageTicks: number): PrimarySpellFireParticleState {
  return {
    ageTicks,
    direction: { x: 1, y: 0 },
    id,
    kind: 'fire',
    origin: { x: 100, y: 200 },
    ownerId: 'caster',
    variant: nativeFireParticleVariant(id),
    worldKey: 'hub:courtyard',
  }
}

function impact(id: number, ageTicks: number): PrimarySpellFireImpactState {
  return {
    ageTicks,
    id,
    kind: 'fire-impact',
    origin: { x: 400, y: 300 },
    ownerId: 'caster',
    worldKey: 'boneyard:run',
  }
}

test('pins Fireball frame clock, heading, transforms, and three-pass blend order', () => {
  assert.equal(nativeFireballPlan(fireball(2)).frameIndex, 0)
  assert.equal(nativeFireballPlan(fireball(3)).frameIndex, 1)
  assert.equal(nativeFireballPlan(fireball(35)).frameIndex, 11)
  assert.equal(nativeFireballPlan(fireball(36)).frameIndex, 0)

  const plan = nativeFireballPlan(fireball(3), 91)
  assert.deepEqual(plan.draws.map(({ pass }) => pass), [
    'core',
    'additive-body',
    'body',
  ])
  assert.deepEqual(plan.draws.map(({ blend }) => blend), ['normal', 'add', 'normal'])
  assert.deepEqual(plan.draws.map(({ frame }) => frame), [
    NATIVE_FIREBALL_CORE_RECORD,
    NATIVE_FIREBALL_FRAME_FIRST + 1,
    NATIVE_FIREBALL_FRAME_FIRST + 1,
  ])
  assert.deepEqual(plan.draws.map(({ scaleX, scaleY }) => [scaleX, scaleY]), [
    [3.2, 4],
    [2, 2.5],
    [2, 2.5],
  ])
  assert.deepEqual(plan.draws.map(({ x, y }) => [x, y]), [[0, -10], [0, -10], [0, -10]])
  assert.equal(plan.draws[0].alpha >= 0.2 && plan.draws[0].alpha < 0.45, true)
  assert.notEqual(plan.draws[0].alpha, nativeFireballPlan(fireball(3), 92).draws[0].alpha)
  assert.deepEqual(plan.draws.slice(1).map(({ alpha }) => alpha), [1, 0.5])
  assert.equal(plan.draws[0].rotation, 0)
  assert.equal(nativeFireballPlan(fireball(3, { x: 1, y: 0 })).draws[0].rotation, Math.PI / 2)
})

test('underpowered Fire halves only the three body draws', () => {
  const normal = nativeFireballPlan(fireball(3), 91)
  const weak = nativeFireballPlan(fireball(3, { x: 0, y: -1 }, true), 91)
  assert.deepEqual(
    weak.draws.map(({ alpha }) => alpha),
    normal.draws.map(({ alpha }) => alpha * 0.5),
  )
  assert.deepEqual(
    nativeFireballLightSource(fireball(3, { x: 0, y: -1 }, true), 91),
    nativeFireballLightSource(fireball(3), 91),
  )
})

test('projects one semantic Fire particle through the native birth and tick recurrence', () => {
  const id = 23
  const atBirth = nativeFireParticlePlan(particle(id, 0))
  const afterOneTick = nativeFireParticlePlan(particle(id, 1))
  const fadeStep = nativeFireParticleFadeStep(id)

  assert.equal(atBirth.frame, NATIVE_FIRE_PARTICLE_FRAME_FIRST + nativeFireParticleVariant(id))
  assert.equal(afterOneTick.position.x - atBirth.position.x, 2)
  assert.equal(afterOneTick.position.y - atBirth.position.y, 0)
  assert.ok(Math.abs(afterOneTick.rotation - atBirth.rotation - Math.PI / 180) < 1e-12)
  assert.ok(Math.abs(afterOneTick.scale / atBirth.scale - 0.95) < 1e-12)
  assert.ok(Math.abs(afterOneTick.alpha - (1 - fadeStep)) < 1e-12)
  assert.equal(afterOneTick.fadeStep, fadeStep)
  assert.equal(afterOneTick.worldY, afterOneTick.position.y + 30)

  const green = afterOneTick.tint >>> 8 & 0xff
  const blue = afterOneTick.tint & 0xff
  assert.equal(green, blue)
  assert.equal(green, Math.round((1 - fadeStep * 2) * 255))
})

test('uses deterministic Enhanced-Effects particle ranges and identity-derived lifetimes', () => {
  for (let id = 1; id <= 256; id += 1) {
    const fadeStep = nativeFireParticleFadeStep(id)
    const lifetime = nativeFireParticleLifetimeTicks(id)
    assert.equal(fadeStep >= 0.025 && fadeStep < 0.05, true)
    assert.equal(lifetime >= 21 && lifetime <= 41, true)
    assert.equal(nativeFireParticleVariant(id) >= 0, true)
    assert.equal(nativeFireParticleVariant(id) < 4, true)
    assert.deepEqual(nativeFireParticlePlan(particle(id, 7)), nativeFireParticlePlan(particle(id, 7)))
  }
})

test('pins outbound Fireball light and self-lit inbound render paths', () => {
  const body = nativeFireballPlan(fireball(10))
  const trail = nativeFireParticlePlan(particle(23, 4))
  const source = nativeFireballLightSource(fireball(10), 123)
  assert.equal(body.regionLightPoint, null)
  assert.equal(trail.regionLightPoint, null)
  assert.deepEqual(source.position, { x: 400, y: 300 })
  assert.equal(source.intensity, 0.75)
  assert.equal(source.castsDirectionalShadow, true)
  assert.equal(source.radius >= 1 && source.radius <= 1.25, true)
})

test('pins exact Fire impact frame clock, recurrence, blend order, and light ownership', () => {
  assert.equal(nativeFireImpactPlan(impact(41, 0)).frameIndex, 0)
  assert.equal(nativeFireImpactPlan(impact(41, 3)).frameIndex, 0)
  assert.equal(nativeFireImpactPlan(impact(41, 4)).frameIndex, 1)
  assert.equal(nativeFireImpactPlan(impact(41, 15)).frameIndex, 3)

  const atBirth = nativeFireImpactPlan(impact(41, 0))
  const afterOne = nativeFireImpactPlan(impact(41, 1))
  assert.deepEqual(atBirth.draws.map(({ blend, frame, pass }) => ({ blend, frame, pass })), [
    { blend: 'normal', frame: NATIVE_FIREBALL_CORE_RECORD, pass: 'core' },
    { blend: 'add', frame: NATIVE_FIRE_IMPACT_FRAME_FIRST, pass: 'burst' },
  ])
  assert.equal(atBirth.draws[0].alpha, 0.5)
  assert.equal(afterOne.draws[0].alpha, 0.5 * (1 - 1 / 16))
  assert.equal(afterOne.position.x, atBirth.position.x)
  assert.equal(afterOne.position.y, atBirth.position.y - 1)
  assert.equal(afterOne.draws[1].rotation - atBirth.draws[1].rotation !== 0, true)
  assert.equal(atBirth.draws[0].scaleX >= 5 && atBirth.draws[0].scaleX < 5.5, true)
  assert.equal(atBirth.draws[1].scaleX >= 1 && atBirth.draws[1].scaleX < 1.1, true)
  assert.equal(atBirth.regionLightPoint, null)
  assert.equal(atBirth.worldY, atBirth.position.y + 50)

  const light = nativeFireImpactLightSource(impact(41, 15))
  assert.deepEqual(light.position, { x: 400, y: 275 })
  assert.equal(light.radius, 1.5)
  assert.equal(light.intensity, 0.4)
  assert.equal(light.castsDirectionalShadow, false)
})

test('projects Ember glow and dual phase passes from native atlas records', () => {
  const ember = {
    ageTicks: 20,
    burnDamage: 4,
    damage: 8,
    height: -7,
    horizontalVelocity: { x: 0, y: 0 },
    id: 21,
    kind: 'fire-ember',
    life: 2.5,
    ownerId: 'caster',
    phase: 2.75,
    position: { x: 100, y: 200 },
    presentationVariant: 0,
    spentEmber: { kind: 'none' },
    verticalVelocity: -1,
    worldKey: 'hub:courtyard',
  } satisfies PrimarySpellFireEmberState
  const plan = nativeFireEmberPlan(ember)
  assert.deepEqual(plan.position, { x: 100, y: 193 })
  assert.deepEqual(plan.draws.map(({ blend, entry, role }) => ({ blend, entry, role })), [
    { blend: 'normal', entry: 15, role: 'glow' },
    { blend: 'add', entry: 269, role: 'additive-body' },
    { blend: 'normal', entry: 269, role: 'body' },
  ])
  assert.equal(plan.draws[0].alpha, 0.5)
  assert.equal(plan.draws[0].scale, 1)
  assert.deepEqual(plan.draws.slice(1).map(({ alpha }) => alpha), [1, 1])
})

test('projects common Fire patches through DeadHawg 46..77 with native alpha and scale', () => {
  const patch = createNativeFirePatch({
    burnDamage: 0,
    damage: 0,
    drawAlpha: 0.8,
    fadeAlpha: 0.75,
    id: 22,
    life: 0.5,
    nativeType: 'moving',
    ownerId: 'caster',
    position: { x: 40, y: 50 },
    scale: 2.75,
    worldKey: 'hub:courtyard',
  }, 17.75, 0.5)
  const plan = nativeFirePatchPlan(patch)
  assert.equal(plan.entry, NATIVE_FIRE_PATCH_FRAME_FIRST + 18)
  assert.equal(plan.alpha, 0.4)
  assert.equal(plan.scaleX, 1.1 * 2.75 * 0.75 * 0.5)
  assert.equal(plan.scaleY, 1.1 * 2.75 * 0.75)
  assert.equal(plan.blend, 'add')
  assert.deepEqual(plan.position, { x: 40, y: 30 })
})

test('projects GoodImp authoritative flight, upper flame, and detached contact bank', () => {
  const imp = {
    ageTicks: 4,
    bodyRotationDeg: 30,
    bodyScale: 0.98,
    bodyVariant: 2,
    bounceSoundIndex: 3,
    bounceSoundPitch: 1.05,
    bounceSoundSequence: 1,
    burnDamage: 9,
    collisionRadius: 1.5,
    contactAgeTicks: 12,
    contactOrigin: { x: 55, y: 25 },
    contactScale: 0.55,
    contactSoundIndex: 2,
    contactSoundPitch: 1.1,
    contactSoundSequence: 1,
    damage: 12,
    effectAlpha: 0.8,
    effectPhase: 4.2,
    flightSpeed: 4.5,
    headingDegrees: 0,
    id: 23,
    kind: 'fire-good-imp',
    lightGlow: 0.5,
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 4 },
    ownerId: 'caster',
    position: { x: 40, y: 50 },
    remainingTicks: 296,
    targetId: 'enemy:1',
    verticalOffset: -2,
    verticalVelocity: -3,
    worldKey: 'hub:courtyard',
  } satisfies PrimarySpellFireGoodImpState
  const plan = nativeFireGoodImpPlan(imp)
  assert.equal(plan.regionLightPoint?.x, 40)
  assert.deepEqual(plan.draws.map(({ entry, role }) => ({ entry, role })), [
    { entry: 309, role: 'body' },
    { entry: 337, role: 'upper-effect' },
    { entry: 254, role: 'contact' },
  ])
  assert.equal(plan.draws[0]!.alpha, 1)
  assert.equal(plan.draws[0]!.rotation, Math.PI / 6)
  assert.deepEqual(plan.draws[0]!.offset, { x: 0, y: -2 })
  assert.equal(plan.draws[1]!.alpha, 0.8)
  assert.deepEqual(plan.draws[2]!.offset, { x: 15, y: -25 })
  assert.equal(plan.draws[2]!.scale, 0.55)
  const light = nativeFireGoodImpLightSource(imp, 20)
  assert.equal(light.castsDirectionalShadow, false)
  assert.ok(light.intensity >= 0.375 && light.intensity <= 0.5)
  assert.ok(light.radius >= 0.15 && light.radius <= 0.35)
  assert.deepEqual(light.position, imp.position)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  nativeFireParticleFadeStep,
  nativeFireParticleLifetimeTicks,
  nativeFireParticleVariant,
} from '../core-kernels/primary-spell-fire-native.ts'
import type {
  PrimarySpellFireParticleState,
  PrimarySpellProjectileState,
} from '../core-kernels/primary-spells.ts'
import {
  NATIVE_FIREBALL_CORE_RECORD,
  NATIVE_FIREBALL_FRAME_FIRST,
  NATIVE_FIRE_PARTICLE_FRAME_FIRST,
  nativeFireballLightSource,
  nativeFireballPlan,
  nativeFireParticlePlan,
} from './primary-spell-fire-native.ts'

function fireball(
  ageTicks: number,
  direction = { x: 0, y: -1 },
): PrimarySpellProjectileState {
  return {
    ageTicks,
    charge: 1,
    direction,
    flightTicks: ageTicks,
    id: 17,
    kind: 'fire',
    ownerId: 'caster',
    phase: 'flight',
    position: { x: 400, y: 300 },
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
  assert.deepEqual(plan.draws.slice(1).map(({ alpha }) => alpha), [1, 0.5])
  assert.equal(plan.draws[0].rotation, 0)
  assert.equal(nativeFireballPlan(fireball(3, { x: 1, y: 0 })).draws[0].rotation, Math.PI / 2)
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
  assert.equal(source.multipleShadows, false)
  assert.equal(source.radius >= 1 && source.radius < 1.25, true)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativePlayerRescueProtection, stepNativePlayerRescueProtection } from './native-player-rescue.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'
import { createNativeWorldManagerOrder } from './native-world-manager-order.ts'

test('rescue protection lasts401 float stores and still births the final zero-alpha Sparkle', () => {
  let protection = { ...createNativePlayerRescueProtection(), fraction: 1 }
  let rng = createNativeRng(17)
  const initialRng = rng
  const order = createNativeWorldManagerOrder()
  for (let tick = 1; tick <= 401; tick += 1) {
    const result = stepNativePlayerRescueProtection(protection,
      { position: { x: tick, y: 80 }, register: order.register, worldKey: 'boneyard:rescue' }, rng)
    protection = result.protection
    rng = result.rng
    assert.equal(protection.nextParticleId, tick + 1)
    assert.equal(protection.particles.at(-1)?.alpha, protection.fraction)
    if (tick === 1) assert.equal(protection.fraction, .9975000023841858)
    if (tick === 400) assert.equal(protection.fraction, 8.828938007354736e-7)
  }
  assert.equal(protection.fraction, 0)
  assert.equal(protection.particles.at(-1)?.alpha, 0)
  assert.deepEqual(rng, advanceNativeRngWords(initialRng, 401 * 4))
  assert.equal(order.state().nextRegistrationOrdinal.transient, 401)
  const stopped = stepNativePlayerRescueProtection(protection,
    { position: { x: 1_000, y: 1_000 }, register: order.register, worldKey: 'boneyard:rescue' }, rng)
  assert.equal(stopped.protection.nextParticleId, 402)
  assert.equal(stopped.rng, rng)
  for (let tail = 0; tail < 60; tail += 1) {
    protection = stepNativePlayerRescueProtection(protection,
      { position: { x: 0, y: 0 }, register: order.register, worldKey: 'boneyard:rescue' }, rng).protection
  }
  assert.deepEqual(protection.particles, [])
})

test('Sparkles keep their birth alpha and world pose while the protected player moves', () => {
  const rng = createNativeRng(17)
  const order = createNativeWorldManagerOrder()
  const first = stepNativePlayerRescueProtection(
    { ...createNativePlayerRescueProtection(), fraction: 1 },
    { position: { x: 50, y: 100 }, register: order.register, worldKey: 'boneyard:rescue' }, rng,
  )
  const birth = first.protection.particles[0]!
  assert.ok(Math.hypot(birth.position.x - 50, birth.position.y - 65) <= 60.00001)
  const second = stepNativePlayerRescueProtection(first.protection,
    { position: { x: 1_000, y: 800 }, register: order.register, worldKey: 'boneyard:rescue' }, first.rng)
  const old = second.protection.particles[0]!
  assert.equal(old.alpha, birth.alpha)
  assert.equal(old.position.x, birth.position.x)
  assert.equal(old.position.y, Math.fround(birth.position.y - Math.fround(.1)))
  assert.equal(old.timer, Math.fround(180 - birth.decay))
  assert.ok(Math.hypot(second.protection.particles[1]!.position.x - 1_000,
    second.protection.particles[1]!.position.y - 765) <= 60.0001)
})

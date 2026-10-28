import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeCoffinEmergence } from './native-coffin-emergence.ts'
import { createNativeRng } from './native-rng.ts'
import { stepNativeBoulderDebrisMotion } from './native-weld-boulder-debris.ts'

test('Coffin emergence retains twenty independent exact art records with quality-latched life and unchanged draw program', () => {
  for (const seed of [1, 42, 734]) {
    const on = createNativeCoffinEmergence(createNativeRng(seed), { x: 90, y: 150 }, 1, 30, true)
    const off = createNativeCoffinEmergence(createNativeRng(seed), { x: 90, y: 150 }, 1, 30, false)
    assert.equal(on.particles.length, 20)
    assert.deepEqual(on.rng, off.rng)
    for (const [index, particle] of off.particles.entries()) {
      assert.deepEqual({ ...particle, alpha: 10, enhancedShadow: true }, on.particles[index])
      assert.ok(particle.record === 1834 || particle.record === 1835)
      assert.ok(particle.scale >= .59999 && particle.scale <= 1.00001)
      assert.ok(particle.height <= 0 && particle.height >= -50)
    }
    for (const birth of [on, off]) {
      let particles = [...birth.particles]
      let rng = birth.rng
      for (let tick = 1; tick <= 400; tick++) {
        particles = particles.flatMap(particle => {
          const next = stepNativeBoulderDebrisMotion(particle, tick, rng)
          rng = next.rng
          if (next.particle) assert.equal(next.particle.enhancedShadow, particle.enhancedShadow)
          return next.particle ? [next.particle] : []
        })
      }
      assert.deepEqual(particles, [])
    }
  }
})

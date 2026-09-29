import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from './native-rng.ts'
import { createNativeGolemAssemblyDebris } from './native-golem-debris.ts'
import { stepNativeWeldBoulderDebrisParticle } from './native-weld-boulder-debris.ts'

test('all Golem assembly debris use twenty-four exact independent birth records and the same draw count in both modes', () => {
  for (const scale of [.25, .6, 1, 2]) {
    for (const seed of [1, 42, 12345]) {
      const on = createNativeGolemAssemblyDebris(createNativeRng(seed), scale, true)
      const off = createNativeGolemAssemblyDebris(createNativeRng(seed), scale, false)
      assert.equal(on.particles.length, 24)
      assert.equal(off.particles.length, 24)
      assert.deepEqual(on.rng, off.rng)
      assert.notDeepEqual(on.rng, createNativeRng(seed))
      for (const [i, child] of off.particles.entries()) {
        assert.deepEqual({ ...child, alpha: 10, enhancedShadow: true }, on.particles[i])
        assert.equal(child.index, i)
        assert.ok(child.record >= 2008 && child.record <= 2010)
        assert.equal(child.alpha, 2)
        assert.ok(child.scale > 0 && child.scale <= .488)
        assert.ok(child.height <= 0 && child.height >= -Math.min(scale, 1) * 50)
        assert.ok(child.bounceVelocity >= -5 && child.bounceVelocity <= -2)
      }
      for (const birth of [on, off]) {
        let particles = [...birth.particles]
        let rng = birth.rng
        for (let tick = 1; tick <= 400; tick++) {
          particles = particles.flatMap(child => {
            const next = stepNativeWeldBoulderDebrisParticle(child, tick, rng)
            rng = next.rng
            if (next.particle) assert.equal(next.particle.enhancedShadow, child.enhancedShadow)
            return next.particle ? [next.particle] : []
          })
        }
        assert.deepEqual(particles, [])
      }
    }
  }
})

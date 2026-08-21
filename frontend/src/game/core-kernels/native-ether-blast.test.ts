import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advanceNativeEtherBlastCharge,
  createNativeEtherBlastParticleProgram,
  nativeEtherBlastDamage,
  nativeEtherBlastParticleFrame,
  nativeEtherBlastPulseOrigin,
  nativeEtherBlastReleaseCharges,
  NATIVE_ETHER_BLAST_PARTICLE_COUNT,
  NATIVE_ETHER_BLAST_PRESENTATION_RNG_WORDS,
} from './native-ether-blast.ts'
import { advanceNativeRngWords, createNativeRng } from './native-rng.ts'

test('Ether Blast charges in native float32 steps, cues at integers, and honors reset gates', () => {
  const ordinary = advanceNativeEtherBlastCharge(Math.fround(0.5), 4, true, false)
  assert.equal(ordinary.charge, Math.fround(Math.fround(0.5) + Math.fround(0.00700000022)))
  assert.equal(ordinary.crossedInteger, false)

  const crossing = advanceNativeEtherBlastCharge(Math.fround(0.999), 4, true, false)
  assert.equal(crossing.crossedInteger, true)
  assert.ok(crossing.charge >= 1)
  assert.deepEqual(advanceNativeEtherBlastCharge(3, 4, false, false), {
    charge: 0,
    crossedInteger: false,
  })
  assert.deepEqual(advanceNativeEtherBlastCharge(3, 4, true, true), {
    charge: 0,
    crossedInteger: false,
  })
  assert.equal(advanceNativeEtherBlastCharge(4, 4, true, false).charge, 4)
})

test('Ether Blast release rounds positive charge and damages current HP, never maximum HP', () => {
  assert.equal(nativeEtherBlastReleaseCharges(Math.fround(0.49)), 0)
  assert.equal(nativeEtherBlastReleaseCharges(Math.fround(0.51)), 1)
  assert.equal(nativeEtherBlastDamage(1, 100), Math.fround(15.000000953674316))
  assert.equal(nativeEtherBlastDamage(6, 100), Math.fround(90))
  assert.equal(nativeEtherBlastDamage(7, 100), Math.fround(95))
  assert.equal(nativeEtherBlastDamage(4, 0), Math.fround(0.001))
  assert.deepEqual(
    nativeEtherBlastPulseOrigin({ x: 10, y: 20 }, { x: 0, y: -1 }),
    { x: 10, y: -80 },
  )
})

test('Ether Blast creates the exact 36 plus 72 particle census and consumes 720 RNG words', () => {
  const source = createNativeRng(0x14)
  const program = createNativeEtherBlastParticleProgram(source)
  assert.equal(program.particles.length, NATIVE_ETHER_BLAST_PARTICLE_COUNT)
  assert.equal(program.particles.filter(({ spriteRecord }) => spriteRecord === 11).length, 36)
  assert.equal(program.particles.filter(({ spriteRecord }) => spriteRecord === 45).length, 72)
  assert.deepEqual(
    program.rng,
    advanceNativeRngWords(source, NATIVE_ETHER_BLAST_PRESENTATION_RNG_WORDS),
  )
  for (const particle of program.particles) {
    assert.ok(particle.scale >= 1 && particle.scale <= 5)
    assert.equal(particle.damping, Math.fround(0.95))
    if (particle.spriteRecord === 11) {
      assert.equal(particle.green, Math.fround(0.5))
      assert.ok(particle.alphaLoss >= 0.01 && particle.alphaLoss <= 0.015)
    } else {
      assert.ok(particle.green >= 0.5 && particle.green <= 1.3)
      assert.ok(particle.alphaLoss >= 0.025 && particle.alphaLoss <= 0.05)
    }
  }
})

test('Ether Blast particles move with native damping and fade independently', () => {
  const particle = createNativeEtherBlastParticleProgram(createNativeRng(9)).particles[0]!
  const first = nativeEtherBlastParticleFrame(particle, 1)
  assert.equal(first.position.x, Math.fround(particle.offset.x + particle.velocity.x))
  assert.equal(first.position.y, Math.fround(particle.offset.y + particle.velocity.y))
  assert.equal(first.alpha, Math.fround(1 - particle.alphaLoss))
  assert.equal(nativeEtherBlastParticleFrame(particle, 100).alpha, 0)
})

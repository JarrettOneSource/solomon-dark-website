import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advanceNativeRngWords,
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from './native-rng.ts'
import {
  NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS,
  createNativeWeldBoulderDebrisParticle,
  createNativeWeldBoulderContactDebrisProgram,
  createNativeWeldEtherealBoulderBreakupDebrisProgram,
  createNativeWeldEtherealBoulderWeakDebrisProgram,
  stepNativeWeldBoulderDebrisParticle,
} from './native-weld-boulder-debris.ts'

test('weak EBoulder debris preserves native count, macro redraw, and field order', () => {
  const source = createNativeRng(71)
  const scale = 1
  const program = createNativeWeldEtherealBoulderWeakDebrisProgram({
    direction: { x: 1, y: 0 },
    rng: source,
    scale,
  })
  assert.equal(program.debris.length, 30)
  assert.equal(NATIVE_BOULDER_DEBRIS_MAX_LIFETIME_TICKS, 400)

  let expected = drawNativeFloat(source, 360).state
  let scaleRedraws = 0
  for (let index = 0; index < 30; index += 1) {
    expected = drawNativeFloat(expected, 3).state
    expected = drawNativeFloat(expected, 20).state
    expected = drawNativeFloat(expected, 360).state
    expected = drawNativeFloat(expected, 10).state
    expected = drawNativeFloat(expected, Math.fround(0.5)).state
    expected = drawNativeInteger(expected, 3).state
    expected = drawNativeFloat(expected, Math.fround(1.5)).state
    expected = drawNativeFloat(expected, 50).state
    expected = drawNativeFloat(expected, 40).state
    const comparison = drawNativeFloat(expected, Math.fround(0.75))
    expected = comparison.state
    if (Math.fround(comparison.value + 0.5) >= Math.fround(0.45)) {
      expected = drawNativeFloat(expected, Math.fround(0.75)).state
      scaleRedraws += 1
    }
    expected = drawNativeFloat(expected, Math.fround(1.5)).state
    expected = drawNativeFloat(expected, Math.fround(4), true).state
  }
  assert.equal(scaleRedraws, 30)
  assert.deepEqual(program.rng, expected)
  assert.ok(program.debris.every(({ alpha, record, scale: visualScale }) => (
    alpha === 2
    && record >= 2008 && record <= 2010
    && visualScale > 0
    && visualScale <= Math.fround(0.75 * 0.75)
  )))
})

test('shared Boulder contact emits one independent native BoulderBit', () => {
  const source = createNativeRng(101)
  const program = createNativeWeldBoulderContactDebrisProgram({ rng: source, scale: 0.75 })
  assert.equal(program.debris.length, 1)
  assert.ok(program.debris[0]!.record >= 2008 && program.debris[0]!.record <= 2010)
  assert.ok(program.debris[0]!.scale > 0 && program.debris[0]!.scale <= 0.75)
  // The fixed path consumes ten words; the native MAX macro may consume one more.
  assert.ok(
    JSON.stringify(program.rng) === JSON.stringify(advanceNativeRngWords(source, 10))
    || JSON.stringify(program.rng) === JSON.stringify(advanceNativeRngWords(source, 11)),
  )
})

test('terminal EBoulder emits its complete saved-scale BoulderBit family', () => {
  const program = createNativeWeldEtherealBoulderBreakupDebrisProgram({
    rng: createNativeRng(202),
    scale: 0.5,
  })
  assert.equal(program.debris.length, 15)
  assert.ok(program.debris.every((fragment) => (
    fragment.record >= 2008
    && fragment.record <= 2010
    && fragment.scale > 0
    && fragment.scale <= 0.75
    && Math.hypot(fragment.position.x, fragment.position.y) <= 22.5
  )))
})

test('weak EBoulder debris uses the eight-piece floor and forward spawn socket', () => {
  const program = createNativeWeldEtherealBoulderWeakDebrisProgram({
    direction: { x: 0, y: -1 },
    rng: createNativeRng(9),
    scale: Math.fround(0.2),
  })
  assert.equal(program.debris.length, 8)
  assert.ok(program.debris.every(({ position }) => position.y < 0))
})

test('BoulderBit recurrence preserves modulo-three skips and sequential native fade', () => {
  const seed = createNativeWeldBoulderContactDebrisProgram({
    rng: createNativeRng(303),
    scale: 0.75,
  }).debris[0]!
  const particle = createNativeWeldBoulderDebrisParticle(seed)
  assert.equal(particle.alpha, 10)
  assert.equal(createNativeWeldBoulderDebrisParticle(seed, false).alpha, 2)
  const skipped = stepNativeWeldBoulderDebrisParticle(particle, 3, createNativeRng(4))
  assert.ok(skipped.particle)
  assert.deepEqual(skipped.particle.position, particle.position)
  assert.equal(skipped.particle.alpha, Math.fround(10 - Math.fround(0.025)))

  const advanced = stepNativeWeldBoulderDebrisParticle(
    skipped.particle,
    4,
    skipped.rng,
  )
  assert.ok(advanced.particle)
  assert.deepEqual(advanced.particle.position, {
    x: Math.fround(particle.position.x + particle.velocity.x),
    y: Math.fround(particle.position.y + particle.velocity.y),
  })
  assert.equal(advanced.particle.alpha, Math.fround(
    Math.fround(skipped.particle.alpha - Math.fround(0.015))
      - Math.fround(0.025),
  ))
})

test('BoulderBit bounce rerolls spin and damping in two-word order', () => {
  const sourceRng = createNativeRng(404)
  const particle = createNativeWeldBoulderDebrisParticle({
    alpha: 2,
    colorGreen: 0.25,
    height: Math.fround(-0.1),
    index: 0,
    position: { x: 0, y: 0 },
    record: 2008,
    rotationDegrees: 0,
    rotationStepDegrees: 1,
    scale: 0.5,
    velocity: { x: 1, y: 0 },
    verticalVelocity: 1,
  })
  const stepped = stepNativeWeldBoulderDebrisParticle(
    { ...particle, bounceVelocity: -3 },
    4,
    sourceRng,
  )
  assert.ok(stepped.particle)
  assert.equal(stepped.particle.bounceVelocity, Math.fround(-3 * Math.fround(0.3)))
  assert.equal(stepped.particle.height, stepped.particle.verticalVelocity)
  assert.deepEqual(stepped.rng, advanceNativeRngWords(sourceRng, 2))
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createNativeWeldHailContactPresentation,
  createNativeWeldHailKnockback,
  createNativeWeldHailTerrainImpact,
  stepNativeWeldHailChild,
  type NativeWeldHailTerrainBouncerState,
} from './native-weld-hail-contact.ts'
import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
} from './native-rng.ts'
import type { NativeWeldHailstonesState } from './native-weld-primary-runtime.ts'

test('Hail terrain contact consumes the exact 75-plus-8 word program per rock', () => {
  const actor = hailActor()
  const sourceRng = createNativeRng(813)
  const result = createNativeWeldHailTerrainImpact({
    actor,
    enhancedEffects: true,
    firstId: 50,
    rng: sourceRng,
    tick: 9,
  })
  assert.equal(result.actors.length, 16)
  assert.deepEqual(result.actors.map(({ id }) => id), Array.from(
    { length: 16 },
    (_, index) => 50 + index,
  ))
  assert.ok(result.actors.slice(0, 15).every((child) => (
    child.kind === 'weld-hail-terrain-particle' && child.record === 45
  )))
  const bouncer = result.actors[15]
  assert.ok(bouncer?.kind === 'weld-hail-terrain-bouncer')
  assert.equal(bouncer.record, 32)
  assert.equal(bouncer.enhancedShadow, true)

  let expected = sourceRng
  for (let index = 0; index < 15; index += 1) {
    expected = drawNativeInteger(expected, 5).state
    expected = drawNativeFloat(expected, 4).state
    expected = drawNativeFloat(expected, 5).state
    expected = drawNativeFloat(expected, Math.fround(0.25)).state
    expected = drawNativeFloat(expected, Math.fround(0.75)).state
  }
  expected = drawNativeFloat(expected, 3).state
  expected = drawNativeFloat(expected, 20).state
  expected = drawNativeFloat(expected, 360).state
  expected = drawNativeFloat(expected, 10).state
  expected = drawNativeFloat(expected, Math.fround(0.25)).state
  expected = drawNativeFloat(expected, 10).state
  expected = drawNativeFloat(expected, 1).state
  expected = drawNativeFloat(expected, 10).state
  assert.deepEqual(result.rng, expected)
})

test('Hail terrain children retain native fade, drag, and global modulo-three bounce lanes', () => {
  const result = createNativeWeldHailTerrainImpact({
    actor: hailActor(),
    enhancedEffects: true,
    firstId: 1,
    rng: createNativeRng(19),
    tick: 2,
  })
  const particle = result.actors[0]!
  assert.equal(particle.kind, 'weld-hail-terrain-particle')
  const particleStep = stepNativeWeldHailChild(particle, result.rng)
  assert.ok(particleStep.actor?.kind === 'weld-hail-terrain-particle')
  assert.equal(particleStep.actor.alpha, Math.fround(particle.alpha - 0.125))
  assert.deepEqual(particleStep.actor.position, {
    x: Math.fround(particle.position.x + particle.velocity.x),
    y: Math.fround(particle.position.y + particle.velocity.y),
  })
  assert.deepEqual(particleStep.actor.velocity, {
    x: Math.fround(particle.velocity.x * Math.fround(0.92)),
    y: Math.fround(particle.velocity.y * Math.fround(0.92)),
  })

  const bouncer = result.actors.at(-1)
  assert.ok(bouncer?.kind === 'weld-hail-terrain-bouncer')
  const skipped = stepNativeWeldHailChild(bouncer, result.rng)
  assert.ok(skipped.actor?.kind === 'weld-hail-terrain-bouncer')
  assert.deepEqual(skipped.actor.position, bouncer.position)
  assert.equal(skipped.actor.alpha, bouncer.alpha)
  const advanced = stepNativeWeldHailChild(
    skipped.actor as NativeWeldHailTerrainBouncerState,
    skipped.rng,
  )
  assert.ok(advanced.actor?.kind === 'weld-hail-terrain-bouncer')
  assert.equal(advanced.actor.alpha, Math.fround(bouncer.alpha - 0.015))
  assert.equal(
    advanced.actor.verticalVelocity,
    Math.fround(bouncer.verticalVelocity + Math.fround(0.4)),
  )
})

test('depleted Hail rocks spend one line-color word and retain independent line and flash clocks', () => {
  const sourceRng = createNativeRng(21)
  const result = createNativeWeldHailContactPresentation({
    actor: hailActor(),
    end: { x: 15, y: 16 },
    firstId: 20,
    rng: sourceRng,
    start: { x: 10, y: 11 },
    tick: 8,
  })
  assert.deepEqual(result.actors.map(({ kind, id }) => ({ id, kind })), [{
    id: 20,
    kind: 'weld-hail-line',
  }, {
    id: 21,
    kind: 'weld-hail-flash',
  }])
  assert.deepEqual(result.rng, drawNativeFloat(sourceRng, Math.fround(0.25)).state)
  const line = result.actors[0]
  const flash = result.actors[1]
  const steppedLine = stepNativeWeldHailChild(line, result.rng)
  const steppedFlash = stepNativeWeldHailChild(flash, result.rng)
  assert.ok(steppedLine.actor?.kind === 'weld-hail-line')
  assert.ok(steppedFlash.actor?.kind === 'weld-hail-flash')
  assert.equal(steppedLine.actor.alpha, Math.fround(1 - Math.fround(0.075)))
  assert.equal(steppedFlash.actor.alpha, Math.fround(1 - Math.fround(0.1)))
})

test('Hail Knockback uses tie-to-even push times twenty and a unit cast displacement', () => {
  const actor = hailActor({ pushback: Math.fround(0.125) })
  const even = createNativeWeldHailKnockback({
    actor,
    id: 4,
    targetId: 'enemy:1',
    tick: 5,
  })
  assert.ok(even)
  assert.equal(even.remainingTicks, 2)
  assert.deepEqual(even.delta, actor.direction)
  const odd = createNativeWeldHailKnockback({
    actor: hailActor({ pushback: Math.fround(0.175) }),
    id: 5,
    targetId: 'enemy:1',
    tick: 5,
  })
  assert.equal(odd?.remainingTicks, 3)
  assert.equal(createNativeWeldHailKnockback({
    actor: hailActor({ pushback: 0 }),
    id: 6,
    targetId: 'enemy:1',
    tick: 5,
  }), null)
})

function hailActor(
  overrides: Partial<NativeWeldHailstonesState> = {},
): NativeWeldHailstonesState {
  return {
    ageTicks: 3,
    birthTick: 1,
    buildId: 1008,
    collisionRadius: 40,
    damage: 10,
    direction: { x: 1, y: 0 },
    id: 7,
    kind: 'weld-persistent',
    lightRegistration: { managerLane: 'actor', registrationOrdinal: 7 },
    maximumScale: 1,
    origin: { x: 0, y: 0 },
    ownerId: 'wizard',
    phase: 'flight',
    pulseSequence: 1,
    pushback: 0.2,
    releaseAgeTicks: 1,
    releaseFadeScale: 1,
    rocks: [{
      damageRemaining: 10,
      decay: 1,
      localPosition: { x: 1, y: 0, z: 0 },
      phase: 1,
      releaseOffset: { x: 1, y: 50 },
      rockId: 0,
      spriteRecord: 168,
      visualScale: 0.2,
    }],
    scale: 0.5,
    toughness: 2,
    vector: [10, 2, 1, 2, 0.2, 0.5],
    widen: 0.5,
    worldKey: 'boneyard:1',
    ...overrides,
  }
}

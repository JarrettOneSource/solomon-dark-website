import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EARTH_BOULDER_GLIMMER_RECORD,
  EARTH_BOULDER_GLIMMER_SCALE,
  EARTH_BOULDER_DEPTH_PLANE,
  EARTH_BOULDER_DRAW_SCALE_MINIMUM,
  EARTH_BOULDER_FRAGMENT_FADE_PER_TICK,
  EARTH_BOULDER_MAIN_RECORDS,
  EARTH_BOULDER_OPENING_FADE_PER_TICK,
  EARTH_BOULDER_LIT_RECORDS,
  earthBoulderImpactPlan,
  earthBoulderPresentationPlan,
} from './earth-boulder-presentation.ts'

function held(ageTicks: number, charge: number, id = 17) {
  return earthBoulderPresentationPlan({
    ageTicks,
    charge,
    flightTicks: 0,
    id,
    phase: 'held' as const,
  })
}

test('Earth constructs the native center rock and Fibonacci shell counts', () => {
  const initial = held(1, Math.fround(0.18))
  const release = held(97, Math.fround(0.3012498915195465))
  const full = held(656, 1)

  assert.equal(initial.rocks.length, 7)
  assert.equal(release.rocks.length, 11)
  assert.equal(full.rocks.length, 31)
  const center = initial.rocks.find((rock) => rock.shellIndex === null)
  assert.ok(center)
  assert.deepEqual(center.local, { x: 0, y: 0, z: 0 })
  assert.equal(center.record, 171)
  assert.equal(center.scale, 4 * Math.fround(0.18))
  assert.equal(center.storedScale, center.scale)

  const n = 30 * Math.fround(0.18)
  const expectedY = (-1 + 1 / n) * n
  const firstShell = initial.rocks.find((rock) => rock.shellIndex === 0)
  assert.ok(firstShell)
  assert.ok(Math.abs(firstShell.local.y - expectedY) < 1e-9)
  assert.ok(initial.rocks.every((rock) => EARTH_BOULDER_MAIN_RECORDS.includes(rock.record)))
  assert.deepEqual(held(1, Math.fround(0.18)), initial)
})

test('Earth freezes its native 3D body orientation on release and depth sorts it', () => {
  const heldPlan = held(97, Math.fround(0.3012498915195465))
  const released = earthBoulderPresentationPlan({
    ageTicks: 127,
    charge: Math.fround(0.3012498915195465),
    flightTicks: 30,
    id: 17,
    phase: 'flight',
  })

  assert.equal(released.orientationTicks, 97)
  assert.deepEqual(released.rocks, heldPlan.rocks)
  for (let index = 1; index < released.rocks.length; index += 1) {
    assert.ok(released.rocks[index - 1].transformed.z <= released.rocks[index].transformed.z)
  }
})

test('rank-1 shell stays in front of the native depth plane and projects X/Y orthographically', () => {
  for (let ageTicks = 0; ageTicks <= 480; ageTicks += 1) {
    const plan = held(ageTicks, 1)
    assert.equal(plan.rocks.length, 31)
    for (const rock of plan.rocks) {
      assert.ok(rock.transformed.z > EARTH_BOULDER_DEPTH_PLANE)
      assert.deepEqual(rock.position, {
        x: rock.transformed.x,
        y: rock.transformed.y,
      })
    }
  }
})

test('main rocks use the native float32 draw-scale floor', () => {
  const opening = held(1, Math.fround(0.18))
  const clamped = opening.rocks.filter((rock) => rock.storedScale < EARTH_BOULDER_DRAW_SCALE_MINIMUM)

  assert.ok(clamped.length > 0)
  assert.ok(clamped.every((rock) => rock.scale === EARTH_BOULDER_DRAW_SCALE_MINIMUM))
  assert.ok(opening.rocks.every((rock) => (
    rock.scale === Math.max(EARTH_BOULDER_DRAW_SCALE_MINIMUM, rock.storedScale)
  )))
})

test('record 86 crossfades away while the real rock body crossfades in', () => {
  const opening = held(0, Math.fround(0.18))
  const middle = held(10, Math.fround(0.18))
  const mature = held(29, Math.fround(0.18))

  assert.equal(opening.glimmer.record, EARTH_BOULDER_GLIMMER_RECORD)
  assert.equal(opening.glimmer.alpha, 1)
  assert.equal(opening.bodyAlpha, 0)
  assert.equal(opening.glimmer.scale, EARTH_BOULDER_GLIMMER_SCALE * Math.fround(0.18))
  assert.equal(middle.glimmer.alpha, 1 - 10 * EARTH_BOULDER_OPENING_FADE_PER_TICK)
  assert.equal(middle.bodyAlpha, 10 * EARTH_BOULDER_OPENING_FADE_PER_TICK)
  assert.equal(mature.glimmer.alpha, 0)
  assert.equal(mature.bodyAlpha, 1)
})

test('called rocks use the lit bank, native cadence, and accelerating inward path', () => {
  const early = held(24, Math.fround(0.21))
  assert.ok(early.calledRocks.length > 0)
  assert.ok(early.calledRocks.every((rock) => EARTH_BOULDER_LIT_RECORDS.includes(rock.record)))
  assert.ok(early.calledRocks.every((rock) => rock.spawnTick <= 24))
  assert.ok(early.calledRocks.every((rock) => rock.speed <= 5))
  assert.ok(early.calledRocks.every((rock) => rock.distance <= rock.spawnDistance))
  assert.ok(early.calledRocks.some((rock) => rock.distance < rock.spawnDistance))

  const late = held(120, Math.fround(0.33))
  const lateAgain = held(120, Math.fround(0.33))
  assert.deepEqual(lateAgain.calledRocks, late.calledRocks)
  assert.ok(late.calledRocks.length < 120)

  const released = earthBoulderPresentationPlan({
    ageTicks: 130,
    charge: Math.fround(0.33),
    flightTicks: 10,
    id: 17,
    phase: 'flight',
  })
  assert.ok(released.calledRocks.every((rock) => rock.spawnTick <= 120))
  assert.ok(released.calledRocks.every((rock) => rock.falling))
})

test('Earth impact scatters the native lit family with the native minimum and fade', () => {
  const minimum = earthBoulderImpactPlan({ ageTicks: 0, charge: Math.fround(0.18), id: 17 })
  const full = earthBoulderImpactPlan({ ageTicks: 0, charge: 1, id: 17 })
  const fading = earthBoulderImpactPlan({ ageTicks: 10, charge: 1, id: 17 })

  assert.equal(minimum.fragments.length, 8)
  assert.equal(full.fragments.length, 30)
  assert.ok(full.fragments.every((fragment) => EARTH_BOULDER_LIT_RECORDS.includes(fragment.record)))
  assert.deepEqual(earthBoulderImpactPlan({ ageTicks: 0, charge: 1, id: 17 }), full)
  assert.equal(full.alpha, 1)
  assert.equal(fading.alpha, 1 - 10 * EARTH_BOULDER_FRAGMENT_FADE_PER_TICK)
  assert.ok(fading.fragments.some((fragment, index) => (
    fragment.position.x !== full.fragments[index].position.x
    || fragment.position.y !== full.fragments[index].position.y
  )))
})

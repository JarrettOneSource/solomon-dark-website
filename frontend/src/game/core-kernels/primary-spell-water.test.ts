import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrimarySpellWaterTransientState } from './primary-spells.ts'
import {
  WATER_FROST_PARTICLES_PER_TICK,
  multiplyWaterFrostTint,
  waterFrostJetEmission,
  waterFrostJetLifetimeTicks,
  waterFrostJetObstructionPoint,
  waterFrostJetPlan,
} from './primary-spell-water.ts'

function state(id: number, ageTicks = 0, variant = 0): PrimarySpellWaterTransientState {
  return {
    ageTicks,
    direction: { x: 0, y: -1 },
    id,
    kind: 'water',
    obstructionPoint: null,
    origin: { x: 100, y: 200 },
    ownerId: 'caster',
    variant,
    worldKey: 'hub:room',
  }
}

function firstId(kind: 'normal' | 'over'): number {
  for (let id = 1; id < 100; id += 1) {
    if (waterFrostJetPlan(state(id)).kind === kind) return id
  }
  throw new Error(`No deterministic ${kind} Frost sample in the first 99 ids`)
}

function assertNear(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)
}

test('pins the shipped Enhanced Effects density and native lifetime band', () => {
  assert.equal(WATER_FROST_PARTICLES_PER_TICK, 2)
  const lifetimes = Array.from({ length: 256 }, (_, index) => (
    waterFrostJetLifetimeTicks(index + 1)
  ))
  assert.deepEqual([...new Set(lifetimes)].sort(), [32, 33])
})

test('deterministically preserves the native 75 percent Normal / 25 percent Over split', () => {
  const kinds = Array.from({ length: 4096 }, (_, index) => (
    waterFrostJetPlan(state(index + 1)).kind
  ))
  const overCount = kinds.filter((kind) => kind === 'over').length
  assert.ok(overCount >= 960 && overCount <= 1088, `unexpected Over count ${overCount}`)
  assert.deepEqual(waterFrostJetPlan(state(41)), waterFrostJetPlan(state(41)))
})

test('birth owns world-tick wiggle while radial jitter stays around the caster heading', () => {
  const emitter = { x: 100, y: 200 }
  const first = waterFrostJetEmission(emitter, { x: 0, y: -1 }, 3, 0, 36)
  const born = waterFrostJetEmission(emitter, { x: 0, y: -1 }, 3, 1, 37)
  const samePhase = waterFrostJetEmission(emitter, { x: 0, y: -1 }, 3, 1, 9001)
  const nativePi = Math.fround(Math.PI)
  const firstHeading = Math.sin(3 * 65 * nativePi / 180) * nativePi / 180
  const expectedHeading = Math.sin((3 + 32.5) * 65 * nativePi / 180) * nativePi / 180

  assert.equal(first.direction.x, Math.fround(Math.sin(firstHeading)))
  assert.equal(first.direction.y, Math.fround(-Math.cos(firstHeading)))
  assert.equal(born.direction.x, Math.fround(Math.sin(expectedHeading)))
  assert.equal(born.direction.y, Math.fround(-Math.cos(expectedHeading)))
  assert.notDeepEqual(first.direction, born.direction)
  assert.deepEqual(born.direction, samePhase.direction)
  assert.ok(Math.abs(Math.atan2(first.direction.x, -first.direction.y)) <= Math.PI / 180)
  assert.ok(Math.abs(Math.atan2(born.direction.x, -born.direction.y)) <= Math.PI / 180)
  const jitter = { x: born.origin.x - emitter.x, y: born.origin.y - emitter.y }
  assert.ok(Math.hypot(jitter.x, jitter.y) <= 10)
  assert.ok(Math.abs(Math.atan2(jitter.x, -jitter.y)) <= 45 * Math.PI / 180)
})

test('Normal snapshots only forward obstruction and replays snap, perpendicular, half-speed splay', () => {
  const normalId = firstId('normal')
  const overId = firstId('over')
  const emission = {
    direction: { x: 1, y: 0 },
    jitterRadius: 0,
    origin: { x: 0, y: 0 },
  }
  let clipCalls = 0
  assert.deepEqual(waterFrostJetObstructionPoint(
    emission,
    { x: 0, y: 0 },
    normalId,
    (_start, _end) => {
      clipCalls += 1
      return { x: 8, y: 0 }
    },
  ), { x: 8, y: 0 })
  assert.equal(waterFrostJetObstructionPoint(
    emission,
    { x: 0, y: 0 },
    overId,
    () => {
      clipCalls += 1
      return { x: 8, y: 0 }
    },
  ), null)
  assert.equal(clipCalls, 1)
  assert.equal(waterFrostJetObstructionPoint(
    { ...emission, origin: { x: 10, y: 0 } },
    { x: 0, y: 0 },
    normalId,
    () => ({ x: 5, y: 0 }),
  ), null)

  const moving = state(normalId, 3)
  moving.direction = { x: 1, y: 0 }
  moving.origin = { x: 0, y: 0 }
  moving.obstructionPoint = { x: 8, y: 0 }
  const plan = waterFrostJetPlan(moving)
  assert.equal(plan.position.x, 8)
  assert.equal(Math.abs(plan.position.y), 2)
  assert.deepEqual(
    { x: Math.abs(plan.velocity.x), y: Math.abs(plan.velocity.y) },
    { x: 0, y: 2 },
  )
  assert.equal(plan.heading, Math.PI / 2)
  assert.equal(Math.abs(plan.draws.at(-1)!.position.y - plan.position.y), 6)
})

test('Normal uses the native ordinary core, additive half-core, and forward glint', () => {
  const id = firstId('normal')
  const created = waterFrostJetPlan(state(id))
  const updated = waterFrostJetPlan(state(id, 1))

  assert.equal(created.kind, 'normal')
  assert.deepEqual(created.draws.map(({ blend, sprite }) => [sprite, blend]), [
    ['core', 'normal'],
    ['core', 'add'],
    ['glint', 'add'],
  ])
  assert.equal(created.draws[0].alpha, 0)
  assert.deepEqual(created.draws[0].color, { blue: 1, green: 1, red: 0 })
  assert.equal(created.draws[1].alpha, 0.75)
  assert.equal(created.draws[1].scale, created.coreScale * 0.5)
  assert.equal(created.draws[2].alpha, 1)
  assert.equal(created.draws[2].scale, Math.min(created.glintScale, 1))
  assert.equal(created.coreScale, 0.5249603986740112)

  assert.equal(Math.hypot(updated.velocity.x, updated.velocity.y), 4)
  assertNear(updated.position.x - created.position.x, updated.velocity.x)
  assertNear(updated.position.y - created.position.y, updated.velocity.y)
  assert.equal(updated.draws[0].alpha, 0.05000000074505806)
  assert.deepEqual(updated.draws[0].color, {
    blue: 1,
    green: 1,
    red: 0.03185528516769409,
  })
  assertNear(
    updated.draws[2].position.x - updated.position.x,
    updated.velocity.x * 3,
  )
  assertNear(
    updated.draws[2].position.y - updated.position.y,
    updated.velocity.y * 3,
  )
  assert.equal(updated.worldY, updated.position.y)
})

test('uses the QWORD late-life growth and gradual Normal color recurrence', () => {
  const id = firstId('normal')
  const beforeGrowth = waterFrostJetPlan(state(id, 6))
  const firstGrowth = waterFrostJetPlan(state(id, 7))
  const late = waterFrostJetPlan(state(id, 30))

  assert.equal(beforeGrowth.coreScale, 0.5249603986740112)
  assert.equal(firstGrowth.coreScale, 0.5349603891372681)
  assert.equal(firstGrowth.glintScale, 1.2660294771194458)
  assert.equal(firstGrowth.draws[0].color.red, 0.48185521364212036)
  assert.equal(late.coreScale, 0.7649601697921753)
  assert.ok(late.coreScale < 1, 'native Frost cores never grow by whole sprite multiples')
})

test('Over stays white and omits the Normal additive half-core', () => {
  const id = firstId('over')
  const created = waterFrostJetPlan(state(id))
  const updated = waterFrostJetPlan(state(id, 1))

  assert.equal(created.kind, 'over')
  assert.deepEqual(created.draws.map(({ blend, sprite }) => [sprite, blend]), [
    ['core', 'normal'],
    ['glint', 'add'],
  ])
  assert.equal(created.draws[0].alpha, 0)
  assert.deepEqual(created.draws[0].color, { blue: 1, green: 1, red: 1 })
  assert.equal(created.draws[1].alpha, 0)
  assert.equal(updated.draws[0].alpha, 0.012500000186264515)
  assert.equal(updated.draws[1].alpha, 0.03750000149011612)
  assert.equal(updated.draws[1].scale, updated.glintScale * 0.25)
})

test('replays native float32 construction and non-axis position stores', () => {
  assert.equal(waterFrostJetPlan(state(11)).coreScale, 0.8136651515960693)
  assert.equal(waterFrostJetPlan(state(13, 1)).draws[0].color.red, 0.01678556203842163)
  assert.equal(waterFrostJetPlan(state(104)).lifetime, 1.292313814163208)

  const moving = state(11, 17)
  moving.origin = { x: 100.123456789, y: 200.987654321 }
  moving.direction = { x: 0.31622776601683794, y: -0.9486832980505138 }
  const plan = waterFrostJetPlan(moving)
  assert.deepEqual(plan.velocity, {
    x: 1.2649110555648804,
    y: -3.7947332859039307,
  })
  assert.deepEqual(plan.position, {
    x: 121.62689208984375,
    y: 136.4770965576172,
  })
  assert.deepEqual(plan.draws.at(-1)?.position, {
    x: 125.42162322998047,
    y: 125.0928955078125,
  })
})

test('shares late-life growth and cuts the Normal additive pass after update 14', () => {
  const normalId = firstId('normal')
  const overId = firstId('over')
  assert.ok(waterFrostJetPlan(state(normalId, 14)).draws.some(({ pass }) => (
    pass === 'additive-core'
  )))
  assert.ok(!waterFrostJetPlan(state(normalId, 15)).draws.some(({ pass }) => (
    pass === 'additive-core'
  )))
  assert.equal(waterFrostJetPlan(state(overId, 7)).coreScale, 0.8224014043807983)
  assert.equal(waterFrostJetPlan(state(overId, 8)).coreScale, 0.8324013948440552)
})

test('converts clockwise screen-up heading and composes float color with world light', () => {
  const plan = waterFrostJetPlan(state(firstId('normal')))
  assert.ok(Math.abs(plan.velocity.x - Math.sin(plan.heading) * 4) < 1e-6)
  assert.ok(Math.abs(plan.velocity.y + Math.cos(plan.heading) * 4) < 1e-6)
  for (const draw of plan.draws) assert.equal(draw.rotation, plan.heading)
  assert.equal(
    multiplyWaterFrostTint(0x804020, { blue: 1, green: 1, red: 0 }),
    0x004020,
  )
  assert.equal(
    multiplyWaterFrostTint(0x804020, { blue: 1, green: 1, red: 1 }),
    0x804020,
  )
  assert.equal(
    multiplyWaterFrostTint(0x804020, waterFrostJetPlan(state(1, 5)).draws[0].color),
    0x2a4020,
  )
})

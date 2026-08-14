import assert from 'node:assert/strict'
import test from 'node:test'

import type { PrimarySpellChannelTransientState } from './primary-spells.ts'
import {
  WATER_FROST_PARTICLES_PER_TICK,
  multiplyWaterFrostTint,
  waterFrostJetEmission,
  waterFrostJetLifetimeTicks,
  waterFrostJetPlan,
} from './primary-spell-water.ts'

function state(id: number, ageTicks = 0, variant = 0): PrimarySpellChannelTransientState {
  return {
    ageTicks,
    direction: { x: 0, y: -1 },
    id,
    kind: 'water',
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
  const firstHeading = Math.sin(3 * 65 * Math.PI / 180) * 15 * Math.PI / 180
  const expectedHeading = Math.sin((3 * 65 + 32.5) * Math.PI / 180) * 15 * Math.PI / 180

  assertNear(first.direction.x, Math.sin(firstHeading))
  assertNear(first.direction.y, -Math.cos(firstHeading))
  assertNear(born.direction.x, Math.sin(expectedHeading))
  assertNear(born.direction.y, -Math.cos(expectedHeading))
  assert.notDeepEqual(first.direction, born.direction)
  assert.deepEqual(born.direction, samePhase.direction)
  const jitter = { x: born.origin.x - emitter.x, y: born.origin.y - emitter.y }
  assert.ok(Math.hypot(jitter.x, jitter.y) <= 10)
  assert.ok(Math.abs(Math.atan2(jitter.x, -jitter.y)) <= 45 * Math.PI / 180)
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
  assert.equal(created.draws[0].tint, 0x00ffff)
  assert.equal(created.draws[1].alpha, 0.75)
  assert.equal(created.draws[1].scale, created.coreScale * 0.5)
  assert.equal(created.draws[2].alpha, 1)
  assert.equal(created.draws[2].scale, Math.min(created.glintScale, 1))

  assert.equal(Math.hypot(updated.velocity.x, updated.velocity.y), 4)
  assertNear(updated.position.x - created.position.x, updated.velocity.x)
  assertNear(updated.position.y - created.position.y, updated.velocity.y)
  assert.equal(updated.draws[0].alpha, 0.05)
  assert.equal(updated.draws[0].tint, 0xffffff)
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
  assert.equal(created.draws[0].tint, 0xffffff)
  assert.equal(created.draws[1].alpha, 0)
  assert.equal(updated.draws[0].alpha, 0.0125)
  assert.equal(updated.draws[1].alpha, 0.037500000000000006)
  assert.equal(updated.draws[1].scale, updated.glintScale * 0.25)
})

test('converts clockwise screen-up heading and composes local color with world light', () => {
  const plan = waterFrostJetPlan(state(firstId('normal')))
  assert.equal(plan.velocity.x, Math.sin(plan.heading) * 4)
  assert.equal(plan.velocity.y, -Math.cos(plan.heading) * 4)
  for (const draw of plan.draws) assert.equal(draw.rotation, plan.heading)
  assert.equal(multiplyWaterFrostTint(0x804020, 0x00ffff), 0x004020)
  assert.equal(multiplyWaterFrostTint(0x804020, 0xffffff), 0x804020)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { Texture } from 'pixi.js'

import type { PrimarySpellTransientState } from '../core-kernels/primary-spells.ts'
import {
  AIR_LIGHTNING_BODY_LIFETIME_TICKS,
  AIR_LIGHTNING_CONTACT_LIFETIME_TICKS,
  AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY,
  AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS,
  AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA,
  AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER,
  AIR_LIGHTNING_CORONA_CIRCLE_RECORD,
  AIR_LIGHTNING_CORONA_FORK_RECORDS,
  AIR_LIGHTNING_ENHANCED_SAMPLE_SPACING,
  AIR_LIGHTNING_FAST_INVERSE_SQRT_MAGIC,
  AIR_LIGHTNING_MAX_PARAMETER_STEP,
  AIR_LIGHTNING_SPLINE_DURATION,
  buildNativeAirContactLightPlan,
  buildNativeAirLightningPlan,
} from './primary-spell-air-native.ts'
import { AirPrimarySpellView } from './primary-spell-air-view.ts'

const RIGHT = { x: 1, y: 0 }

test('native Air separates the two-tick body from the five-tick contact fade', () => {
  assert.equal(AIR_LIGHTNING_BODY_LIFETIME_TICKS, 2)
  assert.equal(AIR_LIGHTNING_CONTACT_LIFETIME_TICKS, 5)

  const ages = Array.from({ length: 5 }, (_, ageTicks) => (
    buildNativeAirLightningPlan({ ageTicks, direction: RIGHT, id: 41, reach: 205 })
  ))
  assert.deepEqual(ages.map((plan) => plan.body !== null), [true, true, false, false, false])
  assert.deepEqual(ages.map((plan) => plan.sourceCorona !== null), [true, false, false, false, false])
  assert.deepEqual(ages.map((plan) => plan.contactCorona.alpha), [1, 0.8, 0.6, 0.4, 0.2])
  assert.deepEqual(ages.map((plan) => plan.contactLight !== null), [true, true, true, true, true])
  const interpolated = buildNativeAirLightningPlan({
    ageTicks: 3.75,
    direction: RIGHT,
    id: 41,
    reach: 205,
  })
  assert.equal(interpolated.contactCorona.alpha, 0.4)
  assert.equal(buildNativeAirLightningPlan({
    ageTicks: 5,
    direction: RIGHT,
    id: 41,
    reach: 205,
  }).contactLight, null)
})

test('native Air builds two independently tessellated record-44 ribbons', () => {
  const plan = buildNativeAirLightningPlan({ ageTicks: 0, direction: RIGHT, id: 19, reach: 205 })
  assert.ok(plan.body)
  assert.equal(AIR_LIGHTNING_ENHANCED_SAMPLE_SPACING, 15)
  assert.equal(AIR_LIGHTNING_FAST_INVERSE_SQRT_MAGIC, 0x5f3759df)
  assert.equal(AIR_LIGHTNING_SPLINE_DURATION, 2)
  assert.equal(AIR_LIGHTNING_MAX_PARAMETER_STEP, 0.5)
  assert.equal(plan.body.layers.length, 2)
  assert.deepEqual(
    plan.body.layers.map(({ alpha, phaseOffset, textureRecord, tint, width }) => ({
      alpha, phaseOffset, textureRecord, tint, width,
    })),
    [
      { alpha: 1, phaseOffset: 0, textureRecord: 44, tint: 0xffffff, width: 1 },
      { alpha: 0.5, phaseOffset: 15, textureRecord: 44, tint: 0x00ffff, width: 0.75 },
    ],
  )

  // 0x0053462A..0x005346DA measures only source -> midpoint with magic
  // 0x5F3759DF plus one Newton step. Enhanced Effects defaults On, so the
  // recovered float32 distance is divided by 15. Each increment is stored as
  // float32 before the strict t < 2 - step comparison.
  assert.deepEqual(
    [...plan.body.layers[0].parameterSamples],
    [
      0,
      0.29217109084129333,
      0.5843421816825867,
      0.8765132427215576,
      1.1686843633651733,
      1.460855484008789,
      2,
    ],
  )
  assert.equal(plan.body.layers[0].parameterSamples.length, 7)
  assert.equal(plan.body.layers[0].vertices.length, 28)
  assert.equal(plan.body.layers[0].uvs.length, 28)
  assert.equal(plan.body.layers[0].indices.length, 36)
  assert.deepEqual(
    [...plan.body.layers[0].uvs.slice(0, 8)],
    [0, 0, 1, 0, 0, 1, 1, 1],
  )
  assert.deepEqual(
    [...plan.body.layers[0].vertices.slice(0, 4)],
    [0, -15.625, 0, 15.625],
  )
  assert.deepEqual(
    [...plan.body.layers[0].vertices.slice(-4)],
    [205, -12.5, 205, 12.5],
  )
  assert.notDeepEqual(plan.body.layers[0].vertices, plan.body.layers[1].vertices)
  assert.deepEqual(plan.source, { x: 0, y: 0 })
  assert.deepEqual(plan.midpoint, { x: 102.5, y: 0 })
  assert.deepEqual(plan.endpoint, { x: 205, y: 0 })
})

test('native Air exposes the contact ZAnimLit source without inventing range 50', () => {
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS, 1)
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER, 0.75)
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY, 1)
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA, Math.fround(-0.05))

  const visual = buildNativeAirLightningPlan({
    ageTicks: 0,
    direction: RIGHT,
    id: 29,
    reach: 205,
  })
  const ages = Array.from({ length: 5 }, (_, ageTicks) => (
    buildNativeAirContactLightPlan({
      ageTicks,
      id: 29,
      position: visual.contactCorona.center,
    })
  ))

  assert.deepEqual(
    ages.map((light) => light?.intensity),
    [1, 0.949999988079071, 0.8999999761581421, 0.8499999642372131, 0.7999999523162842],
  )
  assert.ok(ages.every((light) => light?.multipleShadows === false))
  assert.ok(ages.every((light) => light?.position === visual.contactCorona.center))
  assert.ok(ages.every((light) => (
    light !== null
    && light.radius >= AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS
    && light.radius < AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS
      + AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER
  )))
  assert.deepEqual(visual.contactLight, ages[0])
  assert.equal(buildNativeAirContactLightPlan({
    ageTicks: 5,
    id: 29,
    position: visual.contactCorona.center,
  }), null)
})

test('native Air presentation randomness is stable by semantic transient id', () => {
  const first = buildNativeAirLightningPlan({ ageTicks: 0, direction: RIGHT, id: 7, reach: 205 })
  const replay = buildNativeAirLightningPlan({ ageTicks: 0, direction: RIGHT, id: 7, reach: 205 })
  const next = buildNativeAirLightningPlan({ ageTicks: 0, direction: RIGHT, id: 8, reach: 205 })
  assert.deepEqual(replay, first)
  assert.notDeepEqual(next.body?.layers[0].vertices, first.body?.layers[0].vertices)
  assert.notDeepEqual(next.contactCorona.center, first.contactCorona.center)
})

test('native Air corona uses the exact BadGuys circle and fork family', () => {
  assert.equal(AIR_LIGHTNING_CORONA_CIRCLE_RECORD, 110)
  assert.deepEqual(AIR_LIGHTNING_CORONA_FORK_RECORDS, [1836, 1837, 1838, 1839])

  const plan = buildNativeAirLightningPlan({ ageTicks: 3, direction: RIGHT, id: 13, reach: 205 })
  assert.equal(plan.contactCorona.circles.length, 4)
  assert.deepEqual(
    plan.contactCorona.circles.map(({ record }) => record),
    [110, 110, 110, 110],
  )
  assert.equal(plan.contactCorona.forks.length, 2)
  assert.equal(
    plan.contactCorona.forks[1].record,
    3675 - plan.contactCorona.forks[0].record,
  )
  assert.ok(Math.hypot(
    plan.contactCorona.center.x - plan.endpoint.x,
    plan.contactCorona.center.y - plan.endpoint.y,
  ) < 10)
})

test('Air body, source glow, and contact corona remain separate painter roots', () => {
  const state = {
    ageTicks: 0,
    direction: RIGHT,
    id: 31,
    kind: 'air',
    origin: { x: 50, y: 70 },
    ownerId: 'wizard',
    variant: 0,
    worldKey: 'hub:courtyard',
  } satisfies PrimarySpellTransientState
  const view = new AirPrimarySpellView(state, {
    circle: Texture.EMPTY,
    forks: [Texture.EMPTY, Texture.EMPTY, Texture.EMPTY, Texture.EMPTY],
    ribbon: Texture.EMPTY,
  })

  assert.equal(view.containers.length, 3)
  assert.ok(view.containers.every(({ parent }) => parent === null))
  assert.deepEqual(
    view.painterRoots().map(({ suffix }) => suffix),
    ['body', 'source', 'contact'],
  )

  view.update({ ...state, ageTicks: 1 })
  assert.deepEqual(
    view.painterRoots().map(({ suffix }) => suffix),
    ['body', 'contact'],
  )
  view.update({ ...state, ageTicks: 2 })
  assert.deepEqual(
    view.painterRoots().map(({ suffix }) => suffix),
    ['contact'],
  )
  view.destroy()
})

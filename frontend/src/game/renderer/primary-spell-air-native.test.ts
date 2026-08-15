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
  AIR_LIGHTNING_PATH_MINIMUM_DISTANCE,
  AIR_LIGHTNING_PATH_REMAINDER,
  AIR_LIGHTNING_PATH_STEP,
  AIR_LIGHTNING_PATH_Y_OFFSET,
  AIR_LIGHTNING_SPLINE_DURATION,
  buildNativeAirBranchPlan,
  buildNativeAirContactLightSource,
  buildNativeAirContactLightPlan,
  buildNativeAirLightningPlan,
  buildNativeAirPathLightSources,
  nativeAirRibbonRandomSample,
} from './primary-spell-air-native.ts'
import { AirPrimarySpellView } from './primary-spell-air-view.ts'

const STRAIGHT_BOLT = {
  birthTick: 40,
  endpoint: { x: 205, y: 0 },
  midpoint: { x: 102.5, y: 0 },
} as const

test('native Air separates the two-tick body from the five-tick contact fade', () => {
  assert.equal(AIR_LIGHTNING_BODY_LIFETIME_TICKS, 2)
  assert.equal(AIR_LIGHTNING_CONTACT_LIFETIME_TICKS, 5)

  const ages = Array.from({ length: 5 }, (_, ageTicks) => (
    buildNativeAirLightningPlan({ ageTicks, id: 41, ...STRAIGHT_BOLT })
  ))
  assert.deepEqual(ages.map((plan) => plan.body !== null), [true, true, false, false, false])
  assert.deepEqual(ages.map((plan) => plan.sourceCorona !== null), [true, false, false, false, false])
  assert.deepEqual(ages.map((plan) => plan.contactCorona.alpha), [1, 0.8, 0.6, 0.4, 0.2])
  assert.deepEqual(ages.map((plan) => plan.contactLight !== null), [true, true, true, true, true])
  const interpolated = buildNativeAirLightningPlan({
    ageTicks: 3.75,
    id: 41,
    ...STRAIGHT_BOLT,
  })
  assert.equal(interpolated.contactCorona.alpha, 0.4)
  assert.equal(buildNativeAirLightningPlan({
    ageTicks: 5,
    id: 41,
    ...STRAIGHT_BOLT,
  }).contactLight, null)
})

test('native Air builds two independently tessellated record-44 ribbons', () => {
  const plan = buildNativeAirLightningPlan({ ageTicks: 0, id: 19, ...STRAIGHT_BOLT })
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
    Array.from({ length: 7 }, (_, pair) => plan.body!.layers[0].uvs[pair * 4 + 1]),
    [0, 1, 0.5, 1, 0.5, 1, 0],
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

test('underpowered Air keeps the source edge but owns exact weak body, contact, and light lanes', () => {
  const normal = buildNativeAirLightningPlan({ ageTicks: 0, id: 19, ...STRAIGHT_BOLT })
  const weak = buildNativeAirLightningPlan({
    ageTicks: 0,
    id: 19,
    underpowered: true,
    ...STRAIGHT_BOLT,
  })
  assert.ok(weak.body)
  assert.deepEqual(
    weak.body.layers.map(({ alpha, phaseOffset, tint, width }) => ({
      alpha, phaseOffset, tint, width,
    })),
    [
      { alpha: 0.5, phaseOffset: 0, tint: 0x80ffff, width: 0.75 },
      { alpha: 0.25, phaseOffset: 15, tint: 0x00ffff, width: 0.5625 },
    ],
  )
  assert.deepEqual(weak.sourceCorona, normal.sourceCorona)

  const ages = Array.from({ length: 4 }, (_, ageTicks) => (
    buildNativeAirLightningPlan({
      ageTicks,
      id: 19,
      underpowered: true,
      ...STRAIGHT_BOLT,
    })
  ))
  assert.deepEqual(ages.map(({ contactCorona }) => contactCorona.alpha), [0.5, 0.3, 0.1, 0])
  assert.deepEqual(ages.map(({ contactLight }) => contactLight?.intensity ?? null), [
    0.5,
    Math.fround(0.45),
    Math.fround(Math.fround(0.45) - 0.05),
    null,
  ])
  assert.equal(weak.contactLight!.radius, normal.contactLight!.radius * 0.5)

  const random = () => 0.5
  const normalPath = buildNativeAirPathLightSources({
    birthTick: 40,
    endpoint: { x: 650, y: 0 },
    id: 19,
    midpoint: { x: 350, y: 0 },
    origin: { x: 0, y: 0 },
  }, random)
  const weakPath = buildNativeAirPathLightSources({
    birthTick: 40,
    endpoint: { x: 650, y: 0 },
    id: 19,
    midpoint: { x: 350, y: 0 },
    origin: { x: 0, y: 0 },
    weakCast: true,
  }, random)
  assert.ok(normalPath.length > 0)
  assert.equal(weakPath[0]!.intensity, Math.fround(normalPath[0]!.intensity * 0.25))
})

test('native Air tessellates the authoritative off-axis target control point', () => {
  const plan = buildNativeAirLightningPlan({
    ageTicks: 0,
    birthTick: 40,
    endpoint: { x: 100, y: -200 },
    id: 23,
    midpoint: { x: 0, y: -Math.hypot(100, 200) / 2 },
  })
  assert.deepEqual(plan.endpoint, { x: 100, y: -200 })
  assert.equal(plan.midpoint.x, 0)
  assert.notDeepEqual(plan.midpoint, { x: 50, y: -100 })
  const finalPair = plan.body!.layers[0].vertices.slice(-4)
  assert.ok(Math.abs((finalPair[0] + finalPair[2]) / 2 - plan.endpoint.x) < 0.0001)
  assert.ok(Math.abs((finalPair[1] + finalPair[3]) / 2 - plan.endpoint.y) < 0.0001)
})

test('native Air exposes the contact ZAnimLit source without inventing range 50', () => {
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS, 1)
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER, 0.75)
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_BASE_INTENSITY, 1)
  assert.equal(AIR_LIGHTNING_CONTACT_LIGHT_INTENSITY_DELTA, Math.fround(-0.05))

  const visual = buildNativeAirLightningPlan({
    ageTicks: 0,
    id: 29,
    ...STRAIGHT_BOLT,
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
  assert.ok(ages.every((light) => light?.castsDirectionalShadow === false))
  assert.ok(ages.every((light) => light?.position === visual.contactCorona.center))
  assert.ok(ages.every((light) => (
    light !== null
    && light.radius >= AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS
    && light.radius <= AIR_LIGHTNING_CONTACT_LIGHT_BASE_RADIUS
      + AIR_LIGHTNING_CONTACT_LIGHT_RADIUS_JITTER
  )))
  assert.deepEqual(visual.contactLight, ages[0])
  assert.equal(buildNativeAirContactLightPlan({
    ageTicks: 5,
    id: 29,
    position: visual.contactCorona.center,
  }), null)

  const worldLight = buildNativeAirContactLightSource({
    ageTicks: 0,
    id: 29,
    ...STRAIGHT_BOLT,
    origin: { x: 400, y: 300 },
  })
  assert.ok(worldLight)
  assert.deepEqual(worldLight.position, {
    x: 400 + visual.contactLight!.position.x,
    y: 300 + visual.contactLight!.position.y,
  })
})

test('native Air appends its factory MiscLights after exact 100-unit leg walks', () => {
  assert.equal(AIR_LIGHTNING_PATH_STEP, 100)
  assert.equal(AIR_LIGHTNING_PATH_REMAINDER, 50)
  assert.equal(AIR_LIGHTNING_PATH_MINIMUM_DISTANCE, 220)
  assert.equal(AIR_LIGHTNING_PATH_Y_OFFSET, 35)
  const values = [0.5, 0, 0.25, 0.5, 0.75, 0.99]
  const lights = buildNativeAirPathLightSources({
    birthTick: 40,
    endpoint: { x: 650, y: 10 },
    id: 9,
    midpoint: { x: 350, y: 10 },
    origin: { x: 0, y: 10 },
  }, () => values.shift() ?? 0)

  assert.deepEqual(lights.map(({ position }) => position), [
    { x: 350, y: 45 },
    { x: 350, y: 45 },
    { x: 450, y: 45 },
    { x: 550, y: 45 },
    { x: 650, y: 45 },
  ])
  assert.ok(lights.every(({ castsDirectionalShadow, intensity }) => (
    castsDirectionalShadow && intensity === Math.fround(0.625)
  )))
  assert.deepEqual(lights.map(({ radius }) => radius), [
    Math.fround(0.75),
    Math.fround(0.8125),
    Math.fround(0.875),
    Math.fround(0.9375),
    Math.fround(0.9975),
  ])

  const boundary = buildNativeAirPathLightSources({
    birthTick: 40,
    endpoint: { x: 220, y: 0 },
    id: 9,
    midpoint: { x: 219.999, y: 0 },
    origin: { x: 0, y: 0 },
  }, () => 0)
  assert.deepEqual(boundary.map(({ position }) => position.x), [220])

  const inclusiveMaximum = buildNativeAirPathLightSources({
    birthTick: 40,
    endpoint: { x: 220, y: 0 },
    id: 9,
    midpoint: { x: 220, y: 0 },
    origin: { x: 0, y: 0 },
  }, () => 1)
  assert.ok(inclusiveMaximum.length > 0)
  assert.ok(inclusiveMaximum.every(({ intensity, radius }) => (
    intensity === 1 && radius === 1
  )))
})

test('native Air body phase is frozen from the semantic birth tick', () => {
  const first = buildNativeAirLightningPlan({ ageTicks: 0, id: 7, ...STRAIGHT_BOLT })
  const replay = buildNativeAirLightningPlan({ ageTicks: 0, id: 7, ...STRAIGHT_BOLT })
  const nextBirth = buildNativeAirLightningPlan({
    ageTicks: 0,
    id: 7,
    ...STRAIGHT_BOLT,
    birthTick: STRAIGHT_BOLT.birthTick + 1,
  })
  assert.deepEqual(replay, first)
  assert.equal(first.body?.layers[0].phaseDegrees, -3 * STRAIGHT_BOLT.birthTick)
  assert.equal(
    nextBirth.body!.layers[0].phaseDegrees - first.body!.layers[0].phaseDegrees,
    -3,
  )
  assert.notDeepEqual(nextBirth.body?.layers[0].vertices, first.body?.layers[0].vertices)
})

test('native Air ribbon mixer preserves the recovered signed-abs recurrence', () => {
  const first = nativeAirRibbonRandomSample(0x12345678)
  assert.deepEqual(first, {
    angleDegrees: 25.259,
    nextState: 386390828,
    radius: 13.595333333333334,
  })
  assert.deepEqual(nativeAirRibbonRandomSample(first.nextState), {
    angleDegrees: -20.01061111111111,
    nextState: 324155591,
    radius: 26.963833333333334,
  })
})

test('native Air branch independently chooses geometry and texture records', () => {
  const values = [0.75, 0.25, 0.4, 0.04, 0.75, 0.1, 0.75, 0.5]
  const branch = buildNativeAirBranchPlan(
    [{ x: 0, y: 0 }, { x: 102.5, y: 0 }, { x: 205, y: 0 }],
    () => values.shift() ?? 0,
  )
  assert.ok(branch)
  assert.equal(branch.geometryRecord, 375)
  assert.equal(branch.textureRecord, 376)
  assert.equal(branch.scale, 1)
  assert.equal(branch.mirrorX, true)
  assert.equal(branch.vertices.length, 8)
  assert.equal(branch.indices.length, 6)
  assert.deepEqual([...branch.uvs], [0, 0, 1, 0, 0, 1, 1, 1])

  const reverse = [0.75, 0.25, 0.4, 0.2, 0.1, 0.75, 0.1, 0.5]
  const reversed = buildNativeAirBranchPlan(
    [{ x: 0, y: 0 }, { x: 102.5, y: 0 }, { x: 205, y: 0 }],
    () => reverse.shift() ?? 0,
  )
  assert.ok(reversed)
  assert.equal(reversed.geometryRecord, 376)
  assert.equal(reversed.textureRecord, 375)
})

test('native Air corona uses the exact BadGuys circle and fork family', () => {
  assert.equal(AIR_LIGHTNING_CORONA_CIRCLE_RECORD, 110)
  assert.deepEqual(AIR_LIGHTNING_CORONA_FORK_RECORDS, [1836, 1837, 1838, 1839])

  const plan = buildNativeAirLightningPlan({ ageTicks: 3, id: 13, ...STRAIGHT_BOLT })
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
    birthTick: 80,
    direction: { x: 1, y: 0 },
    endpoint: { x: 255, y: 70 },
    id: 31,
    kind: 'air',
    midpoint: { x: 152.5, y: 70 },
    origin: { x: 50, y: 70 },
    ownerId: 'wizard',
    targetId: null,
    underpowered: false,
    variant: 0,
    worldKey: 'hub:courtyard',
  } satisfies PrimarySpellTransientState
  const view = new AirPrimarySpellView(state, {
    branches: [Texture.EMPTY, Texture.EMPTY],
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

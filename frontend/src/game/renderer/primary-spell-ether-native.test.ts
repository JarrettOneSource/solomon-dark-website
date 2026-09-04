import assert from 'node:assert/strict'
import test from 'node:test'
import { Sprite, Texture } from 'pixi.js'

import { NATIVE_ELEMENT_VFX_SPRITES } from '../element-vfx-native.ts'
import {
  ETHER_PRIMARY_FLIGHT_RECORDS,
  ETHER_PRIMARY_IMPACT_LIGHT_RADIUS,
  ETHER_PRIMARY_IMPACT_SORT_BIAS,
  ETHER_PRIMARY_PIERCE_STREAK_RECORD,
  ETHER_PRIMARY_PHASE_DEGREES_PER_TICK,
  ETHER_PRIMARY_UNDERPOWERED_PHASE_DEGREES_PER_TICK,
  ETHER_PRIMARY_ROOT_OFFSET,
  etherPrimaryCompositorPlan,
  etherPrimaryFlightPlan,
  etherPrimaryImpactFade,
  etherPrimaryImpactLightSource,
  etherPrimaryImpactPlan,
  etherPrimaryPierceStreakPlan,
  etherPrimaryPhase,
} from './primary-spell-ether-native.ts'
import {
  EtherBlastPulseView,
  EtherPrimaryImpactView,
  EtherPrimaryPierceStreakView,
} from './primary-spell-ether-view.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'

const closeTo = (actual: number, expected: number): void => {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)
}

const sinDegrees = (degrees: number): number => Math.sin(degrees * Math.PI / 180)

test('Ether contact and pierce painter rows follow updated sprite origins', () => {
  const impactAt = (ageTicks: number) => ({
    ageTicks, birthTick: 300, id: 41, kind: 'ether-impact' as const,
    origin: { x: 120 + ageTicks, y: 240 - ageTicks },
    ownerId: 'caster', visualScale: 1, worldKey: 'boneyard:run',
  })
  const streakAt = (ageTicks: number) => ({
    ageTicks, headingDegrees: 70, id: 91, kind: 'ether-pierce-streak' as const,
    origin: { x: 12 + ageTicks, y: 34 - ageTicks },
    ownerId: 'caster', visualScale: 0.5, worldKey: 'boneyard:run',
  })
  for (const { view, stateAt, planAt } of [
    {
      view: new EtherPrimaryImpactView(impactAt(0), {
        core: Texture.EMPTY, ray: Texture.EMPTY, spark: Texture.EMPTY,
      }),
      stateAt: impactAt,
      planAt: (age: number) => etherPrimaryImpactPlan(impactAt(age)),
    },
    {
      view: new EtherPrimaryPierceStreakView(streakAt(0), Texture.EMPTY),
      stateAt: streakAt,
      planAt: (age: number) => etherPrimaryPierceStreakPlan(streakAt(age)),
    },
  ]) {
    for (const age of [0, 1, 8]) {
      view.update(stateAt(age))
      const plan = planAt(age)
      const painter = view.painterRoots()[0]!
      assert.equal(painter.worldY, plan.worldY)
      assert.equal(painter.lane, 'world-sorted')
      assert.equal(painter.queueFamily, 'zanim')
      assert.equal(painter.regionLightPoint, null)
      assert.deepEqual({ x: view.container.x, y: view.container.y }, plan.position)
      assert.deepEqual(view.painterRoots()[0], painter)
    }
    view.destroy()
    assert.equal(view.container.destroyed, true)
  }
})

test('pins the native Magic Missile records, sizes, root, and nine-degree phase tick', () => {
  assert.deepEqual(ETHER_PRIMARY_FLIGHT_RECORDS, { core: 110, ray: 112, spark: 111 })
  assert.ok(!Object.values(ETHER_PRIMARY_FLIGHT_RECORDS).includes(53))
  assert.deepEqual(ETHER_PRIMARY_ROOT_OFFSET, { x: 0, y: -10 })
  assert.equal(ETHER_PRIMARY_PHASE_DEGREES_PER_TICK, 9)
  assert.deepEqual(NATIVE_ELEMENT_VFX_SPRITES.core, { count: 1, height: 26, width: 27 })
  assert.deepEqual(NATIVE_ELEMENT_VFX_SPRITES.spark, { count: 1, height: 40, width: 40 })
  assert.deepEqual(NATIVE_ELEMENT_VFX_SPRITES.ray, { count: 1, height: 40, width: 40 })
  closeTo(etherPrimaryPhase(41, 19) - etherPrimaryPhase(41, 18), 9)
})

test('underpowered Ether advances at 7.2 degrees and halves the complete flight compositor', () => {
  assert.equal(ETHER_PRIMARY_UNDERPOWERED_PHASE_DEGREES_PER_TICK, 7.2)
  closeTo(etherPrimaryPhase(41, 19, 2.4) - etherPrimaryPhase(41, 18, 2.4), 7.2)
  const weak = etherPrimaryFlightPlan(41, 19, 2.4, 1, true)
  const fullAlphaAtWeakPhase = etherPrimaryCompositorPlan(
    41,
    19,
    weak.phase,
    1,
    1,
  )
  assert.deepEqual(
    weak.draws.map(({ alpha }) => alpha),
    fullAlphaAtWeakPhase.draws.map(({ alpha }) => Math.fround(alpha * 0.5)),
  )
})

test('builds two complete native compositor passes in their recovered order', () => {
  const plan = etherPrimaryFlightPlan(41, 19)
  assert.ok(plan.sampledScale >= 1 && plan.sampledScale < 1.5)

  for (let pass = 0; pass < 2; pass += 1) {
    const draws = plan.draws.filter((draw) => draw.pass === pass)
    const particleCount = draws.filter((draw) => draw.role === 'radial-spark').length
    assert.ok(particleCount >= 2 && particleCount <= 11)
    assert.deepEqual(draws.map((draw) => draw.role), [
      'outer-core',
      'inner-core',
      'fixed-spark',
      ...Array.from({ length: particleCount }, () => 'radial-spark' as const),
      'ray',
    ])
    assert.deepEqual(draws.slice(0, 2).map(({ blend, sprite }) => ({ blend, sprite })), [
      { blend: 'normal', sprite: 'core' },
      { blend: 'normal', sprite: 'core' },
    ])
    assert.ok(draws.slice(2).every(({ blend }) => blend === 'add'))
  }

  assert.ok(plan.draws.length >= 12 && plan.draws.length <= 30)
  assert.deepEqual(plan, etherPrimaryFlightPlan(41, 19))
  assert.notDeepEqual(plan, etherPrimaryFlightPlan(41, 20))
})

test('uses one 15-phase core pulse and the distinct spark and ray phase lanes', () => {
  const plan = etherPrimaryFlightPlan(7, 23)
  const firstPass = plan.draws.filter((draw) => draw.pass === 0)
  const outerCore = firstPass[0]
  const innerCore = firstPass[1]
  const fixedSpark = firstPass[2]
  const ray = firstPass.at(-1)
  assert.equal(outerCore.role, 'outer-core')
  assert.equal(innerCore.role, 'inner-core')
  assert.equal(fixedSpark.role, 'fixed-spark')
  assert.equal(ray?.role, 'ray')

  const corePulse = 0.15 * Math.abs(sinDegrees(15 * plan.phase))
  closeTo(outerCore.scale, (2.5 + corePulse) * plan.sampledScale)
  closeTo(innerCore.scale, (1.5 + corePulse) * plan.sampledScale)
  closeTo(fixedSpark.alpha, 0.35 * Math.abs(sinDegrees(5 * plan.phase)))
  closeTo(fixedSpark.rotationDegrees, 50 * plan.sampledScale * sinDegrees(plan.phase))
  closeTo(ray?.alpha ?? Number.NaN, 0.55 * Math.abs(sinDegrees(8 * plan.phase)))
  closeTo(
    ray?.rotationDegrees ?? Number.NaN,
    50 * plan.sampledScale * sinDegrees(0.5 * plan.phase),
  )
})

test('contains no heading-aligned body, source glow, flight trail, or contact streak', () => {
  const roles = new Set(etherPrimaryFlightPlan(3, 1).draws.map(({ role }) => role))
  assert.deepEqual(roles, new Set(['fixed-spark', 'inner-core', 'outer-core', 'radial-spark', 'ray']))
})

test('uses the same two-pass compositor for the 19-frame Ether contact fade', () => {
  const impact = {
    ageTicks: 0,
    birthTick: 300,
    id: 41,
    kind: 'ether-impact',
    origin: { x: 120, y: 240 },
    ownerId: 'caster',
    visualScale: 1,
    worldKey: 'boneyard:run',
  } as const
  const plan = etherPrimaryImpactPlan(impact)
  assert.equal(plan.phase, 300)
  assert.equal(plan.fade, Math.fround(1.9))
  assert.ok(plan.sampledScale >= 2 && plan.sampledScale < 3)
  assert.deepEqual(plan.position, impact.origin)
  assert.equal(plan.worldY, impact.origin.y + ETHER_PRIMARY_IMPACT_SORT_BIAS)
  assert.equal(plan.regionLightPoint, null)
  assert.deepEqual(
    plan.draws.map(({ role }) => role),
    etherPrimaryFlightPlan(41, 300).draws.map(({ role }) => role),
  )
  assert.equal(etherPrimaryImpactFade(18) > 0, true)
  assert.equal(etherPrimaryImpactFade(19) <= 0, true)
})

test('publishes the post-update Ether contact light at the child root', () => {
  const impact = {
    ageTicks: 0,
    birthTick: 300,
    id: 41,
    kind: 'ether-impact',
    origin: { x: 120, y: 240 },
    ownerId: 'caster',
    visualScale: 1,
    worldKey: 'boneyard:run',
  } as const
  const first = etherPrimaryImpactLightSource(impact)
  const last = etherPrimaryImpactLightSource({ ...impact, ageTicks: 18 })
  assert.deepEqual(first, {
    castsDirectionalShadow: false,
    intensity: Math.fround(0.95),
    position: impact.origin,
    radius: ETHER_PRIMARY_IMPACT_LIGHT_RADIUS,
  })
  assert.ok(last.intensity > 0 && last.intensity < 0.051)
})

test('renders surviving-pierce record 53 as a ten-tick heading-aligned additive streak', () => {
  const state = {
    ageTicks: 0,
    headingDegrees: 70,
    id: 91,
    kind: 'ether-pierce-streak',
    origin: { x: 12, y: 34 },
    ownerId: 'caster',
    visualScale: 0.5,
    worldKey: 'boneyard:run',
  } as const
  assert.equal(ETHER_PRIMARY_PIERCE_STREAK_RECORD, 53)
  assert.deepEqual(etherPrimaryPierceStreakPlan(state), {
    alpha: 1,
    blend: 'add',
    position: state.origin,
    record: 53,
    rotationDegrees: 70,
    scale: 0.5,
    worldY: 34,
  })
  assert.equal(
    etherPrimaryPierceStreakPlan({ ...state, ageTicks: 9 }).alpha,
    Math.fround(0.09999992698431015),
  )
})

test('renders Ether Blast as 108 independently depth-sorted additive native particles', () => {
  const state = {
    ageTicks: 0,
    birthTick: 10,
    charges: 2,
    id: 14,
    kind: 'ether-blast',
    origin: { x: 100, y: 200 },
    ownerId: 'caster',
    presentationRng: createNativeRng(14),
    worldKey: 'boneyard:run',
  } as const
  const view = new EtherBlastPulseView(state, {
    11: { anchorX: 0, anchorY: 0, height: 1, texture: Texture.EMPTY, width: 1 },
    45: { anchorX: 0, anchorY: 0, height: 1, texture: Texture.EMPTY, width: 1 },
  })
  assert.equal(view.containers.length, 108)
  assert.equal(view.painterRoots().length, 108)
  assert.ok(view.painterRoots().every(({ queueFamily, regionLightPoint }) => (
    queueFamily === 'zanim' && regionLightPoint === null
  )))
  const first = view.containers[0]!.children[0]
  assert.ok(first instanceof Sprite)
  assert.equal(first.blendMode, 'add')
  assert.equal(first.visible, true)
  view.update({ ...state, ageTicks: 100 })
  assert.ok(view.containers.every((container) => container.children[0]!.visible === false))
  view.destroy()
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_ELEMENT_VFX_SCALE,
  nativeElementVfxPlan,
} from './element-vfx-native.ts'

test('uses the native Create and equipped-staff scale inputs', () => {
  assert.deepEqual(NATIVE_ELEMENT_VFX_SCALE, { held: 6, picker: 2, staff: 1 })
})

test('core pulses use the recovered 0.15 native breathing amplitude', () => {
  assert.equal(nativeElementVfxPlan('fire', 0, 1)[0].scale, 3.5)
  assert.equal(nativeElementVfxPlan('fire', 6, 1)[0].scale, 3.65)
})

test('Fire uses one core and the same five-tick flame frame in both blend passes', () => {
  const plan = nativeElementVfxPlan('fire', 27, 1)
  assert.deepEqual(plan.map(({ blend, frame, sprite }) => ({ blend, frame, sprite })), [
    { blend: 'source-over', frame: 0, sprite: 'core' },
    { blend: 'lighter', frame: 5, sprite: 'fire' },
    { blend: 'source-over', frame: 5, sprite: 'fire' },
  ])
  assert.equal(plan[1].scale, 2)
  assert.equal(plan[2].alpha, 0.5)
})

test('Air includes four core passes and both complementary sprite frames', () => {
  const plan = nativeElementVfxPlan('air', 67, 1)
  assert.deepEqual(plan.slice(0, 4).map(({ sprite }) => sprite), ['core', 'core', 'core', 'core'])
  assert.equal(plan[4].sprite, 'air')
  assert.equal(plan[5].sprite, 'air')
  assert.equal(plan[4].frame + plan[5].frame, 3)
  assert.equal(plan[5].rotation - plan[4].rotation, 90)
  assert.equal(plan[5].alpha, plan[4].alpha * 0.25)
  assert.ok(Math.hypot(plan[4].x, plan[4].y) < 1)
})

test('Water holds each native frame for eight ticks and reuses one ray phase', () => {
  assert.equal(nativeElementVfxPlan('water', 7, 1)[0].frame, 0)
  assert.equal(nativeElementVfxPlan('water', 8, 1)[0].frame, 1)
  const rays = nativeElementVfxPlan('water', 31, 1).filter(({ sprite }) => sprite === 'ray')
  assert.equal(rays[0].alpha, rays[1].alpha)
  assert.equal(rays[0].rotation, rays[1].rotation)
})

test('Ether reuses native phases across both painter passes', () => {
  const plan = nativeElementVfxPlan('ether', 12, 1)
  const cores = plan.filter(({ sprite }) => sprite === 'core')
  const fixedSparks = plan.filter(({ sprite, scale }) => sprite === 'spark' && scale >= 1)
  const rays = plan.filter(({ sprite }) => sprite === 'ray')
  assert.equal(cores[0].scale, cores[2].scale)
  assert.equal(cores[1].scale, cores[3].scale)
  assert.equal(fixedSparks[0].rotation, fixedSparks[1].rotation)
  assert.equal(rays[0].alpha, rays[1].alpha)
  assert.equal(rays[0].rotation, rays[1].rotation)
})

test('each stock element keeps its distinct recovered painter stack', () => {
  assert.deepEqual(nativeElementVfxPlan('earth', 0, 1).map(({ sprite }) => sprite), [
    'earth', 'earth', 'core', 'core',
  ])
  assert.deepEqual(nativeElementVfxPlan('water', 0, 1).map(({ sprite }) => sprite), [
    'water', 'core', 'ray', 'ray',
  ])
  const ether = nativeElementVfxPlan('ether', 0, 1)
  assert.equal(ether.filter(({ sprite }) => sprite === 'ray').length, 2)
  assert.ok(ether.filter(({ sprite }) => sprite === 'spark').length >= 6)
})

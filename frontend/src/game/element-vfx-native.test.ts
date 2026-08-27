import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_ELEMENT_VFX_SCALE,
  nativeElementVfxPlan,
  nativeElementVfxPlanAtPhase,
  nativeSelectedPrimaryElementVfxPlan,
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

test('explicit element phase preserves Ball Lightning inherited sub-tick motion', () => {
  assert.equal(
    nativeElementVfxPlan('ether', 12.75, 1)[0].scale,
    nativeElementVfxPlan('ether', 12, 1)[0].scale,
  )
  assert.notEqual(
    nativeElementVfxPlanAtPhase('ether', 12.75, 1)[0].scale,
    nativeElementVfxPlanAtPhase('ether', 12, 1)[0].scale,
  )
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

test('selected primary, not creation element, owns the equipped Staff orb program', () => {
  const rows = [
    [8, 'ether'],
    [16, 'fire'],
    [24, 'air'],
    [32, 'water'],
    [40, 'earth'],
  ] as const
  for (const [skillId, element] of rows) {
    assert.deepEqual(
      nativeSelectedPrimaryElementVfxPlan(skillId, 37, 1),
      nativeElementVfxPlan(element, 37, 1),
      String(skillId),
    )
  }

  assert.deepEqual(nativeSelectedPrimaryElementVfxPlan(-1, 37, 1), [])
  assert.deepEqual(nativeSelectedPrimaryElementVfxPlan(80, 37, 1), [])
  assert.deepEqual(nativeSelectedPrimaryElementVfxPlan(999, 37, 1), [])
})

test('all fifteen native Weld orb rows retain their distinct painter programs', () => {
  const tick = 37
  const ether = nativeElementVfxPlan('ether', tick, 1)
  const rows = new Map([
    [1003, ['earth', 'earth', 'core', 'core', 'core', 'air', 'air']],
    [1004, ['water', 'core', 'ray', 'ray', 'air', 'air']],
    [1005, ['steam', 'core']],
    [1006, ['earth', 'earth', 'core', 'core', 'earth', 'earth', 'core', 'core']],
    [1007, ['earth', 'earth', 'core', 'core', 'core', 'fire', 'fire']],
    [1008, ['earth', 'earth', 'core', 'core', 'water', 'core', 'ray', 'ray']],
    [1009, ['aura', 'core', 'core', 'core', 'core', 'air', 'air']],
    [1011, ['core', 'fire', 'fire', 'core', 'fire', 'fire']],
    [1012, ['water', 'core', 'ray', 'ray', 'water', 'core', 'ray', 'ray']],
    [1013, [
      'core', 'core', 'core', 'core', 'air', 'air',
      'core', 'core', 'core', 'core', 'air', 'air',
    ]],
    [1014, ['earth', 'earth', 'core', 'core', 'earth', 'earth', 'core', 'core']],
  ] as const)
  for (const [buildId, sprites] of rows) {
    assert.deepEqual(
      nativeSelectedPrimaryElementVfxPlan(buildId, tick, 1).map(({ sprite }) => sprite),
      sprites,
      String(buildId),
    )
  }
  assert.deepEqual(
    nativeSelectedPrimaryElementVfxPlan(1010, tick, 1),
    [...ether, ...ether],
  )

  const burningBolt = nativeSelectedPrimaryElementVfxPlan(1000, tick, 1)
  assert.deepEqual(
    burningBolt.slice(0, 3),
    nativeElementVfxPlan('fire', tick, 1),
  )
  assert.deepEqual(burningBolt.slice(3), ether.map((operation) => ({
    ...operation,
    alpha: operation.alpha * 0.25,
  })))
  const frostMissile = nativeSelectedPrimaryElementVfxPlan(1001, tick, 1)
  assert.deepEqual(
    frostMissile.slice(0, 4),
    nativeElementVfxPlan('water', tick, 1),
  )
  assert.deepEqual(
    frostMissile.slice(4).map(({ alpha }) => alpha),
    ether.map(({ alpha }) => alpha * 0.25),
  )
  const ballLightning = nativeSelectedPrimaryElementVfxPlan(1002, tick, 1)
  assert.deepEqual(
    ballLightning.slice(0, 6),
    nativeElementVfxPlan('air', tick, 1),
  )
  assert.deepEqual(
    ballLightning.slice(6).map(({ alpha }) => alpha),
    ether.map(({ alpha }) => alpha * 0.25),
  )
  const etherealBoulder = nativeSelectedPrimaryElementVfxPlan(1006, tick, 1)
  assert.ok(etherealBoulder.slice(4).every(({ blend }) => blend === 'lighter'))
  const crawlingShock = nativeSelectedPrimaryElementVfxPlan(1009, tick, 1)
  assert.equal(crawlingShock[0]?.rotation, tick * 8)
  assert.ok(crawlingShock.slice(1).every(({ alpha }) => alpha <= 0.5))

  const steamAnchors = Array.from({ length: 6 }, (_, frame) => (
    nativeSelectedPrimaryElementVfxPlan(1005, frame * 8, 1)[0]?.anchor
  ))
  assert.deepEqual(steamAnchors, [
    [16 / 34, 17 / 33],
    [18 / 37, 17 / 34],
    [17 / 35, 16 / 34],
    [16 / 34, 16 / 34],
    [16 / 35, 17 / 35],
    [16 / 34, 18 / 35],
  ])
  const steam = nativeSelectedPrimaryElementVfxPlan(1005, tick, 1)
  assert.equal(steam[0]?.alpha, steam[1]?.alpha)
  assert.ok(steam[0]!.alpha >= 0.2 && steam[0]!.alpha < 0.45)
  assert.ok(steam[0]!.color[1] >= 0.25 && steam[0]!.color[1] <= 1)

  const pulsingFlameLash = nativeSelectedPrimaryElementVfxPlan(1003, tick, 2.5)
  assert.equal(pulsingFlameLash.filter(({ sprite }) => sprite === 'core').length, 4)
  assert.equal(pulsingFlameLash[5]?.blend, 'lighter')
  assert.equal(pulsingFlameLash[5]?.alpha, 1)
})

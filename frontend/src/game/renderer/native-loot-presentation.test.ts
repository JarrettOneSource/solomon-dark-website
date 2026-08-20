import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  BoneyardGoodieSnapshot,
  BoneyardLootSnapshot,
} from '../protocol/game-state.ts'
import {
  nativeGoodiePainterLayer,
  nativeGoodiePresentationPlan,
  nativeLootPainterLayer,
  nativeLootPresentationPlan,
  nextNativeGoldScatterSeed,
} from './native-loot-presentation.ts'

test('Orb owns its fade-in and full-alpha two-pass native records', () => {
  const fading = nativeLootPresentationPlan(actor({
    alpha: 0.5,
    kind: 'orb',
    nativeTypeId: 2011,
    orbKind: 'health',
    orbValue: 0.5,
  }))
  assert.deepEqual(fading.layers.map(({ entry, role }) => [entry, role]), [
    [434, 'orb-fade-in'],
  ])
  assert.equal(fading.layers[0]?.scale.x, 0.5)

  const full = nativeLootPresentationPlan(actor({
    alpha: 1,
    animationPhase: 45,
    kind: 'orb',
    nativeTypeId: 2011,
    orbKind: 'mana',
    orbValue: 0.7,
  }))
  assert.deepEqual(full.layers.map(({ blendMode, entry, role }) => ({
    blendMode, entry, role,
  })), [
    { blendMode: 'normal', entry: 435, role: 'orb-core' },
    { blendMode: 'add', entry: 435, role: 'orb-white-additive' },
  ])
})

test('Gold drains all scatter records, tier copies, settled records, and native seed recurrence', () => {
  const seed = nextNativeGoldScatterSeed(12_345)
  assert.equal(seed, 941_153_951)
  for (const [tier, layerCount] of [
    [0, 1], [1, 2], [2, 3], [3, 5],
  ] as const) {
    const plan = nativeLootPresentationPlan(actor({
      kind: 'gold',
      nativeTypeId: 2012,
      scatterActive: true,
      scatterProgress: 8,
      scatterSeed: 12_345,
      tier,
    }))
    assert.equal(plan.layers.length, layerCount)
    assert.equal(plan.layers[0]?.entry, 196)
    assert.ok(plan.layers.slice(1).every(({ entry }) => entry === 188 + tier))
  }
  assert.deepEqual([0, 1, 2, 3].map((tier) => (
    nativeLootPresentationPlan(actor({
      animationPhase: 180,
      kind: 'gold',
      nativeTypeId: 2012,
      scatterActive: false,
      tier,
    })).layers[0]?.entry
  )), [198, 199, 200, 201])
  const pulse = nativeLootPresentationPlan(actor({
    animationPhase: 90,
    kind: 'gold',
    nativeTypeId: 2012,
    scatterActive: false,
  })).layers[1]!
  assert.equal(pulse.entry, 73)
  assert.equal(pulse.alpha, 1)
  assert.deepEqual(pulse.scale, { x: 1.25, y: 1.25 })
})

test('Sack ground art distinguishes every Potion, Misc, equipment, and nested Sack carrier', () => {
  assert.deepEqual(Array.from({ length: 6 }, (_, subtype) => (
    nativeLootPresentationPlan(actor({
      bounceHeight: -7,
      itemNativeSubtype: subtype,
      itemNativeTypeId: 7001,
      kind: 'sack',
      nativeTypeId: 2013,
    })).layers.map(({ entry }) => entry)
  )), [[436], [437], [438], [439], [440], [441]])
  assert.deepEqual(nativeLootPresentationPlan(actor({
    itemNativeSubtype: 1,
    itemNativeTypeId: 7012,
    kind: 'sack',
    nativeTypeId: 2013,
  })).layers.map(({ entry }) => entry), [33])
  for (const nativeTypeId of [7002, 7003, 7004, 7005, 7006, 7008, 7011]) {
    assert.deepEqual(nativeLootPresentationPlan(actor({
      itemNativeTypeId: nativeTypeId,
      kind: 'sack',
      nativeTypeId: 2013,
    })).layers.map(({ entry }) => entry), [67, 442])
  }
})

test('all three Bonus kinds own both support glyphs and their complete record banks', () => {
  const plans = [0, 1, 2].map((bonusKind) => nativeLootPresentationPlan(actor({
    bonusKind: bonusKind as 0 | 1 | 2,
    framePhase: 17.9,
    kind: 'bonus',
    nativeTypeId: 2038,
  })))
  assert.deepEqual(plans.map(({ layers }) => layers.map(({ entry }) => entry)), [
    [7, 7, 157],
    [7, 7, 139],
    [7, 7, 61],
  ])
  assert.deepEqual(plans.map(({ layers }) => layers[0]?.tint), [0xffbfbf, 0xbfffff, 0xd9ba70])
  assert.deepEqual(plans[0]?.layers.slice(0, 2).map(({ alpha, scale }) => ({ alpha, scale })), [
    { alpha: 0.5, scale: { x: 2.5, y: 2.5 } },
    { alpha: 0.25, scale: { x: 2.25, y: 2.25 } },
  ])
})

test('Goodie phases and active indicator retain native art and painter ownership', () => {
  const phases = [0, 1, 2] as const
  assert.deepEqual(phases.map((phase) => nativeGoodiePresentationPlan(goodie({ phase }), 0)
    .map(({ entry }) => entry)), [[145], [146], [147]])
  assert.deepEqual(nativeGoodiePresentationPlan(goodie({ active: true, timer: 50 }), 10)
    .map(({ entry }) => entry), [145, 33])
  assert.deepEqual(nativeGoodiePresentationPlan(goodie({ active: true, timer: 50 }), 20)
    .map(({ entry }) => entry), [145])
  assert.equal(nativeLootPainterLayer(actor(), 4).id, 'loot:7')
  assert.equal(nativeGoodiePainterLayer(goodie(), 5).id, 'goodie:9')
})

function actor(overrides: Partial<BoneyardLootSnapshot> = {}): BoneyardLootSnapshot {
  return {
    activationDelayTicks: 0,
    ageTicks: 0,
    alpha: 1,
    amount: 0,
    animationPhase: 0,
    bonusKind: null,
    bounceHeight: 0,
    framePhase: 0,
    id: 7,
    itemNativeSubtype: null,
    itemNativeTypeId: null,
    kind: 'orb',
    nativeTypeId: 2011,
    orbKind: 'health',
    orbValue: 0.5,
    position: { x: 100, y: 200 },
    rotationDeg: 0,
    scatterActive: false,
    scatterProgress: 0,
    scatterSeed: 0,
    source: 'enemy',
    spawnTick: 0,
    tier: 0,
    ...overrides,
  }
}

function goodie(overrides: Partial<BoneyardGoodieSnapshot> = {}): BoneyardGoodieSnapshot {
  return {
    active: false,
    exhausted: false,
    id: 9,
    phase: 0,
    position: { x: 100, y: 200 },
    subtype: 0,
    timer: 0,
    ...overrides,
  }
}

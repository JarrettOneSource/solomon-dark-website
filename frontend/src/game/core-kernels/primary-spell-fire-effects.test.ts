import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from './native-rng.ts'
import {
  createNativeFireDetonation,
  drawNativeFirePrivateSeed,
  nativeFireDirectDamage,
  stepNativeFireEmber,
  type NativeFireProjectilePayload,
} from './primary-spell-fire-effects.ts'

const PAYLOAD = Object.freeze({
  burnDamage: 10,
  emberDamage: 8,
  emberFragments: 4,
  explodeDamage: 12,
  explodeRadius: 15,
  privateSeed: 123_456,
  spentEmber: Object.freeze({ damage: 20, kind: 'immolate' as const }),
}) satisfies NativeFireProjectilePayload

test('pins Fireball direct/splash partition and private seed ownership', () => {
  assert.equal(nativeFireDirectDamage(30, 12), 18)
  assert.equal(nativeFireDirectDamage(30, 0), 30)
  assert.throws(() => nativeFireDirectDamage(5, 6), /exceeds/)

  const draw = drawNativeFirePrivateSeed(createNativeRng(7))
  assert.equal(draw.seed >= 0 && draw.seed <= 1_000_000, true)
  assert.equal(draw.rng.indexA, 1)
})

test('creates the exact-count seeded fan, footprint, and ten pre-ticks', () => {
  const sourceRng = createNativeRng(900)
  const first = createNativeFireDetonation(
    50, PAYLOAD, { x: 10, y: 20 }, 'p1', 'world', sourceRng,
  )
  const second = createNativeFireDetonation(
    50, PAYLOAD, { x: 10, y: 20 }, 'p1', 'world', sourceRng,
  )
  assert.deepEqual(first, second)
  assert.equal(first.nextId, 54)
  assert.deepEqual(first.embers.map(({ ageTicks, id }) => ({ ageTicks, id })), [
    { ageTicks: 10, id: 50 },
    { ageTicks: 10, id: 51 },
    { ageTicks: 10, id: 52 },
    { ageTicks: 10, id: 53 },
  ])
  assert.equal(first.rng.indexA, 12)
  assert.deepEqual(
    first.embers.map(({ phase, presentationVariant }) => ({ phase, presentationVariant })),
    [
      { phase: 0.7481598854064941, presentationVariant: 3 },
      { phase: 2.831279993057251, presentationVariant: 1 },
      { phase: 2.3449201583862305, presentationVariant: 2 },
      { phase: 2.4824399948120117, presentationVariant: 4 },
    ],
  )
  assert.deepEqual(first.explosion, {
    burnDamage: 10,
    damage: 6,
    footprintDimension: 208.99999737739563,
    origin: { x: 10, y: 20 },
    ownerId: 'p1',
    visualScale: 1.899999976158142,
    worldKey: 'world',
  })
})

test('Ember bounces, settles, and Immolates only on natural grounded retirement', () => {
  let ember = createNativeFireDetonation(
    1,
    { ...PAYLOAD, emberFragments: 1 },
    { x: 0, y: 0 },
    'p1',
    'world',
    createNativeRng(3),
  ).embers[0]!
  let retirement = null
  for (let tick = 0; tick < 2_000; tick += 1) {
    const stepped = stepNativeFireEmber(ember)
    if (!stepped.ember) {
      retirement = stepped.retirement
      break
    }
    ember = stepped.ember
  }
  assert.deepEqual(retirement, {
    explosion: {
      burnDamage: 10,
      damage: 10,
      footprintDimension: 110,
      origin: ember.position,
      ownerId: 'p1',
      visualScale: 1,
      worldKey: 'world',
    },
    kind: 'immolate',
  })
})

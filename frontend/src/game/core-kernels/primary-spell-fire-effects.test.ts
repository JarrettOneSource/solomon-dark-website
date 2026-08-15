import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from './native-rng.ts'
import {
  createNativeFirePatch,
  createNativeFireDetonation,
  drawNativeFirePrivateSeed,
  NATIVE_FIRE_PATCH_CONTACT_DAMAGE_FACTOR,
  nativeFireDirectDamage,
  spawnNativeFireGoodImp,
  stepNativeFireGoodImp,
  stepNativeFirePatch,
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

test('Fire patches own the float animation clock and exact three-tick contact normalization', () => {
  const patch = createNativeFirePatch({
    burnDamage: 9,
    damage: 40,
    id: 7,
    nativeType: 'fire',
    ownerId: 'p1',
    position: { x: 10, y: 20 },
    worldKey: 'world',
  })
  assert.equal(NATIVE_FIRE_PATCH_CONTACT_DAMAGE_FACTOR, 0.015)

  const first = stepNativeFirePatch(patch, 1)
  assert.equal(first.contact, null)
  assert.equal(first.patch?.phase, 0.25)
  assert.equal(first.patch?.alpha, 0.05000000074505806)

  const contact = stepNativeFirePatch(first.patch!, 3)
  assert.deepEqual(contact.contact, {
    amount: 40 * NATIVE_FIRE_PATCH_CONTACT_DAMAGE_FACTOR,
    burnDamage: 9,
    footprintDimension: 32,
    kind: 'fire-patch',
    ownerId: 'p1',
    position: { x: 10, y: 20 },
    spellId: 7,
    worldKey: 'world',
  })
})

test('GoodImp preserves the native constructor stream, landing attack, flight state, and targetless expiry', () => {
  const spawned = spawnNativeFireGoodImp({
    burnDamage: 9,
    damage: 12,
    id: 8,
    lifetimeTicks: 300,
    ownerId: 'p1',
    position: { x: 0, y: 0 },
    worldKey: 'world',
  }, createNativeRng(123))
  assert.equal(spawned.rng.indexA, 19)
  assert.equal(spawned.goodImp.bodyVariant >= 0 && spawned.goodImp.bodyVariant < 4, true)
  assert.equal(spawned.goodImp.bodyScale >= 0.93 && spawned.goodImp.bodyScale <= 1.03, true)
  assert.equal(spawned.goodImp.collisionRadius >= 0 && spawned.goodImp.collisionRadius <= 2.5, true)
  const target = {
    active: true,
    actorFlags: 0x2,
    attachment: { x: 0, y: 0 },
    bodyRadius: 8,
    id: 'enemy:4',
    kind: 'enemy' as const,
    nativePriority: 0,
    pendingRemove: false,
    position: { x: 20, y: 0 },
    registrationOrder: 0,
  }
  const first = stepNativeFireGoodImp(spawned.goodImp, {
    canOccupy: () => true,
    rng: spawned.rng,
    targets: [target],
  })
  assert.equal(first.goodImp?.remainingTicks, 299)
  assert.equal(first.goodImp?.position.x, 11.25)
  assert.equal(first.goodImp?.verticalVelocity, Math.fround(0.4))
  assert.equal(first.contact, null)

  const landed = stepNativeFireGoodImp(first.goodImp!, {
    canOccupy: () => true,
    rng: first.rng,
    targets: [target],
  })
  assert.deepEqual(landed.contact, {
    amount: 12,
    kind: 'fire-good-imp',
    ownerId: 'p1',
    spellId: 8,
    targetId: 'enemy:4',
    worldKey: 'world',
  })
  const landedImp = landed.goodImp!
  assert.equal(landedImp.contactAgeTicks, 0)
  assert.equal(landedImp.effectAlpha, 1)
  assert.equal(landedImp.verticalOffset, 0)
  assert.equal(landedImp.bounceSoundSequence, 1)
  assert.equal(landedImp.bounceSoundIndex >= 0 && landedImp.bounceSoundIndex < 8, true)
  assert.equal(landedImp.contactSoundSequence, 1)
  assert.equal(landedImp.contactSoundIndex >= 0 && landedImp.contactSoundIndex < 3, true)
  assert.equal(landed.rng.indexA, 33)

  const targetless = stepNativeFireGoodImp({ ...spawned.goodImp, remainingTicks: 2 }, {
    canOccupy: () => true,
    rng: spawned.rng,
    targets: [],
  })
  assert.equal(targetless.goodImp, null)
  assert.equal(targetless.releaseFire, true)
  assert.deepEqual(targetless.releasePosition, { x: 0, y: 0 })
})

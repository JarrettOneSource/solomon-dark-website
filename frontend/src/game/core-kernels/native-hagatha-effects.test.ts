import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NATIVE_HAGATHA_BOSS_TYPE_IDS,
  NATIVE_HAGATHA_FACTORS,
  NATIVE_HAGATHA_LAST_WORD_ARCHIVE_TICK,
  NATIVE_HAGATHA_LAST_WORD_DAMAGE,
  NATIVE_HAGATHA_LAST_WORD_DEATH_TICK,
  NATIVE_HAGATHA_LAST_WORD_RADIUS,
  NATIVE_HAGATHA_SELECTORS,
  applyNativeHagathaPurchaseRuntime,
  clearNativeHagathaUntilHurt,
  consumeNativeHagathaCheatDeath,
  createNativeHagathaRuntimeState,
  nativeHagathaBossDamageFactor,
  nativeHagathaDerivedModifiers,
  nativeHagathaDrinkerShouldUseHealthPotion,
  nativeHagathaDrinkerShouldUseManaPotion,
  nativeHagathaRevelationRank,
  nativeHagathaSeekerSegments,
  removeNativeHagathaRuntime,
} from './native-hagatha-effects.ts'

test('pins all 28 native selector rows and recovered constants', () => {
  assert.deepEqual(Object.values(NATIVE_HAGATHA_SELECTORS), [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  ])
  assert.deepEqual(NATIVE_HAGATHA_BOSS_TYPE_IDS, [1008, 1009, 1010, 1011])
  assert.equal(NATIVE_HAGATHA_LAST_WORD_DEATH_TICK, 200)
  assert.equal(NATIVE_HAGATHA_LAST_WORD_ARCHIVE_TICK, 300)
  assert.equal(NATIVE_HAGATHA_LAST_WORD_RADIUS, 825)
  assert.equal(NATIVE_HAGATHA_LAST_WORD_DAMAGE, 5_000)
})

test('purchase-time one-shots clear only after positive health damage and Cheat Death is consumed', () => {
  const purchased = applyNativeHagathaPurchaseRuntime(createNativeHagathaRuntimeState(), [
    NATIVE_HAGATHA_SELECTORS.cheatDeath,
    NATIVE_HAGATHA_SELECTORS.serendipity,
    NATIVE_HAGATHA_SELECTORS.reverie,
  ])
  assert.deepEqual(purchased, {
    cheatDeathCharges: 1,
    reverieActive: true,
    serendipityActive: true,
  })
  assert.strictEqual(clearNativeHagathaUntilHurt(purchased, 0), purchased)
  const hurt = clearNativeHagathaUntilHurt(purchased, 1)
  assert.deepEqual(hurt, {
    cheatDeathCharges: 1,
    reverieActive: false,
    serendipityActive: false,
  })
  const cheat = consumeNativeHagathaCheatDeath(hurt, 50)
  assert.equal(cheat.triggered, true)
  assert.equal(cheat.currentHealth, 25)
  assert.equal(cheat.runtime.cheatDeathCharges, 0)
})

test('requested ownership removal clears only the matching retained Hagatha runtime lane', () => {
  const active = applyNativeHagathaPurchaseRuntime(createNativeHagathaRuntimeState(), [7, 24, 25])
  const noCheat = removeNativeHagathaRuntime(active, 7)
  assert.deepEqual(noCheat, {
    cheatDeathCharges: 0,
    reverieActive: true,
    serendipityActive: true,
  })
  const noSerendipity = removeNativeHagathaRuntime(noCheat, 24)
  assert.deepEqual(noSerendipity, {
    cheatDeathCharges: 0,
    reverieActive: true,
    serendipityActive: false,
  })
  assert.deepEqual(removeNativeHagathaRuntime(noSerendipity, 25), {
    cheatDeathCharges: 0,
    reverieActive: false,
    serendipityActive: false,
  })
  assert.strictEqual(removeNativeHagathaRuntime(active, 4), active)
})

test('derived charms and curses compose in their exact offensive and defensive lanes', () => {
  const owned = [2, 10, 11, 16, 18, 20, 24, 25, 26]
  const active = applyNativeHagathaPurchaseRuntime(createNativeHagathaRuntimeState(), [24, 25])
  const bare = nativeHagathaDerivedModifiers(owned, active, false)
  assert.equal(bare.castSpeedFactor, NATIVE_HAGATHA_FACTORS.speed)
  assert.equal(bare.movementFactor, NATIVE_HAGATHA_FACTORS.speed)
  assert.equal(bare.incomingDamageFactor, 2)
  assert.equal(bare.spellDamageFactor, Math.fround(
    NATIVE_HAGATHA_FACTORS.serendipityDamage
      * NATIVE_HAGATHA_FACTORS.bareHandsDamage
      * NATIVE_HAGATHA_FACTORS.glassCannon,
  ))
  assert.equal(bare.offensiveManaFactor, 0)
  assert.equal(bare.meleeDamageFactor, 6)
  assert.equal(bare.poisonDamageFactor, 0.5)
  assert.equal(bare.pushStrengthFactor, 2)
  assert.equal(bare.rechargeFactor, 1.25)

  const armed = nativeHagathaDerivedModifiers(owned, createNativeHagathaRuntimeState(), true)
  assert.equal(armed.spellDamageFactor, 2)
  assert.equal(armed.offensiveManaFactor, 0.75)
})

test('Revelation, boss curse, and Drinker retain their native predicates', () => {
  assert.equal(nativeHagathaRevelationRank(1, [6]), 2)
  assert.equal(nativeHagathaRevelationRank(1, []), 1)
  for (const nativeTypeId of NATIVE_HAGATHA_BOSS_TYPE_IDS) {
    assert.equal(nativeHagathaBossDamageFactor([22], nativeTypeId), 3)
  }
  assert.equal(nativeHagathaBossDamageFactor([22], 1007), 1)
  assert.equal(nativeHagathaDrinkerShouldUseHealthPotion([15], -10), true)
  assert.equal(nativeHagathaDrinkerShouldUseHealthPotion([15], -9.999), false)
  assert.equal(nativeHagathaDrinkerShouldUseManaPotion([15], 5, 100, 6), true)
  assert.equal(nativeHagathaDrinkerShouldUseManaPotion([15], 5, 6, 6), false)
})

test('Seeker plans the owner-local two-segment native gradient without RNG', () => {
  const segments = nativeHagathaSeekerSegments(
    { x: 10, y: 20 },
    [
      { id: 2, kind: 'gold', position: { x: 10, y: 120 } },
      { id: 3, kind: 'sack', position: { x: 310, y: 20 } },
      { id: 4, kind: 'bonus', position: { x: 109, y: 20 } },
    ],
    5,
  )
  assert.equal(segments.length, 2)
  assert.deepEqual(segments.map((segment) => ({
    end: segment.end,
    endVisible: segment.endVisible,
    start: segment.start,
    startVisible: segment.startVisible,
    targetId: segment.targetId,
    width: segment.width,
  })), [
    {
      end: { x: 60, y: 20 },
      endVisible: true,
      start: { x: 45, y: 20 },
      startVisible: false,
      targetId: 3,
      width: 3,
    },
    {
      end: { x: 160, y: 20 },
      endVisible: false,
      start: { x: 60, y: 20 },
      startVisible: true,
      targetId: 3,
      width: 3,
    },
  ])
})

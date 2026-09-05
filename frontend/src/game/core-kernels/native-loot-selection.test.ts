import assert from 'node:assert/strict'
import test from 'node:test'

import { ALL_DISABLED, input } from '../../../tools/native-loot-test-fixture.ts'
import { createNativeRng } from './native-rng.ts'
import { createNativeLootItemIds } from './native-loot-items.ts'
import {
  NATIVE_LOOT_DEFAULT_MODIFIERS, advanceNativeKeyDropLevel,
  initialNativeKeyDropLevel, nativeLootModifiers, rollNativeEnemyLoot,
  type NativeLootCategory,
} from './native-loot.ts'

test('native candidate ordering and biased choice select all six list sizes', () => {
  const categories = ['orb', 'gold', 'item', 'potion', 'powerup'] as const
  // Independent Integer instruction replay for private seeds 0..7, counts 1..5.
  const indexes = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 1],
    [0, 0, 0, 1, 2, 2, 0, 0],
    [3, 0, 0, 1, 2, 2, 3, 3],
    [3, 4, 4, 0, 1, 1, 2, 2],
  ]
  for (const [index, choices] of indexes.entries()) {
    const source = input({ policies: {
      ...ALL_DISABLED, orb: 3, gold: index >= 1 ? 3 : 4, item: index >= 2 ? 3 : 4,
      potion: index >= 3 ? 3 : 4, powerup: index >= 4 ? 3 : 4,
    } })
    for (const [actorSeed, choice] of choices.entries()) {
      assert.equal(rollNativeEnemyLoot({ ...source, actorSeed }).selectedCategory,
        categories[choice]!)
    }
  }
  for (const [actorSeed, expected] of [[311, 'key'], [1222, 'orb'], [2896, 'potion'], [3807, 'key']] as const) {
    assert.equal(rollNativeEnemyLoot(input({
      actorSeed,
      key: { current: 5, level: 10, remaining: 1 },
      policies: { gold: 3, orb: 3, item: 3, potion: 3, powerup: 3, specificItem: 0 },
    })).selectedCategory, expected)
  }
})

test('applies every purchased native drop modifier at its final owner', () => {
  assert.deepEqual(nativeLootModifiers([]), NATIVE_LOOT_DEFAULT_MODIFIERS)
  assert.deepEqual(nativeLootModifiers([3, 4, 9, 23]), {
    goldAmount: 1.25,
    goldChance: 0.75,
    itemChance: 0.75,
    orbChance: 0.5,
    orbPull: 1,
    orbValueBonus: true,
    pickupFactor: 1.25,
    powerupChance: Math.fround(0.800000011920929),
  })
  assert.deepEqual(nativeLootModifiers([], {
    goldAmount: 1,
    orbPull: 2,
    pickupFactor: 6.25,
  }), {
    ...NATIVE_LOOT_DEFAULT_MODIFIERS,
    orbPull: 2,
    pickupFactor: 6.25,
  })
  assert.equal(nativeLootModifiers([4], {
    goldAmount: 1.5,
    orbPull: 1,
    pickupFactor: 1.25,
  }).goldAmount, Math.fround(1.5 * Math.fround(1.25)))
  assert.throws(() => nativeLootModifiers([], {
    goldAmount: 1,
    orbPull: Number.NaN,
    pickupFactor: 1.25,
  }), /Orb pull factor/)
  assert.throws(() => nativeLootModifiers([], {
    goldAmount: Number.NaN,
    orbPull: 1,
    pickupFactor: 1.25,
  }), /Gold amount factor/)
})

test('pins the complete native powerup level table and exclusions', () => {
  // Distinct winning seeds from the native 675/693/738/828/918/1053/1233 bounds.
  for (const [level, actorSeed] of [
    [2, 414], [9, 414], [11, 779], [14, 779], [16, 325], [19, 325],
    [21, 328], [24, 328], [26, 331], [29, 331], [31, 791], [34, 791],
    [36, 797], [39, 797], [41, 797], [99, 797],
  ] as const) {
    const source = input({ actorSeed, policies: { ...ALL_DISABLED, powerup: 0 } })
    assert.equal(rollNativeEnemyLoot({
      ...source, participant: { ...source.participant, level },
    }).selectedCategory, 'powerup')
  }
  for (const level of [0, 1, 5, 10, 15, 20, 25, 30, 35, 40]) {
    const source = input({ actorSeed: 84, policies: { ...ALL_DISABLED, powerup: 0 } })
    assert.equal(rollNativeEnemyLoot({
      ...source, participant: { ...source.participant, level },
    }).selectedCategory, null)
    assert.equal(rollNativeEnemyLoot({
      ...source, participant: { ...source.participant, level },
      policies: { ...ALL_DISABLED, powerup: 3 },
    }).selectedCategory, 'powerup')
  }
})

test('replays reviewed G7 actor-private death decisions', () => {
  // First 18 non-short-circuited rows from Mod Loader loot-goldens.json,
  // reviewed fixture SHA-256 dabdd9cdd87dc78b4b800477d2765a1afd63f86da22cf19427b5eb077cc6be26.
  const rows: readonly (readonly [number, NativeLootCategory | null])[] = [
    [2_432_785, null], [5_322, null], [3_200_991, null], [8_899_151, null],
    [8_226_040, null], [5_290_489, null], [3_583_320, null], [6_778_989, 'orb'],
    [9_974_658, 'gold'], [141_866, null], [8_868_487, 'orb'], [8_315_401, 'orb'],
    [3_385_448, null], [2_832_362, null], [1_033_012, null], [6_103_059, null],
    [7_424_351, null], [8_745_643, 'orb'],
  ]
  const policies = { gold: 0, item: 0, orb: 0, potion: 0, powerup: 0, specificItem: 0 } as const
  for (const [actorSeed, expected] of rows) {
    const result = rollNativeEnemyLoot(input({
      actorSeed,
      arena: {
        disableMask: 0,
        itemLevelMaximum: 100,
        itemLevelMinimum: 0,
        lastSuccessfulItemLevel: -1,
        level: 0,
        mode: 0,
        specialSuppression: false,
      },
      itemIds: createNativeLootItemIds(1),
      participant: {
        advancedUnlocks: new Array<boolean>(8).fill(false),
        level: 1,
        modifiers: NATIVE_LOOT_DEFAULT_MODIFIERS,
        ownedRecipeIndexes: [],
        slot: 0,
      },
      policies,
      // Seed 100 makes the shared emergency first roll miss; these fixture
      // rows continued into the actor-private table rather than short-circuiting.
      sharedRng: createNativeRng(100),
    }))
    assert.equal(result.selectedCategory, expected, `actor seed ${actorSeed}`)
  }
})

test('forced native policies materialize every drop category through shared rules', () => {
  const categories: NativeLootCategory[] = [
    'orb', 'gold', 'item', 'potion', 'powerup',
  ]
  for (const [index, category] of categories.entries()) {
    const result = rollNativeEnemyLoot(input({
      policies: { ...ALL_DISABLED, [category]: 3 },
      sceneForcesHealthPotion: category === 'potion',
      sharedRng: createNativeRng(100 + index * 3),
    }))
    assert.equal(result.selectedCategory, category)
    assert.equal(result.emergencyPotionAttempted, false)
    assert.ok(result.drops.length > 0)
    assert.ok(result.drops.every((drop) => drop.source === 'enemy'))
  }

  const key = rollNativeEnemyLoot(input({
    actorSeed: 311,
    key: { current: 0, level: 20, remaining: 1 },
    sharedRng: createNativeRng(777),
  }))
  assert.equal(key.selectedCategory, 'key')
  assert.equal(key.drops[0]?.kind, 'sack')
  assert.equal(key.drops[0]?.item?.nativeTypeId, 7012)
  assert.equal(key.drops[0]?.item?.nativeSubtype, 1)
  assert.ok(key.nextKeyDropLevel >= 15 && key.nextKeyDropLevel <= 25)
})

test('key rolls retain the stock clamp throughout early eligible waves', () => {
  // Retail 0x0047C32D..0x0047C338 clamps the signed quotient before adding ten.
  // Independent instruction replay: seed 236 -> raw 802, seed 311 -> raw 1002.
  for (const level of [5, 6, 9, 10, 11, 14, 15, 16, 19, 20, 24]) {
    for (const [actorSeed, expected] of [[236, null], [311, 'key']] as const) {
      const source = input({ actorSeed })
      const result = rollNativeEnemyLoot({
        ...source,
        arena: { ...source.arena, level },
        key: { current: 5, level, remaining: 1 },
      })
      assert.equal(result.selectedCategory, expected, `wave ${level}, seed ${actorSeed}`)
      assert.equal(result.drops.length, expected === null ? 0 : 1)
    }
  }
})

test('a winning key seed cannot bypass its wave gate, unopened chest count, or disable mask', () => {
  const source = input({ actorSeed: 311, key: { current: 10, level: 10, remaining: 1 } })
  for (const blocked of [
    { ...source, key: { ...source.key, level: 9 } },
    { ...source, key: { ...source.key, remaining: 0 } },
    { ...source, arena: { ...source.arena, disableMask: 1 << 4 } },
  ]) {
    const result = rollNativeEnemyLoot(blocked)
    assert.equal(result.selectedCategory, null)
    assert.equal(result.nextKeyDropLevel, 10)
    assert.deepEqual(result.drops, [])
  }
})

test('forced Potions append in ordinary scenes and replace earlier candidates only in the health-potion scene', () => {
  const source = input({ policies: { ...ALL_DISABLED, potion: 3 } })
  assert.equal(rollNativeEnemyLoot(source).selectedCategory, 'potion')

  const laterCandidates = new Set<NativeLootCategory | null>()
  for (let actorSeed = 0; actorSeed < 16; actorSeed += 1) {
    const forced = {
      ...source,
      actorSeed,
      policies: { ...ALL_DISABLED, orb: 3, gold: 3, item: 3, potion: 3 } as const,
      sceneForcesHealthPotion: true,
    }
    const potion = rollNativeEnemyLoot(forced)
    assert.equal(potion.selectedCategory, 'potion')
    assert.equal(potion.drops[0]?.item?.nativeSubtype, 0)
    laterCandidates.add(rollNativeEnemyLoot({
      ...forced,
      policies: { ...forced.policies, powerup: 3 },
    }).selectedCategory)
  }
  assert.deepEqual(laterCandidates, new Set(['potion', 'powerup']))
  const disabled = rollNativeEnemyLoot({
    ...source,
    arena: { ...source.arena, disableMask: 1 << 1 },
    policies: { ...ALL_DISABLED, gold: 3, potion: 3 },
    sceneForcesHealthPotion: true,
  })
  assert.equal(disabled.selectedCategory, 'gold')
  for (const policy of [0, 4] as const) {
    assert.equal(rollNativeEnemyLoot({
      ...source, actorSeed: 0,
      policies: { ...ALL_DISABLED, gold: 3, potion: policy },
      sceneForcesHealthPotion: true,
    }).selectedCategory, 'gold')
  }
})

test('emergency health Potion short-circuits only after both strict density thresholds', () => {
  const policies = { gold: 0, item: 0, orb: 0, potion: 0, powerup: 0, specificItem: 0 } as const
  let gateSeed = -1
  for (let seed = 1; seed < 10_000; seed += 1) {
    const result = rollNativeEnemyLoot(input({
      nearbyMaskTwoCount: 50,
      policies,
      sharedRng: createNativeRng(seed),
      worldBadguyCount: 80,
    }))
    if (!result.emergencyPotionAttempted) continue
    gateSeed = seed
    assert.equal(result.selectedCategory, 'potion')
    assert.equal(result.drops[0]?.item?.nativeSubtype, 0)
    break
  }
  assert.notEqual(gateSeed, -1)

  for (const blocked of [
    { nearbyMaskTwoCount: 49 },
    { worldBadguyCount: 79 },
    { inventoryHasHealthPotion: true },
    { worldHasHealthPotionSack: true },
  ]) {
    const result = rollNativeEnemyLoot(input({
      nearbyMaskTwoCount: 50,
      policies,
      sharedRng: createNativeRng(gateSeed),
      worldBadguyCount: 80,
      ...blocked,
    }))
    assert.equal(result.emergencyPotionAttempted, true)
    assert.equal(result.selectedCategory, null)
    assert.deepEqual(result.drops, [])
  }
})

test('policy-5 Gold appends after another category, respects suppression, and spends one pitch word', () => {
  const policies = { ...ALL_DISABLED, gold: 5, orb: 3 } as const
  const sourceRng = createNativeRng(991)
  const result = rollNativeEnemyLoot(input({ policies, sharedRng: sourceRng }))
  assert.equal(result.selectedCategory, 'orb')
  assert.equal(result.drops[0]?.kind, 'orb')
  assert.equal(
    result.drops.filter(({ kind }) => kind === 'gold')
      .reduce((sum, drop) => sum + (drop.amount ?? 0), 0),
    1_000,
  )
  assert.notStrictEqual(result.sharedRng, sourceRng)

  const suppressed = rollNativeEnemyLoot(input({
    arena: {
      disableMask: 0,
      itemLevelMaximum: 100,
      itemLevelMinimum: 0,
      lastSuccessfulItemLevel: -1,
      level: 10,
      mode: 0,
      specialSuppression: true,
    },
    policies,
    sharedRng: createNativeRng(991),
  }))
  assert.deepEqual(suppressed.drops.map(({ kind }) => kind), ['orb'])
})

test('nonzero participant slots materialize only native Orb and Key families', () => {
  const participant = {
    advancedUnlocks: new Array<boolean>(8).fill(false),
    level: 12,
    modifiers: NATIVE_LOOT_DEFAULT_MODIFIERS,
    ownedRecipeIndexes: [],
    slot: 1,
  }
  const gold = rollNativeEnemyLoot(input({
    participant,
    policies: { ...ALL_DISABLED, gold: 3 },
  }))
  assert.equal(gold.selectedCategory, 'gold')
  assert.deepEqual(gold.drops, [])
  const orb = rollNativeEnemyLoot(input({
    participant,
    policies: { ...ALL_DISABLED, orb: 3 },
  }))
  assert.equal(orb.selectedCategory, 'orb')
  assert.equal(orb.drops.length, 1)
})

test('suppressed nonzero-slot primary rewards retain policy-five supplemental Gold', () => {
  const source = input({ policies: { ...ALL_DISABLED, potion: 3, gold: 5 } })
  const result = rollNativeEnemyLoot({
    ...source,
    participant: { ...source.participant, slot: 1 },
  })
  assert.equal(result.selectedCategory, 'potion')
  assert.ok(result.drops.length > 0)
  assert.ok(result.drops.every(({ kind }) => kind === 'gold'))
  assert.equal(result.drops.reduce((total, drop) => total + drop.amount!, 0), 1_000)
})

test('a nonzero native player slot still receives a selected Wizard Key', () => {
  const source = input({ actorSeed: 311, key: { current: 5, level: 10, remaining: 1 } })
  const result = rollNativeEnemyLoot({
    ...source, participant: { ...source.participant, slot: 1 },
  })
  assert.equal(result.selectedCategory, 'key')
  assert.equal(result.drops[0]?.item?.nativeTypeId, 7012)
  assert.equal(result.drops[0]?.item?.nativeSubtype, 1)
})

test('the emergency lane owns exactly its shared precheck words and forced-policy bypasses', () => {
  for (const [seed, words, attempted] of [[0, 1, false], [1, 2, false], [2, 2, true]] as const) {
    const source = input({ sharedRng: createNativeRng(seed) })
    const result = rollNativeEnemyLoot({ ...source, arena: { ...source.arena, disableMask: 63 } })
    assert.equal(result.emergencyPotionAttempted, attempted)
    assert.equal(result.sharedRng.indexA, words)
    assert.equal(result.sharedRng.indexB, 31 + words)
    assert.deepEqual(result.drops, [])
  }
  for (const policies of [
    { ...ALL_DISABLED, orb: 3 }, { ...ALL_DISABLED, gold: 3 },
    { ...ALL_DISABLED, item: 3 }, { ...ALL_DISABLED, potion: 3 },
    { ...ALL_DISABLED, gold: 5 },
  ] as const) {
    const source = input({ policies, sharedRng: createNativeRng(2) })
    const result = rollNativeEnemyLoot({ ...source, arena: { ...source.arena, disableMask: 63 } })
    assert.equal(result.emergencyPotionAttempted, false)
    assert.strictEqual(result.sharedRng, source.sharedRng)
  }
})

test('initial and post-drop key thresholds consume the exact shared Integer bands', () => {
  const initial = initialNativeKeyDropLevel(createNativeRng(17))
  assert.ok(initial.level >= 5 && initial.level <= 12)
  const second = advanceNativeKeyDropLevel(initial.sharedRng, 12)
  assert.ok(second.level >= 15 && second.level <= 25)
  const third = advanceNativeKeyDropLevel(second.sharedRng, 25)
  assert.ok(third.level >= 30 && third.level <= 40)
  const fourth = advanceNativeKeyDropLevel(third.sharedRng, 40)
  assert.ok(fourth.level >= 50 && fourth.level <= 70)
  const terminal = advanceNativeKeyDropLevel(fourth.sharedRng, 50)
  assert.equal(terminal.level, 50)
  assert.strictEqual(terminal.sharedRng, fourth.sharedRng)
})

test('all ordinary, reduced and increased category policies retain native seed outcomes', () => {
  // Independent instruction replay; columns are policies 0, 1 and 2.
  for (const [category, actorSeed, wins] of [
    ['orb', 9, [true, false, true]], ['orb', 10, [true, true, true]], ['orb', 3, [false, false, true]],
    ['gold', 31, [true, false, false]], ['gold', 15, [false, true, false]], ['gold', 2, [false, false, true]],
    ['item', 2669, [true, false, true]], ['item', 647, [false, true, false]], ['item', 84, [false, false, true]],
    ['potion', 10, [true, false, true]], ['potion', 384, [false, true, false]], ['potion', 47, [false, false, true]],
    ['powerup', 84, [true, false, true]], ['powerup', 4059, [false, true, false]], ['powerup', 10, [false, false, true]],
  ] as const) {
    for (const policy of [0, 1, 2] as const) {
      const result = rollNativeEnemyLoot(input({
        actorSeed, policies: { ...ALL_DISABLED, [category]: policy },
      }))
      assert.equal(result.selectedCategory, wins[policy] ? category : null,
        `${category}, seed ${actorSeed}, policy ${policy}`)
    }
  }
})

test('Item admission uses the early-wave factor and the last successful Item wave', () => {
  // Native bounds 288000/144000/1440/720, using each bound's second winning residue.
  const scenarios = [[4, -1, 173390], [4, 4, 129845], [5, -1, 4243], [5, 5, 871]] as const
  for (const [level, lastSuccessfulItemLevel, winner] of scenarios) {
    for (const [, , actorSeed] of scenarios) {
      const source = input({ actorSeed, policies: { ...ALL_DISABLED, item: 0 } })
      const result = rollNativeEnemyLoot({
        ...source, arena: { ...source.arena, level, lastSuccessfulItemLevel },
      })
      assert.equal(result.selectedCategory, actorSeed === winner ? 'item' : null,
        `wave ${level}, last Item ${lastSuccessfulItemLevel}, seed ${actorSeed}`)
    }
  }
})

test('nonpositive candidate bounds append every affected category without an eligibility roll', () => {
  for (const [category, modifier] of [
    ['orb', 'orbChance'], ['gold', 'goldChance'],
    ['item', 'itemChance'], ['powerup', 'powerupChance'],
  ] as const) {
    for (const multiplier of [-1, 0, 0.0001]) {
      const source = input({ policies: { ...ALL_DISABLED, [category]: 0 } })
      const result = rollNativeEnemyLoot({
        ...source,
        participant: {
          ...source.participant,
          modifiers: { ...source.participant.modifiers, [modifier]: multiplier },
        },
      })
      assert.equal(result.selectedCategory, category, `${category}, multiplier ${multiplier}`)
      assert.ok(result.drops.length > 0)
    }
  }
})

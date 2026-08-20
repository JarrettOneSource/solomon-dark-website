import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from './native-rng.ts'
import {
  NATIVE_LOOT_CANDIDATE_ORDER,
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  NATIVE_LOOT_OPEN_PLACEMENT,
  advanceNativeKeyDropLevel,
  createNativeLootItemIds,
  initialNativeKeyDropLevel,
  materializeNativeLootScriptAction,
  nativeGoldTier,
  nativeLootCandidateWeights,
  nativeLootArenaDropLimits,
  nativeLootDisableMask,
  nativeLootModifiers,
  nativePowerupLevelBase,
  resolveNativeLootPlacement,
  resolveNativeGoodieContents,
  rollNativeEnemyLoot,
  type NativeLootCategory,
  type NativeLootSelectionInput,
} from './native-loot.ts'

const ALL_DISABLED = Object.freeze({
  gold: 4,
  item: 4,
  orb: 4,
  potion: 4,
  powerup: 4,
  specificItem: 0,
} as const)

test('pins the native six-category order and biased choice weights', () => {
  assert.deepEqual(NATIVE_LOOT_CANDIDATE_ORDER, [
    'key', 'orb', 'gold', 'item', 'potion', 'powerup',
  ])
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => (
    nativeLootCandidateWeights(index + 1)
  )), [
    [1],
    [1, 1],
    [2, 1, 1],
    [1, 1, 1, 1],
    [2, 2, 2, 1, 1],
    [2, 2, 1, 1, 1, 1],
  ])
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
    orbPull: 2,
    pickupFactor: 6.25,
  }), {
    ...NATIVE_LOOT_DEFAULT_MODIFIERS,
    orbPull: 2,
    pickupFactor: 6.25,
  })
  assert.throws(() => nativeLootModifiers([], {
    orbPull: Number.NaN,
    pickupFactor: 1.25,
  }), /Orb pull factor/)
})

test('pins the complete native powerup level table and exclusions', () => {
  assert.deepEqual(
    [1, 2, 5, 11, 16, 21, 26, 31, 36, 40].map(nativePowerupLevelBase),
    [null, 75, null, 77, 82, 92, 102, 117, 137, null],
  )
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
    assert.ok(result.drops.length > 0)
    assert.ok(result.drops.every((drop) => drop.source === 'enemy'))
  }

  const key = rollNativeEnemyLoot(input({
    actorSeed: 236,
    key: { current: 0, level: 20, remaining: 1 },
    sharedRng: createNativeRng(777),
  }))
  assert.equal(key.selectedCategory, 'key')
  assert.equal(key.drops[0]?.kind, 'sack')
  assert.equal(key.drops[0]?.item?.nativeTypeId, 7012)
  assert.equal(key.drops[0]?.item?.nativeSubtype, 1)
  assert.ok(key.nextKeyDropLevel >= 15 && key.nextKeyDropLevel <= 25)
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
  const policies = { ...ALL_DISABLED, gold: 5, orb: 3 }
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

test('gold tiers and chunking preserve the exact total', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 7, 8, 25].map(nativeGoldTier), [
    0, 0, 1, 1, 2, 2, 3, 3,
  ])
  const result = rollNativeEnemyLoot(input({
    explicitGoldAmount: 1_000,
    policies: { ...ALL_DISABLED, gold: 3 },
    sharedRng: createNativeRng(991),
  }))
  assert.equal(result.selectedCategory, 'gold')
  assert.equal(result.drops.reduce((sum, drop) => sum + (drop.amount ?? 0), 0), 1_000)
  assert.ok(result.drops.every((drop) => (drop.amount ?? 0) >= 1 && (drop.amount ?? 0) <= 25))
})

test('explicit Gold replays constructor, dummy, stable-sort, and cumulative-delay draws', () => {
  const itemIds = createNativeLootItemIds(1)
  const result = materializeNativeLootScriptAction(input({
    itemIds,
    sharedRng: createNativeRng(991),
  }), { amount: 137, kind: 'drop-gold' })
  assert.deepEqual(result.drops.map(({ activationDelayTicks, amount, id, scatterSeed }) => ({
    activationDelayTicks,
    amount,
    id,
    scatterSeed,
  })), [
    { activationDelayTicks: 1, amount: 25, id: 1, scatterSeed: 39_722 },
    { activationDelayTicks: 21, amount: 25, id: 2, scatterSeed: 75_798 },
    { activationDelayTicks: 23, amount: 25, id: 3, scatterSeed: 13_927 },
    { activationDelayTicks: 12, amount: 25, id: 4, scatterSeed: 43_829 },
    { activationDelayTicks: 2, amount: 25, id: 5, scatterSeed: 3_513 },
    { activationDelayTicks: 15, amount: 6, id: 6, scatterSeed: 76_009 },
    { activationDelayTicks: 1, amount: 6, id: 7, scatterSeed: 79_554 },
  ])
  assert.equal(itemIds.peek(), 8)
  assert.deepEqual(result.sharedRng.words.slice(0, 8), [
    825_898_900, 262_589_065, 14_746_141, 277_335_206,
    292_081_347, 569_416_553, 861_497_900, 357_172_629,
  ])
  assert.equal(result.sharedRng.indexA, 0)
  assert.equal(result.sharedRng.indexB, 31)
})

test('nonpositive explicit Gold emits no actor but still spends the sorter-probe constructor', () => {
  for (const amount of [0, -7]) {
    const itemIds = createNativeLootItemIds(1)
    const sourceRng = createNativeRng(55)
    const result = materializeNativeLootScriptAction(input({
      itemIds,
      sharedRng: sourceRng,
    }), { amount, kind: 'drop-gold' })
    assert.deepEqual(result.drops, [])
    assert.equal(itemIds.peek(), 1)
    assert.equal(result.sharedRng.indexA, 4)
    assert.equal(result.sharedRng.indexB, 35)
  }
})

test('native drop placement keeps an open origin and searches the exact squashed random ring', () => {
  const origin = { x: 100, y: 200 }
  const source = createNativeRng(71)
  const open = resolveNativeLootPlacement(
    source,
    NATIVE_LOOT_OPEN_PLACEMENT,
    origin,
    15,
    false,
  )
  assert.deepEqual(open.position, origin)
  assert.strictEqual(open.sharedRng, source)

  const probes: Array<Readonly<{ x: number; y: number }>> = []
  const searched = resolveNativeLootPlacement(source, {
    canPlace: (position) => {
      probes.push(position)
      return probes.length === 2
    },
  }, origin, 15, false)
  assert.equal(probes.length, 2)
  assert.deepEqual(probes[0], origin)
  assert.deepEqual(searched.position, {
    x: 114.92652130126953,
    y: 201.18634033203125,
  })
  assert.equal(searched.sharedRng.indexA, 1)
  const dx = searched.position.x - origin.x
  const dy = searched.position.y - origin.y
  assert.ok(Math.abs(dx) <= 15)
  assert.ok(Math.abs(dy) <= 12)
})

test('all six stock script-drop actions bypass the enemy selector through exact materializers', () => {
  const actions = [
    { amount: 37, kind: 'drop-gold' as const },
    { kind: 'drop-random-gold' as const, maximum: 7, minimum: 5 },
    { kind: 'drop-item' as const, recipeIndex: 0 },
    { kind: 'drop-random-item' as const, mode: 1 },
    { kind: 'drop-potion' as const, subtype: 5 },
    { kind: 'drop-key' as const },
  ]
  const results = actions.map((action, index) => materializeNativeLootScriptAction(input({
    itemIds: createNativeLootItemIds(1),
    sharedRng: createNativeRng(300 + index),
  }), action))
  assert.equal(results[0]!.drops.reduce((sum, drop) => sum + (drop.amount ?? 0), 0), 37)
  const randomGold = results[1]!.drops.reduce((sum, drop) => sum + (drop.amount ?? 0), 0)
  assert.ok(randomGold >= 5 && randomGold <= 7)
  assert.equal(results[2]!.drops[0]?.item?.recipeIndex, 0)
  assert.equal(results[3]!.drops[0]?.item?.recipeIndex, null)
  assert.equal(results[4]!.drops[0]?.item?.nativeSubtype, 5)
  assert.equal(results[5]!.drops[0]?.item?.nativeSubtype, 1)
  assert.ok(results.every(({ drops }) => drops.every(({ source }) => source === 'script')))

  assert.deepEqual(nativeLootArenaDropLimits(2, 0), {
    itemLevelMaximum: 9_999,
    itemLevelMinimum: -9_999,
    mode: 2,
  })
  assert.deepEqual(nativeLootArenaDropLimits(1, 1, 12), {
    itemLevelMaximum: 12,
    itemLevelMinimum: 12,
    mode: 1,
  })
  assert.deepEqual(nativeLootArenaDropLimits(0, 2, 4, 19), {
    itemLevelMaximum: 19,
    itemLevelMinimum: 4,
    mode: 0,
  })
  assert.equal(nativeLootDisableMask(0b0010, 1, 0b0101), 0b0111)
  assert.equal(nativeLootDisableMask(0b0111, 0, 0b0101), 0b0010)
})

test('drains all eighteen Goodie rows without reproducing allocator garbage', () => {
  const itemIds = createNativeLootItemIds(10)
  const rows = Array.from({ length: 18 }, (_, selector) => resolveNativeGoodieContents({
    advancedUnlocks: new Array<boolean>(8).fill(false),
    itemIds,
    ownedRecipeIndexes: [],
    playerLevel: 12,
    selector,
    sharedRng: createNativeRng(2_000 + selector),
  }))
  rows.slice(0, 4).forEach((row) => {
    assert.deepEqual(row.items.map(({ nativeSubtype }) => nativeSubtype), [0, 0, 0, 0, 0])
  })
  rows.slice(4, 8).forEach((row) => {
    assert.deepEqual(row.items.map(({ nativeSubtype }) => nativeSubtype), [1, 1, 1, 1, 1, 1])
  })
  rows.slice(8, 10).forEach((row) => assert.ok(row.items.length === 2 || row.items.length === 3))
  assert.equal(rows[10]!.items.length, 1)
  rows.slice(11, 13).forEach((row) => {
    assert.equal(row.items.length, 3)
    assert.ok(row.items.every(({ nativeSubtype }) => nativeSubtype === 2 || nativeSubtype === 3))
  })
  rows.slice(13, 17).forEach((row) => {
    assert.ok(row.gold === 500 || row.gold === 800 || row.gold === 1_100)
  })
  assert.deepEqual(rows[17]!.items.map(({ nativeSubtype }) => nativeSubtype), [5, 0, 1, 4, 2, 2])
})

function input(overrides: Partial<NativeLootSelectionInput>): NativeLootSelectionInput {
  return {
    actorSeed: 12345,
    arena: {
      disableMask: 0,
      itemLevelMaximum: 100,
      itemLevelMinimum: 0,
      lastSuccessfulItemLevel: -1,
      level: 10,
      mode: 0,
      specialSuppression: false,
    },
    explicitGoldAmount: null,
    dropDelayContext: 0,
    itemIds: createNativeLootItemIds(1),
    key: { current: 1, level: 0, remaining: 0 },
    nearbyMaskTwoCount: 0,
    participant: {
      advancedUnlocks: new Array<boolean>(8).fill(false),
      level: 12,
      modifiers: NATIVE_LOOT_DEFAULT_MODIFIERS,
      ownedRecipeIndexes: [],
      slot: 0,
    },
    placement: NATIVE_LOOT_OPEN_PLACEMENT,
    policies: ALL_DISABLED,
    sceneForcesHealthPotion: false,
    sharedRng: createNativeRng(1),
    sourcePosition: { x: 100, y: 200 },
    worldBadguyCount: 0,
    worldHasHealthPotionSack: false,
    inventoryHasHealthPotion: false,
    ...overrides,
  }
}

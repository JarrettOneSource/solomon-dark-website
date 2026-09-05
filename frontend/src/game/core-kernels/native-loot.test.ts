import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from './native-rng.ts'
import { DOWSING_EQUIPMENT_RECIPES } from './hub-economy.ts'
import {
  NATIVE_LOOT_CANDIDATE_ORDER,
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  NATIVE_LOOT_OPEN_PLACEMENT,
  advanceNativeKeyDropLevel,
  initialNativeKeyDropLevel,
  materializeNativeLootScriptAction,
  nativeGoldTier,
  nativeLootCandidateWeights,
  nativeLootArenaDropLimits,
  nativeLootDisableMask,
  nativeLootModifiers,
  nativePowerupLevelBase,
  resolveNativeLootPlacement,
  rollNativeEnemyLoot,
  type NativeLootCategory,
  type NativeLootSelectionInput,
} from './native-loot.ts'
import {
  createNativeLootItemIds,
  resolveNativeGoodieContents,
  potionItem,
  miscItem,
} from './native-loot-items.ts'

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

test('ordinary enemy Item selection reaches every native equipment family', () => {
  const expected = [
    {
      equipmentType: 'hat',
      name: 'Hat of Wielding',
      nativeSelector: 0,
      nativeTypeId: 7005,
      sharedSeed: 3,
    },
    {
      equipmentType: 'robe',
      name: 'Channeling Robe',
      nativeSelector: 1,
      nativeTypeId: 7006,
      sharedSeed: 6,
    },
    {
      equipmentType: 'staff',
      name: 'Staff of Convergence',
      nativeSelector: 0,
      nativeTypeId: 7004,
      sharedSeed: 1,
    },
    {
      equipmentType: 'wand',
      name: 'Searing Wand',
      nativeSelector: 3,
      nativeTypeId: 7011,
      sharedSeed: 9,
    },
    {
      equipmentType: 'ring',
      name: 'Channeling Ring',
      nativeSelector: 1,
      nativeTypeId: 7002,
      sharedSeed: 7,
    },
    {
      equipmentType: 'amulet',
      name: 'Amulet of Searing',
      nativeSelector: 2,
      nativeTypeId: 7003,
      sharedSeed: 17,
    },
  ] as const

  for (const row of expected) {
    const result = rollNativeEnemyLoot(input({
      actorSeed: 110,
      arena: {
        disableMask: 0,
        itemLevelMaximum: 100,
        itemLevelMinimum: 0,
        lastSuccessfulItemLevel: 10,
        level: 10,
        mode: 0,
        specialSuppression: false,
      },
      itemIds: createNativeLootItemIds(1),
      policies: {
        gold: 0,
        item: 0,
        orb: 0,
        potion: 0,
        powerup: 0,
        specificItem: 0,
      },
      sharedRng: createNativeRng(row.sharedSeed),
    }))

    assert.equal(result.selectedCategory, 'item')
    assert.equal(result.drops.length, 1)
    const drop = result.drops[0]!
    assert.equal(drop.kind, 'sack')
    assert.equal(drop.nativeTypeId, 2013)
    assert.equal(drop.source, 'enemy')
    const item = drop.item
    assert.ok(item)
    assert.equal(item.kind, 'equipment')
    assert.equal(item.equipmentType, row.equipmentType)
    assert.equal(item.name, row.name)
    assert.equal(item.nativeSelector, row.nativeSelector)
    assert.equal(item.nativeTypeId, row.nativeTypeId)
    assert.equal(item.recipeIndex, null)
    assert.ok((item.nativeEffects?.length ?? 0) > 0)
    if (row.equipmentType === 'hat' || row.equipmentType === 'robe') {
      assert.equal(item.iconTints?.length, 2)
    }
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
  assert.equal(new Set(result.drops.map(({ position }) => JSON.stringify(position))).size, result.drops.length)
  assert.equal(result.drops.reduce((sum, drop) => sum + (drop.amount ?? 0), 0), 1_000)
  assert.ok(result.drops.every((drop) => (drop.amount ?? 0) >= 1 && (drop.amount ?? 0) <= 25))
})

test('Gold placement precedes chunk selection and releases its batch reservations', () => {
  const materialize = (amount: number) => materializeNativeLootScriptAction(input({
    sharedRng: createNativeRng(991),
  }), { amount, kind: 'drop-gold' })
  const single = materialize(1).drops[0]!
  const batch = materialize(500)
  const first = batch.drops.find(({ id }) => id === 1)!
  assert.equal(first.scatterSeed, single.scatterSeed)
  assert.equal(first.phase, single.phase)
  assert.deepEqual(first.position, single.position)
  assert.equal(batch.drops.reduce((total, drop) => total + drop.amount!, 0), 500)
  assert.equal(new Set(batch.drops.map(({ position }) => JSON.stringify(position))).size,
    batch.drops.length)
  for (const left of batch.drops) {
    for (const right of batch.drops) {
      if (left.id >= right.id) continue
      const dx = left.position.x - right.position.x
      const dy = (left.position.y - right.position.y) / 0.8
      assert.ok(Math.hypot(dx, dy) >= 16, 'each later Gold clears an earlier radius-15 Gold')
    }
  }
  assert.deepEqual(materialize(500), batch)
})

test('Gold batches clear scenery while preserving the requested total and Y registration order', () => {
  const result = materializeNativeLootScriptAction(input({
    placement: { canPlace: (position, radius) => (
      Math.hypot(position.x - 100, position.y - 200) >= 20 + radius
    ) },
    sharedRng: createNativeRng(991),
  }), { kind: 'drop-random-gold', minimum: 500, maximum: 500 })
  assert.equal(result.drops.reduce((sum, drop) => sum + drop.amount!, 0), 500)
  assert.ok(result.drops.every(({ position }) => Math.hypot(position.x - 100, position.y - 200) >= 21))
  assert.equal(new Set(result.drops.map(({ position }) => JSON.stringify(position))).size, result.drops.length)
  const ys = result.drops.map(({ position }) => position.y)
  assert.deepEqual(ys, [...ys].sort((left, right) => left - right))
})

test('pending Gold uses the native strict ellipse boundary and never blocks another batch', () => {
  const rng = createNativeRng(71)
  const earlier = [{ position: { x: 0, y: 0 } }]
  for (const origin of [{ x: 16.5, y: 0 }, { x: 0, y: Math.fround(13.2) }]) {
    const tangent = resolveNativeLootPlacement(rng, NATIVE_LOOT_OPEN_PLACEMENT, origin, 1.5, earlier)
    assert.deepEqual(tangent.position, origin)
    assert.strictEqual(tangent.sharedRng, rng)
  }
  const origin = { x: 16.49, y: 0 }
  const overlapping = resolveNativeLootPlacement(rng, NATIVE_LOOT_OPEN_PLACEMENT, origin, 1.5, earlier)
  assert.notDeepEqual(overlapping.position, { x: Math.fround(origin.x), y: 0 })
  const independent = resolveNativeLootPlacement(rng, NATIVE_LOOT_OPEN_PLACEMENT, { x: 0, y: 0 }, 1.5)
  assert.deepEqual(independent.position, { x: 0, y: 0 })
  assert.strictEqual(independent.sharedRng, rng)
  assert.throws(() => resolveNativeLootPlacement(rng, NATIVE_LOOT_OPEN_PLACEMENT, origin, 0), /radius/)
})

test('loot boundaries reject invalid amounts, modifiers, ranges and source state', () => {
  for (const value of [Number.NaN, -1, 1.5]) {
    assert.throws(() => createNativeLootItemIds(value), RangeError)
    assert.throws(() => nativeLootCandidateWeights(value), RangeError)
    assert.throws(() => nativeGoldTier(value), RangeError)
    assert.throws(() => nativePowerupLevelBase(value), RangeError)
  }
  assert.throws(() => nativeLootCandidateWeights(7), RangeError)
  assert.throws(() => potionItem(createNativeLootItemIds(1), 6), RangeError)
  assert.throws(() => miscItem(createNativeLootItemIds(1), -1), RangeError)
  assert.throws(() => nativeLootArenaDropLimits(Number.NaN, 0), RangeError)
  assert.throws(() => nativeLootModifiers([], { ...NATIVE_LOOT_DEFAULT_MODIFIERS, pickupFactor: -1 }), RangeError)
  const initial = input()
  for (const overrides of [
    { actorSeed: Number.NaN },
    { participant: { ...initial.participant, slot: -1 } },
    { arena: { ...initial.arena, disableMask: -1 } },
    { explicitGoldAmount: 0 },
    { dropDelayContext: 1.5 },
  ]) assert.throws(() => rollNativeEnemyLoot(input(overrides)), RangeError)
  assert.throws(() => materializeNativeLootScriptAction(initial, { kind: 'drop-gold', amount: 1.5 }), RangeError)
  assert.throws(() => materializeNativeLootScriptAction(initial, { kind: 'drop-potion', subtype: 6 }), RangeError)
  assert.throws(() => materializeNativeLootScriptAction(initial, { kind: 'drop-random-item', mode: 5 }), RangeError)
  assert.throws(() => materializeNativeLootScriptAction(initial, {
    kind: 'drop-random-gold', minimum: 10, maximum: 5,
  }), RangeError)
  assert.throws(() => nativeLootArenaDropLimits(0, 2, Number.NaN, 5), RangeError)
  assert.throws(() => nativeLootDisableMask(0, 1, -1), RangeError)
  assert.throws(() => advanceNativeKeyDropLevel(createNativeRng(1), -1), RangeError)
  assert.throws(() => resolveNativeGoodieContents({
    advancedUnlocks: [], itemIds: createNativeLootItemIds(1), ownedRecipeIndexes: [],
    playerLevel: 1, selector: 18, sharedRng: createNativeRng(1),
  }), RangeError)
})

test('native item modes honor recipe rarity, level bounds and the ownership filter', () => {
  const owned = DOWSING_EQUIPMENT_RECIPES.map(({ sourceIndex }) => sourceIndex)
  for (const mode of [0, 1, 2, 3, 4]) {
    for (const arenaMode of [0, 1]) {
      for (const seed of [0, 1, 4, 6, 10, 11, 77, 991]) {
        const source = input({ sharedRng: createNativeRng(seed) })
        const result = materializeNativeLootScriptAction({
          ...source, arena: { ...source.arena, mode: arenaMode },
        }, { kind: 'drop-random-item', mode })
        for (const { item } of result.drops) {
          assert.ok(item)
          assert.equal(item.kind, 'equipment')
          if (mode === 2) assert.equal(item.rarity, 'Rare')
          if (mode === 3) assert.equal(item.rarity, 'Epic')
          if (item.recipeIndex !== null) assert.ok(owned.includes(item.recipeIndex))
        }
      }
    }
  }
  const source = input()
  const exhausted = materializeNativeLootScriptAction({
    ...source,
    arena: { ...source.arena, mode: 1 },
    participant: { ...source.participant, ownedRecipeIndexes: owned },
  }, { kind: 'drop-random-item', mode: 4 })
  assert.deepEqual(exhausted.drops, [])
  const enemy = rollNativeEnemyLoot({
    ...source,
    arena: { ...source.arena, mode: 1 },
    participant: { ...source.participant, ownedRecipeIndexes: owned },
    policies: { ...ALL_DISABLED, item: 3, specificItem: 4 },
  })
  assert.deepEqual(enemy.drops, [])
  assert.equal(enemy.lastSuccessfulItemLevel, source.arena.lastSuccessfulItemLevel)
  const goodie = resolveNativeGoodieContents({
    advancedUnlocks: [], itemIds: createNativeLootItemIds(1), ownedRecipeIndexes: owned,
    playerLevel: 1, selector: 10, sharedRng: createNativeRng(1),
  })
  assert.deepEqual(goodie.items, [])
})

test('reduced and increased Gold and Powerup policies retain their native bounded-RNG decisions', () => {
  // Native first private Integer bounds: Gold 44/11; level-12 Powerup 1386/346.
  // These seeds distinguish the two bounds, including the native modulo bias.
  for (const [category, actorSeed, winningPolicy] of [
    ['gold', 15, 1], ['gold', 2, 2],
    ['powerup', 4_059, 1], ['powerup', 10, 2],
  ] as const) {
    for (const policy of [1, 2] as const) {
      const result = rollNativeEnemyLoot(input({
        actorSeed, policies: { ...ALL_DISABLED, [category]: policy },
      }))
      assert.equal(result.selectedCategory, policy === winningPolicy ? category : null)
    }
  }
  const source = input()
  const zeroBound = rollNativeEnemyLoot({
    ...source,
    participant: {
      ...source.participant,
      modifiers: { ...source.participant.modifiers, goldChance: 0 },
    },
    policies: { ...ALL_DISABLED, gold: 0 },
  })
  assert.equal(zeroBound.selectedCategory, null)
  assert.deepEqual(zeroBound.drops, [])
})

test('Gold Charm exceeds eight from wave four while all amounts eight and above retain tier-three art', () => {
  const charmed = nativeLootModifiers([4])
  const totals = [
    [2, 4],
    [3, 4],
    [4, 6],
  ].map(([level, seed]) => {
    const result = rollNativeEnemyLoot(input({
      arena: {
        disableMask: 0,
        itemLevelMaximum: 100,
        itemLevelMinimum: 0,
        lastSuccessfulItemLevel: -1,
        level: level!,
        mode: 0,
        specialSuppression: false,
      },
      participant: {
        advancedUnlocks: new Array<boolean>(8).fill(false),
        level: 12,
        modifiers: charmed,
        ownedRecipeIndexes: [],
        slot: 0,
      },
      policies: { ...ALL_DISABLED, gold: 3 },
      sharedRng: createNativeRng(seed!),
    }))
    assert.equal(result.selectedCategory, 'gold')
    assert.ok(result.drops.every(({ tier }) => tier === 3))
    return result.drops.reduce((sum, drop) => sum + (drop.amount ?? 0), 0)
  })
  assert.deepEqual(totals, [8, 8, 10])
})

test('explicit Gold replays constructor, dummy, stable-sort, and cumulative-delay draws', () => {
  const itemIds = createNativeLootItemIds(1)
  const result = materializeNativeLootScriptAction(input({
    itemIds,
    sharedRng: createNativeRng(991),
  }), { amount: 137, kind: 'drop-gold' })
  // Independent C++ replay of the reviewed 0x0046AA90/0x00645910/0x00410470
  // instructions, including each FSTP float boundary; not web-generated output.
  assert.deepEqual(result.drops.map((drop) => [
    drop.id, drop.amount, drop.activationDelayTicks, drop.scatterSeed,
    drop.position.x, drop.position.y,
  ]), [
    [8, 14, 3, 78_011, 104.86273956298828, 167.13191223144531],
    [2, 25, 7, 75_798, 115.66017150878906, 193.37274169921875],
    [3, 7, 7, 10_858, 81.600746154785156, 195.66941833496094],
    [1, 9, 0, 59_614, 100, 200],
    [6, 25, 8, 64_513, 127.54767608642578, 205.25868225097656],
    [4, 7, 8, 55_881, 83.88159942626953, 210.75096130371094],
    [5, 25, 17, 33_258, 111.849853515625, 213.07441711425781],
    [7, 25, 1, 44_621, 97.48357391357422, 220.74942016601562],
  ])
  assert.equal(itemIds.peek(), 9)
  assert.deepEqual(result.sharedRng.words.slice(0, 8), [
    57_896_898, 464_281_499, 522_178_397, 986_459_896,
    434_896_469, 347_614_541, 782_511_010, 56_383_727,
  ])
  assert.equal(result.sharedRng.indexA, 29)
  assert.equal(result.sharedRng.indexB, 5)
})

test('nonpositive non-sentinel Gold emits no actor but still spends the sorter-probe constructor', () => {
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

test('scripted minus-one Gold uses the native random-amount sentinel', () => {
  const ordinary = rollNativeEnemyLoot(input({
    policies: { ...ALL_DISABLED, gold: 3 },
    sharedRng: createNativeRng(991),
  }))
  const scripted = materializeNativeLootScriptAction(input({
    sharedRng: createNativeRng(991),
  }), { kind: 'drop-gold', amount: -1 })
  assert.ok(ordinary.drops.length > 0)
  assert.deepEqual(scripted.drops, ordinary.drops.map((drop) => ({ ...drop, source: 'script' })))
  assert.deepEqual(scripted.sharedRng, ordinary.sharedRng)
  const randomScripted = materializeNativeLootScriptAction(input({
    sharedRng: createNativeRng(991),
  }), { kind: 'drop-random-gold', minimum: -1, maximum: -1 })
  assert.deepEqual(randomScripted, scripted)
})

test('native drop placement keeps an open origin and searches the exact squashed random ring', () => {
  const origin = { x: 100, y: 200 }
  const source = createNativeRng(71)
  const open = resolveNativeLootPlacement(
    source,
    NATIVE_LOOT_OPEN_PLACEMENT,
    origin,
    15,
  )
  assert.deepEqual(open.position, origin)
  assert.strictEqual(open.sharedRng, source)

  const probes: Array<Readonly<{ x: number; y: number }>> = []
  const searched = resolveNativeLootPlacement(source, {
    canPlace: (position) => {
      probes.push(position)
      return probes.length === 2
    },
  }, origin, 15)
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
    assert.deepEqual(row.items.map(({ nativeSubtype, quantity }) => [nativeSubtype, quantity]), [[0, 5]])
  })
  rows.slice(4, 8).forEach((row) => {
    assert.deepEqual(row.items.map(({ nativeSubtype, quantity }) => [nativeSubtype, quantity]), [[1, 6]])
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
  assert.deepEqual(rows[17]!.items.map(({ nativeSubtype, quantity }) => (
    [nativeSubtype, quantity]
  )), [[5, 1], [0, 1], [1, 1], [4, 1], [2, 2]])
})

test('Goodie forced insertion stacks Potion nodes while retaining native UID consumption', () => {
  const healthIds = createNativeLootItemIds(100)
  const health = resolveNativeGoodieContents({
    advancedUnlocks: new Array<boolean>(8).fill(false),
    itemIds: healthIds,
    ownedRecipeIndexes: [],
    playerLevel: 12,
    selector: 0,
    sharedRng: createNativeRng(2_000),
  })
  assert.deepEqual(health.items.map(({ id, nativeSubtype, quantity }) => (
    [id, nativeSubtype, quantity]
  )), [[100, 0, 5]])
  assert.equal(healthIds.peek(), 105)

  const mixedIds = createNativeLootItemIds(300)
  const mixed = resolveNativeGoodieContents({
    advancedUnlocks: new Array<boolean>(8).fill(false),
    itemIds: mixedIds,
    ownedRecipeIndexes: [],
    playerLevel: 12,
    selector: 17,
    sharedRng: createNativeRng(2_017),
  })
  assert.deepEqual(mixed.items.map(({ id, nativeSubtype, quantity }) => (
    [id, nativeSubtype, quantity]
  )), [
    [303, 5, 1],
    [304, 0, 1],
    [305, 1, 1],
    [306, 4, 1],
    [307, 2, 2],
  ])
  assert.equal(mixedIds.peek(), 309)
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

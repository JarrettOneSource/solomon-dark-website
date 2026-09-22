import { direBossItemRecipePool } from './dire-boss-loot.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from './native-survival-boss-catalog.ts'
import type { NativeFacultyName } from './native-survival-faculty.ts'
import assert from 'node:assert/strict'
import test from 'node:test'

import { ALL_DISABLED, input } from '../../../tools/native-loot-test-fixture.ts'

import { createNativeRng, drawNativeInteger } from './native-rng.ts'
import {
  DOWSING_EQUIPMENT_RECIPES, FOMENTIUS_STOCK_DEFINITIONS,
  createFomentiusInventoryItem, createHubEconomy, dyeInventoryClothing,
  equipInventoryItem, findInventoryItem, insertLootInventoryItem, transferInventoryItem,
  type HubEconomyState, type HubInventoryItem,
} from './hub-economy.ts'
import { inventoryItem } from '../protocol/codecs/items.ts'
import { gameSnapshot } from '../protocol/codecs/snapshot.ts'
import { createGameSnapshotFrame, createGameSnapshotProjection } from '../protocol/entity-replication.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import { createGameSimulation, getPlayerEconomy } from '../core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../core-server/player-entity-store.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../save/game-save-document.ts'
import { playerLivingNativeEquipmentAppearance } from './player-equipment-appearance.ts'
import {
  NATIVE_LOOT_DEFAULT_MODIFIERS,
  NATIVE_LOOT_OPEN_PLACEMENT,
  advanceNativeKeyDropLevel,
  materializeNativeLootScriptAction,
  nativeGoldTier,
  nativeLootArenaDropLimits,
  nativeLootDisableMask,
  nativeLootModifiers,
  resolveNativeLootPlacement,
  rollNativeEnemyLoot,
} from './native-loot.ts'
import {
  createNativeLootItemIds,
  equipmentRecipeItem,
  selectEnemyItem,
  resolveNativeGoodieContents,
  potionItem,
  miscItem,
} from './native-loot-items.ts'

test('an approved Dire item pool yields a missing associated piece instead of unrelated equipment', () => {
  const source = input()
  const result = rollNativeEnemyLoot({
    ...source,
    itemRecipePool: [11, 12, 13, 14, 15],
    participant: { ...source.participant, ownedRecipeIndexes: [11, 12, 13, 15] },
    policies: { ...source.policies, item: 3, specificItem: 4 },
  })
  assert.equal(result.selectedCategory, 'item')
  assert.equal(result.drops.length, 1)
  assert.equal(result.drops[0]?.item?.recipeIndex, 14)
  assert.equal(result.drops[0]?.source, 'enemy')
})

const DIRE_POOLS: readonly (readonly [NativeFacultyName, readonly number[]])[] = [
  ['Dire Sirmin', [11, 12, 13, 14, 15]],
  ['Dire Lucritius', [20, 21, 3]],
  ['Dire Aliss', [16, 17, 18, 19]],
]

for (const source of NATIVE_SURVIVAL_BOSS_SOURCES) {
  for (const [name, expected] of DIRE_POOLS) {
    test(`${source.sourceSha256.slice(0, 8)} ${name} selects every associated item and then permits repeats`, () => {
      const itemRecipePool = direBossItemRecipePool(source.sourceSha256, 'DIREFACULTY', source.recipeUids[name])
      assert.deepEqual(itemRecipePool, expected)
      const base = input()
      for (const missing of expected) {
        const result = lootOutcome({
          ...base, itemIds: createNativeLootItemIds(1), itemRecipePool,
          participant: { ...base.participant, ownedRecipeIndexes: expected.filter(index => index !== missing) },
          policies: { ...base.policies, item: 3, specificItem: 4 },
        })
        const item = result.drops[0]?.item
        assert.equal(item?.recipeIndex, missing)
        assert.equal(item?.name, DOWSING_EQUIPMENT_RECIPES[missing]!.name)
        assert.equal(result.drops.length, 1)
        assert.equal(result.lastSuccessfulItemLevel, base.arena.level)
      }
      const repeatInput = () => ({
        ...input(), itemRecipePool,
        participant: { ...base.participant, ownedRecipeIndexes: expected },
        policies: { ...base.policies, item: 3 as const, specificItem: 4 },
      })
      const repeat = lootOutcome(repeatInput())
      assert.ok(expected.includes(repeat.drops[0]?.item?.recipeIndex ?? -1))
      assert.deepEqual(repeat, lootOutcome(repeatInput()))
    })
  }
}

test('Dire association requires the generated source, Faculty family and matching recipe UID', () => {
  for (const source of NATIVE_SURVIVAL_BOSS_SOURCES) {
    for (const name of ['Ironmaw', 'Foulshaft', 'Heartmonger', 'The Discorporeal'] as const) {
      assert.equal(direBossItemRecipePool(source.sourceSha256, 'DIREFACULTY', source.recipeUids[name]), undefined)
    }
    assert.equal(direBossItemRecipePool(source.sourceSha256, 'SKELETON', source.recipeUids['Dire Sirmin']), undefined)
    assert.equal(direBossItemRecipePool(source.sourceSha256, 'DIREFACULTY', undefined), undefined)
    assert.equal(direBossItemRecipePool('custom', 'DIREFACULTY', source.recipeUids['Dire Sirmin']), undefined)
    assert.equal(direBossItemRecipePool(undefined, 'DIREFACULTY', source.recipeUids['Dire Sirmin']), undefined)
  }
})

test('Dire pools preserve non-Item results, disable gates, source-slot suppression and scripted items', () => {
  const itemRecipePool = [11, 12, 13, 14, 15]
  for (const category of ['gold', 'orb', 'potion', 'powerup'] as const) {
    for (let seed = 1; seed <= 32; seed += 1) {
      const makeInput = () => input({
        actorSeed: seed, sharedRng: createNativeRng(seed),
        policies: { ...ALL_DISABLED, [category]: 3 },
      })
      assert.deepEqual(lootOutcome({ ...makeInput(), itemRecipePool }), lootOutcome(makeInput()))
    }
  }
  for (const extra of [
    { arena: { ...input().arena, disableMask: 32 } },
    { participant: { ...input().participant, slot: 1 } },
    { policies: ALL_DISABLED },
  ]) {
    const makeInput = () => input({ policies: { ...ALL_DISABLED, item: 3 }, ...extra })
    assert.deepEqual(lootOutcome({ ...makeInput(), itemRecipePool }), lootOutcome(makeInput()))
  }
  const keyInput = () => input({ actorSeed: 311, sharedRng: createNativeRng(100),
    key: { current: 5, level: 10, remaining: 1 } })
  const key = lootOutcome({ ...keyInput(), itemRecipePool })
  assert.equal(key.selectedCategory, 'key')
  assert.deepEqual(key, lootOutcome(keyInput()))
  for (const action of [
    { kind: 'drop-item', recipeIndex: 0 },
    { kind: 'drop-random-item', mode: 4 },
  ] as const) {
    assert.deepEqual(materializeNativeLootScriptAction(input({ itemRecipePool }), action),
      materializeNativeLootScriptAction(input(), action))
  }
})

test('Dire pools do not change category competition and retain supplemental Gold', () => {
  const categories = new Set()
  for (let seed = 1; seed <= 128; seed += 1) {
    const makeInput = () => input({ actorSeed: seed, sharedRng: createNativeRng(seed),
      policies: { ...ALL_DISABLED, gold: 3, item: 3, specificItem: 4 } })
    const ordinary = lootOutcome(makeInput())
    const associated = lootOutcome({ ...makeInput(), itemRecipePool: [11, 12, 13, 14, 15] })
    assert.equal(associated.selectedCategory, ordinary.selectedCategory)
    categories.add(associated.selectedCategory)
    if (ordinary.selectedCategory !== 'item') assert.deepEqual(associated, ordinary)
    else {
      assert.equal(associated.drops.filter(drop => drop.kind === 'sack').length, 1)
    }
  }
  assert.ok(categories.has('item') && categories.has('gold'))
  const supplemented = rollNativeEnemyLoot(input({
    itemRecipePool: [11, 12, 13, 14, 15],
    policies: { ...ALL_DISABLED, gold: 5, item: 3, specificItem: 4 },
  }))
  assert.equal(supplemented.selectedCategory, 'item')
  assert.ok(supplemented.drops.some(drop => drop.kind === 'gold'))
  assert.equal(supplemented.drops.filter(drop => drop.kind === 'sack').length, 1)
})

function lootOutcome(source: Parameters<typeof rollNativeEnemyLoot>[0]) {
  const { itemIds, ...result } = rollNativeEnemyLoot(source)
  return { ...result, nextItemId: itemIds.peek() }
}

for (const recipe of DOWSING_EQUIPMENT_RECIPES) {
  test(`named loot ${recipe.name} survives pickup and strict inventory decoding`, () => {
    const result = materializeNativeLootScriptAction(input(), {
      kind: 'drop-item', recipeIndex: recipe.sourceIndex,
    })
    const drop = result.drops[0]
    assert.ok(drop?.item)
    const picked = insertLootInventoryItem(createHubEconomy(1), drop.item)
    assert.equal(picked.accepted, true)
    const item = picked.state.backpack.find(({ recipeIndex }) => recipeIndex === recipe.sourceIndex)
    assert.ok(item)
    assert.deepEqual(inventoryItem(item, 'frame.players.player-1.economy.backpack'), item)
  })
}

test('named clothing applies native recipe colors and consumes only its own random-color words', () => {
  const expected = [
    [1, 0x191919, 0xc6e0e0], [5, 0x191919, 0xc1a8c1],
    [6, 0xc0c0c0, 0xffffff], [7, 0xc0c0c0, 0xffffff],
    [11, 0x8f618f, 0xffffff], [12, 0x8f618f, 0xffffff],
    [16, 0x98c6c6, 0xffffff], [17, 0x98c6c6, 0xffffff],
    [20, 0x723f3f, 0xffffff], [21, 0x723f3f, 0xffffff],
    [25, 0x89b789, 0xe3eee3],
  ] as const
  const rng = createNativeRng(1)
  for (const [index, primary, secondary] of expected) {
    const generated = equipmentRecipeItem(DOWSING_EQUIPMENT_RECIPES[index]!, createNativeLootItemIds(1), rng)
    assert.deepEqual(generated.item.iconTints, [primary, secondary], `recipe ${index}`)
    assert.strictEqual(generated.sharedRng, rng, `recipe ${index} must not draw random colors`)
    for (const iconTints of [[null, secondary], [primary, null]] as const) {
      assert.throws(() => inventoryItem({ ...generated.item, iconTints }, 'item'), /named equipment identity/)
    }
  }
  // Raw 0x004630E0/0x004699B0 instruction goldens. Seed 1 retains out-of-range jitter until desaturation.
  for (const [seed, primary, words] of [[1, 0xa1ccd0, 8], [3, 0x4c4c73, 2], [42, 0xb08ca9, 8]] as const) {
    for (const index of [40, 46]) {
      const source = createNativeRng(seed)
      const generated = equipmentRecipeItem(DOWSING_EQUIPMENT_RECIPES[index]!, createNativeLootItemIds(1), source)
      assert.deepEqual(generated.item.iconTints, [primary, 0xffffff], `recipe ${index}, seed ${seed}`)
      let expectedRng = source
      for (let word = 0; word < words; word += 1) expectedRng = drawNativeInteger(expectedRng, 1).state
      assert.deepEqual(generated.sharedRng, expectedRng, 'named clone has no random-item brightness draw')
      assert.equal(generated.item.recipeIndex, index)
      assert.equal(generated.item.generatedLevel, undefined)
      assert.equal(generated.item.nativeEffects, undefined)
    }
  }
})

test('named random colors advance enemy, Goodie, and fixed-script RNG before placement', () => {
  const sourceRng = createNativeRng(1)
  let expectedRng = sourceRng
  for (let word = 0; word < 9; word += 1) expectedRng = drawNativeInteger(expectedRng, 1).state
  for (const recipeIndex of [40, 46]) {
    const ownedRecipeIndexes = DOWSING_EQUIPMENT_RECIPES
      .map(({ sourceIndex }) => sourceIndex).filter((index) => index !== recipeIndex)
    const selection = input({
      policies: { ...ALL_DISABLED, specificItem: 4 },
      participant: { ...input().participant, ownedRecipeIndexes },
    })
    const enemy = selectEnemyItem(sourceRng, selection)
    assert.equal(enemy.item?.recipeIndex, recipeIndex)
    assert.deepEqual(enemy.item?.iconTints, [0xa47ea0, 0xffffff])
    assert.deepEqual(enemy.sharedRng, expectedRng)
    const goodie = resolveNativeGoodieContents({
      advancedUnlocks: [], itemIds: createNativeLootItemIds(1), ownedRecipeIndexes,
      playerLevel: 100, selector: 10, sharedRng: sourceRng,
    })
    assert.equal(goodie.items[0]?.recipeIndex, recipeIndex)
    assert.deepEqual(goodie.items[0]?.iconTints, [0xa47ea0, 0xffffff])
    assert.deepEqual(goodie.sharedRng, expectedRng)
    const script = materializeNativeLootScriptAction(input({
      sharedRng: sourceRng,
      placement: { canPlace: ({ x, y }) => x !== 100 || y !== 200 },
    }), { kind: 'drop-item', recipeIndex })
    assert.deepEqual(script.drops[0]?.item?.iconTints, [0xa1ccd0, 0xffffff])
    assert.deepEqual(script.drops[0]?.position, { x: 114.96372985839844, y: 200.833984375 })
    assert.deepEqual(script.sharedRng, expectedRng)
  }
})

test('all named garments retain realized colors through frames, containers, equip, dye, and save restore', () => {
  const initial = createGameSimulation({ owner: {
    discipline: 'arcane', displayName: 'Helvidius', element: 'ether',
  } })
  const baseline = createGameSnapshotProjection(createGameSnapshot(initial, 'owner')).baseline
  const retain = (economy: HubEconomyState, label: string) => {
    const state = { ...initial, playerEntities: replacePlayerEconomy(initial.playerEntities, 'owner', economy) }
    const snapshot = createGameSnapshot(state, 'owner')
    assert.deepEqual(gameSnapshot(snapshot), snapshot, `${label}: full snapshot`)
    for (const forceKeyframe of [false, true]) {
      const message = {
        acknowledgedInputSequence: 0,
        frame: createGameSnapshotFrame(snapshot, 1, baseline, forceKeyframe),
        sequence: 2,
        type: 'server-snapshot' as const,
      }
      assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message, `${label}: frame`)
    }
    const saved = createGameSaveDocument({
      integrity: 'local-only', loadedBoneyard: null, mods: [], modState: {}, playerId: 'owner', state,
    })
    const checkpoint = decodeServerGameMessage(encodeGameMessage({
      type: 'server-save-checkpoint', reason: 'progress', save: saved, sequence: 1,
    }))
    if (checkpoint.type !== 'server-save-checkpoint') throw new Error('expected checkpoint')
    const restored = getPlayerEconomy(restoreGameSaveDocument(checkpoint.save).state, 'owner')
    assert.deepEqual(restored.backpack, economy.backpack, `${label}: backpack`)
    assert.deepEqual(restored.storage, economy.storage, `${label}: storage`)
    assert.deepEqual(restored.equipment, economy.equipment, `${label}: equipment`)
  }
  for (const recipe of DOWSING_EQUIPMENT_RECIPES) {
    if (recipe.type !== 'hat' && recipe.type !== 'robe') continue
    const generated = equipmentRecipeItem(recipe, createNativeLootItemIds(1), createNativeRng(1))
    const picked = insertLootInventoryItem(getPlayerEconomy(initial, 'owner'), generated.item)
    assert.equal(picked.accepted, true)
    const item = picked.state.backpack.find(({ recipeIndex }) => recipeIndex === recipe.sourceIndex)!
    retain(picked.state, `${recipe.name}: pickup`)

    const stored = transferInventoryItem(picked.state, item.id, 'to-storage')
    assert.equal(stored.accepted, true)
    retain(stored.state, `${recipe.name}: stored`)
    const sack: HubInventoryItem = {
      contents: [item], equipmentType: null, iconRecords: [70], id: picked.state.nextItemId,
      kind: 'sack', name: 'Sack', nativeSubtype: 0, nativeTypeId: 7008,
      quantity: 1, rarity: null, recipeIndex: null,
    }
    const nested = insertLootInventoryItem({ ...picked.state, backpack: [] }, sack)
    assert.equal(nested.accepted, true)
    retain(nested.state, `${recipe.name}: nested`)

    const equipped = equipInventoryItem(picked.state, item.id, recipe.type, { creativityRank: 0, playerLevel: 100 })
    assert.equal(equipped.accepted, true)
    const appearance = playerLivingNativeEquipmentAppearance('ether', equipped.state.equipment)[recipe.type]
    assert.ok(appearance)
    assert.deepEqual([appearance.primaryTint, appearance.secondaryTint], item.iconTints)
    retain(equipped.state, `${recipe.name}: equipped`)

    const dye = createFomentiusInventoryItem(
      FOMENTIUS_STOCK_DEFINITIONS.find(({ kind }) => kind === 'dye')!, picked.state.nextItemId, 2,
    )
    const withDye = insertLootInventoryItem(picked.state, dye)
    assert.equal(withDye.accepted, true)
    const cloth = dyeInventoryClothing(withDye.state, dye.id, item.id, 'cloth', [1, 9])
    assert.equal(cloth.accepted, true)
    assert.deepEqual(findInventoryItem(cloth.state.backpack, item.id)?.iconTints, [0x6d363e, item.iconTints![1]])
    retain(cloth.state, `${recipe.name}: dyed cloth`)
    const trim = dyeInventoryClothing(cloth.state, dye.id, item.id, 'trim', [1])
    assert.equal(trim.accepted, true)
    assert.deepEqual(findInventoryItem(trim.state.backpack, item.id)?.iconTints, [0x6d363e, 0x7b3b3b])
    retain(trim.state, `${recipe.name}: dyed trim`)
  }
})

test('Scatter Curse applies the native Orb value multiplier after private materialization', () => {
  const source = input({ policies: { ...ALL_DISABLED, orb: 3 } })
  const ordinary = rollNativeEnemyLoot(source).drops[0]
  const scatter = rollNativeEnemyLoot({
    ...source, participant: { ...source.participant, modifiers: nativeLootModifiers([9]) },
  }).drops[0]
  // Independent float32 instruction replay with private seed 12345.
  assert.equal(ordinary?.value, 0.312171995639801)
  assert.equal(scatter?.value, 0.3902149796485901)
  assert.equal(scatter?.orbKind, ordinary?.orbKind)
  assert.equal(scatter?.phase, ordinary?.phase)
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
    assert.throws(() => nativeGoldTier(value), RangeError)
    const source = input({})
    assert.throws(() => rollNativeEnemyLoot({
      ...source, participant: { ...source.participant, level: value },
    }), { name: 'RangeError', message: 'native loot participant level must be non-negative' })
  }
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

test('minimum random Gold retains the native one-versus-two correction draw', () => {
  for (const [seed, expected] of [[8, 2], [4, 2], [17, 1]] as const) {
    const source = input({ sharedRng: createNativeRng(seed) })
    const result = materializeNativeLootScriptAction({
      ...source, arena: { ...source.arena, level: 0 },
    }, { kind: 'drop-gold', amount: -1 })
    assert.equal(result.drops.reduce((total, drop) => total + drop.amount!, 0), expected)
  }
})

test('scripted Potion forcing and missing Item recipes preserve their native results', () => {
  const source = input({ sceneForcesHealthPotion: true })
  const potion = materializeNativeLootScriptAction(source, { kind: 'drop-potion', subtype: 1 })
  assert.equal(potion.drops[0]?.item?.nativeSubtype, 0)
  const missing = materializeNativeLootScriptAction(source, { kind: 'drop-item', recipeIndex: -1 })
  assert.deepEqual(missing.drops, [])
  assert.strictEqual(missing.sharedRng, source.sharedRng)
  assert.equal(missing.lastSuccessfulItemLevel, source.arena.lastSuccessfulItemLevel)
})

test('script action boundaries reject malformed operands before materialization', () => {
  const source = input({ sceneForcesHealthPotion: true })
  assert.throws(() => materializeNativeLootScriptAction(source, { kind: 'drop-gold', amount: 1.5 }),
    { name: 'RangeError', message: 'native fixed-Gold amount must be integral' })
  for (const subtype of [-1, 1.5, 6]) {
    assert.throws(() => materializeNativeLootScriptAction(source, { kind: 'drop-potion', subtype }),
      { name: 'RangeError', message: 'native script Potion subtype must be within [0,5]' })
  }
  for (const subtype of [0, 5]) {
    const potion = materializeNativeLootScriptAction({ ...source, sceneForcesHealthPotion: false },
      { kind: 'drop-potion', subtype })
    assert.equal(potion.drops[0]?.item?.nativeSubtype, subtype)
  }
  for (const mode of [-1, 1.5, 5]) {
    assert.throws(() => materializeNativeLootScriptAction(source, { kind: 'drop-random-item', mode }),
      { name: 'RangeError', message: 'native random-Item mode must be within [0,4]' })
  }
  for (const [minimum, maximum] of [[1.5, 1.5], [1.5, 2.5], [1, 2.5], [2, 1]] as const) {
    assert.throws(() => materializeNativeLootScriptAction(source,
      { kind: 'drop-random-gold', minimum, maximum }),
    { name: 'RangeError', message: 'native random-Gold bounds are invalid' })
  }
})

test('random scripted Gold includes both endpoints and does not collapse a two-value interval', () => {
  for (const [seed, expected] of [[0, 4], [1, 3]] as const) {
    const result = materializeNativeLootScriptAction(input({ sharedRng: createNativeRng(seed) }),
      { kind: 'drop-random-gold', minimum: 3, maximum: 4 })
    assert.equal(result.drops.reduce((total, drop) => total + drop.amount!, 0), expected)
  }
})

test('an exhausted random Item recipe pool does not spend placement entropy', () => {
  const source = input({})
  const request = {
    ...source,
    participant: {
      ...source.participant,
      ownedRecipeIndexes: DOWSING_EQUIPMENT_RECIPES.map(({ sourceIndex }) => sourceIndex),
    },
  }
  const open = materializeNativeLootScriptAction(request, { kind: 'drop-random-item', mode: 4 })
  const blocked = materializeNativeLootScriptAction({
    ...request,
    placement: { canPlace: (position) => position.x !== 100 || position.y !== 200 },
  }, { kind: 'drop-random-item', mode: 4 })
  assert.deepEqual(open.drops, [])
  assert.deepEqual(blocked.drops, [])
  assert.deepEqual(blocked.sharedRng, open.sharedRng)
  assert.equal(blocked.lastSuccessfulItemLevel, request.arena.level)
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

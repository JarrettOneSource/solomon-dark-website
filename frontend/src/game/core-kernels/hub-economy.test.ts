import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeRng } from './native-rng.ts'

import {
  DOWSING_EQUIPMENT_RECIPES,
  FOMENTIUS_STOCK_DEFINITIONS,
  HAGATHA_PERKS,
  HUB_INVENTORY_SLOT_CAPACITY,
  HUB_SACK_CHILD_REPLICATION_LIMIT,
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  HUB_STORAGE_SLOT_CAPACITY,
  MAX_NATIVE_DYE_SELECTIONS,
  MOD_ITEM_NATIVE_TYPE_ID,
  NATIVE_DYE_SWATCH_COLORS,
  NATIVE_DYE_SWATCHES,
  NATIVE_RETAINED_SACK_SUFFIXES,
  NATIVE_UNFORGE_ELIGIBLE_TYPE_IDS,
  NATIVE_FRESH_PROFILE_GOLD,
  archiveHagathaLastWordItems,
  archiveCompletedRunEconomy,
  buyDowsingOffer,
  buyFomentiusItem,
  buyHagathaPerk,
  closeDowsingOffers,
  consumeInventoryItem,
  consumeWizardKey,
  creditLootGold,
  createEquipmentInventoryItem,
  createHubEconomy,
  discardInventoryItem,
  dyeInventoryClothing,
  dowse,
  economyHasWizardKey,
  equipInventoryItem,
  findInventoryItem,
  hagathaOffers,
  hasBurningManOutfit,
  hasFeteOfClayOutfit,
  hasFrostburnJewels,
  hasPandimensionalBugMasterOutfit,
  hasTempestOutfit,
  hubEconomyInventoryIsValid,
  insertLootInventoryItem,
  moveInventoryItem,
  nativeDyeCommittedTint,
  nativeDyeMixedColor,
  nativeDyeMixedTint,
  inventoryDyeableClothingItems,
  nativeInventoryItemCanUnforge,
  nativeUnforgeOutcomeText,
  restockFomentius,
  projectInventoryItems,
  reconcileHubEconomyModPackages,
  reforgeModEquipment,
  transferInventoryItem,
  unforgeInventoryItem,
  unequipInventorySlot,
  type EquipmentSlot,
  type HubEconomyState,
  type HubInventoryItem,
} from './hub-economy.ts'

function maximumSackChildren(item: HubInventoryItem): number {
  return Math.max(
    item.contents?.length ?? 0,
    ...(item.contents ?? []).map(maximumSackChildren),
  )
}

test('a fresh participant owns the retail 500-gold profile and complete native starter loadout', () => {
  const state = createHubEconomy(1)

  assert.equal(NATIVE_FRESH_PROFILE_GOLD, 500)
  assert.equal(HUB_INVENTORY_SLOT_CAPACITY, 88)
  assert.equal(HUB_STORAGE_SLOT_CAPACITY, 28)
  assert.equal(state.gold, 500)
  assert.deepEqual(
    state.backpack.map(({ kind, quantity }) => [kind, quantity]),
    [['health-potion', 1], ['mana-potion', 1]],
  )
  assert.deepEqual(state.storage, [])
  assert.equal(state.collegeIntroPending, true)
  assert.equal(state.tutorialPending, true)
  assert.deepEqual(
    [state.equipment.hat, state.equipment.robe, state.equipment.weapon].map((item) => ({
      iconRecords: item?.iconRecords,
      name: item?.name,
      nativeTypeId: item?.nativeTypeId,
      rarity: item?.rarity,
      recipeIndex: item?.recipeIndex,
    })),
    [
      { iconRecords: [34, 38], name: 'Hat', nativeTypeId: 7005, rarity: null, recipeIndex: null },
      { iconRecords: [64, 67], name: 'Robe', nativeTypeId: 7006, rarity: null, recipeIndex: null },
      { iconRecords: [72], name: 'Staff', nativeTypeId: 7004, rarity: null, recipeIndex: null },
    ],
  )
  assert.equal(state.equipment.amulet, null)
  assert.deepEqual(state.equipment.rings, [null, null, null])
  assert.ok(state.fomentiusStock.every(({ id }) => id >= 6))
})

test('mod reforge attaches stable affixes to one backpack equipment item', () => {
  const base = createHubEconomy(1)
  const item = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[0]!, base.nextItemId)
  const economy = {
    ...base,
    backpack: [...base.backpack, item],
    nextItemId: base.nextItemId + 1,
  }
  const affix = {
    contentId: '5000000000000000005',
    modId: 'example.affixes',
    modifiers: [{ key: 'incoming_damage', operation: 'multiply' as const, value: 0.8 }],
    name: 'Gravebound',
  }
  const result = reforgeModEquipment(economy, item.id, [affix])
  assert.equal(result.accepted, true)
  assert.deepEqual(findInventoryItem(result.state.backpack, item.id)?.modAffixes, [affix])
  assert.equal(hubEconomyInventoryIsValid(result.state), true)
  const reconciled = reconcileHubEconomyModPackages(result.state, [])
  assert.equal(findInventoryItem(reconciled.backpack, item.id)?.modAffixes, undefined)
  assert.equal(hubEconomyInventoryIsValid(reconciled), true)
})

test('mod wearable items use existing slots, native dye transactions, and strict save identity', () => {
  const source = createHubEconomy(1)
  const robe: HubInventoryItem = {
    equipmentType: 'robe',
    iconRecords: [],
    iconTints: [0x6688cc, 0xffdd88],
    id: 0,
    kind: 'equipment',
    modItemContent: {
      contentId: '5000000000000000090',
      description: 'A robe from beyond the stars.',
      icon: {
        atlasId: 'example.wearables:icon',
        frame: {
          centerOffsetX: 0,
          centerOffsetY: 0,
          contentHeight: 50,
          contentWidth: 53,
          height: 50,
          logicalHeight: 50,
          logicalWidth: 53,
          width: 53,
          x: 0,
          y: 0,
        },
        frameIndex: 0,
        imagePath: 'art/icon.png',
      },
      iconTrimImagePath: 'art/icon-trim.png',
      key: 'starfall_robe',
      modId: 'example.wearables',
      stackMaximum: 1,
      wearable: {
        deathShape: 2,
        dyeable: true,
        slot: 'robe',
        wornImagePath: 'art/worn.png',
        wornTrimImagePath: 'art/worn-trim.png',
      },
    },
    name: 'Starfall Robe',
    nativeSubtype: null,
    nativeTypeId: MOD_ITEM_NATIVE_TYPE_ID,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const inserted = insertLootInventoryItem(source, robe)
  assert.equal(inserted.accepted, true)
  const identified = inserted.state.backpack.find(item => item.name === robe.name)!
  assert.deepEqual(inventoryDyeableClothingItems(inserted.state.backpack).map(({ item }) => item.id), [identified.id])

  const dye: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [51],
    id: inserted.state.nextItemId,
    kind: 'dye',
    name: 'Fabric Dye Kit',
    nativeSubtype: 0,
    nativeTypeId: 7012,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const withDye = {
    ...inserted.state,
    backpack: [...inserted.state.backpack, dye],
    nextItemId: inserted.state.nextItemId + 1,
  }
  const dyed = dyeInventoryClothing(withDye, dye.id, identified.id, 'cloth', [1])
  assert.equal(dyed.accepted, true)
  assert.notEqual(findInventoryItem(dyed.state.backpack, identified.id)?.iconTints?.[0], 0x6688cc)
  const equipped = equipInventoryItem(dyed.state, identified.id, 'robe')
  assert.equal(equipped.accepted, true)
  assert.equal(equipped.state.equipment.robe?.modItemContent?.wearable?.slot, 'robe')
  assert.equal(hubEconomyInventoryIsValid(equipped.state), true)
  assert.equal(
    reconcileHubEconomyModPackages(equipped.state, ['example.wearables']),
    equipped.state,
  )
  const withoutPackage = reconcileHubEconomyModPackages(equipped.state, [])
  assert.equal(withoutPackage.equipment.robe, null)
  assert.equal(hubEconomyInventoryIsValid(withoutPackage), true)
  assert.equal(hubEconomyInventoryIsValid({
    ...equipped.state,
    equipment: {
      ...equipped.state.equipment,
      robe: { ...equipped.state.equipment.robe!, equipmentType: 'hat' },
    },
  }), false)
})

test('Last Word retains every ground item in one bounded named Luthacus Sack', () => {
  const source = createHubEconomy(1)
  const items = Array.from({ length: 20 }, (_, index): HubInventoryItem => ({
    equipmentType: null,
    iconRecords: [46],
    id: 90_000 + index,
    kind: 'health-potion',
    name: `Retained ${index}`,
    nativeSubtype: 0,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }))
  const archived = archiveHagathaLastWordItems(
    source,
    items,
    "Test Wizard's Earthly Possessions",
  )
  assert.equal(archived.accepted, true)
  assert.equal(archived.state.storage.length, 1)
  assert.equal(archived.state.storage[0]?.name, "Test Wizard's Earthly Possessions")
  assert.equal(projectInventoryItems(archived.state.storage).filter(({ item }) => (
    item.nativeTypeId === 7001
  )).length, 20)
  const ids = projectInventoryItems(archived.state.storage).map(({ item }) => item.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('completed-run archival retains carried and Last Word goods in one named Sack', () => {
  const source = createHubEconomy(1)
  const archived = archiveCompletedRunEconomy(source, {
    displayName: 'Helvidius',
    groundGold: 11,
    groundItems: [{ ...source.backpack[0]!, id: 90_000 }],
    transferCarriedItems: true,
  })

  assert.equal(archived.gold, source.gold + 11)
  assert.deepEqual(
    archived.backpack.map(({ kind }) => kind),
    ['health-potion', 'mana-potion'],
  )
  assert.ok(archived.equipment.hat?.iconTints)
  assert.deepEqual(archived.equipment.robe?.iconTints, archived.equipment.hat?.iconTints)
  const retained = archived.storage.at(-1)!
  assert.equal(retained.kind, 'sack')
  assert.ok(NATIVE_RETAINED_SACK_SUFFIXES.some(suffix => (
    retained.name === `Helvidius's ${suffix}`
  )))
  assert.equal(retained.contents?.length, 6)
  assert.deepEqual(
    retained.contents?.map(({ name }) => name).sort(),
    ['Hat', 'Health Potion', 'Health Potion', 'Mana Potion', 'Robe', 'Staff'],
  )
  assert.equal(archived.unforgeBonuses, source.unforgeBonuses)
  const ids = [
    ...archived.backpack.map(({ id }) => id),
    ...[archived.equipment.hat, archived.equipment.robe, archived.equipment.weapon]
      .flatMap(item => item ? [item.id] : []),
  ]
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ids.every(id => id > retained.id))
})

test('completed-run archival packs overflow and a full storage root without losing validity', () => {
  const base = createHubEconomy(1)
  const backpack = Array.from({ length: 20 }, (_, index) => ({
    ...base.backpack[0]!,
    id: 20_000 + index,
  }))
  const storage = Array.from({ length: HUB_STORAGE_SLOT_CAPACITY }, (_, index) => ({
    ...base.backpack[1]!,
    id: 30_000 + index,
  }))
  const archived = archiveCompletedRunEconomy({
    ...base,
    backpack,
    nextItemId: 40_000,
    storage,
  }, {
    displayName: 'Helvidius',
    groundGold: 0,
    groundItems: [],
    transferCarriedItems: true,
  })

  assert.equal(archived.storage.length, 1)
  assert.equal(archived.storage[0]?.name, "Helvidius's Stored Possessions")
  assert.equal(hubEconomyInventoryIsValid(archived), true)
  assert.ok(maximumSackChildren(archived.storage[0]!) <= HUB_SACK_CHILD_REPLICATION_LIMIT)
})

test('Fomentius preserves every native generator row and seed-1 roll order', () => {
  assert.deepEqual(
    FOMENTIUS_STOCK_DEFINITIONS.map(({ kind, price, rollBound }) => [kind, price, rollBound]),
    [
      ['health-potion', 150, 3],
      ['mana-potion', 75, 6],
      ['rejuvenation-potion', 200, 3],
      ['dye', 300, 2],
      ['key', 1200, 18],
      ['sack', 50, 2],
      ['antidote', 100, 3],
      ['wizard-chug', 2500, 8],
      ['mind-chug', 1500, 8],
    ],
  )

  const grouped = Object.groupBy(
    createHubEconomy(1).fomentiusStock,
    ({ kind }) => kind,
  )
  assert.deepEqual(
    Object.fromEntries(Object.entries(grouped).map(([kind, items]) => [kind, items?.length])),
    {
      'health-potion': 2,
      'mana-potion': 3,
      dye: 3,
      sack: 1,
      antidote: 1,
      'mind-chug': 1,
    },
  )
})

test('ordinary purchase is atomic, removes one stock object, and stacks potions', () => {
  const initial = { ...createHubEconomy(1), gold: 10_000 }
  const stock = initial.fomentiusStock.find(({ kind }) => kind === 'health-potion')!
  const bought = buyFomentiusItem(initial, stock.id)

  assert.equal(bought.accepted, true)
  assert.equal(bought.state.gold, initial.gold - 150)
  assert.equal(bought.state.fomentiusStock.length, initial.fomentiusStock.length - 1)
  assert.equal(
    bought.state.backpack.find(({ kind }) => kind === 'health-potion')?.quantity,
    2,
  )

  const noFunds: HubEconomyState = { ...initial, gold: 0 }
  const rejected = buyFomentiusItem(noFunds, stock.id)
  assert.equal(rejected.accepted, false)
  assert.equal(rejected.reason, 'insufficient-gold')
  assert.strictEqual(rejected.state, noFunds)
})

test('native potion use decrements one stacked object and destroys the empty stack', () => {
  const initial = createHubEconomy(1)
  const health = initial.backpack.find(({ kind }) => kind === 'health-potion')!
  const stacked = {
    ...initial,
    backpack: initial.backpack.map((item) => item.id === health.id
      ? { ...item, quantity: 2 }
      : item),
  }
  const first = consumeInventoryItem(stacked, health.id)
  assert.equal(first.accepted, true)
  assert.equal(first.state.backpack.find(({ id }) => id === health.id)?.quantity, 1)

  const second = consumeInventoryItem(first.state, health.id)
  assert.equal(second.accepted, true)
  assert.equal(second.state.backpack.some(({ id }) => id === health.id), false)

  const equipment = consumeInventoryItem(initial, initial.equipment.hat!.id)
  assert.equal(equipment.reason, 'item-not-found')
})

test('inventory discard removes one whole nested object and preserves its siblings', () => {
  const initial = createHubEconomy(1)
  const health = {
    ...initial.backpack.find(({ kind }) => kind === 'health-potion')!,
    id: 9_001,
    quantity: 3,
  }
  const mana = {
    ...initial.backpack.find(({ kind }) => kind === 'mana-potion')!,
    id: 9_002,
  }
  const sack = nativeTestSack(9_003, [health, mana])
  const source = { ...initial, backpack: [sack] }

  const discarded = discardInventoryItem(source, health.id)
  assert.equal(discarded.accepted, true)
  assert.equal(findInventoryItem(discarded.state.backpack, health.id), null)
  assert.strictEqual(findInventoryItem(discarded.state.backpack, mana.id), mana)
  assert.equal(findInventoryItem(discarded.state.backpack, sack.id)?.contents?.length, 1)

  const absent = discardInventoryItem(discarded.state, health.id)
  assert.equal(absent.accepted, false)
  assert.equal(absent.reason, 'item-not-found')
  assert.strictEqual(absent.state, discarded.state)
})

test('a post-run Fomentius restock advances native entropy without resetting the ledger', () => {
  const initial = createHubEconomy(1)
  const bought = buyFomentiusItem(initial, initial.fomentiusStock[0]!.id).state
  const restocked = restockFomentius(bought)

  assert.equal(restocked.gold, bought.gold)
  assert.deepEqual(restocked.backpack, bought.backpack)
  assert.deepEqual(restocked.storage, bought.storage)
  assert.equal(restocked.revision, bought.revision + 1)
  assert.ok(restocked.fomentiusStock.length > 0)
  assert.ok(restocked.fomentiusStock.every(({ id }) => id >= bought.nextItemId))
  assert.notDeepEqual(restocked.fomentiusStock, initial.fomentiusStock)
})

test('Hagatha exposes all authored rows, hides selector 8, and preserves price history', () => {
  assert.equal(HAGATHA_PERKS.length, 28)
  assert.deepEqual(HAGATHA_PERKS.map(({ selector }) => selector), [...Array(28).keys()])

  const initial = { ...createHubEconomy(1), gold: 10_000 }
  assert.equal(hagathaOffers(initial).length, 27)
  assert.equal(hagathaOffers(initial).some(({ selector }) => selector === 8), false)
  assert.equal(hagathaOffers(initial).find(({ selector }) => selector === 0)?.price, 600)

  const first = buyHagathaPerk(initial, 0)
  assert.equal(first.accepted, true)
  assert.equal(first.state.gold, 9_400)
  assert.equal(hagathaOffers(first.state).some(({ selector }) => selector === 0), false)

  const remixed: HubEconomyState = { ...first.state, ownedPerkSelectors: [] }
  assert.equal(hagathaOffers(remixed).find(({ selector }) => selector === 0)?.price, 200)
})

test('Hagatha bundle price is ceiling-half and Tonic raises capacity only twice', () => {
  const initial = {
    ...createHubEconomy(1, { hagathaBundleSelectors: [0, 1] }),
    gold: 10_000,
  }
  const bundle = hagathaOffers(initial).find(({ selector }) => selector === -1)
  assert.deepEqual(bundle?.members, [0, 1])
  assert.equal(bundle?.price, 600)

  const bought = buyHagathaPerk(initial, -1)
  assert.equal(bought.accepted, true)
  assert.equal(bought.state.gold, 9_400)
  assert.deepEqual(bought.state.ownedPerkSelectors, [0, 1])

  const firstTonic = buyHagathaPerk({ ...createHubEconomy(1), gold: 10_000 }, 27)
  assert.equal(firstTonic.accepted, true)
  assert.equal(firstTonic.state.charmCapacity, 6)
  assert.equal(hagathaOffers(firstTonic.state).find(({ selector }) => selector === 27)?.price, 1_000)
  const secondTonic = buyHagathaPerk(firstTonic.state, 27)
  assert.equal(secondTonic.accepted, true)
  assert.equal(secondTonic.state.charmCapacity, 9)
  assert.equal(hagathaOffers(secondTonic.state).some(({ selector }) => selector === 27), false)
})

test('Luthacus transfers one stable object both ways without touching gold or copying', () => {
  const initial = createHubEconomy(1)
  const itemId = initial.backpack[0]!.id
  const stored = transferInventoryItem(initial, itemId, 'to-storage')

  assert.equal(stored.accepted, true)
  assert.equal(stored.state.gold, initial.gold)
  assert.equal(stored.state.backpack.some(({ id }) => id === itemId), false)
  assert.equal(stored.state.storage.find(({ id }) => id === itemId)?.quantity, 1)

  const restored = transferInventoryItem(stored.state, itemId, 'to-backpack')
  assert.equal(restored.accepted, true)
  assert.equal(restored.state.gold, initial.gold)
  assert.equal(restored.state.storage.some(({ id }) => id === itemId), false)
  assert.equal(restored.state.backpack.find(({ id }) => id === itemId)?.quantity, 1)
})

test('Shlorio consumes the fee, offers unique complete-catalog recipes, and clears on buy or close', () => {
  assert.equal(DOWSING_EQUIPMENT_RECIPES.length, 47)
  assert.equal(new Set(DOWSING_EQUIPMENT_RECIPES.map(({ sourceIndex }) => sourceIndex)).size, 47)
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(
      DOWSING_EQUIPMENT_RECIPES,
      ({ type }) => type,
    )).map(([type, rows]) => [type, rows?.length])),
    { ring: 13, robe: 7, wand: 8, amulet: 9, hat: 6, staff: 4 },
  )
  assert.ok(DOWSING_EQUIPMENT_RECIPES
    .filter(({ type }) => type === 'amulet')
    .every(({ iconRecords }) => [30, 31].includes(iconRecords[0]!) && iconRecords[1]! >= 18 && iconRecords[1]! <= 29))
  assert.deepEqual(DOWSING_EQUIPMENT_RECIPES[1]?.iconTints, [0x191919, 0x80ffff])
  assert.deepEqual(DOWSING_EQUIPMENT_RECIPES[25]?.iconTints, [0x19ff19, 0xc8ffc8])
  assert.ok(DOWSING_EQUIPMENT_RECIPES
    .filter(({ type }) => type === 'ring' || type === 'amulet' || type === 'staff' || type === 'wand')
    .every(({ iconTints }) => iconTints[0] === null && iconTints[1] === null))

  const initial = { ...createHubEconomy(1), gold: 10_000 }
  const rolled = dowse(initial, 75)
  assert.equal(rolled.accepted, true)
  assert.equal(rolled.dowsingPitch, 0.8968220129609108)
  assert.equal(rolled.state.gold, 9_350)
  assert.deepEqual(rolled.state.dowsingOffers, [
    { id: 1, price: 5_550, recipeIndex: 40 },
    { id: 2, price: 5_000, recipeIndex: 3 },
    { id: 3, price: 5_050, recipeIndex: 34 },
  ])
  assert.ok(rolled.state.dowsingOffers.length === 3 || rolled.state.dowsingOffers.length === 4)
  assert.equal(new Set(rolled.state.dowsingOffers.map(({ recipeIndex }) => recipeIndex)).size,
    rolled.state.dowsingOffers.length)
  assert.ok(rolled.state.dowsingOffers.every(({ price }) => price >= 5_000 && price <= 5_700 && price % 50 === 0))

  const offer = rolled.state.dowsingOffers[0]!
  const bought = buyDowsingOffer(rolled.state, offer.id)
  assert.equal(bought.accepted, true)
  assert.equal(bought.dowsingPitch, 1.0525179989635944)
  assert.equal(bought.state.dowsingOffers.length, 0)
  assert.ok(bought.state.backpack.some(({ recipeIndex }) => recipeIndex === offer.recipeIndex))
  assert.equal(bought.state.dowsingFee, 700)

  const closed = closeDowsingOffers(dowse({ ...createHubEconomy(1), gold: 10_000 }, 75).state)
  assert.equal(closed.dowsingOffers.length, 0)
  assert.equal(closed.gold, 9_350)
})

test('all six equipment classes route through the seven sinks and third ring is perk-gated', () => {
  const samples = new Map(DOWSING_EQUIPMENT_RECIPES.map((recipe) => [recipe.type, recipe]))
  const expected = new Map<string, EquipmentSlot>([
    ['hat', 'hat'],
    ['robe', 'robe'],
    ['amulet', 'amulet'],
    ['staff', 'weapon'],
    ['wand', 'weapon'],
    ['ring', 'ring-0'],
  ])
  for (const [type, slot] of expected) {
    const base = createHubEconomy(1)
    const item = createEquipmentInventoryItem(samples.get(type)!, base.nextItemId)
    const state = { ...base, backpack: [...base.backpack, item], nextItemId: base.nextItemId + 1 }
    const equipped = equipInventoryItem(state, item.id, slot)
    assert.equal(equipped.accepted, true, `${type} equips into ${slot}`)
    const unequipped = unequipInventorySlot(equipped.state, slot)
    if (slot === 'hat' || slot === 'robe') {
      assert.equal(unequipped.reason, 'required-clothing', `${type} cannot leave ${slot} empty`)
      assert.strictEqual(unequipped.state, equipped.state)
    } else {
      assert.equal(unequipped.accepted, true, `${type} unequips from ${slot}`)
      assert.ok(unequipped.state.backpack.some(({ id }) => id === item.id))
    }
  }

  const base = createHubEconomy(1)
  const ringRecipe = samples.get('ring')!
  const ring = createEquipmentInventoryItem(ringRecipe, base.nextItemId)
  const ringState = { ...base, backpack: [...base.backpack, ring], nextItemId: base.nextItemId + 1 }
  assert.equal(equipInventoryItem(ringState, ring.id, 'ring-2').reason, 'slot-locked')
  const unlocked = { ...ringState, ownedPerkSelectors: [19] }
  assert.equal(equipInventoryItem(unlocked, ring.id, 'ring-2').accepted, true)
})

test('equipping into an occupied compatible sink returns the exact displaced item once', () => {
  const base = createHubEconomy(1)
  const ringRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'ring')!
  const first = createEquipmentInventoryItem(ringRecipe, base.nextItemId)
  const second = createEquipmentInventoryItem(ringRecipe, base.nextItemId + 1)
  const stocked = {
    ...base,
    backpack: [...base.backpack, first, second],
    nextItemId: base.nextItemId + 2,
  }
  const firstEquip = equipInventoryItem(stocked, first.id, 'ring-0')
  assert.equal(firstEquip.accepted, true)
  const swap = equipInventoryItem(firstEquip.state, second.id, 'ring-0')
  assert.equal(swap.accepted, true)
  assert.strictEqual(swap.state.equipment.rings[0], second)
  assert.equal(swap.state.backpack.filter(({ id }) => id === first.id).length, 1)
  assert.strictEqual(swap.state.backpack.find(({ id }) => id === first.id), first)
  assert.equal(swap.state.backpack.some(({ id }) => id === second.id), false)
})

test('the 88-cell backpack and 28-cell scavenged-goods store enforce distinct native capacities', () => {
  const base = createHubEconomy(1)
  const health = base.backpack[0]!
  const unique = (index: number) => ({
    ...health,
    iconRecords: [42],
    id: 10_000 + index,
    kind: 'dye' as const,
    name: `Dye ${index}`,
    nativeSubtype: 0,
    nativeTypeId: 7012,
    quantity: 1,
  })
  const fullStorage = { ...base, storage: Array.from({ length: 28 }, (_, index) => unique(index)) }
  assert.equal(transferInventoryItem(fullStorage, health.id, 'to-storage').reason, 'capacity-full')

  const backpack = Array.from({ length: 87 }, (_, index) => unique(index))
  const oneSlot = { ...base, backpack, storage: [unique(999)] }
  assert.equal(transferInventoryItem(oneSlot, oneSlot.storage[0]!.id, 'to-backpack').accepted, true)
  const fullBackpack = { ...base, backpack: Array.from({ length: 88 }, (_, index) => unique(index)), storage: [unique(999)] }
  assert.equal(transferInventoryItem(fullBackpack, fullBackpack.storage[0]!.id, 'to-backpack').reason, 'capacity-full')
})

test("the complete five-piece Bug-Master outfit owns Call Leviathan's maximum and damage effects", () => {
  const item = (recipeIndex: number) => createEquipmentInventoryItem(
    DOWSING_EQUIPMENT_RECIPES[recipeIndex]!,
    100 + recipeIndex,
  )
  const equipment = {
    amulet: item(15),
    hat: item(11),
    rings: [null, item(14), null] as const,
    robe: item(12),
    weapon: item(13),
  }
  assert.equal(hasPandimensionalBugMasterOutfit(equipment), true)
  assert.equal(hasPandimensionalBugMasterOutfit({ ...equipment, hat: null }), false)
  assert.equal(hasPandimensionalBugMasterOutfit({
    ...equipment,
    rings: [null, null, null],
  }), false)
})

test('every native secondary maximum is gated by its exact complete equipment set', () => {
  const item = (recipeIndex: number) => createEquipmentInventoryItem(
    DOWSING_EQUIPMENT_RECIPES[recipeIndex]!,
    200 + recipeIndex,
  )
  const equipment = (recipeIndexes: readonly number[]) => {
    const items = recipeIndexes.map(item)
    const rings = items.filter(({ equipmentType }) => equipmentType === 'ring')
    return {
      amulet: items.find(({ equipmentType }) => equipmentType === 'amulet') ?? null,
      hat: items.find(({ equipmentType }) => equipmentType === 'hat') ?? null,
      rings: [rings[0] ?? null, rings[1] ?? null, rings[2] ?? null] as const,
      robe: items.find(({ equipmentType }) => equipmentType === 'robe') ?? null,
      weapon: items.find(({ equipmentType }) => (
        equipmentType === 'staff' || equipmentType === 'wand'
      )) ?? null,
    }
  }
  const cases = [
    [hasTempestOutfit, [16, 17, 18, 19]],
    [hasBurningManOutfit, [20, 21]],
    [hasFrostburnJewels, [22, 23, 24]],
    [hasFeteOfClayOutfit, [25, 26, 27, 28]],
  ] as const
  for (const [predicate, recipes] of cases) {
    assert.equal(predicate(equipment(recipes)), true)
    assert.equal(predicate(equipment(recipes.slice(0, -1))), false)
  }
})

test('two participants never share gold, stock, offers, or inventory mutations', () => {
  const first = createHubEconomy(1)
  const second = createHubEconomy(2)
  const bought = buyFomentiusItem(first, first.fomentiusStock[0]!.id)

  assert.equal(bought.accepted, true)
  assert.equal(second.gold, 500)
  assert.equal(second.backpack.length, 2)
  assert.notDeepEqual(bought.state.fomentiusStock, second.fomentiusStock)
})

test('authoritative loot credit owns Gold and exact inventory transfer semantics', () => {
  const initial = createHubEconomy(1)
  const credited = creditLootGold(initial, 37)
  assert.equal(credited.gold, 537)
  assert.equal(credited.revision, initial.revision + 1)

  const potion = { ...initial.backpack[0]!, id: 99_001, quantity: 2 }
  const stacked = insertLootInventoryItem(initial, potion)
  assert.equal(stacked.accepted, true)
  assert.equal(stacked.state.backpack[0]?.quantity, 3)
  assert.equal(stacked.state.backpack.length, initial.backpack.length)

  const dye = {
    ...initial.backpack[0]!,
    iconRecords: [42],
    id: 99_002,
    kind: 'dye' as const,
    name: 'Fabric Dye Kit',
    nativeSubtype: 0,
    nativeTypeId: 7012,
    quantity: 1,
  }
  const inserted = insertLootInventoryItem(initial, dye)
  assert.equal(inserted.accepted, true)
  assert.equal(inserted.state.backpack.at(-1)?.id, initial.nextItemId)
  assert.equal(inserted.state.nextItemId, initial.nextItemId + 1)

  const full = {
    ...initial,
    backpack: Array.from({ length: HUB_INVENTORY_SLOT_CAPACITY }, (_, index) => ({
      ...dye,
      id: 50_000 + index,
    })),
  }
  const overflow = insertLootInventoryItem(full, dye)
  assert.equal(overflow.accepted, true)
  assert.equal(overflow.state.backpack.length, HUB_INVENTORY_SLOT_CAPACITY + 1)
  assert.equal(overflow.state.backpack.at(-1)?.id, full.nextItemId)
})

test('loot Item_Sacks receive unique participant IDs and Wizard Keys are consumed recursively', () => {
  const initial = createHubEconomy(1)
  const nestedKey = {
    ...initial.backpack[0]!,
    id: 3,
    iconRecords: [43],
    kind: 'key' as const,
    name: 'Wizard Key',
    nativeSubtype: 1,
    nativeTypeId: 7012,
  }
  const nestedPotion = { ...initial.backpack[0]!, id: 4 }
  const sack = {
    ...initial.backpack[0]!,
    contents: [nestedKey, nestedPotion],
    id: 2,
    iconRecords: [70],
    kind: 'sack' as const,
    name: 'Sack',
    nativeSubtype: 0,
    nativeTypeId: 7008,
  }

  const inserted = insertLootInventoryItem(initial, sack)
  assert.equal(inserted.accepted, true)
  const insertedSack = inserted.state.backpack.at(-1)!
  assert.deepEqual(
    [insertedSack.id, ...insertedSack.contents!.map(({ id }) => id)],
    [initial.nextItemId, initial.nextItemId + 1, initial.nextItemId + 2],
  )
  assert.equal(inserted.state.nextItemId, initial.nextItemId + 3)
  assert.equal(economyHasWizardKey(inserted.state), true)

  const consumed = consumeWizardKey(inserted.state)
  assert.equal(consumed.consumed, true)
  assert.equal(economyHasWizardKey(consumed.state), false)
  assert.equal(consumed.state.backpack.at(-1)?.contents?.length, 1)
  assert.equal(consumed.state.revision, inserted.state.revision + 1)
  const absent = consumeWizardKey(consumed.state)
  assert.equal(absent.consumed, false)
  assert.strictEqual(absent.state, consumed.state)
})

test('unforge owns the exhaustive seven-type gate and rejects every sibling item class', () => {
  assert.deepEqual(NATIVE_UNFORGE_ELIGIBLE_TYPE_IDS, [7002, 7003, 7004, 7005, 7006, 7008, 7011])
  const base = createHubEconomy(1)
  const template = base.backpack[0]!
  for (const nativeTypeId of NATIVE_UNFORGE_ELIGIBLE_TYPE_IDS) {
    const item = {
      ...template,
      contents: nativeTypeId === 7008 ? [] : undefined,
      equipmentType: nativeTypeId === 7008 ? null : 'ring' as const,
      id: 20_000 + nativeTypeId,
      kind: nativeTypeId === 7008 ? 'sack' as const : 'equipment' as const,
      name: `Eligible ${nativeTypeId}`,
      nativeTypeId,
      recipeIndex: null,
    }
    assert.equal(nativeInventoryItemCanUnforge(item), true, `${nativeTypeId} is eligible`)
    const state = { ...base, backpack: [...base.backpack, item], rng: createNativeRng(nativeTypeId) }
    const result = unforgeInventoryItem(state, item.id, {
      currentHealth: 50,
      currentMana: 100,
      maximumHealth: 50,
      maximumMana: 100,
    })
    assert.equal(result.accepted, true)
    assert.equal(result.state.backpack.some(({ id }) => id === item.id), false)
    assert.equal(result.unforgeOutcome?.kind, 'gold')
    assert.ok(result.unforgeOutcome!.amount >= 2 && result.unforgeOutcome!.amount <= 5)
  }

  for (const nativeTypeId of [7000, 7001, 7009, 7010, 7012]) {
    const item = { ...template, id: 30_000 + nativeTypeId, nativeTypeId }
    assert.equal(nativeInventoryItemCanUnforge(item), false, `${nativeTypeId} is ineligible`)
    const state = { ...base, backpack: [...base.backpack, item] }
    const result = unforgeInventoryItem(state, item.id, {
      currentHealth: 50,
      currentMana: 100,
      maximumHealth: 50,
      maximumMana: 100,
    })
    assert.equal(result.reason, 'ineligible-item')
    assert.strictEqual(result.state, state)
  }
})

test('unforge rejects a nonempty Item_Sack and immediately transmutes an empty one', () => {
  const base = createHubEconomy(1)
  const sack = {
    ...base.backpack[0]!,
    contents: [base.backpack[1]!],
    equipmentType: null,
    id: 40_000,
    kind: 'sack' as const,
    name: 'Sack',
    nativeTypeId: 7008,
    recipeIndex: null,
  }
  const nonempty = { ...base, backpack: [sack], rng: createNativeRng(1) }
  assert.equal(unforgeInventoryItem(nonempty, sack.id, {
    currentHealth: 50,
    currentMana: 100,
    maximumHealth: 50,
    maximumMana: 100,
  }).reason, 'ineligible-item')

  const empty = { ...nonempty, backpack: [{ ...sack, contents: [] }] }
  const result = unforgeInventoryItem(empty, sack.id, {
    currentHealth: 50,
    currentMana: 100,
    maximumHealth: 50,
    maximumMana: 100,
  })
  assert.equal(result.accepted, true)
  assert.equal(result.unforgeOutcome?.kind, 'gold')
  assert.equal(result.state.unforgeBonuses.recipeAttemptCount, 0)
  assert.equal(result.state.backpack.length, 0)
})

test('recipe-backed unforge reaches every authored result and always destroys the item', () => {
  const kinds = new Set([
    'experience',
    'fizzle',
    'full-rejuvenation',
    'gold',
    'mana-cost',
    'maximum-health',
    'maximum-mana',
    'mind-dredge',
    'offensive-damage',
  ])
  const observed = new Map<string, ReturnType<typeof unforgeInventoryItem>>()
  for (let seed = 0; seed < 50_000 && observed.size < kinds.size; seed += 1) {
    const base = createHubEconomy(1)
    const item = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[0]!, 50_000)
    const state = {
      ...base,
      backpack: [item],
      rng: createNativeRng(seed),
      unforgeBonuses: { ...base.unforgeBonuses, recipeAttemptCount: 8 },
    }
    const result = unforgeInventoryItem(state, item.id, {
      currentHealth: 1,
      currentMana: 1,
      maximumHealth: 50,
      maximumMana: 100,
    })
    const kind = result.unforgeOutcome?.kind
    if (kind && kinds.has(kind) && !observed.has(kind)) observed.set(kind, result)
  }
  assert.deepEqual(new Set(observed.keys()), kinds)
  for (const [kind, result] of observed) {
    assert.equal(result.accepted, true, kind)
    assert.equal(result.state.backpack.length, 0, kind)
    assert.match(nativeUnforgeOutcomeText(result.unforgeOutcome!), /\S/, kind)
  }
  assert.equal(observed.get('fizzle')?.unforgeOutcome?.amount, null)
  assert.equal(observed.get('fizzle')?.state.unforgeBonuses.recipeAttemptCount, 9)
  assert.ok((observed.get('maximum-health')?.state.unforgeBonuses.maximumHealth ?? 0) > 0)
  assert.ok((observed.get('maximum-mana')?.state.unforgeBonuses.maximumMana ?? 0) > 0)
  assert.ok((observed.get('experience')?.state.unforgeBonuses.experience ?? 0) > 0)
  assert.ok((observed.get('offensive-damage')?.state.unforgeBonuses.offensiveDamage ?? 0) > 0)
  assert.ok((observed.get('mana-cost')?.state.unforgeBonuses.manaCostReduction ?? 0) > 0)
})

test('unforge amount tables switch exactly when the fifth recipe selector begins', () => {
  const collect = (startingCount: number) => {
    const values = new Map<string, Set<number>>()
    for (let seed = 0; seed < 20_000; seed += 1) {
      const base = createHubEconomy(1)
      const item = createEquipmentInventoryItem(DOWSING_EQUIPMENT_RECIPES[0]!, 60_000)
      const result = unforgeInventoryItem({
        ...base,
        backpack: [item],
        rng: createNativeRng(seed),
        unforgeBonuses: { ...base.unforgeBonuses, recipeAttemptCount: startingCount },
      }, item.id, {
        currentHealth: 1,
        currentMana: 1,
        maximumHealth: 50,
        maximumMana: 100,
      })
      const outcome = result.unforgeOutcome!
      if (result.state.unforgeBonuses.recipeAttemptCount !== startingCount + 1
        || outcome.amount === null) continue
      const bucket = values.get(outcome.kind) ?? new Set<number>()
      bucket.add(outcome.amount)
      values.set(outcome.kind, bucket)
    }
    return Object.fromEntries([...values].map(([kind, bucket]) => [kind, [...bucket].sort((a, b) => a - b)]))
  }
  const early = collect(0)
  assert.deepEqual(early['offensive-damage'], [1, 2])
  assert.deepEqual(early['mana-cost'], [1, 2])
  assert.deepEqual(early['maximum-health'], [10])
  assert.deepEqual(early['maximum-mana'], [20])
  assert.deepEqual(early.experience, [5, 10])

  const late = collect(4)
  assert.deepEqual(late['offensive-damage'], [1])
  assert.deepEqual(late['mana-cost'], [1])
  assert.deepEqual(late['maximum-health'], [5, 10])
  assert.deepEqual(late['maximum-mana'], [10, 20])
  assert.deepEqual(late.experience, [1, 2])
})

function nativeTestSack(
  id: number,
  contents: readonly HubInventoryItem[] = [],
): HubInventoryItem {
  return {
    contents,
    equipmentType: null,
    iconRecords: [70],
    id,
    kind: 'sack',
    name: `Sack ${id}`,
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
}

test('native inventory projection is depth-first and sack relinking preserves one live subtree', () => {
  const base = createHubEconomy(1)
  const nestedPotion = { ...base.backpack[0]!, id: 10_001, quantity: 2 }
  const siblingPotion = { ...base.backpack[0]!, id: 10_002, quantity: 3 }
  const inner = nativeTestSack(10_003, [nestedPotion])
  const outer = nativeTestSack(10_004, [inner])
  const sibling = nativeTestSack(10_005, [siblingPotion])
  const state: HubEconomyState = { ...base, backpack: [outer, sibling] }

  assert.deepEqual(
    projectInventoryItems(state.backpack).map(({ depth, item, parentSackId }) => (
      [item.id, depth, parentSackId]
    )),
    [
      [10_004, 0, null],
      [10_003, 1, 10_004],
      [10_001, 2, 10_003],
      [10_005, 0, null],
      [10_002, 1, 10_005],
    ],
  )
  assert.strictEqual(findInventoryItem(state.backpack, 10_001), nestedPotion)

  const merged = moveInventoryItem(state, nestedPotion.id, sibling.id)
  assert.equal(merged.accepted, true)
  assert.equal(findInventoryItem(merged.state.backpack, nestedPotion.id), null)
  assert.equal(findInventoryItem(merged.state.backpack, siblingPotion.id)?.quantity, 5)
  assert.deepEqual(findInventoryItem(merged.state.backpack, inner.id)?.contents, [])

  const nested = moveInventoryItem(merged.state, sibling.id, inner.id)
  assert.equal(nested.accepted, true)
  assert.equal(projectInventoryItems(nested.state.backpack).find(
    ({ item }) => item.id === sibling.id,
  )?.parentSackId, inner.id)
  assert.equal(findInventoryItem(nested.state.backpack, siblingPotion.id)?.quantity, 5)

  const rooted = moveInventoryItem(nested.state, sibling.id, null)
  assert.equal(rooted.accepted, true)
  assert.equal(projectInventoryItems(rooted.state.backpack).find(
    ({ item }) => item.id === sibling.id,
  )?.parentSackId, null)
  assert.equal(findInventoryItem(rooted.state.backpack, siblingPotion.id)?.quantity, 5)

  const self = moveInventoryItem(rooted.state, outer.id, outer.id)
  assert.equal(self.reason, 'invalid-target')
  assert.strictEqual(self.state, rooted.state)
  const descendant = moveInventoryItem(rooted.state, outer.id, inner.id)
  assert.equal(descendant.reason, 'invalid-target')
  assert.strictEqual(descendant.state, rooted.state)
  const sameOwner = moveInventoryItem(rooted.state, inner.id, outer.id)
  assert.equal(sameOwner.reason, 'invalid-target')
  assert.strictEqual(sameOwner.state, rooted.state)
})

test('sack relinking honors participant child and root replication bounds', () => {
  const base = createHubEconomy(1)
  const template = base.backpack[0]!
  const fullSack = nativeTestSack(11_000, Array.from(
    { length: HUB_SACK_CHILD_REPLICATION_LIMIT },
    (_, index) => ({ ...template, id: 11_100 + index }),
  ))
  const loose = nativeTestSack(20_000)
  const childCapacity = moveInventoryItem(
    { ...base, backpack: [fullSack, loose] },
    loose.id,
    fullSack.id,
  )
  assert.equal(childCapacity.reason, 'capacity-full')

  const nested: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [43],
    id: 12_500,
    kind: 'key',
    name: 'Key',
    nativeSubtype: 1,
    nativeTypeId: 7012,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
  const carrier = nativeTestSack(12_501, [nested])
  const rootFull = {
    ...base,
    backpack: [
      carrier,
      ...Array.from({ length: HUB_INVENTORY_SLOT_CAPACITY - 1 }, (_, index) => ({
        ...template,
        id: 12_600 + index,
      })),
    ],
  }
  const rootCapacity = moveInventoryItem(rootFull, nested.id, null)
  assert.equal(rootCapacity.reason, 'capacity-full')
  assert.strictEqual(rootCapacity.state, rootFull)
})

test('sack relinking rejects a post-move tree beyond the participant depth bound', () => {
  const base = createHubEconomy(1)
  const chain = (firstId: number, deepestDepth: number) => {
    let item = nativeTestSack(firstId + deepestDepth)
    const deepestId = item.id
    for (let depth = deepestDepth - 1; depth >= 0; depth -= 1) {
      item = nativeTestSack(firstId + depth, [item])
    }
    return { deepestId, root: item }
  }
  const destination = chain(20_000, HUB_SACK_REPLICATION_DEPTH_LIMIT - 1)
  const source = nativeTestSack(21_000, [nativeTestSack(21_001)])
  const state = { ...base, backpack: [destination.root, source] }

  const result = moveInventoryItem(state, source.id, destination.deepestId)

  assert.equal(result.reason, 'invalid-target')
  assert.strictEqual(result.state, state)
  assert.equal(findInventoryItem(state.backpack, source.id), source)
})

test('recursive backpack and storage transfer preserves nonempty Item_Sack descendants', () => {
  const base = createHubEconomy(1)
  const potion = { ...base.backpack[0]!, id: 13_001, quantity: 4 }
  const nested = nativeTestSack(13_002, [potion])
  const outer = nativeTestSack(13_003, [nested])
  const state = { ...base, backpack: [outer] }

  const stored = transferInventoryItem(state, nested.id, 'to-storage')
  assert.equal(stored.accepted, true)
  assert.deepEqual(findInventoryItem(stored.state.backpack, outer.id)?.contents, [])
  assert.strictEqual(stored.state.storage[0], nested)
  assert.strictEqual(findInventoryItem(stored.state.storage, potion.id), potion)

  const restored = transferInventoryItem(stored.state, nested.id, 'to-backpack')
  assert.equal(restored.accepted, true)
  assert.equal(restored.state.storage.length, 0)
  assert.strictEqual(restored.state.backpack.at(-1), nested)
  assert.equal(findInventoryItem(restored.state.backpack, potion.id)?.quantity, 4)
})

test('consume, equip, and unforge resolve recursively owned inventory nodes', () => {
  const base = createHubEconomy(1)
  const potion = { ...base.backpack[0]!, id: 14_001, quantity: 2 }
  const robeRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'robe')!
  const robe = createEquipmentInventoryItem(robeRecipe, 14_002)
  const emptySack = nativeTestSack(14_003)
  const nonemptySack = nativeTestSack(14_004, [{ ...base.backpack[1]!, id: 14_005 }])
  const carrier = nativeTestSack(14_006, [potion, robe, emptySack, nonemptySack])
  const state = { ...base, backpack: [carrier], rng: createNativeRng(1) }

  const consumed = consumeInventoryItem(state, potion.id)
  assert.equal(consumed.accepted, true)
  assert.equal(findInventoryItem(consumed.state.backpack, potion.id)?.quantity, 1)

  const equipped = equipInventoryItem(consumed.state, robe.id, 'robe')
  assert.equal(equipped.accepted, true)
  assert.equal(equipped.state.equipment.robe?.id, robe.id)
  assert.equal(findInventoryItem(equipped.state.backpack, robe.id), null)
  assert.equal(equipped.state.backpack.some(({ id }) => id === base.equipment.robe?.id), true)

  const rejectedNonempty = unforgeInventoryItem(equipped.state, nonemptySack.id, {
    currentHealth: 50,
    currentMana: 100,
    maximumHealth: 50,
    maximumMana: 100,
  })
  assert.equal(rejectedNonempty.reason, 'ineligible-item')
  assert.strictEqual(rejectedNonempty.state, equipped.state)

  const unforge = unforgeInventoryItem(equipped.state, emptySack.id, {
    currentHealth: 50,
    currentMana: 100,
    maximumHealth: 50,
    maximumMana: 100,
  })
  assert.equal(unforge.accepted, true)
  assert.equal(findInventoryItem(unforge.state.backpack, emptySack.id), null)
  assert.equal(findInventoryItem(unforge.state.backpack, nonemptySack.id)?.contents?.length, 1)
  assert.ok(unforge.state.gold >= equipped.state.gold + 2)
  assert.ok(unforge.state.gold <= equipped.state.gold + 5)
})

test('duplicate IDs, shared nodes, and cyclic sack payloads are rejected without mutation', () => {
  const base = createHubEconomy(1)
  const duplicateA = { ...base.backpack[0]!, id: 15_001 }
  const duplicateB = { ...base.backpack[1]!, id: 15_001 }
  const duplicateState = { ...base, backpack: [nativeTestSack(15_002, [duplicateA]), duplicateB] }
  const duplicate = moveInventoryItem(duplicateState, duplicateA.id, null)
  assert.equal(duplicate.reason, 'invalid-inventory')
  assert.strictEqual(duplicate.state, duplicateState)

  const shared = { ...base.backpack[0]!, id: 15_100 }
  const sharedState = { ...base, backpack: [nativeTestSack(15_101, [shared]), shared] }
  const aliased = transferInventoryItem(sharedState, shared.id, 'to-storage')
  assert.equal(aliased.reason, 'invalid-inventory')
  assert.strictEqual(aliased.state, sharedState)

  const cyclic = nativeTestSack(15_200) as HubInventoryItem & { contents: HubInventoryItem[] }
  cyclic.contents.push(cyclic)
  const cyclicState = { ...base, backpack: [cyclic] }
  const cycle = moveInventoryItem(cyclicState, cyclic.id, null)
  assert.equal(cycle.reason, 'invalid-inventory')
  assert.strictEqual(cycle.state, cyclicState)
})

test('DyeClothing owns the exhaustive swatches and exact native blend/desaturation vectors', () => {
  assert.equal(NATIVE_DYE_SWATCHES.length, 18)
  assert.equal(NATIVE_DYE_SWATCH_COLORS.length, 18)
  assert.deepEqual(NATIVE_DYE_SWATCH_COLORS[0], [1, 1, 1])
  assert.deepEqual(NATIVE_DYE_SWATCH_COLORS[17], [0.1, 0.1, 0.1])
  assert.equal(MAX_NATIVE_DYE_SELECTIONS, 256)

  assert.deepEqual(nativeDyeMixedColor([1]), [1, 0, 0])
  assert.deepEqual(nativeDyeMixedColor([1, 9]), [0.875, 0, 0.125])
  assert.deepEqual(nativeDyeMixedColor([1, 9, 5]), [0.765625, 0.125, 0.109375])
  assert.equal(nativeDyeMixedTint([1, 9]), 0xdf0020)
  assert.equal(nativeDyeCommittedTint([1]), 0x7b3b3b)
  assert.equal(nativeDyeCommittedTint([1, 9]), 0x6d363e)
  assert.equal(nativeDyeMixedColor([]), null)
  assert.equal(nativeDyeCommittedTint([]), null)
  assert.throws(() => nativeDyeMixedColor([18]), /swatch rows are invalid/)
})

test('Fabric Dye commits cloth and trim transactionally against recursive Hat/Robe targets', () => {
  const base = createHubEconomy(1)
  const robeRecipe = DOWSING_EQUIPMENT_RECIPES.find(({ type }) => type === 'robe')!
  const target = createEquipmentInventoryItem(robeRecipe, 16_001)
  const dye: HubInventoryItem = {
    equipmentType: null,
    iconRecords: [42],
    id: 16_002,
    kind: 'dye',
    name: 'Fabric Dye',
    nativeSubtype: 0,
    nativeTypeId: 7012,
    quantity: 2,
    rarity: null,
    recipeIndex: null,
  }
  const carrier = nativeTestSack(16_003, [dye, target])
  const state = { ...base, backpack: [carrier] }

  assert.deepEqual(
    inventoryDyeableClothingItems(state.backpack).map(({ depth, item, parentSackId }) => (
      [item.id, depth, parentSackId]
    )),
    [[target.id, 1, carrier.id]],
  )

  const invalid = dyeInventoryClothing(state, dye.id, target.id, 'cloth', [])
  assert.equal(invalid.reason, 'invalid-target')
  assert.strictEqual(invalid.state, state)
  assert.equal(findInventoryItem(state.backpack, dye.id)?.quantity, 2)

  const cloth = dyeInventoryClothing(state, dye.id, target.id, 'cloth', [1, 9])
  assert.equal(cloth.accepted, true)
  assert.equal(findInventoryItem(cloth.state.backpack, dye.id)?.quantity, 1)
  assert.deepEqual(findInventoryItem(cloth.state.backpack, target.id)?.iconTints, [
    0x6d363e,
    robeRecipe.iconTints[1],
  ])

  const trim = dyeInventoryClothing(cloth.state, dye.id, target.id, 'trim', [1])
  assert.equal(trim.accepted, true)
  assert.equal(findInventoryItem(trim.state.backpack, dye.id), null)
  assert.deepEqual(findInventoryItem(trim.state.backpack, target.id)?.iconTints, [
    0x6d363e,
    0x7b3b3b,
  ])
  assert.equal(trim.state.revision, state.revision + 2)

  const equippedOnly = {
    ...base,
    backpack: [dye],
    equipment: { ...base.equipment, robe: target },
  }
  const excluded = dyeInventoryClothing(equippedOnly, dye.id, target.id, 'cloth', [1])
  assert.equal(excluded.reason, 'item-not-found')
  assert.strictEqual(excluded.state, equippedOnly)
})

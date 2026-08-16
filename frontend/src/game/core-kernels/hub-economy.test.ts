import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DOWSING_EQUIPMENT_RECIPES,
  FOMENTIUS_STOCK_DEFINITIONS,
  HAGATHA_PERKS,
  HUB_INVENTORY_SLOT_CAPACITY,
  HUB_STORAGE_SLOT_CAPACITY,
  STARTING_PLAYER_GOLD,
  buyDowsingOffer,
  buyFomentiusItem,
  buyHagathaPerk,
  closeDowsingOffers,
  consumeInventoryItem,
  createEquipmentInventoryItem,
  createHubEconomy,
  dowse,
  equipInventoryItem,
  hagathaOffers,
  hasPandimensionalBugMasterOutfit,
  restockFomentius,
  transferInventoryItem,
  unequipInventorySlot,
  type EquipmentSlot,
  type HubEconomyState,
} from './hub-economy.ts'

test('a fresh participant owns the hard-coded 10k ledger and complete native starter loadout', () => {
  const state = createHubEconomy(1)

  assert.equal(STARTING_PLAYER_GOLD, 10_000)
  assert.equal(HUB_INVENTORY_SLOT_CAPACITY, 88)
  assert.equal(HUB_STORAGE_SLOT_CAPACITY, 28)
  assert.equal(state.gold, 10_000)
  assert.deepEqual(
    state.backpack.map(({ kind, quantity }) => [kind, quantity]),
    [['health-potion', 1], ['mana-potion', 1]],
  )
  assert.deepEqual(state.storage, [])
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
  const initial = createHubEconomy(1)
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

  const initial = createHubEconomy(1)
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
  const initial = createHubEconomy(1, { hagathaBundleSelectors: [0, 1] })
  const bundle = hagathaOffers(initial).find(({ selector }) => selector === -1)
  assert.deepEqual(bundle?.members, [0, 1])
  assert.equal(bundle?.price, 600)

  const bought = buyHagathaPerk(initial, -1)
  assert.equal(bought.accepted, true)
  assert.equal(bought.state.gold, 9_400)
  assert.deepEqual(bought.state.ownedPerkSelectors, [0, 1])

  const firstTonic = buyHagathaPerk(createHubEconomy(1), 27)
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

  const initial = createHubEconomy(1)
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

  const closed = closeDowsingOffers(dowse(createHubEconomy(1), 75).state)
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

test('two participants never share gold, stock, offers, or inventory mutations', () => {
  const first = createHubEconomy(1)
  const second = createHubEconomy(2)
  const bought = buyFomentiusItem(first, first.fomentiusStock[0]!.id)

  assert.equal(bought.accepted, true)
  assert.equal(second.gold, 10_000)
  assert.equal(second.backpack.length, 2)
  assert.notDeepEqual(bought.state.fomentiusStock, second.fomentiusStock)
})

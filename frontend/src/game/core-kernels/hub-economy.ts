import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'

export const STARTING_PLAYER_GOLD = 10_000
export const HUB_INVENTORY_SLOT_CAPACITY = 88
/** Native ground pickup appends beyond the 88 visible cells when no Item_None slot remains. */
export const NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT = 2_048
export const HUB_STORAGE_SLOT_CAPACITY = 28
export const SHLORIO_INITIAL_DOWSING_FEE = 650
export const NATIVE_UNFORGE_ELIGIBLE_TYPE_IDS = [
  7002, 7003, 7004, 7005, 7006, 7008, 7011,
] as const

export type EquipmentType = 'amulet' | 'hat' | 'ring' | 'robe' | 'staff' | 'wand'
export type EquipmentSlot = 'amulet' | 'hat' | 'ring-0' | 'ring-1' | 'ring-2' | 'robe' | 'weapon'
export const EQUIPMENT_TYPES = ['amulet', 'hat', 'ring', 'robe', 'staff', 'wand'] as const
export const EQUIPMENT_SLOTS = ['amulet', 'hat', 'ring-0', 'ring-1', 'ring-2', 'robe', 'weapon'] as const
export type HubTraderId = 'fomentius' | 'hagatha' | 'luthacus' | 'shlorio'
export const SPLIT_MIND_CHARM_SELECTOR = 21
export type HubInventoryAction =
  | { readonly type: 'buy-dowsing'; readonly offerId: number }
  | { readonly type: 'buy-fomentius'; readonly itemId: number }
  | { readonly type: 'buy-hagatha'; readonly selector: number }
  | { readonly type: 'close-dowsing' }
  | { readonly type: 'consume'; readonly itemId: number }
  | { readonly type: 'dowse' }
  | { readonly type: 'equip'; readonly itemId: number; readonly slot: EquipmentSlot }
  | {
      readonly type: 'transfer'
      readonly direction: 'to-backpack' | 'to-storage'
      readonly gesture: 'double-activation' | 'drag'
      readonly itemId: number
    }
  | { readonly type: 'unforge'; readonly itemId: number }
  | { readonly type: 'unequip'; readonly slot: EquipmentSlot }
export type HubItemKind =
  | 'antidote'
  | 'dye'
  | 'equipment'
  | 'health-potion'
  | 'key'
  | 'mana-potion'
  | 'mind-chug'
  | 'mod-potion'
  | 'rejuvenation-potion'
  | 'sack'
  | 'wizard-chug'
export const HUB_ITEM_KINDS = [
  'antidote',
  'dye',
  'equipment',
  'health-potion',
  'key',
  'mana-potion',
  'mind-chug',
  'mod-potion',
  'rejuvenation-potion',
  'sack',
  'wizard-chug',
] as const

export interface HubInventoryItem {
  readonly contents?: readonly HubInventoryItem[]
  readonly equipmentType: EquipmentType | null
  readonly generatedLevel?: number
  readonly iconRecords: readonly number[]
  readonly iconTints?: readonly [number | null, number | null]
  readonly id: number
  readonly kind: HubItemKind
  readonly modContent?: ModConsumableContent
  readonly name: string
  readonly nativeSubtype: number | null
  readonly nativeSelector?: number
  readonly nativeEffects?: readonly NativeEquipmentEffect[]
  readonly nativeTypeId: number
  readonly quantity: number
  readonly rarity: 'Epic' | 'Rare' | null
  readonly recipeIndex: number | null
}

export interface ModSpriteFrame {
  readonly centerOffsetX: number
  readonly centerOffsetY: number
  readonly contentHeight: number
  readonly contentWidth: number
  readonly height: number
  readonly logicalHeight: number
  readonly logicalWidth: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export interface ModConsumableContent {
  readonly consumeVfx: Readonly<{
    readonly color: readonly [number, number, number, number]
    readonly kind: 'spell_glow'
  }> | null
  readonly contentId: string
  readonly description: string
  readonly durationMs: number
  readonly icon: Readonly<{
    readonly atlasId: string
    readonly frame: ModSpriteFrame
    readonly frameIndex: number
    readonly imagePath: string
  }>
  readonly key: string
  readonly modId: string
}

export interface ModConsumableCatalogEntry {
  readonly content: ModConsumableContent
  readonly name: string
  readonly nativeSubtype: number
}

export interface NativeEquipmentEffect {
  readonly kind: number
  readonly magnitude: number
  readonly operator: 0 | 1 | 2
  readonly target: number
}

export interface HubShopItem extends HubInventoryItem {
  readonly price: number
}

export interface EquipmentRecipe {
  readonly iconRecords: readonly number[]
  readonly iconTints: readonly [number | null, number | null]
  readonly level: number
  readonly name: string
  readonly nativeTypeId: number
  readonly rarity: 'Epic' | 'Rare'
  readonly setName: string | null
  readonly sourceIndex: number
  readonly type: EquipmentType
}

export interface HagathaPerkDefinition {
  readonly basePrice: number
  readonly behaviorFamily: string
  readonly description: string
  readonly name: string
  readonly selector: number
}

export interface HagathaOffer extends HagathaPerkDefinition {
  readonly members: readonly number[]
  readonly price: number
}

export interface DowsingOffer {
  readonly id: number
  readonly price: number
  readonly recipeIndex: number
}

export interface HubEquipmentState {
  readonly amulet: HubInventoryItem | null
  readonly hat: HubInventoryItem | null
  readonly rings: readonly [HubInventoryItem | null, HubInventoryItem | null, HubInventoryItem | null]
  readonly robe: HubInventoryItem | null
  readonly weapon: HubInventoryItem | null
}

export interface HubActionFeedback {
  readonly accepted: boolean
  readonly action: HubInventoryAction['type']
  readonly dowsingPitch: number | null
  readonly reason: HubEconomyRejection | null
  readonly sequence: number
  readonly transferDirection: 'to-backpack' | 'to-storage' | null
  readonly transferGesture: 'double-activation' | 'drag' | null
  readonly unforgeOutcome: NativeUnforgeOutcome | null
}

export const NATIVE_UNFORGE_OUTCOME_KINDS = [
  'experience',
  'fizzle',
  'full-rejuvenation',
  'gold',
  'mana-cost',
  'maximum-health',
  'maximum-mana',
  'mind-dredge',
  'offensive-damage',
] as const

export type NativeUnforgeOutcomeKind = typeof NATIVE_UNFORGE_OUTCOME_KINDS[number]

export interface NativeUnforgeOutcome {
  readonly amount: number | null
  readonly itemName: string
  readonly kind: NativeUnforgeOutcomeKind
}

export interface NativeUnforgeBonuses {
  readonly experience: number
  readonly manaCostReduction: number
  readonly maximumHealth: number
  readonly maximumMana: number
  readonly offensiveDamage: number
  readonly recipeAttemptCount: number
}

export interface HubEconomyState {
  readonly actionFeedback: HubActionFeedback | null
  readonly backpack: readonly HubInventoryItem[]
  readonly charmCapacity: number
  readonly dowsingFee: number
  readonly dowsingOffers: readonly DowsingOffer[]
  readonly equipment: HubEquipmentState
  readonly firstMixedSelectors: readonly number[]
  readonly fomentiusStock: readonly HubShopItem[]
  readonly gold: number
  readonly hagathaBundleSelectors: readonly number[]
  readonly nextItemId: number
  readonly nextOfferId: number
  readonly ownedPerkSelectors: readonly number[]
  readonly revision: number
  readonly rng: NativeRngState
  readonly storage: readonly HubInventoryItem[]
  readonly tonicPurchases: number
  readonly unforgeBonuses: NativeUnforgeBonuses
}

export type HubEconomyRejection =
  | 'capacity-full'
  | 'ineligible-item'
  | 'insufficient-gold'
  | 'invalid-offer'
  | 'invalid-slot'
  | 'item-not-found'
  | 'offers-active'
  | 'perk-capacity-full'
  | 'required-clothing'
  | 'slot-empty'
  | 'slot-locked'

export interface HubEconomyResult {
  readonly accepted: boolean
  readonly dowsingPitch: number | null
  readonly reason: HubEconomyRejection | null
  readonly state: HubEconomyState
  readonly unforgeOutcome: NativeUnforgeOutcome | null
}

export interface HubLootInventoryResult {
  readonly accepted: boolean
  readonly state: HubEconomyState
}

export interface HubWizardKeyResult {
  readonly consumed: boolean
  readonly state: HubEconomyState
}

export function hasPandimensionalBugMasterOutfit(
  equipment: HubEquipmentState,
): boolean {
  return hasCompleteEquipmentSet(equipment, [11, 12, 13, 14, 15])
}

export function hasTempestOutfit(equipment: HubEquipmentState): boolean {
  return hasCompleteEquipmentSet(equipment, [16, 17, 18, 19])
}

export function hasBurningManOutfit(equipment: HubEquipmentState): boolean {
  return hasCompleteEquipmentSet(equipment, [20, 21])
}

export function hasFrostburnJewels(equipment: HubEquipmentState): boolean {
  return hasCompleteEquipmentSet(equipment, [22, 23, 24])
}

export function hasFeteOfClayOutfit(equipment: HubEquipmentState): boolean {
  return hasCompleteEquipmentSet(equipment, [25, 26, 27, 28])
}

function hasCompleteEquipmentSet(
  equipment: HubEquipmentState,
  recipeIndexes: readonly number[],
): boolean {
  const equippedRecipes = new Set([
    equipment.hat,
    equipment.robe,
    equipment.weapon,
    equipment.amulet,
    ...equipment.rings,
  ].flatMap((item) => item?.recipeIndex === null || item?.recipeIndex === undefined
    ? []
    : [item.recipeIndex]))
  return recipeIndexes.every((recipeIndex) => equippedRecipes.has(recipeIndex))
}

export interface FomentiusStockDefinition {
  readonly gateValue?: number
  readonly iconRecords: readonly number[]
  readonly kind: Exclude<HubItemKind, 'equipment'>
  readonly name: string
  readonly nativeSubtype: number
  readonly nativeTypeId: number
  readonly price: number
  readonly quantityOffset?: number
  readonly rollBound: number
}

export const FOMENTIUS_STOCK_DEFINITIONS: readonly FomentiusStockDefinition[] = [
  { kind: 'health-potion', name: 'Health Potion', nativeTypeId: 7001, nativeSubtype: 0, iconRecords: [46], price: 150, rollBound: 3, quantityOffset: 2 },
  { kind: 'mana-potion', name: 'Mana Potion', nativeTypeId: 7001, nativeSubtype: 1, iconRecords: [47], price: 75, rollBound: 6, quantityOffset: 2 },
  { kind: 'rejuvenation-potion', name: 'Rejuvenation Potion', nativeTypeId: 7001, nativeSubtype: 5, iconRecords: [51], price: 200, rollBound: 3, quantityOffset: 0 },
  { kind: 'dye', name: 'Dye', nativeTypeId: 7012, nativeSubtype: 0, iconRecords: [42], price: 300, rollBound: 2, quantityOffset: 2 },
  { kind: 'key', name: 'Key', nativeTypeId: 7012, nativeSubtype: 1, iconRecords: [43], price: 1200, rollBound: 18, gateValue: 1 },
  { kind: 'sack', name: 'Sack', nativeTypeId: 7008, nativeSubtype: 0, iconRecords: [70], price: 50, rollBound: 2, quantityOffset: 1 },
  { kind: 'antidote', name: 'Antidote', nativeTypeId: 7001, nativeSubtype: 3, iconRecords: [49], price: 100, rollBound: 3, quantityOffset: 1 },
  { kind: 'wizard-chug', name: 'Wizard Chug', nativeTypeId: 7001, nativeSubtype: 2, iconRecords: [48], price: 2500, rollBound: 8, gateValue: 3 },
  { kind: 'mind-chug', name: 'Mind Chug', nativeTypeId: 7001, nativeSubtype: 4, iconRecords: [50], price: 1500, rollBound: 8, gateValue: 3 },
]

const EQUIPMENT_RECIPE_ROWS = [
  [0, 'Pentaclostic Ring', 'ring', 7002, 0, 'Rare', [63], 'The Arcanus Spectrum Paraclosm'],
  [1, 'Arcanoric Robe', 'robe', 7006, 0, 'Epic', [65, 68], 'The Arcanus Spectrum Paraclosm'],
  [2, 'Cosmofluxic Wand', 'wand', 7011, 0, 'Epic', [80], 'The Arcanus Spectrum Paraclosm'],
  [3, 'Theptoplasmar Amulet', 'amulet', 7003, 0, 'Rare', [31, 26], 'The Arcanus Spectrum Paraclosm'],
  [4, 'Synertauxic Ring', 'ring', 7002, 0, 'Rare', [63], 'The Arcanus Spectrum Paraclosm'],
  [5, 'Sublunarous Hat', 'hat', 7005, 0, 'Epic', [34, 38], 'The Arcanus Spectrum Paraclosm'],
  [6, "Combinator's Cap", 'hat', 7005, 0, 'Epic', [36, 40], "Combinator's Coutrement"],
  [7, "Combinator's Cape", 'robe', 7006, 0, 'Epic', [66, 69], "Combinator's Coutrement"],
  [8, "Combinator's Club", 'staff', 7004, 0, 'Epic', [73], "Combinator's Coutrement"],
  [9, "Combinator's Choker", 'amulet', 7003, 0, 'Rare', [31, 24], "Combinator's Coutrement"],
  [10, "Combinator's Circle", 'ring', 7002, 0, 'Rare', [53], "Combinator's Coutrement"],
  [11, "Bug-Master's Cap", 'hat', 7005, 0, 'Epic', [34, 38], "Pandimensional Bug-Master's Outfit"],
  [12, "Bug-Master's Robe", 'robe', 7006, 0, 'Epic', [64, 67], "Pandimensional Bug-Master's Outfit"],
  [13, "Bug-Master's Wand", 'wand', 7011, 0, 'Rare', [82], "Pandimensional Bug-Master's Outfit"],
  [14, "Bug-Master's Loop", 'ring', 7002, 0, 'Rare', [59], "Pandimensional Bug-Master's Outfit"],
  [15, 'Pan-Dimensional Strangler', 'amulet', 7003, 0, 'Rare', [30, 23], "Pandimensional Bug-Master's Outfit"],
  [16, 'Cloudcover Hood', 'hat', 7005, 0, 'Epic', [37, 41], 'Tempest Kit'],
  [17, 'Ozone Cape', 'robe', 7006, 0, 'Epic', [66, 69], 'Tempest Kit'],
  [18, 'Lightning Rod', 'staff', 7004, 0, 'Epic', [75], 'Tempest Kit'],
  [19, 'Storm Choker', 'amulet', 7003, 0, 'Rare', [30, 22], 'Tempest Kit'],
  [20, 'Burning Hat', 'hat', 7005, 0, 'Epic', [36, 40], 'Burning Man'],
  [21, 'Burning Robe', 'robe', 7006, 0, 'Epic', [64, 67], 'Burning Man'],
  [22, 'Biting Ring', 'ring', 7002, 0, 'Epic', [55], 'Frostburn Jewels'],
  [23, 'Bitter Ring', 'ring', 7002, 0, 'Epic', [55], 'Frostburn Jewels'],
  [24, 'Glittering Amulet', 'amulet', 7003, 0, 'Epic', [31, 29], 'Frostburn Jewels'],
  [25, "Potter's Apron", 'robe', 7006, 0, 'Epic', [66, 69], 'Fete of Clay'],
  [26, "Clayshaper's Ring", 'ring', 7002, 0, 'Epic', [57], 'Fete of Clay'],
  [27, "Claybaker's Ring", 'ring', 7002, 0, 'Epic', [57], 'Fete of Clay'],
  [28, 'Kiln', 'wand', 7011, 0, 'Epic', [81], 'Fete of Clay'],
  [29, "Obfuscate's Meddler", 'amulet', 7003, 8, 'Rare', [30, 18], null],
  [30, 'Karen You Scandalous Wench', 'amulet', 7003, 15, 'Epic', [31, 26], null],
  [31, 'Poxproof', 'amulet', 7003, 30, 'Rare', [30, 23], null],
  [32, 'Ethereal Choker', 'amulet', 7003, 10, 'Epic', [30, 19], null],
  [33, "Absolox's Boomstick", 'staff', 7004, 5, 'Rare', [72], null],
  [34, 'Staff of Dawn', 'staff', 7004, 15, 'Rare', [74], null],
  [35, 'Ringwall', 'ring', 7002, 3, 'Rare', [57], null],
  [36, 'Fleetfinger', 'ring', 7002, 10, 'Rare', [60], null],
  [37, 'Gritchenscorn', 'ring', 7002, 10, 'Rare', [62], null],
  [38, 'Mindblowing Ring', 'ring', 7002, 1, 'Rare', [52], null],
  [39, 'Smartest Ring', 'ring', 7002, 20, 'Epic', [53], null],
  [40, "Yzmar's Handicap", 'hat', 7005, 3, 'Rare', [37, 41], null],
  [41, "Qubar's Ether", 'wand', 7011, 10, 'Rare', [83], null],
  [42, "Qubar's Fire", 'wand', 7011, 10, 'Rare', [83], null],
  [43, "Qubar's Air", 'wand', 7011, 10, 'Rare', [83], null],
  [44, "Qubar's Water", 'wand', 7011, 10, 'Rare', [83], null],
  [45, "Qubar's Earth", 'wand', 7011, 10, 'Rare', [83], null],
  [46, 'Robe of Thaumic Unperturbability', 'robe', 7006, 15, 'Epic', [64, 67], null],
] as const

const EQUIPMENT_RECIPE_ICON_TINTS: Readonly<Partial<Record<
  number,
  readonly [number | null, number | null]
>>> = {
  1: [0x191919, 0x80ffff],
  5: [0x191919, 0xff80ff],
  6: [0xc0c0c0, null],
  7: [0xc0c0c0, null],
  11: [0xff19ff, null],
  12: [0xff19ff, null],
  16: [0x19ffff, null],
  17: [0x19ffff, null],
  20: [0xff0000, null],
  21: [0xff0000, null],
  25: [0x19ff19, 0xc8ffc8],
}

export const DOWSING_EQUIPMENT_RECIPES: readonly EquipmentRecipe[] =
  EQUIPMENT_RECIPE_ROWS.map(([
    sourceIndex,
    name,
    type,
    nativeTypeId,
    level,
    rarity,
    iconRecords,
    setName,
  ]) => ({
    iconRecords,
    iconTints: EQUIPMENT_RECIPE_ICON_TINTS[sourceIndex] ?? [null, null] as const,
    level,
    name,
    nativeTypeId,
    rarity,
    setName,
    sourceIndex,
    type,
  }))

const HAGATHA_PERK_ROWS = [
  [0, 'LIFE CHARM', 200, 'Increases maximum life by 25 percent.', 'derived_stat'],
  [1, 'MANA CHARM', 200, 'Increases maximum mana by 25 percent.', 'derived_stat'],
  [2, 'SPEED CHARM', 250, 'Increases movement and casting speed by 10 percent.', 'derived_stat'],
  [3, 'ITEM CHARM', 1000, 'Improves the chance that useful items drop.', 'drop_modifier'],
  [4, 'GOLD CHARM', 500, 'Improves gold drop chance and quantity.', 'drop_modifier'],
  [5, "SEEKER'S CHARM", 200, 'Reveals directions to gold, items, and upgrades.', 'owner_visual'],
  [6, 'REVELATION CHARM', 800, 'Newly learned skills start at level two.', 'skill_progression'],
  [7, 'CHEAT DEATH CHARM', 5000, 'Survives one killing blow and restores half of maximum life.', 'one_shot_combat'],
  [8, 'PERKY CHARM', 1500, 'Adds level-up choices and lowers item and skill requirements by two.', 'level_up_choice'],
  [9, 'SCATTER CURSE', 150, 'Killed monsters scatter more and larger orbs.', 'drop_modifier'],
  [10, 'WAR CHARM', 800, 'Reduces offensive spell mana costs by 25 percent.', 'derived_stat'],
  [11, 'CURING CHARM', 250, 'Reduces poison damage by 50 percent.', 'damage_modifier'],
  [12, 'THE LAST WORD CHARM', 500, 'Explodes on death for large area damage and changes final drops.', 'death_effect'],
  [13, "SPELLWELDER'S CHARM", 2000, 'Recombines welded spells when one component improves.', 'skill_progression'],
  [14, 'WEIRD CASTER CHARM', 2500, 'Grants a new secondary spell and favors secondary choices.', 'skill_progression'],
  [15, "DRINKER'S CHARM", 1000, 'Automatically drinks owned potions when needed.', 'inventory_consumption'],
  [16, 'GLASS CANNON CURSE', 1000, 'Doubles damage dealt and damage taken.', 'damage_modifier'],
  [17, "SORCEROR'S CHARM", 3000, 'Allows one level-up reroll or preserves the reroll for later.', 'level_up_choice'],
  [18, 'FOCUS CHARM', 1000, 'Reduces spell cooldowns by 25 percent.', 'derived_stat'],
  [19, 'DISFIGURING CURSE', 3000, 'Enables all three ring slots.', 'equipment_capacity'],
  [20, 'BARE HANDS CHARM', 500, 'Without a weapon, increases damage by 15 percent and reduces mana cost by 15 percent.', 'conditional_derived_stat'],
  [21, 'SPLIT MIND CHARM', 4000, 'Concentrates progression on two selected skills.', 'skill_progression'],
  [22, 'CURSE BOSSES', 2000, 'Makes bosses take triple damage.', 'damage_modifier'],
  [23, 'ARCANE ATTRACTOR CHARM', 2000, 'Greatly improves the chance of magical upgrades.', 'drop_modifier'],
  [24, 'SERENDIPITY CHARM', 1000, 'Triples spell damage until the owner is hurt.', 'until_hurt_combat'],
  [25, 'REVERIE CHARM', 1000, 'Removes offensive spell mana costs until the owner is hurt.', 'until_hurt_combat'],
  [26, "BRUTE'S CHARM", 3000, 'Increases melee damage by 200 percent and pushing by 100 percent.', 'derived_stat'],
  [27, 'TONIC', 1000, 'Increases charm and curse capacity; at most two tonics apply.', 'perk_capacity'],
] as const

export const HAGATHA_PERKS: readonly HagathaPerkDefinition[] =
  HAGATHA_PERK_ROWS.map(([selector, name, basePrice, description, behaviorFamily]) => ({
    basePrice,
    behaviorFamily,
    description,
    name,
    selector,
  }))

export const SORCERORS_CHARM_SELECTOR = 17

export function createNativeUnforgeBonuses(): NativeUnforgeBonuses {
  return {
    experience: 0,
    manaCostReduction: 0,
    maximumHealth: 0,
    maximumMana: 0,
    offensiveDamage: 0,
    recipeAttemptCount: 0,
  }
}

export function createHubEconomy(
  seed: number,
  options: { readonly hagathaBundleSelectors?: readonly number[] } = {},
): HubEconomyState {
  const stock = rollFomentiusStock(createNativeRng(seed), 6)
  const bundleSelectors = stableSelectors(options.hagathaBundleSelectors ?? [])
  return {
    actionFeedback: null,
    backpack: [
      starterPotion(1, 'health-potion', 'Health Potion', 0, 46),
      starterPotion(2, 'mana-potion', 'Mana Potion', 1, 47),
    ],
    charmCapacity: 3,
    dowsingFee: SHLORIO_INITIAL_DOWSING_FEE,
    dowsingOffers: [],
    equipment: starterEquipment(),
    firstMixedSelectors: [],
    fomentiusStock: stock.items,
    gold: STARTING_PLAYER_GOLD,
    hagathaBundleSelectors: bundleSelectors,
    nextItemId: stock.nextItemId,
    nextOfferId: 1,
    ownedPerkSelectors: [],
    revision: 0,
    rng: stock.rng,
    storage: [],
    tonicPurchases: 0,
    unforgeBonuses: createNativeUnforgeBonuses(),
  }
}

export function restockFomentius(source: HubEconomyState): HubEconomyState {
  const stock = rollFomentiusStock(source.rng, source.nextItemId)
  return {
    ...source,
    fomentiusStock: stock.items,
    nextItemId: stock.nextItemId,
    revision: source.revision + 1,
    rng: stock.rng,
  }
}

export function buyFomentiusItem(
  source: HubEconomyState,
  itemId: number,
): HubEconomyResult {
  const item = source.fomentiusStock.find((entry) => entry.id === itemId)
  if (!item) return rejected(source, 'invalid-offer')
  if (source.gold < item.price) return rejected(source, 'insufficient-gold')
  const inserted = insertItem(source.backpack, inventoryCopy(item), HUB_INVENTORY_SLOT_CAPACITY)
  if (!inserted) return rejected(source, 'capacity-full')
  return accepted({
    ...source,
    backpack: inserted,
    fomentiusStock: source.fomentiusStock.filter((entry) => entry.id !== itemId),
    gold: source.gold - item.price,
  })
}

export function hagathaOffers(source: HubEconomyState): readonly HagathaOffer[] {
  const owned = new Set(source.ownedPerkSelectors)
  const offers = HAGATHA_PERKS
    .filter(({ selector }) => (
      selector !== 8
      && (selector === 27 ? source.tonicPurchases < 2 : !owned.has(selector))
    ))
    .map((perk) => ({
      ...perk,
      members: [perk.selector],
      price: individualPerkPrice(source, perk.selector),
    }))
  if (source.hagathaBundleSelectors.length === 0) return offers
  const price = Math.ceil(source.hagathaBundleSelectors.reduce(
    (sum, selector) => sum + individualPerkPrice(source, selector),
    0,
  ) / 2)
  return [...offers, {
    basePrice: price,
    behaviorFamily: 'bulk_selector_list',
    description: 'A bargain bundle mixed from the selected charms and curses.',
    members: source.hagathaBundleSelectors,
    name: 'BARGAIN BUNDLE',
    price,
    selector: -1,
  }]
}

export function buyHagathaPerk(
  source: HubEconomyState,
  selector: number,
): HubEconomyResult {
  const offer = hagathaOffers(source).find((entry) => entry.selector === selector)
  if (!offer) return rejected(source, 'invalid-offer')
  if (source.gold < offer.price) return rejected(source, 'insufficient-gold')
  if (!perksFitCapacity(source, offer.members)) return rejected(source, 'perk-capacity-full')

  let charmCapacity = source.charmCapacity
  let tonicPurchases = source.tonicPurchases
  const owned = new Set(source.ownedPerkSelectors)
  const firstMixed = new Set(source.firstMixedSelectors)
  for (const member of offer.members) {
    firstMixed.add(member)
    if (member === 27) {
      if (tonicPurchases < 2) {
        tonicPurchases += 1
        charmCapacity = Math.min(9, charmCapacity + 3)
      }
    } else {
      owned.add(member)
    }
  }
  return accepted({
    ...source,
    charmCapacity,
    firstMixedSelectors: [...firstMixed].sort((left, right) => left - right),
    gold: source.gold - offer.price,
    hagathaBundleSelectors: selector === -1 ? [] : source.hagathaBundleSelectors,
    ownedPerkSelectors: [...owned].sort((left, right) => left - right),
    tonicPurchases,
  })
}

export function transferInventoryItem(
  source: HubEconomyState,
  itemId: number,
  direction: 'to-backpack' | 'to-storage',
): HubEconomyResult {
  const from = direction === 'to-storage' ? source.backpack : source.storage
  const to = direction === 'to-storage' ? source.storage : source.backpack
  const item = from.find((entry) => entry.id === itemId)
  if (!item) return rejected(source, 'item-not-found')
  const inserted = insertItem(
    to,
    item,
    direction === 'to-storage' ? HUB_STORAGE_SLOT_CAPACITY : HUB_INVENTORY_SLOT_CAPACITY,
  )
  if (!inserted) return rejected(source, 'capacity-full')
  return accepted({
    ...source,
    backpack: direction === 'to-storage'
      ? from.filter((entry) => entry.id !== itemId)
      : inserted,
    storage: direction === 'to-storage'
      ? inserted
      : from.filter((entry) => entry.id !== itemId),
  })
}

export function consumeInventoryItem(
  source: HubEconomyState,
  itemId: number,
): HubEconomyResult {
  const item = source.backpack.find((entry) => entry.id === itemId)
  if (!item) return rejected(source, 'item-not-found')
  if (item.nativeTypeId !== 7001 || item.nativeSubtype === null ||
      (item.kind === 'mod-potion' && item.modContent === undefined)) {
    return rejected(source, 'ineligible-item')
  }
  return accepted({
    ...source,
    backpack: item.quantity === 1
      ? source.backpack.filter((entry) => entry.id !== itemId)
      : source.backpack.map((entry) => entry.id === itemId
        ? { ...entry, quantity: entry.quantity - 1 }
        : entry),
  })
}

export interface NativeUnforgeVitals {
  readonly currentHealth: number
  readonly currentMana: number
  readonly maximumHealth: number
  readonly maximumMana: number
}

export function nativeInventoryItemCanUnforge(item: HubInventoryItem): boolean {
  return (NATIVE_UNFORGE_ELIGIBLE_TYPE_IDS as readonly number[]).includes(item.nativeTypeId)
}

export function nativeUnforgeOutcomeText(outcome: NativeUnforgeOutcome): string {
  switch (outcome.kind) {
    case 'experience': return `+${outcome.amount}% faster experience gain`
    case 'fizzle': return 'No bonus'
    case 'full-rejuvenation': return 'Full rejuvenation'
    case 'gold': return `Transmuted to ${outcome.amount} gold coins`
    case 'mana-cost': return `-${outcome.amount} mana cost for all spells`
    case 'maximum-health': return `+${outcome.amount} to maximum health`
    case 'maximum-mana': return `+${outcome.amount} to maximum mana`
    case 'mind-dredge': return 'Transmuted to Mind Dredge (+1 skill points at next level)'
    case 'offensive-damage': return `+${outcome.amount} damage for all offensive spells`
  }
}

export function unforgeInventoryItem(
  source: HubEconomyState,
  itemId: number,
  vitals: NativeUnforgeVitals,
): HubEconomyResult {
  const item = source.backpack.find(({ id }) => id === itemId)
  if (!item) return rejected(source, 'item-not-found')
  if (!nativeInventoryItemCanUnforge(item)) return rejected(source, 'ineligible-item')
  if (item.nativeTypeId === 7008 && (item.contents?.length ?? 0) > 0) {
    return rejected(source, 'ineligible-item')
  }

  let rng = source.rng
  let gold = source.gold
  let unforgeBonuses = source.unforgeBonuses
  let outcome: NativeUnforgeOutcome | null = null
  const recipeBacked = item.recipeIndex !== null || item.nativeEffects !== undefined

  if (item.nativeTypeId === 7008 || !recipeBacked) {
    const draw = drawNativeInteger(rng, 4)
    rng = draw.state
    const amount = draw.value + 2
    gold += amount
    outcome = { amount, itemName: item.name, kind: 'gold' }
  } else {
    while (outcome === null) {
      const recipeAttemptCount = unforgeBonuses.recipeAttemptCount + 1
      unforgeBonuses = { ...unforgeBonuses, recipeAttemptCount }
      const selectorDraw = drawNativeInteger(
        rng,
        recipeAttemptCount < 5 ? 7 : recipeAttemptCount + 3,
      )
      rng = selectorDraw.state
      let selector = selectorDraw.value
      if (selector > 7) {
        const fallback = drawNativeInteger(rng, 6)
        rng = fallback.state
        if (fallback.value !== 3) {
          outcome = { amount: null, itemName: item.name, kind: 'fizzle' }
          continue
        }
        selector = 7
      }

      if (selector === 0) {
        const needsRejuvenation = vitals.currentHealth < vitals.maximumHealth
          || vitals.currentMana < vitals.maximumMana
        if (recipeAttemptCount <= 5 && !needsRejuvenation) continue
        outcome = { amount: null, itemName: item.name, kind: 'full-rejuvenation' }
        continue
      }
      if (selector === 1 || selector === 2) {
        let amount = 1
        if (recipeAttemptCount < 5) {
          const amountDraw = drawNativeInteger(rng, 3)
          rng = amountDraw.state
          if (amountDraw.value === 1) amount = 2
        }
        if (selector === 1) {
          unforgeBonuses = {
            ...unforgeBonuses,
            offensiveDamage: unforgeBonuses.offensiveDamage + amount,
          }
          outcome = { amount, itemName: item.name, kind: 'offensive-damage' }
        } else {
          unforgeBonuses = {
            ...unforgeBonuses,
            manaCostReduction: unforgeBonuses.manaCostReduction + amount,
          }
          outcome = { amount, itemName: item.name, kind: 'mana-cost' }
        }
        continue
      }
      if (selector === 3) {
        const mindDredge = drawNativeInteger(rng, 100)
        rng = mindDredge.state
        if (mindDredge.value !== 25) continue
        outcome = { amount: 1, itemName: item.name, kind: 'mind-dredge' }
        continue
      }
      if (selector === 4 || selector === 5) {
        const maximum = selector === 4 ? 10 : 20
        let amount = maximum
        if (recipeAttemptCount >= 5) {
          const amountDraw = drawNativeInteger(rng, 4)
          rng = amountDraw.state
          if (amountDraw.value !== 1) amount = maximum / 2
        }
        if (selector === 4) {
          unforgeBonuses = {
            ...unforgeBonuses,
            maximumHealth: unforgeBonuses.maximumHealth + amount,
          }
          outcome = { amount, itemName: item.name, kind: 'maximum-health' }
        } else {
          unforgeBonuses = {
            ...unforgeBonuses,
            maximumMana: unforgeBonuses.maximumMana + amount,
          }
          outcome = { amount, itemName: item.name, kind: 'maximum-mana' }
        }
        continue
      }
      if (selector === 6) {
        const amountDraw = drawNativeInteger(rng, 2)
        rng = amountDraw.state
        const amount = recipeAttemptCount <= 4
          ? amountDraw.value === 1 ? 10 : 5
          : amountDraw.value === 1 ? 2 : 1
        unforgeBonuses = {
          ...unforgeBonuses,
          experience: Math.fround(unforgeBonuses.experience + amount / 100),
        }
        outcome = { amount, itemName: item.name, kind: 'experience' }
        continue
      }

      const goldDraw = drawNativeInteger(rng, 6)
      rng = goldDraw.state
      const amount = (goldDraw.value + 1) * 10
      gold += amount
      outcome = { amount, itemName: item.name, kind: 'gold' }
    }
  }

  return accepted({
    ...source,
    backpack: source.backpack.filter(({ id }) => id !== itemId),
    gold,
    rng,
    unforgeBonuses,
  }, null, outcome)
}

export function dowse(source: HubEconomyState, playerLevel: number): HubEconomyResult {
  if (source.dowsingOffers.length > 0) return rejected(source, 'offers-active')
  if (source.gold < source.dowsingFee) return rejected(source, 'insufficient-gold')
  let rng = source.rng
  const pitchDraw = drawNativeFloat(rng, 0.1)
  rng = pitchDraw.state
  const countDraw = drawNativeInteger(rng, 2)
  rng = countDraw.state
  const requestedCount = countDraw.value + 3
  const offers: DowsingOffer[] = []
  let nextOfferId = source.nextOfferId
  for (let slot = 0; slot < requestedCount; slot += 1) {
    let acceptedRecipe: EquipmentRecipe | undefined
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const recipeDraw = drawNativeInteger(rng, DOWSING_EQUIPMENT_RECIPES.length)
      rng = recipeDraw.state
      const recipe = DOWSING_EQUIPMENT_RECIPES[recipeDraw.value]!
      if (
        recipe.level <= playerLevel
        && !offers.some(({ recipeIndex }) => recipeIndex === recipe.sourceIndex)
      ) {
        acceptedRecipe = recipe
        break
      }
    }
    if (!acceptedRecipe) continue
    const priceDraw = drawNativeInteger(rng, 15)
    rng = priceDraw.state
    offers.push({
      id: nextOfferId,
      price: (priceDraw.value + 100) * 50,
      recipeIndex: acceptedRecipe.sourceIndex,
    })
    nextOfferId += 1
  }
  return accepted({
    ...source,
    dowsingOffers: offers,
    gold: source.gold - source.dowsingFee,
    nextOfferId,
    rng,
  }, Math.fround(0.8) + pitchDraw.value)
}

export function buyDowsingOffer(
  source: HubEconomyState,
  offerId: number,
): HubEconomyResult {
  const offer = source.dowsingOffers.find((entry) => entry.id === offerId)
  if (!offer) return rejected(source, 'invalid-offer')
  if (source.gold < offer.price) return rejected(source, 'insufficient-gold')
  const recipe = DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex]
  if (!recipe) return rejected(source, 'invalid-offer')
  const item = createEquipmentInventoryItem(recipe, source.nextItemId)
  const backpack = insertItem(source.backpack, item, HUB_INVENTORY_SLOT_CAPACITY)
  if (!backpack) return rejected(source, 'capacity-full')
  const feeDraw = drawNativeInteger(source.rng, 10)
  const pitchDraw = drawNativeFloat(feeDraw.state, 0.1)
  return accepted({
    ...source,
    backpack,
    dowsingFee: (feeDraw.value + 10) * 50,
    dowsingOffers: [],
    gold: source.gold - offer.price,
    nextItemId: source.nextItemId + 1,
    rng: pitchDraw.state,
  }, 1 + pitchDraw.value)
}

export function closeDowsingOffers(source: HubEconomyState): HubEconomyState {
  return source.dowsingOffers.length === 0
    ? source
    : { ...source, dowsingOffers: [], revision: source.revision + 1 }
}

export function creditLootGold(
  source: HubEconomyState,
  amount: number,
): HubEconomyState {
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new RangeError('loot Gold credit must be a positive safe integer')
  }
  const gold = source.gold + amount
  if (!Number.isSafeInteger(gold)) throw new RangeError('loot Gold credit overflowed')
  return { ...source, gold, revision: source.revision + 1 }
}

export function insertLootInventoryItem(
  source: HubEconomyState,
  item: HubInventoryItem,
): HubLootInventoryResult {
  if (item.quantity < 1 || !Number.isSafeInteger(item.quantity)) {
    throw new RangeError('loot inventory quantity must be a positive safe integer')
  }
  if (item.nativeTypeId === 7001) {
    const stackIndex = source.backpack.findIndex((entry) => (
      entry.nativeTypeId === item.nativeTypeId
      && (item.modContent === undefined
        ? entry.modContent === undefined && entry.nativeSubtype === item.nativeSubtype
        : entry.modContent?.contentId === item.modContent.contentId)
    ))
    if (stackIndex >= 0) {
      return {
        accepted: true,
        state: {
          ...source,
          backpack: source.backpack.map((entry, index) => index === stackIndex
            ? { ...entry, quantity: entry.quantity + item.quantity }
            : entry),
          revision: source.revision + 1,
        },
      }
    }
  }
  const identified = identifyLootItemTree(item, source.nextItemId)
  return {
    accepted: true,
    state: {
      ...source,
      backpack: [...source.backpack, identified.item],
      nextItemId: identified.nextItemId,
      revision: source.revision + 1,
    },
  }
}

export function economyHasWizardKey(source: HubEconomyState): boolean {
  return source.backpack.some(itemHasWizardKey)
}

export function consumeWizardKey(source: HubEconomyState): HubWizardKeyResult {
  for (let index = 0; index < source.backpack.length; index += 1) {
    const consumed = consumeWizardKeyFromItem(source.backpack[index]!)
    if (!consumed.consumed) continue
    const backpack = [...source.backpack]
    if (consumed.item === null) backpack.splice(index, 1)
    else backpack[index] = consumed.item
    return {
      consumed: true,
      state: { ...source, backpack, revision: source.revision + 1 },
    }
  }
  return { consumed: false, state: source }
}

export function createEquipmentInventoryItem(
  recipe: EquipmentRecipe,
  id: number,
): HubInventoryItem {
  return {
    equipmentType: recipe.type,
    iconRecords: recipe.iconRecords,
    id,
    kind: 'equipment',
    name: recipe.name,
    nativeSubtype: null,
    nativeTypeId: recipe.nativeTypeId,
    quantity: 1,
    rarity: recipe.rarity,
    recipeIndex: recipe.sourceIndex,
  }
}

function identifyLootItemTree(
  source: HubInventoryItem,
  firstItemId: number,
): { readonly item: HubInventoryItem; readonly nextItemId: number } {
  let nextItemId = firstItemId + 1
  const contents = source.contents?.map((item) => {
    const identified = identifyLootItemTree(item, nextItemId)
    nextItemId = identified.nextItemId
    return identified.item
  })
  return {
    item: {
      ...source,
      id: firstItemId,
      ...(contents === undefined ? {} : { contents }),
    },
    nextItemId,
  }
}

function itemHasWizardKey(item: HubInventoryItem): boolean {
  return item.nativeTypeId === 7012 && item.nativeSubtype === 1
    || item.contents?.some(itemHasWizardKey) === true
}

function consumeWizardKeyFromItem(
  source: HubInventoryItem,
): { readonly consumed: boolean; readonly item: HubInventoryItem | null } {
  if (source.nativeTypeId === 7012 && source.nativeSubtype === 1) {
    return source.quantity > 1
      ? { consumed: true, item: { ...source, quantity: source.quantity - 1 } }
      : { consumed: true, item: null }
  }
  if (source.contents === undefined) return { consumed: false, item: source }
  for (let index = 0; index < source.contents.length; index += 1) {
    const consumed = consumeWizardKeyFromItem(source.contents[index]!)
    if (!consumed.consumed) continue
    const contents = [...source.contents]
    if (consumed.item === null) contents.splice(index, 1)
    else contents[index] = consumed.item
    return { consumed: true, item: { ...source, contents } }
  }
  return { consumed: false, item: source }
}

export function equipInventoryItem(
  source: HubEconomyState,
  itemId: number,
  slot: EquipmentSlot,
): HubEconomyResult {
  const item = source.backpack.find((entry) => entry.id === itemId)
  if (!item) return rejected(source, 'item-not-found')
  if (!item.equipmentType) return rejected(source, 'ineligible-item')
  if (!slotAccepts(slot, item.equipmentType)) return rejected(source, 'invalid-slot')
  if (slot === 'ring-2' && !source.ownedPerkSelectors.includes(19)) {
    return rejected(source, 'slot-locked')
  }
  const previous = equippedAt(source.equipment, slot)
  let backpack: readonly HubInventoryItem[] = source.backpack.filter(({ id }) => id !== itemId)
  if (previous) {
    const inserted = insertItem(backpack, previous, HUB_INVENTORY_SLOT_CAPACITY)
    if (!inserted) return rejected(source, 'capacity-full')
    backpack = inserted
  }
  return accepted({
    ...source,
    backpack,
    equipment: withEquippedItem(source.equipment, slot, item),
  })
}

export function unequipInventorySlot(
  source: HubEconomyState,
  slot: EquipmentSlot,
): HubEconomyResult {
  if (slot === 'ring-2' && !source.ownedPerkSelectors.includes(19)) {
    return rejected(source, 'slot-locked')
  }
  if (slot === 'hat' || slot === 'robe') return rejected(source, 'required-clothing')
  const item = equippedAt(source.equipment, slot)
  if (!item) return rejected(source, 'slot-empty')
  const backpack = insertItem(source.backpack, item, HUB_INVENTORY_SLOT_CAPACITY)
  if (!backpack) return rejected(source, 'capacity-full')
  return accepted({
    ...source,
    backpack,
    equipment: withEquippedItem(source.equipment, slot, null),
  })
}

function inventoryItemFromStock(
  definition: FomentiusStockDefinition,
  id: number,
): HubInventoryItem {
  return {
    equipmentType: null,
    iconRecords: definition.iconRecords,
    id,
    kind: definition.kind,
    name: definition.name,
    nativeSubtype: definition.nativeSubtype,
    nativeTypeId: definition.nativeTypeId,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
}

function rollFomentiusStock(
  sourceRng: NativeRngState,
  sourceNextItemId: number,
): { readonly items: readonly HubShopItem[]; readonly nextItemId: number; readonly rng: NativeRngState } {
  let rng = sourceRng
  let nextItemId = sourceNextItemId
  const items: HubShopItem[] = []
  for (const definition of FOMENTIUS_STOCK_DEFINITIONS) {
    const draw = drawNativeInteger(rng, definition.rollBound)
    rng = draw.state
    const quantity = definition.gateValue === undefined
      ? draw.value + (definition.quantityOffset ?? 0)
      : Number(draw.value === definition.gateValue)
    for (let index = 0; index < quantity; index += 1) {
      items.push({
        ...inventoryItemFromStock(definition, nextItemId),
        price: definition.price,
      })
      nextItemId += 1
    }
  }
  return { items, nextItemId, rng }
}

function inventoryCopy(item: HubShopItem): HubInventoryItem {
  const { price: _price, ...inventory } = item
  return inventory
}

function starterPotion(
  id: number,
  kind: 'health-potion' | 'mana-potion',
  name: string,
  nativeSubtype: number,
  iconRecord: number,
): HubInventoryItem {
  return {
    equipmentType: null,
    iconRecords: [iconRecord],
    id,
    kind,
    name,
    nativeSubtype,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
}

function starterEquipmentItem(
  id: number,
  equipmentType: 'hat' | 'robe' | 'staff',
  name: string,
  nativeTypeId: 7004 | 7005 | 7006,
  iconRecords: readonly number[],
): HubInventoryItem {
  return {
    equipmentType,
    iconRecords,
    id,
    kind: 'equipment',
    name,
    nativeSubtype: null,
    nativeTypeId,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
}

function starterEquipment(): HubEquipmentState {
  return {
    amulet: null,
    hat: starterEquipmentItem(3, 'hat', 'Hat', 7005, [34, 38]),
    rings: [null, null, null],
    robe: starterEquipmentItem(4, 'robe', 'Robe', 7006, [64, 67]),
    weapon: starterEquipmentItem(5, 'staff', 'Staff', 7004, [72]),
  }
}

function stableSelectors(source: readonly number[]): readonly number[] {
  const result = [...new Set(source)].sort((left, right) => left - right)
  if (result.some((selector) => selector < 0 || selector > 27 || selector === 8)) {
    throw new RangeError('Hagatha bundle contains an unavailable selector')
  }
  return result
}

function individualPerkPrice(source: HubEconomyState, selector: number): number {
  const perk = HAGATHA_PERKS[selector]
  if (!perk) throw new RangeError(`unknown Hagatha selector ${selector}`)
  return source.firstMixedSelectors.includes(selector) ? perk.basePrice : perk.basePrice * 3
}

function perksFitCapacity(source: HubEconomyState, selectors: readonly number[]): boolean {
  let capacity = source.charmCapacity
  let tonicPurchases = source.tonicPurchases
  let ownedCount = source.ownedPerkSelectors.length
  const owned = new Set(source.ownedPerkSelectors)
  for (const selector of selectors) {
    if (selector === 27) {
      if (tonicPurchases >= 2) return false
      tonicPurchases += 1
      capacity = Math.min(9, capacity + 3)
    } else if (!owned.has(selector)) {
      owned.add(selector)
      ownedCount += 1
    }
  }
  return ownedCount <= capacity
}

function insertItem(
  destination: readonly HubInventoryItem[],
  item: HubInventoryItem,
  capacity: number,
): readonly HubInventoryItem[] | null {
  if (item.nativeTypeId === 7001) {
    const stackIndex = destination.findIndex((entry) => (
      entry.nativeTypeId === item.nativeTypeId
      && entry.nativeSubtype === item.nativeSubtype
    ))
    if (stackIndex >= 0) {
      return destination.map((entry, index) => index === stackIndex
        ? { ...entry, quantity: entry.quantity + item.quantity }
        : entry)
    }
  }
  return destination.length >= capacity ? null : [...destination, item]
}

function slotAccepts(slot: EquipmentSlot, type: EquipmentType): boolean {
  if (slot === 'weapon') return type === 'staff' || type === 'wand'
  if (slot.startsWith('ring-')) return type === 'ring'
  return slot === type
}

function equippedAt(
  equipment: HubEquipmentState,
  slot: EquipmentSlot,
): HubInventoryItem | null {
  if (slot === 'ring-0') return equipment.rings[0]
  if (slot === 'ring-1') return equipment.rings[1]
  if (slot === 'ring-2') return equipment.rings[2]
  return equipment[slot]
}

function withEquippedItem(
  source: HubEquipmentState,
  slot: EquipmentSlot,
  item: HubInventoryItem | null,
): HubEquipmentState {
  if (slot.startsWith('ring-')) {
    const index = Number(slot.at(-1))
    const rings = [...source.rings] as [
      HubInventoryItem | null,
      HubInventoryItem | null,
      HubInventoryItem | null,
    ]
    rings[index] = item
    return { ...source, rings }
  }
  return { ...source, [slot]: item }
}

function accepted(
  source: HubEconomyState,
  dowsingPitch: number | null = null,
  unforgeOutcome: NativeUnforgeOutcome | null = null,
): HubEconomyResult {
  return {
    accepted: true,
    dowsingPitch,
    reason: null,
    state: { ...source, revision: source.revision + 1 },
    unforgeOutcome,
  }
}

function rejected(
  state: HubEconomyState,
  reason: HubEconomyRejection,
): HubEconomyResult {
  return { accepted: false, dowsingPitch: null, reason, state, unforgeOutcome: null }
}

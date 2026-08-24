import {
  createNativeRng,
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import {
  createNativeHubNpcState,
  nativeTeacherSpellDefinition,
  readNativeLibrarianBook,
  resetNativeRunNpcState,
  selectNativeBoast,
  type NativeHubNpcState,
} from './native-hub-npc.ts'

/** Retail missing-profile initializer 0x005A8390 writes profile +0x58 = 500. */
export const NATIVE_FRESH_PROFILE_GOLD = 500
export const HUB_INVENTORY_SLOT_CAPACITY = 88
/** Native ground pickup appends beyond the 88 visible cells when no Item_None slot remains. */
export const NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT = 2_048
export const HUB_STORAGE_SLOT_CAPACITY = 28
/** One completed-run Sack can retain the hidden backpack lane plus all seven equipment sinks. */
export const HUB_SACK_CHILD_REPLICATION_LIMIT = NATIVE_LOOT_BACKPACK_REPLICATION_LIMIT + 7
/** Maximum admitted Item_Sack nesting depth, with root inventory items at depth zero. */
export const HUB_SACK_REPLICATION_DEPTH_LIMIT = 32
/** Bounded wire representation for one DyeClothing mixing transaction. */
export const MAX_NATIVE_DYE_SELECTIONS = 256
export const SHLORIO_INITIAL_DOWSING_FEE = 650
export const NATIVE_RETAINED_SACK_SUFFIXES = [
  'Earthly Possessions',
  'Stuff',
  'Dead Stuff',
  'Bag',
  'Loot',
] as const
export const NATIVE_UNFORGE_ELIGIBLE_TYPE_IDS = [
  7002, 7003, 7004, 7005, 7006, 7008, 7011,
] as const

export type EquipmentType = 'amulet' | 'hat' | 'ring' | 'robe' | 'staff' | 'wand'
export type EquipmentSlot = 'amulet' | 'hat' | 'ring-0' | 'ring-1' | 'ring-2' | 'robe' | 'weapon'
export const EQUIPMENT_TYPES = ['amulet', 'hat', 'ring', 'robe', 'staff', 'wand'] as const
export const EQUIPMENT_SLOTS = ['amulet', 'hat', 'ring-0', 'ring-1', 'ring-2', 'robe', 'weapon'] as const
export type HubTraderId = 'fomentius' | 'hagatha' | 'luthacus' | 'shlorio'
export const SPLIT_MIND_CHARM_SELECTOR = 21
export const NATIVE_DYE_SWATCHES = [
  0xffffff,
  0xff0000,
  0xff8000,
  0xffff00,
  0x80ff00,
  0x00ff00,
  0x00ff80,
  0x00ffff,
  0x0080ff,
  0x0000ff,
  0x8000ff,
  0xff80ff,
  0xff00ff,
  0xff0080,
  0xbfbfbf,
  0x808080,
  0x404040,
  0x1a1a1a,
] as const
export const NATIVE_DYE_SWATCH_COLORS = [
  [1, 1, 1],
  [1, 0, 0],
  [1, 0.5, 0],
  [1, 1, 0],
  [0.5, 1, 0],
  [0, 1, 0],
  [0, 1, 0.5],
  [0, 1, 1],
  [0, 0.5, 1],
  [0, 0, 1],
  [0.5, 0, 1],
  [1, 0.5, 1],
  [1, 0, 1],
  [1, 0, 0.5],
  [0.75, 0.75, 0.75],
  [0.5, 0.5, 0.5],
  [0.25, 0.25, 0.25],
  [0.1, 0.1, 0.1],
] as const
export type NativeDyeLayer = 'cloth' | 'trim'
export type HubInventoryAction =
  | { readonly type: 'buy-dowsing'; readonly offerId: number }
  | { readonly type: 'buy-fomentius'; readonly itemId: number }
  | { readonly type: 'buy-hagatha'; readonly selector: number }
  | { readonly type: 'buy-teacher-spell'; readonly skillId: number }
  | { readonly type: 'close-dowsing' }
  | { readonly type: 'consume'; readonly itemId: number }
  | {
      readonly type: 'dye'
      readonly dyeItemId: number
      readonly layer: NativeDyeLayer
      readonly swatchRows: readonly number[]
      readonly targetItemId: number
    }
  | { readonly type: 'dowse' }
  | { readonly type: 'equip'; readonly itemId: number; readonly slot: EquipmentSlot }
  | { readonly type: 'interact-goodie' }
  | {
      readonly type: 'move-inventory-item'
      readonly destinationSackId: number | null
      readonly itemId: number
    }
  | { readonly type: 'read-librarian-book'; readonly bookId: number }
  | { readonly type: 'read-skill-book'; readonly itemId: number }
  | { readonly type: 'select-boast'; readonly boastId: number }
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
  | 'skill-book'
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
  'skill-book',
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

export interface ProjectedInventoryItem {
  readonly depth: number
  readonly item: HubInventoryItem
  readonly parentSackId: number | null
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
  readonly npc: NativeHubNpcState
  readonly ownedPerkSelectors: readonly number[]
  readonly revision: number
  readonly rng: NativeRngState
  readonly storage: readonly HubInventoryItem[]
  readonly tonicPurchases: number
  readonly tutorialPending: boolean
  readonly unforgeBonuses: NativeUnforgeBonuses
}

export type HubEconomyRejection =
  | 'capacity-full'
  | 'ineligible-item'
  | 'insufficient-gold'
  | 'invalid-inventory'
  | 'invalid-offer'
  | 'invalid-slot'
  | 'invalid-target'
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

export interface CompletedRunEconomyArchive {
  readonly displayName: string
  readonly groundGold: number
  readonly groundItems: readonly HubInventoryItem[]
  readonly transferCarriedItems: boolean
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
  const starters = starterLoadout(1)
  const stock = rollFomentiusStock(createNativeRng(seed), starters.nextItemId)
  const bundleSelectors = stableSelectors(options.hagathaBundleSelectors ?? [])
  return {
    actionFeedback: null,
    backpack: starters.backpack,
    charmCapacity: 3,
    dowsingFee: SHLORIO_INITIAL_DOWSING_FEE,
    dowsingOffers: [],
    equipment: starters.equipment,
    firstMixedSelectors: [],
    fomentiusStock: stock.items,
    gold: NATIVE_FRESH_PROFILE_GOLD,
    hagathaBundleSelectors: bundleSelectors,
    nextItemId: stock.nextItemId,
    nextOfferId: 1,
    npc: createNativeHubNpcState(),
    ownedPerkSelectors: [],
    revision: 0,
    rng: stock.rng,
    storage: [],
    tonicPurchases: 0,
    tutorialPending: true,
    unforgeBonuses: createNativeUnforgeBonuses(),
  }
}

export function archiveCompletedRunEconomy(
  source: HubEconomyState,
  archive: CompletedRunEconomyArchive,
): HubEconomyState {
  let nextItemId = source.nextItemId
  let rng = source.rng
  const groundItems: HubInventoryItem[] = []
  for (const item of archive.groundItems) {
    const identified = identifyLootItemTree(item, nextItemId)
    groundItems.push(identified.item)
    nextItemId = identified.nextItemId
  }
  const carried = archive.transferCarriedItems
    ? [
        ...equippedItems(source.equipment),
        ...source.backpack,
      ]
    : []
  const contents = [...carried, ...groundItems]
  let storage = source.storage
  if (contents.length > 0) {
    const suffix = drawNativeInteger(rng, NATIVE_RETAINED_SACK_SUFFIXES.length)
    rng = suffix.state
    const packed = packSackContents(contents, nextItemId)
    nextItemId = packed.nextItemId
    const retained = archiveSack(
      nextItemId,
      `${archive.displayName}'s ${NATIVE_RETAINED_SACK_SUFFIXES[suffix.value]}`,
      packed.contents,
    )
    nextItemId += 1
    if (storage.length < HUB_STORAGE_SLOT_CAPACITY) {
      storage = [...storage, retained]
    } else {
      const consolidated = packSackContents([...storage, retained], nextItemId)
      nextItemId = consolidated.nextItemId
      storage = [archiveSack(nextItemId, `${archive.displayName}'s Stored Possessions`, consolidated.contents)]
      nextItemId += 1
    }
  }
  const starters = starterLoadout(nextItemId)
  nextItemId = starters.nextItemId
  const stock = rollFomentiusStock(rng, nextItemId)
  const result = {
    ...source,
    actionFeedback: null,
    backpack: starters.backpack,
    dowsingOffers: [],
    equipment: starters.equipment,
    fomentiusStock: stock.items,
    gold: Math.max(0, source.gold + archive.groundGold),
    nextItemId: stock.nextItemId,
    npc: resetNativeRunNpcState(source.npc),
    revision: source.revision + 1,
    rng: stock.rng,
    storage,
  }
  if (!hubEconomyInventoryIsValid(result)) {
    throw new Error('completed-run archive exceeds the bounded browser inventory tree')
  }
  return result
}

function packSackContents(
  source: readonly HubInventoryItem[],
  firstItemId: number,
): {
  readonly contents: readonly HubInventoryItem[]
  readonly nextItemId: number
} {
  let contents = source.flatMap(item => archiveSafeRoots(
    item,
    HUB_SACK_REPLICATION_DEPTH_LIMIT - 2,
  ))
  let nextItemId = firstItemId
  while (contents.length > HUB_SACK_CHILD_REPLICATION_LIMIT) {
    const parents: HubInventoryItem[] = []
    for (let index = 0; index < contents.length; index += HUB_SACK_CHILD_REPLICATION_LIMIT) {
      parents.push(archiveSack(
        nextItemId,
        'Sack',
        contents.slice(index, index + HUB_SACK_CHILD_REPLICATION_LIMIT),
      ))
      nextItemId += 1
    }
    contents = parents
  }
  return { contents, nextItemId }
}

function archiveSafeRoots(
  item: HubInventoryItem,
  maximumDepth: number,
): readonly HubInventoryItem[] {
  if (inventoryTreeDepth(item) <= maximumDepth) return [item]
  return item.contents?.flatMap(child => archiveSafeRoots(child, maximumDepth)) ?? []
}

function inventoryTreeDepth(item: HubInventoryItem): number {
  return item.contents?.length
    ? 1 + Math.max(...item.contents.map(inventoryTreeDepth))
    : 0
}

function archiveSack(
  id: number,
  name: string,
  contents: readonly HubInventoryItem[],
): HubInventoryItem {
  return {
    contents,
    equipmentType: null,
    iconRecords: [70],
    id,
    kind: 'sack',
    name,
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
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

export function selectHubBoast(source: HubEconomyState, boastId: number): HubEconomyResult {
  const npc = selectNativeBoast(source.npc, boastId)
  return npc === null ? rejected(source, 'invalid-offer') : accepted({ ...source, npc })
}

export function readLibrarianBook(source: HubEconomyState, bookId: number): HubEconomyResult {
  const npc = readNativeLibrarianBook(source.npc, bookId)
  return npc === null ? rejected(source, 'invalid-offer') : accepted({ ...source, npc })
}

export function buyTeacherSpell(
  source: HubEconomyState,
  skillId: number,
  advancedUnlocks: readonly boolean[],
): HubEconomyResult {
  const spell = nativeTeacherSpellDefinition(skillId)
  if (!spell || advancedUnlocks[skillId - 72]) return rejected(source, 'invalid-offer')
  if (source.gold < spell.price) return rejected(source, 'insufficient-gold')
  return accepted({ ...source, gold: source.gold - spell.price })
}

export function projectInventoryItems(
  source: readonly HubInventoryItem[],
): readonly ProjectedInventoryItem[] {
  const projected: ProjectedInventoryItem[] = []
  const seenIds = new Set<number>()
  const seenItems = new Set<HubInventoryItem>()
  const visit = (
    items: readonly HubInventoryItem[],
    depth: number,
    parentSackId: number | null,
  ) => {
    for (const item of items) {
      if (seenIds.has(item.id) || seenItems.has(item)) continue
      seenIds.add(item.id)
      seenItems.add(item)
      projected.push({ depth, item, parentSackId })
      if (item.nativeTypeId === 7008 && item.contents !== undefined) {
        visit(item.contents, depth + 1, item.id)
      }
    }
  }
  visit(source, 0, null)
  return projected
}

export function findInventoryItem(
  source: readonly HubInventoryItem[],
  itemId: number,
): HubInventoryItem | null {
  return projectInventoryItems(source).find(({ item }) => item.id === itemId)?.item ?? null
}

export function nativeInventoryClothingItems(
  source: readonly HubInventoryItem[],
): readonly ProjectedInventoryItem[] {
  return projectInventoryItems(source).filter(({ item }) => (
    (item.nativeTypeId === 7005 && item.equipmentType === 'hat')
    || (item.nativeTypeId === 7006 && item.equipmentType === 'robe')
  ))
}

export function nativeDyeMixedColor(
  swatchRows: readonly number[],
): readonly [red: number, green: number, blue: number] | null {
  if (swatchRows.length === 0) return null
  if (!nativeDyeRowsAreValid(swatchRows)) {
    throw new RangeError('native dye swatch rows are invalid')
  }
  let mixed = NATIVE_DYE_SWATCH_COLORS[swatchRows[0]!]!
    .map((channel) => Math.fround(channel)) as [number, number, number]
  for (const row of swatchRows.slice(1)) {
    const incoming = NATIVE_DYE_SWATCH_COLORS[row]!
      .map((channel) => Math.fround(channel)) as [number, number, number]
    mixed = mixed.map((channel, index) => Math.fround(
      Math.fround(channel * Math.fround(0.875))
      + Math.fround(incoming[index]! * Math.fround(0.125)),
    )) as [number, number, number]
  }
  return mixed
}

export function nativeDyeMixedTint(swatchRows: readonly number[]): number | null {
  const mixed = nativeDyeMixedColor(swatchRows)
  return mixed === null ? null : rgbTint(mixed)
}

export function nativeDyeCommittedTint(swatchRows: readonly number[]): number | null {
  const mixed = nativeDyeMixedColor(swatchRows)
  if (mixed === null) return null
  const luminance = Math.fround(
    Math.fround(mixed[0] * Math.fround(0.30860000848770142))
    + Math.fround(mixed[1] * Math.fround(0.6093999743461609))
    + Math.fround(mixed[2] * Math.fround(0.0820000022649765)),
  )
  return rgbTint(mixed.map((channel) => clamp01(Math.fround(
    Math.fround(luminance * Math.fround(0.75))
    + Math.fround(channel * Math.fround(0.25)),
  ))) as [number, number, number])
}

export function moveInventoryItem(
  source: HubEconomyState,
  itemId: number,
  destinationSackId: number | null,
): HubEconomyResult {
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  const projected = projectInventoryItems(source.backpack)
  const sourceEntry = projected.find(({ item }) => item.id === itemId)
  if (!sourceEntry) return rejected(source, 'item-not-found')
  if (sourceEntry.parentSackId === destinationSackId) return rejected(source, 'invalid-target')
  if (destinationSackId === itemId) return rejected(source, 'invalid-target')
  if (destinationSackId !== null) {
    const destination = projected.find(({ item }) => item.id === destinationSackId)?.item
    if (!destination || destination.nativeTypeId !== 7008) {
      return rejected(source, 'invalid-target')
    }
    if (findInventoryItem(sourceEntry.item.contents ?? [], destinationSackId)) {
      return rejected(source, 'invalid-target')
    }
  }

  const removed = removeInventoryTreeItem(source.backpack, itemId, null)
  if (!removed) return rejected(source, 'item-not-found')
  if (destinationSackId === null) {
    const backpack = insertItem(
      removed.items,
      removed.item,
      HUB_INVENTORY_SLOT_CAPACITY,
    )
    return backpack
      ? accepted({ ...source, backpack })
      : rejected(source, 'capacity-full')
  }

  const destination = findInventoryItem(removed.items, destinationSackId)
  if (!destination || destination.nativeTypeId !== 7008) {
    return rejected(source, 'invalid-target')
  }
  const contents = insertItem(
    destination.contents ?? [],
    removed.item,
    HUB_SACK_CHILD_REPLICATION_LIMIT,
  )
  if (!contents) return rejected(source, 'capacity-full')
  const backpack = replaceInventoryTreeItem(removed.items, destinationSackId, {
    ...destination,
    contents,
  })
  if (!backpack) return rejected(source, 'invalid-target')
  const moved = { ...source, backpack }
  return hubEconomyInventoryIsValid(moved)
    ? accepted(moved)
    : rejected(source, 'invalid-target')
}

export function transferInventoryItem(
  source: HubEconomyState,
  itemId: number,
  direction: 'to-backpack' | 'to-storage',
): HubEconomyResult {
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  const from = direction === 'to-storage' ? source.backpack : source.storage
  const to = direction === 'to-storage' ? source.storage : source.backpack
  const removed = removeInventoryTreeItem(from, itemId, null)
  if (!removed) return rejected(source, 'item-not-found')
  const inserted = insertItem(
    to,
    removed.item,
    direction === 'to-storage' ? HUB_STORAGE_SLOT_CAPACITY : HUB_INVENTORY_SLOT_CAPACITY,
  )
  if (!inserted) return rejected(source, 'capacity-full')
  return accepted({
    ...source,
    backpack: direction === 'to-storage'
      ? removed.items
      : inserted,
    storage: direction === 'to-storage'
      ? inserted
      : removed.items,
  })
}

export function consumeInventoryItem(
  source: HubEconomyState,
  itemId: number,
): HubEconomyResult {
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  const item = findInventoryItem(source.backpack, itemId)
  if (!item) return rejected(source, 'item-not-found')
  if (item.nativeTypeId !== 7001 || item.nativeSubtype === null ||
      (item.kind === 'mod-potion' && item.modContent === undefined)) {
    return rejected(source, 'ineligible-item')
  }
  const backpack = consumeInventoryTreeItem(source.backpack, itemId)
  if (!backpack) return rejected(source, 'item-not-found')
  return accepted({
    ...source,
    backpack,
  })
}

export function readInventorySkillBook(
  source: HubEconomyState,
  itemId: number,
): HubEconomyResult {
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  const item = findInventoryItem(source.backpack, itemId)
  if (!item) return rejected(source, 'item-not-found')
  if (
    item.kind !== 'skill-book'
    || item.nativeTypeId !== 7012
    || (item.nativeSubtype !== 2 && item.nativeSubtype !== 3)
  ) return rejected(source, 'ineligible-item')
  const backpack = consumeInventoryTreeItem(source.backpack, itemId)
  return backpack
    ? accepted({ ...source, backpack })
    : rejected(source, 'item-not-found')
}

export function dyeInventoryClothing(
  source: HubEconomyState,
  dyeItemId: number,
  targetItemId: number,
  layer: NativeDyeLayer,
  swatchRows: readonly number[],
): HubEconomyResult {
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  if (!nativeDyeRowsAreValid(swatchRows)) return rejected(source, 'invalid-target')
  const dye = findInventoryItem(source.backpack, dyeItemId)
  if (!dye) return rejected(source, 'item-not-found')
  if (dye.nativeTypeId !== 7012 || dye.nativeSubtype !== 0 || dye.kind !== 'dye') {
    return rejected(source, 'ineligible-item')
  }
  const target = findInventoryItem(source.backpack, targetItemId)
  if (!target) return rejected(source, 'item-not-found')
  if (!nativeInventoryClothingItems(source.backpack).some(({ item }) => item.id === targetItemId)) {
    return rejected(source, 'invalid-target')
  }
  const currentTints = nativeClothingTints(target)
  const committedTint = nativeDyeCommittedTint(swatchRows)
  if (!currentTints || committedTint === null) return rejected(source, 'invalid-target')
  const iconTints: readonly [number, number] = layer === 'cloth'
    ? [committedTint, currentTints[1]]
    : [currentTints[0], committedTint]
  const dyed = replaceInventoryTreeItem(source.backpack, targetItemId, {
    ...target,
    iconTints,
  })
  if (!dyed) return rejected(source, 'invalid-target')
  const backpack = consumeInventoryTreeItem(dyed, dyeItemId)
  if (!backpack) return rejected(source, 'item-not-found')
  return accepted({ ...source, backpack })
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
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  const item = findInventoryItem(source.backpack, itemId)
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

  const backpack = removeInventoryTreeItem(source.backpack, itemId, null)?.items
  if (!backpack) return rejected(source, 'item-not-found')
  return accepted({
    ...source,
    backpack,
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

/** Native Last Word retention writes one named Sack into Luthacus storage. */
export function archiveHagathaLastWordItems(
  source: HubEconomyState,
  items: readonly HubInventoryItem[],
  sackName: string,
): HubLootInventoryResult {
  if (items.length === 0) return { accepted: true, state: source }
  if (source.storage.length >= HUB_STORAGE_SLOT_CAPACITY) {
    return { accepted: false, state: source }
  }
  if (sackName.length === 0) throw new RangeError('Last Word Sack name must not be empty')
  const retained = retainedLastWordSack(items, sackName, 0)
  if (retained === null) return { accepted: false, state: source }
  const identified = identifyLootItemTree(retained, source.nextItemId)
  const state = {
    ...source,
    nextItemId: identified.nextItemId,
    revision: source.revision + 1,
    storage: [...source.storage, identified.item],
  }
  return hubEconomyInventoryIsValid(state)
    ? { accepted: true, state }
    : { accepted: false, state: source }
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

function retainedLastWordSack(
  source: readonly HubInventoryItem[],
  name: string,
  depth: number,
): HubInventoryItem | null {
  if (depth >= HUB_SACK_REPLICATION_DEPTH_LIMIT) return null
  const continuation = source.length > HUB_SACK_CHILD_REPLICATION_LIMIT
    ? retainedLastWordSack(
        source.slice(HUB_SACK_CHILD_REPLICATION_LIMIT - 1),
        name,
        depth + 1,
      )
    : null
  if (source.length > HUB_SACK_CHILD_REPLICATION_LIMIT && continuation === null) return null
  const contents = source.length > HUB_SACK_CHILD_REPLICATION_LIMIT
    ? [...source.slice(0, HUB_SACK_CHILD_REPLICATION_LIMIT - 1), continuation!]
    : [...source]
  return {
    contents: Object.freeze(contents),
    equipmentType: null,
    iconRecords: Object.freeze([70]),
    id: 1,
    kind: 'sack',
    name,
    nativeSubtype: 0,
    nativeTypeId: 7008,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
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
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
  const item = findInventoryItem(source.backpack, itemId)
  if (!item) return rejected(source, 'item-not-found')
  if (!item.equipmentType) return rejected(source, 'ineligible-item')
  if (!slotAccepts(slot, item.equipmentType)) return rejected(source, 'invalid-slot')
  if (slot === 'ring-2' && !source.ownedPerkSelectors.includes(19)) {
    return rejected(source, 'slot-locked')
  }
  const previous = equippedAt(source.equipment, slot)
  const removed = removeInventoryTreeItem(source.backpack, itemId, null)
  if (!removed) return rejected(source, 'item-not-found')
  let backpack: readonly HubInventoryItem[] = removed.items
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
  if (!hubEconomyInventoryIsValid(source)) return rejected(source, 'invalid-inventory')
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

function starterEquipment(firstItemId = 3): HubEquipmentState {
  return {
    amulet: null,
    hat: starterEquipmentItem(firstItemId, 'hat', 'Hat', 7005, [34, 38]),
    rings: [null, null, null],
    robe: starterEquipmentItem(firstItemId + 1, 'robe', 'Robe', 7006, [64, 67]),
    weapon: starterEquipmentItem(firstItemId + 2, 'staff', 'Staff', 7004, [72]),
  }
}

function starterLoadout(firstItemId: number): {
  readonly backpack: readonly HubInventoryItem[]
  readonly equipment: HubEquipmentState
  readonly nextItemId: number
} {
  return {
    backpack: [
      starterPotion(firstItemId, 'health-potion', 'Health Potion', 0, 46),
      starterPotion(firstItemId + 1, 'mana-potion', 'Mana Potion', 1, 47),
    ],
    equipment: starterEquipment(firstItemId + 2),
    nextItemId: firstItemId + 5,
  }
}

function equippedItems(equipment: HubEquipmentState): readonly HubInventoryItem[] {
  return [
    equipment.amulet,
    equipment.hat,
    ...equipment.rings,
    equipment.robe,
    equipment.weapon,
  ].filter((item): item is HubInventoryItem => item !== null)
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

interface RemovedInventoryTreeItem {
  readonly item: HubInventoryItem
  readonly items: readonly HubInventoryItem[]
  readonly parentSackId: number | null
}

function removeInventoryTreeItem(
  source: readonly HubInventoryItem[],
  itemId: number,
  parentSackId: number | null,
): RemovedInventoryTreeItem | null {
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index]!
    if (item.id === itemId) {
      return {
        item,
        items: source.filter((_, candidateIndex) => candidateIndex !== index),
        parentSackId,
      }
    }
    if (item.nativeTypeId !== 7008 || item.contents === undefined) continue
    const nested = removeInventoryTreeItem(item.contents, itemId, item.id)
    if (!nested) continue
    return {
      ...nested,
      items: source.map((entry, candidateIndex) => candidateIndex === index
        ? { ...item, contents: nested.items }
        : entry),
    }
  }
  return null
}

function replaceInventoryTreeItem(
  source: readonly HubInventoryItem[],
  itemId: number,
  replacement: HubInventoryItem,
): readonly HubInventoryItem[] | null {
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index]!
    if (item.id === itemId) {
      return source.map((entry, candidateIndex) => candidateIndex === index ? replacement : entry)
    }
    if (item.nativeTypeId !== 7008 || item.contents === undefined) continue
    const contents = replaceInventoryTreeItem(item.contents, itemId, replacement)
    if (!contents) continue
    return source.map((entry, candidateIndex) => candidateIndex === index
      ? { ...item, contents }
      : entry)
  }
  return null
}

function consumeInventoryTreeItem(
  source: readonly HubInventoryItem[],
  itemId: number,
): readonly HubInventoryItem[] | null {
  const item = findInventoryItem(source, itemId)
  if (!item) return null
  if (item.quantity > 1) {
    return replaceInventoryTreeItem(source, itemId, { ...item, quantity: item.quantity - 1 })
  }
  return removeInventoryTreeItem(source, itemId, null)?.items ?? null
}

function nativeDyeRowsAreValid(swatchRows: readonly number[]): boolean {
  return swatchRows.length > 0
    && swatchRows.length <= MAX_NATIVE_DYE_SELECTIONS
    && swatchRows.every((row) => (
      Number.isSafeInteger(row) && row >= 0 && row < NATIVE_DYE_SWATCH_COLORS.length
    ))
}

function nativeClothingTints(
  item: HubInventoryItem,
): readonly [cloth: number, trim: number] | null {
  const recipeTints = item.recipeIndex === null
    ? undefined
    : DOWSING_EQUIPMENT_RECIPES[item.recipeIndex]?.iconTints
  const cloth = item.iconTints?.[0] ?? recipeTints?.[0]
  const trim = item.iconTints?.[1] ?? recipeTints?.[1]
  return cloth === null || cloth === undefined || trim === null || trim === undefined
    ? null
    : [cloth, trim]
}

export function hubEconomyInventoryIsValid(source: HubEconomyState): boolean {
  const seenIds = new Set<number>()
  const seenItems = new Set<HubInventoryItem>()
  const visit = (items: readonly HubInventoryItem[], depth = 0): boolean => {
    if (depth > HUB_SACK_REPLICATION_DEPTH_LIMIT) return false
    for (const item of items) {
      if (
        !Number.isSafeInteger(item.id)
        || item.id < 1
        || !Number.isSafeInteger(item.quantity)
        || item.quantity < 1
        || seenIds.has(item.id)
        || seenItems.has(item)
      ) return false
      seenIds.add(item.id)
      seenItems.add(item)
      const sack = item.nativeTypeId === 7008 && item.kind === 'sack'
      if ((item.nativeTypeId === 7008) !== (item.kind === 'sack')) return false
      if (item.contents !== undefined) {
        if (!sack || item.contents.length > HUB_SACK_CHILD_REPLICATION_LIMIT) return false
        if (item.contents.length > 0 && !visit(item.contents, depth + 1)) return false
      }
    }
    return true
  }
  const equipment = [
    source.equipment.amulet,
    source.equipment.hat,
    ...source.equipment.rings,
    source.equipment.robe,
    source.equipment.weapon,
  ].filter((item): item is HubInventoryItem => item !== null)
  return visit(source.backpack)
    && visit(source.storage)
    && visit(equipment)
    && visit(source.fomentiusStock)
}

function rgbTint(color: readonly number[]): number {
  const channel = (value: number) => Math.round(clamp01(value) * 255)
  return (channel(color[0]!) << 16) | (channel(color[1]!) << 8) | channel(color[2]!)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Math.fround(value)))
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

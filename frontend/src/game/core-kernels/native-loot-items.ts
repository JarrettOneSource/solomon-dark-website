import {
  DOWSING_EQUIPMENT_RECIPES,
  NATIVE_SKILL_BOOK_DEFINITIONS,
  createEquipmentInventoryItem,
  createNativeSkillBookInventoryItem,
  type EquipmentRecipe,
  type EquipmentType,
  type HubInventoryItem,
} from './hub-economy.ts'
import {
  drawNativeFloat,
  drawNativeInteger,
  type NativeRngState,
} from './native-rng.ts'
import { generateNativeRandomEquipmentEffects } from './native-random-equipment.ts'
import type { NativeLootSelectionInput } from './native-loot.ts'

export interface NativeLootItemIds {
  readonly next: () => number
  readonly peek: () => number
}

export interface NativeLootItem extends HubInventoryItem {
  readonly contents?: readonly NativeLootItem[]
  readonly iconTints?: readonly [number | null, number | null]
  readonly generatedLevel?: number
  readonly nativeSelector?: number
}

export interface NativeGoodieContentsInput {
  readonly advancedUnlocks: readonly boolean[]
  readonly itemIds: NativeLootItemIds
  readonly ownedRecipeIndexes: readonly number[]
  readonly playerLevel: number
  readonly selector: number
  readonly sharedRng: NativeRngState
}

export interface NativeGoodieContentsResult {
  readonly gold: number
  readonly itemIds: NativeLootItemIds
  readonly items: readonly NativeLootItem[]
  readonly sharedRng: NativeRngState
}

interface ItemSelectionResult {
  readonly item: NativeLootItem | null
  readonly sharedRng: NativeRngState
}

export function createNativeLootItemIds(first: number): NativeLootItemIds {
  if (!Number.isSafeInteger(first) || first < 1) {
    throw new RangeError('native loot item id must start at a positive safe integer')
  }
  let nextId = first
  return Object.freeze({
    next: () => nextId++,
    peek: () => nextId,
  })
}

export function resolveNativeGoodieContents(
  input: NativeGoodieContentsInput,
): NativeGoodieContentsResult {
  if (!Number.isInteger(input.selector) || input.selector < 0 || input.selector > 17) {
    throw new RangeError('native Goodie selector must be within [0,17]')
  }
  let rng = input.sharedRng
  const items: NativeLootItem[] = []
  const insertItem = (item: NativeLootItem) => {
    if (item.nativeTypeId === 7001) {
      const stackIndex = items.findIndex((candidate) => (
        candidate.nativeTypeId === 7001 && candidate.nativeSubtype === item.nativeSubtype
      ))
      if (stackIndex >= 0) {
        items[stackIndex] = {
          ...items[stackIndex]!,
          quantity: items[stackIndex]!.quantity + item.quantity,
        }
        return
      }
    }
    items.push(item)
  }
  let gold = 0
  if (input.selector <= 3) {
    for (let index = 0; index < 5; index += 1) insertItem(potionItem(input.itemIds, 0))
  } else if (input.selector <= 7) {
    for (let index = 0; index < 6; index += 1) insertItem(potionItem(input.itemIds, 1))
  } else if (input.selector <= 9) {
    const third = drawNativeInteger(rng, 2)
    rng = third.state
    const count = third.value + 2
    for (let index = 0; index < count; index += 1) {
      const levelOffset = drawNativeInteger(rng, 5)
      rng = levelOffset.state
      const generated = randomEquipment(
        rng,
        input.itemIds,
        input.playerLevel + levelOffset.value,
        input.advancedUnlocks,
      )
      rng = generated.sharedRng
      insertItem(generated.item)
    }
  } else if (input.selector === 10) {
    const selected = selectGoodieEquipment(rng, input.itemIds, input.ownedRecipeIndexes)
    rng = selected.sharedRng
    if (selected.item) insertItem(selected.item)
  } else if (input.selector <= 12) {
    for (let index = 0; index < 3; index += 1) {
      const subtype = drawNativeInteger(rng, 2)
      rng = subtype.state
      insertItem(miscItem(input.itemIds, subtype.value + 2))
    }
  } else if (input.selector <= 16) {
    const amount = drawNativeInteger(rng, 3)
    rng = amount.state
    gold = amount.value * 300 + 500
  } else {
    for (let index = 0; index < 3; index += 1) input.itemIds.next()
    for (const subtype of [5, 0, 1, 4, 2, 2]) {
      insertItem(potionItem(input.itemIds, subtype))
    }
  }
  return {
    gold,
    itemIds: input.itemIds,
    items: Object.freeze(items),
    sharedRng: rng,
  }
}

export function selectEnemyItem(
  sourceRng: NativeRngState,
  input: NativeLootSelectionInput,
): ItemSelectionResult {
  let rng = sourceRng
  const candidates: Array<EquipmentRecipe | null> = []
  const recipes = DOWSING_EQUIPMENT_RECIPES.filter((recipe) => (
    recipe.level >= input.arena.itemLevelMinimum
    && recipe.level <= input.arena.itemLevelMaximum
    && !input.participant.ownedRecipeIndexes.includes(recipe.sourceIndex)
  ))
  const mode = input.policies.specificItem
  if (mode === 0) {
    const rare = drawNativeInteger(rng, 15)
    rng = rare.state
    if (rare.value === 1) candidates.push(...recipes.filter(({ rarity }) => rarity === 'Rare'))
    const epic = drawNativeInteger(rng, 20)
    rng = epic.state
    if (epic.value === 1) candidates.push(...recipes.filter(({ rarity }) => rarity === 'Epic'))
  } else if (mode === 2) {
    candidates.push(...recipes.filter(({ rarity }) => rarity === 'Rare'))
  } else if (mode === 3) {
    candidates.push(...recipes.filter(({ rarity }) => rarity === 'Epic'))
  } else if (mode === 4) {
    candidates.push(...recipes.filter(({ rarity }) => rarity === 'Rare' || rarity === 'Epic'))
  }
  if (candidates.length === 0 && input.arena.mode === 1) {
    if (mode !== 3) candidates.push(...recipes.filter(({ rarity }) => rarity === 'Rare'))
    if (mode !== 2) candidates.push(...recipes.filter(({ rarity }) => rarity === 'Epic'))
  }
  if (input.arena.mode !== 1 && (mode === 0 || mode === 1)) {
    for (let index = 0; index < 110; index += 1) candidates.push(null)
  }
  if (candidates.length === 0) return { item: null, sharedRng: rng }
  const selected = drawNativeInteger(rng, candidates.length)
  rng = selected.state
  const recipe = candidates[selected.value]
  if (recipe) {
    return {
      item: equipmentRecipeItem(recipe, input.itemIds),
      sharedRng: rng,
    }
  }
  const generated = randomEquipment(
    rng,
    input.itemIds,
    input.arena.level,
    input.participant.advancedUnlocks,
  )
  return { item: generated.item, sharedRng: generated.sharedRng }
}

function selectGoodieEquipment(
  sourceRng: NativeRngState,
  itemIds: NativeLootItemIds,
  ownedRecipeIndexes: readonly number[],
): ItemSelectionResult {
  const candidates = DOWSING_EQUIPMENT_RECIPES.filter((recipe) => (
    recipe.level >= 0 && recipe.level <= 100
    && !ownedRecipeIndexes.includes(recipe.sourceIndex)
  ))
  if (candidates.length === 0) return { item: null, sharedRng: sourceRng }
  const selected = drawNativeInteger(sourceRng, candidates.length)
  return {
    item: equipmentRecipeItem(candidates[selected.value]!, itemIds),
    sharedRng: selected.state,
  }
}

function randomEquipment(
  sourceRng: NativeRngState,
  itemIds: NativeLootItemIds,
  level: number,
  advancedUnlocks: readonly boolean[],
): { readonly item: NativeLootItem; readonly sharedRng: NativeRngState } {
  const typeDraw = drawNativeInteger(sourceRng, 6)
  let rng = typeDraw.state
  const types = ['hat', 'robe', 'staff', 'wand', 'ring', 'amulet'] as const
  const equipmentType = types[typeDraw.value]!
  const selectorCount: Readonly<Record<EquipmentType, number>> = {
    amulet: 12,
    hat: 4,
    ring: 12,
    robe: 3,
    staff: 6,
    wand: 6,
  }
  const selectorDraw = drawNativeInteger(rng, selectorCount[equipmentType])
  rng = selectorDraw.state
  const selector = selectorDraw.value
  let iconTints: readonly [number, number] | undefined
  if (equipmentType === 'hat' || equipmentType === 'robe') {
    const colors = randomWearableColors(rng)
    rng = colors.sharedRng
    iconTints = colors.iconTints
  }
  const generated = generateNativeRandomEquipmentEffects(
    rng,
    equipmentType,
    level,
    { advancedUnlocks },
  )
  rng = generated.sharedRng
  const nativeTypeId: Readonly<Record<EquipmentType, number>> = {
    amulet: 7003,
    hat: 7005,
    ring: 7002,
    robe: 7006,
    staff: 7004,
    wand: 7011,
  }
  return {
    item: {
      equipmentType,
      generatedLevel: generated.itemLevel,
      iconRecords: equipmentIconRecords(equipmentType, selector),
      ...(iconTints === undefined ? {} : { iconTints }),
      id: itemIds.next(),
      kind: 'equipment',
      name: generated.name,
      nativeEffects: generated.effects,
      nativeSelector: selector,
      nativeSubtype: null,
      nativeTypeId: nativeTypeId[equipmentType],
      quantity: 1,
      rarity: null,
      recipeIndex: null,
    },
    sharedRng: rng,
  }
}

function randomWearableColors(sourceRng: NativeRngState): {
  readonly iconTints: readonly [number, number]
  readonly sharedRng: NativeRngState
} {
  const palette = [
    [1, 0, 0], [1, 0.5, 0], [1, 1, 0], [0.25, 1, 0.25], [0.25, 1, 1],
    [0.25, 0.25, 1], [1, 0.25, 1], [0.4, 0.4, 0.4], [0.8, 0.8, 0.8],
  ] as const
  const selected = drawNativeInteger(sourceRng, palette.length)
  let rng = selected.state
  let color = [...palette[selected.value]!] as [number, number, number]
  const jitterGate = drawNativeInteger(rng, 2)
  rng = jitterGate.state
  if (jitterGate.value === 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      const jitter = drawNativeFloat(rng, Math.fround(0.1), true)
      rng = jitter.state
      color[channel] = clamp01(Math.fround(color[channel]! + jitter.value))
    }
  }
  const brightGate = drawNativeInteger(rng, 4)
  rng = brightGate.state
  if (brightGate.value === 1) color = color.map((value) => clamp01(value * 1.85)) as typeof color
  const luminance = Math.fround(
    Math.fround(color[0] * Math.fround(0.30860000848770142))
    + Math.fround(color[1] * Math.fround(0.6093999743461609))
    + Math.fround(color[2] * Math.fround(0.0820000022649765)),
  )
  const primary = color.map((value) => clamp01(
    Math.fround(
      Math.fround(luminance * Math.fround(0.800000011920929))
      + Math.fround(value * Math.fround(0.19999998807907104)),
    ),
  )) as typeof color
  return {
    iconTints: [rgbTint(primary), 0xffffff],
    sharedRng: rng,
  }
}

function equipmentIconRecords(
  type: EquipmentType,
  selector: number,
): readonly number[] {
  switch (type) {
    case 'hat': return [34 + selector, 38 + selector]
    case 'robe': return [64 + selector, 67 + selector]
    case 'staff': return [72 + selector]
    case 'wand': return [78 + selector]
    case 'ring': return [52 + selector]
    case 'amulet': return [30 + Math.floor(selector / 6), 18 + selector]
  }
}

export function equipmentRecipeItem(
  recipe: EquipmentRecipe,
  itemIds: NativeLootItemIds,
): NativeLootItem {
  return {
    ...createEquipmentInventoryItem(recipe, itemIds.next()),
    ...((recipe.type === 'hat' || recipe.type === 'robe')
      ? { iconTints: recipe.iconTints }
      : {}),
    nativeSelector: equipmentSelector(recipe.type, recipe.iconRecords),
  }
}

function equipmentSelector(type: EquipmentType, records: readonly number[]): number {
  switch (type) {
    case 'hat': return records[0]! - 34
    case 'robe': return records[0]! - 64
    case 'staff': return records[0]! - 72
    case 'wand': return records[0]! - 78
    case 'ring': return records[0]! - 52
    case 'amulet': return records[1]! - 18
  }
}

export function potionItem(itemIds: NativeLootItemIds, subtype: number): NativeLootItem {
  const definitions = [
    ['health-potion', 'Health Potion', 46],
    ['mana-potion', 'Mana Potion', 47],
    ['wizard-chug', 'Wizard Chug', 48],
    ['antidote', 'Antidote', 49],
    ['mind-chug', 'Mind Chug', 50],
    ['rejuvenation-potion', 'Rejuvenation Potion', 51],
  ] as const
  const definition = definitions[subtype]
  if (!definition) throw new RangeError('native potion subtype must be within [0,5]')
  return {
    equipmentType: null,
    iconRecords: [definition[2]],
    id: itemIds.next(),
    kind: definition[0],
    name: definition[1],
    nativeSelector: subtype,
    nativeSubtype: subtype,
    nativeTypeId: 7001,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
}

export function miscItem(itemIds: NativeLootItemIds, subtype: number): NativeLootItem {
  const skillBook = NATIVE_SKILL_BOOK_DEFINITIONS.find((definition) => (
    definition.nativeSubtype === subtype
  ))
  if (skillBook) {
    return {
      ...createNativeSkillBookInventoryItem(skillBook, itemIds.next()),
      nativeSelector: subtype,
    }
  }
  const rows = [
    ['dye', 'Fabric Dye Kit', 42],
    ['key', 'Wizard Key', 43],
  ] as const
  const row = rows[subtype]
  if (!row) throw new RangeError('native miscellaneous subtype must be within [0,3]')
  return {
    equipmentType: null,
    iconRecords: [row[2]],
    id: itemIds.next(),
    kind: row[0],
    name: row[1],
    nativeSelector: subtype,
    nativeSubtype: subtype,
    nativeTypeId: 7012,
    quantity: 1,
    rarity: null,
    recipeIndex: null,
  }
}

function rgbTint(color: readonly number[]): number {
  const channel = (value: number) => Math.round(clamp01(value) * 255)
  return (channel(color[0]!) << 16) | (channel(color[1]!) << 8) | channel(color[2]!)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Math.fround(value)))
}


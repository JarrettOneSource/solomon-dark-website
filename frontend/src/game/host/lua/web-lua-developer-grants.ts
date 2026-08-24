import {
  DOWSING_EQUIPMENT_RECIPES,
  FOMENTIUS_STOCK_DEFINITIONS,
  NATIVE_SKILL_BOOK_DEFINITIONS,
  createEquipmentInventoryItem,
  createFomentiusInventoryItem,
  createNativeSkillBookInventoryItem,
  type HubInventoryItem,
} from '../../core-kernels/hub-economy.ts'
import {
  NATIVE_SKILL_CATALOG,
  NATIVE_WELD_BUILDS,
} from '../../core-kernels/player-progression.ts'

export interface WebLuaDeveloperItemDescriptor {
  readonly key: string
  readonly kind: string
  readonly name: string
  readonly native_subtype: number | null
  readonly native_type_id: number
  readonly recipe_index: number | null
}

export interface WebLuaDeveloperSkillDescriptor {
  readonly family: string
  readonly id: number
  readonly maximum_rank: number
  readonly name: string
  readonly weld_only: boolean
}

export interface WebLuaDeveloperWeldDescriptor {
  readonly component_skill_ids: readonly number[]
  readonly id: number
  readonly name: string
}

const utilityByKey = new Map<
  string,
  (typeof FOMENTIUS_STOCK_DEFINITIONS)[number]
>(FOMENTIUS_STOCK_DEFINITIONS.map((definition) => [
  definition.kind,
  definition,
] as const))
const equipmentByKey = new Map<
  string,
  (typeof DOWSING_EQUIPMENT_RECIPES)[number]
>(DOWSING_EQUIPMENT_RECIPES.map((recipe) => [
  `equipment:${recipe.sourceIndex}`,
  recipe,
] as const))
const skillBookByKey = new Map<
  string,
  (typeof NATIVE_SKILL_BOOK_DEFINITIONS)[number]
>(NATIVE_SKILL_BOOK_DEFINITIONS.map((definition) => [
  definition.key,
  definition,
] as const))

export const WEB_LUA_DEVELOPER_ITEMS: readonly WebLuaDeveloperItemDescriptor[] =
  Object.freeze([
    ...FOMENTIUS_STOCK_DEFINITIONS.map((definition) => Object.freeze({
      key: definition.kind,
      kind: definition.kind,
      name: definition.name,
      native_subtype: definition.nativeSubtype,
      native_type_id: definition.nativeTypeId,
      recipe_index: null,
    })),
    ...NATIVE_SKILL_BOOK_DEFINITIONS.map((definition) => Object.freeze({
      key: definition.key,
      kind: definition.kind,
      name: definition.name,
      native_subtype: definition.nativeSubtype,
      native_type_id: definition.nativeTypeId,
      recipe_index: null,
    })),
    ...DOWSING_EQUIPMENT_RECIPES.map((recipe) => Object.freeze({
      key: `equipment:${recipe.sourceIndex}`,
      kind: 'equipment',
      name: recipe.name,
      native_subtype: null,
      native_type_id: recipe.nativeTypeId,
      recipe_index: recipe.sourceIndex,
    })),
  ])

export const WEB_LUA_DEVELOPER_SKILLS: readonly WebLuaDeveloperSkillDescriptor[] =
  Object.freeze(NATIVE_SKILL_CATALOG
    .filter(({ config, id }) => id >= 8 && id <= 79 && (config?.mMaxLevel ?? 0) > 0)
    .map((skill) => Object.freeze({
      family: skill.family,
      id: skill.id,
      maximum_rank: skill.config?.mMaxLevel ?? 0,
      name: skill.name,
      weld_only: skill.id === 52,
    })))

export const WEB_LUA_DEVELOPER_WELDS: readonly WebLuaDeveloperWeldDescriptor[] =
  Object.freeze(NATIVE_WELD_BUILDS.map((build) => Object.freeze({
    component_skill_ids: Object.freeze([...build.componentSkillIds]),
    id: build.id,
    name: build.syntheticName,
  })))

const skillById = new Map(WEB_LUA_DEVELOPER_SKILLS.map(skill => [skill.id, skill]))
const weldById = new Map(WEB_LUA_DEVELOPER_WELDS.map(weld => [weld.id, weld]))

export function webLuaDeveloperItemExists(key: string): boolean {
  return utilityByKey.has(key) || skillBookByKey.has(key) || equipmentByKey.has(key)
}

export function webLuaDeveloperSkill(
  skillId: number,
): WebLuaDeveloperSkillDescriptor | null {
  return skillById.get(skillId) ?? null
}

export function webLuaDeveloperWeld(
  buildId: number,
): WebLuaDeveloperWeldDescriptor | null {
  return weldById.get(buildId) ?? null
}

export function createWebLuaDeveloperGrantItems(
  key: string,
  quantity: number,
): readonly HubInventoryItem[] | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return null
  const utility = utilityByKey.get(key)
  if (utility) {
    return utility.nativeTypeId === 7001
      ? [createFomentiusInventoryItem(utility, 0, quantity)]
      : Array.from({ length: quantity }, () => createFomentiusInventoryItem(utility, 0))
  }
  const skillBook = skillBookByKey.get(key)
  if (skillBook) {
    return Array.from(
      { length: quantity },
      () => createNativeSkillBookInventoryItem(skillBook, 0),
    )
  }
  const equipment = equipmentByKey.get(key)
  return equipment
    ? Array.from({ length: quantity }, () => createEquipmentInventoryItem(equipment, 0))
    : null
}

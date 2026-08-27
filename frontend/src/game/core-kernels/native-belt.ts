import {
  findInventoryItem,
  projectInventoryItems,
  type EquipmentSlot,
  type HubEconomyState,
  type HubInventoryItem,
} from './hub-economy.ts'
import {
  isNativeBeltSkill,
  nativeSkillCategory,
  type NativeBeltSkillId,
  type PlayerSkillBookComponent,
} from './player-progression.ts'

export const NATIVE_BELT_SLOT_COUNT = 8
export const NATIVE_HEALTH_BELT_SLOT = 3
export const NATIVE_MANA_BELT_SLOT = 4

export const NATIVE_BELT_ITEM_TYPE_IDS = Object.freeze([
  7001, 7002, 7003, 7004, 7005, 7006, 7008, 7009, 7010, 7011,
] as const)

export type NativeBeltItemTypeId = typeof NATIVE_BELT_ITEM_TYPE_IDS[number]

export interface NativeBeltSkillEntry {
  readonly kind: 'skill'
  readonly skillId: NativeBeltSkillId
}

export type NativeBeltPotionAliasEntry =
  | { readonly kind: 'health-potion' }
  | { readonly kind: 'mana-potion' }

export interface NativeBeltItemEntry {
  readonly itemId: number
  readonly kind: 'item'
  readonly nativeTypeId: NativeBeltItemTypeId
}

export type NativeBeltEntry =
  | NativeBeltItemEntry
  | NativeBeltPotionAliasEntry
  | NativeBeltSkillEntry

export type PlayerBeltComponent = readonly [
  NativeBeltEntry | null,
  NativeBeltEntry | null,
  NativeBeltEntry | null,
  NativeBeltEntry | null,
  NativeBeltEntry | null,
  NativeBeltEntry | null,
  NativeBeltEntry | null,
  NativeBeltEntry | null,
]

export interface NativeBeltPotionProjection {
  readonly count: number
  readonly item: HubInventoryItem | null
}

export function createNativePlayerBelt(
  skillBook: PlayerSkillBookComponent,
): PlayerBeltComponent {
  const secondarySkillId = skillBook.learnedSkillOrder.find((skillId) => (
    nativeSkillCategory(skillId) === 2
  ))
  if (secondarySkillId === undefined || !isNativeBeltSkill(secondarySkillId)) {
    throw new Error('fresh native belt requires one learned secondary skill')
  }
  const entries: Array<NativeBeltEntry | null> = new Array(NATIVE_BELT_SLOT_COUNT).fill(null)
  entries[0] = skillEntry(secondarySkillId)
  entries[NATIVE_HEALTH_BELT_SLOT] = Object.freeze({ kind: 'health-potion' })
  entries[NATIVE_MANA_BELT_SLOT] = Object.freeze({ kind: 'mana-potion' })
  return freezeNativeBelt(entries)
}

export function migrateSkillQuickbarToNativeBelt(
  quickbar: readonly (number | null)[],
): PlayerBeltComponent {
  if (quickbar.length !== NATIVE_BELT_SLOT_COUNT) {
    throw new RangeError('legacy skill quickbar requires exactly eight slots')
  }
  const entries = quickbar.map((skillId): NativeBeltEntry | null => {
    if (skillId === null) return null
    if (!isNativeBeltSkill(skillId)) {
      throw new RangeError(`legacy quickbar skill ${skillId} is not belt-eligible`)
    }
    return skillEntry(skillId)
  })
  entries[NATIVE_HEALTH_BELT_SLOT] ??= Object.freeze({ kind: 'health-potion' })
  entries[NATIVE_MANA_BELT_SLOT] ??= Object.freeze({ kind: 'mana-potion' })
  return freezeNativeBelt(entries)
}

export function bindNativeBeltSkill(
  source: PlayerBeltComponent,
  skillBook: PlayerSkillBookComponent,
  skillId: number | null,
  slot: number,
): PlayerBeltComponent {
  assertBeltSlot(slot)
  if (skillId !== null && !isNativeBeltSkill(skillId)) {
    throw new RangeError(`skill ${skillId} is not a native belt skill`)
  }
  if (skillId !== null && (skillBook.permanentRanks[skillId] ?? 0) < 1) {
    throw new Error(`belt skill ${skillId} is not learned`)
  }
  const entries = [...source]
  entries[slot] = skillId === null ? null : skillEntry(skillId)
  return freezeNativeBelt(entries)
}

export function bindNativeBeltItem(
  source: PlayerBeltComponent,
  economy: HubEconomyState,
  itemId: number,
  slot: number,
): PlayerBeltComponent {
  assertBeltSlot(slot)
  const item = nativeBeltOwnedItem(economy, itemId)
  if (!item) throw new Error(`belt item ${itemId} is not owned`)
  if (!nativeInventoryItemCanBindToBelt(item)) {
    throw new RangeError(`item type ${item.nativeTypeId} cannot bind to the native belt`)
  }
  const entry = item.nativeTypeId === 7001 && item.nativeSubtype === 0
    ? Object.freeze({ kind: 'health-potion' } as const)
    : item.nativeTypeId === 7001 && item.nativeSubtype === 1
      ? Object.freeze({ kind: 'mana-potion' } as const)
      : Object.freeze({
          itemId: item.id,
          kind: 'item',
          nativeTypeId: item.nativeTypeId as NativeBeltItemTypeId,
        } as const)
  const entries = [...source]
  entries[slot] = entry
  return freezeNativeBelt(entries)
}

export function autofillNewlyLearnedNativeBeltSkills(
  source: PlayerBeltComponent,
  previous: PlayerSkillBookComponent,
  current: PlayerSkillBookComponent,
): PlayerBeltComponent {
  let belt = source
  for (const skillId of current.learnedSkillOrder) {
    if ((previous.permanentRanks[skillId] ?? 0) > 0) continue
    if ((current.permanentRanks[skillId] ?? 0) < 1) continue
    const category = nativeSkillCategory(skillId)
    if ((category !== 1 && category !== 2) || !isNativeBeltSkill(skillId)) continue
    const slot = belt.indexOf(null)
    if (slot < 0) return belt
    const entries = [...belt]
    entries[slot] = skillEntry(skillId)
    belt = freezeNativeBelt(entries)
  }
  return belt
}

export function refreshNativePlayerBelt(
  source: PlayerBeltComponent,
  skillBook: PlayerSkillBookComponent,
  economy: HubEconomyState,
): PlayerBeltComponent {
  let changed = false
  const entries = source.map((entry): NativeBeltEntry | null => {
    if (entry === null || entry.kind === 'health-potion' || entry.kind === 'mana-potion') {
      return entry
    }
    if (entry.kind === 'skill') {
      const retained = isNativeBeltSkill(entry.skillId)
        && (skillBook.permanentRanks[entry.skillId] ?? 0) > 0
      if (retained) return entry
      changed = true
      return null
    }
    const item = nativeBeltOwnedItem(economy, entry.itemId)
    const retained = item !== null
      && item.nativeTypeId === entry.nativeTypeId
      && nativeInventoryItemCanBindToBelt(item)
    if (retained) return entry
    changed = true
    return null
  })
  return changed ? freezeNativeBelt(entries) : source
}

export function nativeInventoryItemCanBindToBelt(
  item: Pick<HubInventoryItem, 'kind' | 'nativeSubtype' | 'nativeTypeId'>,
): boolean {
  if (item.kind === 'mod-item' || item.kind === 'mod-potion') return false
  if (!(NATIVE_BELT_ITEM_TYPE_IDS as readonly number[]).includes(item.nativeTypeId)) return false
  return item.nativeTypeId !== 7001
    || (item.nativeSubtype !== null && item.nativeSubtype >= 0 && item.nativeSubtype <= 5)
}

export function nativeBeltOwnedItem(
  economy: Pick<HubEconomyState, 'backpack' | 'equipment'>,
  itemId: number,
): HubInventoryItem | null {
  const backpack = findInventoryItem(economy.backpack, itemId)
  if (backpack) return backpack
  for (const item of equippedItems(economy)) {
    if (item?.id === itemId) return item
  }
  return null
}

export function nativeBeltEntryItem(
  entry: NativeBeltEntry,
  economy: Pick<HubEconomyState, 'backpack' | 'equipment'>,
): HubInventoryItem | null {
  if (entry.kind === 'skill') return null
  if (entry.kind === 'health-potion') return nativeBeltPotionProjection(economy.backpack, 0).item
  if (entry.kind === 'mana-potion') return nativeBeltPotionProjection(economy.backpack, 1).item
  return nativeBeltOwnedItem(economy, entry.itemId)
}

export function nativeBeltPotionProjection(
  backpack: readonly HubInventoryItem[],
  subtype: 0 | 1,
): NativeBeltPotionProjection {
  const potions = projectInventoryItems(backpack).filter(({ item }) => (
    item.nativeTypeId === 7001 && item.nativeSubtype === subtype
  ))
  return Object.freeze({
    count: potions.reduce((count, { item }) => count + item.quantity, 0),
    item: potions[0]?.item ?? null,
  })
}

export function nativeBeltSkillProjection(
  source: PlayerBeltComponent,
): readonly (NativeBeltSkillId | null)[] {
  return Object.freeze(source.map((entry) => entry?.kind === 'skill' ? entry.skillId : null))
}

export function nativeBeltEquipmentSlots(
  item: Pick<HubInventoryItem, 'equipmentType'>,
  thirdRingUnlocked: boolean,
): readonly EquipmentSlot[] {
  switch (item.equipmentType) {
    case 'amulet': return ['amulet']
    case 'hat': return ['hat']
    case 'robe': return ['robe']
    case 'staff':
    case 'wand': return ['weapon']
    case 'ring': return thirdRingUnlocked
      ? ['ring-0', 'ring-1', 'ring-2']
      : ['ring-0', 'ring-1']
    case null: return []
  }
}

export function freezeNativeBelt(
  entries: readonly (NativeBeltEntry | null)[],
): PlayerBeltComponent {
  if (entries.length !== NATIVE_BELT_SLOT_COUNT) {
    throw new RangeError('native belt requires exactly eight slots')
  }
  return Object.freeze([...entries]) as PlayerBeltComponent
}

export function nativePlayerBeltsEqual(
  left: PlayerBeltComponent,
  right: PlayerBeltComponent,
): boolean {
  return left === right || left.every((entry, index) => {
    const other = right[index]
    if (entry === other) return true
    if (entry === null || other === null || entry.kind !== other.kind) return false
    if (entry.kind === 'skill' && other.kind === 'skill') return entry.skillId === other.skillId
    if (entry.kind === 'item' && other.kind === 'item') {
      return entry.itemId === other.itemId && entry.nativeTypeId === other.nativeTypeId
    }
    return true
  })
}

function skillEntry(skillId: NativeBeltSkillId): NativeBeltSkillEntry {
  return Object.freeze({ kind: 'skill', skillId })
}

function assertBeltSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= NATIVE_BELT_SLOT_COUNT) {
    throw new RangeError(`native belt slot ${slot} is outside 0..7`)
  }
}

function equippedItems(
  economy: Pick<HubEconomyState, 'equipment'>,
): readonly (HubInventoryItem | null)[] {
  return [
    economy.equipment.hat,
    economy.equipment.robe,
    economy.equipment.weapon,
    economy.equipment.amulet,
    ...economy.equipment.rings,
  ]
}

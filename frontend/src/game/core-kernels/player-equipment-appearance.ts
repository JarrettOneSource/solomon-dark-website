import type { HubEquipmentState, HubInventoryItem } from './hub-economy.ts'
import type { WizardElement } from './player-character.ts'

export interface PlayerEquipmentTintedSelector {
  readonly primaryTint: number
  readonly secondaryTint: number
  readonly selector: number
}

export interface PlayerDeathEquipmentAppearance {
  readonly hat: PlayerEquipmentTintedSelector
  readonly robe: PlayerEquipmentTintedSelector
  readonly weapon: {
    readonly kind: 'staff' | 'wand'
    readonly selector: number
  }
}

export interface PlayerLivingEquipmentAppearance {
  readonly hat: PlayerEquipmentTintedSelector | null
  readonly robe: PlayerEquipmentTintedSelector | null
  readonly weapon: {
    readonly kind: 'staff' | 'wand'
    readonly selector: number
  } | null
}

const ELEMENT_DEATH_PALETTES: Readonly<Record<WizardElement, readonly [number, number]>> = {
  air: [0xa0c3c3, 0xffffff],
  earth: [0x90b390, 0xffffff],
  ether: [0x886688, 0xffffff],
  fire: [0x998077, 0xffffff],
  water: [0x5e6e81, 0xffffff],
}

const ROBE_DEATH_APPEARANCES: Readonly<Record<number, PlayerEquipmentTintedSelector>> = {
  1: { primaryTint: 0x191919, secondaryTint: 0x80ffff, selector: 1 },
  7: { primaryTint: 0xc0c0c0, secondaryTint: 0xffffff, selector: 2 },
  12: { primaryTint: 0xff19ff, secondaryTint: 0xffffff, selector: 0 },
  17: { primaryTint: 0x19ffff, secondaryTint: 0xffffff, selector: 2 },
  21: { primaryTint: 0xff0000, secondaryTint: 0xffffff, selector: 0 },
  25: { primaryTint: 0x19ff19, secondaryTint: 0xc8ffc8, selector: 2 },
  46: { primaryTint: 0xffffff, secondaryTint: 0xffffff, selector: 0 },
}

const HAT_DEATH_APPEARANCES: Readonly<Record<number, PlayerEquipmentTintedSelector>> = {
  5: { primaryTint: 0x191919, secondaryTint: 0xff80ff, selector: 0 },
  6: { primaryTint: 0xc0c0c0, secondaryTint: 0xffffff, selector: 2 },
  11: { primaryTint: 0xff19ff, secondaryTint: 0xffffff, selector: 0 },
  16: { primaryTint: 0x19ffff, secondaryTint: 0xffffff, selector: 3 },
  20: { primaryTint: 0xff0000, secondaryTint: 0xffffff, selector: 2 },
  40: { primaryTint: 0xffffff, secondaryTint: 0xffffff, selector: 3 },
}

const WEAPON_DEATH_APPEARANCES: Readonly<Record<number, {
  readonly kind: 'staff' | 'wand'
  readonly selector: number
}>> = {
  2: { kind: 'wand', selector: 2 },
  8: { kind: 'staff', selector: 1 },
  13: { kind: 'wand', selector: 4 },
  18: { kind: 'staff', selector: 3 },
  28: { kind: 'wand', selector: 3 },
  33: { kind: 'staff', selector: 0 },
  34: { kind: 'staff', selector: 2 },
  41: { kind: 'wand', selector: 5 },
  42: { kind: 'wand', selector: 5 },
  43: { kind: 'wand', selector: 5 },
  44: { kind: 'wand', selector: 5 },
  45: { kind: 'wand', selector: 5 },
}

export function playerDeathEquipmentAppearance(
  element: WizardElement,
  equipment: Pick<HubEquipmentState, 'hat' | 'robe' | 'weapon'>,
): PlayerDeathEquipmentAppearance {
  const [primaryTint, secondaryTint] = ELEMENT_DEATH_PALETTES[element]
  return {
    hat: deathTintedAppearance(
      equipment.hat,
      'hat',
      HAT_DEATH_APPEARANCES,
      { primaryTint, secondaryTint, selector: 0 },
    ),
    robe: deathTintedAppearance(
      equipment.robe,
      'robe',
      ROBE_DEATH_APPEARANCES,
      { primaryTint, secondaryTint, selector: 0 },
    ),
    weapon: deathWeaponAppearance(equipment.weapon),
  }
}

export function playerLivingEquipmentAppearance(
  element: WizardElement,
  equipment: Pick<HubEquipmentState, 'hat' | 'robe' | 'weapon'>,
): PlayerLivingEquipmentAppearance {
  const [primaryTint, secondaryTint] = ELEMENT_DEATH_PALETTES[element]
  return {
    hat: equipment.hat === null
      ? null
      : deathTintedAppearance(
          equipment.hat,
          'hat',
          HAT_DEATH_APPEARANCES,
          { primaryTint, secondaryTint, selector: 0 },
        ),
    robe: equipment.robe === null
      ? null
      : deathTintedAppearance(
          equipment.robe,
          'robe',
          ROBE_DEATH_APPEARANCES,
          { primaryTint, secondaryTint, selector: 0 },
        ),
    weapon: equipment.weapon === null
      ? null
      : deathWeaponAppearance(equipment.weapon),
  }
}

function deathTintedAppearance(
  item: HubInventoryItem | null,
  expectedType: 'hat' | 'robe',
  appearances: Readonly<Record<number, PlayerEquipmentTintedSelector>>,
  fallback: PlayerEquipmentTintedSelector,
): PlayerEquipmentTintedSelector {
  if (item === null) return fallback
  if (item.recipeIndex !== null) return requiredDeathAppearance(item, expectedType, appearances)
  if (item.nativeSelector === undefined) return fallback
  const tints = item.iconTints
  if (
    item.equipmentType !== expectedType
    || tints === undefined
    || tints[0] === null
    || tints[1] === null
  ) throw new Error(`Unsupported generated native ${expectedType} death appearance`)
  return { primaryTint: tints[0], secondaryTint: tints[1], selector: item.nativeSelector }
}

function deathWeaponAppearance(
  item: HubInventoryItem | null,
): { readonly kind: 'staff' | 'wand'; readonly selector: number } {
  if (item === null) return { kind: 'staff', selector: 0 }
  if (item.recipeIndex !== null) return requiredWeaponDeathAppearance(item)
  if (item.nativeSelector === undefined) return { kind: 'staff', selector: 0 }
  if (item.equipmentType !== 'staff' && item.equipmentType !== 'wand') {
    throw new Error('Unsupported generated native death weapon appearance')
  }
  return { kind: item.equipmentType, selector: item.nativeSelector }
}

function requiredDeathAppearance(
  item: HubInventoryItem,
  expectedType: 'hat' | 'robe',
  appearances: Readonly<Record<number, PlayerEquipmentTintedSelector>>,
): PlayerEquipmentTintedSelector {
  const appearance = item.recipeIndex === null ? undefined : appearances[item.recipeIndex]
  if (item.equipmentType !== expectedType || appearance === undefined) {
    throw new Error(`Unsupported native ${expectedType} death appearance recipe ${item.recipeIndex}`)
  }
  const tints = item.iconTints
  if (tints === undefined) return appearance
  if (tints[0] === null || tints[1] === null) {
    throw new Error(`Unsupported native ${expectedType} dye appearance recipe ${item.recipeIndex}`)
  }
  return {
    ...appearance,
    primaryTint: tints[0],
    secondaryTint: tints[1],
  }
}

function requiredWeaponDeathAppearance(item: HubInventoryItem): {
  readonly kind: 'staff' | 'wand'
  readonly selector: number
} {
  const appearance = item.recipeIndex === null
    ? undefined
    : WEAPON_DEATH_APPEARANCES[item.recipeIndex]
  if (appearance === undefined || item.equipmentType !== appearance.kind) {
    throw new Error(`Unsupported native death weapon recipe ${item.recipeIndex}`)
  }
  return appearance
}

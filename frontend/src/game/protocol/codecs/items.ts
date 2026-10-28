import {
  DOWSING_EQUIPMENT_RECIPES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_TYPES,
  type EquipmentSlot,
  type EquipmentType,
  HUB_ITEM_KINDS,
  HUB_SACK_CHILD_REPLICATION_LIMIT,
  HUB_SACK_REPLICATION_DEPTH_LIMIT,
  type HubInventoryItem,
  type HubItemKind,
  type ModConsumableContent,
  type ModEquipmentAffix,
  type ModItemContent,
  type ModSpriteFrame,
  type ModWearableContent,
  modItemInventoryIdentityIsValid,
  modWearableContentIsValid,
  projectInventoryRootSlots,
} from '../../core-kernels/hub-economy.ts'
import { NATIVE_TUTORIAL_AMULET_IDENTITY } from '../../core-kernels/native-tutorial.ts'
import type { ProtocolPlayerEconomy } from '../game-state.ts'
import {
  GameProtocolError,
  array,
  boolean,
  boundedInteger,
  boundedString,
  finite,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
} from './values.ts'

export function equipmentSlot(value: unknown, field: string): EquipmentSlot {
  const slot = limitedString(value, field, 16)
  if (!(EQUIPMENT_SLOTS as readonly string[]).includes(slot)) {
    throw new GameProtocolError(`${field} is not supported`)
  }
  return slot as EquipmentSlot
}

export function inventoryItems(
  value: unknown,
  field: string,
  maximum: number,
): readonly HubInventoryItem[] {
  return limitedArray(value, field, maximum).map((item, index) => (
    inventoryItem(item, `${field}[${index}]`)
  ))
}

export function protocolInventoryRootSlotsAreValid(
  items: readonly HubInventoryItem[],
  capacity: number,
): boolean {
  const slots = projectInventoryRootSlots(items).map(({ slot }) => slot)
  return new Set(slots).size === slots.length
    && slots.every((slot) => Number.isSafeInteger(slot) && slot >= 0 && slot < capacity)
    && items.every((item) => item.contents === undefined || protocolInventoryRootSlotsAreValid(
      item.contents,
      HUB_SACK_CHILD_REPLICATION_LIMIT,
    ))
}

export function flattenInventoryItem(item: HubInventoryItem): readonly HubInventoryItem[] {
  return [item, ...(item.contents ?? []).flatMap(flattenInventoryItem)]
}

export function inventoryItem(
  value: unknown,
  field: string,
  extraKeys: readonly string[] = [],
  depth = 0,
): HubInventoryItem {
  const source = record(value, field)
  onlyKeys(source, field, [
    'contents',
    'equipmentType',
    'generatedLevel',
    'iconRecords',
    'iconTints',
    'id',
    'inventorySlot',
    'itemContentId',
    'kind',
    'modContent',
    'modAffixes',
    'modItemContent',
    'name',
    'nativeSubtype',
    'nativeSelector',
    'nativeEffects',
    'nativeTypeId',
    'quantity',
    'rarity',
    'recipeIndex',
    ...extraKeys,
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(HUB_ITEM_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const equipmentType = source.equipmentType === null
    ? null
    : limitedString(source.equipmentType, `${field}.equipmentType`, 16)
  if (
    equipmentType !== null
    && !(EQUIPMENT_TYPES as readonly string[]).includes(equipmentType)
  ) throw new GameProtocolError(`${field}.equipmentType is not supported`)
  const recipeIndex = source.recipeIndex === null
    ? null
    : boundedInteger(
        source.recipeIndex,
        `${field}.recipeIndex`,
        0,
        DOWSING_EQUIPMENT_RECIPES.length - 1,
      )
  const rarity = source.rarity === null
    ? null
    : limitedString(source.rarity, `${field}.rarity`, 8)
  if (rarity !== null && rarity !== 'Epic' && rarity !== 'Rare') {
    throw new GameProtocolError(`${field}.rarity is not supported`)
  }
  const nativeSubtype = source.nativeSubtype === null
    ? null
    : boundedInteger(source.nativeSubtype, `${field}.nativeSubtype`, 0, 261)
  const inventorySlot = source.inventorySlot === undefined
    ? undefined
    : nonnegativeInteger(source.inventorySlot, `${field}.inventorySlot`)
  const modContent = source.modContent === undefined
    ? undefined
    : modConsumableContent(source.modContent, `${field}.modContent`)
  const modItemContent = source.modItemContent === undefined
    ? undefined
    : modItemContentValue(source.modItemContent, `${field}.modItemContent`)
  const modAffixes = source.modAffixes === undefined
    ? undefined
    : limitedArray(source.modAffixes, `${field}.modAffixes`, 8).map((value, index): ModEquipmentAffix => {
        const affixField = `${field}.modAffixes[${index}]`
        const affix = record(value, affixField)
        onlyKeys(affix, affixField, ['contentId', 'modId', 'modifiers', 'name'])
        const contentId = limitedString(affix.contentId, `${affixField}.contentId`, 19)
        if (!/^[1-9][0-9]{0,18}$/.test(contentId)) throw new GameProtocolError(`${affixField} is invalid`)
        return {
          contentId,
          modId: limitedString(affix.modId, `${affixField}.modId`, 128),
          modifiers: limitedArray(affix.modifiers, `${affixField}.modifiers`, 64).map((value, modifierIndex) => {
            const modifierField = `${affixField}.modifiers[${modifierIndex}]`
            const modifier = record(value, modifierField)
            onlyKeys(modifier, modifierField, ['key', 'operation', 'value'])
            const operation = limitedString(modifier.operation, `${modifierField}.operation`, 16)
            if (operation !== 'add' && operation !== 'multiply' && operation !== 'set') {
              throw new GameProtocolError(`${modifierField}.operation is invalid`)
            }
            return {
              key: limitedString(modifier.key, `${modifierField}.key`, 128),
              operation,
              value: finite(modifier.value, `${modifierField}.value`),
            }
          }),
          name: limitedString(affix.name, `${affixField}.name`, 128),
        }
      })
  if (modAffixes && new Set(modAffixes.map(affix => affix.contentId)).size !== modAffixes.length) {
    throw new GameProtocolError(`${field}.modAffixes contains duplicates`)
  }
  const iconRecords = limitedArray(source.iconRecords, `${field}.iconRecords`, 2)
    .map((recordIndex, index) => boundedInteger(
      recordIndex,
      `${field}.iconRecords[${index}]`,
      0,
      83,
    ))
  if (iconRecords.length < 1 && modContent === undefined && modItemContent === undefined) {
    throw new GameProtocolError(`${field}.iconRecords is empty`)
  }
  const name = limitedString(source.name, `${field}.name`, 128)
  const nativeTypeId = boundedInteger(source.nativeTypeId, `${field}.nativeTypeId`, 7001, 7013)
  const quantity = boundedInteger(source.quantity, `${field}.quantity`, 1, 9_999)
  const generatedLevel = source.generatedLevel === undefined
    ? undefined
    : boundedInteger(source.generatedLevel, `${field}.generatedLevel`, 0, 100)
  const nativeSelector = source.nativeSelector === undefined
    ? undefined
    : boundedInteger(source.nativeSelector, `${field}.nativeSelector`, 0, 255)
  const iconTints = source.iconTints === undefined
    ? undefined
    : (() => {
        const values = array(source.iconTints, `${field}.iconTints`)
        if (values.length !== 2) {
          throw new GameProtocolError(`${field}.iconTints must contain two values`)
        }
        return values.map((value, index) => value === null
          ? null
          : integerWithin(value, `${field}.iconTints[${index}]`, 0, 0xffffff)) as [
            number | null,
            number | null,
          ]
      })()
  const nativeEffects = source.nativeEffects === undefined
    ? undefined
    : limitedArray(source.nativeEffects, `${field}.nativeEffects`, 2).map((value, index) => {
        const effectField = `${field}.nativeEffects[${index}]`
        const effect = record(value, effectField)
        onlyKeys(effect, effectField, ['kind', 'magnitude', 'operator', 'target'])
        return {
          kind: boundedInteger(effect.kind, `${effectField}.kind`, 0, 38),
          magnitude: finite(effect.magnitude, `${effectField}.magnitude`),
          operator: integerWithin(effect.operator, `${effectField}.operator`, 0, 2) as 0 | 1 | 2,
          target: boundedInteger(effect.target, `${effectField}.target`, 0, 82),
        }
      })
  if (depth > HUB_SACK_REPLICATION_DEPTH_LIMIT) {
    throw new GameProtocolError(`${field} exceeds the bounded native Sack depth`)
  }
  const contents = source.contents === undefined
    ? undefined
    : limitedArray(
        source.contents,
        `${field}.contents`,
        HUB_SACK_CHILD_REPLICATION_LIMIT,
      ).map((item, index) => (
        inventoryItem(item, `${field}.contents[${index}]`, [], depth + 1)
      ))
  if (kind !== 'equipment') {
    if (
      equipmentType !== null
      || recipeIndex !== null
      || rarity !== null
      || generatedLevel !== undefined
      || nativeEffects !== undefined
      || iconTints !== undefined
      || modAffixes !== undefined
      || (nativeSelector !== undefined && nativeSelector !== nativeSubtype)
    ) {
      throw new GameProtocolError(`${field} equipment identity is inconsistent`)
    }
  } else if (equipmentType === null) {
    throw new GameProtocolError(`${field} equipment identity is inconsistent`)
  } else if (recipeIndex === null && modItemContent?.wearable === undefined) {
    const authored = generatedLevel === undefined
      && nativeSelector !== undefined
    if (authored) {
      if (
        rarity !== null
        || nativeSubtype !== null
        || quantity !== 1
        || equipmentType !== NATIVE_TUTORIAL_AMULET_IDENTITY.equipmentType
        || name !== NATIVE_TUTORIAL_AMULET_IDENTITY.name
        || nativeTypeId !== NATIVE_TUTORIAL_AMULET_IDENTITY.nativeTypeId
        || nativeSelector !== NATIVE_TUTORIAL_AMULET_IDENTITY.nativeSelector
        || iconRecords.length !== NATIVE_TUTORIAL_AMULET_IDENTITY.iconRecords.length
        || iconRecords.some((record, index) => (
          record !== NATIVE_TUTORIAL_AMULET_IDENTITY.iconRecords[index]
        ))
        || iconTints === undefined
        || iconTints.some((tint, index) => (
          tint !== NATIVE_TUTORIAL_AMULET_IDENTITY.iconTints[index]
        ))
        || nativeEffects === undefined
        || nativeEffects.length !== NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects.length
        || nativeEffects.some((effect, index) => {
          const expected = NATIVE_TUTORIAL_AMULET_IDENTITY.nativeEffects[index]
          return expected === undefined
            || effect.kind !== expected.kind
            || effect.magnitude !== expected.magnitude
            || effect.operator !== expected.operator
            || effect.target !== expected.target
        })
      ) throw new GameProtocolError(`${field} authored equipment identity is inconsistent`)
    } else {
      const starter = generatedLevel === undefined
        && nativeSelector === undefined
        && nativeEffects === undefined
      if (starter && (
        rarity !== null
        || nativeSubtype !== null
        || quantity !== 1
        || !isStarterEquipmentIdentity(equipmentType as EquipmentType, name, nativeTypeId, iconRecords)
      )) throw new GameProtocolError(`${field} starter equipment identity is inconsistent`)
      if (!starter && (
        rarity !== null
        || nativeSubtype !== null
        || quantity !== 1
        || generatedLevel === undefined
        || nativeSelector === undefined
        || nativeEffects === undefined
        || nativeEffects.length < 1
        || ((equipmentType === 'hat' || equipmentType === 'robe')
          ? iconTints === undefined || iconTints.some((tint) => tint === null)
          : iconTints !== undefined)
        || !isGeneratedEquipmentIdentity(
          equipmentType as EquipmentType,
          nativeTypeId,
          nativeSelector,
          iconRecords,
        )
      )) throw new GameProtocolError(`${field} generated equipment identity is inconsistent`)
    }
  } else if (recipeIndex !== null) {
    const recipe = DOWSING_EQUIPMENT_RECIPES[recipeIndex]!
    const selector = nativeEquipmentSelector(recipe.type, recipe.iconRecords)
    if (
      rarity === null
      || generatedLevel !== undefined
      || nativeEffects !== undefined
      || name !== recipe.name
      || equipmentType !== recipe.type
      || nativeTypeId !== recipe.nativeTypeId
      || rarity !== recipe.rarity
      || iconRecords.length !== recipe.iconRecords.length
      || iconRecords.some((record, index) => record !== recipe.iconRecords[index])
      || (nativeSelector !== undefined && nativeSelector !== selector)
      || (iconTints !== undefined && (
        recipe.type === 'hat' || recipe.type === 'robe'
          ? iconTints.some((tint) => tint === null)
          : iconTints.some((tint, index) => tint !== recipe.iconTints[index])
      ))
    ) throw new GameProtocolError(`${field} named equipment identity is inconsistent`)
  }
  if (kind === 'mod-potion') {
    if (
      modContent === undefined
      || nativeTypeId !== 7001
      || nativeSubtype === null
      || nativeSubtype < 6
      || iconRecords.length !== 0
    ) throw new GameProtocolError(`${field} mod potion identity is inconsistent`)
  } else if (modContent !== undefined) {
    throw new GameProtocolError(`${field}.modContent requires kind mod-potion`)
  }
  if (
    contents !== undefined
    && (kind !== 'sack' || nativeTypeId !== 7008 || nativeSubtype !== 0)
  ) throw new GameProtocolError(`${field}.contents requires an Item_Sack`)
  const item: HubInventoryItem = {
    ...(contents === undefined ? {} : { contents }),
    equipmentType: equipmentType as EquipmentType | null,
    ...(generatedLevel === undefined ? {} : { generatedLevel }),
    iconRecords,
    ...(iconTints === undefined ? {} : { iconTints }),
    id: positiveInteger(source.id, `${field}.id`),
    ...(inventorySlot === undefined ? {} : { inventorySlot }),
    kind: kind as HubItemKind,
    ...(modContent === undefined ? {} : { modContent }),
    ...(modAffixes === undefined ? {} : { modAffixes }),
    ...(modItemContent === undefined ? {} : { modItemContent }),
    name,
    nativeSubtype,
    ...(nativeSelector === undefined ? {} : { nativeSelector }),
    ...(nativeEffects === undefined ? {} : { nativeEffects }),
    nativeTypeId,
    quantity,
    rarity,
    recipeIndex,
  }
  if (!modItemInventoryIdentityIsValid(item)) {
    throw new GameProtocolError(`${field} invalid mod item`)
  }
  return item
}

export function modConsumableContent(value: unknown, field: string): ModConsumableContent {
  const source = record(value, field)
  onlyKeys(source, field, [
    'consumeVfx', 'contentId', 'description', 'durationMs', 'icon', 'key', 'modId',
  ])
  const identity = modContentIdentity(source, field)
  const consumeVfx = source.consumeVfx === null
    ? null
    : (() => {
        const vfx = record(source.consumeVfx, `${field}.consumeVfx`)
        onlyKeys(vfx, `${field}.consumeVfx`, ['color', 'kind'])
        if (vfx.kind !== 'spell_glow') {
          throw new GameProtocolError(`${field}.consumeVfx.kind is unsupported`)
        }
        const values = array(vfx.color, `${field}.consumeVfx.color`)
        if (values.length !== 4) {
          throw new GameProtocolError(`${field}.consumeVfx.color must contain RGBA`)
        }
        const color = values.map((component, index) => {
          const number = finite(component, `${field}.consumeVfx.color[${index}]`)
          if (number < 0 || number > 1) {
            throw new GameProtocolError(`${field}.consumeVfx.color[${index}] must be within 0..1`)
          }
          return number
        }) as [number, number, number, number]
        return { color, kind: 'spell_glow' as const }
      })()
  return {
    consumeVfx,
    ...identity,
    durationMs: boundedInteger(source.durationMs, `${field}.durationMs`, 0, 86_400_000),
  }
}

function modItemContentValue(value: unknown, field: string): ModItemContent {
  const source = record(value, field)
  onlyKeys(source, field, [
    'contentId', 'description', 'icon', 'iconTrimImagePath', 'key', 'modId', 'stackMaximum', 'wearable',
  ])
  const iconTrimImagePath = source.iconTrimImagePath === undefined
    ? undefined
    : limitedString(source.iconTrimImagePath, field, 240)
  const wearable = source.wearable === undefined
    ? undefined
    : modWearableContent(source.wearable, field)
  const stackMaximum = boundedInteger(source.stackMaximum, `${field}.stackMaximum`, 1, 9_999)
  if ((iconTrimImagePath !== undefined && !wearable) || (wearable && (
    stackMaximum !== 1 || !modWearableContentIsValid(wearable, iconTrimImagePath)
  ))) {
    throw new GameProtocolError(`${field} invalid mod item`)
  }
  return {
    ...modContentIdentity(source, field),
    ...(iconTrimImagePath === undefined ? {} : { iconTrimImagePath }),
    stackMaximum,
    ...(wearable === undefined ? {} : { wearable }),
  }
}

function modContentIdentity(
  source: Record<string, unknown>,
  field: string,
): Omit<ModItemContent, 'stackMaximum'> {
  const contentId = limitedString(source.contentId, `${field}.contentId`, 19)
  if (!/^[1-9][0-9]{0,18}$/.test(contentId)) {
    throw new GameProtocolError(`${field}.contentId is invalid`)
  }
  const modId = limitedString(source.modId, `${field}.modId`, 128)
  const key = limitedString(source.key, `${field}.key`, 128)
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(modId) ||
      !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(key)) {
    throw new GameProtocolError(`${field} has a noncanonical content key`)
  }
  const iconSource = record(source.icon, `${field}.icon`)
  onlyKeys(iconSource, `${field}.icon`, ['atlasId', 'frame', 'frameIndex', 'imagePath'])
  const atlasId = limitedString(iconSource.atlasId, `${field}.icon.atlasId`, 257)
  const imagePath = limitedString(iconSource.imagePath, `${field}.icon.imagePath`, 240)
  if (!atlasId.startsWith(`${modId}:`) || !/^(?:art|sprites)\/.+\.png$/.test(imagePath)) {
    throw new GameProtocolError(`${field}.icon is outside its mod asset ownership`)
  }
  return {
    contentId,
    description: boundedString(source.description, `${field}.description`, 1_024),
    icon: {
      atlasId,
      frame: modSpriteFrame(iconSource.frame, `${field}.icon.frame`),
      frameIndex: boundedInteger(iconSource.frameIndex, `${field}.icon.frameIndex`, 0, 4_095),
      imagePath,
    },
    key,
    modId,
  }
}

function modWearableContent(
  value: unknown,
  field: string,
): NonNullable<ModItemContent['wearable']> {
  const source = record(value, field)
  onlyKeys(source, field, [
    'deathShape', 'dyeable', 'slot', 'wornImagePath', 'wornTrimImagePath',
  ])
  const wornTrimImagePath = source.wornTrimImagePath === undefined
    ? undefined
    : limitedString(source.wornTrimImagePath, field, 240)
  return {
    deathShape: boundedInteger(source.deathShape, field, 0, 5),
    dyeable: boolean(source.dyeable, field),
    slot: limitedString(source.slot, field, 8) as ModWearableContent['slot'],
    wornImagePath: limitedString(source.wornImagePath, field, 240),
    ...(wornTrimImagePath === undefined ? {} : { wornTrimImagePath }),
  }
}

export function modSpriteFrame(value: unknown, field: string): ModSpriteFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'centerOffsetX', 'centerOffsetY', 'contentHeight', 'contentWidth', 'height',
    'logicalHeight', 'logicalWidth', 'width', 'x', 'y',
  ])
  const frame = {
    centerOffsetX: finite(source.centerOffsetX, `${field}.centerOffsetX`),
    centerOffsetY: finite(source.centerOffsetY, `${field}.centerOffsetY`),
    contentHeight: positiveFinite(source.contentHeight, `${field}.contentHeight`),
    contentWidth: positiveFinite(source.contentWidth, `${field}.contentWidth`),
    height: positiveFinite(source.height, `${field}.height`),
    logicalHeight: positiveInteger(source.logicalHeight, `${field}.logicalHeight`),
    logicalWidth: positiveInteger(source.logicalWidth, `${field}.logicalWidth`),
    width: positiveFinite(source.width, `${field}.width`),
    x: finite(source.x, `${field}.x`),
    y: finite(source.y, `${field}.y`),
  }
  if (Object.values(frame).some(component => Math.abs(component) > 16_384) ||
      frame.x < 0 || frame.y < 0) {
    throw new GameProtocolError(`${field} exceeds mod sprite geometry bounds`)
  }
  return frame
}

function isGeneratedEquipmentIdentity(
  equipmentType: EquipmentType,
  nativeTypeId: number,
  selector: number,
  iconRecords: readonly number[],
): boolean {
  const expectedType = {
    amulet: 7003,
    hat: 7005,
    ring: 7002,
    robe: 7006,
    staff: 7004,
    wand: 7011,
  }[equipmentType]
  const expectedRecords = equipmentType === 'hat'
    ? [34 + selector, 38 + selector]
    : equipmentType === 'robe'
      ? [64 + selector, 67 + selector]
      : equipmentType === 'staff'
        ? [72 + selector]
        : equipmentType === 'wand'
          ? [78 + selector]
          : equipmentType === 'ring'
            ? [52 + selector]
            : [30 + Math.floor(selector / 6), 18 + selector]
  return nativeTypeId === expectedType
    && iconRecords.length === expectedRecords.length
    && iconRecords.every((record, index) => record === expectedRecords[index])
}

function nativeEquipmentSelector(
  equipmentType: EquipmentType,
  iconRecords: readonly number[],
): number {
  if (equipmentType === 'hat') return iconRecords[0]! - 34
  if (equipmentType === 'robe') return iconRecords[0]! - 64
  if (equipmentType === 'staff') return iconRecords[0]! - 72
  if (equipmentType === 'wand') return iconRecords[0]! - 78
  if (equipmentType === 'ring') return iconRecords[0]! - 52
  return iconRecords[1]! - 18
}

function isStarterEquipmentIdentity(
  equipmentType: EquipmentType,
  name: string,
  nativeTypeId: number,
  iconRecords: readonly number[],
): boolean {
  const expected = equipmentType === 'hat'
    ? ['Hat', 7005, [34, 38]] as const
    : equipmentType === 'robe'
      ? ['Robe', 7006, [64, 67]] as const
      : equipmentType === 'staff'
        ? ['Staff', 7004, [72]] as const
        : null
  return expected !== null
    && name === expected[0]
    && nativeTypeId === expected[1]
    && iconRecords.length === expected[2].length
    && iconRecords.every((record, index) => record === expected[2][index])
}

export function playerEquipment(value: unknown, field: string): ProtocolPlayerEconomy['equipment'] {
  const source = record(value, field)
  onlyKeys(source, field, ['amulet', 'hat', 'rings', 'robe', 'weapon'])
  const nullableItem = (item: unknown, itemField: string) => item === null
    ? null
    : inventoryItem(item, itemField)
  const rings = array(source.rings, `${field}.rings`)
  if (rings.length !== 3) throw new GameProtocolError(`${field}.rings must contain three slots`)
  const equipment = {
    amulet: nullableItem(source.amulet, `${field}.amulet`),
    hat: nullableItem(source.hat, `${field}.hat`),
    rings: rings.map((item, index) => nullableItem(item, `${field}.rings[${index}]`)) as [
      HubInventoryItem | null,
      HubInventoryItem | null,
      HubInventoryItem | null,
    ],
    robe: nullableItem(source.robe, `${field}.robe`),
    weapon: nullableItem(source.weapon, `${field}.weapon`),
  }
  for (const [slot, item] of [
    ['amulet', equipment.amulet],
    ['hat', equipment.hat],
    ['ring-0', equipment.rings[0]],
    ['ring-1', equipment.rings[1]],
    ['ring-2', equipment.rings[2]],
    ['robe', equipment.robe],
    ['weapon', equipment.weapon],
  ] as const) {
    if (item && !equipmentSlotAccepts(slot, item.equipmentType)) {
      throw new GameProtocolError(`${field}.${slot} contains the wrong equipment type`)
    }
  }
  return equipment
}

function equipmentSlotAccepts(slot: EquipmentSlot, type: EquipmentType | null): boolean {
  if (slot === 'weapon') return type === 'staff' || type === 'wand'
  if (slot.startsWith('ring-')) return type === 'ring'
  return slot === type
}

export function equippedItems(
  equipment: ProtocolPlayerEconomy['equipment'],
): readonly HubInventoryItem[] {
  return [
    equipment.amulet,
    equipment.hat,
    ...equipment.rings,
    equipment.robe,
    equipment.weapon,
  ].filter((item): item is HubInventoryItem => item !== null)
}

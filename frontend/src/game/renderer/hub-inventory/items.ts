import { itemAtEquipmentSlot } from '../../hub-inventory-equipment.ts'
import {
  DOWSING_EQUIPMENT_RECIPES,
  type HubInventoryItem,
  findInventoryItem,
  inventoryItemsAtSackPath,
  projectInventoryRootSlots,
} from '../../core-kernels/hub-economy.ts'
import { type WizardElement } from '../../core-kernels/player-character.ts'
import {
  measureNativeUiText,
  nativeUiAtlas,
  nativeUiFont,
  wrapNativeUiText,
} from '../../native-ui/core.ts'
import { type ProtocolPlayerEconomy } from '../../protocol/game-state.ts'
import {
  HUB_HOVER_BOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_INTERACTION,
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_NATIVE_UI_SIZE,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
  type HubTooltipLine,
  type HubTooltipOptions,
  hubInventoryEquipmentSlotRects,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
  hubItemTooltipLines,
} from '../hub-inventory-render-contract.ts'
import {
  addAtlasSprite,
  addBitmapText,
} from './drawing.ts'
import {
  type HubInventoryDragModel,
  type HubInventorySelectionModel,
  type RenderContext,
} from './model.ts'
import {
  Container,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js'

export function addInventorySelection(
  layer: Container,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  layer.addChild(new Graphics()
    .rect(x + 1, y + 1, width - 2, height - 2)
    .stroke({ color: HUB_INVENTORY_INTERACTION.selectionTint, width: 2 }))
}

export function inventoryItemForSelection(
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel,
): HubInventoryItem | null {
  return selection.owner === 'backpack'
    ? findInventoryItem(economy.backpack, selection.id)
    : selection.equipmentSlot === null
      ? null
      : itemAtEquipmentSlot(economy, selection.equipmentSlot)
}

export function inventoryItemForDrag(
  economy: ProtocolPlayerEconomy,
  dragging: HubInventoryDragModel,
): HubInventoryItem | null {
  return dragging.owner === 'backpack'
    ? findInventoryItem(economy.backpack, dragging.itemId)
    : dragging.owner === 'storage'
      ? findInventoryItem(economy.storage, dragging.itemId)
    : dragging.equipmentSlot === null
      ? null
      : itemAtEquipmentSlot(economy, dragging.equipmentSlot)
}

export function inventorySelectionCenter(
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel,
  companion: boolean,
  sackPath: readonly number[],
): { readonly x: number; readonly y: number } | null {
  if (selection.owner === 'backpack') {
    const visible = inventoryItemsAtSackPath(economy.backpack, sackPath) ?? economy.backpack
    const selected = projectInventoryRootSlots(visible).find(({ item }) => item.id === selection.id)
    const hasParentRoot = sackPath.length > 0
    if (!selected || selected.slot >= HUB_INVENTORY_GRID.capacity - (hasParentRoot ? 1 : 0)) {
      return null
    }
    const position = hubInventorySlotPosition(hubInventoryVisibleSlot(
      selected.slot,
      hasParentRoot,
    ))
    return { x: position.x + 36, y: position.y + 36 }
  }
  if (selection.equipmentSlot === null) return null
  const [rect] = hubInventoryEquipmentSlotRects(selection.equipmentSlot, companion)
  if (!rect) return null
  return { x: rect[0] + rect[2] / 2, y: rect[1] + rect[3] / 2 }
}

export function addInventoryItemInfo(
  context: RenderContext,
  layer: Container,
  item: HubInventoryItem,
  sourceCenterX: number,
  sourceCenterY: number,
  options: HubTooltipOptions,
): Container {
  const info = addNativeContextualHoverBox(
    context,
    layer,
    hubItemTooltipLines(item, options),
    sourceCenterX,
    sourceCenterY,
    HUB_HOVER_BOX.shopSourceGap,
  )
  info.label = 'native-inventory-item-info'
  info.visible = false
  return info
}

export function addNativeContextualHoverBox(
  context: RenderContext,
  layer: Container,
  lines: readonly HubTooltipLine[],
  sourceCenterX: number,
  sourceCenterY: number,
  sourceGap: number,
): Container {
  const rendered = lines.map((line) => {
    const font = nativeUiFont(line.font)
    const wrapped = wrapNativeUiText(line.text, line.font, HUB_HOVER_BOX.contentMaxWidth)
    return { font, line, wrapped }
  })
  const contentWidth = Math.max(0, ...rendered.flatMap(({ line, wrapped }) => (
    wrapped.map((text) => measureNativeUiText(text, line.font))
  )))
  const contentHeight = rendered.reduce((height, { font, wrapped }, index) => (
    height
    + wrapped.length * font.metrics[0]
    + (index === rendered.length - 1 ? 0 : HUB_HOVER_BOX.lineGap)
  ), 0)
  const width = contentWidth + HUB_HOVER_BOX.contentMargin * 2
  const height = contentHeight + HUB_HOVER_BOX.contentMargin * 2
  const margin = HUB_HOVER_BOX.viewportMargin
  let x = sourceCenterX + sourceGap
  if (x + width > HUB_NATIVE_UI_SIZE.width - margin) x = sourceCenterX - sourceGap - width
  x = Math.max(margin, Math.min(HUB_NATIVE_UI_SIZE.width - margin - width, x))
  const y = Math.max(
    margin,
    Math.min(HUB_NATIVE_UI_SIZE.height - margin - height, sourceCenterY - height / 2),
  )

  const info = new Container()
  info.label = 'native-contextual-hover-box'
  info.position.set(x, y)
  info.addChild(new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0x000000 })
    .stroke({ color: 0xffffff, width: 1 }))
  let cursorY = HUB_HOVER_BOX.contentMargin
  for (const { font, line, wrapped } of rendered) {
    addBitmapText(
      context,
      info,
      line.text,
      line.font,
      HUB_HOVER_BOX.contentMargin,
      cursorY,
      {
        align: 'left',
        lineHeight: font.metrics[0],
        maxWidth: HUB_HOVER_BOX.contentMaxWidth,
        tint: line.tint,
      },
    )
    cursorY += wrapped.length * font.metrics[0] + HUB_HOVER_BOX.lineGap
  }
  layer.addChild(info)
  return info
}

export function addInventoryDragger(
  context: RenderContext,
  layer: Container,
  item: HubInventoryItem | null,
  dragging: HubInventoryDragModel,
  element: WizardElement,
): Container | null {
  if (!item) return null
  const dragger = new Container()
  dragger.label = 'native-inventory-dragger'
  dragger.position.set(dragging.pointer.x, dragging.pointer.y)
  const shadow = new Container()
  shadow.position.set(4, 4)
  addItemIcon(context, shadow, item, 0, 0, element, { alpha: 0.85, tintOverride: 0x000000 })
  const ordinary = new Container()
  addItemIcon(context, ordinary, item, 0, 0, element)
  const pulse = new Container()
  pulse.label = 'native-inventory-drag-pulse'
  pulse.blendMode = 'add'
  addItemIcon(context, pulse, item, 0, 0, element)
  dragger.addChild(shadow, ordinary, pulse)
  layer.addChild(dragger)
  return dragger
}

type InventoryIconItem = Pick<HubInventoryItem,
  'equipmentType' | 'iconRecords' | 'iconTints' | 'modContent' | 'modItemContent' | 'recipeIndex'>

interface InventoryIconOptions {
  readonly alpha?: number
  readonly tintOverride?: number
}

function addModItemIcon(
  context: RenderContext,
  layer: Container,
  item: InventoryIconItem,
  modContent: NonNullable<InventoryIconItem['modContent'] | InventoryIconItem['modItemContent']>,
  centerX: number,
  centerY: number,
  options: InventoryIconOptions,
): readonly Sprite[] {
  const textures = [
    context.modTextures.texture(modContent),
    ...(item.modItemContent
      ? [context.modTextures.iconTrim(item.modItemContent)].filter((value): value is Texture => value !== null)
      : []),
  ]
  const tints = item.modItemContent?.wearable?.slot === 'hat'
    || item.modItemContent?.wearable?.slot === 'robe'
    ? item.iconTints ?? [0xffffff, 0xffffff]
    : [0xffffff, 0xffffff]
  return textures.map((texture, index) => {
    const sprite = new Sprite(texture)
    sprite.anchor.set(0.5)
    sprite.position.set(centerX, centerY)
    sprite.alpha = options.alpha ?? 1
    sprite.tint = options.tintOverride ?? tints[index] ?? 0xffffff
    layer.addChild(sprite)
    return sprite
  })
}

export function addItemIcon(
  context: RenderContext,
  layer: Container,
  item: InventoryIconItem,
  centerX: number,
  centerY: number,
  element: WizardElement,
  options: InventoryIconOptions = {},
): readonly Sprite[] {
  const modContent = item.modContent ?? item.modItemContent
  if (modContent) return addModItemIcon(context, layer, item, modContent, centerX, centerY, options)
  const transform = item.equipmentType === null
    ? null
    : HUB_ITEM_ICON_TRANSFORMS[item.equipmentType]
  const [translationX, translationY] = transform?.translation ?? [0, 0]
  const recipe = item.recipeIndex === null
    ? null
    : DOWSING_EQUIPMENT_RECIPES[item.recipeIndex]
  const iconTints = item.equipmentType === 'hat' || item.equipmentType === 'robe'
    ? item.iconTints
      ?? recipe?.iconTints
      ?? [HUB_STARTER_EQUIPMENT_PRIMARY_TINT[element], 0xffffff]
    : [null, null]
  const sprites: Sprite[] = []
  for (const [index, record] of item.iconRecords.entries()) {
    if (!nativeUiAtlas('Inventory').records[`${record}`]) continue
    const sprite = addAtlasSprite(
      context,
      layer,
      'Inventory',
      record,
      centerX + translationX,
      centerY + translationY,
      { anchor: 0.5 },
    )
    sprite.alpha = options.alpha ?? 1
    sprite.rotation = (transform?.rotationDegrees ?? 0) * Math.PI / 180
    sprite.tint = options.tintOverride ?? iconTints[index] ?? 0xffffff
    sprites.push(sprite)
  }
  return sprites
}

export function addClippedItemIcon(
  context: RenderContext,
  layer: Container,
  item: InventoryIconItem,
  centerX: number,
  centerY: number,
  element: WizardElement,
  clipRect: readonly [number, number, number, number],
): readonly Sprite[] {
  const clipped = new Container()
  const content = new Container()
  const mask = new Graphics().rect(...clipRect).fill({ color: 0xffffff })
  content.mask = mask
  clipped.addChild(content, mask)
  layer.addChild(clipped)
  return addItemIcon(context, content, item, centerX, centerY, element)
}

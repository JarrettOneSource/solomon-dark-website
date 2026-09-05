import { Container, Graphics, Sprite, type Texture } from 'pixi.js'
import {
  DOWSING_EQUIPMENT_RECIPES,
  findInventoryItem,
  inventoryItemsAtSackPath,
  projectInventoryRootSlots,
  type EquipmentSlot,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import type { WizardElement } from '../core-kernels/player-character.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../protocol/game-state.ts'
import { nativeUiAtlas } from '../native-ui/core.ts'
import {
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_FLYBY,
  HUB_INVENTORY_INTERACTION,
  HUB_ITEM_ICON_TRANSFORMS,
  HUB_STARTER_EQUIPMENT_PRIMARY_TINT,
  hubInventoryEquipmentSlotRects,
  hubInventoryFlybyFrame,
  hubInventoryFlybyPoint,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
} from './hub-inventory-render-contract.ts'
import type { RenderContext, InventoryFlybyView } from './hub-inventory-render-model.ts'
import type {
  HubInventorySelectionModel,
  HubInventoryDragModel,
  HubInventoryFlybyModel,
} from './hub-inventory-renderer.ts'
import { addAtlasSprite } from './hub-inventory-drawing.ts'

export function addInventoryFlyby(
  context: RenderContext,
  layer: Container,
  model: HubInventoryFlybyModel,
  element: WizardElement,
): InventoryFlybyView {
  const container = new Container()
  container.label = 'native-inventory-flyby'
  const lanes = model.lanes.map((lane) => {
    const afterimages = new Map<number, Container>()
    for (const spawnTick of HUB_INVENTORY_FLYBY.afterimageBirthTicks) {
      const afterimage = new Container()
      afterimage.label = `native-inventory-flyby-afterimage-${spawnTick}`
      afterimage.visible = false
      addItemIcon(context, afterimage, lane.item, 0, 0, element)
      afterimages.set(spawnTick, afterimage)
      container.addChild(afterimage)
    }
    const main = new Container()
    main.label = 'native-inventory-flyby-main'
    addItemIcon(context, main, lane.item, 0, 0, element)
    container.addChild(main)
    return { afterimages, main, model: lane }
  })
  layer.addChild(container)
  const view = { container, lanes, model }
  updateInventoryFlybyView(view, model.startedAtMs)
  return view
}

export function updateInventoryFlybyView(view: InventoryFlybyView, nowMs: number): void {
  const frame = hubInventoryFlybyFrame(view.model.startedAtMs, nowMs)
  const afterimages = new Map(frame.afterimages.map((afterimage) => (
    [afterimage.spawnTick, afterimage] as const
  )))
  for (const lane of view.lanes) {
    const mainPoint = hubInventoryFlybyPoint(lane.model.from, lane.model.to, frame.mainProgress)
    lane.main.position.set(mainPoint.x, mainPoint.y)
    lane.main.visible = view.model.phase === 'flying' && frame.mainVisible
    for (const [spawnTick, container] of lane.afterimages) {
      const afterimage = afterimages.get(spawnTick)
      container.visible = afterimage !== undefined
      if (!afterimage) continue
      const point = hubInventoryFlybyPoint(lane.model.from, lane.model.to, afterimage.progress)
      container.position.set(point.x, point.y)
      container.alpha = afterimage.alpha
    }
  }
}

export function economyRecipeIndexes(economy: ProtocolPlayerEconomy): readonly number[] {
  const equipment = [
    economy.equipment.hat,
    economy.equipment.robe,
    economy.equipment.amulet,
    economy.equipment.weapon,
    ...economy.equipment.rings,
  ]
  const visit = (item: HubInventoryItem): readonly number[] => [
    ...(item.recipeIndex === null ? [] : [item.recipeIndex]),
    ...(item.contents ?? []).flatMap(visit),
  ]
  return Object.freeze([
    ...economy.backpack,
    ...economy.storage,
    ...equipment.filter((item): item is HubInventoryItem => item !== null),
  ].flatMap(visit))
}

export function permanentSkillRank(
  progression: ProtocolPlayerProgression,
  skillId: number,
): number {
  return progression.learnedSkills.find(([candidate]) => candidate === skillId)?.[1] ?? 0
}

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

export function itemAtEquipmentSlot(
  economy: ProtocolPlayerEconomy,
  slot: EquipmentSlot,
): HubInventoryItem | null {
  switch (slot) {
    case 'amulet': return economy.equipment.amulet
    case 'hat': return economy.equipment.hat
    case 'ring-0': return economy.equipment.rings[0]
    case 'ring-1': return economy.equipment.rings[1]
    case 'ring-2': return economy.equipment.rings[2]
    case 'robe': return economy.equipment.robe
    case 'weapon': return economy.equipment.weapon
  }
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

export function addItemIcon(
  context: RenderContext,
  layer: Container,
  item: Pick<
    HubInventoryItem,
    'equipmentType' | 'iconRecords' | 'iconTints' | 'modContent' | 'modItemContent' | 'recipeIndex'
  >,
  centerX: number,
  centerY: number,
  element: WizardElement,
  options: {
    readonly alpha?: number
    readonly tintOverride?: number
  } = {},
): readonly Sprite[] {
  const modContent = item.modContent ?? item.modItemContent
  if (modContent) {
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
  const transform = item.equipmentType === null
    ? null
    : HUB_ITEM_ICON_TRANSFORMS[item.equipmentType]
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
      centerX + (transform?.translation[0] ?? 0),
      centerY + (transform?.translation[1] ?? 0),
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
  item: Pick<
    HubInventoryItem,
    'equipmentType' | 'iconRecords' | 'iconTints' | 'modContent' | 'modItemContent' | 'recipeIndex'
  >,
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

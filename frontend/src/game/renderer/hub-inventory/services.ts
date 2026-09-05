import {
  DOWSING_EQUIPMENT_RECIPES,
  type HubInventoryItem,
  type HubShopItem,
  NATIVE_DYE_SWATCHES,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  inventoryDyeableClothingItems,
  inventoryItemsAtSackPath,
  nativeDyeMixedTint,
  projectInventoryRootSlots,
} from '../../core-kernels/hub-economy.ts'
import { HUB_TRADER_DIALOGUES } from '../../hub-inventory-presentation.ts'
import { measureNativeUiText } from '../../native-ui/core.ts'
import {
  type ProtocolPlayerEconomy,
  type ProtocolPlayerProgression,
} from '../../protocol/game-state.ts'
import {
  HUB_DOWSING_GRID,
  HUB_DOWSING_PREROLL,
  HUB_DYE_CLOTHING,
  HUB_HAGATHA_PERK_PANE,
  HUB_HOVER_BOX,
  HUB_INVENTORY_GRID,
  HUB_NATIVE_UI_SIZE,
  HUB_NATIVE_UI_TIMING,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  HUB_STOREGRID_SELECTED_RECORDS,
  hubDowsingSlotPosition,
  hubDyeItemLayerRects,
  hubDyeSwatchRect,
  hubHagathaOfferSlotPosition,
  hubHagathaPerkSlotAlpha,
  hubHagathaTonicPromptCenter,
  hubHagathaTooltipLines,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
  hubItemTooltipLines,
  hubOwnedPerkSlotRect,
  hubShopSlotPosition,
} from '../hub-inventory-render-contract.ts'
import {
  addDoneControl,
  addDowsingButton,
  addInventoryInfoFrame,
  addShopPanel,
} from './chrome.ts'
import {
  addAtlasSprite,
  addBitmapText,
  addCenteredAtlasSprite,
} from './drawing.ts'
import {
  addClippedItemIcon,
  addNativeContextualHoverBox,
} from './items.ts'
import {
  type FontName,
  type HubInventoryDyeModalModel,
  type HubInventoryRendererModel,
  type HubServiceInspectionModel,
  type InventoryFlybyView,
  type InventorySackPages,
  type RenderContext,
} from './model.ts'
import { buildInventory } from './pages.ts'
import {
  Container,
  Graphics,
} from 'pixi.js'

export function buildService(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): {
  readonly dragger: Container | null
  readonly flybys: readonly InventoryFlybyView[]
  readonly itemInfo: Container | null
  readonly modalHud: Container
  readonly overlay: Container
  readonly sackPages: InventorySackPages | null
} {
  const inventory = buildInventory(context, layer, {
    belt: model.belt,
    companion: true,
    config: model.config,
    economy: model.economy,
    dragging: model.dragging,
    flybys: model.flybys,
    inspection: model.inspection,
    leftPane: model.trader === 'hagatha' ? 'hagatha' : 'stats',
    progression: model.progression,
    sackPath: model.sackPath,
    sackTransition: model.sackTransition,
    selection: model.inventorySelection,
    statsPage: model.statsPage,
  })
  const overlay = new Container()
  overlay.label = 'native-service-overlay'
  layer.addChild(overlay)
  const { width } = HUB_SHOP_PANEL
  addShopPanel(context, overlay, model.trader === 'shlorio' && model.economy.dowsingOffers.length > 0)
  const dialogue = HUB_TRADER_DIALOGUES[model.trader]
  const titleFont: FontName = measureNativeUiText(dialogue.title, 'menu') > width - 55
    ? 'medium'
    : 'menu'
  addBitmapText(context, overlay, dialogue.title, titleFont, 800, HUB_SHOP_TEXT.titleTextBaselineY, {
    tint: HUB_SHOP_TEXT.goldTint,
  })

  if (model.trader === 'shlorio' && model.economy.dowsingOffers.length === 0) {
    addCenteredAtlasSprite(context, overlay, 'UI', 15, 800, 75)
    overlay.addChild(new Graphics()
      .rect(...HUB_DOWSING_PREROLL.referenceDropRect)
      .fill({ color: 0x000000 }))
    addDowsingButton(
      context,
      overlay,
      model.economy.dowsingFee,
      model.pressedControl === 'dowsing',
    )
    addDoneControl(context, overlay)
    addServiceInspection(context, layer, model)
    if (inventory.dragger) layer.addChild(inventory.dragger)
    for (const flyby of inventory.flybys) layer.addChild(flyby.container)
    return {
      dragger: inventory.dragger,
      flybys: inventory.flybys,
      itemInfo: inventory.itemInfo,
      modalHud: inventory.modalHud,
      overlay,
      sackPages: inventory.sackPages,
    }
  }

  if (model.trader === 'luthacus') {
    addStoreGrid(
      context,
      overlay,
      model.economy.storage,
      model,
      'storage',
    )
  } else if (model.trader === 'shlorio') {
    addDowsingGrid(context, overlay, serviceItems(model), model)
  } else {
    addStoreGrid(context, overlay, serviceItems(model), model, null)
  }
  addDoneControl(context, overlay)
  addServiceInspection(context, layer, model)
  if (inventory.dragger) layer.addChild(inventory.dragger)
  for (const flyby of inventory.flybys) layer.addChild(flyby.container)
  return {
    dragger: inventory.dragger,
    flybys: inventory.flybys,
    itemInfo: inventory.itemInfo,
    modalHud: inventory.modalHud,
    overlay,
    sackPages: inventory.sackPages,
  }
}

export function buildDyeClothing(
  context: RenderContext,
  root: Container,
  economy: ProtocolPlayerEconomy,
  model: HubInventoryDyeModalModel,
): { readonly layer: Container; readonly selectedPulse: Graphics | null } {
  const layer = new Container()
  layer.label = 'native-dye-clothing'
  layer.alpha = 0
  layer.addChild(new Graphics()
    .rect(0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height)
    .fill({ color: 0x000000, alpha: HUB_NATIVE_UI_TIMING.messageBoxCurtainAlpha }))
  const [panelLeft, panelTop, panelWidth, panelHeight] = HUB_DYE_CLOTHING.panelRect
  layer.addChild(new Graphics()
    .rect(panelLeft, panelTop, panelWidth, panelHeight)
    .fill({ color: 0x090908, alpha: 0.96 })
    .stroke({ color: 0xd8ba70, width: 3 }))
  layer.addChild(new Graphics()
    .rect(panelLeft + 7, panelTop + 7, panelWidth - 14, panelHeight - 14)
    .stroke({ color: 0xeadab3, width: 1 }))
  addBitmapText(
    context,
    layer,
    'FABRIC DYE',
    'menu',
    HUB_NATIVE_UI_SIZE.width / 2,
    HUB_DYE_CLOTHING.titleTextBaselineY,
    { tint: 0xe4c56d },
  )
  const instruction = model.pending
    ? 'DYEING...'
    : model.targetItemId !== null
      ? 'CHOOSE DYE CLOTH OR DYE TRIM'
      : model.swatchRows.length === 0
        ? 'MIX ONE OR MORE COLORS'
        : 'CHOOSE A HAT OR ROBE FROM YOUR BACKPACK'
  addBitmapText(
    context,
    layer,
    instruction,
    'medium',
    HUB_NATIVE_UI_SIZE.width / 2,
    HUB_DYE_CLOTHING.instructionTextBaselineY,
    { tint: 0xffffff },
  )

  let selectedPulse: Graphics | null = null
  for (let index = 0; index < NATIVE_DYE_SWATCHES.length; index += 1) {
    const rect = hubDyeSwatchRect(index)
    layer.addChild(new Graphics()
      .rect(...rect)
      .fill({ color: NATIVE_DYE_SWATCHES[index]! })
      .stroke({ color: 0x201c13, width: 2 }))
    if (index === model.selectedRow) {
      selectedPulse = new Graphics()
        .rect(rect[0] - 4, rect[1] - 4, rect[2] + 8, rect[3] + 8)
        .stroke({ color: 0xffffff, width: 3 })
      selectedPulse.label = 'native-dye-selected-pulse'
      layer.addChild(selectedPulse)
    }
  }

  const mixedTint = nativeDyeMixedTint(model.swatchRows)
  const [tubLeft, tubTop, tubWidth, tubHeight] = HUB_DYE_CLOTHING.tubRect
  const tub = new Graphics()
    .roundRect(tubLeft, tubTop, tubWidth, tubHeight, 18)
    .fill({
      color: mixedTint ?? 0xffffff,
      alpha: mixedTint === null ? HUB_DYE_CLOTHING.emptyTubAlpha : 1,
    })
    .stroke({ color: 0xeadab3, width: 3 })
  layer.addChild(tub)
  addBitmapText(context, layer, 'DYE TUB', 'medium', tubLeft + tubWidth / 2, tubTop + tubHeight + 25, {
    tint: 0xe4c56d,
  })

  const projected = projectInventoryRootSlots(
    inventoryItemsAtSackPath(economy.backpack, model.path) ?? [],
  ).filter(({ slot }) => (
    slot < HUB_INVENTORY_GRID.capacity - (model.path.length > 0 ? 1 : 0)
  ))
  const eligibleIds = new Set(inventoryDyeableClothingItems(economy.backpack).map(({ item }) => item.id))
  projected.forEach(({ item, slot }) => {
    if (!eligibleIds.has(item.id)) return
    const visibleSlot = hubInventoryVisibleSlot(slot, model.path.length > 0)
    const { x, y } = hubInventorySlotPosition(visibleSlot)
    layer.addChild(new Graphics()
      .rect(x + 2, y + 2, HUB_INVENTORY_GRID.cellSize - 4, HUB_INVENTORY_GRID.cellSize - 4)
      .stroke({ color: item.id === model.targetItemId ? 0xffffff : 0xd8ba70, width: 3 }))
  })
  if (model.targetItemId !== null) {
    const target = projected.find(({ item }) => item.id === model.targetItemId)
    if (target) {
      const rects = hubDyeItemLayerRects(hubInventoryVisibleSlot(
        target.slot,
        model.path.length > 0,
      ))
      layer.addChild(new Graphics()
        .rect(...rects.cloth)
        .fill({ color: 0x000000, alpha: 0.38 })
        .stroke({ color: 0xffffff, width: 2 }))
      layer.addChild(new Graphics()
        .rect(...rects.trim)
        .fill({ color: 0x000000, alpha: 0.38 })
        .stroke({ color: 0xffffff, width: 2 }))
      addBitmapText(
        context,
        layer,
        'CLOTH',
        'body',
        rects.cloth[0] + rects.cloth[2] / 2,
        rects.cloth[1] + 26,
        { tint: 0xffffff },
      )
      addBitmapText(
        context,
        layer,
        'TRIM',
        'body',
        rects.trim[0] + rects.trim[2] / 2,
        rects.trim[1] + 22,
        { tint: 0xffffff },
      )
    }
  }

  const [cancelLeft, cancelTop, cancelWidth, cancelHeight] = HUB_DYE_CLOTHING.cancelRect
  layer.addChild(new Graphics()
    .rect(cancelLeft, cancelTop, cancelWidth, cancelHeight)
    .fill({ color: 0x191916 })
    .stroke({ color: 0xd8ba70, width: 2 }))
  addBitmapText(
    context,
    layer,
    'CANCEL',
    'menu',
    cancelLeft + cancelWidth / 2,
    cancelTop + 31,
    { tint: 0xffffff },
  )
  root.addChild(layer)
  return { layer, selectedPulse }
}

function addStoreGrid(
  context: RenderContext,
  layer: Container,
  items: readonly (HubInventoryItem | HubShopItem)[],
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
  owner: 'storage' | null,
): void {
  const addressedItems = owner === 'storage'
    ? new Map(projectInventoryRootSlots(items).map(({ item, slot }) => [slot, item] as const))
    : null
  const slotPosition = model.trader === 'hagatha'
    ? hubHagathaOfferSlotPosition
    : hubShopSlotPosition
  for (let index = 0; index < HUB_SHOP_GRID.retainedCapacity; index += 1) {
    const { x, y } = slotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, x, y)
    slot.alpha = HUB_SHOP_GRID.slotAlpha
    const item = addressedItems === null ? items[index] : addressedItems.get(index)
    if (!item) continue
    addStoreGridItem(context, layer, item, model, owner, x, y)
  }
}

function addStoreGridItem(
  context: RenderContext,
  layer: Container,
  item: HubInventoryItem | HubShopItem,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
  owner: 'storage' | null,
  x: number,
  y: number,
): void {
  const held = owner === 'storage'
    && model.dragging?.owner === 'storage'
    && model.dragging.itemId === item.id
  if (held) return
  const selected = item.id === model.selectedItemId && model.selectedOwner === owner
  const price = hubShopItemPrice(item)
  if (selected) {
    const record = owner === 'storage'
      ? HUB_STOREGRID_SELECTED_RECORDS.takeClickAgain
      : price !== null && price > model.economy.gold
        ? HUB_STOREGRID_SELECTED_RECORDS.unaffordable
        : HUB_STOREGRID_SELECTED_RECORDS.buyClickAgain
    const unaffordable = record === HUB_STOREGRID_SELECTED_RECORDS.unaffordable
    addAtlasSprite(
      context,
      layer,
      'UI',
      record,
      x + (unaffordable ? -0.5 : 3),
      y + (unaffordable ? 5.5 : 11),
    )
  } else if (model.trader === 'hagatha') {
    const selector = 'recipeIndex' in item ? item.recipeIndex ?? -1 : -1
    if (selector >= 0) addAtlasSprite(context, layer, 'Skills', 127 + selector, x + 36, y + 36, { anchor: 0.5 })
    else addAtlasSprite(context, layer, 'Inventory', 5, x + 36, y + 36, { anchor: 0.5, scale: 0.6 })
  } else addClippedItemIcon(
    context,
    layer,
    item,
    x + 36,
    y + 36,
    model.config.element,
    [x, y, HUB_SHOP_GRID.cellSize, HUB_SHOP_GRID.cellSize],
  )
  const amount = price ?? (item.quantity > 1 ? item.quantity : null)
  if (amount === null) return
  addBitmapText(context, layer, `${amount}`, HUB_SHOP_TEXT.priceFont,
    x + HUB_SHOP_TEXT.priceTextRightOffsetX, y + HUB_SHOP_TEXT.priceTextBaselineOffsetY, {
      align: 'right',
      tint: price === null ? 0xf4e5b4 : price > model.economy.gold
        ? HUB_SHOP_TEXT.unaffordableTint : HUB_SHOP_TEXT.affordableTint,
    })
}

function addDowsingGrid(
  context: RenderContext,
  layer: Container,
  items: readonly HubShopItem[],
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): void {
  for (let index = 0; index < HUB_DOWSING_GRID.retainedCapacity; index += 1) {
    const { x, y } = hubDowsingSlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, x, y)
    slot.alpha = HUB_DOWSING_GRID.slotAlpha
    const item = items[index]
    if (!item) continue
    const selected = item.id === model.selectedItemId
    if (selected) {
      const record = item.price > model.economy.gold
        ? HUB_STOREGRID_SELECTED_RECORDS.unaffordable
        : HUB_STOREGRID_SELECTED_RECORDS.buyClickAgain
      const unaffordable = record === HUB_STOREGRID_SELECTED_RECORDS.unaffordable
      addAtlasSprite(
        context,
        layer,
        'UI',
        record,
        x + (unaffordable ? -0.5 : 3),
        y + (unaffordable ? 5.5 : 11),
      )
    } else addClippedItemIcon(
      context,
      layer,
      item,
      x + 36,
      y + 36,
      model.config.element,
      [x, y, HUB_DOWSING_GRID.cellSize, HUB_DOWSING_GRID.cellSize],
    )
    addBitmapText(
      context,
      layer,
      `${item.price}`,
      HUB_SHOP_TEXT.priceFont,
      x + HUB_SHOP_TEXT.priceTextRightOffsetX,
      y + HUB_SHOP_TEXT.priceTextBaselineOffsetY,
      {
        align: 'right',
        tint: item.price > model.economy.gold
          ? HUB_SHOP_TEXT.unaffordableTint
          : HUB_SHOP_TEXT.affordableTint,
      },
    )
  }
}

function serviceItems(model: Extract<HubInventoryRendererModel, { kind: 'service' }>): readonly HubShopItem[] {
  if (model.trader === 'fomentius') return model.economy.fomentiusStock
  if (model.trader === 'hagatha') return model.economy.hagathaOffers.map((offer) => ({
    equipmentType: null,
    iconRecords: offer.selector < 0 ? [10] : [],
    id: offer.selector,
    kind: 'equipment',
    name: offer.name,
    nativeSubtype: offer.selector,
    nativeTypeId: 0,
    price: offer.price,
    quantity: 1,
    rarity: null,
    recipeIndex: offer.selector,
  }))
  return model.economy.dowsingOffers.map((offer) => {
    const recipe = DOWSING_EQUIPMENT_RECIPES[offer.recipeIndex]!
    return {
      equipmentType: recipe.type,
      iconRecords: recipe.iconRecords,
      id: offer.id,
      kind: 'equipment',
      name: recipe.name,
      nativeSubtype: null,
      nativeTypeId: recipe.nativeTypeId,
      price: offer.price,
      quantity: 1,
      rarity: recipe.rarity,
      recipeIndex: recipe.sourceIndex,
    }
  })
}

function addServiceInspection(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
): void {
  const inspection = model.inspection
  if (!inspection || model.notice) return
  if (inspection.kind === 'owned-perk') {
    if (
      (model.trader !== 'hagatha' && model.statsPage !== 2)
      || model.economy.ownedPerkSelectors[inspection.index] !== inspection.selector
    ) return
    addOwnedPerkInspection(context, layer, model.economy, inspection, true)
    return
  }
  if (model.trader === 'hagatha') {
    const index = model.economy.hagathaOffers.findIndex(
      ({ selector }) => selector === inspection.id,
    )
    const offer = model.economy.hagathaOffers[index]
    if (!offer || inspection.owner !== null) return
    const { x, y } = hubHagathaOfferSlotPosition(index)
    addNativeContextualHoverBox(
      context,
      layer,
      hubHagathaTooltipLines({
        bundleSelectors: offer.members,
        cheatDeathCharges: null,
        firstMixed: offer.price === offer.basePrice,
        price: offer.price,
        selector: offer.selector,
      }),
      x + HUB_SHOP_GRID.cellSize / 2,
      y + HUB_SHOP_GRID.cellSize / 2,
      HUB_HOVER_BOX.shopSourceGap,
    )
    return
  }

  addShopItemInspection(context, layer, model, inspection)
}

function addShopItemInspection(
  context: RenderContext,
  layer: Container,
  model: Extract<HubInventoryRendererModel, { kind: 'service' }>,
  inspection: Extract<HubServiceInspectionModel, { kind: 'store-item' }>,
): void {
  const projectedStorage = model.trader === 'luthacus'
    ? projectInventoryRootSlots(model.economy.storage)
    : null
  const items = projectedStorage?.map(({ item }) => item) ?? serviceItems(model)
  const index = items.findIndex(({ id }) => id === inspection.id)
  const item = items[index]
  if (!item) return
  if (model.trader === 'luthacus' && inspection.owner !== 'storage') return
  if (model.trader !== 'luthacus' && inspection.owner !== null) return
  const displayIndex = projectedStorage?.[index]?.slot ?? index
  const position = model.trader === 'shlorio'
    ? hubDowsingSlotPosition(index)
    : hubShopSlotPosition(displayIndex)
  const cellSize = model.trader === 'shlorio'
    ? HUB_DOWSING_GRID.cellSize
    : HUB_SHOP_GRID.cellSize
  addNativeContextualHoverBox(
    context,
    layer,
    hubItemTooltipLines(item, {
      creativityRank: permanentSkillRank(
        model.progression,
        NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
      ),
      ownedRecipeIndexes: economyRecipeIndexes(model.economy),
      playerLevel: model.progression.level,
      price: model.trader === 'luthacus' ? null : hubShopItemPrice(item),
    }),
    position.x + cellSize / 2,
    position.y + cellSize / 2,
    HUB_HOVER_BOX.shopSourceGap,
  )
}

export function addOwnedPerkInspection(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  inspection: Extract<HubServiceInspectionModel, { kind: 'owned-perk' }>,
  companion: boolean,
): void {
  if (economy.ownedPerkSelectors[inspection.index] !== inspection.selector) return
  const [baseLeft, top, width, height] = hubOwnedPerkSlotRect(inspection.index)
  const left = baseLeft - (companion ? 0 : 53)
  addNativeContextualHoverBox(
    context,
    layer,
    hubHagathaTooltipLines({
      cheatDeathCharges: inspection.selector === 7 ? 1 : null,
      firstMixed: true,
      price: null,
      selector: inspection.selector,
    }),
    left + width / 2,
    top + height / 2,
    HUB_HOVER_BOX.ownedPerkSourceGap,
  )
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

function hubShopItemPrice(item: HubInventoryItem | HubShopItem): number | null {
  return 'price' in item && typeof item.price === 'number' ? item.price : null
}

export function addHagathaInventoryPane(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  offsetX = 0,
  offsetY = 0,
): void {
  const left = HUB_HAGATHA_PERK_PANE.left + offsetX
  const top = HUB_HAGATHA_PERK_PANE.top + offsetY
  for (const [x, y] of [[323, 227], [166, 247], [166, 312], [166, 182], [111, 125]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + offsetX, y + offsetY)
  }
  addAtlasSprite(context, layer, 'Inventory', 3, 362 + offsetX, 218 + offsetY)
  addInventoryInfoFrame(
    context,
    layer,
    left,
    top,
    HUB_HAGATHA_PERK_PANE.innerWidth,
    HUB_HAGATHA_PERK_PANE.innerHeight,
  )
  addBitmapText(
    context,
    layer,
    'CHARMS/CURSES',
    'medium',
    HUB_HAGATHA_PERK_PANE.titleCenterX + offsetX,
    HUB_HAGATHA_PERK_PANE.titleTextBaselineY + offsetY,
    { tint: HUB_HAGATHA_PERK_PANE.titleTint },
  )
  for (let index = 0; index < HUB_HAGATHA_PERK_PANE.columns * HUB_HAGATHA_PERK_PANE.rows; index += 1) {
    const centerX = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[0] + offsetX
      + (index % HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const centerY = HUB_HAGATHA_PERK_PANE.slotCenterOrigin[1] + offsetY
      + Math.floor(index / HUB_HAGATHA_PERK_PANE.columns) * HUB_HAGATHA_PERK_PANE.slotPitch
    const selector = economy.ownedPerkSelectors[index]
    const slot = addCenteredAtlasSprite(
      context,
      layer,
      'Inventory',
      10,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
    slot.alpha = hubHagathaPerkSlotAlpha(index, economy.charmCapacity)
    if (selector !== undefined) addCenteredAtlasSprite(
      context,
      layer,
      'Skills',
      127 + selector,
      centerX,
      centerY,
      HUB_HAGATHA_PERK_PANE.slotScale,
    )
  }
  const tonicPromptCenter = hubHagathaTonicPromptCenter(economy.charmCapacity)
  if (tonicPromptCenter) {
    addCenteredAtlasSprite(
      context,
      layer,
      'Inventory',
      HUB_HAGATHA_PERK_PANE.tonicPromptRecord,
      tonicPromptCenter[0] + offsetX,
      tonicPromptCenter[1] + offsetY,
    )
  }
}

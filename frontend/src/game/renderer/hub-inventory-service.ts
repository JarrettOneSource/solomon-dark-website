import { Container, Graphics } from 'pixi.js'
import {
  DOWSING_EQUIPMENT_RECIPES,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  projectInventoryRootSlots,
  type HubInventoryItem,
  type HubShopItem,
} from '../core-kernels/hub-economy.ts'
import { HUB_TRADER_DIALOGUES } from '../hub-inventory-presentation.ts'
import { measureNativeUiText } from '../native-ui/core.ts'
import {
  HUB_DOWSING_GRID,
  HUB_DOWSING_PREROLL,
  HUB_HOVER_BOX,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  HUB_SHOP_TEXT,
  HUB_STOREGRID_SELECTED_RECORDS,
  hubDowsingFieldTint,
  hubDowsingSlotPosition,
  hubHagathaOfferSlotPosition,
  hubHagathaTooltipLines,
  hubItemTooltipLines,
  hubShopSlotPosition,
} from './hub-inventory-render-contract.ts'
import type {
  RenderContext,
  InventorySackPages,
  InventoryFlybyView,
} from './hub-inventory-render-model.ts'
import type { HubInventoryRendererModel } from './hub-inventory-renderer.ts'
import { buildInventory } from './hub-inventory-page.ts'
import { addOwnedPerkInspection, addNativeContextualHoverBox } from './hub-inventory-inspection.ts'
import {
  economyRecipeIndexes,
  permanentSkillRank,
  addClippedItemIcon,
} from './hub-inventory-items.ts'
import {
  type FontName,
  addNativeButton,
  addAtlasSprite,
  addCenteredAtlasSprite,
  addRepeatedAtlas,
  addBitmapText,
} from './hub-inventory-drawing.ts'

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
    const item = addressedItems?.get(index) ?? items[index]
    if (!item) continue
    const held = owner === 'storage'
      && model.dragging?.owner === 'storage'
      && model.dragging.itemId === item.id
    const selected = item.id === model.selectedItemId && model.selectedOwner === owner
    const price = 'price' in item && typeof item.price === 'number' ? item.price : null
    if (selected && !held) {
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
    } else if (!held && model.trader === 'hagatha') {
      const selector = 'recipeIndex' in item ? item.recipeIndex ?? -1 : -1
      if (selector >= 0) addAtlasSprite(context, layer, 'Skills', 127 + selector, x + 36, y + 36, { anchor: 0.5 })
      else addAtlasSprite(context, layer, 'Inventory', 5, x + 36, y + 36, { anchor: 0.5, scale: 0.6 })
    } else if (!held) addClippedItemIcon(
      context,
      layer,
      item,
      x + 36,
      y + 36,
      model.config.element,
      [x, y, HUB_SHOP_GRID.cellSize, HUB_SHOP_GRID.cellSize],
    )
    if (!held && price !== null) {
      addBitmapText(
        context,
        layer,
        `${price}`,
        HUB_SHOP_TEXT.priceFont,
        x + HUB_SHOP_TEXT.priceTextRightOffsetX,
        y + HUB_SHOP_TEXT.priceTextBaselineOffsetY,
        {
          align: 'right',
          tint: price > model.economy.gold
            ? HUB_SHOP_TEXT.unaffordableTint
            : HUB_SHOP_TEXT.affordableTint,
        },
      )
    } else if (!held && item.quantity > 1) {
      addBitmapText(
        context,
        layer,
        `${item.quantity}`,
        HUB_SHOP_TEXT.priceFont,
        x + HUB_SHOP_TEXT.priceTextRightOffsetX,
        y + HUB_SHOP_TEXT.priceTextBaselineOffsetY,
        {
          align: 'right',
          tint: 0xf4e5b4,
        },
      )
    }
  }
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

function hubShopItemPrice(item: HubInventoryItem | HubShopItem): number | null {
  return 'price' in item && typeof item.price === 'number' ? item.price : null
}

function addShopPanel(context: RenderContext, layer: Container, purple: boolean): void {
  const { backgroundHeight, backgroundRepeat, settledLeft: left, settledTop: top, width } = HUB_SHOP_PANEL
  for (const blendMode of HUB_SHOP_PANEL.backgroundBlendModes) {
    const backgroundTiles = addRepeatedAtlas(
      context,
      layer,
      'UI',
      49,
      left,
      top,
      width,
      backgroundHeight,
      ...backgroundRepeat,
    )
    for (const tile of backgroundTiles) {
      tile.blendMode = blendMode
      tile.tint = purple ? hubDowsingFieldTint(0) : HUB_SHOP_TEXT.normalBackgroundTint
      if (purple) tile.label = 'native-dowsing-field'
    }
  }
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 557.5, 16.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1041.5, 16.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 557.5, 333.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1041.5, 333.5, -1, -1)
  addCenteredAtlasSprite(context, layer, 'Skills', 4, 600, 25)
  addCenteredAtlasSprite(context, layer, 'Skills', 4, 1000, 25, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 588.5, 13)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 1011.5, 13, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 588.5, 33, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 4, 1011.5, 33, -1, -1)

  for (let index = 0; index < 5; index += 1) {
    addCenteredAtlasSprite(context, layer, 'UI', 74, 570.5 + index * 129, -35, 1, -1)
  }
  for (let index = 0; index < 10; index += 1) {
    const leftRail = addCenteredAtlasSprite(context, layer, 'UI', 74, 506, -13 + index * 44)
    leftRail.rotation = Math.PI / 2
    const rightRail = addCenteredAtlasSprite(context, layer, 'UI', 74, 1093, -13 + index * 44, 1, -1)
    rightRail.rotation = Math.PI / 2
  }
  addCenteredAtlasSprite(context, layer, 'UI', 73, 1063, 355)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 536, 355, -1, 1)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 1063, -5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 73, 536, -5, -1, -1)
}

function addDoneControl(context: RenderContext, layer: Container): void {
  addCenteredAtlasSprite(context, layer, 'UI', 72, 800, 387)
  const middle = addCenteredAtlasSprite(context, layer, 'UI', 12, 800, 385)
  middle.alpha = HUB_SHOP_PANEL.doneMiddleAlpha
  const inner = addCenteredAtlasSprite(context, layer, 'UI', 86, 800, 385)
  inner.tint = HUB_SHOP_PANEL.doneInnerTint
  addBitmapText(context, layer, 'DONE', 'menu', 800, HUB_SHOP_TEXT.doneTextBaselineY, { tint: 0xffffff })
}

function addDowsingButton(
  context: RenderContext,
  layer: Container,
  fee: number,
  pressed: boolean,
): void {
  const copyOffset = addNativeButton(
    context,
    layer,
    'dowsing',
    'DOWSE',
    HUB_DOWSING_PREROLL.buttonActionRect,
    pressed,
    800,
    HUB_DOWSING_PREROLL.labelTextBaselineY,
  )
  addBitmapText(
    context,
    layer,
    `${fee} GOLD`,
    'medium',
    800 + copyOffset,
    HUB_DOWSING_PREROLL.feeTextBaselineY + copyOffset,
    { tint: HUB_SHOP_TEXT.goldTint },
  )
}

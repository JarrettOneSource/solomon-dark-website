import { Container, Graphics } from 'pixi.js'
import {
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  findInventoryItem,
  inventoryItemsAtSackPath,
  projectInventoryRootSlots,
  type HubInventoryItem,
} from '../core-kernels/hub-economy.ts'
import type { PlayerCharacterConfig, WizardElement } from '../core-kernels/player-character.ts'
import type { PlayerBeltComponent } from '../core-kernels/native-belt.ts'
import { NATIVE_INVENTORY_GOLD_LEDGER } from '../native-inventory-gold-layout.ts'
import type { ProtocolPlayerEconomy, ProtocolPlayerProgression } from '../protocol/game-state.ts'
import {
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_ROOT_CHROME,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_UNFORGE_TARGET,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
} from './hub-inventory-render-contract.ts'
import type {
  RenderContext,
  InventoryBuildState,
  InventorySackPages,
} from './hub-inventory-render-model.ts'
import type {
  HubInventorySelectionModel,
  HubInventoryDragModel,
  HubInventoryFlybyModel,
  HubInventorySackTransitionModel,
  HubServiceInspectionModel,
} from './hub-inventory-renderer.ts'
import {
  addInventorySidePanelBackdrop,
  addInventorySidePanelChrome,
  addInventorySectionHeader,
  addStats,
  addPlayerPreview,
  addEquipment,
  addBelt,
  addHagathaInventoryPane,
} from './hub-inventory-panels.ts'
import { addOwnedPerkInspection, addInventoryItemInfo } from './hub-inventory-inspection.ts'
import {
  addInventoryFlyby,
  economyRecipeIndexes,
  permanentSkillRank,
  addInventorySelection,
  inventoryItemForSelection,
  inventoryItemForDrag,
  inventorySelectionCenter,
  addInventoryDragger,
  addClippedItemIcon,
} from './hub-inventory-items.ts'
import {
  addHorizontalChain,
  addAtlasSprite,
  addCenteredAtlasSprite,
  addTiledAtlas,
  addBitmapText,
} from './hub-inventory-drawing.ts'

export function buildInventory(
  context: RenderContext,
  layer: Container,
  model: {
    readonly belt: PlayerBeltComponent
    readonly config: PlayerCharacterConfig
    readonly economy: ProtocolPlayerEconomy
    readonly companion?: boolean
    readonly dragging?: HubInventoryDragModel | null
    readonly flybys?: readonly HubInventoryFlybyModel[]
    readonly leftPane?: 'hagatha' | 'stats'
    readonly inspection?: HubServiceInspectionModel | null
    readonly progression: ProtocolPlayerProgression
    readonly sackPath: readonly number[]
    readonly sackTransition: HubInventorySackTransitionModel | null
    readonly selection?: HubInventorySelectionModel | null
    readonly statsPage: number
  },
): InventoryBuildState {
  const { economy, progression } = model
  const companion = model.companion ?? false
  const dragging = model.dragging ?? null
  const flybys = model.flybys ?? []
  const hiddenItemIds = new Set(
    flybys.flatMap((flyby) => (
      flyby.phase === 'flying' ? flyby.lanes.map(({ item }) => item.id) : []
    )),
  )
  const selection = model.selection ?? null
  const visibleBackpack = inventoryItemsAtSackPath(economy.backpack, model.sackPath)
    ?? economy.backpack
  const background = new Graphics().rect(0, 0, 1600, 900).fill({ color: 0x000000 })
  layer.addChild(background)

  addInventorySidePanelBackdrop(context, layer, 'left', companion)
  addInventorySidePanelBackdrop(context, layer, 'right', companion)
  if (model.leftPane === 'hagatha') addHagathaInventoryPane(context, layer, economy)
  else addStats(context, layer, model, companion, model.statsPage)
  const playerPreview = companion ? null : addPlayerPreview(context, layer, model.config.element)
  addEquipment(
    context,
    layer,
    economy,
    selection,
    dragging,
    hiddenItemIds,
    companion,
    model.config.element,
  )
  addInventorySidePanelChrome(context, layer, 'left', companion)
  addInventorySidePanelChrome(context, layer, 'right', companion)

  addTiledAtlas(context, layer, 'UI', 49, 0, 490, 1600, 310)
  addHorizontalChain(context, layer, 0, 470, 1600)
  addHorizontalChain(context, layer, 0, 800, 1600)
  addBackpackFrame(context, layer)

  let sackPages: InventorySackPages | null = null
  if (model.sackTransition) {
    const outgoing = new Container()
    const incoming = new Container()
    outgoing.label = 'native-sack-page-outgoing'
    incoming.label = 'native-sack-page-incoming'
    addInventoryGridPage(
      context,
      outgoing,
      inventoryItemsAtSackPath(economy.backpack, model.sackTransition.fromPath) ?? [],
      null,
      null,
      model.config.element,
      inventorySackAtPath(economy.backpack, model.sackTransition.fromPath),
      hiddenItemIds,
    )
    addInventoryGridPage(
      context,
      incoming,
      inventoryItemsAtSackPath(economy.backpack, model.sackTransition.toPath) ?? [],
      selection,
      null,
      model.config.element,
      inventorySackAtPath(economy.backpack, model.sackTransition.toPath),
      hiddenItemIds,
    )
    layer.addChild(outgoing, incoming)
    sackPages = { incoming, outgoing, transition: model.sackTransition }
  } else {
    const page = new Container()
    page.label = 'native-sack-page-current'
    addInventoryGridPage(
      context,
      page,
      visibleBackpack,
      selection,
      dragging,
      model.config.element,
      inventorySackAtPath(economy.backpack, model.sackPath),
      hiddenItemIds,
    )
    layer.addChild(page)
  }

  addGold(context, layer, economy.gold)
  const modalHud = addBelt(
    context,
    layer,
    model.belt,
    economy,
    progression,
    model.config.element,
  )
  const unforgeTarget = addCenteredAtlasSprite(
    context,
    layer,
    'UI',
    75,
    ...HUB_UNFORGE_TARGET.center,
  )
  unforgeTarget.label = 'native-unforge-target'

  const flybyViews = flybys.map((flyby) => (
    addInventoryFlyby(context, layer, flyby, model.config.element)
  ))

  const selected = selection ? inventoryItemForSelection(economy, selection) : null
  const selectedCenter = selection
    ? inventorySelectionCenter(economy, selection, companion, model.sackPath)
    : null
  const itemInfo = selected && selectedCenter && !dragging
      && flybys.every(({ phase }) => phase !== 'flying')
    ? addInventoryItemInfo(
        context,
        layer,
        selected,
        selectedCenter.x,
        selectedCenter.y,
        {
          creativityRank: permanentSkillRank(
            progression,
            NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
          ),
          ownedRecipeIndexes: economyRecipeIndexes(economy),
          playerLevel: progression.level,
        },
      )
    : null
  if (!companion && model.leftPane !== 'hagatha' && model.statsPage === 2
      && model.inspection?.kind === 'owned-perk') {
    addOwnedPerkInspection(context, layer, economy, model.inspection, companion)
  }
  const dragger = dragging
    ? addInventoryDragger(context, layer, inventoryItemForDrag(economy, dragging), dragging, model.config.element)
    : null
  return { dragger, flybys: flybyViews, itemInfo, modalHud, playerPreview, sackPages }
}

function addInventoryGridPage(
  context: RenderContext,
  layer: Container,
  source: readonly HubInventoryItem[],
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  element: WizardElement,
  parentHolderItem: HubInventoryItem | null,
  hiddenItemIds: ReadonlySet<number>,
): void {
  const hasParentRoot = parentHolderItem !== null
  const items = new Map(projectInventoryRootSlots(source)
    .filter(({ slot }) => slot < HUB_INVENTORY_GRID.capacity - (hasParentRoot ? 1 : 0))
    .map(({ item, slot }) => [hubInventoryVisibleSlot(slot, hasParentRoot), item] as const))
  for (let index = 0; index < HUB_INVENTORY_GRID.capacity; index += 1) {
    const position = hubInventorySlotPosition(index)
    const slot = addAtlasSprite(context, layer, 'Inventory', 10, position.x, position.y)
    slot.alpha = HUB_INVENTORY_GRID.slotAlpha
    if (index === HUB_INVENTORY_PARENT_HOLDER.visibleSlot && parentHolderItem) {
      const parentHolder = new Container()
      parentHolder.label = 'native-inventory-parent-holder'
      parentHolder.alpha = HUB_INVENTORY_PARENT_HOLDER.alpha
      addClippedItemIcon(
        context,
        parentHolder,
        parentHolderItem,
        position.x + HUB_INVENTORY_GRID.cellSize / 2,
        position.y + HUB_INVENTORY_GRID.cellSize / 2,
        element,
        [position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize],
      )
      layer.addChild(parentHolder)
    }
    const item = items.get(index)
    if (!item) continue
    const held = hiddenItemIds.has(item.id)
      || (dragging?.owner === 'backpack' && item.id === dragging.itemId)
    if (!held) addClippedItemIcon(
      context,
      layer,
      item,
      position.x + 36,
      position.y + 36,
      element,
      [position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize],
    )
    if (!held && item.quantity > 1) {
      addBitmapText(context, layer, `${item.quantity}`, 'medium', position.x + 61, position.y + 54, {
        align: 'center',
        tint: 0xf4e5b4,
      })
    }
    if (item.id === selection?.id && selection.owner === 'backpack') {
      addInventorySelection(
        layer,
        position.x,
        position.y,
        HUB_INVENTORY_GRID.cellSize,
        HUB_INVENTORY_GRID.cellSize,
      )
    }
  }
}

function inventorySackAtPath(
  backpack: readonly HubInventoryItem[],
  path: readonly number[],
): HubInventoryItem | null {
  const id = path.at(-1)
  if (id === undefined) return null
  const item = findInventoryItem(backpack, id)
  return item?.kind === 'sack' && item.nativeTypeId === 7008 ? item : null
}

function addBackpackFrame(context: RenderContext, layer: Container): void {
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, -63.5, 513.5)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1663.5, 513.5, -1, 1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, -63.5, 775.5, 1, -1)
  addCenteredAtlasSprite(context, layer, 'Inventory', 8, 1663.5, 775.5, -1, -1)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 21, 481)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 1631, 481)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 21, 809)
  addCenteredAtlasSprite(context, layer, 'UI', 71, 1631, 809)
  const header = HUB_INVENTORY_ROOT_CHROME.backpackHeader
  addInventorySectionHeader(
    context,
    layer,
    header.text,
    header.centerX,
    header.frameTop,
    header.baselineY,
  )
}

function addGold(context: RenderContext, layer: Container, gold: number): void {
  addCenteredAtlasSprite(
    context,
    layer,
    'UI',
    NATIVE_INVENTORY_GOLD_LEDGER.iconRecord,
    ...NATIVE_INVENTORY_GOLD_LEDGER.iconCenter,
  )
  addBitmapText(
    context,
    layer,
    gold.toLocaleString(),
    'body',
    NATIVE_INVENTORY_GOLD_LEDGER.textLeft,
    NATIVE_INVENTORY_GOLD_LEDGER.textBaselineY,
    { align: 'left', tint: 0xffffff },
  )
}

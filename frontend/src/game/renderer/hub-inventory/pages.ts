import {
  type HubInventoryItem,
  NATIVE_EQUIPMENT_LEVEL_REDUCTION_SKILL_ID,
  findInventoryItem,
  inventoryItemsAtSackPath,
  projectInventoryRootSlots,
} from '../../core-kernels/hub-economy.ts'
import { type PlayerBeltComponent } from '../../core-kernels/native-belt.ts'
import {
  type PlayerCharacterConfig,
  type WizardElement,
} from '../../core-kernels/player-character.ts'
import {
  type ProtocolPlayerEconomy,
  type ProtocolPlayerProgression,
} from '../../protocol/game-state.ts'
import {
  HUB_INVENTORY_FLYBY,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_UNFORGE_TARGET,
  hubInventoryFlybyFrame,
  hubInventoryFlybyPoint,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
} from '../hub-inventory-render-contract.ts'
import {
  addBackpackFrame,
  addGold,
  addHorizontalChain,
  addInventorySidePanelBackdrop,
  addInventorySidePanelChrome,
} from './chrome.ts'
import {
  addAtlasSprite,
  addBitmapText,
  addCenteredAtlasSprite,
  addTiledAtlas,
} from './drawing.ts'
import {
  addBelt,
  addEquipment,
  addPlayerPreview,
} from './equipment.ts'
import {
  addClippedItemIcon,
  addInventoryDragger,
  addInventoryItemInfo,
  addInventorySelection,
  addItemIcon,
  inventoryItemForDrag,
  inventoryItemForSelection,
  inventorySelectionCenter,
} from './items.ts'
import {
  type HubInventoryDragModel,
  type HubInventoryFlybyModel,
  type HubInventorySackTransitionModel,
  type HubInventorySelectionModel,
  type HubServiceInspectionModel,
  type InventoryBuildState,
  type InventoryFlybyView,
  type InventorySackPages,
  type RenderContext,
} from './model.ts'
import {
  addHagathaInventoryPane,
  addOwnedPerkInspection,
  economyRecipeIndexes,
  permanentSkillRank,
} from './services.ts'
import { addStats } from './stats.ts'
import {
  Container,
  Graphics,
} from 'pixi.js'

interface InventoryPageModel {
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
}

export function buildInventory(
  context: RenderContext,
  layer: Container,
  model: InventoryPageModel,
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

  const sackPages = buildSackPages(context, layer, model, selection, dragging, hiddenItemIds)

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

function buildSackPages(
  context: RenderContext,
  layer: Container,
  model: InventoryPageModel,
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  hiddenItemIds: ReadonlySet<number>,
): InventorySackPages | null {
  let sackPages: InventorySackPages | null = null
  if (model.sackTransition) {
    const outgoing = new Container()
    const incoming = new Container()
    outgoing.label = 'native-sack-page-outgoing'
    incoming.label = 'native-sack-page-incoming'
    addInventoryGridPage(
      context,
      outgoing,
      inventoryItemsAtSackPath(model.economy.backpack, model.sackTransition.fromPath) ?? [],
      null,
      null,
      model.config.element,
      inventorySackAtPath(model.economy.backpack, model.sackTransition.fromPath),
      hiddenItemIds,
    )
    addInventoryGridPage(
      context,
      incoming,
      inventoryItemsAtSackPath(model.economy.backpack, model.sackTransition.toPath) ?? [],
      selection,
      null,
      model.config.element,
      inventorySackAtPath(model.economy.backpack, model.sackTransition.toPath),
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
      inventoryItemsAtSackPath(model.economy.backpack, model.sackPath) ?? model.economy.backpack,
      selection,
      dragging,
      model.config.element,
      inventorySackAtPath(model.economy.backpack, model.sackPath),
      hiddenItemIds,
    )
    layer.addChild(page)
  }

  return sackPages
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

function addInventoryFlyby(
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

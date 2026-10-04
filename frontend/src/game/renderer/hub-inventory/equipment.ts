import { findInventoryItem } from '../../core-kernels/hub-economy.ts'
import {
  type PlayerBeltComponent,
  nativeBeltEntryItem,
  nativeBeltPotionProjection,
} from '../../core-kernels/native-belt.ts'
import { type WizardElement } from '../../core-kernels/player-character.ts'
import type { InventoryRunSummary } from '../../hub-inventory-ui-model.ts'
import { nativeSkillIconRecord } from '../../core-kernels/player-progression.ts'
import { nativeBeltSkillAvailability, nativeCooldownSectorPoints } from '../../skill-quickbar.ts'
import { equipmentSlotsForItem, hubEquipmentItemForAlias } from '../../hub-inventory-presentation.ts'
import { EQUIPMENT_SLOT_ORDER, itemAtEquipmentSlot } from '../../hub-inventory-equipment.ts'
import { addPlayerEquipmentPreview } from '../player-equipment-preview.ts'
import {
  NATIVE_HUD_BACKBUFFER,
  type NativeHudControlLayout,
  nativeHudModalSlideLayout,
  nativeHudRectCenter,
} from '../../native-hud-layout.ts'
import {
  type ProtocolPlayerEconomy,
  type ProtocolPlayerProgression,
} from '../../protocol/game-state.ts'
import {
  HUB_EQUIPMENT_SINK_RENDER,
  HUB_MODAL_HUD_CONTROLS,
  HUB_INVENTORY_RUN_SUMMARY_STYLE,
  hubInventoryRunSummaryLines,
  hubInventoryEquipmentSlotRects,
} from '../hub-inventory-render-contract.ts'
import { NativeElementVfxView } from '../native-element-vfx-view.ts'
import { addPrimitiveFrame } from './chrome.ts'
import {
  addAtlasSprite,
  addBitmapText,
  addCenteredAtlasSprite,
} from './drawing.ts'
import {
  addClippedItemIcon,
  addInventorySelection,
  addItemIcon,
} from './items.ts'
import {
  type HubInventoryDragModel,
  type HubInventorySelectionModel,
  type RenderContext,
  type NativeModalHudView,
} from './model.ts'
import {
  Container,
  Graphics,
  type Sprite,
} from 'pixi.js'

export function addPlayerPreview(
  context: RenderContext,
  layer: Container,
  element: WizardElement,
  economy: ProtocolPlayerEconomy,
  summary: InventoryRunSummary,
): NativeElementVfxView | null {
  const seal = addAtlasSprite(context, layer, 'UI', 62, 800, 249, { anchor: 0.5, scale: 1.25 })
  seal.alpha = 0.32
  seal.label = 'native-seal:0'
  const vfx = addPlayerEquipmentPreview(
    layer, context.playerCharacterAtlas, context.elementVfxTextures, context.modTextures,
    element, economy.equipment,
  )
  for (const line of hubInventoryRunSummaryLines(summary)) {
    addBitmapText(context, layer, line.text, HUB_INVENTORY_RUN_SUMMARY_STYLE.font,
      line.x, line.y, HUB_INVENTORY_RUN_SUMMARY_STYLE)
  }
  return vfx
}

export function addEquipment(
  context: RenderContext,
  layer: Container,
  economy: ProtocolPlayerEconomy,
  selection: HubInventorySelectionModel | null,
  dragging: HubInventoryDragModel | null,
  hiddenItemIds: ReadonlySet<number>,
  companion: boolean,
  element: WizardElement,
): void {
  const xShift = companion ? 0 : 53
  for (const [x, y] of [[1337, 224], [1337, 289], [1479, 192], [1479, 256], [1479, 321]] as const) {
    addCenteredAtlasSprite(context, layer, 'Inventory', 16, x + xShift, y)
  }
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const draggedBackpack = dragging?.owner === 'backpack'
    ? findInventoryItem(economy.backpack, dragging.itemId)
    : null
  const targetItem = draggedBackpack
  const acceptingSlots = new Set(targetItem ? equipmentSlotsForItem(targetItem, thirdRingUnlocked) : [])
  for (const slot of EQUIPMENT_SLOT_ORDER) {
    if (slot === 'ring-2' && !thirdRingUnlocked) continue
    const item = itemAtEquipmentSlot(economy, slot)
    const held = hiddenItemIds.has(item?.id ?? -1)
      || (dragging?.owner === 'equipment' && dragging.equipmentSlot === slot)
    for (const [aliasIndex, rect] of hubInventoryEquipmentSlotRects(slot, companion).entries()) {
      const displayedItem = hubEquipmentItemForAlias(item, aliasIndex)
      const selected = (acceptingSlots.has(slot) && hubEquipmentItemForAlias(targetItem, aliasIndex) !== null)
        || (selection?.owner === 'equipment' && selection.equipmentSlot === slot
          && selection.id === displayedItem?.id)
      addEquipmentSlot(context, layer, rect, displayedItem, held, selected, element)
    }
  }
}

function addEquipmentSlot(
  context: RenderContext,
  layer: Container,
  [x, y, width, height]: ReturnType<typeof hubInventoryEquipmentSlotRects>[number],
  item: ReturnType<typeof itemAtEquipmentSlot>,
  held: boolean,
  selected: boolean,
  element: WizardElement,
): void {
  layer.addChild(new Graphics()
    .rect(x, y, width, height)
    .fill({ color: HUB_EQUIPMENT_SINK_RENDER.interiorTint }))
  if (height === 46 || height === 72) {
    addAtlasSprite(
      context,
      layer,
      'Inventory',
      height === 46
        ? HUB_EQUIPMENT_SINK_RENDER.smallFrameRecord
        : HUB_EQUIPMENT_SINK_RENDER.normalFrameRecord,
      x,
      y,
    )
  } else if (HUB_EQUIPMENT_SINK_RENDER.tallPrimitiveOutline) {
    addPrimitiveFrame(layer, x + 1, y, width - 1, height - 1)
  }
  if (item && !held) addClippedItemIcon(
    context,
    layer,
    item,
    x + width / 2,
    y + height / 2,
    element,
    [x, y, width, height],
  )
  if (selected) addInventorySelection(layer, x, y, width, height)
}

export function addBelt(
  context: RenderContext,
  layer: Container,
  belt: PlayerBeltComponent,
  economy: ProtocolPlayerEconomy,
  progression: ProtocolPlayerProgression,
  element: WizardElement,
): NativeModalHudView {
  const hudLayer = new Container()
  const skillViews: {
    readonly icon: Sprite
    readonly sector: Graphics
    readonly skillId: number
    readonly slot: number
    readonly x: number
    readonly y: number
  }[] = []
  const painted = new Map<number, { readonly alpha: number; readonly capacity: number; readonly remaining: number }>()
  hudLayer.label = 'native-modal-hud'
  layer.addChild(hudLayer)
  const hud = nativeHudModalSlideLayout(
    NATIVE_HUD_BACKBUFFER.width,
    NATIVE_HUD_BACKBUFFER.height,
    0,
  )
  addModalHudControls(context, hudLayer, hud)
  hud.belt.forEach((slot, index) => {
    const { x, y } = nativeHudRectCenter(slot)
    addCenteredAtlasSprite(context, hudLayer, 'UI', 2, x, y)
    const entry = belt[index]
    if (entry?.kind === 'skill') {
      const sector = new Graphics()
      sector.label = `native-belt-cooldown:${index}`
      hudLayer.addChild(sector)
      const icon = addCenteredAtlasSprite(
        context,
        hudLayer,
        'Skills',
        nativeSkillIconRecord(entry.skillId, progression.weldBuildId),
        x,
        y,
      )
      icon.label = `native-belt-skill:${index}`
      skillViews.push({ icon, sector, skillId: entry.skillId, slot: index, x, y })
      return
    }
    if (!entry) return
    const potion = entry.kind === 'health-potion'
      ? nativeBeltPotionProjection(economy.backpack, 0)
      : entry.kind === 'mana-potion'
        ? nativeBeltPotionProjection(economy.backpack, 1)
        : null
    const item = potion?.item ?? nativeBeltEntryItem(entry, economy)
    if (!item) return
    addItemIcon(context, hudLayer, item, x, y, element)
    const quantity = potion?.count ?? item.quantity
    if (quantity > 1) addBitmapText(context, hudLayer, `${quantity}`, 'medium', x + 20, y + 22, {
      tint: 0xf4e5b4,
    })
  })
  addCenteredAtlasSprite(context, layer, 'UI', 82, 800.5, 872)
  return {
    layer: hudLayer,
    updateAvailability({ mode, playerState, progression }) {
      for (const { icon, sector, skillId, slot, x, y } of skillViews) {
        const availability = nativeBeltSkillAvailability({
          currentMana: progression.currentMana,
          mode,
          playerState,
          secondaryManaCosts: progression.secondaryManaCosts,
          skillId,
        })
        const previous = painted.get(slot)
        if (previous?.alpha === availability.iconAlpha
          && previous.capacity === availability.capacity
          && previous.remaining === availability.remaining) continue
        painted.set(slot, {
          alpha: availability.iconAlpha,
          capacity: availability.capacity,
          remaining: availability.remaining,
        })
        icon.alpha = availability.iconAlpha
        sector.clear()
        const points = nativeCooldownSectorPoints(
          availability.remaining,
          availability.capacity,
        )
        if (points.length > 0) {
          sector.poly(points.flatMap((point) => [
            x - 26.5 + point.x,
            y - 26.5 + point.y,
          ])).fill({ color: 0x801a1a, alpha: 0.75 })
        }
      }
    },
  }
}

function addModalHudControls(
  context: RenderContext,
  layer: Container,
  hud: NativeHudControlLayout,
): void {
  for (const [control, rect] of [
    [HUB_MODAL_HUD_CONTROLS.backpack, hud.backpack],
    [HUB_MODAL_HUD_CONTROLS.tome, hud.tome],
  ] as const) {
    const center = nativeHudRectCenter(rect)
    const shadow = addCenteredAtlasSprite(
      context,
      layer,
      'UI',
      control.record,
      center.x + HUB_MODAL_HUD_CONTROLS.shadowOffset[0],
      center.y + HUB_MODAL_HUD_CONTROLS.shadowOffset[1],
    )
    shadow.label = `${control.label}-shadow`
    shadow.tint = HUB_MODAL_HUD_CONTROLS.shadowTint
    const base = addCenteredAtlasSprite(context, layer, 'UI', control.record, center.x, center.y)
    base.label = control.label
  }
}

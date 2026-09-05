import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  findInventoryItem,
  inventoryItemsAtSackPath,
  inventoryItemsShareStack,
  nativeInventoryItemCanUnforge,
  projectInventoryItems,
  projectInventoryRootSlots,
  type EquipmentSlot,
  type HubInventoryAction,
} from './core-kernels/hub-economy.ts'
import { nativeInventoryItemCanBindToBelt } from './core-kernels/native-belt.ts'
import type { NativeHudRect } from './native-hud-layout.ts'
import {
  equipmentSlotsForItem,
  hubEquipmentClickAction,
  hubEquipmentItemForAlias,
} from './hub-inventory-presentation.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import { nativeSkillQuickbarDropSlot } from './skill-book-model.ts'
import type {
  HubInventoryDragModel,
  HubInventorySelectionModel,
} from './renderer/hub-inventory/model.ts'
import {
  HUB_HAT_REMOVAL_MSGBOX,
  HUB_INVENTORY_GRID,
  HUB_INVENTORY_PARENT_HOLDER,
  HUB_INVENTORY_INTERACTION,
  HUB_NATIVE_UI_SIZE,
  HUB_ROBE_REMOVAL_MSGBOX,
  HUB_UNFORGE_TARGET,
  hubInventoryEquipmentSlotRects,
  hubInventoryRootSlot,
  hubInventorySlotPosition,
  hubInventoryVisibleSlot,
} from './renderer/hub-inventory-render-contract.ts'
import type { InventoryMoveAction } from './hub-inventory-ui-model.ts'
import type { InventoryFlybyRequest } from './use-hub-inventory-flybys.ts'
import { pointerStagePosition, pointInRect } from './hub-inventory-pointer.ts'
import { NativeAction } from './HubNativeAction.tsx'
import {
  itemAtEquipmentSlot,
  EQUIPMENT_SLOT_ORDER,
  EQUIPMENT_SLOT_LABELS,
} from './hub-inventory-equipment.ts'
import {
  type HubInventoryUiNotice,
  HUB_UNFORGE_CONFIRMATION_NOTICE,
} from './hub-inventory-notices.ts'

export function InventoryActions({
  beltRects,
  companion = false,
  economy,
  onAction,
  onBeltBind,
  onDragChange,
  onDragMove,
  onFlyby,
  onMoveSound,
  onNotice,
  onOpenDye,
  onOpenSack,
  onSelect,
  selection,
  sackPath,
  storageDropRect = null,
  transitionLocked,
}: {
  beltRects: readonly NativeHudRect[]
  companion?: boolean
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onBeltBind: (itemId: number, slot: number) => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onFlyby: (request: InventoryFlybyRequest) => void
  onMoveSound: (
    cue: 'backpack-open' | 'bad-action' | 'click',
    playbackRate: number,
  ) => void
  onNotice: (notice: HubInventoryUiNotice) => void
  onOpenDye: (dyeItemId: number) => void
  onOpenSack: (sackId: number) => void
  onSelect: (selection: HubInventorySelectionModel | null) => void
  selection: HubInventorySelectionModel | null
  sackPath: readonly number[]
  storageDropRect?: readonly [number, number, number, number] | null
  transitionLocked: boolean
}) {
  const thirdRingUnlocked = economy.ownedPerkSelectors.includes(19)
  const activeRoot = inventoryItemsAtSackPath(economy.backpack, sackPath) ?? economy.backpack
  const parentSackId = sackPath.at(-1) ?? null
  const projectedBackpack = projectInventoryRootSlots(activeRoot)
    .filter(({ slot }) => (
      slot < HUB_INVENTORY_GRID.capacity - (sackPath.length > 0 ? 1 : 0)
    ))
    .map(({ item, slot }) => ({
      depth: sackPath.length,
      item,
      parentSackId,
      slot,
      visibleSlot: hubInventoryVisibleSlot(slot, sackPath.length > 0),
    }))
  const pressRef = useRef<InventoryPointerPress | null>(null)
  const equipmentClickRef = useRef<InventoryEquipmentClickPress | null>(null)
  const lastActivationRef = useRef<InventoryActivation | null>(null)
  const selectedBackpackItem = selection?.owner === 'backpack'
    ? findInventoryItem(economy.backpack, selection.id)
    : null

  const clearInventorySelection = () => {
    pressRef.current = null
    equipmentClickRef.current = null
    lastActivationRef.current = null
    onDragChange(null)
    if (selection !== null) onSelect(null)
  }

  const selectSource = (source: InventoryPointerSource, startedAtMs = performance.now()) => {
    onSelect({
      equipmentSlot: source.equipmentSlot,
      id: source.itemId,
      owner: source.owner,
      startedAtMs,
    })
  }

  const sourceIsSelected = (source: InventoryPointerSource) => selection?.id === source.itemId
    && selection.owner === source.owner
    && selection.equipmentSlot === source.equipmentSlot

  const activateSource = (source: InventoryPointerSource) => {
    if (transitionLocked) return
    if (source.owner === 'equipment') {
      if (source.equipmentSlot === 'hat') {
        onNotice(HUB_HAT_REMOVAL_MSGBOX)
        return
      }
      if (source.equipmentSlot === 'robe') {
        onNotice(HUB_ROBE_REMOVAL_MSGBOX)
        return
      }
      if (source.equipmentSlot !== null) onAction({ type: 'unequip', slot: source.equipmentSlot })
      return
    }
    const item = findInventoryItem(economy.backpack, source.itemId)
    if (!item) return
    if (item.kind === 'sack' && item.nativeTypeId === 7008) {
      onOpenSack(item.id)
      return
    }
    if (item.nativeTypeId === 7001) {
      onAction({ type: 'consume', itemId: item.id })
      return
    }
    if (item.kind === 'dye' && item.nativeTypeId === 7012 && item.nativeSubtype === 0) {
      onOpenDye(item.id)
      return
    }
    if (item.kind === 'skill-book' && item.nativeTypeId === 7012) {
      onAction({ type: 'read-skill-book', itemId: item.id })
      return
    }
    const slots = equipmentSlotsForItem(item, thirdRingUnlocked)
    const slot = slots.find((candidate) => itemAtEquipmentSlot(economy, candidate) === null) ?? slots[0]
    if (slot) onAction({ type: 'equip', itemId: item.id, slot })
  }

  const beginPointer = (source: InventoryPointerSource) => (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (transitionLocked) return
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startedAtMs = performance.now()
    if (event.pointerType === 'touch') {
      const previous = lastActivationRef.current
      if (previous && sameInventorySource(previous.source, source)
        && startedAtMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
        pressRef.current = null
        lastActivationRef.current = null
        onDragChange(null)
        activateSource(source)
        return
      }
      lastActivationRef.current = { atMs: startedAtMs, source }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pressRef.current = {
      activeDrag: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      source,
      start: pointerStagePosition(event),
    }
    if (!sourceIsSelected(source)) selectSource(source, startedAtMs)
  }

  const beginEquipmentSlot = (
    slot: EquipmentSlot,
    source: InventoryPointerSource | null,
  ) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    if (event.button !== 0) return
    if (selectedBackpackItem?.equipmentType) {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      pressRef.current = null
      onDragChange(null)
      equipmentClickRef.current = {
        action: hubEquipmentClickAction(selectedBackpackItem, slot, thirdRingUnlocked),
        cancelled: false,
        pointerId: event.pointerId,
        start: pointerStagePosition(event),
      }
      return
    }
    if (source) beginPointer(source)(event)
    else {
      event.preventDefault()
      event.stopPropagation()
      clearInventorySelection()
    }
  }

  const movePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    const equipmentClick = equipmentClickRef.current
    if (equipmentClick?.pointerId === event.pointerId) {
      const point = pointerStagePosition(event)
      const dx = point.x - equipmentClick.start.x
      const dy = point.y - equipmentClick.start.y
      if (Math.hypot(dx, dy) >= HUB_INVENTORY_INTERACTION.dragThresholdPixels) {
        equipmentClick.cancelled = true
      }
      return
    }
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const point = pointerStagePosition(event)
    if (!press.activeDrag) {
      const dx = point.x - press.start.x
      const dy = point.y - press.start.y
      if (Math.hypot(dx, dy) < HUB_INVENTORY_INTERACTION.dragThresholdPixels) return
      press.activeDrag = true
      onDragChange({
        equipmentSlot: press.source.equipmentSlot,
        itemId: press.source.itemId,
        owner: press.source.owner,
        pointer: point,
      })
    }
    onDragMove(point)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    const equipmentClick = equipmentClickRef.current
    if (equipmentClick?.pointerId === event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      equipmentClickRef.current = null
      lastActivationRef.current = null
      if (!equipmentClick.cancelled && equipmentClick.action) onAction(equipmentClick.action)
      return
    }
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointerStagePosition(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    pressRef.current = null
    if (press.activeDrag) {
      if (press.pointerType === 'touch') lastActivationRef.current = null
      onDragChange(null)
      selectSource(press.source, performance.now() - HUB_INVENTORY_INTERACTION.itemInfoDelayMs)
      dropInventorySource(
        press.source,
        point,
        economy,
        thirdRingUnlocked,
        onAction,
        onBeltBind,
        onFlyby,
        onMoveSound,
        onNotice,
        companion,
        sackPath,
        beltRects,
        storageDropRect,
      )
      return
    }
    if (press.pointerType === 'touch') return
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    if (previous && sameInventorySource(previous.source, press.source)
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
      lastActivationRef.current = null
      activateSource(press.source)
    } else lastActivationRef.current = { atMs: nowMs, source: press.source }
  }

  const cancelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (equipmentClickRef.current?.pointerId === event.pointerId) {
      equipmentClickRef.current = null
      return
    }
    const press = pressRef.current
    if (press?.pointerId !== event.pointerId) return
    if (press.pointerType === 'touch' && press.activeDrag) lastActivationRef.current = null
    pressRef.current = null
    onDragChange(null)
  }

  const keyboardSelect = (source: InventoryPointerSource) => (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (transitionLocked) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    if (!sourceIsSelected(source)) selectSource(source, nowMs)
    if (previous && sameInventorySource(previous.source, source)
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs) {
      lastActivationRef.current = null
      activateSource(source)
    } else lastActivationRef.current = { atMs: nowMs, source }
  }

  const keyboardEquipmentSlot = (
    slot: EquipmentSlot,
    source: InventoryPointerSource | null,
  ) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (transitionLocked) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (selectedBackpackItem?.equipmentType) {
      event.preventDefault()
      lastActivationRef.current = null
      const action = hubEquipmentClickAction(selectedBackpackItem, slot, thirdRingUnlocked)
      if (action) onAction(action)
      return
    }
    if (source) keyboardSelect(source)(event)
    else {
      event.preventDefault()
      clearInventorySelection()
    }
  }

  return (
    <>
      <NativeAction
        data={{ 'data-inventory-empty-space': 'true' }}
        label="Deselect inventory item"
        disabled={transitionLocked}
        rect={[0, 0, HUB_NATIVE_UI_SIZE.width, HUB_NATIVE_UI_SIZE.height]}
        tabIndex={-1}
        onClick={clearInventorySelection}
      />
      <section aria-label="Backpack">
        {sackPath.length > 0 ? (
          <NativeAction
            data={{ 'data-inventory-parent-holder': 'true' }}
            disabled={transitionLocked}
            label="Move selected item to parent inventory"
            rect={(() => {
              const position = hubInventorySlotPosition(HUB_INVENTORY_PARENT_HOLDER.visibleSlot)
              return [
                position.x,
                position.y,
                HUB_INVENTORY_GRID.cellSize,
                HUB_INVENTORY_GRID.cellSize,
              ] as const
            })()}
            onClick={() => {
              if (!selectedBackpackItem) {
                onMoveSound('bad-action', 1)
                return
              }
              onMoveSound('backpack-open', 1.25)
              onAction({
                destinationSackId: sackPath.length > 1 ? sackPath[sackPath.length - 2]! : null,
                destinationSlot: null,
                itemId: selectedBackpackItem.id,
                type: 'move-inventory-item',
              })
            }}
          />
        ) : null}
        {projectedBackpack.map(({ depth, item, parentSackId, slot, visibleSlot }) => {
          const position = hubInventorySlotPosition(visibleSlot)
          const source: InventoryPointerSource = {
            equipmentSlot: null,
            itemId: item.id,
            owner: 'backpack',
          }
          return (
            <NativeAction
              key={item.id}
              data={{
                'data-inventory-item-id': item.id,
                'data-inventory-depth': depth,
                'data-inventory-owner': 'backpack',
                'data-inventory-slot': slot,
                'data-parent-sack-id': parentSackId ?? '',
                'data-selected': selection?.id === item.id && selection.owner === 'backpack' ? 'true' : 'false',
              }}
              label={`${item.name}, quantity ${item.quantity}`}
              disabled={transitionLocked}
              rect={[position.x, position.y, HUB_INVENTORY_GRID.cellSize, HUB_INVENTORY_GRID.cellSize]}
              onKeyDown={keyboardSelect(source)}
              onPointerCancel={cancelPointer}
              onPointerDown={beginPointer(source)}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
            />
          )
        })}
      </section>
      {EQUIPMENT_SLOT_ORDER.map((slot) => {
        const item = itemAtEquipmentSlot(economy, slot)
        const locked = slot === 'ring-2' && !thirdRingUnlocked
        if (locked) return null
        return hubInventoryEquipmentSlotRects(slot, companion).map((rect, aliasIndex) => {
          const displayedItem = hubEquipmentItemForAlias(item, aliasIndex)
          const source: InventoryPointerSource | null = displayedItem ? {
            equipmentSlot: slot,
            itemId: displayedItem.id,
            owner: 'equipment',
          } : null
          return (
            <NativeAction
              key={`${slot}-${aliasIndex}`}
              data={{
                'data-equipment-alias': aliasIndex,
                'data-equipment-slot': slot,
                'data-inventory-item-id': displayedItem?.id ?? '',
                'data-inventory-owner': 'equipment',
                'data-selected': displayedItem && selection?.id === displayedItem.id
                  && selection.owner === 'equipment' && selection.equipmentSlot === slot
                  ? 'true'
                  : 'false',
              }}
              label={`${EQUIPMENT_SLOT_LABELS[slot]}${displayedItem ? `, ${displayedItem.name}` : ', empty'}`}
              disabled={transitionLocked}
              rect={rect}
              onKeyDown={keyboardEquipmentSlot(slot, source)}
              onPointerCancel={cancelPointer}
              onPointerDown={beginEquipmentSlot(slot, source)}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
            />
          )
        })
      })}
    </>
  )
}

interface InventoryPointerSource {
  readonly equipmentSlot: EquipmentSlot | null
  readonly itemId: number
  readonly owner: 'backpack' | 'equipment'
}

interface InventoryPointerPress {
  activeDrag: boolean
  readonly pointerId: number
  readonly pointerType: string
  readonly source: InventoryPointerSource
  readonly start: { readonly x: number; readonly y: number }
}

interface InventoryActivation {
  readonly atMs: number
  readonly source: InventoryPointerSource
}

interface InventoryEquipmentClickPress {
  readonly action: Extract<HubInventoryAction, { readonly type: 'equip' }> | null
  cancelled: boolean
  readonly pointerId: number
  readonly start: { readonly x: number; readonly y: number }
}

function sameInventorySource(left: InventoryPointerSource, right: InventoryPointerSource): boolean {
  return left.itemId === right.itemId
    && left.owner === right.owner
    && left.equipmentSlot === right.equipmentSlot
}

function inventoryVisibleSlotAtPoint(
  point: { readonly x: number; readonly y: number },
): number | null {
  for (let slot = 0; slot < HUB_INVENTORY_GRID.capacity; slot += 1) {
    const position = hubInventorySlotPosition(slot)
    if (pointInRect(point, [
      position.x,
      position.y,
      HUB_INVENTORY_GRID.cellSize,
      HUB_INVENTORY_GRID.cellSize,
    ])) return slot
  }
  return null
}

function dropInventorySource(
  source: InventoryPointerSource,
  point: { readonly x: number; readonly y: number },
  economy: ProtocolPlayerEconomy,
  thirdRingUnlocked: boolean,
  onAction: (action: HubInventoryAction) => void,
  onBeltBind: (itemId: number, slot: number) => void,
  onFlyby: (request: InventoryFlybyRequest) => void,
  onMoveSound: (
    cue: 'backpack-open' | 'bad-action' | 'click',
    playbackRate: number,
  ) => void,
  onNotice: (notice: HubInventoryUiNotice) => void,
  companion: boolean,
  sackPath: readonly number[],
  beltRects: readonly NativeHudRect[],
  storageDropRect: readonly [number, number, number, number] | null,
): void {
  if (source.owner === 'backpack') {
    const projected = projectInventoryItems(economy.backpack)
    const sourceEntry = projected.find(({ item }) => item.id === source.itemId)
    const activeRoot = inventoryItemsAtSackPath(economy.backpack, sackPath) ?? economy.backpack
    const hasParentRoot = sackPath.length > 0
    const visibleItems = projectInventoryRootSlots(activeRoot).filter(({ slot }) => (
      slot < HUB_INVENTORY_GRID.capacity - (hasParentRoot ? 1 : 0)
    ))
    if (!sourceEntry) return
    const item = sourceEntry.item
    const sourceSlot = hubInventoryVisibleSlot(sourceEntry.slot, hasParentRoot)
    const sourcePosition = hubInventorySlotPosition(sourceSlot)
    const sourceCenter = {
      x: sourcePosition.x + HUB_INVENTORY_GRID.cellSize / 2,
      y: sourcePosition.y + HUB_INVENTORY_GRID.cellSize / 2,
    }
    const restore = () => {
      onMoveSound('bad-action', 1)
      onFlyby({ action: null, lanes: [{ from: point, item, to: sourceCenter }] })
    }
    const dropOnSink = (): boolean => {
      if (pointInRect(point, HUB_UNFORGE_TARGET.rect)) {
        if (!nativeInventoryItemCanUnforge(item)) {
          restore()
          return true
        }
        if (item.nativeTypeId === 7008) {
          if ((item.contents?.length ?? 0) === 0) onAction({ type: 'unforge', itemId: item.id })
          else restore()
          return true
        }
        onNotice({ ...HUB_UNFORGE_CONFIRMATION_NOTICE, unforgeItemId: item.id })
        return true
      }
      if (nativeInventoryItemCanBindToBelt(item)) {
        const beltSlot = nativeSkillQuickbarDropSlot(point, beltRects)
        if (beltSlot !== null) {
          onBeltBind(item.id, beltSlot)
          return true
        }
      }
      if (storageDropRect && pointInRect(point, storageDropRect)) {
        onAction({ type: 'transfer', direction: 'to-storage', gesture: 'drag', itemId: item.id })
        return true
      }
      const slot = equipmentSlotsForItem(item, thirdRingUnlocked).find((candidate) => (
        hubInventoryEquipmentSlotRects(candidate, companion).some((rect) => pointInRect(point, rect))
      ))
      if (slot) {
        onAction({ type: 'equip', itemId: item.id, slot })
        return true
      }
      return false
    }
    const dropOnGrid = () => {
      const visibleSlot = inventoryVisibleSlotAtPoint(point)
      if (hasParentRoot && visibleSlot === 0) {
        onMoveSound('backpack-open', 1.25)
        onAction({
          type: 'move-inventory-item',
          destinationSackId: sackPath.length > 1 ? sackPath[sackPath.length - 2]! : null,
          destinationSlot: null,
          itemId: item.id,
        })
        return
      }
      const destinationSlot = visibleSlot === null
        ? null
        : hubInventoryRootSlot(visibleSlot, hasParentRoot)
      const destinationSack = destinationSlot === null
        ? null
        : visibleItems.find(({ item: candidate, slot }) => (
            slot === destinationSlot && candidate.nativeTypeId === 7008
          ))?.item ?? null
      if (destinationSack) {
        onMoveSound('backpack-open', 1.25)
        onAction({
          type: 'move-inventory-item',
          destinationSackId: destinationSack.id,
          destinationSlot: null,
          itemId: item.id,
        })
        return
      }
      if (destinationSlot !== null) {
        const action: InventoryMoveAction = {
          type: 'move-inventory-item',
          destinationSackId: sackPath.at(-1) ?? null,
          destinationSlot,
          itemId: item.id,
        }
        if (sourceEntry.parentSackId === action.destinationSackId
          && destinationSlot === sourceEntry.slot) {
          restore()
          return
        }
        const resident = visibleItems.find(({ slot }) => slot === destinationSlot)?.item ?? null
        if (!resident) {
          onAction(action)
          return
        }
        onMoveSound('click', 1.75)
        if (inventoryItemsShareStack(resident, item)) {
          onAction(action)
          return
        }
        const destinationPosition = hubInventorySlotPosition(
          hubInventoryVisibleSlot(destinationSlot, hasParentRoot),
        )
        const destinationCenter = {
          x: destinationPosition.x + HUB_INVENTORY_GRID.cellSize / 2,
          y: destinationPosition.y + HUB_INVENTORY_GRID.cellSize / 2,
        }
        onFlyby({
          action,
          lanes: [
            { from: sourceCenter, item, to: destinationCenter },
            { from: destinationCenter, item: resident, to: sourceCenter },
          ],
        })
        return
      }
      restore()
      return
    }
    if (!dropOnSink()) dropOnGrid()
    return
  }
  if (source.equipmentSlot !== null) {
    const item = itemAtEquipmentSlot(economy, source.equipmentSlot)
    if (item && nativeInventoryItemCanBindToBelt(item)) {
      const beltSlot = nativeSkillQuickbarDropSlot(point, beltRects)
      if (beltSlot !== null) {
        onBeltBind(item.id, beltSlot)
        return
      }
    }
  }
  if (source.equipmentSlot === null || !pointInRect(point, [0, 490, 1600, 310])) return
  if (source.equipmentSlot === 'hat') {
    onNotice(HUB_HAT_REMOVAL_MSGBOX)
    return
  }
  if (source.equipmentSlot === 'robe') {
    onNotice(HUB_ROBE_REMOVAL_MSGBOX)
    return
  }
  onAction({ type: 'unequip', slot: source.equipmentSlot })
}

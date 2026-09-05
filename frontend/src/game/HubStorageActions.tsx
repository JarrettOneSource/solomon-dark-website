import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { projectInventoryRootSlots, type HubInventoryAction } from './core-kernels/hub-economy.ts'
import type { ProtocolPlayerEconomy } from './protocol/game-state.ts'
import type {
  HubInventoryDragModel,
  HubServiceInspectionModel,
} from './renderer/hub-inventory/model.ts'
import {
  HUB_INVENTORY_INTERACTION,
  HUB_SHOP_GRID,
  HUB_SHOP_PANEL,
  hubShopSlotPosition,
} from './renderer/hub-inventory-render-contract.ts'
import type { HubServiceSelection } from './hub-inventory-ui-model.ts'
import { pointerStagePosition, pointInRect } from './hub-inventory-pointer.ts'
import { NativeAction } from './HubNativeAction.tsx'
import { EmptyStoreGridActions } from './HubStoreGridActions.tsx'

export function InventoryShopStorageActions({
  economy,
  onAction,
  onClose,
  onDragChange,
  onDragMove,
  onFocusInspection,
  onHoverInspection,
  onInteractionSound,
  onSelect,
  selection,
}: {
  economy: ProtocolPlayerEconomy
  onAction: (action: HubInventoryAction) => void
  onClose: () => void
  onDragChange: (drag: HubInventoryDragModel | null) => void
  onDragMove: (point: { readonly x: number; readonly y: number }) => void
  onFocusInspection: (inspection: HubServiceInspectionModel | null) => void
  onHoverInspection: (inspection: HubServiceInspectionModel | null) => void
  onInteractionSound: (cue: 'shop-activation' | 'storage-drag-start') => void
  onSelect: (selection: HubServiceSelection | null) => void
  selection: HubServiceSelection | null
}) {
  const pressRef = useRef<StoragePointerPress | null>(null)
  const lastActivationRef = useRef<StorageActivation | null>(null)
  const projectedStorage = projectInventoryRootSlots(economy.storage)
    .filter(({ slot }) => slot < HUB_SHOP_GRID.retainedCapacity)
    .map(({ item, slot }) => ({ depth: 0, item, parentSackId: null, slot }))

  const clearStorageSelection = () => {
    pressRef.current = null
    lastActivationRef.current = null
    onDragChange(null)
    if (selection === null) return
    onInteractionSound('shop-activation')
    onSelect(null)
  }

  const sourceIsSelected = (itemId: number) => (
    selection?.id === itemId && selection.owner === 'storage'
  )
  const selectSource = (itemId: number) => (
    onSelect({ id: itemId, owner: 'storage' })
  )

  const beginPointer = (itemId: number) => (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (event.pointerType === 'touch') {
      const nowMs = performance.now()
      const previous = lastActivationRef.current
      const doubled = previous
        && previous.itemId === itemId
        && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs
      onInteractionSound('shop-activation')
      if (doubled) {
        pressRef.current = null
        lastActivationRef.current = null
        onDragChange(null)
        onAction({
          type: 'transfer',
          direction: 'to-backpack',
          gesture: 'double-activation',
          itemId,
        })
        return
      }
      lastActivationRef.current = { atMs: nowMs, itemId }
      if (!sourceIsSelected(itemId)) selectSource(itemId)
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    pressRef.current = {
      activeDrag: false,
      itemId,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      start: pointerStagePosition(event),
    }
  }

  const movePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    const point = pointerStagePosition(event)
    if (!press.activeDrag) {
      const dx = point.x - press.start.x
      const dy = point.y - press.start.y
      if (Math.hypot(dx, dy) < HUB_INVENTORY_INTERACTION.dragThresholdPixels) return
      press.activeDrag = true
      selectSource(press.itemId)
      onInteractionSound('storage-drag-start')
      onDragChange({
        equipmentSlot: null,
        itemId: press.itemId,
        owner: 'storage',
        pointer: point,
      })
    }
    onDragMove(point)
  }

  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
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
      selectSource(press.itemId)
      const validDrop = pointInRect(point, [0, 490, 1600, 310])
      if (validDrop) onAction({
        type: 'transfer',
        direction: 'to-backpack',
        gesture: 'drag',
        itemId: press.itemId,
      })
      return
    }

    if (press.pointerType === 'touch') return

    const nowMs = performance.now()
    const previous = lastActivationRef.current
    const doubled = previous
      && previous.itemId === press.itemId
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs
    onInteractionSound('shop-activation')
    if (doubled) {
      lastActivationRef.current = null
      onAction({
        type: 'transfer',
        direction: 'to-backpack',
        gesture: 'double-activation',
        itemId: press.itemId,
      })
    } else {
      lastActivationRef.current = { atMs: nowMs, itemId: press.itemId }
      if (!sourceIsSelected(press.itemId)) selectSource(press.itemId)
    }
  }

  const cancelPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current
    if (press?.pointerId !== event.pointerId) return
    if (press.pointerType === 'touch' && press.activeDrag) lastActivationRef.current = null
    pressRef.current = null
    onDragChange(null)
  }

  const keyboardActivate = (itemId: number) => (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    const nowMs = performance.now()
    const previous = lastActivationRef.current
    const doubled = previous
      && previous.itemId === itemId
      && nowMs - previous.atMs <= HUB_INVENTORY_INTERACTION.doubleActivationMs
    onInteractionSound('shop-activation')
    if (doubled) {
      lastActivationRef.current = null
      onAction({
        type: 'transfer',
        direction: 'to-backpack',
        gesture: 'double-activation',
        itemId,
      })
    } else {
      lastActivationRef.current = { atMs: nowMs, itemId }
      selectSource(itemId)
    }
  }

  return (
    <>
      <section aria-label="Scavenged Goods">
        {projectedStorage.map(({ depth, item, parentSackId, slot }) => {
          const position = hubShopSlotPosition(slot)
          return (
            <NativeAction
              key={item.id}
              data={{
                'data-inventory-item-id': item.id,
                'data-inventory-depth': depth,
                'data-inventory-owner': 'storage',
                'data-inventory-slot': slot,
                'data-parent-sack-id': parentSackId ?? '',
                'data-selected': sourceIsSelected(item.id) ? 'true' : 'false',
              }}
              label={`${item.name}, quantity ${item.quantity}`}
              rect={[
                position.x,
                position.y,
                HUB_SHOP_GRID.cellSize,
                HUB_SHOP_GRID.cellSize,
              ]}
              onBlur={() => onFocusInspection(null)}
              onFocus={() => onFocusInspection({
                id: item.id,
                kind: 'store-item',
                owner: 'storage',
              })}
              onKeyDown={keyboardActivate(item.id)}
              onPointerCancel={cancelPointer}
              onPointerDown={beginPointer(item.id)}
              onPointerEnter={() => onHoverInspection({
                id: item.id,
                kind: 'store-item',
                owner: 'storage',
              })}
              onPointerLeave={() => onHoverInspection(null)}
              onPointerMove={movePointer}
              onPointerUp={finishPointer}
            />
          )
        })}
        <EmptyStoreGridActions
          fromIndex={0}
          occupiedSlots={projectedStorage.map(({ slot }) => slot)}
          onClear={clearStorageSelection}
        />
      </section>
      <NativeAction gameBack label="Done" rect={HUB_SHOP_PANEL.doneRect} onClick={onClose} />
    </>
  )
}

interface StoragePointerPress {
  activeDrag: boolean
  readonly itemId: number
  readonly pointerId: number
  readonly pointerType: string
  readonly start: { readonly x: number; readonly y: number }
}

interface StorageActivation {
  readonly atMs: number
  readonly itemId: number
}

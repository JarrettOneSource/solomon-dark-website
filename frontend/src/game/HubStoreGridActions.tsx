import {
  HUB_DOWSING_GRID,
  HUB_SHOP_GRID,
  hubDowsingSlotPosition,
  hubShopSlotPosition,
} from './renderer/hub-inventory-render-contract.ts'
import { NativeAction } from './HubNativeAction.tsx'

export function ShopAction({
  data,
  dowsing = false,
  index,
  label,
  onBlur,
  onClick,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  position,
  price,
  selected,
}: {
  data?: Record<string, number | string>
  dowsing?: boolean
  index: number
  label: string
  onBlur: () => void
  onClick: () => void
  onFocus: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  position?: { readonly x: number; readonly y: number }
  price: number
  selected: boolean
}) {
  const slotPosition = position
    ?? (dowsing ? hubDowsingSlotPosition(index) : hubShopSlotPosition(index))
  return (
    <NativeAction
      data={{ ...data, 'data-selected': selected ? 'true' : 'false' }}
      label={label}
      rect={[
        slotPosition.x,
        slotPosition.y,
        dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
        dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
      ]}
      onBlur={onBlur}
      onClick={onClick}
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse') event.preventDefault()
      }}
    >
      <span className="hub-native-ui-semantic hub-trader-price">{price.toLocaleString()}</span>
    </NativeAction>
  )
}

export function EmptyStoreGridActions({
  dowsing = false,
  fromIndex,
  occupiedSlots,
  onClear,
  positionAt,
}: {
  dowsing?: boolean
  fromIndex: number
  occupiedSlots?: readonly number[]
  onClear: () => void
  positionAt?: (index: number) => { readonly x: number; readonly y: number }
}) {
  const capacity = dowsing
    ? HUB_DOWSING_GRID.retainedCapacity
    : HUB_SHOP_GRID.retainedCapacity
  const occupied = new Set(occupiedSlots ?? [])
  const indices = occupiedSlots === undefined
    ? Array.from({ length: Math.max(0, capacity - fromIndex) }, (_, offset) => fromIndex + offset)
    : Array.from({ length: capacity }, (_, index) => index).filter((index) => !occupied.has(index))
  return indices.map((index) => {
    const position = positionAt?.(index)
      ?? (dowsing ? hubDowsingSlotPosition(index) : hubShopSlotPosition(index))
    return (
      <NativeAction
        key={`empty-store-${index}`}
        data={{ 'data-store-empty-slot': index }}
        label="Empty store slot"
        rect={[
          position.x,
          position.y,
          dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
          dowsing ? HUB_DOWSING_GRID.cellSize : HUB_SHOP_GRID.cellSize,
        ]}
        tabIndex={-1}
        onClick={onClear}
      />
    )
  })
}

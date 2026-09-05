import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { HUB_NATIVE_UI_SIZE } from './renderer/hub-inventory-render-contract.ts'
import type { HubServiceSelection } from './hub-inventory-ui-model.ts'

export function pointerStagePosition(
  event: ReactPointerEvent<HTMLElement> | ReactWheelEvent<HTMLElement>,
): { readonly x: number; readonly y: number } {
  const stage = event.currentTarget.closest('.hub-native-ui-stage')
  if (!(stage instanceof HTMLElement)) return { x: event.clientX, y: event.clientY }
  const rect = stage.getBoundingClientRect()
  return {
    x: (event.clientX - rect.left) * HUB_NATIVE_UI_SIZE.width / rect.width,
    y: (event.clientY - rect.top) * HUB_NATIVE_UI_SIZE.height / rect.height,
  }
}

export function pointInRect(
  point: { readonly x: number; readonly y: number },
  [left, top, width, height]: readonly [number, number, number, number],
): boolean {
  return point.x >= left && point.x <= left + width
    && point.y >= top && point.y <= top + height
}

export function nativeUiActionRect(bounds: Readonly<{
  height: number
  left: number
  top: number
  width: number
}>): readonly [number, number, number, number] {
  return [bounds.left, bounds.top, bounds.width, bounds.height]
}

export function activateSelection(
  current: HubServiceSelection | null,
  next: HubServiceSelection,
  select: (selection: HubServiceSelection | null) => void,
  activate: () => void,
): void {
  if (current?.id === next.id && current.owner === next.owner) activate()
  else select(next)
}

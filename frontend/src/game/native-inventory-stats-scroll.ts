import { clampNativeUiSwipeBoxOffset } from './native-ui/core.ts'
import {
  HUB_INVENTORY_STATS_PAGES,
  hubInventoryStatsPage,
  hubNativeUiElapsedTicks,
} from './renderer/hub-inventory-render-contract.ts'

export interface NativeInventoryStatsScroll {
  readonly page: 0 | 1 | 2
  readonly startOffset: number
  readonly startedAtMs: number
}

export function createNativeInventoryStatsScroll(page: number, nowMs: number): NativeInventoryStatsScroll {
  return {
    page: hubInventoryStatsPage(page),
    startOffset: page * HUB_INVENTORY_STATS_PAGES.pageHeight,
    startedAtMs: nowMs,
  }
}

export function nativeInventoryStatsScrollOffset(scroll: NativeInventoryStatsScroll, nowMs: number): number {
  const target = scroll.page * HUB_INVENTORY_STATS_PAGES.pageHeight
  let offset = scroll.startOffset
  const ticks = hubNativeUiElapsedTicks(nowMs - scroll.startedAtMs)
  for (let tick = 0; tick < ticks && offset !== target; tick += 1) {
    const error = Math.fround(target - offset)
    const step = Math.abs(error) > 1 ? Math.fround(error * 0.15000000596046448) : error
    offset = Math.fround(offset + step)
  }
  return clampNativeUiSwipeBoxOffset(
    offset,
    HUB_INVENTORY_STATS_PAGES.contentHeight,
    HUB_INVENTORY_STATS_PAGES.pageHeight,
  )
}

export function retargetNativeInventoryStatsScroll(
  scroll: NativeInventoryStatsScroll,
  page: number,
  nowMs: number,
): NativeInventoryStatsScroll {
  const target = hubInventoryStatsPage(page)
  return target === scroll.page ? scroll : {
    page: target,
    startOffset: nativeInventoryStatsScrollOffset(scroll, nowMs),
    startedAtMs: nowMs,
  }
}

export function nativeInventoryStatsDragStep(
  origin: { readonly x: number; readonly y: number },
  pointer: { readonly x: number; readonly y: number },
): -1 | 0 | 1 | null {
  const dx = Math.fround(origin.x - pointer.x)
  const dy = Math.fround(origin.y - pointer.y)
  if (Math.fround(dx * dx + dy * dy) <= 3) return null
  if (dy === 0) return 0
  return dy > 0 ? 1 : -1
}

import type { HubInventoryItem } from '../core-kernels/hub-economy.ts'
import { nativeEquipmentTooltipSetForRecipe } from '../core-kernels/native-equipment-effects.ts'
import { HUB_EQUIPMENT_SINK_RENDER, HUB_INVENTORY_GRID } from './hub-inventory-render-contract.ts'

export interface HubInventoryItemFrame {
  readonly record: number
  readonly rect: readonly [x: number, y: number, width: number, height: number]
  readonly alpha: number
  readonly tiled: boolean
}

export interface HubInventoryFrameTile {
  readonly sourceUv: readonly [number, number, number, number]
  readonly x: number
  readonly y: number
}

// 0x4153B0 -> 0x414A20/0x414900/0x414760. These are overlapping,
// unscaled texture thirds at a logical-third pitch, including cropped tails.
// The tiny inset is relative to the ATLAS page, not the individual record.
export function hubInventoryFrameTiles(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
): readonly HubInventoryFrameTile[] {
  const axis = (source: number, target: number, page: number) => {
    const pitch = Math.fround(source / 3)
    const third = Math.fround(Math.fround(1 / 3) + 0.5 / page)
    const twiceThird = Math.fround(third * 2)
    const extent = Math.fround(target - pitch * 2)
    const count = Math.trunc(extent / pitch)
    const remainder = Math.fround(extent / pitch - count)
    const bands = [{ low: 0, high: third, translation: 0, middle: false }]
    for (let index = 0; index < count; index++) {
      bands.push({ low: third, high: twiceThird, translation: Math.fround(index * pitch), middle: true })
    }
    const tailEnd = Math.fround(third + remainder * third)
    if (tailEnd > third) bands.push({ low: third, high: tailEnd, translation: Math.fround(count * pitch), middle: true })
    bands.push({ low: twiceThird, high: 1, translation: target - source, middle: false })
    return bands
  }
  const horizontal = axis(sourceWidth, width, pageWidth)
  const vertical = axis(sourceHeight, height, pageHeight)
  return vertical.flatMap(row => horizontal.filter(column => !row.middle || !column.middle).map(column => ({
    sourceUv: [column.low, row.low, column.high, row.high] as const,
    x: column.translation + column.low * sourceWidth,
    y: row.translation + row.low * sourceHeight,
  })))
}

// Native 0x571B70: a set candidate with a resolved recipe and parent set.
// The web item already carries the recovered recipe identity; do not infer sets
// from rarity, item names, tooltip colors or whether the complete set is equipped.
export function hubInventoryItemFrame(
  owner: 'inventory' | 'equipment',
  item: HubInventoryItem | null | undefined,
  [x, y, width, height]: HubInventoryItemFrame['rect'],
): HubInventoryItemFrame {
  const belongsToSet = item?.kind === 'equipment' && item.recipeIndex !== null
    && nativeEquipmentTooltipSetForRecipe(item.recipeIndex) !== null
  const small = owner === 'equipment' && height === 46
  const outset = belongsToSet ? 4 : 0
  return {
    record: belongsToSet ? (small ? 14 : 15)
      : (small ? HUB_EQUIPMENT_SINK_RENDER.smallFrameRecord : HUB_EQUIPMENT_SINK_RENDER.normalFrameRecord),
    rect: [x - outset, y - outset, width + outset * 2, height + outset * 2],
    alpha: owner === 'inventory' && !belongsToSet ? HUB_INVENTORY_GRID.slotAlpha : 1,
    tiled: owner === 'equipment' && height !== 46 && height !== 72,
  }
}

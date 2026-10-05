import type { BoneyardBounds } from '../core-kernels/boneyard.ts'

/** MagicGrid 0x00588040 admits whole 50-unit cells, including its outer border. */
export function compactGridCells(bounds: Readonly<BoneyardBounds>, maximumColumn: number, maximumRow: number) {
  const cell = (value: number, maximum: number): number => {
    const integer = Math.trunc(Math.fround(value))
    return integer < 0 ? -1 : Math.min(Math.trunc(integer / 50), maximum)
  }
  return {
    left: cell(bounds.x, maximumColumn), right: cell(Math.fround(bounds.x) + Math.fround(bounds.w), maximumColumn),
    top: cell(bounds.y, maximumRow), bottom: cell(Math.fround(bounds.y) + Math.fround(bounds.h), maximumRow),
  }
}

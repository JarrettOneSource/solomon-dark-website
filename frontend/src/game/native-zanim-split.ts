import type { NativeRegionPainterInsertion } from './region-painter-order.ts'

export const NATIVE_ZANIM_SPLIT_ENHANCED_BAND_HEIGHT = 25
export const NATIVE_ZANIM_SPLIT_STANDARD_BAND_HEIGHT = 50
export const NATIVE_ZANIM_SPLIT_CLIP_WIDTH = 10_000

export interface NativeZAnimSplitBounds {
  readonly height: number
  readonly y: number
}

export interface NativeZAnimSplitBand {
  readonly clip: Readonly<{
    height: number
    width: number
    x: number
    y: number
  }>
  readonly id: string
  readonly painterY: number
}

export function buildNativeZAnimSplitBands(
  ownerId: string,
  bounds: NativeZAnimSplitBounds,
  enhancedEffects: boolean,
): readonly NativeZAnimSplitBand[] {
  if (ownerId.length === 0) throw new Error('native ZAnimSplit owner id must not be empty')
  if (!Number.isFinite(bounds.y) || !Number.isFinite(bounds.height) || bounds.height < 0) {
    throw new RangeError('native ZAnimSplit bounds must be finite with nonnegative height')
  }
  const bandHeight = enhancedEffects
    ? NATIVE_ZANIM_SPLIT_ENHANCED_BAND_HEIGHT
    : NATIVE_ZANIM_SPLIT_STANDARD_BAND_HEIGHT
  const count = Math.ceil(bounds.height / bandHeight)
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const y = bounds.y + index * bandHeight
    return Object.freeze({
      clip: Object.freeze({
        height: bandHeight,
        width: NATIVE_ZANIM_SPLIT_CLIP_WIDTH,
        x: 0,
        y,
      }),
      id: `${ownerId}:band-${index}`,
      painterY: y + bandHeight,
    })
  }))
}

export function nativeZAnimSplitInsertions(
  bands: readonly NativeZAnimSplitBand[],
): readonly NativeRegionPainterInsertion[] {
  return Object.freeze(bands.map((band) => Object.freeze({
    id: band.id,
    sortBias: 0,
    visible: true,
    worldY: band.painterY,
  })))
}

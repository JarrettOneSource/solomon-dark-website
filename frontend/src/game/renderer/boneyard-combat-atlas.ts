import { Rectangle, Texture } from 'pixi.js'

import {
  BONEYARD_COMBAT_ATLAS_DECODED_BYTES,
  BONEYARD_COMBAT_ATLAS_EMPTY_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_FRAMES,
  BONEYARD_COMBAT_ATLAS_MAX_PAGE_SIZE,
  BONEYARD_COMBAT_ATLAS_PACKED_RECTANGLE_COUNT,
  BONEYARD_COMBAT_ATLAS_PACKED_RGBA_BYTES,
  BONEYARD_COMBAT_ATLAS_PAGE_DIMENSIONS,
  BONEYARD_COMBAT_ATLAS_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_SOURCES,
  type BoneyardCombatPackedFrame,
} from './boneyard-combat-atlas.generated.ts'

export {
  BONEYARD_COMBAT_ATLAS_DECODED_BYTES,
  BONEYARD_COMBAT_ATLAS_EMPTY_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_MAX_PAGE_SIZE,
  BONEYARD_COMBAT_ATLAS_PACKED_RECTANGLE_COUNT,
  BONEYARD_COMBAT_ATLAS_PACKED_RGBA_BYTES,
  BONEYARD_COMBAT_ATLAS_PAGE_DIMENSIONS,
  BONEYARD_COMBAT_ATLAS_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_SOURCES,
}

export interface BoneyardCombatAtlas {
  destroy(): void
  single(source: string): Texture
}

export function boneyardCombatAtlasSourceIsPacked(source: string): boolean {
  return BONEYARD_COMBAT_ATLAS_FRAMES.has(source)
}

export function createBoneyardCombatAtlas(
  texture: (source: string) => Texture,
): BoneyardCombatAtlas {
  const pages = BONEYARD_COMBAT_ATLAS_SOURCES.map(texture)
  const frames = new Map<string, Texture>()
  return {
    destroy() {
      for (const frame of frames.values()) frame.destroy(false)
      frames.clear()
    },
    single(source) {
      const cached = frames.get(source)
      if (cached) return cached
      const packed = BONEYARD_COMBAT_ATLAS_FRAMES.get(source)
      if (packed === undefined) {
        throw new RangeError(`Missing packed Boneyard combat source ${source}`)
      }
      const frame = packedCombatTexture(pages, packed, source)
      frames.set(source, frame)
      return frame
    },
  }
}

function packedCombatTexture(
  pages: readonly Texture[],
  packed: BoneyardCombatPackedFrame,
  source: string,
): Texture {
  if (packed === null) {
    throw new RangeError(`Packed Boneyard combat source is unexpectedly empty: ${source}`)
  }
  const [
    page,
    x,
    y,
    width,
    height,
    logicalWidth,
    logicalHeight,
    trimX,
    trimY,
  ] = packed
  const pageTexture = pages[page]
  if (!pageTexture) throw new RangeError(`Missing Boneyard combat atlas page ${page}`)
  return new Texture({
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
    source: pageTexture.source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}

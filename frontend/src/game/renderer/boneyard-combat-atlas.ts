import { Rectangle, type Texture } from 'pixi.js'

import {
  BONEYARD_COMBAT_ATLAS_DECODED_BYTES,
  BONEYARD_COMBAT_ATLAS_EMPTY_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_FRAMES,
  BONEYARD_COMBAT_ATLAS_LAYOUT,
  BONEYARD_COMBAT_ATLAS_MAX_PAGE_SIZE,
  BONEYARD_COMBAT_ATLAS_PACKED_RECTANGLE_COUNT,
  BONEYARD_COMBAT_ATLAS_PACKED_RGBA_BYTES,
  BONEYARD_COMBAT_ATLAS_PAGE_DIMENSIONS,
  BONEYARD_COMBAT_ATLAS_PAGE_SHA256,
  BONEYARD_COMBAT_ATLAS_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_SOURCES,
  type BoneyardCombatPackedFrame,
} from './boneyard-combat-atlas.generated.ts'
import { nativeSpriteRecordTexture } from './native-sprite-record-texture.ts'

export {
  BONEYARD_COMBAT_ATLAS_DECODED_BYTES,
  BONEYARD_COMBAT_ATLAS_EMPTY_SOURCE_COUNT,
  BONEYARD_COMBAT_ATLAS_LAYOUT,
  BONEYARD_COMBAT_ATLAS_MAX_PAGE_SIZE,
  BONEYARD_COMBAT_ATLAS_PACKED_RECTANGLE_COUNT,
  BONEYARD_COMBAT_ATLAS_PACKED_RGBA_BYTES,
  BONEYARD_COMBAT_ATLAS_PAGE_DIMENSIONS,
  BONEYARD_COMBAT_ATLAS_PAGE_SHA256,
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
  const pages = new Map<number, Texture>()
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
      const frame = packedCombatTexture((page) => {
        const cachedPage = pages.get(page)
        if (cachedPage) return cachedPage
        const pageSource = BONEYARD_COMBAT_ATLAS_SOURCES[page]
        if (!pageSource) throw new RangeError(`Missing Boneyard combat atlas page ${page}`)
        const loadedPage = texture(pageSource)
        pages.set(page, loadedPage)
        return loadedPage
      }, packed, source)
      frames.set(source, frame)
      return frame
    },
  }
}

function packedCombatTexture(
  pageTexture: (page: number) => Texture,
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
  const pageSource = pageTexture(page)
  return nativeSpriteRecordTexture({
    frame: new Rectangle(x, y, width, height),
    orig: new Rectangle(0, 0, logicalWidth, logicalHeight),
    source: pageSource.source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}

import { Rectangle, Texture } from 'pixi.js'

import {
  PLAYER_CHARACTER_ATLAS_DECODED_BYTES,
  PLAYER_CHARACTER_ATLAS_EMPTY_FRAME_COUNT,
  PLAYER_CHARACTER_ATLAS_FRAME_COUNT,
  PLAYER_CHARACTER_ATLAS_PAGE_SIZE,
  PLAYER_CHARACTER_ATLAS_RECTANGLES,
  PLAYER_CHARACTER_ATLAS_SHEETS,
  PLAYER_CHARACTER_ATLAS_SOURCE_SHEET_COUNT,
  PLAYER_CHARACTER_ATLAS_SOURCES,
} from './player-character-atlas.generated.ts'

export {
  PLAYER_CHARACTER_ATLAS_DECODED_BYTES,
  PLAYER_CHARACTER_ATLAS_EMPTY_FRAME_COUNT,
  PLAYER_CHARACTER_ATLAS_FRAME_COUNT,
  PLAYER_CHARACTER_ATLAS_PAGE_SIZE,
  PLAYER_CHARACTER_ATLAS_SOURCE_SHEET_COUNT,
  PLAYER_CHARACTER_ATLAS_SOURCES,
}

export const PLAYER_CHARACTER_SHEETS = Object.freeze({
  death: {
    air: 'player-character-death-air',
    earth: 'player-character-death-earth',
    ether: 'player-character-death-ether',
    fire: 'player-character-death-fire',
    water: 'player-character-death-water',
  },
  deathHat: {
    primary: Array.from(
      { length: 4 },
      (_, selector) => `player-character-death-hat-primary-${selector}`,
    ),
    secondary: Array.from(
      { length: 4 },
      (_, selector) => `player-character-death-hat-secondary-${selector}`,
    ),
    specialPrimary: 'player-character-death-hat-special-primary',
    specialSecondary: 'player-character-death-hat-special-secondary',
  },
  deathRobe: {
    fixedPrimary: [
      'player-character-death-robe-fixed-primary-a',
      'player-character-death-robe-fixed-primary-b',
    ],
    fixedSecondary: [
      'player-character-death-robe-fixed-secondary-a',
      'player-character-death-robe-fixed-secondary-b',
    ],
    primary: Array.from(
      { length: 3 },
      (_, selector) => `player-character-death-robe-primary-${selector}`,
    ),
    secondary: Array.from(
      { length: 3 },
      (_, selector) => `player-character-death-robe-secondary-${selector}`,
    ),
  },
  deathWeapon: {
    staff: Array.from(
      { length: 6 },
      (_, selector) => `player-character-death-staff-${selector}`,
    ),
    wand: 'player-character-death-wand',
  },
  staffBack: 'player-character-staff-back',
  robeDynamic: {
    air: 'player-character-robe-dynamic-air',
    earth: 'player-character-robe-dynamic-earth',
    ether: 'player-character-robe-dynamic-ether',
    fire: 'player-character-robe-dynamic-fire',
    water: 'player-character-robe-dynamic-water',
  },
  robeFixed: {
    air: 'player-character-robe-fixed-air',
    earth: 'player-character-robe-fixed-earth',
    ether: 'player-character-robe-fixed-ether',
    fire: 'player-character-robe-fixed-fire',
    water: 'player-character-robe-fixed-water',
  },
  staffFront: 'player-character-staff-front',
  head: {
    air: 'player-character-head-air',
    earth: 'player-character-head-earth',
    ether: 'player-character-head-ether',
    fire: 'player-character-head-fire',
    water: 'player-character-head-water',
  },
  hatStyles: Array.from({ length: 4 }, (_, selector) => ({
    primary: `player-character-hat-${selector}-primary`,
    secondary: `player-character-hat-${selector}-secondary`,
  })),
  robeStyles: Array.from({ length: 3 }, (_, selector) => ({
    primary: `player-character-robe-${selector}-primary`,
    secondary: `player-character-robe-${selector}-secondary`,
  })),
  robeFixedLayers: {
    primary: 'player-character-robe-fixed-primary',
    secondary: 'player-character-robe-fixed-secondary',
  },
  bareAttachment: {
    back: 'player-character-bare-attachment-back',
    front: 'player-character-bare-attachment-front',
  },
  staffStyles: Array.from({ length: 6 }, (_, selector) => ({
    back: `player-character-staff-${selector}-back`,
    front: `player-character-staff-${selector}-front`,
  })),
  unselectedAttachment: {
    back: 'player-character-unselected-attachment-back',
    front: 'player-character-unselected-attachment-front',
    robe: 'player-character-unselected-robe-attachment',
  },
  wand: {
    back: 'player-character-wand-back',
    front: 'player-character-wand-front',
  },
})

export interface PlayerCharacterAtlas {
  destroy(): void
  frame(name: string, column: number, row: number): Texture
  grid(name: string, columns: number, rows: number): Texture[][]
  single(name: string): Texture
  strip(name: string, count: number): Texture[]
}

export interface PlayerCharacterAtlasCssFrame {
  readonly backgroundImage: string
  readonly backgroundPosition: string
  readonly backgroundRepeat: 'no-repeat'
  readonly display?: 'none'
  readonly height: string
  readonly left: string
  readonly position: 'absolute'
  readonly top: string
  readonly width: string
}

export function createPlayerCharacterAtlas(
  texture: (source: string) => Texture,
): PlayerCharacterAtlas {
  const pages = PLAYER_CHARACTER_ATLAS_SOURCES.map(texture)
  const cache = new Map<string, Texture[][]>()

  const grid = (name: string, columns: number, rows: number): Texture[][] => {
    const cached = cache.get(name)
    if (cached) return cached
    const sheet = PLAYER_CHARACTER_ATLAS_SHEETS[name]
    if (!sheet) throw new RangeError(`Missing packed player-character sheet ${name}`)
    const [packedColumns, packedRows, originalWidth, originalHeight, frames] = sheet
    if (packedColumns !== columns || packedRows !== rows) {
      throw new RangeError(
        `Packed player-character sheet ${name} is ${packedColumns}x${packedRows}, expected ${columns}x${rows}`,
      )
    }
    const result = Array.from({ length: rows }, (_, row) => Array.from(
      { length: columns },
      (_, column) => packedFrameTexture(
        pages,
        frames[row * columns + column] ?? null,
        originalWidth,
        originalHeight,
      ),
    ))
    cache.set(name, result)
    return result
  }

  return {
    destroy() {
      for (const rows of cache.values()) {
        for (const row of rows) for (const frame of row) frame.destroy(false)
      }
      cache.clear()
    },
    frame(name, column, row) {
      const sheet = PLAYER_CHARACTER_ATLAS_SHEETS[name]
      if (!sheet) throw new RangeError(`Missing packed player-character sheet ${name}`)
      const [columns, rows] = sheet
      if (column < 0 || column >= columns || row < 0 || row >= rows) {
        throw new RangeError(`Packed player-character frame ${name}:${column}:${row} is outside its sheet`)
      }
      return grid(name, columns, rows)[row]![column]!
    },
    grid,
    single(name) {
      return grid(name, 1, 1)[0]![0]!
    },
    strip(name, count) {
      const sheet = PLAYER_CHARACTER_ATLAS_SHEETS[name]
      if (!sheet) throw new RangeError(`Missing packed player-character sheet ${name}`)
      const [columns, rows] = sheet
      if (columns * rows !== count || (columns !== 1 && rows !== 1)) {
        throw new RangeError(
          `Packed player-character strip ${name} has ${columns * rows} frames, expected ${count}`,
        )
      }
      return grid(name, columns, rows).flat()
    },
  }
}

export function playerCharacterAtlasCssFrame(
  name: string,
  column: number,
  row: number,
): PlayerCharacterAtlasCssFrame {
  const sheet = PLAYER_CHARACTER_ATLAS_SHEETS[name]
  if (!sheet) throw new RangeError(`Missing packed player-character sheet ${name}`)
  const [columns, rows, originalWidth, originalHeight, frames] = sheet
  if (column < 0 || column >= columns || row < 0 || row >= rows) {
    throw new RangeError(`Packed player-character frame ${name}:${column}:${row} is outside its sheet`)
  }
  const packed = frames[row * columns + column] ?? null
  if (packed === null) {
    return {
      backgroundImage: 'none',
      backgroundPosition: '0 0',
      backgroundRepeat: 'no-repeat',
      display: 'none',
      height: `${originalHeight}px`,
      left: '0',
      position: 'absolute',
      top: '0',
      width: `${originalWidth}px`,
    }
  }
  const [rectangleIndex, trimX, trimY] = packed
  const rectangle = PLAYER_CHARACTER_ATLAS_RECTANGLES[rectangleIndex]
  if (!rectangle) throw new RangeError(`Missing packed player rectangle ${rectangleIndex}`)
  const [page, x, y, width, height] = rectangle
  const source = PLAYER_CHARACTER_ATLAS_SOURCES[page]
  if (!source) throw new RangeError(`Missing packed player atlas page ${page}`)
  return {
    backgroundImage: `url(${source})`,
    backgroundPosition: `-${x}px -${y}px`,
    backgroundRepeat: 'no-repeat',
    height: `${height}px`,
    left: `${trimX}px`,
    position: 'absolute',
    top: `${trimY}px`,
    width: `${width}px`,
  }
}

function packedFrameTexture(
  pages: readonly Texture[],
  packed: readonly [rectangle: number, trimX: number, trimY: number] | null,
  originalWidth: number,
  originalHeight: number,
): Texture {
  const origin = new Rectangle(0, 0, originalWidth, originalHeight)
  if (packed === null) {
    return new Texture({
      frame: new Rectangle(0, 0, 1, 1),
      orig: origin,
      source: pages[0]!.source,
      trim: new Rectangle(0, 0, 1, 1),
    })
  }
  const [rectangleIndex, trimX, trimY] = packed
  const rectangle = PLAYER_CHARACTER_ATLAS_RECTANGLES[rectangleIndex]
  if (!rectangle) throw new RangeError(`Missing packed player rectangle ${rectangleIndex}`)
  const [page, x, y, width, height] = rectangle
  const pageTexture = pages[page]
  if (!pageTexture) throw new RangeError(`Missing packed player atlas page ${page}`)
  return new Texture({
    frame: new Rectangle(x, y, width, height),
    orig: origin,
    source: pageTexture.source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}

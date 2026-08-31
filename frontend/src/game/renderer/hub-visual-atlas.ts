import { Rectangle, Texture } from 'pixi.js'

import {
  HUB_VISUAL_ATLAS_ORIGINAL_SOURCES,
  HUB_VISUAL_ATLAS_RECTANGLES,
  HUB_VISUAL_ATLAS_SHEETS,
  HUB_VISUAL_ATLAS_SOURCES,
  type HubVisualPackedFrame,
  type HubVisualPackedSheet,
} from './hub-visual-atlas.generated.ts'

export {
  HUB_VISUAL_ATLAS_ORIGINAL_SOURCES,
  HUB_VISUAL_ATLAS_SOURCES,
}

export interface HubVisualAtlas {
  destroy(): void
  frame(source: string, column: number, row: number): Texture
  grid(
    source: string,
    columns: number,
    rows: number,
    width: number,
    height: number,
  ): readonly (readonly Texture[])[]
  single(source: string): Texture
  strip(
    source: string,
    count: number,
    width: number,
    height: number,
    direction: 'horizontal' | 'vertical',
  ): readonly Texture[]
  subframe(
    source: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Texture
}

export function createHubVisualAtlas(
  texture: (source: string) => Texture,
): HubVisualAtlas {
  const pages = HUB_VISUAL_ATLAS_SOURCES.map(texture)
  const frameCache = new Map<string, readonly (readonly Texture[])[]>()
  const subframeCache = new Map<string, Texture>()

  const grid = (
    source: string,
    columns: number,
    rows: number,
    width: number,
    height: number,
  ): readonly (readonly Texture[])[] => {
    const cached = frameCache.get(source)
    if (cached) {
      assertSheetGeometry(source, sourceSheet(source), columns, rows, width, height)
      return cached
    }
    const sheet = sourceSheet(source)
    assertSheetGeometry(source, sheet, columns, rows, width, height)
    const frames = Array.from({ length: rows }, (_, row) => Array.from(
      { length: columns },
      (_, column) => packedFrameTexture(
        pages,
        sheet[4][row * columns + column] ?? null,
        width,
        height,
      ),
    ))
    frameCache.set(source, frames)
    return frames
  }

  return {
    destroy() {
      for (const rows of frameCache.values()) {
        for (const row of rows) for (const frame of row) frame.destroy(false)
      }
      for (const frame of subframeCache.values()) frame.destroy(false)
      frameCache.clear()
      subframeCache.clear()
    },
    frame(source, column, row) {
      const sheet = sourceSheet(source)
      const [columns, rows, width, height] = sheet
      if (column < 0 || column >= columns || row < 0 || row >= rows) {
        throw new RangeError(
          `Packed Hub visual frame ${source}:${column}:${row} is outside ${columns}x${rows}`,
        )
      }
      return grid(source, columns, rows, width, height)[row]![column]!
    },
    grid,
    single(source) {
      return gridForSource(source, grid, 1, 1)[0]![0]!
    },
    strip(source, count, width, height, direction) {
      const columns = direction === 'horizontal' ? count : 1
      const rows = direction === 'vertical' ? count : 1
      return grid(source, columns, rows, width, height).flat()
    },
    subframe(source, x, y, width, height) {
      const sheet = sourceSheet(source)
      assertSheetGeometry(source, sheet, 1, 1, sheet[2], sheet[3])
      if (
        x < 0
        || y < 0
        || width <= 0
        || height <= 0
        || x + width > sheet[2]
        || y + height > sheet[3]
      ) {
        throw new RangeError(
          `Packed Hub visual subframe ${source}:${x},${y},${width},${height} `
          + `is outside ${sheet[2]}x${sheet[3]}`,
        )
      }
      const key = `${source}\0${x},${y},${width},${height}`
      const cached = subframeCache.get(key)
      if (cached) return cached
      const frame = packedSubframeTexture(
        pages,
        sheet[4][0] ?? null,
        x,
        y,
        width,
        height,
      )
      subframeCache.set(key, frame)
      return frame
    },
  }
}

export function hubVisualAtlasSourceIsSingle(source: string): boolean {
  const sheet = sourceSheet(source)
  return sheet[0] === 1 && sheet[1] === 1
}

function gridForSource(
  source: string,
  grid: HubVisualAtlas['grid'],
  expectedColumns: number,
  expectedRows: number,
): readonly (readonly Texture[])[] {
  const sheet = sourceSheet(source)
  if (sheet[0] !== expectedColumns || sheet[1] !== expectedRows) {
    throw new RangeError(
      `Packed Hub visual ${source} is ${sheet[0]}x${sheet[1]}, `
      + `expected ${expectedColumns}x${expectedRows}`,
    )
  }
  return grid(source, sheet[0], sheet[1], sheet[2], sheet[3])
}

function sourceSheet(source: string): HubVisualPackedSheet {
  const sheet = HUB_VISUAL_ATLAS_SHEETS.get(source)
  if (!sheet) throw new RangeError(`Missing packed Hub visual source ${source}`)
  return sheet
}

function assertSheetGeometry(
  source: string,
  sheet: HubVisualPackedSheet,
  columns: number,
  rows: number,
  width: number,
  height: number,
): void {
  if (
    sheet[0] !== columns
    || sheet[1] !== rows
    || sheet[2] !== width
    || sheet[3] !== height
  ) {
    throw new RangeError(
      `Packed Hub visual ${source} is ${sheet[0]}x${sheet[1]} of `
      + `${sheet[2]}x${sheet[3]}, expected ${columns}x${rows} of ${width}x${height}`,
    )
  }
}

function packedFrameTexture(
  pages: readonly Texture[],
  packed: HubVisualPackedFrame,
  originalWidth: number,
  originalHeight: number,
): Texture {
  const origin = new Rectangle(0, 0, originalWidth, originalHeight)
  if (packed === null) return transparentLogicalTexture(pages, origin)
  const [rectangleIndex, trimX, trimY] = packed
  const rectangle = HUB_VISUAL_ATLAS_RECTANGLES[rectangleIndex]
  if (!rectangle) throw new RangeError(`Missing packed Hub rectangle ${rectangleIndex}`)
  const [page, x, y, width, height] = rectangle
  const pageTexture = pages[page]
  if (!pageTexture) throw new RangeError(`Missing packed Hub atlas page ${page}`)
  return new Texture({
    frame: new Rectangle(x, y, width, height),
    orig: origin,
    source: pageTexture.source,
    trim: new Rectangle(trimX, trimY, width, height),
  })
}

function packedSubframeTexture(
  pages: readonly Texture[],
  packed: HubVisualPackedFrame,
  logicalX: number,
  logicalY: number,
  logicalWidth: number,
  logicalHeight: number,
): Texture {
  const origin = new Rectangle(0, 0, logicalWidth, logicalHeight)
  if (packed === null) return transparentLogicalTexture(pages, origin)
  const [rectangleIndex, trimX, trimY] = packed
  const rectangle = HUB_VISUAL_ATLAS_RECTANGLES[rectangleIndex]
  if (!rectangle) throw new RangeError(`Missing packed Hub rectangle ${rectangleIndex}`)
  const [page, packedX, packedY, packedWidth, packedHeight] = rectangle
  const pageTexture = pages[page]
  if (!pageTexture) throw new RangeError(`Missing packed Hub atlas page ${page}`)

  const left = Math.max(logicalX, trimX)
  const top = Math.max(logicalY, trimY)
  const right = Math.min(logicalX + logicalWidth, trimX + packedWidth)
  const bottom = Math.min(logicalY + logicalHeight, trimY + packedHeight)
  if (right <= left || bottom <= top) return transparentLogicalTexture(pages, origin)
  const width = right - left
  const height = bottom - top
  return new Texture({
    frame: new Rectangle(
      packedX + left - trimX,
      packedY + top - trimY,
      width,
      height,
    ),
    orig: origin,
    source: pageTexture.source,
    trim: new Rectangle(left - logicalX, top - logicalY, width, height),
  })
}

function transparentLogicalTexture(
  pages: readonly Texture[],
  origin: Rectangle,
): Texture {
  const page = pages[0]
  if (!page) throw new RangeError('Missing packed Hub atlas page 0')
  return new Texture({
    frame: new Rectangle(0, 0, 1, 1),
    orig: origin,
    source: page.source,
    trim: new Rectangle(0, 0, 1, 1),
  })
}

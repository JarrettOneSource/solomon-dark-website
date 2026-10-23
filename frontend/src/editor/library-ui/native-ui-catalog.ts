import nativeUiAssetsJson from './catalog.json' with { type: 'json' }

export const NATIVE_UI_ATLAS_NAMES = ['Fonts', 'UI'] as const

export const NATIVE_UI_FONT_NAMES = ['heading', 'medium', 'menu'] as const

export type NativeUiAtlasName = typeof NATIVE_UI_ATLAS_NAMES[number]
export type NativeUiFontName = typeof NATIVE_UI_FONT_NAMES[number]

export interface NativeUiAtlasRecord {
  readonly frame: readonly [x: number, y: number, width: number, height: number]
  readonly logicalSize: readonly [width: number, height: number]
  readonly points: readonly (readonly [x: number, y: number])[]
  readonly rotated: false
  readonly trimOrigin: readonly [x: number, y: number]
}

export interface NativeUiGlyphRecord extends NativeUiAtlasRecord {
  readonly metrics: readonly [advance: number, bearingX: number, bearingY: number]
  readonly record: number
}

export interface NativeUiBitmapFont {
  readonly atlas: 'Fonts'
  readonly glyphs: Readonly<Record<string, NativeUiGlyphRecord>>
  readonly kerning: readonly (readonly [left: number, right: number, adjustment: number])[]
  readonly metrics: readonly [lineHeight: number, spaceAdvance: number, nativeScale: number]
  readonly spaceAdvance: number
}

export interface NativeUiAtlas {
  readonly dimensions: readonly [width: number, height: number]
  readonly records: Readonly<Record<string, NativeUiAtlasRecord>>
}

interface NativeUiManifest {
  readonly atlases: Readonly<Record<NativeUiAtlasName, NativeUiAtlas>>
  readonly fonts: Readonly<Record<NativeUiFontName, NativeUiBitmapFont>>
}

export const NATIVE_UI_MANIFEST = nativeUiAssetsJson as unknown as NativeUiManifest

export function nativeUiAtlas(name: NativeUiAtlasName): NativeUiAtlas {
  return NATIVE_UI_MANIFEST.atlases[name]
}

export function nativeUiRecord(
  atlas: NativeUiAtlasName,
  record: number,
): NativeUiAtlasRecord {
  if (!Number.isInteger(record) || record < 0) {
    throw new RangeError(`native ${atlas} record must be a nonnegative integer`)
  }
  const result = nativeUiAtlas(atlas).records[`${record}`]
  if (!result) throw new RangeError(`native ${atlas}.${record} does not exist`)
  return result
}

export function nativeUiFont(name: NativeUiFontName): NativeUiBitmapFont {
  return NATIVE_UI_MANIFEST.fonts[name]
}

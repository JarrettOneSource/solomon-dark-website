import bonedit from './bonedit.json'
import classes from './classes.json'
import deadhawg from './deadhawg.json'
import palette from './palette.json'
// badguys.json (869 KB) stays out of the static graph: its records are
// secondary effects, not placement variants. Load through badguysManifest()
// if a consumer ever needs it.

export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export interface Rect extends Point, Size {}

export interface AtlasEntry {
  id: number
  file: string | null
  rect: Rect
  cell: Size
  origin: Point
  extras: Point[] | null
  empty: boolean
}

export interface AtlasManifest {
  atlas: string
  pngSize: Size
  entries: AtlasEntry[]
}

export type PaletteCategory =
  | 'graves'
  | 'trees'
  | 'flora'
  | 'buildings'
  | 'statues'
  | 'fences'
  | 'ground'
  | 'props'
  | 'fx'
  | 'markers'
  | 'unknown'

export interface PaletteEntry {
  id: number
  label: string
}

export interface PaletteManifest {
  atlas: string
  categories: Record<PaletteCategory, PaletteEntry[]>
}

export type MappingConfidence = 'verified' | 'probable'
export type ArtSourceKind = 'atlas' | 'looseImage' | 'generated'

export interface ClassArtSource {
  kind: ArtSourceKind
  atlas?: string
  entryIds?: number[]
  files?: string[]
  role: string
}

export interface ClassVariant {
  variant: number
  art: ClassArtSource[]
}

export interface ClassVariantMapping {
  selector: string
  atlas?: string
  entryIds?: number[]
  entryIdsByVariant?: number[]
  filesByVariant?: string[]
  formula?: string
  role: string
  confidence: MappingConfidence
  variants?: ClassVariant[]
}

export interface ClassArtMapping {
  id: number
  name: string
  confidence: MappingConfidence
  artSources: ClassArtSource[]
  variantMappings: ClassVariantMapping[]
  unresolved: string[]
}

export interface ClassesManifest {
  evidence: string[]
  classes: ClassArtMapping[]
}

export const atlasManifests: Readonly<Record<string, AtlasManifest>> = {
  Bonedit: bonedit,
  DeadHawg: deadhawg,
}

export function badguysManifest(): Promise<AtlasManifest> {
  return import('./badguys.json').then((m) => m.default as AtlasManifest)
}

export const paletteManifest = palette as PaletteManifest
export const classesManifest = classes as ClassesManifest

export { bonedit, classes, deadhawg, palette }

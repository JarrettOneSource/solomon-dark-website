// The Boneyard editor's document model.
//
// Shape mirrors the native .boneyard semantic model recovered in
// Mod Loader/docs/reverse-engineering/boneyard-system.md: an Arena carrying a
// RegionLayout of placed world objects, roads, fences, terrain, a static
// sprite list (DeadHawg atlas entries), spawn recipes, and a TimeLine.
// The editor works on this form; src/editor/format/ owns the byte layer.

export interface Vec2 {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Native class ids of everything the editor can put in the ground
 * (RegionLayout section 0 world objects plus the structural lists). */
export const NATIVE = {
  tree: 2001,
  monument: 2009,
  gravestone: 2029,
  building: 2040,
  goodie: 2061,
  road: 3004,
  fence: 3005,
  fencepost: 3006,
  fenceGrate: 3007,
  terrain: 3009,
} as const

export type NativeClassKey = keyof typeof NATIVE

export const NATIVE_LABEL: Record<number, string> = {
  [NATIVE.tree]: 'Tree',
  [NATIVE.monument]: 'Monument',
  [NATIVE.gravestone]: 'Gravestone',
  [NATIVE.building]: 'Building',
  [NATIVE.goodie]: 'Goodie',
  [NATIVE.road]: 'Road',
  [NATIVE.fence]: 'Fence',
  [NATIVE.fencepost]: 'Fencepost',
  [NATIVE.fenceGrate]: 'Fence gate',
  [NATIVE.terrain]: 'Terrain',
}

/** A placed world object (RegionLayout section 0). Unknown payload bytes ride
 * along in `raw` so an opened stock level survives a save untouched. */
export interface PlacedObject {
  eid: string
  typeId: number
  pos: Vec2
  /** Which look this object wears; mapping to atlas entries is format-layer truth. */
  variant?: number
  rot?: number
  scale?: number
  uid?: number
  /** Native Puppet +0xA0 render-bucket adjustment. Buildings use -50. */
  sortBias?: number
  /** Editor rendering hint until the format layer resolves variant art. */
  sprite?: SpriteRef
  raw?: string
}

/** A static scenery sprite (RegionLayout section 11, 25-byte records).
 * s0/s1/s2 keep the recovered field order until their meanings are pinned. */
export interface StaticSprite {
  eid: string
  atlasEntry: number
  pos: Vec2
  s0: number
  s1: number
  s2: number
  flags: number
  sprite?: SpriteRef
}

/** Roads and fences are two-point native segment records; a drawn path
 * becomes a run of segments sharing a `chain`. The game dresses them. */
export interface Polyline {
  eid: string
  typeId: number
  points: Vec2[]
  /** Roads: texture selector 0..4. Fences: mirror of segmentCode. */
  style?: number
  /** Segments drawn in one stroke share a chain (and move as one). */
  chain?: string
  /** Roads: scale of the native 55px half-width at each end. */
  startWidthScale?: number
  endWidthScale?: number
  /** Fences: 0 grate, 1 broken grate, 2 gate, 3 wall, 4 rails. */
  segmentCode?: number
  uid?: number
  previousUid?: number
  nextUid?: number
  raw?: string
}

export interface TerrainPatch {
  eid: string
  pos: Vec2
  /** Authored terrain is a spline: style 0 river, 1 rise. */
  points?: Vec2[]
  style?: number
  entry?: number
  uid?: number
  raw?: string
}

/** Opaque native payloads we preserve but do not author yet. */
export interface OpaqueChunk {
  kind: 'monsterRecipe' | 'itemRecipe' | 'npcRecipe' | 'itemSet' | 'uidGroup' | 'timeline' | 'envelope'
  label?: string
  raw: string
}

export interface SpriteRef {
  atlas: string
  entry: number
  src: string
  w: number
  h: number
  /** Native logical-canvas registration point inside the cropped sprite. */
  anchorX: number
  anchorY: number
}

export interface EditorDoc {
  meta: {
    name: string
    bounds: Rect
  }
  objects: PlacedObject[]
  sprites: StaticSprite[]
  roads: Polyline[]
  fences: Polyline[]
  terrain: TerrainPatch[]
  /** Preserved-but-not-yet-authorable payloads from an imported level. */
  opaque: OpaqueChunk[]
  /** True when the doc carries the stock default TimeLine (new docs do). */
  hasTimeline: boolean
  /** Editor-side grouping: eid to group id. Groups select and move as one.
   * Not part of the native format; drafts keep it, compiles ignore it. */
  groups?: Record<string, string>
  /** Authored survival wave schedule. Not part of the .boneyard bytes: it
   * publishes as a data/wave.txt overlay riding in the same mod package.
   * Absent or empty means the plot ships with the game's stock waves. */
  waves?: import('./waves').WaveDef[]
}

let counter = 0

export function eid(prefix = 'e'): string {
  counter = (counter + 1) % 0xffff
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`
}

/** The default plot: generous, centered on the origin like the stock levels. */
export const DEFAULT_BOUNDS: Rect = { x: -2048, y: -1536, w: 4096, h: 3072 }

export function createDoc(name: string): EditorDoc {
  return {
    meta: { name, bounds: { ...DEFAULT_BOUNDS } },
    objects: [],
    sprites: [],
    roads: [],
    fences: [],
    terrain: [],
    opaque: [],
    hasTimeline: true,
    groups: {},
  }
}

export type Placeable =
  | { kind: 'object'; value: PlacedObject }
  | { kind: 'sprite'; value: StaticSprite }

export type SelKind = 'object' | 'sprite' | 'road' | 'fence' | 'terrain'

/** One selectable thing on the stage. */
export interface SelEntry {
  kind: SelKind
  eid: string
}

/** The live selection: empty means nothing held. */
export type Selection = SelEntry[]

export function entryKey(e: SelEntry): string {
  return `${e.kind}:${e.eid}`
}

export function selectionSet(sel: Selection): Set<string> {
  return new Set(sel.map(entryKey))
}

export function sameEntry(a: SelEntry | null, b: SelEntry | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.eid === b.eid
}

/** The single held thing, when exactly one is held. */
export function soleSelection(sel: Selection): SelEntry | null {
  return sel.length === 1 ? sel[0] : null
}

/** Every entry in the doc, with its kind. */
export function allEntries(doc: EditorDoc): SelEntry[] {
  return [
    ...doc.objects.map((o): SelEntry => ({ kind: 'object', eid: o.eid })),
    ...doc.sprites.map((s): SelEntry => ({ kind: 'sprite', eid: s.eid })),
    ...doc.roads.map((r): SelEntry => ({ kind: 'road', eid: r.eid })),
    ...doc.fences.map((f): SelEntry => ({ kind: 'fence', eid: f.eid })),
    ...doc.terrain.map((t): SelEntry => ({ kind: 'terrain', eid: t.eid })),
  ]
}

/** Grow a selection to cover whole groups and whole chains: picking one
 * member holds the lot, which is the entire point of grouping. Runs on every
 * marquee move, so it works from prebuilt lookups instead of nested finds. */
export function expandSelection(doc: EditorDoc, entries: SelEntry[]): SelEntry[] {
  if (entries.length === 0) return entries
  const groups = doc.groups ?? {}
  const wantGroups = new Set<string>()
  const wantChains = new Set<string>()
  const wanted = new Set<string>()
  let chainByKey: Map<string, string> | null = null
  const chainOf = (e: SelEntry): string | undefined => {
    if (!chainByKey) {
      chainByKey = new Map()
      for (const r of doc.roads) if (r.chain) chainByKey.set(`road:${r.eid}`, r.chain)
      for (const f of doc.fences) if (f.chain) chainByKey.set(`fence:${f.eid}`, f.chain)
    }
    return chainByKey.get(entryKey(e))
  }
  for (const e of entries) {
    wanted.add(entryKey(e))
    const g = groups[e.eid]
    if (g) wantGroups.add(g)
    if (e.kind === 'road' || e.kind === 'fence') {
      const c = chainOf(e)
      if (c) wantChains.add(c)
    }
  }
  if (wantGroups.size === 0 && wantChains.size === 0) return entries
  const out: SelEntry[] = []
  const seen = new Set<string>()
  const push = (kind: SelKind, id: string) => {
    const k = `${kind}:${id}`
    if (!seen.has(k)) {
      seen.add(k)
      out.push({ kind, eid: id })
    }
  }
  const grouped = (id: string) => {
    const g = groups[id]
    return !!g && wantGroups.has(g)
  }
  for (const o of doc.objects) if (wanted.has(`object:${o.eid}`) || grouped(o.eid)) push('object', o.eid)
  for (const s of doc.sprites) if (wanted.has(`sprite:${s.eid}`) || grouped(s.eid)) push('sprite', s.eid)
  for (const r of doc.roads) if (wanted.has(`road:${r.eid}`) || grouped(r.eid) || (r.chain && wantChains.has(r.chain))) push('road', r.eid)
  for (const f of doc.fences) if (wanted.has(`fence:${f.eid}`) || grouped(f.eid) || (f.chain && wantChains.has(f.chain))) push('fence', f.eid)
  for (const t of doc.terrain) if (wanted.has(`terrain:${t.eid}`) || grouped(t.eid)) push('terrain', t.eid)
  return out
}

export function countResidents(doc: EditorDoc): number {
  return doc.objects.length + doc.sprites.length + doc.roads.length + doc.fences.length + doc.terrain.length
}

export function clampToBounds(p: Vec2, b: Rect): Vec2 {
  return {
    x: Math.min(b.x + b.w, Math.max(b.x, p.x)),
    y: Math.min(b.y + b.h, Math.max(b.y, p.y)),
  }
}

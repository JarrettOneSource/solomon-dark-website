import deadhawg from '../editor/manifest/deadhawg.json' with { type: 'json' }

export type NativeArenaFieldRecord = 11 | 12

export interface NativeArenaFieldBounds {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface NativeArenaFieldDescriptor {
  readonly atlas: 'DeadHawg'
  readonly entry: NativeArenaFieldRecord
  readonly frame: Readonly<{ x: number; y: number; width: number; height: number }>
  readonly page: Readonly<{ width: number; height: number }>
  readonly width: number
  readonly height: number
  /** Absolute full-page UVs in mesh order TL, TR, BL, BR. */
  readonly uvs: readonly number[]
}

export interface NativeArenaFieldLattice {
  readonly x: Float32Array
  readonly y: Float32Array
}

export interface NativeArenaFieldRange {
  readonly xStart: number
  readonly xEnd: number
  readonly yStart: number
  readonly yEnd: number
  readonly tileCount: number
}

export interface NativeArenaFieldMeshPlan {
  readonly entry: NativeArenaFieldRecord
  readonly tileCount: number
  readonly positions: Float32Array
  readonly uvs: Float32Array
  readonly indices: Uint32Array
  readonly colors: Uint8Array
}

// Web resource guards, not native invalid-input behavior. Ordinary maximum-size
// editor worlds need only 375 entries per axis and 140625 quads at full-map fit.
const MAX_AXIS_ENTRIES = 1_000_000
const MAX_VISIBLE_TILES = 1_000_000

const DESCRIPTORS: Readonly<Record<NativeArenaFieldRecord, NativeArenaFieldDescriptor>> = {
  11: fieldDescriptor(11),
  12: fieldDescriptor(12),
}

/** Arena 0046F457/45F: only mode bytes 1 and 2 choose B2F2A4. */
export function nativeArenaFieldRecord(mode: number): NativeArenaFieldRecord {
  if (!Number.isInteger(mode) || mode < 0 || mode > 255) {
    throw new RangeError('Native Arena field mode must be a byte')
  }
  return mode === 1 || mode === 2 ? 11 : 12
}

export function nativeArenaFieldDescriptor(mode: number): NativeArenaFieldDescriptor {
  return DESCRIPTORS[nativeArenaFieldRecord(mode)]
}

/** Cache once per authored bounds. Native stores f32 after every increment. */
export function createNativeArenaFieldLattice(
  bounds: Readonly<NativeArenaFieldBounds>,
): NativeArenaFieldLattice {
  return {
    x: fieldAxis(bounds.x, bounds.w, DESCRIPTORS[12].width),
    y: fieldAxis(bounds.y, bounds.h, DESCRIPTORS[12].height),
  }
}

/**
 * Arena primary-view strict overlap (0046F48E..51F). Supply unpadded world
 * bounds. The shared scenery cull has different padding and inclusive edges.
 * Binary search the retained recurrence; never reconstruct origin + index*step.
 */
export function nativeArenaFieldVisibleRange(
  lattice: NativeArenaFieldLattice,
  view: Readonly<NativeArenaFieldBounds>,
): NativeArenaFieldRange {
  const x = finiteF32(view.x, 'view X')
  const y = finiteF32(view.y, 'view Y')
  const w = finiteF32(view.w, 'view width')
  const h = finiteF32(view.h, 'view height')
  if (w < 0 || h < 0) throw new RangeError('Native Arena field view size cannot be negative')
  const right = finiteF32(x + w, 'view right')
  const bottom = finiteF32(y + h, 'view bottom')
  // Native FILD/FADD compares these tile ends directly, without an FSTP f32.
  const xStart = firstIndex(lattice.x, value => value + DESCRIPTORS[12].width > x)
  const yStart = firstIndex(lattice.y, value => value + DESCRIPTORS[12].height > y)
  const xEnd = Math.max(xStart, firstIndex(lattice.x, value => value >= right))
  const yEnd = Math.max(yStart, firstIndex(lattice.y, value => value >= bottom))
  return { xStart, xEnd, yStart, yEnd, tileCount: (xEnd - xStart) * (yEnd - yStart) }
}

/** SpriteDraw stores the registration center before adding its local corners.
 * Origins come from the retained f32 lattice; culling still uses those origins.
 * Native's subsequent center+Graphics-root store is a renderer-stage boundary.
 */
export function nativeArenaFieldTileCorners(x: number, y: number): Readonly<{
  left: number; top: number; right: number; bottom: number
}> {
  const halfWidth = DESCRIPTORS[12].width / 2
  const halfHeight = DESCRIPTORS[12].height / 2
  const cx = Math.fround(x + halfWidth)
  const cy = Math.fround(y + halfHeight)
  return {
    left: Math.fround(cx - halfWidth), top: Math.fround(cy - halfHeight),
    right: Math.fround(cx + halfWidth), bottom: Math.fround(cy + halfHeight),
  }
}

/**
 * One retained full-page mesh, rebuilt only when selected range/mode changes.
 * World-space tile corners preserve full final tiles; camera/root transform
 * qualification belongs to the renderer, not this lattice geometry model.
 */
export function nativeArenaFieldMeshPlan(
  lattice: NativeArenaFieldLattice,
  range: NativeArenaFieldRange,
  mode: number,
): NativeArenaFieldMeshPlan {
  assertRange(lattice, range)
  const descriptor = nativeArenaFieldDescriptor(mode)
  const { tileCount } = range
  if (tileCount > MAX_VISIBLE_TILES) throw new RangeError('Native Arena field visible mesh exceeds the safe resource limit')
  const positions = new Float32Array(tileCount * 8)
  const uvs = new Float32Array(tileCount * 8)
  const indices = new Uint32Array(tileCount * 6)
  const colors = new Uint8Array(tileCount * 16).fill(255)
  let tile = 0
  for (let xi = range.xStart; xi < range.xEnd; xi += 1) {
    const x = lattice.x[xi]!
    for (let yi = range.yStart; yi < range.yEnd; yi += 1) {
      const y = lattice.y[yi]!
      const corners = nativeArenaFieldTileCorners(x, y)
      const p = tile * 8
      positions[p] = corners.left
      positions[p + 1] = corners.top
      positions[p + 2] = corners.right
      positions[p + 3] = corners.top
      positions[p + 4] = corners.left
      positions[p + 5] = corners.bottom
      positions[p + 6] = corners.right
      positions[p + 7] = corners.bottom
      uvs.set(descriptor.uvs, p)
      const vertex = tile * 4
      const index = tile * 6
      indices[index] = vertex
      indices[index + 1] = vertex + 1
      indices[index + 2] = vertex + 2
      indices[index + 3] = vertex + 1
      indices[index + 4] = vertex + 3
      indices[index + 5] = vertex + 2
      tile += 1
    }
  }
  return { entry: descriptor.entry, tileCount, positions, uvs, indices, colors }
}

function fieldDescriptor(entry: NativeArenaFieldRecord): NativeArenaFieldDescriptor {
  const record = deadhawg.entries[entry]
  if (!record || record.id !== entry || record.empty || !record.file
    || record.cell.w !== 350 || record.cell.h !== 350
    || record.rect.w !== record.cell.w || record.rect.h !== record.cell.h
    || record.origin.x !== 0 || record.origin.y !== 0
    || deadhawg.pngSize.w !== 2048 || deadhawg.pngSize.h !== 2048) {
    throw new Error(`Required native Arena field descriptor DeadHawg:${entry} is unavailable`)
  }
  const frame = Object.freeze({
    x: record.rect.x,
    y: record.rect.y,
    width: record.rect.w,
    height: record.rect.h,
  })
  const page = Object.freeze({ width: deadhawg.pngSize.w, height: deadhawg.pngSize.h })
  // Sprite constructor 00413E9D..00414172. The existing Pixi helper exposes
  // TL,TR,BR,BL; this pure model writes the remapped TL,TR,BL,BR directly.
  const left = Math.fround((frame.x + 0.5) / page.width)
  const top = Math.fround((frame.y + 0.5) / page.height)
  const right = Math.fround((frame.x + frame.width + 0.25) / page.width)
  const bottom = Math.fround((frame.y + frame.height + 0.25) / page.height)
  return Object.freeze({
    atlas: 'DeadHawg',
    entry,
    frame,
    page,
    width: record.cell.w,
    height: record.cell.h,
    uvs: Object.freeze([left, top, right, top, left, bottom, right, bottom]),
  })
}

function fieldAxis(origin: number, extent: number, step: number): Float32Array {
  const start = finiteF32(origin, 'world origin')
  const length = finiteF32(extent, 'world extent')
  if (extent <= 0 || length <= 0) throw new RangeError('Native Arena field requires positive bounds')
  const end = finiteF32(start + length, 'world endpoint')
  const values: number[] = []
  for (let value = start; value < end;) {
    if (values.length === MAX_AXIS_ENTRIES) throw new RangeError('Native Arena field axis exceeds the safe resource limit')
    values.push(value)
    const next = Math.fround(value + step)
    if (!Number.isFinite(next) || next <= value) throw new RangeError('Native Arena field axis does not advance in float32')
    value = next
  }
  return Float32Array.from(values)
}

function finiteF32(value: number, label: string): number {
  const rounded = Math.fround(value)
  if (!Number.isFinite(value) || !Number.isFinite(rounded)) {
    throw new RangeError(`Native Arena field ${label} must be finite float32`)
  }
  return rounded
}

function firstIndex(axis: Float32Array, predicate: (value: number) => boolean): number {
  let lo = 0
  let hi = axis.length
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    if (predicate(axis[mid]!)) hi = mid
    else lo = mid + 1
  }
  return lo
}

function assertRange(lattice: NativeArenaFieldLattice, range: NativeArenaFieldRange): void {
  const { xStart, xEnd, yStart, yEnd, tileCount } = range
  if (![xStart, xEnd, yStart, yEnd, tileCount].every(Number.isSafeInteger)
    || xStart < 0 || xEnd < xStart || xEnd > lattice.x.length
    || yStart < 0 || yEnd < yStart || yEnd > lattice.y.length
    || tileCount !== (xEnd - xStart) * (yEnd - yStart)) {
    throw new RangeError('Native Arena field range must fit its retained axes')
  }
}

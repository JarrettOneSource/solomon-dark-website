import type {
  BoneyardDocument,
  BoneyardScene,
  Bounds,
  Fence,
  NamedSyncBuffer,
  Point,
  Road,
  SpritePlacement,
  SyncChunk,
  Terrain,
  WorldObject,
} from './model.ts'

const MAX_FILE_BYTES = 256 * 1024 * 1024
const MAX_CHUNKS = 1_000_000
const MAX_NAMED_BUFFERS = 65_536
const MAX_NAME_BYTES = 1024 * 1024
const MAX_DEPTH = 512
const ARENA_SECTION_COUNT = 13
const REGION_LAYOUT_SECTION_COUNT = 14

const WORLD_OBJECT_NAMES: Readonly<Record<number, string>> = {
  2001: 'Tree',
  2009: 'Monument',
  2029: 'Gravestone',
  2040: 'Building',
  2061: 'Goodie',
}

const decoder = new TextDecoder()

export class BoneyardParseError extends Error {
  readonly offset: number

  constructor(offset: number, reason: string) {
    super(`Invalid Boneyard at byte ${offset}: ${reason}`)
    this.name = 'BoneyardParseError'
    this.offset = offset
  }
}

class Reader {
  readonly bytes: Uint8Array
  readonly view: DataView
  offset = 0
  chunkCount = 0
  namedBufferCount = 0
  maxDepth = 0

  constructor(input: ArrayBuffer | Uint8Array) {
    this.bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
    if (this.bytes.byteLength > MAX_FILE_BYTES) {
      throw new BoneyardParseError(0, 'files may not exceed 256 MiB')
    }
    this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength)
  }

  invalid(reason: string, offset = this.offset): BoneyardParseError {
    return new BoneyardParseError(offset, reason)
  }

  require(length: number): void {
    if (length < 0 || this.offset + length > this.bytes.byteLength) {
      throw this.invalid('the SyncBuffer is truncated')
    }
  }

  u32(): number {
    this.require(4)
    const value = this.view.getUint32(this.offset, true)
    this.offset += 4
    return value
  }

  take(length: number): Uint8Array {
    this.require(length)
    const value = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return value
  }

  chunk(depth: number): SyncChunk {
    if (depth > MAX_DEPTH) throw this.invalid(`SyncBuffer nesting exceeds ${MAX_DEPTH} levels`)
    if (this.chunkCount === MAX_CHUNKS) {
      throw this.invalid(`SyncBuffer contains more than ${MAX_CHUNKS} chunks`)
    }

    const offset = this.offset
    this.chunkCount += 1
    this.maxDepth = Math.max(this.maxDepth, depth)
    const payload = this.take(this.u32())
    const childCount = this.u32()
    if (childCount > MAX_CHUNKS - this.chunkCount) {
      throw this.invalid(`SyncBuffer contains more than ${MAX_CHUNKS} chunks`)
    }

    const children: SyncChunk[] = []
    for (let index = 0; index < childCount; index += 1) {
      children.push(this.chunk(depth + 1))
    }
    return { offset, payload, children }
  }

  buffer(depth: number): { root: SyncChunk; namedBuffers: readonly NamedSyncBuffer[] } {
    const root = this.chunk(depth)
    const count = this.u32()
    if (count > MAX_NAMED_BUFFERS - this.namedBufferCount) {
      throw this.invalid(`SyncBuffer contains more than ${MAX_NAMED_BUFFERS} named buffers`)
    }

    const namedBuffers: NamedSyncBuffer[] = []
    for (let index = 0; index < count; index += 1) {
      this.namedBufferCount += 1
      const nameOffset = this.offset
      const length = this.u32()
      if (length === 0 || length > MAX_NAME_BYTES) {
        throw this.invalid('invalid named-buffer string length', nameOffset)
      }
      const encodedName = this.take(length)
      if (encodedName.at(-1) !== 0 || encodedName.subarray(0, -1).includes(0)) {
        throw this.invalid('named-buffer names require exactly one terminal NUL byte', nameOffset)
      }
      const child = this.buffer(depth + 1)
      namedBuffers.push({
        name: decoder.decode(encodedName.subarray(0, -1)),
        root: child.root,
        namedBuffers: child.namedBuffers,
      })
    }
    return { root, namedBuffers }
  }
}

function view(payload: Uint8Array): DataView {
  return new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
}

function pointAt(payload: Uint8Array, offset: number): Point {
  const data = view(payload)
  return {
    x: data.getFloat32(offset, true),
    y: data.getFloat32(offset + 4, true),
  }
}

function finite(value: number, label: string, chunk: SyncChunk): number {
  if (!Number.isFinite(value)) {
    throw new BoneyardParseError(chunk.offset, `${label} is not finite`)
  }
  return value
}

function finitePoint(payload: Uint8Array, offset: number, label: string, chunk: SyncChunk): Point {
  const point = pointAt(payload, offset)
  return {
    x: finite(point.x, `${label}.x`, chunk),
    y: finite(point.y, `${label}.y`, chunk),
  }
}

function nullableUid(value: number): number | null {
  return value === 0xffffffff ? null : value
}

function parseInternalName(arenaHeader: SyncChunk): string {
  if (arenaHeader.payload.byteLength < 5) return 'Untitled Boneyard'
  const data = view(arenaHeader.payload)
  const length = data.getUint32(0, true)
  if (length === 0 || length > arenaHeader.payload.byteLength - 4) return 'Untitled Boneyard'
  const encoded = arenaHeader.payload.subarray(4, 4 + length)
  if (encoded.at(-1) !== 0) return 'Untitled Boneyard'
  const value = decoder.decode(encoded.subarray(0, -1)).trim()
  return value || 'Untitled Boneyard'
}

function objectTypeIds(section: SyncChunk, label: string): number[] {
  if (section.payload.byteLength < 4) {
    throw new BoneyardParseError(section.offset, `${label} manager payload is truncated`)
  }
  const data = view(section.payload)
  const count = data.getUint32(0, true)
  if (section.payload.byteLength !== 4 + count * 4) {
    throw new BoneyardParseError(section.offset, `${label} manager type table has the wrong length`)
  }
  return Array.from({ length: count }, (_, index) => data.getUint32(4 + index * 4, true))
}

function isObjectBase(children: readonly SyncChunk[], index: number): boolean {
  return children[index]?.payload.byteLength === 41 && children[index + 1]?.payload.byteLength === 101
}

function parseWorldObjects(section: SyncChunk, diagnostics: string[]): WorldObject[] {
  const typeIds = objectTypeIds(section, 'world object')
  const objects: WorldObject[] = []
  let childIndex = 0

  for (let index = 0; index < typeIds.length; index += 1) {
    if (!isObjectBase(section.children, childIndex)) {
      diagnostics.push(`World object ${index} (type ${typeIds[index]}) has an unknown chunk layout.`)
      break
    }

    let nextObject = section.children.length
    for (let candidate = childIndex + 2; candidate < section.children.length; candidate += 1) {
      if (isObjectBase(section.children, candidate)) {
        nextObject = candidate
        break
      }
    }
    const chunks = section.children.slice(childIndex, nextObject)
    const base = chunks[0]
    const position = finitePoint(base.payload, 0, 'world object position', base)
    const velocity = finitePoint(base.payload, 8, 'world object velocity', base)
    const derived = chunks.at(-1)?.payload
    const variant = derived && derived.byteLength >= 2 ? view(derived).getUint16(0, true) : null
    const typeId = typeIds[index]
    objects.push({
      kind: 'worldObject',
      index,
      typeId,
      typeName: WORLD_OBJECT_NAMES[typeId] ?? `Native object ${typeId}`,
      position,
      velocity,
      variant,
      chunks,
    })
    childIndex = nextObject
  }

  if (objects.length !== typeIds.length) {
    diagnostics.push(`Rendered ${objects.length} of ${typeIds.length} world objects.`)
  }
  if (childIndex !== section.children.length) {
    diagnostics.push(`${section.children.length - childIndex} world-object chunks remain opaque.`)
  }
  return objects
}

function parseRoads(section: SyncChunk, diagnostics: string[]): Road[] {
  const typeIds = objectTypeIds(section, 'road')
  if (section.children.length !== typeIds.length) {
    diagnostics.push(`Road manager declares ${typeIds.length} roads but has ${section.children.length} chunks.`)
  }
  return section.children.flatMap((chunk, index) => {
    if (typeIds[index] !== 3004 || chunk.payload.byteLength !== 69) {
      diagnostics.push(`Road ${index} has unsupported type ${typeIds[index] ?? 'missing'} or payload length.`)
      return []
    }
    const data = view(chunk.payload)
    const quad = Array.from({ length: 4 }, (_, pointIndex) =>
      finitePoint(chunk.payload, 28 + pointIndex * 8, `road ${index} quad`, chunk),
    )
    return [{
      kind: 'road' as const,
      index,
      start: finitePoint(chunk.payload, 0, `road ${index} start`, chunk),
      end: finitePoint(chunk.payload, 8, `road ${index} end`, chunk),
      uid: data.getUint32(16, true),
      previousUid: nullableUid(data.getUint32(20, true)),
      nextUid: nullableUid(data.getUint32(24, true)),
      quad,
      style: data.getUint8(60),
      startScale: finite(data.getFloat32(61, true), `road ${index} start scale`, chunk),
      endScale: finite(data.getFloat32(65, true), `road ${index} end scale`, chunk),
      chunk,
    }]
  })
}

function parseFences(section: SyncChunk, diagnostics: string[]): Fence[] {
  const typeIds = objectTypeIds(section, 'fence')
  if (section.children.length !== typeIds.length) {
    diagnostics.push(`Fence manager declares ${typeIds.length} fences but has ${section.children.length} chunks.`)
  }
  return section.children.flatMap((chunk, index) => {
    if (typeIds[index] !== 3005 || chunk.payload.byteLength !== 29) {
      diagnostics.push(`Fence ${index} has unsupported type ${typeIds[index] ?? 'missing'} or payload length.`)
      return []
    }
    const data = view(chunk.payload)
    return [{
      kind: 'fence' as const,
      index,
      start: finitePoint(chunk.payload, 0, `fence ${index} start`, chunk),
      end: finitePoint(chunk.payload, 8, `fence ${index} end`, chunk),
      uid: data.getUint32(16, true),
      previousUid: nullableUid(data.getUint32(20, true)),
      nextUid: nullableUid(data.getUint32(24, true)),
      style: data.getUint8(28),
      chunk,
    }]
  })
}

function parseTerrain(section: SyncChunk, diagnostics: string[]): Terrain[] {
  const typeIds = objectTypeIds(section, 'terrain')
  if (section.children.length !== typeIds.length) {
    diagnostics.push(`Terrain manager declares ${typeIds.length} regions but has ${section.children.length} chunks.`)
  }
  return section.children.flatMap((chunk, index) => {
    if (typeIds[index] !== 3009 || chunk.payload.byteLength < 24) {
      diagnostics.push(`Terrain ${index} has unsupported type ${typeIds[index] ?? 'missing'} or payload length.`)
      return []
    }
    const data = view(chunk.payload)
    const pointCount = data.getUint32(8, true)
    let cursor = 12
    const afterPoints = cursor + pointCount * 8
    if (afterPoints + 12 > chunk.payload.byteLength) {
      diagnostics.push(`Terrain ${index} has a truncated point list.`)
      return []
    }
    const points = Array.from({ length: pointCount }, (_, pointIndex) =>
      finitePoint(chunk.payload, cursor + pointIndex * 8, `terrain ${index} point`, chunk),
    )
    cursor = afterPoints
    const uid = data.getUint32(cursor, true)
    cursor += 4
    const weightCount = data.getUint32(cursor, true)
    cursor += 4
    if (cursor + weightCount * 4 + 4 !== chunk.payload.byteLength) {
      diagnostics.push(`Terrain ${index} has an inconsistent weight list.`)
      return []
    }
    const weights = Array.from({ length: weightCount }, (_, weightIndex) =>
      finite(data.getFloat32(cursor + weightIndex * 4, true), `terrain ${index} weight`, chunk),
    )
    cursor += weightCount * 4
    return [{
      kind: 'terrain' as const,
      index,
      mode: data.getUint32(0, true),
      reserved: data.getUint32(4, true),
      points,
      uid,
      weights,
      scale: finite(data.getFloat32(cursor, true), `terrain ${index} scale`, chunk),
      chunk,
    }]
  })
}

function parseSprites(section: SyncChunk): SpritePlacement[] {
  if (section.payload.byteLength < 4) {
    throw new BoneyardParseError(section.offset, 'static sprite placement list is truncated')
  }
  const data = view(section.payload)
  const count = data.getUint32(0, true)
  if (section.payload.byteLength !== 4 + count * 25) {
    throw new BoneyardParseError(section.offset, 'static sprite placement list has the wrong length')
  }
  return Array.from({ length: count }, (_, index) => {
    const cursor = 4 + index * 25
    return {
      kind: 'sprite' as const,
      index,
      atlasEntryId: data.getUint32(cursor, true),
      position: {
        x: finite(data.getFloat32(cursor + 4, true), `sprite ${index} position.x`, section),
        y: finite(data.getFloat32(cursor + 8, true), `sprite ${index} position.y`, section),
      },
      rotation: finite(data.getFloat32(cursor + 12, true), `sprite ${index} rotation`, section),
      scaleX: finite(data.getFloat32(cursor + 16, true), `sprite ${index} scaleX`, section),
      scaleY: finite(data.getFloat32(cursor + 20, true), `sprite ${index} scaleY`, section),
      flags: data.getUint8(cursor + 24),
    }
  })
}

function sceneBounds(scene: Omit<BoneyardScene, 'bounds'>): Bounds {
  const points: Point[] = [scene.spawn.position]
  for (const object of scene.worldObjects) points.push(object.position)
  for (const road of scene.roads) points.push(road.start, road.end, ...road.quad)
  for (const fence of scene.fences) points.push(fence.start, fence.end)
  for (const terrain of scene.terrain) points.push(...terrain.points)
  for (const sprite of scene.sprites) points.push(sprite.position)
  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y },
  )
}

function buildScene(regionLayout: SyncChunk, diagnostics: string[]): BoneyardScene {
  const spawnChunk = regionLayout.children[2]
  if (spawnChunk.payload.byteLength !== 12) {
    throw new BoneyardParseError(spawnChunk.offset, 'spawn section must contain a point and direction')
  }
  const spawnView = view(spawnChunk.payload)
  const partial = {
    spawn: {
      kind: 'spawn' as const,
      position: finitePoint(spawnChunk.payload, 0, 'spawn position', spawnChunk),
      direction: finite(spawnView.getFloat32(8, true), 'spawn direction', spawnChunk),
    },
    worldObjects: parseWorldObjects(regionLayout.children[0], diagnostics),
    roads: parseRoads(regionLayout.children[5], diagnostics),
    fences: parseFences(regionLayout.children[6], diagnostics),
    terrain: parseTerrain(regionLayout.children[12], diagnostics),
    sprites: parseSprites(regionLayout.children[11]),
  }
  return { ...partial, bounds: sceneBounds(partial) }
}

export function parseBoneyard(input: ArrayBuffer | Uint8Array): BoneyardDocument {
  const reader = new Reader(input)
  const parsed = reader.buffer(0)
  if (reader.offset !== reader.bytes.byteLength) {
    throw reader.invalid('trailing data follows the SyncBuffer')
  }

  const root = parsed.root
  if (root.payload.byteLength !== 0 || root.children.length !== 1) {
    throw new BoneyardParseError(root.offset, 'root chunk must contain exactly one Arena chunk')
  }
  const arena = root.children[0]
  if (arena.payload.byteLength !== 0 || arena.children.length !== ARENA_SECTION_COUNT) {
    throw new BoneyardParseError(arena.offset, `Arena chunk must contain ${ARENA_SECTION_COUNT} sections`)
  }
  const region = arena.children[12]
  if (region.payload.byteLength !== 0 || region.children.length !== 1) {
    throw new BoneyardParseError(region.offset, 'Arena Region section must contain one RegionLayout chunk')
  }
  const regionLayout = region.children[0]
  if (regionLayout.payload.byteLength !== 0 || regionLayout.children.length !== REGION_LAYOUT_SECTION_COUNT) {
    throw new BoneyardParseError(
      regionLayout.offset,
      `RegionLayout chunk must contain ${REGION_LAYOUT_SECTION_COUNT} sections`,
    )
  }

  const diagnostics: string[] = []
  return {
    internalName: parseInternalName(arena.children[0]),
    bytes: reader.bytes,
    root,
    namedBuffers: parsed.namedBuffers,
    stats: {
      bytes: reader.bytes.byteLength,
      chunks: reader.chunkCount,
      namedBuffers: reader.namedBufferCount,
      maxDepth: reader.maxDepth,
    },
    scene: buildScene(regionLayout, diagnostics),
    diagnostics,
  }
}

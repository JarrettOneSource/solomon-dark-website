// Lossless browser-safe parser and authoring encoder for Solomon Dark Boneyards.

import type {
  EditorDoc,
  OpaqueChunk,
  PlacedObject,
  Polyline,
  Rect,
  StaticSprite,
  TerrainPatch,
  Vec2,
} from '../model.ts'

export interface BoneyardBounds extends Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface BoneyardMeta {
  name: string
  bounds: BoneyardBounds
  header: {
    flags: number[]
    arenaRuleMode: number
    sessionFlag: number
    compatibilityFlags: string
    environmentMode: number
    trailing: string
  }
  raw: {
    file: string
    arenaSections: string[]
  }
}

export interface BoneyardPlacedObject extends PlacedObject {
  typeName?: string
  secondaryVariant?: number
  secondaryVisible?: boolean
  secondaryVisibleByte?: number
  overlayVariant?: number
  tint?: { r: number; g: number; b: number; a: number }
  subtype?: number
  phase?: number
  active?: boolean
  activeByte?: number
  timer?: number
  rewardSeed?: number
  atlasEntry?: number
  secondaryAtlasEntry?: number
  overlayAtlasEntry?: number
  atlasEntries?: number[]
}

export interface BoneyardRoad extends Polyline {
  typeId: 3004
  uid?: number
  previousUid?: number
  nextUid?: number
  quad?: Vec2[]
  startWidthScale?: number
  endWidthScale?: number
}

export interface BoneyardFence extends Polyline {
  typeId: 3005
  uid?: number
  startPostVariant?: number
  endPostVariant?: number
  segmentCode?: number
}

export interface BoneyardTerrain extends TerrainPatch {
  typeId: 3009
  points?: Vec2[]
  style?: number
  reserved?: number
  uid?: number
  profileSamples?: number[]
  sideSign?: number
}

export interface BoneyardStaticSprite extends StaticSprite {
  deadHawgEntry?: number
  rotationDeg: number
  scale: number
  alpha: number
  raw?: string
}

export interface RawRecipe {
  typeId: number
  typeName?: string
  index?: number
  raw?: string
  name?: string
  uid?: number
  [key: string]: unknown
}

export interface MonsterRecipe extends RawRecipe {
  typeId: 6001
  enemyType?: number
  maxHp?: number
  primaryDamage?: number
  chaseSpeed?: number
  moveSpeedScale?: number
  variantMode?: number
  projectileMode?: number
  auraMode?: number
  headgearMode?: number
  unknown81?: number
  unknown82?: number
  randomVariant?: number
  archetype?: string
  hasLinkedUid?: boolean
  hasLinkedUidByte?: number
  linkedUid?: number
  behaviorCount?: number
  behaviorMin?: number
  behaviorMax?: number
  flanking?: boolean
  flankingByte?: number
  pathfindingMode?: number
  dropOrbs?: number
  dropPowerups?: number
  dropItems?: number
  dropSpecificItems?: number
  dropGold?: number
  dropPotions?: number
  specialSpawnMode?: number
  attackSpeed?: number
  xpBonus?: number
  secondaryDamage?: number
  shield?: boolean
  shieldByte?: number
  shieldOthers?: boolean
  shieldOthersByte?: number
  unknown96?: boolean
  unknown96Byte?: number
  burning?: boolean
  burningByte?: number
  tertiaryDamage?: number
  extraDamage?: number
  behaviorTimer?: number
  rect98?: Rect | BoneyardBounds
  rectA8?: Rect | BoneyardBounds
  castMode?: number
}

export interface UidGroupRecipe extends RawRecipe {
  typeId: 6002
  memberUids?: number[]
  fields58?: number[]
  field34?: number
}

export interface TimelineRecord extends RawRecipe {
  eventCount?: number
  eventTypeIds?: number[]
  reservedUids?: number[]
}

export interface BoneyardGeometry {
  playerSpawn?: Vec2
  playerSpawnFacingDeg?: number
  layoutFlag?: number
  triggerControlRaw: string
  regionGeometryRaw: string
  layoutFlagRaw: string
  rawSections: string[]
}

export type BoneyardDoc = Omit<
  EditorDoc,
  'meta' | 'objects' | 'roads' | 'fences' | 'terrain' | 'sprites'
> & {
  format: 'solomon-dark-boneyard'
  version: 1
  meta: BoneyardMeta
  objects: BoneyardPlacedObject[]
  roads: BoneyardRoad[]
  fences: BoneyardFence[]
  terrain: BoneyardTerrain[]
  sprites: BoneyardStaticSprite[]
  recipes: {
    monsters: MonsterRecipe[]
    items: RawRecipe[]
    npcs: RawRecipe[]
    itemSets: RawRecipe[]
    uidGroups: UidGroupRecipe[]
  }
  timeline: {
    records: TimelineRecord[]
    defaultTransplantSafe: boolean
  }
  geometry: BoneyardGeometry
}

type Chunk = { payload: Uint8Array; children: Chunk[] }
type NamedBuffer = { name: Uint8Array; root: Chunk; named: NamedBuffer[] }
type SyncBuffer = { root: Chunk; named: NamedBuffer[] }

export const STATIC_SPRITE_ATLAS_BASE = 114

const TYPE_NAMES: Record<number, string> = {
  2001: 'Tree',
  2009: 'Monument',
  2029: 'Gravestone',
  2040: 'Building',
  2061: 'Goodie',
  3004: 'Road',
  3005: 'Fence',
  3006: 'Fencepost',
  3007: 'FenceGrate',
  3009: 'Terrain',
  6001: 'MonsterRecipe',
  6002: 'UIDGroup',
  6003: 'ItemRecipe',
  6004: 'NPCRecipe',
  6005: 'ItemSet',
  6006: 'TimeLine',
  6007: 'TimeLineEvent',
}

const PLACEABLES = new Set([2001, 2009, 2029, 2040, 2061])
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const MAX_FILE_BYTES = 256 * 1024 * 1024
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const FORMAT_READY = true

class Reader {
  bytes: Uint8Array
  offset = 0
  chunks = 0
  namedBuffers = 0
  label: string

  constructor(bytes: Uint8Array, label: string) {
    if (bytes.length > MAX_FILE_BYTES) throw new Error(`${label}: file exceeds 256 MiB`)
    this.bytes = bytes
    this.label = label
  }

  read(size: number): Uint8Array {
    const end = this.offset + size
    if (size < 0 || end > this.bytes.length) throw new Error(`${this.label}: truncated at byte ${this.offset}`)
    const value = this.bytes.slice(this.offset, end)
    this.offset = end
    return value
  }

  u32(): number {
    const value = readU32(this.bytes, this.offset)
    this.offset += 4
    return value
  }

  chunk(depth = 0): Chunk {
    if (depth > 512) throw new Error(`${this.label}: chunk nesting exceeds 512`)
    this.chunks += 1
    if (this.chunks > 1_000_000) throw new Error(`${this.label}: too many chunks`)
    const payload = this.read(this.u32())
    const count = this.u32()
    if (count > 1_000_000 - this.chunks) throw new Error(`${this.label}: too many chunks`)
    const children: Chunk[] = []
    for (let i = 0; i < count; i += 1) children.push(this.chunk(depth + 1))
    return { payload, children }
  }

  buffer(depth = 0): SyncBuffer {
    const root = this.chunk(depth)
    const count = this.u32()
    if (count > 65_536 - this.namedBuffers) throw new Error(`${this.label}: too many named buffers`)
    const named: NamedBuffer[] = []
    for (let i = 0; i < count; i += 1) {
      this.namedBuffers += 1
      const name = this.read(this.u32())
      if (name.length === 0 || name[name.length - 1] !== 0 || name.slice(0, -1).includes(0)) {
        throw new Error(`${this.label}: invalid named buffer`)
      }
      const child = this.buffer(depth + 1)
      named.push({ name: name.slice(0, -1), root: child.root, named: child.named })
    }
    return { root, named }
  }
}

function readU32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) throw new Error('truncated u32')
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

function readF32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) throw new Error('truncated f32')
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(offset, true)
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value >>> 0, true)
}

function writeF32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setFloat32(offset, value, true)
}

function u32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  writeU32(bytes, 0, value)
  return bytes
}

function f32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  writeF32(bytes, 0, value)
  return bytes
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function encodeChunkParts(chunk: Chunk, parts: Uint8Array[]): void {
  parts.push(u32Bytes(chunk.payload.length), chunk.payload, u32Bytes(chunk.children.length))
  for (const child of chunk.children) encodeChunkParts(child, parts)
}

function encodeChunk(chunk: Chunk): Uint8Array {
  const parts: Uint8Array[] = []
  encodeChunkParts(chunk, parts)
  return concat(parts)
}

function encodeBufferParts(buffer: SyncBuffer, parts: Uint8Array[]): void {
  encodeChunkParts(buffer.root, parts)
  parts.push(u32Bytes(buffer.named.length))
  for (const item of buffer.named) {
    parts.push(u32Bytes(item.name.length + 1), item.name, new Uint8Array([0]))
    encodeBufferParts({ root: item.root, named: item.named }, parts)
  }
}

function encodeBuffer(buffer: SyncBuffer): Uint8Array {
  const parts: Uint8Array[] = []
  encodeBufferParts(buffer, parts)
  return concat(parts)
}

function parseBuffer(bytes: Uint8Array, label: string): SyncBuffer {
  const reader = new Reader(bytes, label)
  const result = reader.buffer()
  if (reader.offset !== bytes.length) throw new Error(`${label}: trailing bytes at ${reader.offset}`)
  validateEnvelope(result.root, label)
  return result
}

function parseChunks(bytes: Uint8Array, expected?: number): Chunk[] {
  const reader = new Reader(bytes, 'raw entity')
  const chunks: Chunk[] = []
  while (reader.offset < bytes.length) chunks.push(reader.chunk())
  if (expected !== undefined && chunks.length !== expected) {
    throw new Error(`raw entity has ${chunks.length} chunks; expected ${expected}`)
  }
  return chunks
}

function validateEnvelope(root: Chunk, label: string): void {
  if (root.payload.length !== 0 || root.children.length !== 1) throw new Error(`${label}: invalid root`)
  const arena = root.children[0]
  if (arena.payload.length !== 0 || arena.children.length !== 13) throw new Error(`${label}: invalid Arena`)
  const region = arena.children[12]
  if (region.payload.length !== 0 || region.children.length !== 1) throw new Error(`${label}: invalid Region`)
  const layout = region.children[0]
  if (layout.payload.length !== 0 || layout.children.length !== 14) throw new Error(`${label}: invalid RegionLayout`)
}

function arenaAndLayout(buffer: SyncBuffer): [Chunk, Chunk] {
  const arena = buffer.root.children[0]
  return [arena, arena.children[12].children[0]]
}

function toBase64(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]
    const hasB = i + 1 < bytes.length
    const hasC = i + 2 < bytes.length
    const b = hasB ? bytes[i + 1] : 0
    const c = hasC ? bytes[i + 2] : 0
    result += BASE64[a >> 2]
    result += BASE64[((a & 3) << 4) | (b >> 4)]
    result += hasB ? BASE64[((b & 15) << 2) | (c >> 6)] : '='
    result += hasC ? BASE64[c & 63] : '='
  }
  return result
}

function fromBase64(value: string): Uint8Array {
  if (value.length % 4 !== 0) throw new Error('invalid base64 raw field')
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  const result = new Uint8Array((value.length / 4) * 3 - padding)
  let output = 0
  for (let i = 0; i < value.length; i += 4) {
    const sextets = [0, 1, 2, 3].map((j) => {
      const char = value[i + j]
      if (char === '=') return 0
      const index = BASE64.indexOf(char)
      if (index < 0) throw new Error('invalid base64 raw field')
      return index
    })
    const bits = (sextets[0] << 18) | (sextets[1] << 12) | (sextets[2] << 6) | sextets[3]
    if (output < result.length) result[output++] = (bits >>> 16) & 255
    if (output < result.length) result[output++] = (bits >>> 8) & 255
    if (output < result.length) result[output++] = bits & 255
  }
  return result
}

function rawChunks(chunks: Chunk[]): string {
  return toBase64(concat(chunks.map(encodeChunk)))
}

function nativeString(bytes: Uint8Array, offset = 0): [string, number] {
  const size = readU32(bytes, offset)
  const start = offset + 4
  const end = start + size
  if (size === 0 || end > bytes.length || bytes[end - 1] !== 0) throw new Error('invalid native String')
  return [decoder.decode(bytes.slice(start, end - 1)), end]
}

function encodeNativeString(value: string): Uint8Array {
  const text = encoder.encode(value)
  return concat([u32Bytes(text.length + 1), text, new Uint8Array([0])])
}

function manager(section: Chunk): [number[], Chunk[]] {
  if (section.payload.length < 4) throw new Error('truncated polymorphic manager')
  const count = readU32(section.payload, 0)
  if (section.payload.length !== 4 + count * 4) throw new Error('invalid polymorphic manager')
  const ids: number[] = []
  for (let i = 0; i < count; i += 1) ids.push(readU32(section.payload, 4 + i * 4))
  return [ids, section.children]
}

function setManager(section: Chunk, ids: number[], children: Chunk[]): void {
  const payload = new Uint8Array(4 + ids.length * 4)
  writeU32(payload, 0, ids.length)
  ids.forEach((id, i) => writeU32(payload, 4 + i * 4, id))
  section.payload = payload
  section.children = children
}

function boundsRect(left: number, top: number, right: number, bottom: number): BoneyardBounds {
  return { left, top, right, bottom, x: left, y: top, w: right - left, h: bottom - top }
}

function parseHeader(payload: Uint8Array): { meta: Omit<BoneyardMeta, 'raw'>; end: number } {
  const [name, end] = nativeString(payload)
  if (end + 535 > payload.length) throw new Error('Arena header is too short')
  const left = readF32(payload, end + 519)
  const top = readF32(payload, end + 523)
  const right = readF32(payload, end + 527)
  const bottom = readF32(payload, end + 531)
  return {
    meta: {
      name,
      bounds: boundsRect(left, top, right, bottom),
      header: {
        flags: [...payload.slice(end, end + 6)],
        arenaRuleMode: payload[end + 2],
        sessionFlag: payload[end + 5],
        compatibilityFlags: toBase64(payload.slice(end + 6, end + 518)),
        environmentMode: payload[end + 518],
        trailing: toBase64(payload.slice(end + 535)),
      },
    },
    end,
  }
}

function headerBounds(value: BoneyardBounds, old: BoneyardBounds): [number, number, number, number] {
  const aliasesChanged = value.x !== old.x || value.y !== old.y || value.w !== old.w || value.h !== old.h
  const edgesChanged = value.left !== old.left || value.top !== old.top || value.right !== old.right || value.bottom !== old.bottom
  if (aliasesChanged && !edgesChanged) return [value.x, value.y, value.x + value.w, value.y + value.h]
  return [value.left, value.top, value.right, value.bottom]
}

function encodeHeader(payload: Uint8Array, meta: BoneyardMeta): Uint8Array {
  const oldHeader = parseHeader(payload)
  const tail = payload.slice(oldHeader.end)
  if (meta.header.flags.length !== 6) throw new Error('meta.header.flags must contain six bytes')
  tail.set(meta.header.flags, 0)
  const old = oldHeader.meta.header
  const ruleFlagChanged = tail[2] !== old.flags[2]
  const ruleAliasChanged = meta.header.arenaRuleMode !== old.arenaRuleMode
  if (ruleAliasChanged || !ruleFlagChanged) tail[2] = meta.header.arenaRuleMode & 255
  const sessionFlagChanged = tail[5] !== old.flags[5]
  const sessionAliasChanged = meta.header.sessionFlag !== old.sessionFlag
  if (sessionAliasChanged || !sessionFlagChanged) tail[5] = meta.header.sessionFlag & 255
  const compatibility = fromBase64(meta.header.compatibilityFlags)
  if (compatibility.length !== 512) throw new Error('compatibilityFlags must decode to 512 bytes')
  tail.set(compatibility, 6)
  tail[518] = meta.header.environmentMode & 255
  const bounds = headerBounds(meta.bounds, oldHeader.meta.bounds)
  bounds.forEach((value, i) => writeF32(tail, 519 + i * 4, value))
  return concat([encodeNativeString(meta.name), tail])
}

function decodeObject(typeId: number, chunks: Chunk[], index: number): BoneyardPlacedObject {
  const item: BoneyardPlacedObject = {
    eid: `object-${index}`,
    typeId,
    typeName: TYPE_NAMES[typeId],
    pos: { x: 0, y: 0 },
    raw: rawChunks(chunks),
  }
  if (!PLACEABLES.has(typeId) || chunks.length !== 3 || chunks[0].payload.length !== 41) return item
  item.pos = { x: readF32(chunks[0].payload, 0), y: readF32(chunks[0].payload, 4) }
  if (chunks[1].payload.length >= 53) item.sortBias = readF32(chunks[1].payload, 49)
  const subtype = chunks[2].payload
  if (typeId === 2001 && subtype.length === 5) {
    item.variant = subtype[0] | (subtype[1] << 8)
    item.secondaryVariant = subtype[2] | (subtype[3] << 8)
    item.secondaryVisible = subtype[4] !== 0
    item.secondaryVisibleByte = subtype[4]
    item.atlasEntry = 264 + item.variant
    item.secondaryAtlasEntry = 243 + item.secondaryVariant
  } else if (typeId === 2009 && subtype.length === 2) {
    item.variant = subtype[0] | (subtype[1] << 8)
    item.atlasEntry = 156 + item.variant
  } else if (typeId === 2029 && subtype.length === 20) {
    item.variant = subtype[0] | (subtype[1] << 8)
    item.overlayVariant = subtype[2] | (subtype[3] << 8)
    item.atlasEntry = 97 + item.variant
    item.overlayAtlasEntry = 88 + item.overlayVariant
    item.tint = {
      r: readF32(subtype, 4),
      g: readF32(subtype, 8),
      b: readF32(subtype, 12),
      a: readF32(subtype, 16),
    }
  } else if (typeId === 2040 && subtype.length === 2) {
    item.variant = subtype[0] | (subtype[1] << 8)
    item.atlasEntries = [148 + item.variant, 152 + item.variant]
  } else if (typeId === 2061 && subtype.length === 12) {
    item.subtype = subtype[0] | (subtype[1] << 8)
    item.phase = subtype[2]
    item.variant = item.subtype * 2 + item.phase
    item.active = subtype[3] !== 0
    item.activeByte = subtype[3]
    item.timer = readU32(subtype, 4)
    item.rewardSeed = readU32(subtype, 8)
    item.atlasEntry = 145 + item.variant
  }
  return item
}

function defaultCommon(typeId: number, pos: Vec2): [Chunk, Chunk] {
  const radius: Record<number, number> = { 2001: 8, 2009: 1, 2029: 0.01, 2040: 1, 2061: 20 }
  const first = new Uint8Array(41)
  ;[pos.x, pos.y, 0, 0, 90000, 0, radius[typeId]].forEach((value, i) => writeF32(first, i * 4, value))
  writeU32(first, 28, 0)
  first[32] = 0
  writeU32(first, 33, 0)
  writeU32(first, 37, 16)

  const second = new Uint8Array(101)
  second[0] = 0
  writeU32(second, 3, typeId === 2061 ? 8196 : 4)
  ;[0, 1, 1, 0, 1, 0].forEach((value, i) => writeF32(second, 8 + i * 4, value))
  ;[1, 1, 1, 1].forEach((value, i) => writeF32(second, 32 + i * 4, value))
  writeF32(second, 49, typeId === 2040 ? -50 : 0)
  writeF32(second, 53, 1)
  second.set([1, 0, 0, 1], 57)
  writeU32(second, 61, 1000)
  writeF32(second, 65, 1)
  ;[1, 1, 1, 1].forEach((value, i) => writeF32(second, 69 + i * 4, value))
  return [{ payload: first, children: [] }, { payload: second, children: [] }]
}

function encodeObject(item: BoneyardPlacedObject): Chunk[] {
  const typeId = item.typeId
  let chunks: Chunk[]
  if (item.raw) chunks = parseChunks(fromBase64(item.raw), PLACEABLES.has(typeId) ? 3 : undefined)
  else if (PLACEABLES.has(typeId)) {
    const common = defaultCommon(typeId, item.pos)
    chunks = [common[0], common[1], { payload: new Uint8Array(), children: [] }]
  } else throw new Error(`new unknown placeable ${typeId} requires raw`)
  if (!PLACEABLES.has(typeId)) return chunks
  if (item.raw && chunks[0].payload.length !== 41) return chunks
  writeF32(chunks[0].payload, 0, item.pos.x)
  writeF32(chunks[0].payload, 4, item.pos.y)
  if (chunks[1].payload.length >= 53 && (item.sortBias !== undefined || !item.raw)) {
    writeF32(chunks[1].payload, 49, item.sortBias ?? (typeId === 2040 ? -50 : 0))
  }
  if (typeId === 2001) {
    if (item.raw && item.variant === undefined && item.secondaryVariant === undefined
      && item.secondaryVisible === undefined && item.secondaryVisibleByte === undefined) return chunks
    const data = new Uint8Array(5)
    const variant = item.variant ?? 0
    const secondary = item.secondaryVariant ?? 0
    data[0] = variant & 255
    data[1] = variant >>> 8
    data[2] = secondary & 255
    data[3] = secondary >>> 8
    let visibleByte = item.secondaryVisibleByte ?? (item.secondaryVisible === false ? 0 : 1)
    if ((visibleByte !== 0) !== (item.secondaryVisible !== false)) visibleByte = item.secondaryVisible === false ? 0 : 1
    data[4] = visibleByte
    chunks[2].payload = data
  } else if (typeId === 2009 || typeId === 2040) {
    if (item.raw && item.variant === undefined) return chunks
    const value = item.variant ?? 0
    chunks[2].payload = new Uint8Array([value & 255, value >>> 8])
  } else if (typeId === 2029) {
    if (item.raw && item.variant === undefined && item.overlayVariant === undefined && item.tint === undefined) return chunks
    const data = new Uint8Array(20)
    const variant = item.variant ?? 0
    const overlay = item.overlayVariant ?? 0
    data[0] = variant & 255
    data[1] = variant >>> 8
    data[2] = overlay & 255
    data[3] = overlay >>> 8
    const tint = item.tint ?? { r: 1, g: 1, b: 1, a: 1 }
    ;[tint.r, tint.g, tint.b, tint.a].forEach((value, i) => writeF32(data, 4 + i * 4, value))
    chunks[2].payload = data
  } else {
    if (item.raw && item.variant === undefined && item.subtype === undefined && item.phase === undefined
      && item.active === undefined && item.activeByte === undefined && item.timer === undefined && item.rewardSeed === undefined) return chunks
    const visual = item.variant ?? 0
    const data = new Uint8Array(12)
    let subtype = item.subtype ?? Math.floor(visual / 2)
    let phase = item.phase ?? visual % 2
    if (item.raw && chunks[2].payload.length === 12) {
      const oldSubtype = chunks[2].payload[0] | (chunks[2].payload[1] << 8)
      const oldPhase = chunks[2].payload[2]
      if (visual !== oldSubtype * 2 + oldPhase && subtype === oldSubtype && phase === oldPhase) {
        subtype = Math.floor(visual / 2)
        phase = visual % 2
      }
    }
    data[0] = subtype & 255
    data[1] = subtype >>> 8
    data[2] = phase
    let activeByte = item.activeByte ?? (item.active ? 1 : 0)
    if ((activeByte !== 0) !== Boolean(item.active)) activeByte = item.active ? 1 : 0
    data[3] = activeByte
    writeU32(data, 4, item.timer ?? 0)
    writeU32(data, 8, item.rewardSeed ?? 0)
    chunks[2].payload = data
  }
  return chunks
}

function decodeRoad(chunk: Chunk, index: number): BoneyardRoad {
  const item: BoneyardRoad = { eid: `road-${index}`, typeId: 3004, points: [], raw: rawChunks([chunk]) }
  if (chunk.payload.length !== 69) return item
  item.points = [
    { x: readF32(chunk.payload, 0), y: readF32(chunk.payload, 4) },
    { x: readF32(chunk.payload, 8), y: readF32(chunk.payload, 12) },
  ]
  item.uid = readU32(chunk.payload, 16)
  item.previousUid = readU32(chunk.payload, 20)
  item.nextUid = readU32(chunk.payload, 24)
  item.quad = Array.from({ length: 4 }, (_, i) => ({
    x: readF32(chunk.payload, 28 + i * 8),
    y: readF32(chunk.payload, 32 + i * 8),
  }))
  item.style = chunk.payload[60]
  item.startWidthScale = readF32(chunk.payload, 61)
  item.endWidthScale = readF32(chunk.payload, 65)
  return item
}

function deriveRoadQuad(points: Vec2[], startScale: number, endScale: number): Vec2[] {
  const dx = points[1].x - points[0].x
  const dy = points[1].y - points[0].y
  const length = Math.hypot(dx, dy)
  const nx = length === 0 ? 0 : -dy / length
  const ny = length === 0 ? 1 : dx / length
  return [
    { x: points[0].x + nx * 55 * startScale, y: points[0].y + ny * 55 * startScale },
    { x: points[0].x - nx * 55 * startScale, y: points[0].y - ny * 55 * startScale },
    { x: points[1].x + nx * 55 * endScale, y: points[1].y + ny * 55 * endScale },
    { x: points[1].x - nx * 55 * endScale, y: points[1].y - ny * 55 * endScale },
  ]
}

function encodeRoad(item: BoneyardRoad, nextUid: () => number): Chunk {
  const chunk = item.raw ? parseChunks(fromBase64(item.raw), 1)[0] : { payload: new Uint8Array(), children: [] }
  if (item.points.length !== 2) {
    if (item.raw) return chunk
    throw new Error('new Road requires two points')
  }
  const data = new Uint8Array(69)
  const startScale = item.startWidthScale ?? 1
  const endScale = item.endWidthScale ?? 1
  let quad = item.quad
  if (item.raw && quad) {
    const old = chunk.payload
    const pointsChanged = item.points[0].x !== readF32(old, 0) || item.points[0].y !== readF32(old, 4)
      || item.points[1].x !== readF32(old, 8) || item.points[1].y !== readF32(old, 12)
      || startScale !== readF32(old, 61) || endScale !== readF32(old, 65)
    const quadUnchanged = quad.every((point, i) => point.x === readF32(old, 28 + i * 8) && point.y === readF32(old, 32 + i * 8))
    if (pointsChanged && quadUnchanged) quad = undefined
  }
  quad ??= deriveRoadQuad(item.points, startScale, endScale)
  ;[item.points[0].x, item.points[0].y, item.points[1].x, item.points[1].y].forEach((value, i) => writeF32(data, i * 4, value))
  writeU32(data, 16, item.uid ?? nextUid())
  writeU32(data, 20, item.previousUid ?? 0xffffffff)
  writeU32(data, 24, item.nextUid ?? 0xffffffff)
  quad.forEach((point, i) => {
    writeF32(data, 28 + i * 8, point.x)
    writeF32(data, 32 + i * 8, point.y)
  })
  data[60] = item.style ?? 0
  writeF32(data, 61, startScale)
  writeF32(data, 65, endScale)
  chunk.payload = data
  return chunk
}

function decodeFence(chunk: Chunk, index: number): BoneyardFence {
  const item: BoneyardFence = { eid: `fence-${index}`, typeId: 3005, points: [], raw: rawChunks([chunk]) }
  if (chunk.payload.length !== 29) return item
  item.points = [
    { x: readF32(chunk.payload, 0), y: readF32(chunk.payload, 4) },
    { x: readF32(chunk.payload, 8), y: readF32(chunk.payload, 12) },
  ]
  item.uid = readU32(chunk.payload, 16)
  item.startPostVariant = readU32(chunk.payload, 20)
  item.endPostVariant = readU32(chunk.payload, 24)
  item.segmentCode = chunk.payload[28]
  item.style = item.segmentCode
  return item
}

function encodeFence(item: BoneyardFence, nextUid: () => number): Chunk {
  const chunk = item.raw ? parseChunks(fromBase64(item.raw), 1)[0] : { payload: new Uint8Array(), children: [] }
  if (item.points.length !== 2) {
    if (item.raw) return chunk
    throw new Error('new Fence requires two points')
  }
  const data = new Uint8Array(29)
  const oldSegment = chunk.payload.length === 29 ? chunk.payload[28] : 0
  let segmentCode = item.segmentCode ?? item.style ?? oldSegment
  if (segmentCode === oldSegment && item.style !== undefined && item.style !== oldSegment) segmentCode = item.style
  ;[item.points[0].x, item.points[0].y, item.points[1].x, item.points[1].y].forEach((value, i) => writeF32(data, i * 4, value))
  writeU32(data, 16, item.uid ?? nextUid())
  writeU32(data, 20, item.startPostVariant ?? 0xffffffff)
  writeU32(data, 24, item.endPostVariant ?? 0xffffffff)
  data[28] = segmentCode
  chunk.payload = data
  return chunk
}

function decodeTerrain(chunk: Chunk, index: number): BoneyardTerrain {
  const item: BoneyardTerrain = {
    eid: `terrain-${index}`,
    typeId: 3009,
    pos: { x: 0, y: 0 },
    raw: rawChunks([chunk]),
  }
  try {
    const style = readU32(chunk.payload, 0)
    const reserved = readU32(chunk.payload, 4)
    const count = readU32(chunk.payload, 8)
    let offset = 12
    const points = Array.from({ length: count }, () => {
      const point = { x: readF32(chunk.payload, offset), y: readF32(chunk.payload, offset + 4) }
      offset += 8
      return point
    })
    const uid = readU32(chunk.payload, offset)
    const profileCount = readU32(chunk.payload, offset + 4)
    offset += 8
    const profileSamples = Array.from({ length: profileCount }, () => {
      const value = readF32(chunk.payload, offset)
      offset += 4
      return value
    })
    const sideSign = readF32(chunk.payload, offset)
    offset += 4
    if (offset !== chunk.payload.length) return item
    Object.assign(item, {
      points,
      pos: points[0] ?? { x: 0, y: 0 },
      style,
      entry: style,
      reserved,
      uid,
      profileSamples,
      sideSign,
    })
  } catch {
    return item
  }
  return item
}

function encodeTerrain(item: BoneyardTerrain, nextUid: () => number): Chunk {
  const chunk = item.raw ? parseChunks(fromBase64(item.raw), 1)[0] : { payload: new Uint8Array(), children: [] }
  if (item.raw && item.points === undefined && item.style === undefined) return chunk
  const points = item.points ?? [item.pos]
  const profile = item.profileSamples ?? []
  const data = new Uint8Array(12 + points.length * 8 + 8 + profile.length * 4 + 4)
  writeU32(data, 0, item.style ?? item.entry ?? 0)
  writeU32(data, 4, item.reserved ?? 0xcdcdcdcd)
  writeU32(data, 8, points.length)
  let offset = 12
  points.forEach((point) => {
    writeF32(data, offset, point.x)
    writeF32(data, offset + 4, point.y)
    offset += 8
  })
  writeU32(data, offset, item.uid ?? nextUid())
  writeU32(data, offset + 4, profile.length)
  offset += 8
  profile.forEach((value) => {
    writeF32(data, offset, value)
    offset += 4
  })
  writeF32(data, offset, item.sideSign ?? 1)
  chunk.payload = data
  return chunk
}

function decodeSprite(payload: Uint8Array, offset: number, index: number): BoneyardStaticSprite {
  const rotation = readF32(payload, offset + 12)
  const scale = readF32(payload, offset + 16)
  const alpha = readF32(payload, offset + 20)
  return {
    eid: `sprite-${index}`,
    atlasEntry: readU32(payload, offset),
    deadHawgEntry: STATIC_SPRITE_ATLAS_BASE + readU32(payload, offset),
    pos: { x: readF32(payload, offset + 4), y: readF32(payload, offset + 8) },
    rotationDeg: rotation,
    scale,
    alpha,
    s0: rotation,
    s1: scale,
    s2: alpha,
    flags: payload[offset + 24],
    raw: toBase64(payload.slice(offset, offset + 25)),
  }
}

function encodeSprite(item: BoneyardStaticSprite): Uint8Array {
  const data = new Uint8Array(25)
  let rotation = item.rotationDeg ?? item.s0
  let scale = item.scale ?? item.s1
  let alpha = item.alpha ?? item.s2
  if (item.raw) {
    const old = fromBase64(item.raw)
    if (old.length === 25) {
      if (item.s0 !== readF32(old, 12) && rotation === readF32(old, 12)) rotation = item.s0
      if (item.s1 !== readF32(old, 16) && scale === readF32(old, 16)) scale = item.s1
      if (item.s2 !== readF32(old, 20) && alpha === readF32(old, 20)) alpha = item.s2
    }
  }
  writeU32(data, 0, item.atlasEntry)
  writeF32(data, 4, item.pos.x)
  writeF32(data, 8, item.pos.y)
  writeF32(data, 12, rotation)
  writeF32(data, 16, scale)
  writeF32(data, 20, alpha)
  data[24] = item.flags
  return data
}

function opaqueRecord(typeId: number, chunk: Chunk, index: number): RawRecipe {
  return { typeId, typeName: TYPE_NAMES[typeId], index, raw: rawChunks([chunk]) }
}

class PayloadCursor {
  data: Uint8Array
  offset = 0

  constructor(data: Uint8Array) {
    this.data = data
  }

  u8(): number {
    if (this.offset >= this.data.length) throw new Error('truncated byte')
    return this.data[this.offset++]
  }

  u32(): number {
    const value = readU32(this.data, this.offset)
    this.offset += 4
    return value
  }

  f32(): number {
    const value = readF32(this.data, this.offset)
    this.offset += 4
    return value
  }

  string(): string {
    const value = nativeString(this.data, this.offset)
    this.offset = value[1]
    return value[0]
  }

  rectangle(): BoneyardBounds {
    const result = boundsRect(this.f32(), this.f32(), this.f32(), this.f32())
    return result
  }
}

function decodeMonster(chunk: Chunk, index: number): MonsterRecipe {
  const fallback = opaqueRecord(6001, chunk, index) as MonsterRecipe
  try {
    const p = new PayloadCursor(chunk.payload)
    const item: MonsterRecipe = {
      ...fallback,
      enemyType: p.u32(),
      name: p.string(),
      uid: p.u32(),
      maxHp: p.f32(),
      primaryDamage: p.f32(),
      chaseSpeed: p.f32(),
      moveSpeedScale: p.f32(),
      variantMode: p.u32(),
      projectileMode: p.u32(),
      auraMode: p.u32(),
      headgearMode: p.u8(),
      unknown81: p.u8(),
      unknown82: p.u8(),
      randomVariant: p.u8(),
      archetype: p.string(),
    }
    item.hasLinkedUidByte = p.u8()
    item.hasLinkedUid = item.hasLinkedUidByte !== 0
    item.linkedUid = p.u32()
    item.behaviorCount = p.u32()
    item.behaviorMin = p.u32()
    item.behaviorMax = p.u32()
    item.flankingByte = p.u8()
    item.flanking = item.flankingByte !== 0
    item.pathfindingMode = p.u8()
    item.dropOrbs = p.u8()
    item.dropPowerups = p.u8()
    item.dropItems = p.u8()
    item.dropSpecificItems = p.u8()
    item.dropGold = p.u8()
    item.dropPotions = p.u8()
    item.specialSpawnMode = p.u8()
    item.attackSpeed = p.f32()
    item.xpBonus = p.f32()
    item.secondaryDamage = p.f32()
    item.shieldByte = p.u8()
    item.shield = item.shieldByte !== 0
    item.shieldOthersByte = p.u8()
    item.shieldOthers = item.shieldOthersByte !== 0
    item.unknown96Byte = p.u8()
    item.unknown96 = item.unknown96Byte !== 0
    item.burningByte = p.u8()
    item.burning = item.burningByte !== 0
    item.tertiaryDamage = p.f32()
    item.extraDamage = p.f32()
    item.behaviorTimer = p.u32()
    item.rect98 = p.rectangle()
    item.rectA8 = p.rectangle()
    item.castMode = p.u8()
    return p.offset === chunk.payload.length ? item : fallback
  } catch {
    return fallback
  }
}

function decodeUidGroup(chunk: Chunk, index: number): UidGroupRecipe {
  const fallback = opaqueRecord(6002, chunk, index) as UidGroupRecipe
  try {
    const p = new PayloadCursor(chunk.payload)
    const name = p.string()
    const uid = p.u32()
    const count = p.u32()
    const members = Array.from({ length: count }, () => p.u32())
    const tail = Array.from({ length: 4 }, () => p.u32())
    if (p.offset !== chunk.payload.length) return fallback
    return { ...fallback, name, uid, memberUids: members, fields58: tail.slice(0, 3), field34: tail[3] }
  } catch {
    return fallback
  }
}

function recipeRectBytes(value?: Rect | BoneyardBounds): Uint8Array {
  const data = new Uint8Array(16)
  if (!value) return data
  const edges = 'left' in value
    ? [value.left, value.top, value.right, value.bottom]
    : [value.x, value.y, value.x + value.w, value.y + value.h]
  edges.forEach((field, index) => writeF32(data, index * 4, field))
  return data
}

function encodeMonster(item: MonsterRecipe, nextUid: () => number): Chunk {
  const chunk = item.raw ? parseChunks(fromBase64(item.raw), 1)[0] : { payload: new Uint8Array(), children: [] }
  if (item.raw && item.enemyType === undefined) return chunk
  let linkedUidByte = item.hasLinkedUidByte ?? (item.hasLinkedUid ? 1 : 0)
  if ((linkedUidByte !== 0) !== Boolean(item.hasLinkedUid)) linkedUidByte = item.hasLinkedUid ? 1 : 0
  const boolByte = (field: boolean | undefined, raw: number | undefined): number => {
    const value = raw ?? (field ? 1 : 0)
    return (value !== 0) === Boolean(field) ? value : (field ? 1 : 0)
  }
  chunk.payload = concat([
    u32Bytes(item.enemyType ?? 0),
    encodeNativeString(item.name ?? 'Monster'),
    u32Bytes(item.uid ?? nextUid()),
    f32Bytes(item.maxHp ?? 1),
    f32Bytes(item.primaryDamage ?? 0),
    f32Bytes(item.chaseSpeed ?? 0),
    f32Bytes(item.moveSpeedScale ?? 1),
    u32Bytes(item.variantMode ?? 0),
    u32Bytes(item.projectileMode ?? 0),
    u32Bytes(item.auraMode ?? 0),
    new Uint8Array([
      item.headgearMode ?? 0,
      item.unknown81 ?? 0,
      item.unknown82 ?? 0,
      item.randomVariant ?? 0,
    ]),
    encodeNativeString(item.archetype ?? ''),
    new Uint8Array([linkedUidByte]),
    u32Bytes(item.linkedUid ?? 0),
    u32Bytes(item.behaviorCount ?? 0),
    u32Bytes(item.behaviorMin ?? 0),
    u32Bytes(item.behaviorMax ?? 0),
    new Uint8Array([
      boolByte(item.flanking, item.flankingByte),
      item.pathfindingMode ?? 0,
      item.dropOrbs ?? 0,
      item.dropPowerups ?? 0,
      item.dropItems ?? 0,
      item.dropSpecificItems ?? 0,
      item.dropGold ?? 0,
      item.dropPotions ?? 0,
      item.specialSpawnMode ?? 0,
    ]),
    f32Bytes(item.attackSpeed ?? 0),
    f32Bytes(item.xpBonus ?? 0),
    f32Bytes(item.secondaryDamage ?? 0),
    new Uint8Array([
      boolByte(item.shield, item.shieldByte),
      boolByte(item.shieldOthers, item.shieldOthersByte),
      boolByte(item.unknown96, item.unknown96Byte),
      boolByte(item.burning, item.burningByte),
    ]),
    f32Bytes(item.tertiaryDamage ?? 0),
    f32Bytes(item.extraDamage ?? 0),
    u32Bytes(item.behaviorTimer ?? 0),
    recipeRectBytes(item.rect98),
    recipeRectBytes(item.rectA8),
    new Uint8Array([item.castMode ?? 0]),
  ])
  return chunk
}

function encodeUidGroup(item: UidGroupRecipe, nextUid: () => number): Chunk {
  const chunk = item.raw ? parseChunks(fromBase64(item.raw), 1)[0] : { payload: new Uint8Array(), children: [] }
  if (item.raw && item.memberUids === undefined) return chunk
  const members = item.memberUids ?? []
  const fields58 = item.fields58 ?? [0, 0, 0]
  if (fields58.length !== 3) throw new Error('UIDGroup fields58 must contain three u32 values')
  chunk.payload = concat([
    encodeNativeString(item.name ?? 'UID Group'),
    u32Bytes(item.uid ?? nextUid()),
    u32Bytes(members.length),
    ...members.map(u32Bytes),
    ...fields58.map(u32Bytes),
    u32Bytes(item.field34 ?? 0),
  ])
  return chunk
}

function timelineRecord(typeId: number, chunk: Chunk, index: number): TimelineRecord {
  const fallback = opaqueRecord(typeId, chunk, index)
  const item: TimelineRecord = { ...fallback }
  if (typeId !== 6006) return item
  try {
    const p = new PayloadCursor(chunk.payload)
    item.name = p.string()
    item.uid = p.u32()
    item.enabled = p.u8() !== 0
    const count = p.u32()
    item.eventCount = count
    item.eventTypeIds = Array.from({ length: count }, () => p.u32())
    const eventUids = chunk.children.slice(0, count).filter((child) => child.payload.length >= 4).map((child) => readU32(child.payload, 0))
    item.reservedUids = [item.uid, ...eventUids]
  } catch {
    return { ...fallback }
  }
  return item
}

function decodeManager(section: Chunk, decode: (typeId: number, chunk: Chunk, index: number) => RawRecipe): RawRecipe[] {
  const [ids, children] = manager(section)
  if (ids.length !== children.length) throw new Error('manager child count mismatch')
  return ids.map((id, index) => decode(id, children[index], index))
}

function opaqueForDoc(
  monsters: RawRecipe[],
  items: RawRecipe[],
  npcs: RawRecipe[],
  itemSets: RawRecipe[],
  uidGroups: RawRecipe[],
  timelines: TimelineRecord[],
): OpaqueChunk[] {
  const result: OpaqueChunk[] = []
  monsters.forEach((item) => { if (item.raw) result.push({ kind: 'monsterRecipe', label: item.name, raw: item.raw }) })
  items.forEach((item) => { if (item.raw) result.push({ kind: 'itemRecipe', raw: item.raw }) })
  npcs.forEach((item) => { if (item.raw) result.push({ kind: 'npcRecipe', label: item.name, raw: item.raw }) })
  itemSets.forEach((item) => { if (item.raw) result.push({ kind: 'itemSet', raw: item.raw }) })
  uidGroups.forEach((item) => { if (item.raw) result.push({ kind: 'uidGroup', label: item.name, raw: item.raw }) })
  timelines.forEach((item) => { if (item.raw) result.push({ kind: 'timeline', label: item.name, raw: item.raw }) })
  return result
}

export function parseBoneyard(bytes: Uint8Array): BoneyardDoc {
  const buffer = parseBuffer(bytes, 'Boneyard')
  const [arena, layout] = arenaAndLayout(buffer)
  const parsedHeader = parseHeader(arena.children[0].payload)
  const meta: BoneyardMeta = {
    ...parsedHeader.meta,
    raw: {
      file: toBase64(bytes),
      arenaSections: arena.children.map((section) => toBase64(encodeChunk(section))),
    },
  }

  const [objectIds, objectChildren] = manager(layout.children[0])
  const objects: BoneyardPlacedObject[] = []
  let childIndex = 0
  objectIds.forEach((typeId, index) => {
    const take = PLACEABLES.has(typeId) ? 3 : 1
    if (childIndex + take > objectChildren.length) throw new Error('world object is missing chunks')
    objects.push(decodeObject(typeId, objectChildren.slice(childIndex, childIndex + take), index))
    childIndex += take
  })
  if (childIndex !== objectChildren.length) throw new Error('unclaimed world-object chunks')

  const [roadIds, roadChildren] = manager(layout.children[5])
  const [fenceIds, fenceChildren] = manager(layout.children[6])
  const [terrainIds, terrainChildren] = manager(layout.children[12])
  if (roadIds.some((id) => id !== 3004) || roadIds.length !== roadChildren.length) throw new Error('unsupported Road manager')
  if (fenceIds.some((id) => id !== 3005) || fenceIds.length !== fenceChildren.length) throw new Error('unsupported Fence manager')
  if (terrainIds.some((id) => id !== 3009) || terrainIds.length !== terrainChildren.length) throw new Error('unsupported Terrain manager')

  const spritePayload = layout.children[11].payload
  const spriteCount = readU32(spritePayload, 0)
  if (spritePayload.length !== 4 + spriteCount * 25) throw new Error('invalid static-sprite list')
  const sprites = Array.from({ length: spriteCount }, (_, i) => decodeSprite(spritePayload, 4 + i * 25, i))

  const monsters = decodeManager(layout.children[3], (id, chunk, index) => id === 6001 ? decodeMonster(chunk, index) : opaqueRecord(id, chunk, index)) as MonsterRecipe[]
  const uidGroups = decodeManager(layout.children[4], (id, chunk, index) => id === 6002 ? decodeUidGroup(chunk, index) : opaqueRecord(id, chunk, index)) as UidGroupRecipe[]
  const items = decodeManager(layout.children[7], opaqueRecord)
  const itemSets = decodeManager(layout.children[8], opaqueRecord)
  const npcs = decodeManager(layout.children[9], opaqueRecord)
  const timelines = decodeManager(layout.children[13], timelineRecord) as TimelineRecord[]

  const geometry: BoneyardGeometry = {
    triggerControlRaw: toBase64(encodeChunk(layout.children[1])),
    regionGeometryRaw: toBase64(encodeChunk(layout.children[2])),
    layoutFlagRaw: toBase64(layout.children[10].payload),
    rawSections: layout.children.map((section) => toBase64(encodeChunk(section))),
  }
  if (layout.children[2].payload.length === 12) {
    geometry.playerSpawn = { x: readF32(layout.children[2].payload, 0), y: readF32(layout.children[2].payload, 4) }
    geometry.playerSpawnFacingDeg = readF32(layout.children[2].payload, 8)
  }
  if (layout.children[10].payload.length === 1) geometry.layoutFlag = layout.children[10].payload[0]

  return {
    format: 'solomon-dark-boneyard',
    version: 1,
    meta,
    objects,
    roads: roadChildren.map(decodeRoad),
    fences: fenceChildren.map(decodeFence),
    terrain: terrainChildren.map(decodeTerrain),
    sprites,
    recipes: { monsters, items, npcs, itemSets, uidGroups },
    timeline: { records: timelines, defaultTransplantSafe: false },
    geometry,
    opaque: opaqueForDoc(monsters, items, npcs, itemSets, uidGroups, timelines),
    hasTimeline: timelines.length > 0,
  }
}

function rawRecord(item: RawRecipe): Chunk {
  if (!item.raw) throw new Error(`type ${item.typeId} is preserve-only and requires raw`)
  return parseChunks(fromBase64(item.raw), 1)[0]
}

function timelineRawRecord(item: RawRecipe): Chunk {
  const chunk = rawRecord(item)
  if (item.typeId !== 6006) return chunk
  const original = timelineRecord(6006, chunk, item.index ?? 0)
  for (const key of ['name', 'uid', 'enabled', 'eventCount', 'eventTypeIds', 'reservedUids']) {
    if (key in item && JSON.stringify(item[key]) !== JSON.stringify(original[key])) {
      throw new Error(`TimeLine is preserve-only; ${key} does not match raw`)
    }
  }
  return chunk
}

function setRecordManager(section: Chunk, records: RawRecipe[], encode: (item: RawRecipe) => Chunk = rawRecord): void {
  setManager(section, records.map((item) => item.typeId), records.map(encode))
}

function uidGenerator(doc: BoneyardDoc): () => number {
  const values = [50_000]
  ;[doc.roads, doc.fences, doc.terrain].forEach((records) => records.forEach((item) => {
    if (item.uid !== undefined) values.push(item.uid)
  }))
  ;[doc.recipes.monsters, doc.recipes.npcs, doc.recipes.uidGroups].forEach((records) => records.forEach((item) => {
    if (item.uid !== undefined) values.push(item.uid)
  }))
  doc.timeline.records.forEach((item) => item.reservedUids?.forEach((value) => values.push(value)))
  let next = Math.max(...values) + 1
  return () => next++
}

export function serializeBoneyard(document: BoneyardDoc | EditorDoc): Uint8Array {
  const doc = document as BoneyardDoc
  if (!doc.meta.raw?.file) throw new Error('serializeBoneyard requires a parsed document or newBoneyard fixture')
  const buffer = parseBuffer(fromBase64(doc.meta.raw.file), 'meta.raw.file')
  const [arena, layout] = arenaAndLayout(buffer)
  arena.children[0].payload = encodeHeader(arena.children[0].payload, doc.meta)
  const nextUid = uidGenerator(doc)

  const objectIds: number[] = []
  const objectChildren: Chunk[] = []
  doc.objects.forEach((item) => {
    objectIds.push(item.typeId)
    objectChildren.push(...encodeObject(item))
  })
  setManager(layout.children[0], objectIds, objectChildren)
  setManager(layout.children[5], doc.roads.map(() => 3004), doc.roads.map((item) => encodeRoad(item, nextUid)))
  setManager(layout.children[6], doc.fences.map(() => 3005), doc.fences.map((item) => encodeFence(item, nextUid)))
  setManager(layout.children[12], doc.terrain.map(() => 3009), doc.terrain.map((item) => encodeTerrain(item, nextUid)))

  layout.children[11].payload = concat([u32Bytes(doc.sprites.length), ...doc.sprites.map(encodeSprite)])
  setRecordManager(
    layout.children[3],
    doc.recipes.monsters,
    (item) => item.typeId === 6001 ? encodeMonster(item as MonsterRecipe, nextUid) : rawRecord(item),
  )
  setRecordManager(
    layout.children[4],
    doc.recipes.uidGroups,
    (item) => item.typeId === 6002 ? encodeUidGroup(item as UidGroupRecipe, nextUid) : rawRecord(item),
  )
  setRecordManager(layout.children[7], doc.recipes.items)
  setRecordManager(layout.children[8], doc.recipes.itemSets)
  setRecordManager(layout.children[9], doc.recipes.npcs)
  setRecordManager(layout.children[13], doc.timeline.records, timelineRawRecord)

  if (doc.geometry.playerSpawn) {
    const data = new Uint8Array(12)
    writeF32(data, 0, doc.geometry.playerSpawn.x)
    writeF32(data, 4, doc.geometry.playerSpawn.y)
    writeF32(data, 8, doc.geometry.playerSpawnFacingDeg ?? 0)
    layout.children[2].payload = data
  }
  if (doc.geometry.layoutFlag !== undefined) layout.children[10].payload = new Uint8Array([doc.geometry.layoutFlag & 255])
  return encodeBuffer(buffer)
}

export function newBoneyard(name: string, fixture: Uint8Array): BoneyardDoc {
  const doc = parseBoneyard(fixture)
  doc.meta.name = name
  doc.objects = []
  doc.roads = []
  doc.fences = []
  doc.terrain = []
  doc.sprites = []
  doc.recipes = { monsters: [], items: [], npcs: [], itemSets: [], uidGroups: [] }
  doc.opaque = doc.opaque.filter((item) => item.kind === 'timeline')
  doc.timeline.defaultTransplantSafe = true
  doc.hasTimeline = doc.timeline.records.length > 0
  return doc
}

import { createHash } from 'node:crypto'

import type { ModSpriteFrame } from '../../core-kernels/hub-economy.ts'
import type { GameModAsset } from '../../protocol/game-protocol.ts'
import type {
  CompiledWebLuaAsset,
  CompiledWebLuaMod,
  WebLuaDefinitionValue,
  WebLuaModIdentity,
} from '../definition/index.ts'

const MAXIMUM_AUDIO_BYTES = 16 * 1024 * 1024
const MAXIMUM_FRAME_COUNT = 4_096
const MAXIMUM_IMAGE_DIMENSION = 4_096
const MAXIMUM_SCENE_NODES = 16_384
const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
const PACKAGE_PATH = /^(?:art|audio|levels|scenes|sprites)\/(?!.*(?:^|\/)\.\.?(?:\/|$)).+$/

export interface ModAssetSource {
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly identity: WebLuaModIdentity
}

export interface PreparedModSpriteAsset {
  readonly animations: Readonly<Record<string, readonly number[]>>
  readonly assetKind: 'sheet' | 'sprite'
  readonly frames: readonly ModSpriteFrame[]
  readonly height: number
  readonly id: string
  readonly key: string
  readonly kind: 'image'
  readonly modId: string
  readonly path: string
  readonly sha256: string
  readonly width: number
}

export interface PreparedModAudioAsset {
  readonly assetKind: 'music' | 'sound'
  readonly bus: string
  readonly contentType: string
  readonly id: string
  readonly key: string
  readonly kind: 'audio'
  readonly loop: boolean
  readonly modId: string
  readonly path: string
  readonly sha256: string
  readonly volume: number
}

export interface PreparedModDocumentAsset {
  readonly assetKind: 'boneyard' | 'scene'
  readonly contentType: string
  readonly id: string
  readonly key: string
  readonly kind: 'document'
  readonly modId: string
  readonly path: string
  readonly sha256: string
}

export type PreparedModAsset =
  | PreparedModAudioAsset
  | PreparedModDocumentAsset
  | PreparedModSpriteAsset

export class PreparedModAssetCatalog {
  readonly #assets: readonly PreparedModAsset[]
  readonly #byId: ReadonlyMap<string, PreparedModAsset>

  constructor(assets: readonly PreparedModAsset[]) {
    const byId = new Map<string, PreparedModAsset>()
    for (const asset of assets) {
      if (byId.has(asset.id)) throw new Error(`prepared mod asset is duplicated: ${asset.id}`)
      byId.set(asset.id, asset)
    }
    this.#assets = Object.freeze([...assets].sort((left, right) => left.id.localeCompare(right.id)))
    this.#byId = byId
  }

  all(): readonly PreparedModAsset[] {
    return this.#assets
  }

  get(modId: string, key: string): PreparedModAsset | null {
    return this.#byId.get(assetId(modId, key)) ?? null
  }

  image(modId: string, key: string): PreparedModSpriteAsset {
    const asset = this.get(modId, key)
    if (!asset || asset.kind !== 'image') throw new Error(`mod image asset is unavailable: ${modId}:${key}`)
    return asset
  }
}

export function compileModAssets(options: Readonly<{
  assets: readonly GameModAsset[]
  mods: readonly CompiledWebLuaMod[]
  sources: readonly ModAssetSource[]
}>): PreparedModAssetCatalog {
  const sources = uniqueByMod(options.sources, 'asset source')
  const metadata = uniqueMetadata(options.assets)
  const prepared: PreparedModAsset[] = []
  for (const mod of options.mods) {
    const source = sources.get(normalizedModId(mod.identity.id))
    if (!source) throw new Error(`compiled mod has no package asset source: ${mod.identity.id}`)
    for (const definition of mod.assets) {
      prepared.push(compileAsset(mod, definition, source, metadata))
    }
  }
  return new PreparedModAssetCatalog(prepared)
}

function compileAsset(
  mod: CompiledWebLuaMod,
  definition: CompiledWebLuaAsset,
  source: ModAssetSource,
  metadata: ReadonlyMap<string, GameModAsset>,
): PreparedModAsset {
  const path = assetPath(definition)
  const file = packageFile(mod.identity.id, path, source, metadata)
  const common = {
    id: assetId(mod.identity.id, definition.key),
    key: definition.key,
    modId: mod.identity.id,
    path,
    sha256: file.metadata.sha256,
  } as const
  switch (definition.assetKind) {
    case 'sprite':
    case 'sheet': {
      requireFileKind(file.metadata, 'image', 'image/png', common.id)
      const dimensions = pngDimensions(file.bytes, common.id)
      const frames = definition.assetKind === 'sheet'
        ? sheetFrames(definition.fields, dimensions, common.id)
        : spriteFrames(definition.fields, dimensions, common.id)
      return Object.freeze({
        ...common,
        assetKind: definition.assetKind,
        animations: definition.assetKind === 'sheet'
          ? sheetAnimations(definition.fields.animations, frames.length, common.id)
          : Object.freeze({}),
        frames,
        height: dimensions.height,
        kind: 'image' as const,
        width: dimensions.width,
      })
    }
    case 'music':
    case 'sound':
      requireAudio(file, common.id)
      return Object.freeze({
        ...common,
        assetKind: definition.assetKind,
        bus: optionalText(definition.fields.bus, definition.assetKind === 'music' ? 'music' : 'effects', `${common.id}.bus`),
        contentType: file.metadata.contentType,
        kind: 'audio' as const,
        loop: definition.assetKind === 'music'
          ? optionalBoolean(definition.fields.loop, true, `${common.id}.loop`)
          : false,
        volume: optionalNumber(definition.fields.volume, 1, 0, 1, `${common.id}.volume`),
      })
    case 'scene':
      requireFileKind(file.metadata, 'scene', 'application/json', common.id)
      validateJsonDocument(file.bytes, common.id)
      return Object.freeze({
        ...common,
        assetKind: definition.assetKind,
        contentType: file.metadata.contentType,
        kind: 'document' as const,
      })
    case 'boneyard':
      requireFileKind(
        file.metadata,
        'boneyard',
        'application/vnd.solomon-dark.boneyard',
        common.id,
      )
      if (file.bytes.length === 0) throw new Error(`${common.id} Boneyard asset is empty`)
      return Object.freeze({
        ...common,
        assetKind: definition.assetKind,
        contentType: file.metadata.contentType,
        kind: 'document' as const,
      })
  }
}

function uniqueByMod(
  values: readonly ModAssetSource[],
  field: string,
): ReadonlyMap<string, ModAssetSource> {
  const result = new Map<string, ModAssetSource>()
  for (const value of values) {
    const id = normalizedModId(value.identity.id)
    if (result.has(id)) throw new Error(`${field} is duplicated: ${value.identity.id}`)
    result.set(id, value)
  }
  return result
}

function uniqueMetadata(values: readonly GameModAsset[]): ReadonlyMap<string, GameModAsset> {
  const result = new Map<string, GameModAsset>()
  for (const value of values) {
    const id = metadataId(value.modId, value.path)
    if (result.has(id)) throw new Error(`mod package asset metadata is duplicated: ${value.modId}:${value.path}`)
    result.set(id, value)
  }
  return result
}

function packageFile(
  modId: string,
  path: string,
  source: ModAssetSource,
  metadata: ReadonlyMap<string, GameModAsset>,
): Readonly<{ bytes: Uint8Array; metadata: GameModAsset }> {
  const bytes = source.files[path]
  const descriptor = metadata.get(metadataId(modId, path))
  if (!bytes || !descriptor) throw new Error(`declared mod asset is absent from its package: ${modId}:${path}`)
  if (bytes.length !== descriptor.byteLength) throw new Error(`mod asset byte length changed: ${modId}:${path}`)
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== descriptor.sha256) throw new Error(`mod asset digest changed: ${modId}:${path}`)
  return Object.freeze({ bytes, metadata: descriptor })
}

function assetPath(definition: CompiledWebLuaAsset): string {
  const value = definition.fields.path
    ?? definition.fields.file
    ?? definition.fields.image
    ?? definition.fields.source
  if (typeof value !== 'string' || value.includes('\0') || !PACKAGE_PATH.test(value)) {
    throw new Error(`${definition.assetKind} asset ${definition.key} has an invalid package path`)
  }
  return value
}

function requireFileKind(
  metadata: GameModAsset,
  kind: string,
  contentType: string,
  field: string,
): void {
  if (metadata.kind !== kind || metadata.contentType !== contentType) {
    throw new Error(`${field} requires ${kind} ${contentType} package data`)
  }
}

function requireAudio(
  file: Readonly<{ bytes: Uint8Array; metadata: GameModAsset }>,
  field: string,
): void {
  if (file.metadata.kind !== 'audio' || file.bytes.length > MAXIMUM_AUDIO_BYTES) {
    throw new Error(`${field} requires bounded audio package data`)
  }
  const bytes = file.bytes
  const valid = file.metadata.contentType === 'audio/wav'
    ? ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE'
    : file.metadata.contentType === 'audio/ogg'
      ? ascii(bytes, 0, 4) === 'OggS'
      : file.metadata.contentType === 'audio/mpeg'
        ? ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)
        : false
  if (!valid) throw new Error(`${field} audio bytes do not match ${file.metadata.contentType}`)
}

function pngDimensions(
  bytes: Uint8Array,
  field: string,
): Readonly<{ height: number; width: number }> {
  if (bytes.length < 24 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error(`${field} is not a PNG image`)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8) !== 13 || ascii(bytes, 12, 16) !== 'IHDR') {
    throw new Error(`${field} PNG has no leading IHDR`)
  }
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width < 1 || height < 1 || width > MAXIMUM_IMAGE_DIMENSION || height > MAXIMUM_IMAGE_DIMENSION) {
    throw new Error(`${field} PNG dimensions must be within 1..${MAXIMUM_IMAGE_DIMENSION}`)
  }
  return Object.freeze({ height, width })
}

function spriteFrames(
  fields: Readonly<Record<string, WebLuaDefinitionValue>>,
  dimensions: Readonly<{ height: number; width: number }>,
  field: string,
): readonly ModSpriteFrame[] {
  if (fields.frames !== undefined) {
    if (!Array.isArray(fields.frames) || fields.frames.length < 1 || fields.frames.length > MAXIMUM_FRAME_COUNT) {
      throw new Error(`${field}.frames must contain 1..${MAXIMUM_FRAME_COUNT} frame rectangles`)
    }
    return Object.freeze(fields.frames.map((value, index) => frame(value, dimensions, `${field}.frames[${index}]`)))
  }
  return Object.freeze([fields.frame === undefined
    ? fullFrame(dimensions.width, dimensions.height)
    : frame(fields.frame, dimensions, `${field}.frame`)])
}

function sheetFrames(
  fields: Readonly<Record<string, WebLuaDefinitionValue>>,
  dimensions: Readonly<{ height: number; width: number }>,
  field: string,
): readonly ModSpriteFrame[] {
  const spec = object(fields.frame, `${field}.frame`)
  const width = integer(spec.width, 1, dimensions.width, `${field}.frame.width`)
  const height = integer(spec.height, 1, dimensions.height, `${field}.frame.height`)
  if (dimensions.width % width !== 0 || dimensions.height % height !== 0) {
    throw new Error(`${field} sheet dimensions must be exact multiples of its frame size`)
  }
  const columns = dimensions.width / width
  const rows = dimensions.height / height
  if (columns * rows > MAXIMUM_FRAME_COUNT) throw new Error(`${field} sheet exceeds its frame limit`)
  return Object.freeze(Array.from({ length: columns * rows }, (_, index) => fullFrame(
    width,
    height,
    index % columns * width,
    Math.floor(index / columns) * height,
  )))
}

function sheetAnimations(
  value: WebLuaDefinitionValue | undefined,
  frameCount: number,
  field: string,
): Readonly<Record<string, readonly number[]>> {
  const source = object(value, `${field}.animations`)
  const result: Record<string, readonly number[]> = {}
  for (const [name, frames] of Object.entries(source)) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(name) || !Array.isArray(frames) || frames.length === 0) {
      throw new Error(`${field}.animations.${name} is invalid`)
    }
    result[name] = Object.freeze(frames.map((candidate, index) => (
      integer(candidate, 1, frameCount, `${field}.animations.${name}[${index}]`) - 1
    )))
  }
  if (Object.keys(result).length === 0) throw new Error(`${field} sheet requires at least one animation`)
  return Object.freeze(result)
}

function frame(
  value: WebLuaDefinitionValue,
  dimensions: Readonly<{ height: number; width: number }>,
  field: string,
): ModSpriteFrame {
  const source = object(value, field)
  const x = integer(source.x ?? 0, 0, dimensions.width - 1, `${field}.x`)
  const y = integer(source.y ?? 0, 0, dimensions.height - 1, `${field}.y`)
  const width = integer(source.width, 1, dimensions.width, `${field}.width`)
  const height = integer(source.height, 1, dimensions.height, `${field}.height`)
  if (x + width > dimensions.width || y + height > dimensions.height) {
    throw new Error(`${field} extends beyond its image`)
  }
  const logicalWidth = integer(source.logical_width ?? width, width, MAXIMUM_IMAGE_DIMENSION, `${field}.logical_width`)
  const logicalHeight = integer(source.logical_height ?? height, height, MAXIMUM_IMAGE_DIMENSION, `${field}.logical_height`)
  return Object.freeze({
    centerOffsetX: optionalNumber(source.center_x, 0, -MAXIMUM_IMAGE_DIMENSION, MAXIMUM_IMAGE_DIMENSION, `${field}.center_x`),
    centerOffsetY: optionalNumber(source.center_y, 0, -MAXIMUM_IMAGE_DIMENSION, MAXIMUM_IMAGE_DIMENSION, `${field}.center_y`),
    contentHeight: optionalNumber(source.content_height, height, 0, logicalHeight, `${field}.content_height`),
    contentWidth: optionalNumber(source.content_width, width, 0, logicalWidth, `${field}.content_width`),
    height,
    logicalHeight,
    logicalWidth,
    width,
    x,
    y,
  })
}

function fullFrame(width: number, height: number, x = 0, y = 0): ModSpriteFrame {
  return Object.freeze({
    centerOffsetX: 0,
    centerOffsetY: 0,
    contentHeight: height,
    contentWidth: width,
    height,
    logicalHeight: height,
    logicalWidth: width,
    width,
    x,
    y,
  })
}

function validateJsonDocument(bytes: Uint8Array, field: string): void {
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new Error(`${field} is not valid UTF-8 JSON`)
  }
  let nodes = 0
  const visit = (candidate: unknown, depth: number): void => {
    nodes += 1
    if (nodes > MAXIMUM_SCENE_NODES || depth > 32) throw new Error(`${field} scene document exceeds its graph budget`)
    if (Array.isArray(candidate)) candidate.forEach(entry => visit(entry, depth + 1))
    else if (candidate && typeof candidate === 'object') Object.values(candidate).forEach(entry => visit(entry, depth + 1))
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} scene document must be an object`)
  visit(value, 0)
}

function object(value: unknown, field: string): Record<string, WebLuaDefinitionValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`)
  return value as Record<string, WebLuaDefinitionValue>
}

function integer(value: unknown, minimum: number, maximum: number, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} must be an integer within ${minimum}..${maximum}`)
  }
  return Number(value)
}

function optionalText(value: unknown, fallback: string, field: string): string {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) throw new Error(`${field} is invalid`)
  return value
}

function optionalBoolean(value: unknown, fallback: boolean, field: string): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`${field} must be boolean`)
  return value
}

function optionalNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be finite within ${minimum}..${maximum}`)
  }
  return value
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}

function normalizedModId(modId: string): string {
  return modId.toLowerCase()
}

function metadataId(modId: string, path: string): string {
  return `${normalizedModId(modId)}\0${path.toLowerCase()}`
}

function assetId(modId: string, key: string): string {
  return `${modId}:${key}`
}

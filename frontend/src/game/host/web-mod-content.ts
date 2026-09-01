import { createHash } from 'node:crypto'

import type { GameContentManifest, GameModAsset } from '../protocol/game-protocol.ts'
import {
  compileWebLuaDefinition,
  WebLuaDefinitionRuntime,
  type CompiledWebLuaMod,
  type WebLuaModIdentity,
} from '../modding/definition/index.ts'
import {
  projectModBoneyard,
  type ModBoneyardEntry,
} from './boneyard-catalog.ts'
import { boneyardGeometrySha256 } from './project-boneyard.ts'

const SHA256 = /^[a-f0-9]{64}$/
const PACKAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const BONEYARD_TARGET = /^(?:data\/levels|sandbox\/DarkCloud\/mylevels)\/.+\.boneyard$/
const MAX_ACTIVE_MODS = 128
const MAX_ACTIVE_LUA_MODS = 8
const MAX_ENTRY_SCRIPT_BYTES = 256 * 1024
const MAX_BONEYARD_BYTES = 8 * 1024 * 1024
const MAX_PACKAGE_FILE_BYTES = 16 * 1024 * 1024
const MAX_PACKAGE_FILES = 256
const MAX_PROVISIONED_CONTENT_BYTES = 32 * 1024 * 1024
const PACKAGE_FILE = /^(?:sprites|art|audio|levels|scenes)\/.+\.(?:boneyard|bundle|json|mp3|ogg|png|wav)$/

export interface WebModBoneyardPayload {
  readonly bytesBase64: string
  readonly target: string
}

export interface WebSessionModPayload {
  readonly boneyards: readonly WebModBoneyardPayload[]
  readonly contentSha256: string
  readonly entryScript: string | null
  readonly files: readonly WebModPackageFilePayload[]
  readonly id: string
  readonly name: string
  readonly priority: number
  readonly slug: string
  readonly version: string
}

export interface WebModPackageFilePayload {
  readonly byteLength: number
  readonly bytesBase64: string
  readonly contentType: string
  readonly kind: string
  readonly path: string
  readonly sha256: string
}

interface ParsedWebModPackageFile extends WebModPackageFilePayload {
  readonly bytes: Buffer
}

interface ParsedWebSessionMod extends Omit<WebSessionModPayload, 'files'> {
  readonly files: readonly ParsedWebModPackageFile[]
}

export interface MaterializedWebSessionContent {
  readonly assets: readonly GameModAsset[]
  readonly boneyards: readonly ModBoneyardEntry[]
  readonly compiledMods: readonly CompiledWebLuaMod[]
  readonly manifest: GameContentManifest
  readonly modSources: readonly WebLuaModSource[]
  readonly summary: WebSessionContentSummary
}

export interface WebLuaModSource {
  readonly entryScript: string
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly identity: WebLuaModIdentity
}

export interface WebSessionContentSummary {
  readonly manifestSha256: string
  readonly mods: readonly {
    readonly assets: readonly GameModAsset[]
    readonly contentSha256: string
    readonly graphSha256: string | null
    readonly id: string
    readonly name: string
    readonly slug: string
    readonly version: string
  }[]
}

export function materializeWebSessionContent(value: unknown): MaterializedWebSessionContent {
  const source = object(value, 'session content')
  exactKeys(source, ['manifestSha256', 'mods'], 'session content')
  const manifestSha256 = sha256(source.manifestSha256, 'session manifest')
  if (!Array.isArray(source.mods) || source.mods.length > MAX_ACTIVE_MODS) {
    throw new Error(`session content mods must be an array of at most ${MAX_ACTIVE_MODS} entries`)
  }

  const mods = source.mods.map((value, index) => parseMod(value, index))
  const ids = new Set<string>()
  const finalBoneyards = new Map<string, ModBoneyardEntry>()
  const assets: GameModAsset[] = []
  const assetsByMod = new Map<string, GameModAsset[]>()
  const modSources: WebLuaModSource[] = []
  let aggregateBytes = 0
  for (const mod of mods) {
    const normalizedId = mod.id.toLowerCase()
    if (ids.has(normalizedId)) throw new Error(`duplicate session mod id: ${mod.id}`)
    ids.add(normalizedId)
    if (mod.entryScript !== null) {
      aggregateBytes += Buffer.byteLength(mod.entryScript, 'utf8')
      modSources.push({
        entryScript: mod.entryScript,
        files: Object.fromEntries(mod.files.map(file => [file.path, file.bytes])),
        identity: { id: mod.id, name: mod.name, version: mod.version },
      })
    }
    for (const file of mod.files) {
      aggregateBytes += file.bytes.length
      const asset = {
        byteLength: file.byteLength,
        contentType: file.contentType,
        kind: file.kind,
        modId: mod.id,
        path: file.path,
        sha256: file.sha256,
      }
      assets.push(asset)
      const modAssets = assetsByMod.get(mod.id) ?? []
      modAssets.push(asset)
      assetsByMod.set(mod.id, modAssets)
    }
    for (const boneyard of mod.boneyards) {
      const bytes = decodeBase64(boneyard.bytesBase64, `${mod.id} ${boneyard.target}`)
      aggregateBytes += bytes.length
      finalBoneyards.set(
        boneyard.target.toLowerCase(),
        projectModBoneyard(mod.id, mod.name, boneyard.target, bytes),
      )
    }
  }
  if (aggregateBytes > MAX_PROVISIONED_CONTENT_BYTES) {
    throw new Error('session content exceeds its aggregate byte limit')
  }
  if (modSources.length > MAX_ACTIVE_LUA_MODS) {
    throw new Error(`session content has more than ${MAX_ACTIVE_LUA_MODS} Lua mods`)
  }
  const manifest: GameContentManifest = {
    manifestSha256,
    mods: mods.map(mod => ({
      contentSha256: mod.contentSha256,
      id: mod.id,
      version: mod.version,
    })),
  }
  return {
    assets,
    boneyards: [...finalBoneyards.values()],
    compiledMods: [],
    manifest,
    modSources,
    summary: {
      manifestSha256,
      mods: mods.map(mod => ({
        assets: assetsByMod.get(mod.id) ?? [],
        contentSha256: mod.contentSha256,
        graphSha256: null,
        id: mod.id,
        name: mod.name,
        slug: mod.slug,
        version: mod.version,
      })),
    },
  }
}

export async function compileWebSessionContentDefinitions(
  content: MaterializedWebSessionContent,
  wasmPath: string,
): Promise<MaterializedWebSessionContent> {
  if (content.modSources.length === 0) return content
  const compiledMods: CompiledWebLuaMod[] = []
  for (const source of content.modSources) {
    const runtime = await WebLuaDefinitionRuntime.create({
      entryScript: 'scripts/main.lua',
      identity: source.identity,
      wasmPath,
    })
    try {
      const definition = runtime.run(source.entryScript)
      compiledMods.push(compileWebLuaDefinition(source.identity, definition, {
        dependencies: compiledMods.map(mod => ({
          content: mod.content,
          id: mod.identity.id,
        })),
      }))
    } finally {
      runtime.close()
    }
  }
  const graphByMod = new Map(compiledMods.map(mod => [mod.identity.id, mod.graphSha256]))
  const sourceByMod = new Map(content.modSources.map(source => [source.identity.id, source]))
  const luaBoneyards = compiledMods.flatMap(mod => mod.content.flatMap((definition) => {
    if (definition.contentKind !== 'boneyard') return []
    const path = definition.fields.source
    const source = sourceByMod.get(mod.identity.id)
    const bytes = typeof path === 'string' ? source?.files[path] : undefined
    if (!bytes || typeof path !== 'string') {
      throw new Error(`${mod.identity.id}:${definition.key} Boneyard source is not packaged`)
    }
    const projected = projectModBoneyard(
      mod.identity.id,
      mod.identity.name,
      path,
      bytes,
    )
    const environment = definition.fields.environment
    const mode = environment && typeof environment === 'object' && !Array.isArray(environment)
      ? (environment as Record<string, unknown>).mode
      : undefined
    const scene = Number.isSafeInteger(mode)
      ? { ...projected.scene, environmentMode: Number(mode) }
      : projected.scene
    return [Object.freeze({
      ...projected,
      choice: Object.freeze({
        ...projected.choice,
        name: typeof definition.fields.name === 'string'
          ? definition.fields.name
          : projected.choice.name,
      }),
      geometrySha256: scene === projected.scene
        ? projected.geometrySha256
        : boneyardGeometrySha256(scene),
      scene: Object.freeze(scene),
      webLuaContentId: definition.contentId,
    })]
  }))
  return Object.freeze({
    ...content,
    boneyards: Object.freeze([...content.boneyards, ...luaBoneyards]),
    compiledMods: Object.freeze(compiledMods),
    summary: Object.freeze({
      ...content.summary,
      mods: Object.freeze(content.summary.mods.map(mod => Object.freeze({
        ...mod,
        graphSha256: graphByMod.get(mod.id) ?? null,
      }))),
    }),
  })
}

function parseMod(value: unknown, index: number): ParsedWebSessionMod {
  const field = `session content mods[${index}]`
  const source = object(value, field)
  exactKeys(source, [
    'boneyards',
    'contentSha256',
    'entryScript',
    'files',
    'id',
    'name',
    'priority',
    'slug',
    'version',
  ], field)
  const id = text(source.id, `${field}.id`, 128)
  if (!PACKAGE_ID.test(id)) throw new Error(`${field}.id is invalid`)
  const name = text(source.name, `${field}.name`, 80)
  const slug = text(source.slug, `${field}.slug`, 80)
  const version = text(source.version, `${field}.version`, 64)
  const contentSha256 = sha256(source.contentSha256, `${field}.contentSha256`)
  if (!Number.isInteger(source.priority) || Number(source.priority) < -100_000 || Number(source.priority) > 100_000) {
    throw new Error(`${field}.priority is invalid`)
  }
  const entryScript = source.entryScript === null
    ? null
    : text(source.entryScript, `${field}.entryScript`, MAX_ENTRY_SCRIPT_BYTES)
  if (entryScript !== null && Buffer.byteLength(entryScript, 'utf8') > MAX_ENTRY_SCRIPT_BYTES) {
    throw new Error(`${field}.entryScript exceeds its byte limit`)
  }
  if (!Array.isArray(source.files) || source.files.length > MAX_PACKAGE_FILES) {
    throw new Error(`${field}.files is invalid`)
  }
  const portablePaths = new Set<string>()
  const files = source.files.map((value, fileIndex) => {
    const fileField = `${field}.files[${fileIndex}]`
    const file = object(value, fileField)
    exactKeys(file, ['byteLength', 'bytesBase64', 'contentType', 'kind', 'path', 'sha256'], fileField)
    const path = text(file.path, `${fileField}.path`, 240)
    if (!PACKAGE_FILE.test(path) || portablePaths.has(path.toLowerCase())) {
      throw new Error(`${fileField}.path is invalid or duplicated`)
    }
    portablePaths.add(path.toLowerCase())
    const kind = text(file.kind, `${fileField}.kind`, 64)
    const contentType = text(file.contentType, `${fileField}.contentType`, 128)
    const expected = expectedPackageFile(path)
    if (!expected || expected.kind !== kind || expected.contentType !== contentType) {
      throw new Error(`${fileField} kind or contentType does not match its typed package path`)
    }
    const bytesBase64 = text(
      file.bytesBase64,
      `${fileField}.bytesBase64`,
      Math.ceil(MAX_PACKAGE_FILE_BYTES / 3) * 4,
    )
    const bytes = decodeBase64(bytesBase64, `${field} ${path}`, MAX_PACKAGE_FILE_BYTES)
    if (!Number.isInteger(file.byteLength) || Number(file.byteLength) !== bytes.length) {
      throw new Error(`${fileField}.byteLength does not match its package bytes`)
    }
    const fileSha256 = sha256(file.sha256, `${fileField}.sha256`)
    if (createHash('sha256').update(bytes).digest('hex') !== fileSha256) {
      throw new Error(`${fileField}.sha256 does not match its package bytes`)
    }
    return {
      byteLength: bytes.length,
      bytes,
      bytesBase64,
      contentType,
      kind,
      path,
      sha256: fileSha256,
    }
  })
  if (!Array.isArray(source.boneyards) || source.boneyards.length > 256) {
    throw new Error(`${field}.boneyards is invalid`)
  }
  const boneyards = source.boneyards.map((value, boneyardIndex) => {
    const boneyardField = `${field}.boneyards[${boneyardIndex}]`
    const boneyard = object(value, boneyardField)
    exactKeys(boneyard, ['bytesBase64', 'target'], boneyardField)
    const target = text(boneyard.target, `${boneyardField}.target`, 240)
    if (!BONEYARD_TARGET.test(target)) throw new Error(`${boneyardField}.target is invalid`)
    const bytesBase64 = text(
      boneyard.bytesBase64,
      `${boneyardField}.bytesBase64`,
      Math.ceil(MAX_BONEYARD_BYTES / 3) * 4,
    )
    return { bytesBase64, target }
  })
  return {
    boneyards,
    contentSha256,
    entryScript,
    files,
    id,
    name,
    priority: Number(source.priority),
    slug,
    version,
  }
}

function expectedPackageFile(path: string): Readonly<{ contentType: string; kind: string }> | null {
  const extension = path.slice(path.lastIndexOf('.'))
  if (path.startsWith('sprites/') || path.startsWith('art/')) {
    if (extension === '.png') return { contentType: 'image/png', kind: 'image' }
    if (extension === '.bundle') {
      return { contentType: 'application/vnd.solomon-dark.sprite-bundle', kind: 'sprite-bundle' }
    }
    if (extension === '.json') return { contentType: 'application/json', kind: 'art-metadata' }
  }
  if (path.startsWith('audio/')) {
    if (extension === '.ogg') return { contentType: 'audio/ogg', kind: 'audio' }
    if (extension === '.wav') return { contentType: 'audio/wav', kind: 'audio' }
    if (extension === '.mp3') return { contentType: 'audio/mpeg', kind: 'audio' }
  }
  if (path.startsWith('levels/')) {
    if (extension === '.boneyard') {
      return { contentType: 'application/vnd.solomon-dark.boneyard', kind: 'boneyard' }
    }
    if (extension === '.json') return { contentType: 'application/json', kind: 'level-metadata' }
  }
  if (path.startsWith('scenes/') && extension === '.json') {
    return { contentType: 'application/json', kind: 'scene' }
  }
  return null
}

function decodeBase64(value: string, field: string, maximum = MAX_BONEYARD_BYTES): Buffer {
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length === 0 || bytes.length > maximum || bytes.toString('base64') !== value) {
    throw new Error(`${field} has invalid package bytes`)
  }
  return bytes
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(source: Record<string, unknown>, expected: readonly string[], field: string): void {
  const expectedSet = new Set(expected)
  if (Object.keys(source).some(key => !expectedSet.has(key)) || expected.some(key => !(key in source))) {
    throw new Error(`${field} has invalid fields`)
  }
}

function text(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new Error(`${field} must be a nonempty string of at most ${maximum} characters`)
  }
  return value
}

function sha256(value: unknown, field: string): string {
  const normalized = text(value, field, 64).toLowerCase()
  if (!SHA256.test(normalized)) throw new Error(`${field} must be a SHA-256 digest`)
  return normalized
}

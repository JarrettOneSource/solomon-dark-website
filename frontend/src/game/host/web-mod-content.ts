import type { GameContentManifest } from '../protocol/game-protocol.ts'
import {
  projectModBoneyard,
  type ModBoneyardEntry,
} from './boneyard-catalog.ts'
import type { WebLuaModSource } from './lua/web-lua-contract.ts'

const SHA256 = /^[a-f0-9]{64}$/
const PACKAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const BONEYARD_TARGET = /^(?:data\/levels|sandbox\/DarkCloud\/mylevels)\/.+\.boneyard$/
const MAX_ACTIVE_MODS = 128
const MAX_ACTIVE_LUA_MODS = 8
const MAX_ENTRY_SCRIPT_BYTES = 256 * 1024
const MAX_BONEYARD_BYTES = 8 * 1024 * 1024
const MAX_PROVISIONED_CONTENT_BYTES = 32 * 1024 * 1024

export interface WebModBoneyardPayload {
  readonly bytesBase64: string
  readonly target: string
}

export interface WebSessionModPayload {
  readonly boneyards: readonly WebModBoneyardPayload[]
  readonly contentSha256: string
  readonly entryScript: string | null
  readonly id: string
  readonly name: string
  readonly priority: number
  readonly slug: string
  readonly version: string
}

export interface WebSessionContentPayload {
  readonly manifestSha256: string
  readonly mods: readonly WebSessionModPayload[]
}

export interface MaterializedWebSessionContent {
  readonly boneyards: readonly ModBoneyardEntry[]
  readonly manifest: GameContentManifest
  readonly modSources: readonly WebLuaModSource[]
  readonly summary: WebSessionContentPayload
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
        identity: { id: mod.id, name: mod.name, version: mod.version },
      })
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
    boneyards: [...finalBoneyards.values()],
    manifest,
    modSources,
    summary: { manifestSha256, mods },
  }
}

function parseMod(value: unknown, index: number): WebSessionModPayload {
  const field = `session content mods[${index}]`
  const source = object(value, field)
  exactKeys(source, [
    'boneyards',
    'contentSha256',
    'entryScript',
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
    id,
    name,
    priority: Number(source.priority),
    slug,
    version,
  }
}

function decodeBase64(value: string, field: string): Buffer {
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length === 0 || bytes.length > MAX_BONEYARD_BYTES || bytes.toString('base64') !== value) {
    throw new Error(`${field} has invalid Boneyard bytes`)
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

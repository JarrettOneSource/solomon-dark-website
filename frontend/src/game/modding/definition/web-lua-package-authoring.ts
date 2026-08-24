import { readFile, readdir, realpath } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'

import {
  compileWebLuaDefinition,
  type CompileWebLuaDefinitionOptions,
} from './web-lua-definition-compiler.ts'
import { WEB_LUA_DEFINITION_API_VERSION } from './web-lua-definition-types.ts'
import { WebLuaDefinitionRuntime } from './web-lua-definition-runtime.ts'

const PACKAGE_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/
const ENTRY_SCRIPT = /^scripts\/.+\.lua$/
const MAX_ENTRY_SCRIPT_BYTES = 256 * 1024
const MAX_PACKAGE_FILE_BYTES = 16 * 1024 * 1024
const MAX_PACKAGE_FILES = 256
const ASSET_PATH = /^(?:sprites|art|audio|levels|scenes)\/.+\.(?:boneyard|bundle|json|mp3|ogg|png|wav)$/

export interface WebLuaAuthorManifest {
  readonly $schema?: string
  readonly id: string
  readonly name: string
  readonly overlays?: readonly unknown[]
  readonly priority?: number
  readonly requiredMods?: readonly string[]
  readonly runtime: Readonly<{
    apiVersion: typeof WEB_LUA_DEFINITION_API_VERSION
    entryScript: string
  }>
  readonly version: string
}

export interface CheckedWebLuaPackage {
  readonly compiled: ReturnType<typeof compileWebLuaDefinition>
  readonly entryScript: string
  readonly entryScriptPath: string
  readonly files: ReadonlyMap<string, Uint8Array>
  readonly manifest: WebLuaAuthorManifest
  readonly root: string
}

export async function checkWebLuaPackage(
  packageRoot: string,
  wasmPath: string,
  compileOptions: CompileWebLuaDefinitionOptions = {},
): Promise<CheckedWebLuaPackage> {
  const root = await realpath(packageRoot)
  const manifest = manifestValue(JSON.parse(await readFile(
    resolveInside(root, 'manifest.json'),
    'utf8',
  )) as unknown)
  const entryPath = resolveInside(root, manifest.runtime.entryScript)
  const entryScript = await readFile(entryPath, 'utf8')
  if (Buffer.byteLength(entryScript, 'utf8') > MAX_ENTRY_SCRIPT_BYTES) {
    throw new Error(`entry script exceeds ${MAX_ENTRY_SCRIPT_BYTES} bytes`)
  }
  const files = await packageFiles(root)
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: manifest.runtime.entryScript,
    identity: { id: manifest.id, name: manifest.name, version: manifest.version },
    wasmPath,
  })
  try {
    const definition = runtime.run(entryScript)
    const compiled = compileWebLuaDefinition(
      { id: manifest.id, name: manifest.name, version: manifest.version },
      definition,
      compileOptions,
    )
    validateAssetFiles(compiled.assets, files)
    return Object.freeze({
      compiled,
      entryScript,
      entryScriptPath: manifest.runtime.entryScript,
      files,
      manifest,
      root,
    })
  } finally {
    runtime.close()
  }
}

function manifestValue(value: unknown): WebLuaAuthorManifest {
  const source = object(value, 'manifest')
  exactKeys(source, [
    '$schema',
    'id',
    'name',
    'overlays',
    'priority',
    'requiredMods',
    'runtime',
    'version',
  ], 'manifest')
  if (typeof source.id !== 'string' || !PACKAGE_ID.test(source.id)) {
    throw new Error('manifest.id must be a canonical lowercase package id')
  }
  if (typeof source.name !== 'string' || source.name.length === 0 || source.name.length > 80) {
    throw new Error('manifest.name must contain 1..80 characters')
  }
  if (typeof source.version !== 'string' || !VERSION.test(source.version)) {
    throw new Error('manifest.version is invalid')
  }
  if (source.priority !== undefined && (
    !Number.isSafeInteger(source.priority) || Number(source.priority) < -100_000 ||
    Number(source.priority) > 100_000
  )) throw new Error('manifest.priority is invalid')
  if (source.overlays !== undefined && !Array.isArray(source.overlays)) {
    throw new Error('manifest.overlays must be an array')
  }
  if (source.requiredMods !== undefined && (
    !Array.isArray(source.requiredMods) || source.requiredMods.some(id => (
      typeof id !== 'string' || !PACKAGE_ID.test(id)
    )) || new Set(source.requiredMods).size !== source.requiredMods.length
  )) throw new Error('manifest.requiredMods is invalid')
  const runtime = object(source.runtime, 'manifest.runtime')
  exactKeys(runtime, ['apiVersion', 'entryScript'], 'manifest.runtime')
  if (runtime.apiVersion !== WEB_LUA_DEFINITION_API_VERSION) {
    throw new Error(`manifest.runtime.apiVersion must be ${WEB_LUA_DEFINITION_API_VERSION}`)
  }
  if (typeof runtime.entryScript !== 'string' || !ENTRY_SCRIPT.test(runtime.entryScript)) {
    throw new Error('manifest.runtime.entryScript must name a Lua file under scripts/')
  }
  return Object.freeze({
    ...(typeof source.$schema === 'string' ? { $schema: source.$schema } : {}),
    id: source.id,
    name: source.name,
    ...(Array.isArray(source.overlays) ? { overlays: source.overlays } : {}),
    ...(source.priority === undefined ? {} : { priority: Number(source.priority) }),
    ...(Array.isArray(source.requiredMods)
      ? { requiredMods: source.requiredMods as string[] }
      : {}),
    runtime: Object.freeze({
      apiVersion: WEB_LUA_DEFINITION_API_VERSION,
      entryScript: runtime.entryScript,
    }),
    version: source.version,
  })
}

async function packageFiles(root: string): Promise<ReadonlyMap<string, Uint8Array>> {
  const paths = await walk(root)
  const assets = paths.filter(path => ASSET_PATH.test(path))
  if (assets.length > MAX_PACKAGE_FILES) {
    throw new Error(`package has more than ${MAX_PACKAGE_FILES} typed asset files`)
  }
  const result = new Map<string, Uint8Array>()
  for (const path of assets) {
    const bytes = await readFile(resolveInside(root, path))
    if (bytes.length === 0 || bytes.length > MAX_PACKAGE_FILE_BYTES) {
      throw new Error(`package asset has invalid size: ${path}`)
    }
    result.set(path, bytes)
  }
  return result
}

async function walk(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...await walk(root, path))
    else if (entry.isFile()) result.push(relative(root, path).split(sep).join('/'))
  }
  return result.sort()
}

function validateAssetFiles(
  assets: CheckedWebLuaPackage['compiled']['assets'],
  files: ReadonlyMap<string, Uint8Array>,
): void {
  for (const asset of assets) {
    const candidates = ['file', 'image', 'path', 'source'].flatMap((field) => {
      const value = asset.fields[field]
      return typeof value === 'string' ? [value] : []
    })
    if (candidates.length === 0) throw new Error(`asset ${asset.key} has no owned package path`)
    for (const path of candidates) {
      if (!files.has(path)) throw new Error(`asset ${asset.key} references missing package file: ${path}`)
    }
  }
}

function resolveInside(root: string, path: string): string {
  if (path.length === 0 || path.includes('\\') || path.startsWith('/') || path.split('/').includes('..')) {
    throw new Error(`package path is invalid: ${path}`)
  }
  const resolved = resolve(root, path)
  const relativePath = relative(root, resolved)
  if (relativePath.startsWith('..') || relativePath === '') {
    if (path === 'manifest.json') return resolved
    throw new Error(`package path escapes its root: ${path}`)
  }
  return resolved
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(source: Record<string, unknown>, accepted: readonly string[], field: string): void {
  const values = new Set(accepted)
  const unknown = Object.keys(source).filter(key => !values.has(key))
  if (unknown.length > 0) throw new Error(`${field} contains unknown fields: ${unknown.join(', ')}`)
}

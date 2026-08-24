import { LuaFactory, type LuaEngine } from 'wasmoon'

import {
  WEB_LUA_CALLBACK_TIMEOUT_MS,
  WEB_LUA_EXECUTION_TIMEOUT_MS,
  WEB_LUA_VM_MEMORY_BYTES,
} from '../../host/lua/web-lua-contract.ts'
import {
  WEB_LUA_ASSET_KINDS,
  WEB_LUA_CONTENT_KINDS,
  WEB_LUA_DEFINITION_API_VERSION,
  WEB_LUA_SCOPE_KINDS,
  type WebLuaAssetDefinition,
  type WebLuaAssetKind,
  type WebLuaContentDefinition,
  type WebLuaContentKind,
  type WebLuaContentReference,
  type WebLuaDefinitionSource,
  type WebLuaDefinitionValue,
  type WebLuaIntentDefinition,
  type WebLuaModDefinition,
  type WebLuaModIdentity,
  type WebLuaReducerRegistration,
  type WebLuaRuleDefinition,
  type WebLuaSchemaDefinition,
  type WebLuaScopeKind,
} from './web-lua-definition-types.ts'
import {
  WebLuaDefinitionError,
  webLuaDefinitionIssue,
} from './web-lua-definition-error.ts'

const contentKinds = new Set<string>(WEB_LUA_CONTENT_KINDS)
const scopeKinds = new Set<string>(WEB_LUA_SCOPE_KINDS)

export interface WebLuaDefinitionRuntimeOptions {
  readonly entryScript: string
  readonly identity: WebLuaModIdentity
  readonly log?: (message: string) => void
  readonly wasmPath: string
}

export class WebLuaDefinitionRuntime {
  readonly #engine: LuaEngine
  readonly #entryScript: string
  readonly #identity: WebLuaModIdentity
  readonly #log: (message: string) => void
  readonly #reducers = new Map<string, WebLuaReducerRegistration>()
  #closed = false
  #definition: WebLuaModDefinition | null = null
  #modCalled = false

  static async create(
    options: WebLuaDefinitionRuntimeOptions,
  ): Promise<WebLuaDefinitionRuntime> {
    const factory = new LuaFactory(options.wasmPath)
    const engine = await factory.createEngine({
      enableProxy: false,
      functionTimeout: WEB_LUA_CALLBACK_TIMEOUT_MS,
      injectObjects: false,
      traceAllocations: true,
    })
    const runtime = new WebLuaDefinitionRuntime(engine, options)
    try {
      engine.global.setMemoryMax(WEB_LUA_VM_MEMORY_BYTES)
      runtime.#install()
      await engine.doString(DEFINITION_SANDBOX_BOOTSTRAP)
      return runtime
    } catch (error) {
      runtime.close()
      throw error
    }
  }

  private constructor(engine: LuaEngine, options: WebLuaDefinitionRuntimeOptions) {
    this.#engine = engine
    this.#entryScript = options.entryScript
    this.#identity = Object.freeze({ ...options.identity })
    this.#log = options.log ?? (() => {})
  }

  run(code: string): WebLuaModDefinition {
    this.#requireOpen()
    if (this.#definition || this.#modCalled) {
      throw new Error('Web Lua definition entrypoint already ran')
    }
    const thread = this.#engine.global.newThread()
    const threadIndex = this.#engine.global.getTop()
    try {
      thread.loadString(code, `@${this.#entryScript}`)
      thread.setTimeout(Date.now() + WEB_LUA_EXECUTION_TIMEOUT_MS)
      const _values = [...thread.runSync()]
    } catch (error) {
      this.#definition = null
      this.#reducers.clear()
      throw error
    } finally {
      thread.close()
      this.#engine.global.remove(threadIndex)
    }
    if (!this.#definition) {
      throw new WebLuaDefinitionError([webLuaDefinitionIssue(
        'E_GRAPH',
        'definition',
        'entrypoint must call and return sd.mod({...}) exactly once',
        { source: this.#source() },
      )])
    }
    return this.#definition
  }

  reducer(key: string): WebLuaReducerRegistration | null {
    return this.#reducers.get(key) ?? null
  }

  get memoryBytes(): number {
    return this.#closed ? 0 : this.#engine.global.getMemoryUsed()
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#definition = null
    this.#reducers.clear()
    this.#engine.global.close()
  }

  #install(): void {
    const art = Object.fromEntries(WEB_LUA_ASSET_KINDS.map(assetKind => [
      luaMember(assetKind),
      (value: unknown, options?: unknown) => this.#asset(assetKind, value, options),
    ]))
    Object.assign(art, {
      ref: (key: unknown) => Object.freeze({
        key: text(key, 'asset reference key'),
        kind: 'asset-reference' as const,
      }),
    })
    const kit = Object.fromEntries(WEB_LUA_CONTENT_KINDS.map(contentKind => [
      luaMember(contentKind),
      (value: unknown) => this.#content(contentKind, value),
    ]))
    const prefab = {
      area: (value: unknown) => this.#rule('prefab.area', value),
      channel: (value: unknown) => this.#rule('prefab.channel', value),
      enemy: (base: unknown, overrides?: unknown) => typeof base === 'string'
        ? this.#rule('prefab.enemy', { ...optionalRecord(overrides, 'enemy prefab overrides'), base })
        : this.#rule('prefab.enemy', base),
      minimap: (value: unknown) => this.#rule('prefab.minimap', value),
      portal: (value: unknown) => this.#rule('prefab.portal', value),
      projectile: (value: unknown) => this.#rule('prefab.projectile', value),
    }
    const rules = {
      after: (duration: unknown, node?: unknown) => node === undefined
        ? this.#rule('rules.after', duration)
        : this.#rule('rules.after', { duration, node }),
      all: (nodes: unknown) => this.#rule('rules.all', { nodes: array(nodes, 'rules.all nodes') }),
      every: (interval: unknown, node?: unknown, options?: unknown) => node === undefined
        ? this.#rule('rules.every', interval)
        : this.#rule('rules.every', {
            ...optionalRecord(options, 'rules.every options'),
            interval,
            node,
          }),
      first: (nodes: unknown) => this.#rule('rules.first', { nodes: array(nodes, 'rules.first nodes') }),
      on: (event: unknown, node?: unknown, options?: unknown) => node === undefined
        ? this.#rule('rules.on', event)
        : this.#rule('rules.on', {
            ...optionalRecord(options, 'rules.on options'),
            event,
            node,
          }),
      when: (predicate: unknown, yes?: unknown, no?: unknown) => yes === undefined
        ? this.#rule('rules.when', predicate)
        : this.#rule('rules.when', {
            ...(no === undefined || no === null ? {} : { no }),
            predicate,
            yes,
          }),
    }
    const effect = constructorTable('effect', [
      'damage',
      'emit',
      'grant',
      'present',
      'resource',
      'spawn',
      'state',
      'status',
      'transition',
    ], (operation, fields) => this.#rule(operation, fields))
    const schema = {
      array: (value: unknown) => this.#schema('array', value),
      boolean: (value: unknown = {}) => this.#schema('boolean', value),
      enum: (values: unknown) => this.#schema('enum', { values: array(values, 'enum values') }),
      integer: (value: unknown = {}) => this.#schema('integer', value),
      number: (value: unknown = {}) => this.#schema('number', value),
      object: (value: unknown) => this.#schema('object', value),
      string: (value: unknown = {}) => this.#schema('string', value),
    }
    const intent = constructorTable('intent', [
      'damage',
      'emit',
      'grant',
      'present',
      'resource',
      'spawn',
      'state',
      'status',
      'transition',
    ], (intentKind, fields) => this.#intent(intentKind, fields))
    this.#engine.global.set('print', (...values: unknown[]) => {
      this.#log(values.map(value => typeof value === 'string' ? value : String(value)).join('\t'))
    })
    this.#engine.global.set('sd', {
      advanced: {
        reducer: (value: unknown) => this.#reducer(value),
      },
      art,
      effect,
      intent,
      kit,
      mod: (value: unknown) => this.#mod(value),
      prefab,
      ref: (kind: unknown, key: unknown, modId?: unknown) => this.#reference(kind, key, modId),
      rules,
      schema,
    })
  }

  #asset(
    assetKind: WebLuaAssetKind,
    value: unknown,
    options?: unknown,
  ): WebLuaAssetDefinition {
    const fields = typeof value === 'string'
      ? { ...optionalRecord(options, `${assetKind} asset options`), path: value }
      : record(value, `${assetKind} asset`)
    return Object.freeze({
      assetKind,
      fields: cloneDefinitionRecord(fields, `${assetKind} asset`),
      key: '',
      kind: 'asset-definition',
      source: this.#source(),
    })
  }

  #content(
    contentKind: WebLuaContentKind,
    value: unknown,
  ): WebLuaContentDefinition {
    const source = record(value, `${contentKind} definition`)
    const key = text(source.key, `${contentKind} key`)
    const { key: _key, ...fields } = source
    return Object.freeze({
      contentKind,
      fields: cloneDefinitionRecord(fields, `${contentKind} definition`),
      key,
      kind: 'content-definition',
      source: this.#source(),
    })
  }

  #reference(kind: unknown, key: unknown, modId?: unknown): WebLuaContentReference {
    const targetKind = text(kind, 'content reference kind')
    if (!contentKinds.has(targetKind)) throw new Error(`unknown content reference kind: ${targetKind}`)
    return Object.freeze({
      key: text(key, 'content reference key'),
      kind: 'content-reference',
      modId: modId === undefined || modId === null
        ? this.#identity.id
        : text(modId, 'content reference mod id'),
      targetKind: targetKind as WebLuaContentKind,
    })
  }

  #rule(operation: string, value: unknown): WebLuaRuleDefinition {
    return Object.freeze({
      fields: cloneDefinitionRecord(record(value, `${operation} rule`), `${operation} rule`),
      kind: 'rule-definition',
      operation,
      source: this.#source(),
    })
  }

  #schema(schemaKind: string, value: unknown): WebLuaSchemaDefinition {
    const fields = schemaKind === 'object' && isRecord(value)
      ? { fields: cloneDefinitionRecord(value, `${schemaKind} schema fields`) }
      : cloneDefinitionRecord(record(value, `${schemaKind} schema`), `${schemaKind} schema`)
    return Object.freeze({
      fields,
      kind: 'schema-definition',
      schemaKind,
      source: this.#source(),
    })
  }

  #intent(intentKind: string, value: unknown): WebLuaIntentDefinition {
    return Object.freeze({
      fields: cloneDefinitionRecord(record(value, `${intentKind} intent`), `${intentKind} intent`),
      intentKind,
      kind: 'intent-definition',
      source: this.#source(),
    })
  }

  #reducer(value: unknown) {
    const source = record(value, 'advanced reducer')
    exactKeys(source, [
      'key',
      'on',
      'reduce',
      'schema_version',
      'scope',
      'state',
    ], 'advanced reducer')
    const key = text(source.key, 'advanced reducer key')
    if (this.#reducers.has(key)) throw new Error(`advanced reducer is already registered: ${key}`)
    const scope = text(source.scope, 'advanced reducer scope')
    if (!scopeKinds.has(scope)) throw new Error(`unknown advanced reducer scope: ${scope}`)
    if (!Array.isArray(source.on) || source.on.length === 0 || source.on.length > 64) {
      throw new Error('advanced reducer on must be a nonempty array of at most 64 event names')
    }
    const on = source.on.map((event, index) => text(event, `advanced reducer on[${index}]`))
    if (new Set(on).size !== on.length) throw new Error('advanced reducer on contains duplicates')
    if (!Number.isSafeInteger(source.schema_version) || Number(source.schema_version) < 1) {
      throw new Error('advanced reducer schema_version must be a positive safe integer')
    }
    if (!isToken(source.state, 'schema-definition')) {
      throw new Error('advanced reducer state must be an sd.schema definition')
    }
    if (typeof source.reduce !== 'function') throw new Error('advanced reducer reduce must be a function')
    const registration: WebLuaReducerRegistration = Object.freeze({
      callback: source.reduce as (...args: unknown[]) => unknown,
      key,
      on: Object.freeze(on),
      schemaVersion: Number(source.schema_version),
      scope: scope as WebLuaScopeKind,
      source: this.#source(),
      state: source.state as WebLuaSchemaDefinition,
    })
    this.#reducers.set(key, registration)
    return Object.freeze({ key, kind: 'reducer-token' as const })
  }

  #mod(value: unknown) {
    if (this.#modCalled) throw new Error('sd.mod may be called only once')
    this.#modCalled = true
    const source = record(value, 'sd.mod definition')
    exactKeys(source, ['api', 'assets', 'content', 'rules', 'systems'], 'sd.mod definition')
    const api = text(source.api, 'sd.mod api')
    if (api !== WEB_LUA_DEFINITION_API_VERSION) {
      throw new Error(`sd.mod api must be ${WEB_LUA_DEFINITION_API_VERSION}`)
    }
    const assets = this.#definitionList(source.assets, 'assets').map((entry, index) => {
      if (!isToken(entry.value, 'asset-definition')) {
        throw new Error(`assets[${index}] must be created by sd.art`)
      }
      const key = entry.mapKey ?? entry.value.key
      if (!key) throw new Error(`assets[${index}] requires a map key`)
      return Object.freeze({ ...entry.value, key }) as WebLuaAssetDefinition
    })
    const content = this.#definitionList(source.content, 'content').map((entry, index) => {
      if (!isToken(entry.value, 'content-definition')) {
        throw new Error(`content[${index}] must be created by sd.kit`)
      }
      if (entry.mapKey !== null && entry.mapKey !== entry.value.key) {
        throw new Error(`content map key ${entry.mapKey} does not match definition key ${entry.value.key}`)
      }
      return entry.value as WebLuaContentDefinition
    })
    const rules = this.#definitionList(source.rules, 'rules').map((entry, index) => {
      if (!isToken(entry.value, 'rule-definition')) {
        throw new Error(`rules[${index}] must be created by sd.rules or sd.effect`)
      }
      return entry.value as WebLuaRuleDefinition
    })
    const systems = this.#definitionList(source.systems, 'systems')
    const systemKeys = systems.map((entry, index) => {
      if (!isToken(entry.value, 'reducer-token')) {
        throw new Error(`systems[${index}] must be created by sd.advanced.reducer`)
      }
      return text(entry.value.key, `systems[${index}].key`)
    })
    const reducers = systemKeys.map((key) => {
      const reducer = this.#reducers.get(key)
      if (!reducer) throw new Error(`systems references unknown advanced reducer: ${key}`)
      return reducer
    })
    if (new Set(systemKeys).size !== systemKeys.length) {
      throw new Error('systems contains a duplicate advanced reducer')
    }
    if (reducers.length !== this.#reducers.size) {
      const missing = [...this.#reducers.keys()].filter(key => !systemKeys.includes(key))
      throw new Error(`advanced reducer is not included in systems: ${missing.join(', ')}`)
    }
    this.#definition = Object.freeze({
      api: WEB_LUA_DEFINITION_API_VERSION,
      assets: Object.freeze(assets),
      content: Object.freeze(content),
      reducers: Object.freeze(reducers),
      rules: Object.freeze(rules),
    })
    return Object.freeze({
      api: WEB_LUA_DEFINITION_API_VERSION,
      content_count: content.length,
      kind: 'mod-definition-receipt',
      mod_id: this.#identity.id,
    })
  }

  #definitionList(value: unknown, field: string): readonly Readonly<{
    mapKey: string | null
    value: Record<string, unknown>
  }>[] {
    if (value === undefined || value === null) return []
    if (Array.isArray(value)) {
      return value.map((entry, index) => ({
        mapKey: null,
        value: record(entry, `${field}[${index}]`),
      }))
    }
    const source = record(value, field)
    return Object.entries(source).map(([mapKey, entry]) => ({
      mapKey,
      value: record(entry, `${field}.${mapKey}`),
    }))
  }

  #source(): WebLuaDefinitionSource {
    return Object.freeze({ column: 0, file: this.#entryScript, line: 0 })
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error('Web Lua definition runtime is closed')
  }
}

function constructorTable(
  namespace: string,
  members: readonly string[],
  create: (operation: string, value: unknown) => Record<string, unknown>,
): Record<string, (value: unknown) => Record<string, unknown>> {
  return Object.fromEntries(members.map(member => [member, (value: unknown) => (
    create(`${namespace}.${member}`, value)
  )]))
}

function luaMember(value: string): string {
  return value.replaceAll('-', '_')
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${field} must be a table`)
  return value
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> {
  return value === undefined || value === null ? {} : record(value, field)
}

function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.includes('\0')) {
    throw new Error(`${field} must be nonempty text of at most 256 characters`)
  }
  return value
}

function exactKeys(source: Record<string, unknown>, keys: readonly string[], field: string): void {
  const accepted = new Set(keys)
  const unknown = Object.keys(source).filter(key => !accepted.has(key))
  if (unknown.length > 0) throw new Error(`${field} contains unknown fields: ${unknown.join(', ')}`)
}

function isToken<TKind extends string>(
  value: unknown,
  kind: TKind,
): value is Record<string, unknown> & { kind: TKind } {
  return isRecord(value) && value.kind === kind
}

function cloneDefinitionRecord(
  source: Record<string, unknown>,
  field: string,
): Readonly<Record<string, WebLuaDefinitionValue>> {
  const seen = new WeakSet<object>()
  let nodes = 0
  const clone = (value: unknown, path: string, depth: number): WebLuaDefinitionValue => {
    nodes += 1
    if (nodes > 65_536) throw new Error(`${field} exceeds its node limit`)
    if (depth > 32) throw new Error(`${path} exceeds its nesting limit`)
    if (value === undefined || value === null) return null
    if (typeof value === 'boolean' || typeof value === 'string') return value
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`${path} must be finite`)
      return value
    }
    if (typeof value === 'function') throw new Error(`${path} may not contain a function`)
    if (typeof value !== 'object') throw new Error(`${path} contains unsupported data`)
    if (seen.has(value)) throw new Error(`${path} is cyclic`)
    seen.add(value)
    try {
      if (Array.isArray(value)) {
        return Object.freeze(value.map((entry, index) => clone(entry, `${path}[${index}]`, depth + 1)))
      }
      return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        clone(entry, `${path}.${key}`, depth + 1),
      ])))
    } finally {
      seen.delete(value)
    }
  }
  return clone(source, field, 0) as Readonly<Record<string, WebLuaDefinitionValue>>
}

const DEFINITION_SANDBOX_BOOTSTRAP = `
  io = nil
  os = nil
  package = nil
  module = nil
  require = nil
  load = nil
  loadfile = nil
  dofile = nil
  debug = nil
  collectgarbage = nil
  coroutine = nil
`

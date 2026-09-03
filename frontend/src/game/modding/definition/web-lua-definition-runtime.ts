import { LuaFactory, type LuaEngine } from 'wasmoon'

import {
  WEB_LUA_CALLBACK_TIMEOUT_MS,
  WEB_LUA_DEFINITION_TIMEOUT_MS,
  WEB_LUA_STOCK_ENEMIES,
  WEB_LUA_VM_MEMORY_BYTES,
} from '../../host/lua/web-lua-contract.ts'
import {
  assembleWebLuaDefinition,
  type WebLuaExplicitLists,
} from './web-lua-definition-assembly.ts'
import { validWebLuaContentKey } from './web-lua-content-identity.ts'
import {
  WebLuaDefinitionError,
  webLuaDefinitionIssue,
  type WebLuaDefinitionErrorCode,
  type WebLuaDefinitionIssue,
} from './web-lua-definition-error.ts'
import {
  WEB_LUA_ART_ALIAS_NAMES,
  WEB_LUA_EFFECT_NAMES,
  WEB_LUA_PREFAB_NAMES,
  WEB_LUA_RULE_NAMES,
  WEB_LUA_SCHEMA_NAMES,
} from './web-lua-definition-language.ts'
import {
  WEB_LUA_DEFINITION_SANDBOX_BOOTSTRAP,
  WEB_LUA_FILE_LOADING_GLOBALS,
  WEB_LUA_SANDBOXED_GLOBALS,
  webLuaScriptHint,
} from './web-lua-definition-sandbox.ts'
import {
  DEFAULT_WEB_LUA_DEFINITION_LIMITS,
  WEB_LUA_ASSET_KINDS,
  WEB_LUA_CONTENT_KINDS,
  WEB_LUA_DEFINITION_API_VERSION,
  WEB_LUA_RULE_EVENT_NAMES,
  WEB_LUA_SCOPE_KINDS,
  type WebLuaAssetDefinition,
  type WebLuaAssetKind,
  type WebLuaContentDefinition,
  type WebLuaContentKind,
  type WebLuaContentReference,
  type WebLuaDefinitionSource,
  type WebLuaIntentDefinition,
  type WebLuaModDefinition,
  type WebLuaModIdentity,
  type WebLuaReducerRegistration,
  type WebLuaRuleDefinition,
  type WebLuaSchemaDefinition,
  type WebLuaScopeKind,
} from './web-lua-definition-types.ts'
import {
  readWebLuaScriptBundle,
  validateWebLuaScriptSet,
  WEB_LUA_SCRIPT_PATH,
} from './web-lua-script-bundle.ts'
import { didYouMean, listChoices, suggestWebLuaName } from './web-lua-suggestions.ts'
import {
  cloneWebLuaDefinitionRecord as cloneDefinitionRecord,
  cloneWebLuaRuntimeValue as cloneRuntimeValue,
  isWebLuaRecord as isRecord,
  isWebLuaToken as isToken,
  webLuaPayload as luaPayload,
} from './web-lua-definition-values.ts'

const contentKinds = new Set<string>(WEB_LUA_CONTENT_KINDS)
const eventNames = new Set<string>(WEB_LUA_RULE_EVENT_NAMES)
const scopeKinds = new Set<string>(WEB_LUA_SCOPE_KINDS)

const stockEnemies = new Map<string, string>()
for (const enemy of WEB_LUA_STOCK_ENEMIES) {
  stockEnemies.set(`stock.${enemy.key}`, enemy.token)
  stockEnemies.set(enemy.key, enemy.token)
  stockEnemies.set(enemy.token, enemy.token)
}
const LUA_ERROR_PATTERN = /^(scripts\/[^\n]*?\.lua):(\d+): ([\s\S]*)$/
const LUA_TIMEOUT_PATTERN = /thread timeout exceeded/

interface Site {
  readonly file: string
  readonly line: number
}

export interface WebLuaDefinitionRuntimeOptions {
  readonly entryScript: string
  readonly identity: WebLuaModIdentity
  readonly log?: (message: string) => void
  /** Additional package scripts reachable through sd.include, keyed by package path. */
  readonly scripts?: ReadonlyMap<string, string>
  readonly wasmPath: string
}

export class WebLuaDefinitionRuntime {
  readonly #engine: LuaEngine
  readonly #entryScript: string
  readonly #identity: WebLuaModIdentity
  readonly #log: (message: string) => void
  readonly #scripts = new Map<string, string>()
  readonly #members = new Map<string, readonly string[]>()
  readonly #reducers = new Map<string, WebLuaReducerRegistration>()
  readonly #assets = new Map<number, WebLuaAssetDefinition>()
  readonly #contentNodes = new Map<number, WebLuaContentDefinition>()
  readonly #rules = new Map<number, WebLuaRuleDefinition>()
  readonly #issues: WebLuaDefinitionIssue[] = []
  readonly #includeLoaded = new Set<string>()
  readonly #includeLoading = new Set<string>()
  #closed = false
  #definition: WebLuaModDefinition | null = null
  #explicit: WebLuaExplicitLists | null = null
  #nodes = 0
  #site: Site
  #reducerResult: Readonly<{ intents: unknown; state: unknown }> | null = null
  #reducerResultSubmitted = false
  #reducerRunning = false

  static async create(
    options: WebLuaDefinitionRuntimeOptions,
  ): Promise<WebLuaDefinitionRuntime> {
    if (options.scripts) validateWebLuaScriptSet(options.scripts)
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
      await engine.doString(WEB_LUA_DEFINITION_SANDBOX_BOOTSTRAP)
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
    this.#site = { file: options.entryScript, line: 0 }
    for (const [path, text] of options.scripts ?? []) {
      if (path !== options.entryScript) this.#scripts.set(path, text)
    }
  }

  run(code: string): WebLuaModDefinition {
    this.#requireOpen()
    if (this.#definition) throw new Error('Web Lua definition entrypoint already ran')
    this.#reset()
    this.#loadBundle(code)
    if (this.#issues.length === 0) this.#execute(code)
    if (this.#issues.length === 0) this.#definition = this.#assemble()
    if (this.#issues.length > 0 || !this.#definition) {
      const issues = this.#issues.length > 0 ? [...this.#issues] : [webLuaDefinitionIssue(
        'E_GRAPH',
        'definition',
        'the definition could not be assembled',
        { source: this.#entrySource() },
      )]
      this.#reset()
      throw new WebLuaDefinitionError(issues)
    }
    return this.#definition
  }

  reducer(key: string): WebLuaReducerRegistration | null {
    return this.#reducers.get(key) ?? null
  }

  invokeReducer(
    key: string,
    state: unknown,
    event: unknown,
    context: unknown,
  ): Readonly<{ intents: unknown; state: unknown }> {
    this.#requireOpen()
    if (this.#reducerRunning) throw new Error('advanced reducers may not run recursively')
    const reducer = this.#reducers.get(key)
    if (!reducer) throw new Error(`unknown advanced reducer: ${key}`)
    this.#reducerRunning = true
    this.#reducerResult = null
    this.#reducerResultSubmitted = false
    try {
      const returned = reducer.callback(luaPayload(state), luaPayload(event), luaPayload(context))
      if (returned instanceof Promise) throw new Error('advanced reducer may not yield')
      const captured = this.#capturedReducerResult()
      if (!this.#reducerResultSubmitted || !captured) {
        throw new Error(`advanced reducer ${key} returned no captured result`)
      }
      return Object.freeze({
        intents: cloneRuntimeValue(captured.intents, `${key} intents`),
        state: cloneRuntimeValue(captured.state, `${key} state`),
      })
    } finally {
      this.#reducerRunning = false
      this.#reducerResult = null
      this.#reducerResultSubmitted = false
    }
  }

  invokeMigration(key: string, version: number, value: unknown): unknown {
    this.#requireOpen()
    if (this.#reducerRunning) throw new Error('advanced reducer callbacks may not run recursively')
    const migration = this.#reducers.get(key)?.migrations[version]
    if (!migration) throw new Error(`advanced reducer ${key} has no migration from version ${version}`)
    this.#reducerRunning = true
    try {
      const returned = migration(luaPayload(value))
      if (returned instanceof Promise) throw new Error('advanced reducer migration may not yield')
      return cloneRuntimeValue(returned, `${key} migration ${version}`)
    } finally {
      this.#reducerRunning = false
    }
  }

  get memoryBytes(): number {
    return this.#closed ? 0 : this.#engine.global.getMemoryUsed()
  }

  #capturedReducerResult(): Readonly<{ intents: unknown; state: unknown }> | null {
    return this.#reducerResult
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    this.#definition = null
    this.#reducers.clear()
    this.#engine.global.close()
  }

  #reset(): void {
    this.#definition = null
    this.#explicit = null
    this.#reducers.clear()
    this.#assets.clear()
    this.#contentNodes.clear()
    this.#rules.clear()
    this.#issues.length = 0
    this.#includeLoaded.clear()
    this.#includeLoading.clear()
    this.#nodes = 0
    this.#site = { file: this.#entryScript, line: 0 }
  }

  #loadBundle(code: string): void {
    let bundle: ReadonlyMap<string, string> | null
    try {
      bundle = readWebLuaScriptBundle(code)
    } catch (error) {
      this.#issue('E_SCRIPT', 'sd.include', errorMessage(error), this.#entrySource())
      return
    }
    if (!bundle) return
    for (const [path, text] of bundle) {
      const existing = this.#scripts.get(path)
      if (existing !== undefined && existing !== text) {
        this.#issue(
          'E_SCRIPT',
          'sd.include',
          `${path} differs between the package files and the packed script bundle`,
          this.#entrySource(),
        )
        return
      }
      this.#scripts.set(path, text)
    }
  }

  #execute(code: string): void {
    const thread = this.#engine.global.newThread()
    const threadIndex = this.#engine.global.getTop()
    try {
      thread.loadString(code, `@${this.#entryScript}`)
      thread.setTimeout(Date.now() + WEB_LUA_DEFINITION_TIMEOUT_MS)
      const values = [...thread.runSync()]
      this.#checkReturn(values)
    } catch (error) {
      this.#recordScriptError(error)
    } finally {
      thread.close()
      this.#engine.global.remove(threadIndex)
    }
  }

  #checkReturn(values: readonly unknown[]): void {
    const meaningful = values.filter(value => value !== undefined && value !== null)
    if (meaningful.length === 0) return
    if (meaningful.length === 1 && isToken(meaningful[0], 'mod-definition-receipt')) return
    this.#issue(
      'E_GRAPH',
      'definition',
      'the entry script returned an unexpected value; end it with return sd.mod({...}) or leave the return out',
      this.#entrySource(),
    )
  }

  #recordScriptError(error: unknown): void {
    const message = errorMessage(error)
    if (this.#issues.some(issue => issue.message === message)) return
    if (LUA_TIMEOUT_PATTERN.test(message)) {
      this.#issue(
        'E_BUDGET',
        'definition',
        `the definition script ran longer than ${WEB_LUA_DEFINITION_TIMEOUT_MS} ms; definitions must finish quickly, so keep loops small and leave gameplay to rules`,
        this.#entrySource(),
      )
      return
    }
    const match = LUA_ERROR_PATTERN.exec(message)
    if (match) {
      const [, file, line, detail] = match
      this.#issue('E_SCRIPT', 'script', `${detail}${webLuaScriptHint(detail)}`, Object.freeze({
        column: 0,
        file,
        line: Number(line),
      }))
      return
    }
    this.#issue('E_SCRIPT', 'script', `${message}${webLuaScriptHint(message)}`, this.#source())
  }

  #install(): void {
    const guard = <TArgs extends unknown[], TResult>(
      code: WebLuaDefinitionErrorCode,
      label: string | ((args: TArgs) => string),
      fn: (...args: TArgs) => TResult,
    ) => (...args: TArgs): TResult => {
      try {
        return fn(...args)
      } catch (error) {
        const path = typeof label === 'function' ? label(args) : label
        this.#issue(code, path, errorMessage(error), this.#source())
        throw error
      }
    }
    const contentLabel = (kind: WebLuaContentKind) => (args: unknown[]): string => {
      const value = args[0]
      const key = isRecord(value) && typeof value.key === 'string'
        ? value.key
        : isRecord(value) && typeof value.name === 'string' ? slugKey(value.name) : ''
      return `sd.${luaMember(kind)}${key ? `(${key})` : ''}`
    }

    const art: Record<string, unknown> = {}
    for (const assetKind of WEB_LUA_ASSET_KINDS) {
      art[luaMember(assetKind)] = guard(
        'E_SCHEMA',
        `sd.art.${luaMember(assetKind)}`,
        (value: unknown, options?: unknown) => this.#asset(assetKind, value, options),
      )
    }
    art.ref = guard('E_REFERENCE', 'sd.art.ref', (key: unknown) => Object.freeze({
      key: text(key, 'asset reference key'),
      kind: 'asset-reference' as const,
    }))
    art.wearable = guard('E_SCHEMA', 'sd.art.wearable', (path: unknown, options?: unknown) => this.#asset('sheet', {
      ...optionalRecord(options, 'wearable options'),
      animations: { wearable: [1] },
      frame: { height: 170, width: 170 },
      image: text(path, 'wearable art path'),
    }))

    const kit: Record<string, unknown> = {}
    for (const contentKind of WEB_LUA_CONTENT_KINDS) {
      kit[luaMember(contentKind)] = guard(
        'E_SCHEMA',
        contentLabel(contentKind),
        (value: unknown) => this.#content(contentKind, value),
      )
    }

    const prefab = Object.fromEntries(WEB_LUA_PREFAB_NAMES.map(member => [
      member,
      guard('E_SCHEMA', `sd.prefab.${member}`, (value: unknown) => this.#rule(`prefab.${member}`, value)),
    ]))
    const rules = {
      after: guard('E_SCHEMA', 'sd.after', (duration: unknown, ...nodes: unknown[]) => (
        this.#rule('rules.after', { duration, node: nodeArgument(nodes, 'sd.after') })
      )),
      all: guard('E_SCHEMA', 'sd.all', (...nodes: unknown[]) => (
        this.#rule('rules.all', { nodes: nodesArgument(nodes, 'sd.all') })
      )),
      every: guard('E_SCHEMA', 'sd.every', (interval: unknown, node: unknown, options?: unknown) => (
        this.#rule('rules.every', { ...everyOptions(options), interval, node })
      )),
      first: guard('E_SCHEMA', 'sd.first', (...nodes: unknown[]) => (
        this.#rule('rules.first', { nodes: nodesArgument(nodes, 'sd.first') })
      )),
      on: guard('E_SCHEMA', 'sd.on', (event: unknown, ...nodes: unknown[]) => (
        this.#rule('rules.on', { event, node: nodeArgument(nodes, 'sd.on') })
      )),
      when: guard('E_SCHEMA', 'sd.when', (predicate: unknown, yes: unknown, no?: unknown) => (
        this.#rule('rules.when', { ...(no === undefined || no === null ? {} : { no }), predicate, yes })
      )),
    }
    const effect = Object.fromEntries(WEB_LUA_EFFECT_NAMES.map(member => [
      member,
      guard('E_SCHEMA', `sd.effect.${member}`, (value: unknown) => this.#rule(`effect.${member}`, value)),
    ]))
    const intent = Object.fromEntries(WEB_LUA_EFFECT_NAMES.map(member => [
      member,
      guard('E_SCHEMA', `sd.intent.${member}`, (value: unknown) => this.#intent(`intent.${member}`, value)),
    ]))
    const schema = Object.fromEntries(WEB_LUA_SCHEMA_NAMES.map(member => [
      member,
      guard('E_SCHEMA', `sd.schema.${member}`, (value: unknown) => (
        this.#schema(member, member === 'enum' ? { values: array(value, 'enum values') } : value ?? {})
      )),
    ]))
    const advanced = {
      reducer: guard('E_SCHEMA', 'sd.advanced.reducer', (value: unknown) => this.#reducer(value)),
    }
    const sd = {
      advanced,
      art,
      effect,
      intent,
      kit,
      mod: guard('E_GRAPH', 'sd.mod', (value: unknown) => this.#mod(value)),
      prefab,
      ref: guard('E_REFERENCE', 'sd.ref', (kind: unknown, key: unknown, modId?: unknown) => (
        this.#reference(kind, key, modId)
      )),
      rules,
      schema,
    }

    this.#members.set('sd', [
      ...Object.keys(kit),
      ...WEB_LUA_RULE_NAMES,
      ...WEB_LUA_ART_ALIAS_NAMES,
      'advanced',
      'art',
      'effect',
      'include',
      'intent',
      'kit',
      'mod',
      'prefab',
      'ref',
      'rules',
      'schema',
    ])
    this.#members.set('sd.advanced', ['reducer'])
    this.#members.set('sd.art', Object.keys(art))
    this.#members.set('sd.effect', [...WEB_LUA_EFFECT_NAMES])
    this.#members.set('sd.intent', [...WEB_LUA_EFFECT_NAMES])
    this.#members.set('sd.kit', Object.keys(kit))
    this.#members.set('sd.prefab', [...WEB_LUA_PREFAB_NAMES])
    this.#members.set('sd.rules', [...WEB_LUA_RULE_NAMES])
    this.#members.set('sd.schema', [...WEB_LUA_SCHEMA_NAMES])

    this.#engine.global.set('print', (...parts: unknown[]) => {
      this.#log(parts.map(part => (typeof part === 'string' ? part : String(part))).join('\t'))
    })
    this.#engine.global.set('__sd_submit_reducer_result', (state: unknown, intents: unknown) => {
      if (!this.#reducerRunning) throw new Error('reducer results may only be submitted while a reducer runs')
      if (this.#reducerResultSubmitted) throw new Error('reducer results may only be submitted once')
      this.#reducerResultSubmitted = true
      this.#reducerResult = Object.freeze({ intents, state })
    })
    this.#engine.global.set('__sd_site', (source: unknown, line: unknown) => {
      const file = typeof source === 'string' && source.startsWith('@') ? source.slice(1) : this.#entryScript
      const number = typeof line === 'number' && Number.isInteger(line) && line > 0 ? line : 0
      this.#site = { file, line: number }
    })
    this.#engine.global.set('__sd_unknown_member', (namespace: unknown, key: unknown) => (
      this.#unknownMember(String(namespace), String(key))
    ))
    this.#engine.global.set('__sd_unknown_global', (key: unknown, globals: unknown) => (
      this.#unknownGlobal(String(key), globals)
    ))
    this.#engine.global.set('__sd_include_begin', guard('E_SCRIPT', 'sd.include', (path: unknown) => (
      this.#includeBegin(path)
    )))
    this.#engine.global.set('__sd_include_end', (path: unknown, ok: unknown) => {
      if (typeof path !== 'string') return
      this.#includeLoading.delete(path)
      if (ok === true) this.#includeLoaded.add(path)
    })
    this.#engine.global.set('sd', sd)
  }

  #includeBegin(path: unknown): Readonly<{ status: 'cached' } | { status: 'load'; text: string }> {
    if (typeof path !== 'string' || !WEB_LUA_SCRIPT_PATH.test(path)) {
      throw new Error('sd.include needs a package script path such as "scripts/items.lua"')
    }
    if (path === this.#entryScript) throw new Error(`${path} is the entry script and cannot include itself`)
    if (this.#includeLoading.has(path)) {
      throw new Error(`${path} is still being included; scripts may not include each other in a cycle`)
    }
    if (this.#includeLoaded.has(path)) return Object.freeze({ status: 'cached' as const })
    const text = this.#scripts.get(path)
    if (text === undefined) {
      const known = [...this.#scripts.keys()]
      const hint = known.length === 0
        ? '; add the file under scripts/ in the package'
        : didYouMean(path, known) || `; the package has ${listChoices(known)}`
      throw new Error(`${path} is not in the package${hint}`)
    }
    this.#includeLoading.add(path)
    return Object.freeze({ status: 'load' as const, text })
  }

  #unknownMember(namespace: string, name: string): string {
    const members = this.#members.get(namespace) ?? []
    let hint = ''
    const exact = [...this.#members].find(([space, names]) => space !== namespace && names.includes(name))
    if (exact) hint = `; did you mean ${exact[0]}.${name}?`
    else {
      const local = suggestWebLuaName(name, members)
      if (local) hint = `; did you mean ${namespace}.${local}?`
      else {
        for (const [space, names] of this.#members) {
          const suggestion = suggestWebLuaName(name, names)
          if (suggestion) {
            hint = `; did you mean ${space}.${suggestion}?`
            break
          }
        }
      }
      if (!hint && members.length > 0 && members.length <= 12) hint = `; ${namespace} offers ${listChoices(members)}`
      if (!hint) hint = '; see REFERENCE.md for the full list of names'
    }
    return `${namespace}.${name} is not part of Web Lua 1.0${hint}`
  }

  #unknownGlobal(name: string, globals: unknown): string {
    if (WEB_LUA_FILE_LOADING_GLOBALS.has(name)) {
      return `${name} is not available inside Web Lua mods; use sd.include("scripts/file.lua") to split a mod across files`
    }
    if (WEB_LUA_SANDBOXED_GLOBALS.has(name)) return `${name} is not available inside Web Lua mods`
    const members = this.#members.get('sd') ?? []
    if (members.includes(name)) return `'${name}' is not defined; did you mean sd.${name}?`
    const member = suggestWebLuaName(name, members)
    if (member) return `'${name}' is not defined; did you mean sd.${member}?`
    const names = Array.isArray(globals) ? globals.filter((value): value is string => typeof value === 'string') : []
    const global = suggestWebLuaName(name, names)
    if (global) return `'${name}' is not defined; did you mean ${global}?`
    return `'${name}' is not defined; create it first with local ${name} = ... or check the spelling`
  }

  #asset(assetKind: WebLuaAssetKind, value: unknown, options?: unknown): WebLuaAssetDefinition {
    const label = `${assetKind} asset`
    const fields = typeof value === 'string'
      ? { ...optionalRecord(options, `${label} options`), [assetKind === 'sheet' ? 'image' : 'path']: value }
      : { ...record(value, `${label} definition`) }
    const { key: rawKey, ...rest } = fields
    const key = rawKey === undefined || rawKey === null ? '' : text(rawKey, `${label} key`)
    const definition: WebLuaAssetDefinition = Object.freeze({
      assetKind,
      fields: cloneDefinitionRecord(rest, `${label} definition`),
      key,
      kind: 'asset-definition',
      source: this.#nodeSource(),
    })
    this.#assets.set(definition.source.node as number, definition)
    return definition
  }

  #content(contentKind: WebLuaContentKind, value: unknown): WebLuaContentDefinition {
    const label = `sd.${luaMember(contentKind)}`
    const source = record(value, `${label} definition`)
    let key: string
    if (source.key === undefined || source.key === null) {
      if (typeof source.name === 'string' && source.name.trim().length > 0) {
        key = slugKey(source.name)
        if (!validWebLuaContentKey(key)) {
          throw new Error(`${label} needs a key because its name cannot become one; add key = "my_${luaMember(contentKind)}"`)
        }
      } else {
        throw new Error(`${label} needs a key, for example key = "my_${luaMember(contentKind)}"; keys are lowercase words joined by underscores`)
      }
    } else {
      key = text(source.key, `${luaMember(contentKind)} key`)
    }
    const { key: _ignored, ...fields } = source
    const definition: WebLuaContentDefinition = Object.freeze({
      contentKind,
      fields: cloneDefinitionRecord(fields, `${label} definition`),
      key,
      kind: 'content-definition',
      source: this.#nodeSource(),
    })
    this.#contentNodes.set(definition.source.node as number, definition)
    return definition
  }

  #reference(kind: unknown, key: unknown, modId?: unknown): WebLuaContentReference {
    const targetKind = text(kind, 'reference kind')
    if (!contentKinds.has(targetKind)) {
      throw new Error(`unknown content reference kind: ${targetKind}${didYouMean(targetKind, WEB_LUA_CONTENT_KINDS)}`)
    }
    return Object.freeze({
      key: text(key, 'reference key'),
      kind: 'content-reference',
      modId: modId === undefined || modId === null ? this.#identity.id : text(modId, 'reference mod id'),
      targetKind: targetKind as WebLuaContentKind,
    })
  }

  #rule(operation: string, value: unknown): WebLuaRuleDefinition {
    const definition: WebLuaRuleDefinition = Object.freeze({
      fields: cloneDefinitionRecord(record(value, `${operation} definition`), `${operation} definition`),
      kind: 'rule-definition',
      operation,
      source: this.#nodeSource(),
    })
    this.#rules.set(definition.source.node as number, definition)
    return definition
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
    const normalizedKind = intentKind.startsWith('intent.')
      ? intentKind.slice('intent.'.length)
      : intentKind
    return Object.freeze({
      fields: cloneDefinitionRecord(record(value, `${intentKind} intent`), `${intentKind} intent`),
      intentKind: normalizedKind,
      kind: 'intent-definition',
      source: this.#source(),
    })
  }

  #reducer(value: unknown) {
    const source = record(value, 'advanced reducer')
    exactKeys(source, [
      'key',
      'migrations',
      'on',
      'reduce',
      'schema_version',
      'scope',
      'state',
    ], 'advanced reducer')
    const key = text(source.key, 'advanced reducer key')
    if (this.#reducers.has(key)) throw new Error(`advanced reducer is already registered: ${key}`)
    const scope = text(source.scope, 'advanced reducer scope')
    if (!scopeKinds.has(scope)) {
      throw new Error(`unknown advanced reducer scope: ${scope}${didYouMean(scope, WEB_LUA_SCOPE_KINDS)}`)
    }
    if (!Array.isArray(source.on) || source.on.length === 0 || source.on.length > 64) {
      throw new Error('advanced reducer on must be a nonempty array of at most 64 event names')
    }
    const on = source.on.map((event, index) => text(event, `advanced reducer on[${index}]`))
    if (new Set(on).size !== on.length) throw new Error('advanced reducer on contains duplicates')
    const unknownEvent = on.find(event => !eventNames.has(event))
    if (unknownEvent) {
      throw new Error(`unknown advanced reducer event: ${unknownEvent}${didYouMean(unknownEvent, WEB_LUA_RULE_EVENT_NAMES)}`)
    }
    if (!Number.isSafeInteger(source.schema_version) || Number(source.schema_version) < 1) {
      throw new Error('advanced reducer schema_version must be a positive safe integer')
    }
    if (!isToken(source.state, 'schema-definition')) {
      throw new Error('advanced reducer state must be an sd.schema definition')
    }
    if (typeof source.reduce !== 'function') throw new Error('advanced reducer reduce must be a function')
    const migrationSource = source.migrations === undefined ? {} : source.migrations
    if (!Array.isArray(migrationSource) && (!migrationSource || typeof migrationSource !== 'object')) {
      throw new Error('advanced reducer migrations must be a table')
    }
    const migrations: Record<number, (...args: unknown[]) => unknown> = {}
    for (let version = 1; version < Number(source.schema_version); version += 1) {
      const migration = Array.isArray(migrationSource)
        ? migrationSource[version - 1]
        : (migrationSource as Record<string, unknown>)[version]
      if (typeof migration !== 'function') {
        throw new Error(`advanced reducer is missing migration from version ${version}`)
      }
      migrations[version] = migration as (...args: unknown[]) => unknown
    }
    if (this.#reducers.size >= DEFAULT_WEB_LUA_DEFINITION_LIMITS.maximumReducers) {
      throw new Error(`a mod may register at most ${DEFAULT_WEB_LUA_DEFINITION_LIMITS.maximumReducers} advanced reducers`)
    }
    const registration: WebLuaReducerRegistration = Object.freeze({
      callback: source.reduce as (...args: unknown[]) => unknown,
      key,
      migrations: Object.freeze(migrations),
      on: Object.freeze(on),
      schemaVersion: Number(source.schema_version),
      scope: scope as WebLuaScopeKind,
      source: this.#source(),
      state: source.state as unknown as WebLuaSchemaDefinition,
    })
    this.#reducers.set(key, registration)
    return Object.freeze({ key, kind: 'reducer-token' as const })
  }

  #mod(value: unknown) {
    if (this.#explicit) throw new Error('sd.mod may be called only once')
    const source = record(value, 'sd.mod definition')
    exactKeys(source, ['api', 'assets', 'content', 'rules', 'systems'], 'sd.mod definition')
    if (source.api !== undefined && source.api !== null) {
      const api = text(source.api, 'sd.mod api')
      if (api !== WEB_LUA_DEFINITION_API_VERSION) {
        throw new Error(`sd.mod api must be "${WEB_LUA_DEFINITION_API_VERSION}"`)
      }
    }
    const assets = this.#definitionList(source.assets, 'assets').map(({ mapKey, value: entry }, index) => {
      const node = this.#registryNode(entry, 'asset-definition', this.#assets, `assets[${mapKey ?? index}]`, 'sd.art')
      const definition = this.#assets.get(node) as WebLuaAssetDefinition
      if (mapKey !== null && definition.key && mapKey !== definition.key) {
        throw new Error(`assets.${mapKey} was created with key = "${definition.key}"; use one name for it`)
      }
      return Object.freeze({ key: mapKey ?? definition.key, node })
    })
    const content = this.#definitionList(source.content, 'content').map(({ mapKey, value: entry }, index) => {
      const node = this.#registryNode(entry, 'content-definition', this.#contentNodes, `content[${mapKey ?? index}]`, 'sd.kit')
      const definition = this.#contentNodes.get(node) as WebLuaContentDefinition
      if (mapKey !== null && mapKey !== definition.key) {
        throw new Error(`content.${mapKey} was created with key = "${definition.key}"; use one name for it`)
      }
      return node
    })
    const rules = this.#definitionList(source.rules, 'rules').map(({ value: entry }, index) => (
      this.#registryNode(entry, 'rule-definition', this.#rules, `rules[${index}]`, 'sd.on, sd.rules, sd.effect, or sd.prefab')
    ))
    const systems = this.#definitionList(source.systems, 'systems').map(({ value: entry }, index) => {
      if (!isToken(entry, 'reducer-token') || typeof entry.key !== 'string' || !this.#reducers.has(entry.key)) {
        throw new Error(`systems[${index}] must be created by sd.advanced.reducer`)
      }
      return entry.key
    })
    if (new Set(systems).size !== systems.length) throw new Error('systems contains duplicates')
    this.#explicit = Object.freeze({
      assets: Object.freeze(assets),
      content: Object.freeze(content),
      rules: Object.freeze(rules),
      systems: Object.freeze(systems),
    })
    return Object.freeze({
      api: WEB_LUA_DEFINITION_API_VERSION,
      content_count: this.#contentNodes.size,
      kind: 'mod-definition-receipt' as const,
      mod_id: this.#identity.id,
    })
  }

  #registryNode(
    value: unknown,
    kind: string,
    registry: ReadonlyMap<number, unknown>,
    field: string,
    constructors: string,
  ): number {
    const node = isToken(value, kind) && isRecord(value.source) ? value.source.node : undefined
    if (typeof node !== 'number' || !registry.has(node)) {
      throw new Error(`${field} must be created by ${constructors}`)
    }
    return node
  }

  #definitionList(value: unknown, field: string): readonly Readonly<{
    mapKey: string | null
    value: unknown
  }>[] {
    if (value === undefined || value === null) return []
    if (Array.isArray(value)) return value.map(entry => Object.freeze({ mapKey: null, value: entry }))
    if (!isRecord(value)) throw new Error(`${field} must be a table`)
    return Object.entries(value).map(([mapKey, entry]) => Object.freeze({ mapKey, value: entry }))
  }

  #assemble(): WebLuaModDefinition {
    const explicit = this.#explicit
    const empty = !explicit
      && this.#assets.size === 0
      && this.#contentNodes.size === 0
      && this.#rules.size === 0
      && this.#reducers.size === 0
    if (empty) {
      this.#issue(
        'E_GRAPH',
        'definition',
        'the script defined nothing; create content such as sd.item({key = "my_item", name = "My Item"}) or call sd.mod({...})',
        this.#entrySource(),
      )
      return EMPTY_DEFINITION
    }
    const { assets, content, rules } = assembleWebLuaDefinition({
      assets: this.#assets,
      content: this.#contentNodes,
      identity: this.#identity,
      issues: this.#issues,
      rules: this.#rules,
      stockEnemies,
    }, explicit)
    const reducers: WebLuaReducerRegistration[] = []
    const listed = new Set<string>()
    for (const key of explicit?.systems ?? []) {
      const registration = this.#reducers.get(key)
      if (registration && !listed.has(key)) {
        listed.add(key)
        reducers.push(registration)
      }
    }
    for (const [key, registration] of this.#reducers) {
      if (!listed.has(key)) reducers.push(registration)
    }
    return Object.freeze({
      api: WEB_LUA_DEFINITION_API_VERSION,
      assets: Object.freeze(assets),
      content: Object.freeze(content),
      reducers: Object.freeze(reducers),
      rules: Object.freeze(rules),
    })
  }

  #issue(
    code: WebLuaDefinitionErrorCode,
    path: string,
    message: string,
    source: WebLuaDefinitionSource,
  ): void {
    this.#issues.push(webLuaDefinitionIssue(code, path, message, { source }))
  }

  #source(): WebLuaDefinitionSource {
    return Object.freeze({ column: 0, file: this.#site.file, line: this.#site.line })
  }

  #entrySource(): WebLuaDefinitionSource {
    return Object.freeze({ column: 0, file: this.#entryScript, line: 0 })
  }

  #nodeSource(): WebLuaDefinitionSource {
    if (this.#nodes >= DEFAULT_WEB_LUA_DEFINITION_LIMITS.maximumNodes) {
      throw new Error(`a mod may create at most ${DEFAULT_WEB_LUA_DEFINITION_LIMITS.maximumNodes} definitions`)
    }
    this.#nodes += 1
    return Object.freeze({ column: 0, file: this.#site.file, line: this.#site.line, node: this.#nodes })
  }

  #requireOpen(): void {
    if (this.#closed) throw new Error('Web Lua definition runtime is closed')
  }
}

const EMPTY_DEFINITION: WebLuaModDefinition = Object.freeze({
  api: WEB_LUA_DEFINITION_API_VERSION,
  assets: Object.freeze([]),
  content: Object.freeze([]),
  reducers: Object.freeze([]),
  rules: Object.freeze([]),
})

function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function nodeArgument(nodes: readonly unknown[], field: string): unknown {
  if (nodes.length === 0) throw new Error(`${field} is missing the effect or rule to run`)
  return nodes.length === 1 ? nodes[0] : nodes
}

function nodesArgument(nodes: readonly unknown[], field: string): readonly unknown[] {
  if (nodes.length === 1 && Array.isArray(nodes[0])) return nodes[0]
  if (nodes.length === 0) throw new Error(`${field} needs at least one effect or rule`)
  return nodes
}

function everyOptions(options: unknown): Record<string, unknown> {
  if (options === undefined || options === null) return {}
  if (typeof options === 'number') return { times: options }
  return record(options, 'sd.every options')
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

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || value.includes('\0')) {
    throw new Error(`${field} must be nonempty text of at most 256 characters`)
  }
  return value
}

function exactKeys(source: Record<string, unknown>, keys: readonly string[], field: string): void {
  const accepted = new Set(keys)
  const unknown = Object.keys(source).filter(key => !accepted.has(key))
  if (unknown.length > 0) {
    const hints = unknown
      .map(key => didYouMean(key, keys))
      .filter(hint => hint.length > 0)
    throw new Error(`${field} contains unknown fields: ${unknown.join(', ')}${hints[0] ?? ''}`)
  }
}

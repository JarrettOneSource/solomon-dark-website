import { LuaFactory, type LuaEngine } from 'wasmoon'

import {
  WEB_LUA_CALLBACK_TIMEOUT_MS,
  WEB_LUA_DEFINITION_TIMEOUT_MS,
  WEB_LUA_VM_MEMORY_BYTES,
} from '../../host/lua/web-lua-contract.ts'
import { validWebLuaContentKey } from './web-lua-content-identity.ts'
import {
  WebLuaDefinitionError,
  webLuaDefinitionIssue,
  type WebLuaDefinitionErrorCode,
  type WebLuaDefinitionIssue,
} from './web-lua-definition-error.ts'
import { WEB_LUA_CONTENT_SCHEMA_FIELDS } from './web-lua-definition-schemas.ts'
import {
  DEFAULT_WEB_LUA_DEFINITION_LIMITS,
  WEB_LUA_ASSET_KINDS,
  WEB_LUA_CONTENT_ART_SLOTS,
  WEB_LUA_CONTENT_KINDS,
  WEB_LUA_DEFINITION_API_VERSION,
  WEB_LUA_RULE_EVENT_NAMES,
  WEB_LUA_SCOPE_KINDS,
  type WebLuaAssetDefinition,
  type WebLuaAssetKind,
  type WebLuaAssetReference,
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
  readWebLuaScriptBundle,
  validateWebLuaScriptSet,
  WEB_LUA_SCRIPT_PATH,
} from './web-lua-script-bundle.ts'
import { didYouMean, listChoices, suggestWebLuaName } from './web-lua-suggestions.ts'

const contentKinds = new Set<string>(WEB_LUA_CONTENT_KINDS)
const eventNames = new Set<string>(WEB_LUA_RULE_EVENT_NAMES)
const scopeKinds = new Set<string>(WEB_LUA_SCOPE_KINDS)

const RULE_ALIASES = ['after', 'all', 'every', 'first', 'on', 'when'] as const
const ART_ALIASES = ['music', 'sheet', 'sound', 'sprite', 'wearable'] as const
const EFFECT_KINDS = ['damage', 'grant', 'present', 'resource', 'spawn', 'state', 'status'] as const
const PREFAB_KINDS = ['area', 'channel', 'minimap', 'portal', 'projectile'] as const
const SCHEMA_KINDS = ['array', 'boolean', 'enum', 'integer', 'number', 'object', 'string'] as const
const SANDBOXED_GLOBALS = new Set([
  'collectgarbage',
  'coroutine',
  'debug',
  'dofile',
  'io',
  'load',
  'loadfile',
  'module',
  'os',
  'package',
  'require',
])
const FILE_LOADING_GLOBALS = new Set(['dofile', 'loadfile', 'require'])
const LUA_ERROR_PATTERN = /^(scripts\/[^\n]*?\.lua):(\d+): ([\s\S]*)$/
const LUA_TIMEOUT_PATTERN = /thread timeout exceeded/

/** Plain-language hints appended to the Lua interpreter's own error text. */
const SCRIPT_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/'\)' expected/, 'Lua tables use braces, so write sd.item({key = "my_item"}) or sd.item{key = "my_item"}'],
  [/'\}' expected/, 'a table is missing its closing brace; check the commas between fields too'],
  [/'end' expected/, 'a function, if, or for block is missing its matching end'],
  [/unexpected symbol near <eof>/, 'the file ended early; a closing brace, parenthesis, or end is missing'],
  [/unexpected symbol near '\)'/, 'there is an extra parenthesis, or a comma right before a closing parenthesis'],
  [/unfinished string/, 'a string is missing its closing quote'],
  [/'=' expected/, 'fields inside tables are written as name = value, for example key = "my_item"'],
  [/attempt to index a nil value/, 'a name used here has no value yet; check that it is spelled like where it was created'],
  [/attempt to call a nil value/, 'the function named here does not exist; check its spelling against the reference'],
  [/attempt to call a table value/, 'this name holds a table, not a function; calls look like sd.item({...})'],
  [/attempt to concatenate/, 'join text with .. and wrap numbers in tostring()'],
  [/attempt to compare/, 'these two values have different types and cannot be compared'],
  [/attempt to perform arithmetic/, 'one of these values is text or nil rather than a number'],
]

interface Site {
  readonly file: string
  readonly line: number
}

interface ExplicitLists {
  readonly assets: ReadonlyArray<Readonly<{ key: string; node: number }>>
  readonly content: readonly number[]
  readonly rules: readonly number[]
  readonly systems: readonly string[]
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
  #explicit: ExplicitLists | null = null
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
    this.#site = { file: options.entryScript, line: 0 }
    for (const [path, text] of options.scripts ?? []) {
      if (path !== options.entryScript) this.#scripts.set(path, text)
    }
  }

  /** Package scripts known to this runtime, including any packed bundle read by run(). */
  get scripts(): ReadonlyMap<string, string> {
    return this.#scripts
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
      this.#issue('E_SCRIPT', 'script', `${detail}${scriptHint(detail)}`, Object.freeze({
        column: 0,
        file,
        line: Number(line),
      }))
      return
    }
    this.#issue('E_SCRIPT', 'script', `${message}${scriptHint(message)}`, this.#source())
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

    const prefab = Object.fromEntries(PREFAB_KINDS.map(member => [
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
    const effect = Object.fromEntries(EFFECT_KINDS.map(member => [
      member,
      guard('E_SCHEMA', `sd.effect.${member}`, (value: unknown) => this.#rule(`effect.${member}`, value)),
    ]))
    const intent = Object.fromEntries(EFFECT_KINDS.map(member => [
      member,
      guard('E_SCHEMA', `sd.intent.${member}`, (value: unknown) => this.#intent(`intent.${member}`, value)),
    ]))
    const schema = Object.fromEntries(SCHEMA_KINDS.map(member => [
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
      ...RULE_ALIASES,
      ...ART_ALIASES,
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
    this.#members.set('sd.effect', [...EFFECT_KINDS])
    this.#members.set('sd.intent', [...EFFECT_KINDS])
    this.#members.set('sd.kit', Object.keys(kit))
    this.#members.set('sd.prefab', [...PREFAB_KINDS])
    this.#members.set('sd.rules', [...RULE_ALIASES])
    this.#members.set('sd.schema', [...SCHEMA_KINDS])

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
    if (FILE_LOADING_GLOBALS.has(name)) {
      return `${name} is not available inside Web Lua mods; use sd.include("scripts/file.lua") to split a mod across files`
    }
    if (SANDBOXED_GLOBALS.has(name)) return `${name} is not available inside Web Lua mods`
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
    const assembly = new WebLuaAssembly({
      assets: this.#assets,
      content: this.#contentNodes,
      identity: this.#identity,
      issues: this.#issues,
      rules: this.#rules,
    })
    const { assets, content, rules } = assembly.build(explicit)
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

type SlotResolver = (
  value: string,
  assembly: WebLuaAssembly,
  source: WebLuaDefinitionSource,
) => WebLuaDefinitionValue | null

const contentSlot = (targetKind: WebLuaContentKind): SlotResolver => (value, assembly) => (
  assembly.reference(targetKind, value)
)
const potionOrItemSlot: SlotResolver = (value, assembly) => (
  assembly.reference(assembly.hasLocal('potion', value) ? 'potion' : 'item', value)
)
const localEnemySlot: SlotResolver = (value, assembly) => (
  value.startsWith('stock.') || !assembly.hasLocal('enemy', value) ? null : assembly.reference('enemy', value)
)
const grantSlot: SlotResolver = (value, assembly) => assembly.reference(
  assembly.hasLocal('spell', value) ? 'spell' : assembly.hasLocal('ui', value) ? 'ui' : 'spell',
  value,
)
const soundAssetSlot: SlotResolver = (value, assembly, source) => (
  assembly.declareAutoAsset('sound', { path: value }, source)
)

/** Where a bare string inside content stands for a reference to another definition. */
const CONTENT_REFERENCE_SLOTS: Readonly<Partial<Record<WebLuaContentKind, Readonly<Record<string, SlotResolver>>>>> = {
  'affix-pool': { 'entries[].affix': contentSlot('affix') },
  boneyard: { 'roster[]': localEnemySlot, 'waves[].roster[]': localEnemySlot },
  potion: { status: contentSlot('status') },
  scene: { 'rooms[]': contentSlot('room') },
  shop: { 'services[].pool': contentSlot('affix-pool'), 'stock[].item': potionOrItemSlot },
  skill: {
    'grants[]': grantSlot,
    parent: contentSlot('skill'),
    'prerequisites[]': contentSlot('skill'),
    'ranks[].grant': grantSlot,
    'ranks[].grants[]': grantSlot,
  },
}

/** Where a bare string inside a rule stands for a reference or an asset. */
const RULE_REFERENCE_SLOTS: Readonly<Record<string, Readonly<Record<string, SlotResolver>>>> = {
  'effect.grant': { item: potionOrItemSlot },
  'effect.present': { sound: soundAssetSlot },
  'effect.spawn': { content: contentSlot('powerup'), enemy: localEnemySlot },
  'effect.status': { status: contentSlot('status') },
  'prefab.portal': { destination: contentSlot('scene') },
}

/** Content fields that take one rule node; a plain list there becomes sd.all(...). */
const CONTENT_SINGLE_RULE_FIELDS: Readonly<Partial<Record<WebLuaContentKind, ReadonlySet<string>>>> = {
  item: new Set(['use']),
  potion: new Set(['on_use']),
  powerup: new Set(['effect']),
}

/** Rule fields that take one rule node; a plain list there becomes sd.all(...). */
const RULE_SINGLE_RULE_FIELDS: Readonly<Record<string, ReadonlySet<string>>> = {
  'rules.after': new Set(['node']),
  'rules.every': new Set(['node']),
  'rules.on': new Set(['node']),
  'rules.when': new Set(['no', 'yes']),
}

interface WalkSpec {
  readonly path: string
  readonly singles: ReadonlySet<string> | null
  readonly slots: Readonly<Record<string, SlotResolver>> | null
  readonly source: WebLuaDefinitionSource
}

interface AssemblyInput {
  readonly assets: ReadonlyMap<number, WebLuaAssetDefinition>
  readonly content: ReadonlyMap<number, WebLuaContentDefinition>
  readonly identity: WebLuaModIdentity
  readonly issues: WebLuaDefinitionIssue[]
  readonly rules: ReadonlyMap<number, WebLuaRuleDefinition>
}

/**
 * Turns the creation-order registry plus the optional sd.mod lists into the
 * explicit 1.0 graph: keys every asset, lowers nested tokens and bare strings
 * to references, wraps loose lists, and attaches free rules.
 */
class WebLuaAssembly {
  readonly #input: AssemblyInput
  readonly #assets: WebLuaAssetDefinition[] = []
  readonly #assetKeys = new Map<number, string>()
  readonly #assetsByKey = new Map<string, string>()
  readonly #assetsByShape = new Map<string, string>()
  readonly #consumed = new Set<number>()
  readonly #local = new Map<string, WebLuaContentDefinition>()

  constructor(input: AssemblyInput) {
    this.#input = input
  }

  build(explicit: ExplicitLists | null): Readonly<{
    assets: WebLuaAssetDefinition[]
    content: WebLuaContentDefinition[]
    rules: WebLuaRuleDefinition[]
  }> {
    for (const { key, node } of explicit?.assets ?? []) this.#declareAsset(node, key)
    for (const node of this.#input.assets.keys()) this.#declareAsset(node, '')

    const contentNodes: number[] = []
    const seen = new Set<number>()
    for (const node of [...(explicit?.content ?? []), ...this.#input.content.keys()]) {
      if (seen.has(node)) continue
      seen.add(node)
      contentNodes.push(node)
    }
    for (const node of contentNodes) {
      const definition = this.#input.content.get(node) as WebLuaContentDefinition
      const id = `${definition.contentKind}:${definition.key}`
      if (!this.#local.has(id)) this.#local.set(id, definition)
    }
    const content = contentNodes.map(node => (
      this.#lowerContent(this.#input.content.get(node) as WebLuaContentDefinition)
    ))

    const rules: WebLuaRuleDefinition[] = []
    const roots = new Set<number>()
    for (const node of explicit?.rules ?? []) {
      if (roots.has(node)) continue
      roots.add(node)
      rules.push(this.#lowerRule(this.#input.rules.get(node) as WebLuaRuleDefinition, 'rules'))
    }
    for (const [node, rule] of this.#input.rules) {
      if (roots.has(node) || this.#consumed.has(node) || rule.operation !== 'rules.on') continue
      roots.add(node)
      rules.push(this.#lowerRule(rule, 'rules'))
    }
    for (const [node, rule] of this.#input.rules) {
      if (roots.has(node) || this.#consumed.has(node)) continue
      this.#issue(
        'E_GRAPH',
        'rules',
        `${luaRuleName(rule.operation)} was created but never attached to anything; put it inside sd.on(event, ...), a potion's on_use, or another rule, or list it under sd.mod rules`,
        rule.source,
      )
    }
    return { assets: this.#assets, content, rules }
  }

  hasLocal(kind: WebLuaContentKind, key: string): boolean {
    return this.#local.has(`${kind}:${key}`)
  }

  reference(targetKind: WebLuaContentKind, key: string): WebLuaContentReference {
    return Object.freeze({
      key,
      kind: 'content-reference',
      modId: this.#input.identity.id,
      targetKind,
    })
  }

  declareAutoAsset(
    assetKind: WebLuaAssetKind,
    fields: Record<string, WebLuaDefinitionValue>,
    source: WebLuaDefinitionSource,
  ): WebLuaAssetReference {
    const frozen = Object.freeze({ ...fields })
    const shape = assetShape(assetKind, frozen)
    const existing = this.#assetsByShape.get(shape)
    if (existing !== undefined) return Object.freeze({ key: existing, kind: 'asset-reference' })
    const key = this.#deriveAssetKey(assetKind, frozen)
    this.#pushAsset(Object.freeze({
      assetKind,
      fields: frozen,
      key,
      kind: 'asset-definition',
      source: withoutNode(source),
    }), shape)
    return Object.freeze({ key, kind: 'asset-reference' })
  }

  #declareAsset(node: number, requestedKey: string): void {
    if (this.#assetKeys.has(node)) return
    const definition = this.#input.assets.get(node)
    if (!definition) return
    const shape = assetShape(definition.assetKind, definition.fields)
    let key = requestedKey || definition.key
    if (!key) {
      const existing = this.#assetsByShape.get(shape)
      if (existing !== undefined) {
        this.#assetKeys.set(node, existing)
        return
      }
      key = this.#deriveAssetKey(definition.assetKind, definition.fields)
    } else {
      const existingShape = this.#assetsByKey.get(key)
      if (existingShape !== undefined) {
        if (existingShape !== shape) {
          this.#issue(
            'E_DUPLICATE',
            `assets.${key}`,
            `two different assets use the key ${key}; give one of them another key`,
            definition.source,
          )
        }
        this.#assetKeys.set(node, key)
        return
      }
    }
    this.#assetKeys.set(node, key)
    this.#pushAsset(Object.freeze({
      assetKind: definition.assetKind,
      fields: definition.fields,
      key,
      kind: 'asset-definition',
      source: definition.source,
    }), shape)
  }

  #pushAsset(definition: WebLuaAssetDefinition, shape: string): void {
    this.#assets.push(definition)
    this.#assetsByKey.set(definition.key, shape)
    if (!this.#assetsByShape.has(shape)) this.#assetsByShape.set(shape, definition.key)
  }

  #deriveAssetKey(assetKind: WebLuaAssetKind, fields: Readonly<Record<string, WebLuaDefinitionValue>>): string {
    const path = typeof fields.image === 'string'
      ? fields.image
      : typeof fields.path === 'string' ? fields.path : ''
    const base = path.split('/').pop() ?? ''
    const stem = base.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 96)
    const root = stem || assetKind
    const candidates = [root, `${root}.${assetKind}`]
    for (const candidate of candidates) {
      if (!this.#assetsByKey.has(candidate)) return candidate
    }
    for (let ordinal = 2; ; ordinal += 1) {
      const candidate = `${root}.${assetKind}.${ordinal}`
      if (!this.#assetsByKey.has(candidate)) return candidate
    }
  }

  #assetReference(token: Record<string, unknown>, path: string, source: WebLuaDefinitionSource): WebLuaAssetReference {
    const node = isRecord(token.source) ? token.source.node : undefined
    const key = typeof node === 'number' ? this.#assetKeys.get(node) : undefined
    if (key === undefined) {
      this.#issue('E_REFERENCE', path, 'this asset was not created by sd.art inside this script', source)
      return Object.freeze({ key: typeof token.key === 'string' ? token.key : '', kind: 'asset-reference' })
    }
    return Object.freeze({ key, kind: 'asset-reference' })
  }

  #contentReference(token: Record<string, unknown>, path: string, source: WebLuaDefinitionSource): WebLuaDefinitionValue {
    const targetKind = token.contentKind
    if (typeof targetKind !== 'string' || !contentKinds.has(targetKind) || typeof token.key !== 'string') {
      this.#issue('E_REFERENCE', path, 'this content token was not created by sd.kit inside this script', source)
      return null
    }
    return this.reference(targetKind as WebLuaContentKind, token.key)
  }

  #lowerContent(definition: WebLuaContentDefinition): WebLuaContentDefinition {
    const kind = definition.contentKind
    const path = `content.${definition.key}`
    const fields: Record<string, WebLuaDefinitionValue> = { ...definition.fields }
    const schemaFields = new Set<string>(WEB_LUA_CONTENT_SCHEMA_FIELDS[kind].allowed)
    const art: Record<string, WebLuaDefinitionValue> = isRecord(fields.art) ? { ...fields.art } : {}
    let artTouched = false
    for (const slot of WEB_LUA_CONTENT_ART_SLOTS[kind]) {
      if (schemaFields.has(slot) || !(slot in fields)) continue
      if (art[slot] !== undefined) {
        this.#issue('E_SCHEMA', `${path}.${slot}`, `${slot} is set both at the top level and inside art; keep one of them`, definition.source)
      }
      art[slot] = fields[slot]
      delete fields[slot]
      artTouched = true
    }
    if (kind === 'boneyard' && typeof fields.source === 'string' && art.layout === undefined) {
      art.layout = fields.source
      artTouched = true
    }
    if (artTouched || isRecord(fields.art)) {
      for (const [slot, value] of Object.entries(art)) {
        if (typeof value === 'string') {
          const lowered = this.#artAssetFromPath(kind, slot, value, `${path}.art.${slot}`, definition.source)
          if (lowered) art[slot] = lowered
        } else if (isToken(value, 'asset-definition')) {
          art[slot] = this.#assetReference(value, `${path}.art.${slot}`, definition.source)
        }
      }
      fields.art = art
    }
    const spec: WalkSpec = {
      path,
      singles: CONTENT_SINGLE_RULE_FIELDS[kind] ?? null,
      slots: CONTENT_REFERENCE_SLOTS[kind] ?? null,
      source: definition.source,
    }
    const lowered: Record<string, WebLuaDefinitionValue> = {}
    for (const [field, value] of Object.entries(fields)) {
      lowered[field] = field === 'art' ? value : this.#lowerValue(value, [field], spec)
    }
    if (kind === 'potion') {
      const status = lowered.status
      if (isToken(status, 'content-reference') && status.targetKind === 'status' && typeof status.key === 'string') {
        if (lowered.on_use === undefined) {
          lowered.on_use = syntheticRule('effect.status', { status, target: 'user' }, definition.source)
        }
        const local = this.#local.get(`status:${status.key}`)
        if (lowered.duration === undefined && local && local.fields.duration !== undefined) {
          lowered.duration = local.fields.duration
        }
      }
    }
    return Object.freeze({
      contentKind: kind,
      fields: Object.freeze(lowered),
      key: definition.key,
      kind: 'content-definition',
      source: definition.source,
    })
  }

  #artAssetFromPath(
    kind: WebLuaContentKind,
    slot: string,
    value: string,
    path: string,
    source: WebLuaDefinitionSource,
  ): WebLuaAssetReference | null {
    switch (slot) {
      case 'atlas':
        this.#issue(
          'E_SCHEMA',
          path,
          `${kind} atlas needs sd.sheet(path, {frame = {width = ..., height = ...}, animations = {...}}) so the game knows its animation frames`,
          source,
        )
        return null
      case 'worn':
      case 'worn_trim':
        return this.declareAutoAsset('sheet', {
          animations: { wearable: [1] },
          frame: { height: 170, width: 170 },
          image: value,
        }, source)
      case 'sound':
      case 'attack_sound':
      case 'death_sound':
        return this.declareAutoAsset('sound', { path: value }, source)
      case 'ambience':
      case 'loop':
      case 'music':
        return this.declareAutoAsset('music', { path: value }, source)
      case 'layout':
        return this.declareAutoAsset(value.endsWith('.boneyard') ? 'boneyard' : 'scene', { path: value }, source)
      default:
        return this.declareAutoAsset('sprite', { path: value }, source)
    }
  }

  #lowerRule(token: object, path: string): WebLuaRuleDefinition {
    const rule = token as Record<string, unknown>
    const source = isRecord(rule.source) ? rule.source as unknown as WebLuaDefinitionSource : undefined
    if (source && typeof source.node === 'number') this.#consumed.add(source.node)
    const operation = typeof rule.operation === 'string' ? rule.operation : ''
    const spec: WalkSpec = {
      path,
      singles: RULE_SINGLE_RULE_FIELDS[operation] ?? null,
      slots: RULE_REFERENCE_SLOTS[operation] ?? null,
      source: source ?? Object.freeze({ column: 0, file: '', line: 0 }),
    }
    const fields: Record<string, WebLuaDefinitionValue> = {}
    for (const [field, value] of Object.entries(isRecord(rule.fields) ? rule.fields : {})) {
      fields[field] = this.#lowerValue(value as WebLuaDefinitionValue, [field], spec)
    }
    return Object.freeze({
      fields: Object.freeze(fields),
      kind: 'rule-definition',
      operation,
      source: spec.source,
    })
  }

  #lowerValue(value: WebLuaDefinitionValue, segments: readonly string[], spec: WalkSpec): WebLuaDefinitionValue {
    const slot = slotKey(segments)
    if (isToken(value, 'content-definition')) return this.#contentReference(value, `${spec.path}.${slot}`, spec.source)
    if (isToken(value, 'asset-definition')) return this.#assetReference(value, `${spec.path}.${slot}`, spec.source)
    if (isToken(value, 'rule-definition')) return this.#lowerRule(value, `${spec.path}.${slot}`)
    if (typeof value === 'string') {
      const resolve = spec.slots?.[slot]
      if (resolve) {
        const lowered = resolve(value, this, spec.source)
        if (lowered !== null) return lowered
      }
      return value
    }
    if (Array.isArray(value)) {
      if (spec.singles?.has(slot) && value.length > 0 && value.every(entry => isToken(entry, 'rule-definition'))) {
        return this.#lowerRule(
          syntheticRule('rules.all', { nodes: value as unknown as WebLuaDefinitionValue }, spec.source),
          `${spec.path}.${slot}`,
        )
      }
      return value.map(entry => this.#lowerValue(entry, [...segments, '[]'], spec))
    }
    if (isRecord(value)) {
      const lowered: Record<string, WebLuaDefinitionValue> = {}
      for (const [key, entry] of Object.entries(value)) {
        lowered[key] = this.#lowerValue(entry, [...segments, key], spec)
      }
      return lowered
    }
    return value
  }

  #issue(
    code: WebLuaDefinitionErrorCode,
    path: string,
    message: string,
    source: WebLuaDefinitionSource,
  ): void {
    this.#input.issues.push(webLuaDefinitionIssue(code, path, message, { source: withoutNode(source) }))
  }
}

function syntheticRule(
  operation: string,
  fields: Record<string, WebLuaDefinitionValue>,
  source: WebLuaDefinitionSource,
): WebLuaRuleDefinition {
  return Object.freeze({
    fields: Object.freeze(fields),
    kind: 'rule-definition',
    operation,
    source: withoutNode(source),
  })
}

function withoutNode(source: WebLuaDefinitionSource): WebLuaDefinitionSource {
  return Object.freeze({ column: source.column, file: source.file, line: source.line })
}

function assetShape(assetKind: string, fields: Readonly<Record<string, WebLuaDefinitionValue>>): string {
  return `${assetKind}\n${canonicalText(fields)}`
}

function canonicalText(value: WebLuaDefinitionValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalText).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalText(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function slotKey(segments: readonly string[]): string {
  let key = ''
  for (const segment of segments) {
    if (segment === '[]') key += '[]'
    else key += key ? `.${segment}` : segment
  }
  return key
}

function luaRuleName(operation: string): string {
  if (operation.startsWith('rules.')) return `sd.${operation.slice('rules.'.length)}`
  return `sd.${operation}`
}

function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function scriptHint(message: string): string {
  for (const [pattern, hint] of SCRIPT_HINTS) {
    if (pattern.test(message)) return `; ${hint}`
  }
  return ''
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
  if (unknown.length > 0) {
    const hints = unknown
      .map(key => didYouMean(key, keys))
      .filter(hint => hint.length > 0)
    throw new Error(`${field} contains unknown fields: ${unknown.join(', ')}${hints[0] ?? ''}`)
  }
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
local getinfo = debug.getinfo
local load_chunk = load
local site = __sd_site
local unknown_member = __sd_unknown_member
local unknown_global = __sd_unknown_global
local include_begin = __sd_include_begin
local include_end = __sd_include_end
local submit_reducer_result = __sd_submit_reducer_result
local pairs, ipairs, type, error, setmetatable, pcall, tostring = pairs, ipairs, type, error, setmetatable, pcall, tostring
local globals = _G

local function locate()
  local info = getinfo(3, "Sl")
  if info then site(info.source, info.currentline) else site(nil, 0) end
end

local function located(fn)
  return function(...)
    locate()
    return fn(...)
  end
end

local function wrap_namespace(namespace)
  for name, member in pairs(namespace) do
    if type(member) == "function" then namespace[name] = located(member) end
  end
end

wrap_namespace(sd.art)
wrap_namespace(sd.kit)
wrap_namespace(sd.rules)
wrap_namespace(sd.effect)
wrap_namespace(sd.intent)
wrap_namespace(sd.prefab)
wrap_namespace(sd.schema)
sd.mod = located(sd.mod)
sd.ref = located(sd.ref)

local register_reducer = sd.advanced.reducer
sd.advanced.reducer = function(spec)
  locate()
  if type(spec) == "table" and type(spec.reduce) == "function" then
    local reduce = spec.reduce
    spec.reduce = function(state, event, context)
      local next_state, intents = reduce(state, event, context)
      submit_reducer_result(next_state, intents)
    end
  end
  return register_reducer(spec)
end

for name, member in pairs(sd.kit) do sd[name] = member end
for _, name in ipairs({"on", "all", "first", "when", "after", "every"}) do sd[name] = sd.rules[name] end
for _, name in ipairs({"sprite", "sheet", "sound", "music", "wearable"}) do sd[name] = sd.art[name] end

local include_values = {}
sd.include = function(path)
  locate()
  local plan = include_begin(path)
  if plan.status == "cached" then
    local entry = include_values[path]
    return entry and entry.value
  end
  local chunk, message = load_chunk(plan.text, "@" .. path, "t", globals)
  if not chunk then
    include_end(path, false)
    error(message, 0)
  end
  local ok, result = pcall(chunk)
  include_end(path, ok)
  if not ok then error(result, 0) end
  include_values[path] = {value = result}
  return result
end

local function lock(namespace, label)
  setmetatable(namespace, {
    __index = function(_, key) error(unknown_member(label, key), 2) end,
    __newindex = function(_, key)
      error(label .. "." .. tostring(key) .. " cannot be assigned; Web Lua names are read-only", 2)
    end,
  })
end
lock(sd.advanced, "sd.advanced")
lock(sd.art, "sd.art")
lock(sd.effect, "sd.effect")
lock(sd.intent, "sd.intent")
lock(sd.kit, "sd.kit")
lock(sd.prefab, "sd.prefab")
lock(sd.rules, "sd.rules")
lock(sd.schema, "sd.schema")
lock(sd, "sd")

setmetatable(globals, {
  __index = function(_, key)
    local names = {}
    for name in pairs(globals) do names[#names + 1] = name end
    error(unknown_global(key, names), 2)
  end,
})

__sd_site = nil
__sd_unknown_member = nil
__sd_unknown_global = nil
__sd_include_begin = nil
__sd_include_end = nil
__sd_submit_reducer_result = nil
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

function luaPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(luaPayload)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== null && child !== undefined)
    .map(([key, child]) => [key, luaPayload(child)]))
}

function cloneRuntimeValue(value: unknown, field: string): unknown {
  const seen = new WeakSet<object>()
  let nodes = 0
  const clone = (candidate: unknown, path: string, depth: number): unknown => {
    nodes += 1
    if (nodes > 65_536) throw new Error(`${field} exceeds its node limit`)
    if (depth > 32) throw new Error(`${path} exceeds its nesting limit`)
    if (candidate === undefined || candidate === null) return null
    if (typeof candidate === 'boolean' || typeof candidate === 'string') return candidate
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new Error(`${path} must be finite`)
      return candidate
    }
    if (typeof candidate === 'function') throw new Error(`${path} may not contain a function`)
    if (typeof candidate !== 'object') throw new Error(`${path} contains unsupported data`)
    if (seen.has(candidate)) throw new Error(`${path} is cyclic`)
    seen.add(candidate)
    try {
      if (Array.isArray(candidate)) {
        return candidate.map((entry, index) => clone(entry, `${path}[${index}]`, depth + 1))
      }
      return Object.fromEntries(Object.entries(candidate).map(([key, entry]) => [
        key,
        clone(entry, `${path}.${key}`, depth + 1),
      ]))
    } finally {
      seen.delete(candidate)
    }
  }
  return clone(value, field, 0)
}

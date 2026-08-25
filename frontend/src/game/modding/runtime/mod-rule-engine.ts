import type { LuaConsoleObject, LuaConsoleValue } from '../../protocol/game-protocol.ts'
import type {
  CompiledWebLuaMod,
  WebLuaDefinitionRuntime,
  WebLuaIntentDefinition,
  WebLuaRuleDefinition,
} from '../definition/index.ts'
import {
  ModLifecycleSupervisor,
  type ModLifecycleScope,
} from './mod-lifecycle-supervisor.ts'
import {
  ModStateStore,
  validateSchemaValue,
  type ModStateCheckpoint,
  type ModStateScope,
} from './mod-state-store.ts'

const MAXIMUM_INVOCATIONS_PER_TICK = 64
const MAXIMUM_INTENTS_PER_DISPATCH = 256
const DEFAULT_TICK_BUDGET_MS = 4
const DEFAULT_FAILURE_THRESHOLD = 3

export interface ModIntent {
  readonly fields: LuaConsoleObject
  readonly kind: string
  readonly modId: string
  readonly owner: string
  readonly scope: ModStateScope
  readonly sequence: number
}

export interface ModRuleDispatchInput {
  readonly context: LuaConsoleObject
  readonly event: string
  readonly payload: LuaConsoleValue
  readonly scope: ModStateScope
  readonly tick: number
}

export interface ModRuleDispatchResult {
  readonly budgetExceeded: boolean
  readonly errors: readonly string[]
  readonly intents: readonly ModIntent[]
  readonly invocations: number
}

interface RegisteredMod {
  readonly compiled: CompiledWebLuaMod
  readonly reducers: readonly RegisteredReducer[]
  readonly root: ModLifecycleScope
  readonly rules: readonly WebLuaRuleDefinition[]
  readonly runtime: WebLuaDefinitionRuntime
}

interface RegisteredReducer {
  disabled: boolean
  failures: number
  readonly key: string
  readonly scope: ModLifecycleScope
}

export class ModRuleEngine {
  readonly #failureThreshold: number
  readonly #lifecycle: ModLifecycleSupervisor
  readonly #mods = new Map<string, RegisteredMod>()
  readonly #now: () => number
  readonly #state: ModStateStore
  readonly #tickBudgetMs: number
  #nextIntentSequence = 1

  constructor(options: Readonly<{
    failureThreshold?: number
    lifecycle?: ModLifecycleSupervisor
    now?: () => number
    state?: ModStateStore
    tickBudgetMs?: number
  }> = {}) {
    this.#failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD
    this.#lifecycle = options.lifecycle ?? new ModLifecycleSupervisor()
    this.#now = options.now ?? performance.now.bind(performance)
    this.#state = options.state ?? new ModStateStore()
    this.#tickBudgetMs = options.tickBudgetMs ?? DEFAULT_TICK_BUDGET_MS
  }

  get state(): ModStateStore {
    return this.#state
  }

  register(compiled: CompiledWebLuaMod, runtime: WebLuaDefinitionRuntime): void {
    const modId = compiled.identity.id
    if (this.#mods.has(modId)) throw new Error(`mod rule engine already registered ${modId}`)
    for (const reducer of compiled.reducers) {
      if (!runtime.reducer(reducer.key)) {
        throw new Error(`compiled reducer has no live callback: ${modId}:${reducer.key}`)
      }
    }
    const root = this.#lifecycle.root(modId)
    root.own('subscription', 'definition-runtime', () => runtime.close())
    const reducers = compiled.reducers.map(reducer => ({
      disabled: false,
      failures: 0,
      key: reducer.key,
      scope: root.child('subscription', `reducer.${reducer.key}`),
    }))
    this.#mods.set(modId, {
      compiled,
      reducers,
      root,
      rules: Object.freeze([...compiled.rules, ...contentRules(compiled)]),
      runtime,
    })
  }

  restore(checkpoint: ModStateCheckpoint): void {
    const definitions = [...this.#mods.values()].flatMap(mod => mod.reducers.map((reducer) => {
      const registration = mod.runtime.reducer(reducer.key)!
      return {
        key: reducer.key,
        modId: mod.compiled.identity.id,
        schema: registration.state,
        schemaVersion: registration.schemaVersion,
        scope: registration.scope,
      }
    }))
    this.#state.restore(checkpoint, definitions)
    this.#state.rollback(checkpoint)
  }

  dispatch(input: ModRuleDispatchInput): ModRuleDispatchResult {
    if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new Error('mod rule tick is invalid')
    const startedAt = this.#now()
    const errors: string[] = []
    const intents: ModIntent[] = []
    let budgetExceeded = false
    let invocations = 0
    const append = (values: readonly ModIntent[]): void => {
      if (intents.length + values.length > MAXIMUM_INTENTS_PER_DISPATCH) {
        throw new Error('mod intent limit reached for one dispatch')
      }
      intents.push(...values)
    }
    for (const mod of [...this.#mods.values()].sort((left, right) => (
      left.compiled.identity.id.localeCompare(right.compiled.identity.id)
    ))) {
      try {
        append(evaluateRules(
          mod.compiled.identity.id,
          mod.rules,
          input,
          () => this.#nextIntentSequence++,
        ))
      } catch (error) {
        errors.push(`${mod.compiled.identity.id}:rules: ${message(error)}`)
      }
      for (const reducer of mod.reducers) {
        const definition = mod.compiled.reducers.find(candidate => candidate.key === reducer.key)!
        if (
          reducer.disabled
          || !definition.on.includes(input.event)
          || definition.scope !== input.scope.kind
        ) continue
        if (invocations >= MAXIMUM_INVOCATIONS_PER_TICK || this.#now() - startedAt > this.#tickBudgetMs) {
          budgetExceeded = true
          break
        }
        invocations += 1
        const registration = mod.runtime.reducer(reducer.key)!
        const cell = this.#state.cell({
          key: reducer.key,
          modId: mod.compiled.identity.id,
          schema: registration.state,
          schemaVersion: registration.schemaVersion,
          scope: registration.scope,
        }, input.scope)
        try {
          const random = namedRandom(
            mod.compiled.identity.id,
            reducer.key,
            input.scope,
            input.event,
            input.tick,
          )
          const result = mod.runtime.invokeReducer(
            reducer.key,
            cell.get(),
            input.payload,
            { ...input.context, random, tick: input.tick },
          )
          const nextState = validateSchemaValue(
            registration.state,
            result.state as LuaConsoleValue,
            `${mod.compiled.identity.id}:${reducer.key} state`,
          )
          const nextIntents = normalizeReducerIntents(
            mod.compiled.identity.id,
            reducer.key,
            input.scope,
            result.intents,
            () => this.#nextIntentSequence++,
          )
          if (intents.length + nextIntents.length > MAXIMUM_INTENTS_PER_DISPATCH) {
            throw new Error('mod intent limit reached for one dispatch')
          }
          cell.set(nextState)
          intents.push(...nextIntents)
          reducer.failures = 0
        } catch (error) {
          reducer.failures += 1
          errors.push(`${mod.compiled.identity.id}:${reducer.key}: ${message(error)}`)
          if (reducer.failures >= this.#failureThreshold) {
            reducer.disabled = true
            reducer.scope.close('reducer-circuit-open')
          }
        }
      }
      if (budgetExceeded) break
    }
    return Object.freeze({
      budgetExceeded,
      errors: Object.freeze(errors),
      intents: Object.freeze(intents),
      invocations,
    })
  }

  diagnostic(modId: string, reducerKey: string): Readonly<{
    disabled: boolean
    failures: number
  }> | null {
    const reducer = this.#mods.get(modId)?.reducers.find(candidate => candidate.key === reducerKey)
    return reducer ? Object.freeze({ disabled: reducer.disabled, failures: reducer.failures }) : null
  }

  closeMod(modId: string, reason = 'mod-unloaded'): boolean {
    const mod = this.#mods.get(modId)
    if (!mod) return false
    this.#mods.delete(modId)
    mod.root.close(reason)
    return true
  }

  close(): void {
    for (const modId of [...this.#mods.keys()]) this.closeMod(modId, 'rule-engine-closed')
    this.#state.close()
  }
}

function contentRules(compiled: CompiledWebLuaMod): readonly WebLuaRuleDefinition[] {
  return compiled.content.flatMap((content): WebLuaRuleDefinition[] => {
    const trigger = content.contentKind === 'potion'
      ? 'use'
      : content.contentKind === 'item'
        ? 'use'
        : content.contentKind === 'powerup'
          ? 'pickup'
          : content.contentKind === 'spell'
            ? 'cast'
          : null
    const node = content.contentKind === 'potion'
      ? content.fields.on_use
      : content.contentKind === 'item'
        ? content.fields.use
          : content.contentKind === 'powerup'
            ? content.fields.effect
            : content.contentKind === 'spell'
              ? content.fields.behavior
            : null
    if (!trigger || !isRule(node)) return []
    return [Object.freeze({
      fields: Object.freeze({
        event: `action.content.${trigger}.${content.contentId}`,
        node,
      }),
      kind: 'rule-definition' as const,
      operation: 'rules.on',
      source: node.source,
    })]
  })
}

function evaluateRules(
  modId: string,
  rules: readonly WebLuaRuleDefinition[],
  input: ModRuleDispatchInput,
  sequence: () => number,
): readonly ModIntent[] {
  return rules.flatMap(rule => evaluateRule(modId, rule, input, sequence))
}

function evaluateRule(
  modId: string,
  rule: WebLuaRuleDefinition,
  input: ModRuleDispatchInput,
  sequence: () => number,
): readonly ModIntent[] {
  switch (rule.operation) {
    case 'rules.on': {
      if (rule.fields.event !== input.event) return []
      const node = rule.fields.node ?? rule.fields.effect
      return isRule(node) ? evaluateRule(modId, node, input, sequence) : []
    }
    case 'rules.all':
      return ruleNodes(rule, 'nodes').flatMap(node => evaluateRule(modId, node, input, sequence))
    case 'rules.first':
      for (const node of ruleNodes(rule, 'nodes')) {
        const values = evaluateRule(modId, node, input, sequence)
        if (values.length > 0) return values
      }
      return []
    case 'rules.when': {
      const selected = predicate(rule.fields.predicate, input)
        ? rule.fields.yes
        : rule.fields.no
      return isRule(selected) ? evaluateRule(modId, selected, input, sequence) : []
    }
    case 'rules.after':
    case 'rules.every':
      return [intent(modId, rule.operation, rule.fields, 'rule', input.scope, sequence())]
    case 'prefab.area': {
      const effects = Array.isArray(rule.fields.effects)
        ? rule.fields.effects.filter(isRule).flatMap(effect => evaluateRule(modId, effect, input, sequence))
        : []
      return [intent(modId, 'present', { prefab: 'area', ...rule.fields }, 'rule', input.scope, sequence()), ...effects]
    }
    default:
      return rule.operation.startsWith('effect.')
        ? [intent(modId, rule.operation.slice('effect.'.length), rule.fields, 'rule', input.scope, sequence())]
        : []
  }
}

function normalizeReducerIntents(
  modId: string,
  reducerKey: string,
  scope: ModStateScope,
  value: unknown,
  sequence: () => number,
): readonly ModIntent[] {
  const values = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Object.keys(value).length === 0
      ? []
      : [value]
  if (values.length > 64) throw new Error('advanced reducer returned more than 64 intents')
  return values.map((value, index) => {
    if (!isIntent(value)) throw new Error(`advanced reducer intent ${index} is invalid`)
    return intent(modId, value.intentKind, value.fields, reducerKey, scope, sequence())
  })
}

function intent(
  modId: string,
  kind: string,
  fields: unknown,
  owner: string,
  scope: ModStateScope,
  sequence: number,
): ModIntent {
  return Object.freeze({
    fields: normalizeObject(fields, `${modId}:${owner} ${kind} intent`),
    kind,
    modId,
    owner,
    scope: Object.freeze({ ...scope }),
    sequence,
  })
}

function predicate(value: unknown, input: ModRuleDispatchInput): boolean {
  if (typeof value === 'boolean') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const source = value as Record<string, unknown>
  if (typeof source.event === 'string') return source.event === input.event
  if (typeof source.context === 'string') return Boolean(input.context[source.context])
  return false
}

function ruleNodes(rule: WebLuaRuleDefinition, field: string): readonly WebLuaRuleDefinition[] {
  const values = rule.fields[field]
  if (!Array.isArray(values) || !values.every(isRule)) throw new Error(`${rule.operation} has invalid nodes`)
  return values
}

function isRule(value: unknown): value is WebLuaRuleDefinition {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'rule-definition')
}

function isIntent(value: unknown): value is WebLuaIntentDefinition {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === 'intent-definition' &&
    typeof (value as { intentKind?: unknown }).intentKind === 'string')
}

function normalizeObject(value: unknown, field: string): LuaConsoleObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} fields must be an object`)
  }
  return normalizeValue(value, field) as LuaConsoleObject
}

function normalizeValue(value: unknown, field: string, depth = 0): LuaConsoleValue {
  if (depth > 32) throw new Error(`${field} exceeds its depth limit`)
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${field} must be finite`)
    return value
  }
  if (Array.isArray(value)) return value.map((entry, index) => normalizeValue(entry, `${field}[${index}]`, depth + 1))
  if (typeof value !== 'object') throw new Error(`${field} contains unsupported data`)
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    normalizeValue(child, `${field}.${key}`, depth + 1),
  ]))
}

function namedRandom(
  modId: string,
  reducerKey: string,
  scope: ModStateScope,
  event: string,
  tick: number,
): (name: unknown) => number {
  const counters = new Map<string, number>()
  return (name: unknown) => {
    if (typeof name !== 'string' || name.length === 0 || name.length > 128) {
      throw new Error('named random stream requires 1..128 text characters')
    }
    const counter = counters.get(name) ?? 0
    counters.set(name, counter + 1)
    let hash = 0x811c9dc5
    const input = `${modId}\0${reducerKey}\0${scope.kind}\0${scope.id}\0${event}\0${tick}\0${name}\0${counter}`
    for (const byte of new TextEncoder().encode(input)) {
      hash ^= byte
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash / 0x1_0000_0000
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

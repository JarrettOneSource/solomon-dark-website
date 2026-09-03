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
const MAXIMUM_TIMERS = 256
const DEFAULT_TICK_BUDGET_MS = 4
const DEFAULT_FAILURE_THRESHOLD = 3
const DEFAULT_TICKS_PER_SECOND = 100
const MAXIMUM_REDUCER_TRACES = 256

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

export interface ModRuleTimerCheckpoint {
  readonly context: LuaConsoleObject
  readonly dueTick: number
  readonly event: string
  readonly id: number
  readonly intervalTicks: number | null
  readonly modId: string
  readonly nodeId: string
  readonly payload: LuaConsoleValue
  readonly remaining: number
  readonly scope: ModStateScope
}

export interface ModRuleEngineCheckpoint {
  readonly nextIntentSequence: number
  readonly nextTimerId: number
  readonly reducerHealth: readonly ModReducerHealthCheckpoint[]
  readonly state: ModStateCheckpoint
  readonly timers: readonly ModRuleTimerCheckpoint[]
}

export interface ModReducerHealthCheckpoint {
  readonly disabled: boolean
  readonly failures: number
  readonly key: string
  readonly modId: string
}

export interface ModReducerTrace {
  readonly disabled: boolean
  readonly error: string | null
  readonly event: string
  readonly failures: number
  readonly intents: number
  readonly key: string
  readonly modId: string
  readonly outcome: 'error' | 'ok'
  readonly scope: ModStateScope
  readonly tick: number
}

export interface ModScheduledRuleResult {
  readonly context: LuaConsoleObject
  readonly result: ModRuleDispatchResult
  readonly scope: ModStateScope
}

interface RegisteredMod {
  readonly compiled: CompiledWebLuaMod
  readonly reducers: readonly RegisteredReducer[]
  readonly root: ModLifecycleScope
  readonly rules: readonly WebLuaRuleDefinition[]
  readonly rulesById: ReadonlyMap<string, WebLuaRuleDefinition>
  readonly ruleIds: ReadonlyMap<WebLuaRuleDefinition, string>
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
  readonly #ticksPerSecond: number
  #nextIntentSequence = 1
  #nextTimerId = 1
  #timers: ModRuleTimerCheckpoint[] = []
  #traces: ModReducerTrace[] = []

  constructor(options: Readonly<{
    failureThreshold?: number
    lifecycle?: ModLifecycleSupervisor
    now?: () => number
    state?: ModStateStore
    tickBudgetMs?: number
    ticksPerSecond?: number
  }> = {}) {
    this.#failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD
    this.#lifecycle = options.lifecycle ?? new ModLifecycleSupervisor()
    this.#now = options.now ?? performance.now.bind(performance)
    this.#state = options.state ?? new ModStateStore()
    this.#tickBudgetMs = options.tickBudgetMs ?? DEFAULT_TICK_BUDGET_MS
    this.#ticksPerSecond = options.ticksPerSecond ?? DEFAULT_TICKS_PER_SECOND
    if (!Number.isSafeInteger(this.#ticksPerSecond) || this.#ticksPerSecond < 1) {
      throw new Error('mod rule tick rate is invalid')
    }
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
    const rules = Object.freeze([...compiled.rules, ...contentRules(compiled)])
    const index = indexRules(rules)
    this.#mods.set(modId, {
      compiled,
      reducers,
      root,
      rules,
      rulesById: index.byId,
      ruleIds: index.ids,
      runtime,
    })
  }

  checkpoint(): ModRuleEngineCheckpoint {
    return Object.freeze({
      nextIntentSequence: this.#nextIntentSequence,
      nextTimerId: this.#nextTimerId,
      reducerHealth: this.reducerDiagnostics(),
      state: this.#state.snapshot(),
      timers: Object.freeze(this.#timers.map(timer => freezeTimer(timer))),
    })
  }

  restore(checkpoint: ModRuleEngineCheckpoint): void {
    const definitions = [...this.#mods.values()].flatMap(mod => mod.reducers.map((reducer) => {
      const registration = mod.runtime.reducer(reducer.key)!
      const migrations = Object.fromEntries(Object.keys(registration.migrations).map((version) => [
        Number(version),
        (value: LuaConsoleValue) => mod.runtime.invokeMigration(reducer.key, Number(version), value) as LuaConsoleValue,
      ]))
      return {
        key: reducer.key,
        migrations,
        modId: mod.compiled.identity.id,
        schema: registration.state,
        schemaVersion: registration.schemaVersion,
        scope: registration.scope,
      }
    }))
    this.#state.restore(checkpoint.state, definitions)
    this.#restoreTimers(checkpoint)
    this.#restoreReducerHealth(checkpoint.reducerHealth)
  }

  rollback(checkpoint: ModRuleEngineCheckpoint): void {
    this.#state.rollback(checkpoint.state)
    this.#restoreTimers(checkpoint)
    this.#restoreReducerHealth(checkpoint.reducerHealth)
  }

  dueTimerIds(tick: number): readonly number[] {
    validateTick(tick)
    return Object.freeze(this.#timers
      .filter(timer => timer.dueTick <= tick)
      .sort((left, right) => left.dueTick - right.dueTick || left.id - right.id)
      .slice(0, MAXIMUM_INVOCATIONS_PER_TICK)
      .map(timer => timer.id))
  }

  cancelTimer(id: number): void {
    this.#timers = this.#timers.filter(timer => timer.id !== id)
  }

  fireTimer(id: number, tick: number): ModScheduledRuleResult {
    validateTick(tick)
    const timerIndex = this.#timers.findIndex(timer => timer.id === id && timer.dueTick <= tick)
    if (timerIndex < 0) throw new Error(`mod rule timer is unavailable: ${id}`)
    const [timer] = this.#timers.splice(timerIndex, 1)
    const mod = this.#mods.get(timer!.modId)
    const node = mod?.rulesById.get(timer!.nodeId)
    if (!mod || !node) throw new Error(`mod rule timer definition is unavailable: ${id}`)
    const input: ModRuleDispatchInput = {
      context: timer!.context,
      event: timer!.event,
      payload: timer!.payload,
      scope: timer!.scope,
      tick,
    }
    const startedAt = this.#now()
    const errors: string[] = []
    let intents: readonly ModIntent[] = []
    try {
      intents = evaluateRule(
        mod.compiled.identity.id,
        node,
        input,
        () => this.#nextIntentSequence++,
        rule => this.#schedule(mod, rule, input),
      )
      if (timer!.intervalTicks !== null && timer!.remaining > 1) {
        this.#timers.push(freezeTimer({
          ...timer!,
          dueTick: timer!.dueTick + timer!.intervalTicks,
          remaining: timer!.remaining - 1,
        }))
      }
    } catch (error) {
      errors.push(`${timer!.modId}:timer.${timer!.id}: ${message(error)}`)
    }
    return Object.freeze({
      context: timer!.context,
      result: Object.freeze({
        budgetExceeded: this.#now() - startedAt > this.#tickBudgetMs,
        errors: Object.freeze(errors),
        intents: Object.freeze(intents),
        invocations: 1,
      }),
      scope: timer!.scope,
    })
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
          rule => this.#schedule(mod, rule, input),
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
        const migrations = Object.fromEntries(Object.keys(registration.migrations).map((version) => [
          Number(version),
          (value: LuaConsoleValue) => mod.runtime.invokeMigration(
            reducer.key,
            Number(version),
            value,
          ) as LuaConsoleValue,
        ]))
        const cell = this.#state.cell({
          key: reducer.key,
          migrations,
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
            mod.compiled,
            this.#mods,
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
          this.#trace({
            disabled: false,
            error: null,
            event: input.event,
            failures: 0,
            intents: nextIntents.length,
            key: reducer.key,
            modId: mod.compiled.identity.id,
            outcome: 'ok',
            scope: input.scope,
            tick: input.tick,
          })
        } catch (error) {
          reducer.failures += 1
          const reason = message(error)
          errors.push(`${mod.compiled.identity.id}:${reducer.key}: ${reason}`)
          if (reducer.failures >= this.#failureThreshold) {
            reducer.disabled = true
            reducer.scope.close('reducer-circuit-open')
          }
          this.#trace({
            disabled: reducer.disabled,
            error: reason,
            event: input.event,
            failures: reducer.failures,
            intents: 0,
            key: reducer.key,
            modId: mod.compiled.identity.id,
            outcome: 'error',
            scope: input.scope,
            tick: input.tick,
          })
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

  reducerDiagnostics(): readonly ModReducerHealthCheckpoint[] {
    return Object.freeze([...this.#mods.values()].flatMap(mod => mod.reducers.map(reducer => Object.freeze({
      disabled: reducer.disabled,
      failures: reducer.failures,
      key: reducer.key,
      modId: mod.compiled.identity.id,
    }))).sort((left, right) => left.modId.localeCompare(right.modId) || left.key.localeCompare(right.key)))
  }

  traces(): readonly ModReducerTrace[] {
    return Object.freeze(this.#traces.map(trace => Object.freeze({
      ...trace,
      scope: Object.freeze({ ...trace.scope }),
    })))
  }

  closeRun(runId: string): void {
    if (!runId) return
    const matches = (scope: ModStateScope) => scope.id === runId || scope.id.endsWith(`:${runId}`)
    this.#state.closeScopes(matches)
    this.#timers = this.#timers.filter(timer => !matches(timer.scope))
  }

  closeMod(modId: string, reason = 'mod-unloaded'): boolean {
    const mod = this.#mods.get(modId)
    if (!mod) return false
    this.#mods.delete(modId)
    this.#timers = this.#timers.filter(timer => timer.modId !== modId)
    mod.root.close(reason)
    return true
  }

  close(): void {
    for (const modId of [...this.#mods.keys()]) this.closeMod(modId, 'rule-engine-closed')
    this.#state.close()
    this.#traces = []
  }

  #trace(value: ModReducerTrace): void {
    this.#traces.push(Object.freeze({ ...value, scope: Object.freeze({ ...value.scope }) }))
    if (this.#traces.length > MAXIMUM_REDUCER_TRACES) this.#traces.shift()
  }

  #schedule(
    mod: RegisteredMod,
    rule: WebLuaRuleDefinition,
    input: ModRuleDispatchInput,
  ): void {
    if (this.#timers.length >= MAXIMUM_TIMERS) throw new Error('mod rule timer limit reached')
    const node = rule.fields.node
    if (!isRule(node)) throw new Error(`${rule.operation} requires a rule node`)
    const nodeId = mod.ruleIds.get(node)
    if (!nodeId) throw new Error(`${rule.operation} rule node is not part of the compiled graph`)
    const repeated = rule.operation === 'rules.every'
    const delay = durationTicks(
      repeated ? rule.fields.interval : rule.fields.duration,
      this.#ticksPerSecond,
      repeated ? 'rules.every interval' : 'rules.after duration',
    )
    const remaining = repeated
      ? integer(rule.fields.times, 1, 1_024, 'rules.every times')
      : 1
    this.#timers.push(freezeTimer({
      context: normalizeObject(input.context, 'mod timer context'),
      dueTick: input.tick + delay,
      event: input.event,
      id: this.#nextTimerId++,
      intervalTicks: repeated ? delay : null,
      modId: mod.compiled.identity.id,
      nodeId,
      payload: normalizeValue(input.payload, 'mod timer payload'),
      remaining,
      scope: Object.freeze({ ...input.scope }),
    }))
  }

  #restoreTimers(checkpoint: ModRuleEngineCheckpoint): void {
    if (!Number.isSafeInteger(checkpoint.nextIntentSequence) || checkpoint.nextIntentSequence < 1 ||
        !Number.isSafeInteger(checkpoint.nextTimerId) || checkpoint.nextTimerId < 1 ||
        checkpoint.timers.length > MAXIMUM_TIMERS) {
      throw new Error('mod rule checkpoint is invalid')
    }
    const ids = new Set<number>()
    this.#timers = checkpoint.timers.map(timer => {
      const mod = this.#mods.get(timer.modId)
      if (!mod?.rulesById.has(timer.nodeId) || ids.has(timer.id) ||
          !Number.isSafeInteger(timer.id) || timer.id < 1 ||
          !Number.isSafeInteger(timer.dueTick) || timer.dueTick < 0 ||
          !Number.isSafeInteger(timer.remaining) || timer.remaining < 1 ||
          (timer.intervalTicks !== null && (
            !Number.isSafeInteger(timer.intervalTicks) || timer.intervalTicks < 1
          ))) throw new Error('mod rule checkpoint contains an invalid timer')
      ids.add(timer.id)
      return freezeTimer(timer)
    })
    this.#nextIntentSequence = checkpoint.nextIntentSequence
    this.#nextTimerId = checkpoint.nextTimerId
  }

  #restoreReducerHealth(checkpoint: readonly ModReducerHealthCheckpoint[]): void {
    const expected = this.reducerDiagnostics()
    if (checkpoint.length !== expected.length) throw new Error('mod reducer health checkpoint is invalid')
    const byId = new Map(checkpoint.map(row => [`${row.modId}\0${row.key}`, row]))
    for (const mod of this.#mods.values()) for (const reducer of mod.reducers) {
      const row = byId.get(`${mod.compiled.identity.id}\0${reducer.key}`)
      if (!row || !Number.isSafeInteger(row.failures) || row.failures < 0 ||
          typeof row.disabled !== 'boolean' || row.disabled !== (row.failures >= this.#failureThreshold)) {
        throw new Error('mod reducer health checkpoint is invalid')
      }
      reducer.failures = row.failures
      reducer.disabled = row.disabled
      if (row.disabled) reducer.scope.close('restored-reducer-circuit-open')
    }
  }
}

function contentRules(compiled: CompiledWebLuaMod): readonly WebLuaRuleDefinition[] {
  return compiled.content.flatMap((content): WebLuaRuleDefinition[] => {
    if (content.contentKind === 'boneyard') {
      const triggers = content.fields.triggers
      if (!Array.isArray(triggers)) return []
      return triggers.filter(isRule).map(node => Object.freeze({
        fields: Object.freeze({
          no: null,
          predicate: Object.freeze({
            context: 'active_boneyard_content_id',
            equals: content.contentId,
          }),
          yes: node,
        }),
        kind: 'rule-definition' as const,
        operation: 'rules.when',
        source: node.source,
      }))
    }
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
  schedule: (rule: WebLuaRuleDefinition) => void,
): readonly ModIntent[] {
  return rules.flatMap(rule => evaluateRule(modId, rule, input, sequence, schedule))
}

function evaluateRule(
  modId: string,
  rule: WebLuaRuleDefinition,
  input: ModRuleDispatchInput,
  sequence: () => number,
  schedule: (rule: WebLuaRuleDefinition) => void,
): readonly ModIntent[] {
  switch (rule.operation) {
    case 'rules.on': {
      if (rule.fields.event !== input.event) return []
      const node = rule.fields.node
      return isRule(node) ? evaluateRule(modId, node, input, sequence, schedule) : []
    }
    case 'rules.all':
      return ruleNodes(rule, 'nodes').flatMap(node => evaluateRule(
        modId, node, input, sequence, schedule,
      ))
    case 'rules.first':
      for (const node of ruleNodes(rule, 'nodes')) {
        const values = evaluateRule(modId, node, input, sequence, schedule)
        if (values.length > 0) return values
      }
      return []
    case 'rules.when': {
      const selected = predicate(rule.fields.predicate, input)
        ? rule.fields.yes
        : rule.fields.no
      return isRule(selected) ? evaluateRule(modId, selected, input, sequence, schedule) : []
    }
    case 'rules.after':
    case 'rules.every':
      schedule(rule)
      return []
    case 'prefab.area':
    case 'prefab.channel':
    case 'prefab.projectile':
      return [intent(modId, 'spell-effect', {
        ...rule.fields,
        prefab: rule.operation.slice('prefab.'.length),
        spell_content_id: input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
          ? (input.payload as LuaConsoleObject).content_id ?? null
          : null,
      }, 'rule', input.scope, sequence())]
    default:
      return rule.operation.startsWith('effect.')
        ? [intent(modId, rule.operation.slice('effect.'.length), rule.fields, 'rule', input.scope, sequence())]
        : []
  }
}

function normalizeReducerIntents(
  compiled: CompiledWebLuaMod,
  mods: ReadonlyMap<string, RegisteredMod>,
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
    return intent(
      compiled.identity.id,
      value.intentKind,
      resolveReducerReferences(value.fields, compiled, mods),
      reducerKey,
      scope,
      sequence(),
    )
  })
}

function resolveReducerReferences(
  value: unknown,
  compiled: CompiledWebLuaMod,
  mods: ReadonlyMap<string, RegisteredMod>,
): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => resolveReducerReferences(entry, compiled, mods))
  }
  if (!value || typeof value !== 'object') return value
  const record = value as Readonly<Record<string, unknown>>
  if (record.kind === 'content-reference') {
    const modId = typeof record.modId === 'string' ? record.modId : compiled.identity.id
    const targetKind = record.targetKind
    const key = record.key
    const target = mods.get(modId)?.compiled.content.find(entry => (
      entry.key === key && entry.contentKind === targetKind
    ))
    if (!target || typeof key !== 'string' || typeof targetKind !== 'string') {
      throw new Error(`advanced reducer reference is unavailable: ${modId}:${String(key)}`)
    }
    return Object.freeze({
      contentId: target.contentId,
      key,
      kind: 'resolved-content-reference',
      modId,
      targetKind,
    })
  }
  return Object.freeze(Object.fromEntries(Object.entries(record).map(([key, child]) => [
    key,
    resolveReducerReferences(child, compiled, mods),
  ])))
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

const PREDICATE_FIELDS: ReadonlySet<string> = new Set([
  'above',
  'all',
  'any',
  'at_least',
  'at_most',
  'below',
  'context',
  'equals',
  'event',
  'none',
  'not_equals',
])
const PREDICATE_NUMERIC_COMPARISONS: ReadonlyArray<readonly [string, (actual: number, expected: number) => boolean]> = [
  ['above', (actual, expected) => actual > expected],
  ['at_least', (actual, expected) => actual >= expected],
  ['at_most', (actual, expected) => actual <= expected],
  ['below', (actual, expected) => actual < expected],
]
const MAXIMUM_PREDICATE_DEPTH = 8

function predicate(value: unknown, input: ModRuleDispatchInput, depth = 0): boolean {
  if (typeof value === 'boolean') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('rules.when predicate is invalid')
  }
  if (depth > MAXIMUM_PREDICATE_DEPTH) throw new Error('rules.when predicate nests too deeply')
  const source = value as Record<string, unknown>
  const unknown = Object.keys(source).filter(key => !PREDICATE_FIELDS.has(key))
  if (unknown.length > 0) throw new Error(`rules.when predicate has unknown fields: ${unknown.join(', ')}`)
  if (typeof source.event === 'string') return source.event === input.event
  if (typeof source.context === 'string') {
    const actual = input.context[source.context]
    if (source.equals !== undefined) return actual === source.equals
    if (source.not_equals !== undefined) return actual !== source.not_equals
    for (const [field, compare] of PREDICATE_NUMERIC_COMPARISONS) {
      const expected = source[field]
      if (expected === undefined) continue
      return typeof actual === 'number'
        && typeof expected === 'number'
        && Number.isFinite(actual)
        && Number.isFinite(expected)
        && compare(actual, expected)
    }
    return Boolean(actual)
  }
  if (Array.isArray(source.all)) return source.all.every(entry => predicate(entry, input, depth + 1))
  if (Array.isArray(source.any)) return source.any.some(entry => predicate(entry, input, depth + 1))
  if (Array.isArray(source.none)) return !source.none.some(entry => predicate(entry, input, depth + 1))
  throw new Error('rules.when predicate requires event, context, all, any, or none')
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

function indexRules(rules: readonly WebLuaRuleDefinition[]): Readonly<{
  byId: ReadonlyMap<string, WebLuaRuleDefinition>
  ids: ReadonlyMap<WebLuaRuleDefinition, string>
}> {
  const byId = new Map<string, WebLuaRuleDefinition>()
  const ids = new Map<WebLuaRuleDefinition, string>()
  const visit = (value: unknown): void => {
    if (isRule(value)) {
      if (ids.has(value)) return
      const id = `r${ids.size}`
      ids.set(value, id)
      byId.set(id, value)
      for (const child of Object.values(value.fields)) visit(child)
    } else if (Array.isArray(value)) {
      for (const child of value) visit(child)
    } else if (value && typeof value === 'object') {
      for (const child of Object.values(value)) visit(child)
    }
  }
  for (const rule of rules) visit(rule)
  return Object.freeze({ byId, ids })
}

function freezeTimer(value: ModRuleTimerCheckpoint): ModRuleTimerCheckpoint {
  return Object.freeze({
    ...value,
    context: Object.freeze({ ...value.context }),
    scope: Object.freeze({ ...value.scope }),
  })
}

function durationTicks(
  value: unknown,
  ticksPerSecond: number,
  field: string,
): number {
  let milliseconds: number
  if (Number.isSafeInteger(value) && Number(value) >= 0) {
    milliseconds = Number(value)
  } else if (typeof value === 'string') {
    const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?(ms|s|m|h)$/.exec(value)
    if (!match) throw new Error(`${field} is invalid`)
    const amount = Number(`${match[1]}.${match[2] ?? 0}`)
    const scale = match[3] === 'ms' ? 1 : match[3] === 's' ? 1_000 : match[3] === 'm' ? 60_000 : 3_600_000
    milliseconds = amount * scale
  } else {
    throw new Error(`${field} is invalid`)
  }
  if (!Number.isFinite(milliseconds) || milliseconds > 86_400_000) {
    throw new Error(`${field} exceeds 24 hours`)
  }
  return Math.max(1, Math.ceil(milliseconds * ticksPerSecond / 1_000))
}

function integer(value: unknown, minimum: number, maximum: number, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} must be an integer within ${minimum}..${maximum}`)
  }
  return Number(value)
}

function validateTick(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('mod rule tick is invalid')
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

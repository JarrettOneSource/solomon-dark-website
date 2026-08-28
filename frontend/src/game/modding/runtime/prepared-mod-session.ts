import type { LuaConsoleObject, LuaConsoleValue } from '../../protocol/game-protocol.ts'
import {
  compileWebLuaDefinition,
  WebLuaDefinitionRuntime,
  type CompiledWebLuaMod,
  type WebLuaModIdentity,
} from '../definition/index.ts'
import {
  ModIntentExecutor,
  type ModIntentAdapter,
} from './mod-intent-executor.ts'
import {
  ModRuleEngine,
  type ModIntent,
  type ModReducerHealthCheckpoint,
  type ModReducerTrace,
  type ModRuleEngineCheckpoint,
} from './mod-rule-engine.ts'
import type {
  ModStateCheckpoint,
  ModStateScope,
} from './mod-state-store.ts'

export interface PreparedModSource {
  readonly compiled: CompiledWebLuaMod
  readonly entryScript: string
  readonly entryScriptPath: string
  readonly identity: WebLuaModIdentity
}

export interface PreparedModEvent {
  readonly context: LuaConsoleObject
  readonly event: string
  readonly payload: LuaConsoleValue
  readonly scope: ModStateScope
}

export interface PreparedModStepInput {
  readonly events: readonly PreparedModEvent[]
  readonly tick: number
}

export interface PreparedModStepResult {
  readonly accepted: boolean
  readonly budgetExceeded: boolean
  readonly errors: readonly string[]
  readonly intents: readonly ModIntent[]
  readonly invocations: number
}

export interface PreparedModActionInput extends Omit<PreparedModEvent, 'event'> {
  readonly action: string
  readonly requestId: number
  readonly tick: number
}

export interface PreparedModProjection {
  readonly catalog: readonly CompiledWebLuaMod[]
  readonly state: ModStateCheckpoint
  readonly viewerId: string
}

export interface PreparedModCheckpoint extends ModRuleEngineCheckpoint {
  readonly graphSha256: readonly string[]
}

export interface PreparedModSession {
  act(input: PreparedModActionInput): PreparedModStepResult
  catalog(): readonly CompiledWebLuaMod[]
  checkpoint(): PreparedModCheckpoint
  closeRun(runId: string): void
  close(): void
  project(viewerId: string): PreparedModProjection
  restore(checkpoint: PreparedModCheckpoint): void
  reducerDiagnostics(): readonly ModReducerHealthCheckpoint[]
  reducerTraces(): readonly ModReducerTrace[]
  step(input: PreparedModStepInput): PreparedModStepResult
}

export async function prepareModSession(options: Readonly<{
  adapter: ModIntentAdapter
  mods: readonly PreparedModSource[]
  wasmPath: string
}>): Promise<PreparedModSession> {
  const rules = new ModRuleEngine()
  const runtimes: WebLuaDefinitionRuntime[] = []
  try {
    const verified: CompiledWebLuaMod[] = []
    for (const source of options.mods) {
      const runtime = await WebLuaDefinitionRuntime.create({
        entryScript: source.entryScriptPath,
        identity: source.identity,
        wasmPath: options.wasmPath,
      })
      runtimes.push(runtime)
      const compiled = compileWebLuaDefinition(source.identity, runtime.run(source.entryScript), {
        dependencies: verified.map(mod => ({ content: mod.content, id: mod.identity.id })),
      })
      if (compiled.graphSha256 !== source.compiled.graphSha256) {
        throw new Error(`compiled Web Lua graph changed for ${source.identity.id}`)
      }
      verified.push(compiled)
      rules.register(compiled, runtime)
    }
    const executor = new ModIntentExecutor(options.adapter)
    let closed = false
    const requireOpen = (): void => {
      if (closed) throw new Error('prepared mod session is closed')
    }
    const step = (input: PreparedModStepInput): PreparedModStepResult => {
      requireOpen()
      if (!Number.isSafeInteger(input.tick) || input.tick < 0) throw new Error('mod session tick is invalid')
      const intents: ModIntent[] = []
      const errors: string[] = []
      let budgetExceeded = false
      let invocations = 0
      let accepted = true
      for (const timerId of rules.dueTimerIds(input.tick)) {
        const checkpoint = rules.checkpoint()
        const scheduled = rules.fireTimer(timerId, input.tick)
        intents.push(...scheduled.result.intents)
        errors.push(...scheduled.result.errors)
        invocations += scheduled.result.invocations
        budgetExceeded ||= scheduled.result.budgetExceeded
        const execution = scheduled.result.intents.length === 0
          ? { accepted: true, error: null }
          : executor.execute(scheduled.result.intents, {
              context: scheduled.context,
              scope: scheduled.scope,
              tick: input.tick,
            })
        if (!execution.accepted) {
          rules.rollback(checkpoint)
          rules.cancelTimer(timerId)
          errors.push(execution.error ?? 'scheduled mod intent transaction failed')
          accepted = false
        }
      }
      const eventCheckpoint = rules.checkpoint()
      const eventIntents: ModIntent[] = []
      for (const event of input.events) {
        const result = rules.dispatch({ ...event, tick: input.tick })
        eventIntents.push(...result.intents)
        errors.push(...result.errors)
        invocations += result.invocations
        budgetExceeded ||= result.budgetExceeded
        if (result.budgetExceeded) break
      }
      const scope = commonScope(input.events)
      const execution = eventIntents.length === 0
        ? { accepted: true, error: null }
        : executor.execute(eventIntents, {
            context: input.events[0]?.context ?? {},
            scope,
            tick: input.tick,
          })
      if (!execution.accepted) {
        rules.rollback(eventCheckpoint)
        errors.push(execution.error ?? 'mod intent transaction failed')
        accepted = false
      }
      intents.push(...eventIntents)
      return Object.freeze({
        accepted,
        budgetExceeded,
        errors: Object.freeze(errors),
        intents: Object.freeze(intents),
        invocations,
      })
    }
    const session: PreparedModSession = {
      act(input) {
        const event = contentActionEvent(input.action, input.payload, verified)
        const genericEvent = `action.${input.action}`
        const events = [event, ...(event === genericEvent ? [] : [genericEvent])]
        return step({
          events: events.map(eventName => ({
            context: { ...input.context, action_kind: input.action, request_id: input.requestId },
            event: eventName,
            payload: input.payload,
            scope: input.scope,
          })),
          tick: input.tick,
        })
      },
      catalog() {
        requireOpen()
        return Object.freeze([...verified])
      },
      checkpoint() {
        requireOpen()
        return Object.freeze({
          graphSha256: Object.freeze(verified.map(mod => mod.graphSha256)),
          ...rules.checkpoint(),
        })
      },
      close() {
        if (closed) return
        closed = true
        rules.close()
      },
      closeRun(runId) {
        requireOpen()
        rules.closeRun(runId)
      },
      project(viewerId) {
        requireOpen()
        return Object.freeze({
          catalog: Object.freeze([...verified]),
          state: rules.state.snapshot(),
          viewerId,
        })
      },
      restore(checkpoint) {
        requireOpen()
        if (checkpoint.graphSha256.length !== verified.length || checkpoint.graphSha256.some((hash, index) => (
          hash !== verified[index]!.graphSha256
        ))) throw new Error('mod checkpoint graph does not match the prepared session')
        rules.restore(checkpoint)
      },
      reducerDiagnostics() {
        requireOpen()
        return rules.reducerDiagnostics()
      },
      reducerTraces() {
        requireOpen()
        return rules.traces()
      },
      step,
    }
    return Object.freeze(session)
  } catch (error) {
    rules.close()
    for (const runtime of runtimes) runtime.close()
    throw error
  }
}

function contentActionEvent(
  action: string,
  payload: LuaConsoleValue,
  mods: readonly CompiledWebLuaMod[],
): string {
  if (action !== 'content.use' && action !== 'content.pickup' && action !== 'content.cast') {
    return `action.${action}`
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${action} requires a content payload`)
  }
  const contentId = (payload as LuaConsoleObject).content_id
  if (typeof contentId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(contentId)) {
    throw new Error(`${action} content identity is invalid`)
  }
  const content = mods.flatMap(mod => mod.content).find(candidate => candidate.contentId === contentId)
  const kinds = action === 'content.use'
    ? new Set(['item', 'potion'])
    : action === 'content.pickup'
      ? new Set(['powerup'])
      : new Set(['spell'])
  if (!content || !kinds.has(content.contentKind)) {
    throw new Error(`${action} content is unavailable: ${contentId}`)
  }
  return `action.${action}.${contentId}`
}

function commonScope(events: readonly PreparedModEvent[]): ModStateScope {
  const first = events[0]?.scope ?? { id: 'session', kind: 'session' as const }
  if (events.some(event => event.scope.id !== first.id || event.scope.kind !== first.kind)) {
    throw new Error('one mod session step may not mix state scopes')
  }
  return first
}

import { LuaFactory, type LuaEngine, type LuaThread } from 'wasmoon'

import {
  MAX_LUA_CONSOLE_CODE_LENGTH,
  MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH,
  MAX_LUA_CONSOLE_OUTPUT_LINES,
  MAX_LUA_CONSOLE_OUTPUT_BYTES,
  MAX_LUA_CONSOLE_RETURN_BYTES,
  MAX_LUA_CONSOLE_RETURN_VALUES,
  type LuaConsoleValue,
} from '../../protocol/game-protocol.ts'
import {
  WEB_LUA_CALLBACK_TIMEOUT_MS,
  WEB_LUA_DEV_CONSOLE_MOD,
  WEB_LUA_EVENT_NAMES,
  WEB_LUA_FILTER_NAMES,
  WEB_LUA_EXECUTION_TIMEOUT_MS,
  WEB_LUA_MAX_CALLBACK_INVOCATIONS_PER_TICK,
  WEB_LUA_MAX_CALLBACKS,
  WEB_LUA_MAX_COMMANDS_PER_TICK,
  WEB_LUA_MAX_PENDING_EXECUTIONS,
  WEB_LUA_MAX_TIMERS,
  WEB_LUA_TICK_BUDGET_MS,
  WEB_LUA_VM_MEMORY_BYTES,
  type WebLuaCommand,
  type WebLuaDeveloperBindings,
  type WebLuaEventName,
  type WebLuaFilterName,
  type WebLuaExecutionRequest,
  type WebLuaExecutionResult,
  type WebLuaFrameState,
  type WebLuaRuntimeBindings,
  type WebLuaRuntimeLog,
  type WebLuaModIdentity,
  type WebLuaModSource,
} from './web-lua-contract.ts'
import { WebLuaApi } from './web-lua-api.ts'
import {
  WebLuaContentRegistry,
  type WebLuaContentModBinding,
} from './web-lua-content-registry.ts'
import { applyWebLuaFilterResult, type WebLuaFilterOutcome } from './web-lua-filters.ts'
import {
  boundedError,
  encodedByteLength,
  normalizeLuaValues,
  printableLuaValue,
  requireNonnegativeInteger,
  requireString,
  utf8ByteLength,
} from './web-lua-values.ts'

const eventNameSet = new Set<string>(WEB_LUA_EVENT_NAMES)
const filterNameSet = new Set<string>(WEB_LUA_FILTER_NAMES)
const maximumTimerDelayMs = 24 * 60 * 60 * 1_000

interface WebLuaRuntimeOptions {
  readonly bindings: WebLuaRuntimeBindings
  readonly contentRegistry?: WebLuaContentRegistry
  readonly developer?: WebLuaDeveloperBindings
  readonly log?: WebLuaRuntimeLog
  readonly mod?: WebLuaModIdentity
  readonly modSource?: WebLuaModSource
  readonly now?: () => number
  readonly wasmPath: string
}

interface LuaTimer {
  callback: (...args: unknown[]) => unknown
  dueTick: number
  readonly handle: number
  readonly intervalTicks: number | null
  readonly sequenceSteps: readonly LuaTimerStep[] | null
  sequenceIndex: number
}

interface LuaTimerStep {
  readonly callback: (...args: unknown[]) => unknown
  readonly delayTicks: number
}

interface LuaCallback {
  readonly callback: (...args: unknown[]) => unknown
  readonly handle: number
}

export interface WebLuaRuntimeMetrics {
  readonly budgetExceededCount: number
  readonly callbackCount: number
  readonly initializedAtMs: number
  readonly lastTickWorkMs: number
  readonly maximumTickWorkMs: number
  readonly memoryBytes: number
  readonly pendingExecutions: number
  readonly stateBytes: number
  readonly timerCount: number
}

export class WebLuaRuntime {
  readonly #api: WebLuaApi
  readonly #bindings: WebLuaRuntimeBindings
  readonly #callbacks = new Map<WebLuaEventName, Map<number, LuaCallback>>()
  readonly #content: WebLuaContentModBinding | null
  readonly #engine: LuaEngine
  readonly #filters = new Map<WebLuaFilterName, Map<number, LuaCallback>>()
  readonly #log: WebLuaRuntimeLog
  readonly #now: () => number
  readonly #pendingExecutions: WebLuaExecutionRequest[] = []
  readonly #timers = new Map<number, LuaTimer>()
  #activeOutput: string[] | null = null
  #activeOutputBytes = 0
  #activePlayerId: string | null = null
  #budgetExceededCount = 0
  #callbackInvocationsThisTick = 0
  #callbackLimitWarningTick = -1
  #closed = false
  #currentTick = 0
  #entrypointRan = false
  #filterResult: unknown = null
  #filterResultSubmitted = false
  #filterRunning = false
  #initializedAtMs: number
  #lastTickWorkMs = 0
  #maximumTickWorkMs = 0
  #nextHandle = 1
  #postSimulationFrame = false
  #tickBudgetWarningTick = -1
  #tickLuaWorkMs = 0
  #tickFrame: WebLuaFrameState | null = null
  readonly mod: WebLuaModIdentity

  static async create(options: WebLuaRuntimeOptions): Promise<WebLuaRuntime> {
    const startedAt = (options.now ?? performance.now.bind(performance))()
    const factory = new LuaFactory(options.wasmPath)
    const engine = await factory.createEngine({
      enableProxy: false,
      functionTimeout: WEB_LUA_CALLBACK_TIMEOUT_MS,
      injectObjects: false,
      traceAllocations: true,
    })
    let runtime: WebLuaRuntime | null = null
    try {
      engine.global.setMemoryMax(WEB_LUA_VM_MEMORY_BYTES)
      runtime = new WebLuaRuntime(engine, options)
      runtime.#initializedAtMs = runtime.#now() - startedAt
      runtime.#api.install(engine)
      await engine.doString(SANDBOX_BOOTSTRAP)
      return runtime
    } catch (error) {
      if (runtime) runtime.close()
      else engine.global.close()
      throw error
    }
  }

  private constructor(engine: LuaEngine, options: WebLuaRuntimeOptions) {
    this.#bindings = options.bindings
    this.#engine = engine
    this.#log = options.log ?? (() => {})
    this.#now = options.now ?? performance.now.bind(performance)
    this.#initializedAtMs = 0
    this.mod = Object.freeze(options.mod ?? WEB_LUA_DEV_CONSOLE_MOD)
    for (const name of WEB_LUA_EVENT_NAMES) this.#callbacks.set(name, new Map())
    for (const name of WEB_LUA_FILTER_NAMES) this.#filters.set(name, new Map())
    if (Boolean(options.contentRegistry) !== Boolean(options.modSource)) {
      throw new Error('Lua content registry and mod source must be configured together')
    }
    this.#content = options.contentRegistry && options.modSource
      ? options.contentRegistry.attach(options.modSource, {
          invoke: (callback, owner, payload, activePlayerId) => this.#callStoredFunctionForPlayer(
            callback,
            owner,
            activePlayerId,
            payload,
          ),
        })
      : null
    this.#api = new WebLuaApi({
      addCallback: (name, callback) => this.#addCallback(name, callback),
      addFilter: (name, callback) => this.#addFilter(name, callback),
      addTimer: (delayMs, callback, repeating) => this.#addTimer(
        delayMs,
        callback,
        repeating,
      ),
      addTimerSequence: (steps) => this.#addTimerSequence(steps),
      cancelTimer: (handle) => this.#timers.delete(handle),
      clearTimers: () => {
        const count = this.#timers.size
        this.#timers.clear()
        return count
      },
      currentTick: () => this.#currentTick,
      developer: options.developer,
      getActivePlayerId: () => this.#activePlayerId,
      getAuthorityPlayerId: () => this.#bindings.getAuthorityPlayerId(),
      getFrame: () => this.#frame(),
      now: () => this.#now(),
      print: (values) => this.#print(values),
      queueCommand: (command) => this.#queueCommand(command),
      submitFilterResult: (value) => {
        if (!this.#filterRunning || this.#filterResultSubmitted) {
          throw new Error('Lua filter result submission is outside its callback')
        }
        this.#filterResult = value
        this.#filterResultSubmitted = true
      },
    }, this.mod, this.#content)
  }

  runEntrypoint(code: string): void {
    if (this.#closed) throw new Error('Lua runtime is closed')
    if (this.#entrypointRan) throw new Error('Lua mod entrypoint already ran')
    this.#entrypointRan = true
    this.#content?.openRegistration()
    const result = this.#execute(code, null)
    this.#content?.finishRegistration(result.ok)
    if (!result.ok) throw new Error(result.error ?? `${this.mod.id} entry script failed`)
  }

  snapshotState(): Readonly<Record<string, LuaConsoleValue>> {
    return this.#api.snapshotState()
  }

  restoreState(source: Readonly<Record<string, LuaConsoleValue>>): void {
    this.#api.restoreState(source)
  }

  enqueueExecution(request: WebLuaExecutionRequest): boolean {
    if (this.#closed || this.#pendingExecutions.length >= WEB_LUA_MAX_PENDING_EXECUTIONS) {
      return false
    }
    if (
      request.code.length === 0
      || request.code.length > MAX_LUA_CONSOLE_CODE_LENGTH
      || encodedByteLength(request.code) > MAX_LUA_CONSOLE_CODE_LENGTH
    ) return false
    this.#pendingExecutions.push(request)
    return true
  }

  beginTick(tick: number): void {
    if (this.#closed) return
    this.#currentTick = requireNonnegativeInteger(tick, 'runtime tick')
    this.#lastTickWorkMs = this.#tickLuaWorkMs
    this.#tickLuaWorkMs = 0
    this.#callbackInvocationsThisTick = 0
    this.#postSimulationFrame = false
    this.#tickFrame = null
    const request = this.#pendingExecutions.shift()
    if (request) {
      const authorityPlayerId = this.#bindings.getAuthorityPlayerId()
      request.respond(authorityPlayerId === request.playerId
        ? this.#measureLuaWork(() => this.#execute(request.code, request.playerId))
        : {
            error: 'Lua execution authority changed before the request ran.',
            ok: false,
            output: [],
            values: [],
          })
    }
    if (this.#timers.size > 0) this.#runDueTimers()
    if ((this.#callbacks.get('runtime.tick')?.size ?? 0) > 0) {
      this.#dispatch(
        'runtime.tick',
        {
          monotonic_milliseconds: Math.floor(this.#now()),
          tick_count: this.#currentTick,
          tick_interval_ms: 10,
        },
      )
    }
  }

  dispatch(
    name: WebLuaEventName,
    payload: LuaConsoleValue,
    activePlayerId?: string,
  ): void {
    if (this.#closed || name === 'runtime.tick') return
    if (!this.#postSimulationFrame) {
      this.#postSimulationFrame = true
      this.#tickFrame = null
    }
    this.#api.observeRunLifecycle(name, payload)
    this.#dispatch(name, payload, activePlayerId)
  }

  applyFilter(
    name: WebLuaFilterName,
    payload: Extract<LuaConsoleValue, Record<string, LuaConsoleValue>>,
    activePlayerId: string,
  ): WebLuaFilterOutcome {
    const callbacks = this.#filters.get(name)
    if (!callbacks || callbacks.size === 0) return { canceled: false, payload }
    let outcome: WebLuaFilterOutcome = { canceled: false, payload }
    for (const entry of [...callbacks.values()]) {
      if (this.#overTickBudget() || this.#callbackLimitReached()) return outcome
      const invoked = this.#callFilterFunction(
        entry.callback,
        `${name} filter ${entry.handle}`,
        activePlayerId,
        outcome.payload,
      )
      if (!invoked.ok) continue
      try {
        outcome = applyWebLuaFilterResult(name, outcome.payload, invoked.result)
      } catch (error) {
        this.#log('warning', 'lua.filter_result_ignored', `${name}: ${boundedError(error)}`)
      }
      if (outcome.canceled) return outcome
    }
    return outcome
  }

  drainCommands(): readonly WebLuaCommand[] {
    return this.#commandQueue.splice(0)
  }

  wantsEvent(name: Exclude<WebLuaEventName, 'runtime.tick'>): boolean {
    if (this.#api.wantsLifecycleEvent(name)) return true
    return (this.#callbacks.get(name)?.size ?? 0) > 0
  }

  get metrics(): WebLuaRuntimeMetrics {
    return {
      budgetExceededCount: this.#budgetExceededCount,
      callbackCount: this.#registeredCallbackCount(),
      initializedAtMs: this.#initializedAtMs,
      lastTickWorkMs: this.#lastTickWorkMs,
      maximumTickWorkMs: this.#maximumTickWorkMs,
      memoryBytes: this.#engine.global.getMemoryUsed(),
      pendingExecutions: this.#pendingExecutions.length,
      stateBytes: this.#api.stateBytes,
      timerCount: this.#timers.size,
    }
  }

  close(): void {
    if (this.#closed) return
    this.#closed = true
    for (const request of this.#pendingExecutions.splice(0)) {
      request.respond({
        error: 'Lua runtime closed before the request executed.',
        ok: false,
        output: [],
        values: [],
      })
    }
    this.#callbacks.clear()
    this.#filters.clear()
    this.#timers.clear()
    this.#content?.close()
    this.#api.close()
    this.#commandQueue.length = 0
    this.#engine.global.close()
  }

  readonly #commandQueue: WebLuaCommand[] = []

  #frame(): WebLuaFrameState {
    this.#tickFrame ??= this.#bindings.getFrame()
    return this.#tickFrame
  }

  #execute(code: string, playerId: string | null): WebLuaExecutionResult {
    const output: string[] = []
    this.#activeOutput = output
    this.#activeOutputBytes = 0
    this.#activePlayerId = playerId
    try {
      const values = normalizeLuaValues(
        this.#runChunk(code).slice(0, MAX_LUA_CONSOLE_RETURN_VALUES),
        'return value',
      )
      if (encodedByteLength(values) > MAX_LUA_CONSOLE_RETURN_BYTES) {
        throw new Error('Lua return values exceed their aggregate byte limit')
      }
      return { error: null, ok: true, output, values }
    } catch (error) {
      return {
        error: boundedError(error),
        ok: false,
        output,
        values: [],
      }
    } finally {
      this.#activeOutput = null
      this.#activeOutputBytes = 0
      this.#activePlayerId = null
    }
  }

  #runChunk(code: string): readonly unknown[] {
    const thread = this.#engine.global.newThread()
    const threadIndex = this.#engine.global.getTop()
    try {
      thread.loadString(code, '=browser-dev-console')
      return this.#runThread(thread, WEB_LUA_EXECUTION_TIMEOUT_MS)
    } finally {
      thread.close()
      this.#engine.global.remove(threadIndex)
    }
  }

  #runThread(thread: LuaThread, timeoutMs: number): readonly unknown[] {
    thread.setTimeout(Date.now() + timeoutMs)
    return [...thread.runSync()]
  }

  #runDueTimers(): void {
    for (const timer of [...this.#timers.values()]) {
      if (timer.dueTick > this.#currentTick) continue
      if (this.#overTickBudget()) return
      if (this.#callbackLimitReached()) return
      if (!this.#callStoredFunction(timer.callback, `timer ${timer.handle}`)) {
        this.#timers.delete(timer.handle)
        continue
      }
      if (timer.intervalTicks !== null) {
        timer.dueTick = this.#currentTick + timer.intervalTicks
        continue
      }
      if (timer.sequenceSteps !== null && timer.sequenceIndex < timer.sequenceSteps.length) {
        const step = timer.sequenceSteps[timer.sequenceIndex]!
        timer.sequenceIndex += 1
        timer.callback = step.callback
        timer.dueTick = this.#currentTick + step.delayTicks
        continue
      }
      this.#timers.delete(timer.handle)
    }
  }

  #dispatch(name: WebLuaEventName, payload: LuaConsoleValue, activePlayerId?: string): void {
    const callbacks = this.#callbacks.get(name)
    if (!callbacks || callbacks.size === 0) return
    for (const entry of [...callbacks.values()]) {
      if (this.#overTickBudget()) return
      if (this.#callbackLimitReached()) return
      if (!this.#callStoredFunctionForPlayer(
        entry.callback,
        `${name} callback ${entry.handle}`,
        activePlayerId ?? this.#bindings.getAuthorityPlayerId(),
        payload,
      )) {
        callbacks.delete(entry.handle)
      }
    }
  }

  #callStoredFunction(
    callback: (...args: unknown[]) => unknown,
    owner: string,
    ...args: unknown[]
  ): boolean {
    return this.#callStoredFunctionForPlayer(
      callback,
      owner,
      this.#bindings.getAuthorityPlayerId(),
      ...args,
    )
  }

  #callStoredFunctionForPlayer(
    callback: (...args: unknown[]) => unknown,
    owner: string,
    activePlayerId: string | null,
    ...args: unknown[]
  ): boolean {
    this.#callbackInvocationsThisTick += 1
    this.#activePlayerId = activePlayerId
    try {
      const result = this.#measureLuaWork(() => callback(...args.map(luaCallbackPayload)))
      if (result instanceof Promise) throw new Error('Lua callbacks may not yield')
      return true
    } catch (error) {
      this.#log('warning', 'lua.callback_failed', `${owner}: ${boundedError(error)}`)
      return false
    } finally {
      this.#activePlayerId = null
    }
  }

  #callFilterFunction(
    callback: (...args: unknown[]) => unknown,
    owner: string,
    activePlayerId: string,
    payload: LuaConsoleValue,
  ): { readonly ok: boolean; readonly result: unknown } {
    this.#callbackInvocationsThisTick += 1
    this.#activePlayerId = activePlayerId
    this.#filterResult = null
    this.#filterResultSubmitted = false
    this.#filterRunning = true
    try {
      const result = this.#measureLuaWork(() => callback(luaCallbackPayload(payload)))
      if (result instanceof Promise) throw new Error('Lua filters may not yield')
      if (!this.#filterResultSubmitted) throw new Error('Lua filter returned no captured result')
      return { ok: true, result: this.#filterResult }
    } catch (error) {
      this.#log('warning', 'lua.filter_failed', `${owner}: ${boundedError(error)}`)
      return { ok: false, result: null }
    } finally {
      this.#filterRunning = false
      this.#filterResult = null
      this.#filterResultSubmitted = false
      this.#activePlayerId = null
    }
  }

  #overTickBudget(): boolean {
    if (this.#tickLuaWorkMs <= WEB_LUA_TICK_BUDGET_MS) return false
    this.#noteTickBudgetExceeded()
    return true
  }

  #noteTickBudgetExceeded(): void {
    if (this.#tickBudgetWarningTick !== this.#currentTick) {
      this.#tickBudgetWarningTick = this.#currentTick
      this.#budgetExceededCount += 1
      this.#log(
        'warning',
        'lua.tick_budget_exceeded',
        `Lua callback work exceeded ${WEB_LUA_TICK_BUDGET_MS} ms at tick ${this.#currentTick}.`,
      )
    }
  }

  #measureLuaWork<T>(action: () => T): T {
    const startedAt = this.#now()
    try {
      return action()
    } finally {
      this.#tickLuaWorkMs += Math.max(0, this.#now() - startedAt)
      this.#maximumTickWorkMs = Math.max(this.#maximumTickWorkMs, this.#tickLuaWorkMs)
      if (this.#tickLuaWorkMs > WEB_LUA_TICK_BUDGET_MS) this.#noteTickBudgetExceeded()
    }
  }

  #callbackLimitReached(): boolean {
    if (this.#callbackInvocationsThisTick < WEB_LUA_MAX_CALLBACK_INVOCATIONS_PER_TICK) {
      return false
    }
    if (this.#callbackLimitWarningTick !== this.#currentTick) {
      this.#callbackLimitWarningTick = this.#currentTick
      this.#log(
        'warning',
        'lua.tick_callback_limit_reached',
        `Lua reached its callback limit at tick ${this.#currentTick}.`,
      )
    }
    return true
  }

  #queueCommand(command: WebLuaCommand): void {
    if (!this.#activePlayerId) throw new Error('Lua mutation requires active authority execution')
    if (this.#commandQueue.length >= WEB_LUA_MAX_COMMANDS_PER_TICK) {
      throw new Error('Lua command limit reached for this tick')
    }
    this.#commandQueue.push(command)
  }

  #print(values: readonly unknown[]): void {
    const output = this.#activeOutput
    const line = values.map((value) => printableLuaValue(value)).join('\t')
    const lineBytes = utf8ByteLength(line)
    if (lineBytes > MAX_LUA_CONSOLE_OUTPUT_LINE_LENGTH) {
      throw new Error('Lua print line exceeds its limit')
    }
    if (output === null) {
      this.#log('info', 'lua.print', line)
      return
    }
    if (output.length >= MAX_LUA_CONSOLE_OUTPUT_LINES) {
      throw new Error('Lua print output exceeds its line limit')
    }
    const nextOutputEntryBytes = this.#activeOutputBytes + encodedByteLength(line)
    const nextOutputBytes = 2 + nextOutputEntryBytes + output.length
    if (nextOutputBytes > MAX_LUA_CONSOLE_OUTPUT_BYTES) {
      throw new Error('Lua print output exceeds its aggregate byte limit')
    }
    this.#activeOutputBytes = nextOutputEntryBytes
    output.push(line)
  }

  #addCallback(name: unknown, callback: unknown): boolean {
    const normalizedName = requireString(name, 'event name', 64)
    if (!eventNameSet.has(normalizedName)) throw new Error(`unsupported event: ${normalizedName}`)
    if (typeof callback !== 'function') throw new Error('event callback must be a function')
    const callbackCount = this.#registeredCallbackCount()
    if (callbackCount >= WEB_LUA_MAX_CALLBACKS) throw new Error('Lua callback limit reached')
    const handle = this.#newHandle()
    this.#callbacks.get(normalizedName as WebLuaEventName)!.set(handle, {
      callback: callback as (...args: unknown[]) => unknown,
      handle,
    })
    return true
  }

  #addFilter(name: unknown, callback: unknown): boolean {
    const normalizedName = requireString(name, 'event filter name', 64)
    if (!filterNameSet.has(normalizedName)) {
      throw new Error(`unsupported mutable event filter: ${normalizedName}`)
    }
    if (typeof callback !== 'function') throw new Error('event filter callback must be a function')
    if (this.#registeredCallbackCount() >= WEB_LUA_MAX_CALLBACKS) {
      throw new Error('Lua callback limit reached')
    }
    const handle = this.#newHandle()
    this.#filters.get(normalizedName as WebLuaFilterName)!.set(handle, {
      callback: callback as (...args: unknown[]) => unknown,
      handle,
    })
    return true
  }

  #registeredCallbackCount(): number {
    return [...this.#callbacks.values(), ...this.#filters.values()].reduce(
      (total, entries) => total + entries.size,
      0,
    )
  }

  #addTimer(delay: unknown, callback: unknown, repeating: boolean): number {
    if (this.#timerCallbackCount() >= WEB_LUA_MAX_TIMERS) {
      throw new Error('Lua timer limit reached')
    }
    if (typeof callback !== 'function') throw new Error('timer callback must be a function')
    const delayMs = requireNonnegativeInteger(delay, repeating ? 'timer interval' : 'timer delay')
    if (delayMs > maximumTimerDelayMs) throw new Error('Lua timer delay exceeds 24 hours')
    if (repeating && delayMs < 1) throw new Error('repeating Lua timer interval is below 1 ms')
    const ticks = Math.max(1, Math.ceil(delayMs / 10))
    const handle = this.#newHandle()
    this.#timers.set(handle, {
      callback: callback as (...args: unknown[]) => unknown,
      dueTick: this.#currentTick + ticks,
      handle,
      intervalTicks: repeating ? ticks : null,
      sequenceIndex: 0,
      sequenceSteps: null,
    })
    return handle
  }

  #addTimerSequence(value: unknown): number {
    if (!Array.isArray(value) || value.length < 1 || value.length > 64) {
      throw new Error('timer sequence requires between 1 and 64 steps')
    }
    const steps: LuaTimerStep[] = []
    let cumulativeDelayMs = 0
    for (const [index, candidate] of value.entries()) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error(`timer sequence step ${index + 1} must be a table`)
      }
      const source = candidate as Record<string, unknown>
      const callback = source.callback
      if (typeof callback !== 'function') {
        throw new Error(`timer sequence step ${index + 1} callback must be a function`)
      }
      const delayMs = requireNonnegativeInteger(
        source.delay_ms,
        `timer sequence step ${index + 1} delay_ms`,
      )
      cumulativeDelayMs += delayMs
      if (cumulativeDelayMs > maximumTimerDelayMs) {
        throw new Error('timer sequence cumulative delay exceeds 24 hours')
      }
      steps.push({
        callback: callback as (...args: unknown[]) => unknown,
        delayTicks: Math.max(1, Math.ceil(delayMs / 10)),
      })
    }
    if (this.#timerCallbackCount() + steps.length > WEB_LUA_MAX_TIMERS) {
      throw new Error('Lua timer limit reached')
    }
    const [first, ...remaining] = steps
    const handle = this.#newHandle()
    this.#timers.set(handle, {
      callback: first!.callback,
      dueTick: this.#currentTick + first!.delayTicks,
      handle,
      intervalTicks: null,
      sequenceIndex: 0,
      sequenceSteps: remaining,
    })
    return handle
  }

  #timerCallbackCount(): number {
    let count = 0
    for (const timer of this.#timers.values()) {
      count += 1
      if (timer.sequenceSteps !== null) {
        count += timer.sequenceSteps.length - timer.sequenceIndex
      }
    }
    return count
  }

  #newHandle(): number {
    const handle = this.#nextHandle
    this.#nextHandle += 1
    return handle
  }
}

const SANDBOX_BOOTSTRAP = `
  if sd.events.filter ~= nil then
    local register_filter = sd.events.filter
    local submit_filter_result = __sd_submit_filter_result
    sd.events.filter = function(name, handler)
      return register_filter(name, function(event)
        submit_filter_result(handler(event))
      end)
    end
  end
  __sd_submit_filter_result = nil
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

function luaCallbackPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(luaCallbackPayload)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== null && child !== undefined)
    .map(([key, child]) => [key, luaCallbackPayload(child)]))
}

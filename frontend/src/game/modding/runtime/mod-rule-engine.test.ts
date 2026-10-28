import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import {
  compileWebLuaDefinition,
  WebLuaDefinitionRuntime,
} from '../definition/index.ts'
import { ModRuleEngine } from './mod-rule-engine.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const identity = Object.freeze({ id: 'example.rules', name: 'Rules', version: '1.0.0' })

test('finite rules and reducers commit validated intents and state atomically', async () => {
  const runtime = await createRuntime()
  const compiled = compileWebLuaDefinition(identity, runtime.run(SCRIPT))
  const engine = new ModRuleEngine({ tickBudgetMs: 1_000 })
  engine.register(compiled, runtime)
  const scope = { id: 'run-1', kind: 'party-run' } as const

  const first = engine.dispatch({
    context: { entity_id: 'enemy-1' },
    event: 'enemy.death',
    payload: { actor_id: 1 },
    scope,
    tick: 10,
  })
  assert.equal(first.budgetExceeded, false)
  assert.equal(first.invocations, 2)
  assert.equal(first.errors.length, 1)
  assert.match(first.errors[0]!, /bad_counter.*outside 0\.\.99/)
  assert.deepEqual(first.intents.map(({ kind, owner }) => ({ kind, owner })), [
    { kind: 'state', owner: 'rule' },
    { kind: 'state', owner: 'good_counter' },
  ])
  assert.deepEqual(
    engine.state.snapshot().cells.find(cell => cell.key === 'good_counter')?.value,
    { count: 1 },
  )
  assert.deepEqual(
    engine.state.snapshot().cells.find(cell => cell.key === 'bad_counter')?.value,
    { count: 0 },
  )

  engine.dispatch({ context: {}, event: 'enemy.death', payload: {}, scope, tick: 11 })
  engine.dispatch({ context: {}, event: 'enemy.death', payload: {}, scope, tick: 12 })
  assert.deepEqual(engine.diagnostic(identity.id, 'bad_counter'), { disabled: true, failures: 3 })
  assert.equal(engine.reducerDiagnostics().find(row => row.key === 'bad_counter')?.disabled, true)
  assert.match(engine.traces().findLast(row => row.key === 'bad_counter')?.error ?? '', /outside 0\.\.99/)
  const afterCircuit = engine.dispatch({
    context: {}, event: 'enemy.death', payload: {}, scope, tick: 13,
  })
  assert.equal(afterCircuit.invocations, 1)
  assert.equal(afterCircuit.errors.length, 0)
  assert.deepEqual(
    engine.state.snapshot().cells.find(cell => cell.key === 'good_counter')?.value,
    { count: 4 },
  )
  engine.closeRun('run-1')
  assert.equal(engine.state.snapshot().cells.length, 0)
  engine.close()
  assert.equal(runtime.memoryBytes, 0)
})

test('Lua reducer migrations upgrade saved state before deterministic replay', async () => {
  const runtime = await createRuntime()
  const compiled = compileWebLuaDefinition(identity, runtime.run(MIGRATION_SCRIPT))
  const engine = new ModRuleEngine({ tickBudgetMs: 1_000 })
  engine.register(compiled, runtime)
  const checkpoint = engine.checkpoint()
  engine.restore({
    ...checkpoint,
    state: {
      cells: [{
        key: 'migrating',
        modId: identity.id,
        schemaVersion: 1,
        scope: { id: 'run-1', kind: 'party-run' },
        value: { count: 4 },
      }],
      revision: 1,
    },
  })
  assert.deepEqual(engine.state.snapshot().cells[0]?.value, { count: 4, phase: 'ready' })
  const input = {
    context: {},
    event: 'enemy.death',
    payload: {},
    scope: { id: 'run-1', kind: 'party-run' } as const,
    tick: 10,
  }
  const replayCheckpoint = engine.checkpoint()
  const first = engine.dispatch(input)
  engine.restore(replayCheckpoint)
  const replay = engine.dispatch(input)
  assert.deepEqual(replay.intents, first.intents)
  engine.close()
})

test('tick budget prevents reducer entry without partial state', async () => {
  const runtime = await createRuntime()
  const compiled = compileWebLuaDefinition(identity, runtime.run(SCRIPT))
  let now = 0
  const engine = new ModRuleEngine({ now: () => {
    const value = now
    now += 10
    return value
  } })
  engine.register(compiled, runtime)
  const result = engine.dispatch({
    context: {},
    event: 'enemy.death',
    payload: {},
    scope: { id: 'run-1', kind: 'party-run' },
    tick: 1,
  })
  assert.equal(result.budgetExceeded, true)
  assert.equal(result.invocations, 0)
  assert.equal(engine.state.snapshot().cells.length, 0)
  engine.close()
})

test('after and bounded every rules use fixed ticks and survive checkpoint rollback', async () => {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  const compiled = compileWebLuaDefinition(identity, runtime.run(TIMER_SCRIPT))
  const engine = new ModRuleEngine({ tickBudgetMs: 1_000, ticksPerSecond: 100 })
  engine.register(compiled, runtime)
  const scope = { id: 'run-1', kind: 'party-run' } as const
  const scheduled = engine.dispatch({
    context: { participant_id: 'player-1' },
    event: 'run.started',
    payload: { run_id: 'run-1' },
    scope,
    tick: 10,
  })
  assert.deepEqual(scheduled.intents, [])
  assert.equal(engine.checkpoint().timers.length, 2)
  assert.deepEqual(engine.dueTimerIds(11), [])

  const every = engine.fireTimer(engine.dueTimerIds(12)[0]!, 12)
  assert.deepEqual(every.result.intents.map(intent => intent.fields.key), ['every'])
  const afterEvery = engine.checkpoint()
  assert.deepEqual(afterEvery.timers.map(timer => [timer.dueTick, timer.remaining]), [
    [13, 1],
    [14, 1],
  ])
  const after = engine.fireTimer(engine.dueTimerIds(13)[0]!, 13)
  assert.deepEqual(after.result.intents.map(intent => intent.fields.key), ['after'])
  engine.rollback(afterEvery)
  assert.equal(engine.dueTimerIds(13).length, 1)
  engine.fireTimer(engine.dueTimerIds(13)[0]!, 13)
  const final = engine.fireTimer(engine.dueTimerIds(14)[0]!, 14)
  assert.deepEqual(final.result.intents.map(intent => intent.fields.key), ['every'])
  assert.equal(engine.checkpoint().timers.length, 0)
  engine.close()
})

async function createRuntime(): Promise<WebLuaDefinitionRuntime> {
  return WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
}

const SCRIPT = `
local counter_state = sd.schema.object({
  count = sd.schema.integer({default = 0, min = 0, max = 99}),
})
local good = sd.advanced.reducer({
  key = "good_counter",
  scope = "party-run",
  schema_version = 1,
  state = counter_state,
  on = {"enemy.death"},
  reduce = function(state, event, context)
    local roll = context.random("reward")
    assert(roll >= 0 and roll < 1)
    return {count = state.count + 1}, {
      sd.intent.state({key = "counted", value = state.count + 1}),
    }
  end,
})
local bad = sd.advanced.reducer({
  key = "bad_counter",
  scope = "party-run",
  schema_version = 1,
  state = counter_state,
  on = {"enemy.death"},
  reduce = function(state, event, context)
    return {count = 200}, {sd.intent.spawn({enemy = "never"})}
  end,
})
return sd.mod({
  api = "1.0.0",
  rules = {
    sd.rules.on("enemy.death", sd.effect.state({key = "reward", value = true})),
  },
  systems = {good, bad},
})
`

const TIMER_SCRIPT = `
return sd.mod({
  api = "1.0.0",
  rules = {
    sd.rules.on("run.started", sd.rules.all({
      sd.rules.after("30ms", sd.effect.state({key = "after", value = true})),
      sd.rules.every("20ms", sd.effect.state({key = "every", value = true}), {times = 2}),
    })),
  },
})
`

const MIGRATION_SCRIPT = `
local state = sd.schema.object({
  count = sd.schema.integer({default = 0, min = 0, max = 99}),
  phase = sd.schema.enum({"ready", "done"}),
})
local system = sd.advanced.reducer({
  key = "migrating",
  scope = "party-run",
  schema_version = 2,
  migrations = {
    [1] = function(old) return {count = old.count, phase = "ready"} end,
  },
  state = state,
  on = {"enemy.death"},
  reduce = function(current, event, context)
    return {count = current.count + 1, phase = current.phase}, {
      sd.intent.state({key = "migrated", value = current.count + 1}),
    }
  end,
})
return sd.mod({api = "1.0.0", systems = {system}})
`

const PREDICATE_SCRIPT = `
sd.on("wave.completed",
  sd.when({context = "wave", at_least = 3}, sd.effect.state({key = "late", value = true})),
  sd.when({any = {{context = "wave", equals = 1}, {context = "boss", equals = true}}}, sd.effect.state({key = "special", value = true})),
  sd.when({none = {{context = "wave", above = 10}}}, sd.effect.state({key = "early", value = true})),
  sd.when({all = {{context = "wave", below = 3}, {context = "label", not_equals = "skip"}}}, sd.effect.state({key = "fresh", value = true}))
)
`

test('when predicates compare context values and combine with all, any, and none', async () => {
  const runtime = await createRuntime()
  const compiled = compileWebLuaDefinition(identity, runtime.run(PREDICATE_SCRIPT))
  const engine = new ModRuleEngine({ tickBudgetMs: 1_000 })
  engine.register(compiled, runtime)
  const scope = { id: 'run-1', kind: 'party-run' } as const
  const keys = (context: Record<string, boolean | number | string>) => engine.dispatch({
    context,
    event: 'wave.completed',
    payload: {},
    scope,
    tick: 10,
  }).intents.map(intent => intent.fields.key)
  assert.deepEqual(keys({ wave: 3 }), ['late', 'early'])
  assert.deepEqual(keys({ label: 'skip', wave: 1 }), ['special', 'early'])
  assert.deepEqual(keys({ boss: true, wave: 11 }), ['late', 'special'])
  assert.deepEqual(keys({ label: 'go', wave: 2 }), ['early', 'fresh'])
  assert.deepEqual(keys({}), ['early'])
  engine.close()
})

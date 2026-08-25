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
    { kind: 'grant', owner: 'rule' },
    { kind: 'emit', owner: 'good_counter' },
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
  const afterCircuit = engine.dispatch({
    context: {}, event: 'enemy.death', payload: {}, scope, tick: 13,
  })
  assert.equal(afterCircuit.invocations, 1)
  assert.equal(afterCircuit.errors.length, 0)
  assert.deepEqual(
    engine.state.snapshot().cells.find(cell => cell.key === 'good_counter')?.value,
    { count: 4 },
  )
  engine.close()
  assert.equal(runtime.memoryBytes, 0)
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
      sd.intent.emit({name = "counted", count = state.count + 1}),
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
    sd.rules.on("enemy.death", sd.effect.grant({item = "stock.health_potion"})),
  },
  systems = {good, bad},
})
`

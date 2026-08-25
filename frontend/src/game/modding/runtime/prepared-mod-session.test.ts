import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

import {
  compileWebLuaDefinition,
  WebLuaDefinitionRuntime,
} from '../definition/index.ts'
import type {
  ModIntent,
} from './mod-rule-engine.ts'
import type {
  ModIntentAdapter,
  ModIntentExecutionContext,
} from './mod-intent-executor.ts'
import { prepareModSession } from './prepared-mod-session.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')
const identity = Object.freeze({ id: 'example.session', name: 'Session', version: '1.0.0' })
const SCRIPT = `
local state = sd.schema.object({
  count = sd.schema.integer({default = 0, min = 0, max = 99}),
})
local reducer = sd.advanced.reducer({
  key = "counter",
  scope = "party-run",
  schema_version = 1,
  state = state,
  on = {"enemy.death", "action.reward"},
  reduce = function(current, event, context)
    return {count = current.count + 1}, {
      sd.intent.grant({item = "stock.health_potion"}),
    }
  end,
})
return sd.mod({api = "1.0.0", systems = {reducer}})
`

test('prepared session commits one atomic intent transaction and projects state', async () => {
  const prepared = await source()
  const committed: ModIntent[][] = []
  const session = await prepareModSession({
    adapter: adapter({ commit: intents => committed.push([...intents]) }),
    mods: [prepared],
    wasmPath,
  })
  const scope = { id: 'run-1', kind: 'party-run' } as const
  try {
    const result = session.step({
      events: [{ context: {}, event: 'enemy.death', payload: {}, scope }],
      tick: 1,
    })
    assert.equal(result.accepted, true)
    assert.equal(committed.length, 1)
    assert.equal(committed[0]?.[0]?.kind, 'grant')
    assert.deepEqual(session.project('player-1').state.cells[0]?.value, { count: 1 })
    assert.equal(session.catalog()[0]?.graphSha256, prepared.compiled.graphSha256)
    assert.deepEqual(session.checkpoint().graphSha256, [prepared.compiled.graphSha256])

    const action = session.act({
      action: 'reward',
      context: {},
      event: 'ignored',
      payload: {},
      requestId: 7,
      scope,
      tick: 2,
    })
    assert.equal(action.accepted, true)
    assert.deepEqual(session.project('player-1').state.cells[0]?.value, { count: 2 })
  } finally {
    session.close()
  }
  assert.throws(() => session.catalog(), /closed/)
})

test('adapter rejection rolls back reducer state and prepared intents', async () => {
  const prepared = await source()
  let rolledBack = 0
  const session = await prepareModSession({
    adapter: adapter({
      commit: () => { throw new Error('inventory full') },
      rollback: () => { rolledBack += 1 },
    }),
    mods: [prepared],
    wasmPath,
  })
  const result = session.step({
    events: [{
      context: {},
      event: 'enemy.death',
      payload: {},
      scope: { id: 'run-1', kind: 'party-run' },
    }],
    tick: 1,
  })
  assert.equal(result.accepted, false)
  assert.match(result.errors.at(-1)!, /inventory full/)
  assert.equal(rolledBack, 1)
  assert.equal(session.checkpoint().state.cells.length, 0)
  session.close()
})

test('prepared session rejects a source whose compiled graph was tampered', async () => {
  const prepared = await source()
  await assert.rejects(() => prepareModSession({
    adapter: adapter({}),
    mods: [{
      ...prepared,
      compiled: { ...prepared.compiled, graphSha256: '0'.repeat(64) },
    }],
    wasmPath,
  }), /compiled Web Lua graph changed/)
})

function adapter(options: Readonly<{
  commit?: (intents: readonly ModIntent[], context: ModIntentExecutionContext) => void
  rollback?: (reason: string) => void
}>): ModIntentAdapter {
  return {
    prepare(intents, context) {
      return {
        commit: () => options.commit?.(intents, context),
        rollback: reason => options.rollback?.(reason),
      }
    },
  }
}

async function source() {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  try {
    return {
      compiled: compileWebLuaDefinition(identity, runtime.run(SCRIPT)),
      entryScript: SCRIPT,
      entryScriptPath: 'scripts/main.lua',
      identity,
    }
  } finally {
    runtime.close()
  }
}

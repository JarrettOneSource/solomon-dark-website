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
  on = {"enemy.death", "action.shop.purchase"},
  reduce = function(current, event, context)
    return {count = current.count + 1}, {
      sd.intent.state({key = "rewarded", value = true}),
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
    assert.equal(committed[0]?.[0]?.kind, 'state')
    assert.deepEqual(session.project('player-1').state.cells[0]?.value, { count: 1 })
    assert.equal(session.catalog()[0]?.graphSha256, prepared.compiled.graphSha256)
    assert.deepEqual(session.checkpoint().graphSha256, [prepared.compiled.graphSha256])

    const action = session.act({
      action: 'shop.purchase',
      context: {},
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

test('prepared session expands potion on_use into validated content action intents', async () => {
  const prepared = await definitionSource(`
local status = sd.kit.status({
  key = "shielded",
  duration = "1s",
  modifiers = {incoming_damage = 0},
})
local potion = sd.kit.potion({
  key = "shield_potion",
  name = "Shield Potion",
  duration = "1s",
  status = sd.ref("status", "shielded"),
  on_use = sd.rules.all({
    sd.effect.resource({target = "user", mana = "full"}),
    sd.effect.status({target = "user", status = sd.ref("status", "shielded")}),
  }),
})
return sd.mod({api = "1.0.0", content = {status, potion}})
`)
  const committed: ModIntent[][] = []
  const session = await prepareModSession({
    adapter: adapter({ commit: intents => committed.push([...intents]) }),
    mods: [prepared],
    wasmPath,
  })
  const potion = prepared.compiled.content.find(content => content.contentKind === 'potion')!
  try {
    const result = session.act({
      action: 'content.use',
      context: { participant_id: 'player-1' },
      payload: { content_id: potion.contentId },
      requestId: 8,
      scope: { id: 'player-1:run-1', kind: 'participant-run' },
      tick: 4,
    })
    assert.equal(result.accepted, true)
    assert.deepEqual(result.intents.map(intent => intent.kind), ['resource', 'status'])
    assert.equal(committed.length, 1)
  } finally {
    session.close()
  }
})

test('content actions also dispatch a stable generic event for reducers', async () => {
  const prepared = await definitionSource(`
local state = sd.schema.object({
  casts = sd.schema.integer({default = 0, min = 0, max = 9}),
})
local focus = sd.kit.status({key = "focus", duration = "1s"})
local counter = sd.advanced.reducer({
  key = "cast_counter",
  scope = "participant-run",
  schema_version = 1,
  state = state,
  on = {"action.content.cast"},
  reduce = function(current)
    return {casts = current.casts + 1}, {
      sd.intent.state({key = "cast.counted", value = current.casts + 1}),
      sd.intent.status({target = "caster", status = sd.ref("status", "focus")}),
    }
  end,
})
local spell = sd.kit.spell({
  key = "lesson",
  name = "Lesson",
  slot = "secondary",
  behavior = sd.prefab.area({
    radius = 20,
    duration = "1s",
    every = "250ms",
    effects = {sd.effect.damage({target = "hostiles_in_area", amount = 1})},
  }),
  art = {icon = sd.art.ref("icon")},
})
local icon = sd.art.sprite("art/icon.png")
return sd.mod({api = "1.0.0", assets = {icon = icon}, content = {focus, spell}, systems = {counter}})
`)
  const committed: ModIntent[][] = []
  const session = await prepareModSession({
    adapter: adapter({ commit: intents => committed.push([...intents]) }),
    mods: [prepared],
    wasmPath,
  })
  try {
    const spell = prepared.compiled.content.find(content => content.contentKind === 'spell')!
    const result = session.act({
      action: 'content.cast',
      context: { participant_id: 'player-1' },
      payload: { content_id: spell.contentId },
      requestId: 1,
      scope: { id: 'player-1:run-1', kind: 'participant-run' },
      tick: 1,
    })
    assert.equal(result.accepted, true, result.errors.join('; '))
    assert.deepEqual(result.intents.map(intent => intent.kind), ['spell-effect', 'state', 'status'])
    assert.deepEqual(result.intents[2]?.fields.status, {
      contentId: prepared.compiled.content.find(content => content.key === 'focus')?.contentId,
      key: 'focus',
      kind: 'resolved-content-reference',
      modId: identity.id,
      targetKind: 'status',
    })
    assert.deepEqual(session.checkpoint().state.cells[0]?.value, { casts: 1 })
    assert.equal(committed.length, 1)
  } finally {
    session.close()
  }
})

test('prepared session executes and restores scheduled rules without requiring a new event', async () => {
  const prepared = await definitionSource(`
return sd.mod({
  api = "1.0.0",
  rules = {
    sd.rules.on("run.started", sd.rules.after(
      "10ms",
      sd.effect.state({key = "ready", value = true})
    )),
  },
})
`)
  const committed: ModIntent[][] = []
  const session = await prepareModSession({
    adapter: adapter({ commit: intents => committed.push([...intents]) }),
    mods: [prepared],
    wasmPath,
  })
  const scope = { id: 'run-1', kind: 'party-run' } as const
  try {
    session.step({
      events: [{ context: {}, event: 'run.started', payload: {}, scope }],
      tick: 1,
    })
    const scheduled = session.checkpoint()
    assert.equal(scheduled.timers.length, 1)
    const fired = session.step({ events: [], tick: 2 })
    assert.equal(fired.accepted, true)
    assert.deepEqual(fired.intents.map(intent => intent.fields.key), ['ready'])
    session.restore(scheduled)
    const repeated = session.step({ events: [], tick: 2 })
    assert.deepEqual(repeated.intents.map(intent => intent.fields.key), ['ready'])
  } finally {
    session.close()
  }
  assert.equal(committed.length, 2)
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
  return definitionSource(SCRIPT)
}

async function definitionSource(script: string) {
  const runtime = await WebLuaDefinitionRuntime.create({
    entryScript: 'scripts/main.lua',
    identity,
    wasmPath,
  })
  try {
    return {
      compiled: compileWebLuaDefinition(identity, runtime.run(script)),
      entryScript: script,
      entryScriptPath: 'scripts/main.lua',
      identity,
    }
  } finally {
    runtime.close()
  }
}

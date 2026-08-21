import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import test from 'node:test'

import {
  WEB_LUA_CAPABILITIES,
  type WebLuaExecutionResult,
  type WebLuaFrameState,
} from './web-lua-contract.ts'
import { WebLuaRuntime } from './web-lua-runtime.ts'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('wasmoon/dist/glue.wasm')

function frame(overrides: Partial<WebLuaFrameState> = {}): WebLuaFrameState {
  return {
    authorityPlayerId: 'player-1',
    boneyardSeed: null,
    enemies: [],
    multiplayer: false,
    phase: 'hub',
    playerCount: 1,
    players: [{
      currentHealth: 50,
      currentMana: 100,
      deathTick: 0,
      discipline: 'arcane',
      displayName: 'Lua Wizard',
      element: 'fire',
      experience: 0,
      gold: 10_000,
      id: 'player-1',
      level: 1,
      lifeState: 'alive',
      maximumHealth: 50,
      maximumMana: 100,
      pendingLevelUp: false,
      position: { x: 10, y: 20 },
    }],
    runId: null,
    scene: 'hub.courtyard',
    tick: 0,
    waves: null,
    world: 'hub',
    ...overrides,
  }
}

async function runtimeHarness(initialFrame = frame(), useRealClock = false) {
  let currentFrame = initialFrame
  const logs: Array<{ detail: string; event: string; level: string }> = []
  const runtime = await WebLuaRuntime.create({
    bindings: {
      getAuthorityPlayerId: () => currentFrame.authorityPlayerId,
      getFrame: () => currentFrame,
    },
    log: (level, event, detail) => logs.push({ detail, event, level }),
    now: useRealClock ? performance.now.bind(performance) : () => 0,
    wasmPath,
  })
  const execute = (code: string, tick = currentFrame.tick + 1) => {
    let result!: WebLuaExecutionResult
    assert.equal(runtime.enqueueExecution({
      code,
      playerId: 'player-1',
      respond: (value) => { result = value },
    }), true)
    currentFrame = { ...currentFrame, tick }
    runtime.beginTick(tick)
    return result
  }
  return {
    execute,
    frame: () => currentFrame,
    logs,
    runtime,
    setFrame: (value: WebLuaFrameState) => { currentFrame = value },
  }
}

test('web Lua runtime is Lua 5.4, persistent, bounded, and stripped of unsafe libraries', async () => {
  const harness = await runtimeHarness()
  try {
    const first = harness.execute(`
      persistent = 41
      print('lua', _VERSION)
      return _VERSION, sd.runtime.api_version, sd.runtime.get_capabilities(),
        sd.runtime.get_mod(), {
        io = io, os = os, package = package, require = require, load = load,
        debug = debug, coroutine = coroutine, audio = sd.audio, draw = sd.draw,
      }
    `)
    assert.equal(first.ok, true)
    assert.deepEqual(first.output, ['lua\tLua 5.4'])
    assert.equal(first.values[0], 'Lua 5.4')
    assert.equal(first.values[1], '0.2.0')
    assert.deepEqual(first.values[2], [...WEB_LUA_CAPABILITIES])
    assert.deepEqual(first.values[3], {
      api_version: '0.2.0',
      id: 'web.dev-console',
      name: 'Browser Dev Console',
      version: '0.2.0',
    })
    assert.deepEqual(first.values[4], {})
    assert.deepEqual(harness.execute('persistent = persistent + 1; return persistent').values, [42])

    const runaway = harness.execute('while true do end')
    assert.equal(runaway.ok, false)
    assert.match(runaway.error ?? '', /thread timeout exceeded/)
    assert.deepEqual(harness.execute('return persistent').values, [42])

    assert.deepEqual(
      harness.execute('return sd.rng.set_seed(42), sd.rng.get_seed()').values,
      [42, 42],
    )
    assert.deepEqual(harness.runtime.drainCommands(), [
      { seed: 42, type: 'set-next-run-seed' },
    ])

    const memory = harness.execute('return string.rep("x", 32 * 1024 * 1024)')
    assert.equal(memory.ok, false)
    assert.match(memory.error ?? '', /memory|allocation/i)
    assert.ok(harness.runtime.metrics.memoryBytes <= 16 * 1024 * 1024)
  } finally {
    harness.runtime.close()
  }
})

test('web Lua exposes state, timers, events, semantic reads, and bounded commands', async () => {
  const boneyard = frame({
    boneyardSeed: '0000002a' + '00'.repeat(12),
    enemies: [{
      health: 10,
      id: 7,
      lifeState: 'alive',
      maximumHealth: 10,
      position: { x: 30, y: 40 },
      token: 'SKELETON',
    }],
    phase: 'active',
    runId: 'run-lua',
    scene: 'Random Boneyard',
    waves: { phase: 'wave-threshold', wave_ordinal: 1 },
    world: 'boneyard',
  })
  const harness = await runtimeHarness(boneyard)
  try {
    const registered = harness.execute(`
      sd.state.set('counter', 1)
      sd.events.on('runtime.tick', function(event)
        sd.state.set('counter', sd.state.get('counter') + 1)
      end)
      sd.timer.after(10, function()
        sd.state.set('timer', event_value or 9)
      end)
      sd.timer.sequence({
        {delay_ms = 0, callback = function() sd.state.set('sequence', 'a') end},
        {delay_ms = 10, callback = function() sd.state.set('sequence', 'b') end},
      })
      return sd.player.get_state().display_name,
        sd.world.get_state().enemy_count,
        sd.waves.get_state().wave_ordinal,
        sd.scene.get_state().kind,
        sd.enemies.get('skeleton').key,
        sd.state.get('missing', 'fallback'),
        sd.state.get_revision(),
        sd.state.is_authority()
    `, 1)
    assert.deepEqual(registered.values, [
      'Lua Wizard',
      1,
      1,
      'arena',
      'skeleton',
      'fallback',
      1,
      true,
    ])
    harness.setFrame({ ...harness.frame(), tick: 2 })
    harness.runtime.beginTick(2)
    harness.runtime.beginTick(3)
    const state = harness.execute('return sd.state.snapshot()', 4)
    assert.deepEqual(state.values, [{ counter: 4, sequence: 'b', timer: 9 }])
    assert.equal(harness.execute("return sd.state.set('nil', nil)", 5).ok, false)

    const commands = harness.execute(`
      sd.player.restore_health(10)
      sd.player.restore_mana()
      sd.player.set_mana(75)
      sd.player.set_gold(1234)
      sd.player.grant_experience(50)
      return sd.enemies.spawn('skeleton', {x = 60, y = 70}).request_id
    `, 6)
    assert.deepEqual(commands.values, [1])
    assert.deepEqual(harness.runtime.drainCommands(), [
      { amount: 10, playerId: 'player-1', type: 'restore-health' },
      { amount: 0, playerId: 'player-1', type: 'restore-mana' },
      { playerId: 'player-1', type: 'set-mana', value: 75 },
      { playerId: 'player-1', type: 'set-gold', value: 1234 },
      { amount: 50, playerId: 'player-1', type: 'grant-experience' },
      { requestId: 1, token: 'SKELETON', type: 'spawn-enemy', x: 60, y: 70 },
    ])
  } finally {
    harness.runtime.close()
  }
})

test('web Lua retires failing callbacks and pending requests without harming the host', async () => {
  const harness = await runtimeHarness()
  try {
    harness.execute(`
      sd.events.on('runtime.tick', function() while true do end end)
      sd.timer.every(10, function() error('timer failed') end)
    `)
    harness.runtime.beginTick(2)
    assert.equal(harness.runtime.metrics.callbackCount, 0)
    assert.equal(harness.runtime.metrics.timerCount, 0)
    assert.ok(harness.logs.some(({ event }) => event === 'lua.callback_failed'))

    const closedResults: WebLuaExecutionResult[] = []
    assert.equal(harness.runtime.enqueueExecution({
      code: 'return 1',
      playerId: 'player-1',
      respond: (result) => { closedResults.push(result) },
    }), true)
    harness.runtime.close()
    assert.equal(closedResults[0]?.ok, false)
    assert.match(closedResults[0]?.error ?? '', /closed/)
  } finally {
    harness.runtime.close()
  }
})

test('web Lua delivers lifecycle events and rejects queued work after authority changes', async () => {
  const harness = await runtimeHarness()
  try {
    harness.execute(`
      sd.events.on('run.started', function(event)
        sd.state.set('run', event.run_id)
      end)
    `, 1)
    assert.equal(harness.runtime.wantsEvent('run.started'), true)
    harness.runtime.dispatch('run.started', {
      event: 'run.started',
      run_id: 'run-authority',
      tick: 1,
    })
    assert.deepEqual(harness.execute("return sd.state.get('run')", 2).values, [
      'run-authority',
    ])

    const responses: WebLuaExecutionResult[] = []
    for (let index = 0; index < 8; index += 1) {
      assert.equal(harness.runtime.enqueueExecution({
        code: 'sd.player.set_gold(1)',
        playerId: 'player-1',
        respond: (result) => { responses.push(result) },
      }), true)
    }
    assert.equal(harness.runtime.enqueueExecution({
      code: 'return 9',
      playerId: 'player-1',
      respond: (result) => { responses.push(result) },
    }), false)
    harness.setFrame({ ...harness.frame(), authorityPlayerId: 'player-2' })
    harness.runtime.beginTick(3)
    assert.equal(responses[0]?.ok, false)
    assert.match(responses[0]?.error ?? '', /authority changed/)
    assert.deepEqual(harness.runtime.drainCommands(), [])
    harness.runtime.close()
    assert.equal(responses.length, 8)
    assert.ok(responses.every(({ ok }) => !ok))
  } finally {
    harness.runtime.close()
  }
})

test('web Lua trivial execution stays below the fixed-tick budget', async () => {
  const harness = await runtimeHarness(frame(), true)
  try {
    const samples: number[] = []
    for (let index = 0; index < 200; index += 1) {
      const started = performance.now()
      const result = harness.execute('return 1 + 1', index + 1)
      samples.push(performance.now() - started)
      assert.deepEqual(result.values, [2])
    }
    samples.sort((left, right) => left - right)
    const p95 = samples[Math.floor(samples.length * 0.95)]!
    const p99 = samples[Math.floor(samples.length * 0.99)]!
    assert.ok(p95 < 10, `Lua execution p95 ${p95.toFixed(3)} ms exceeds one fixed tick`)
    assert.ok(p99 < 20, `Lua execution p99 ${p99.toFixed(3)} ms exceeds two fixed ticks`)
  } finally {
    harness.runtime.close()
  }
})

test('mod entry scripts and state remain isolated and restore by VM', async () => {
  const create = async (id: string, value: number) => {
    const runtime = await WebLuaRuntime.create({
      bindings: {
        getAuthorityPlayerId: () => 'player-1',
        getFrame: () => frame(),
      },
      mod: { id, name: id, version: '1.0.0' },
      wasmPath,
    })
    runtime.runEntrypoint(`sd.state.set('value', ${value})`)
    return runtime
  }
  const first = await create('tests.first', 1)
  const second = await create('tests.second', 2)
  try {
    assert.deepEqual(first.snapshotState(), { value: 1 })
    assert.deepEqual(second.snapshotState(), { value: 2 })
    first.restoreState({ restored: true, value: 7 })
    assert.deepEqual(first.snapshotState(), { restored: true, value: 7 })
    assert.deepEqual(second.snapshotState(), { value: 2 })
  } finally {
    first.close()
    second.close()
  }
})

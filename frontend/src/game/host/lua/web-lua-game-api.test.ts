import assert from 'node:assert/strict'
import { parse, resolve } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import { createGameSimulation, enterBoneyardWorld } from '../../core-server/game-simulation.ts'
import { DEFAULT_PLAYER_CHARACTER_CONFIG } from '../../core-server/game-simulation.ts'
import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import {
  applyWebLuaCommands,
  createWebLuaFrameState,
  deriveWebLuaEvents,
} from './web-lua-game-api.ts'
import { resolveWebLuaWasmPath } from './web-lua-wasm-path.ts'

test('web Lua resolves source and deployed WASM ownership without directory-name assumptions', () => {
  const root = parse(process.cwd()).root
  const sourceEntry = resolve(root, 'repo', 'frontend', 'src', 'game', 'host', 'run-game-host.ts')
  const deployedEntry = resolve(
    root,
    'opt',
    'solomon-dark-revived',
    'GameHost',
    'game-host.mjs',
  )
  assert.equal(
    resolveWebLuaWasmPath(pathToFileURL(sourceEntry).href),
    resolve(root, 'repo', 'frontend', 'node_modules', 'wasmoon', 'dist', 'glue.wasm'),
  )
  assert.equal(
    resolveWebLuaWasmPath(pathToFileURL(deployedEntry).href),
    resolve(root, 'opt', 'solomon-dark-revived', 'GameHost', 'lua54.wasm'),
  )
})

const loaded: LoadedBoneyard = {
  choice: { id: 'lua-map', name: 'Lua Map', source: 'mod', modId: 'lua', modName: 'Lua' },
  geometrySha256: '1'.repeat(64),
  runId: 'run-lua',
  scene: {
    bounds: { h: 1_000, w: 1_000, x: 0, y: 0 },
    environmentMode: 0,
    fences: [],
    name: 'Lua Map',
    objects: [],
    roads: [],
    solomonDig: null,
    spawn: { facingDeg: 0, x: 100, y: 100 },
    sprites: [],
    terrain: [],
  },
  seed: '0'.repeat(32),
  sourceSha256: '2'.repeat(64),
}

test('web Lua frame and commands use existing authoritative player and enemy owners', () => {
  const hub = createGameSimulation({ 'player-1': DEFAULT_PLAYER_CHARACTER_CONFIG })
  const frame = createWebLuaFrameState(hub, 'player-1', null)
  assert.equal(frame.world, 'hub')
  assert.equal(frame.players[0]?.gold, 500)

  const applied = applyWebLuaCommands(hub, [
    { playerId: 'player-1', type: 'set-gold', value: 321 },
    { playerId: 'player-1', type: 'set-mana', value: 25 },
    { amount: 5, playerId: 'player-1', type: 'restore-mana' },
    { seed: 42, type: 'set-next-run-seed' },
  ])
  const changed = createWebLuaFrameState(applied.state, 'player-1', null)
  assert.equal(changed.players[0]?.gold, 321)
  assert.equal(changed.players[0]?.currentMana, 30)
  assert.equal(applied.nextRunSeed, 42)

  const active = enterBoneyardWorld(applied.state, loaded)
  const spawned = applyWebLuaCommands(active, [{
    requestId: 7,
    token: 'SKELETON',
    type: 'spawn-enemy',
    x: 200,
    y: 220,
  }])
  assert.deepEqual(spawned.enemySpawnIntents, [{
    enemyToken: 'SKELETON',
    flags: [],
    id: 0x4000_0007,
    locationPolicy: 'anywhere',
    nativeTypeId: 1001,
    position: { x: 200, y: 220 },
    spawnTick: active.tick + 1,
    waveOrdinal: 0,
  }])
})

test('web Lua derives run lifecycle events without inventing presentation events', () => {
  const hub = createGameSimulation({ 'player-1': DEFAULT_PLAYER_CHARACTER_CONFIG })
  const active = enterBoneyardWorld(hub, loaded)
  assert.deepEqual(deriveWebLuaEvents(hub, active), [{
    name: 'run.started',
    payload: { event: 'run.started', run_id: 'run-lua', tick: active.tick },
  }])
})

test('web Lua derives existing gold and level semantic events in player order', () => {
  const hub = createGameSimulation({ 'player-1': DEFAULT_PLAYER_CHARACTER_CONFIG })
  const changed = applyWebLuaCommands(hub, [
    { playerId: 'player-1', type: 'set-gold', value: 400 },
    { amount: 10_000, playerId: 'player-1', type: 'grant-experience' },
  ]).state
  const events = deriveWebLuaEvents(hub, changed)
  assert.deepEqual(events.map(({ name }) => name), ['gold.changed', 'level.up'])
  assert.deepEqual(events[0]?.payload, {
    delta: -100,
    event: 'gold.changed',
    gold: 400,
    player_id: 'player-1',
    source: 'web-authority',
  })
})

import assert from 'node:assert/strict'
import { parse, resolve } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

import {
  createGameSimulation,
  enterBoneyardWorld,
  getPlayerEconomy,
  getPlayerProgression,
  grantGameSimulationPlayerExperience,
  type GameSimulationState,
} from '../../core-server/game-simulation.ts'
import { DEFAULT_PLAYER_CHARACTER_CONFIG } from '../../core-server/game-simulation.ts'
import {
  HUB_ITEM_KINDS,
  hubEconomyInventoryIsValid,
} from '../../core-kernels/hub-economy.ts'
import { playerSkillBookAt } from '../../core-server/player-entity-store.ts'
import type { LoadedBoneyard } from '../../core-kernels/boneyard.ts'
import {
  createBoneyardWaveDirector,
  stepBoneyardWaveDirector,
} from '../../core-kernels/boneyard-wave-director.ts'
import type { WaveDef } from '../../core-kernels/boneyard-wave-schema.ts'
import type { BoneyardWaveDirectorState } from '../../core-kernels/boneyard-wave-types.ts'
import { NATIVE_SURVIVAL_BOSS_SOURCES } from '../../core-kernels/native-survival-boss-catalog.ts'
import { createNativeTutorialState } from '../../core-kernels/native-tutorial.ts'
import {
  applyWebLuaCommands,
  createWebLuaFrameState,
  deriveWebLuaEvents,
} from './web-lua-game-api.ts'
import {
  WEB_LUA_DEVELOPER_ITEMS,
  WEB_LUA_DEVELOPER_SKILLS,
  WEB_LUA_DEVELOPER_WELDS,
} from './web-lua-developer-grants.ts'
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

test('next-wave requests start the authored row once and leave existing world actors intact', () => {
  const hub = createGameSimulation({ 'player-1': DEFAULT_PLAYER_CHARACTER_CONFIG })
  const active = enterBoneyardWorld(hub, loaded)
  assert.equal(active.world.kind, 'boneyard')
  if (active.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const director: BoneyardWaveDirectorState = {
    ...createBoneyardWaveDirector('report58', nextWaveSchedule),
    phase: 'opening-threshold',
  }
  const source = { ...active, world: { ...active.world, waves: director } }
  const request = { runId: loaded.runId, type: 'spawn-next-wave' as const, waveEventId: 0 }
  const result = applyWebLuaCommands(source, [request, request])
  assert.equal(result.state.world.kind, 'boneyard')
  if (result.state.world.kind !== 'boneyard' || result.state.world.waves === null) {
    throw new Error('Expected scheduled Boneyard')
  }
  const wave = result.state.world.waves
  assert.equal(wave.scheduleIndex, 0)
  assert.equal(wave.waveOrdinal, 1)
  assert.equal(wave.waveEventId, 1)
  assert.equal(wave.phase, 'spawning')
  assert.equal(wave.pendingSpawnBudget, 8)
  assert.equal(wave.spawnCountdown, director.compiledSchedule[0]!.bursts[0]!.startDelayTicks)
  assert.equal(result.state.tick, source.tick)
  assert.equal(result.state.playerEntities, source.playerEntities)
  assert.equal(result.state.world.enemies, source.world.enemies)
  assert.equal(result.state.world.encounter, source.world.encounter)
  assert.deepEqual(result.enemySpawnIntents, [])
  assert.deepEqual(deriveWebLuaEvents(source, result.state).map(({ name }) => name), ['wave.started'])
  let spawning = wave
  const births = []
  for (let tick = 1; tick <= 500; tick += 1) {
    const step = stepBoneyardWaveDirector(spawning, {
      bounds: loaded.scene.bounds,
      liveEnemyCount: 100,
      liveZombieCount: 0,
      players: { 'player-1': { position: loaded.scene.spawn } },
      tick,
    })
    spawning = step.director
    births.push(...step.spawnIntents)
  }
  assert.equal(births.length, 8)
  assert.ok(births.every(({ enemyToken, waveOrdinal }) => enemyToken === 'SKELETON' && waveOrdinal === 1))
  assert.equal(spawning.pendingSpawnBudget, 0)
})

test('next-wave requests preserve signed NEXT and an already selected interwave edge', () => {
  const active = enterBoneyardWorld(createGameSimulation({ 'player-1': DEFAULT_PLAYER_CHARACTER_CONFIG }), loaded)
  if (active.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  for (const phase of ['wave-threshold', 'wave-lull-delay', 'wave-lull', 'interwave'] as const) {
    const director: BoneyardWaveDirectorState = {
      ...createBoneyardWaveDirector('report58', nextWaveSchedule),
      phase,
      scheduleIndex: 1,
      waveEventId: 9,
      waveOrdinal: 9,
    }
    const result = applyWebLuaCommands({ ...active, world: { ...active.world, waves: director } }, [{
      runId: loaded.runId, type: 'spawn-next-wave', waveEventId: 9,
    }])
    if (result.state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
    assert.equal(result.state.world.waves?.scheduleIndex, 0, phase)
    assert.equal(result.state.world.waves?.waveOrdinal, 10, phase)
    assert.equal(result.state.world.waves?.waveEventId, 10, phase)
  }
  const preselected: BoneyardWaveDirectorState = {
    ...createBoneyardWaveDirector('report58', nextWaveSchedule),
    nextScheduleIndex: 0,
    phase: 'interwave',
    scheduleIndex: 1,
    waveEventId: 2,
    waveOrdinal: 2,
  }
  const result = applyWebLuaCommands({ ...active, world: { ...active.world, waves: preselected } }, [{
    runId: loaded.runId, type: 'spawn-next-wave', waveEventId: 2,
  }])
  if (result.state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  assert.equal(result.state.world.waves?.scheduleIndex, 0)
  assert.deepEqual(result.state.world.waves?.rngState, preselected.rngState)
})

test('next-wave requests reject pending births, native script holds, stale generations and unsupported worlds', () => {
  const hub = createGameSimulation({ 'player-1': DEFAULT_PLAYER_CHARACTER_CONFIG })
  const active = enterBoneyardWorld(hub, loaded)
  if (active.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const request = { runId: loaded.runId, type: 'spawn-next-wave' as const, waveEventId: 0 }
  const director = createBoneyardWaveDirector('report58', nextWaveSchedule, {
    sourceSha256: NATIVE_SURVIVAL_BOSS_SOURCES[0]!.sourceSha256,
  })
  const ready: BoneyardWaveDirectorState = { ...director, phase: 'opening-threshold' }
  const skeletonBosses = ready.skeletonBosses
  assert.ok(skeletonBosses)
  const blocked: BoneyardWaveDirectorState[] = [
    director,
    { ...ready, phase: 'opening' },
    { ...ready, phase: 'spawning' },
    { ...ready, pendingSpawnBudget: 1 },
    { ...ready, portalTimelinePaused: true },
    { ...ready, spiderState: { ...ready.spiderState, timelinePaused: true } },
    ...ready.bossEncounters.map((encounter) => ({
      ...ready, bossEncounters: [{ ...encounter, phase: 'boss-wait' as const }],
    })),
    ...(['reinforcements', 'boss-wait'] as const).map((foulshaftPhase) => ({
      ...ready, skeletonBosses: { ...skeletonBosses, foulshaftPhase },
    })),
  ]
  for (const waves of blocked) {
    const state: GameSimulationState = { ...active, world: { ...active.world, waves } }
    assert.equal(applyWebLuaCommands(state, [request]).state, state)
    assert.equal(createWebLuaFrameState(state, 'player-1', loaded).waves?.spawn_next_available, false)
  }
  const readyState = { ...active, world: { ...active.world, waves: ready } }
  assert.equal(createWebLuaFrameState(readyState, 'player-1', loaded).waves?.spawn_next_available, true)
  const leveling = grantGameSimulationPlayerExperience(readyState, 'player-1', 1000)
  assert.ok(leveling.levelUpBarrier)
  for (const state of [
    hub,
    active,
    leveling,
    { ...readyState, run: { ...readyState.run, phase: 'game-over' as const } },
    { ...readyState, world: { ...readyState.world, tutorial: createNativeTutorialState(loaded.scene.spawn, 0, loaded.seed) } },
  ]) {
    assert.equal(applyWebLuaCommands(state, [request]).state, state)
  }
  for (const stale of [{ ...request, runId: 'previous-run' }, { ...request, waveEventId: 1 }]) {
    assert.equal(applyWebLuaCommands(readyState, [stale]).state, readyState)
  }
})

const nextWaveSchedule: readonly WaveDef[] = [
  { groups: [{ entries: [{ enemy: 'SKELETON', flags: [] }] }], maxEnemies: 40, next: [1], spawn: 3, spawnDelay: [0, 0], waveDelay: [0, 0] },
  { groups: [{ entries: [{ enemy: 'ZOMBIE', flags: [] }] }], maxEnemies: 40, next: [-1], spawn: 2, spawnDelay: [0, 0], waveDelay: [0, 0] },
]

test('developer grants use complete stock catalogs and survive Hub-to-run transfer', () => {
  assert.equal(WEB_LUA_DEVELOPER_ITEMS.length, 58)
  assert.equal(WEB_LUA_DEVELOPER_ITEMS.filter(({ recipe_index }) => (
    recipe_index === null
  )).length, 11)
  assert.deepEqual(
    WEB_LUA_DEVELOPER_ITEMS
      .filter(({ recipe_index }) => recipe_index !== null)
      .map(({ recipe_index }) => recipe_index),
    Array.from({ length: 47 }, (_, index) => index),
  )
  assert.deepEqual(
    [...new Set(WEB_LUA_DEVELOPER_ITEMS.map(({ kind }) => kind))].sort(),
    HUB_ITEM_KINDS.filter(kind => kind !== 'mod-item' && kind !== 'mod-potion').sort(),
  )
  assert.equal(WEB_LUA_DEVELOPER_SKILLS.length, 72)
  assert.deepEqual(
    WEB_LUA_DEVELOPER_SKILLS.map(({ id }) => id),
    Array.from({ length: 72 }, (_, index) => index + 8),
  )
  assert.deepEqual(
    WEB_LUA_DEVELOPER_WELDS.map(({ id }) => id),
    Array.from({ length: 10 }, (_, index) => index + 1000),
  )

  const hub = createGameSimulation({
    developer: DEFAULT_PLAYER_CHARACTER_CONFIG,
    target: {
      ...DEFAULT_PLAYER_CHARACTER_CONFIG,
      displayName: 'Grant Target',
      element: 'water',
    },
  })
  const granted = applyWebLuaCommands(hub, [
    { amount: 250, playerId: 'target', type: 'grant-gold' },
    { itemKey: 'health-potion', playerId: 'target', quantity: 3, type: 'grant-item' },
    { itemKey: 'equipment:0', playerId: 'target', quantity: 1, type: 'grant-item' },
    { playerId: 'target', ranks: 2, skillId: 72, type: 'grant-skill' },
    { buildId: 1000, playerId: 'target', type: 'grant-weld' },
  ]).state
  const economy = getPlayerEconomy(granted, 'target')
  const skillBook = playerSkillBookAt(granted.playerEntities, 'target')!
  assert.equal(economy.gold, 750)
  assert.equal(
    economy.backpack.find(({ kind }) => kind === 'health-potion')?.quantity,
    4,
  )
  assert.ok(economy.backpack.some(({ recipeIndex }) => recipeIndex === 0))
  assert.equal(skillBook.permanentRanks[72], 2)
  assert.equal(skillBook.advancedUnlocks[0], true)
  assert.equal(skillBook.primarySkillId, 52)
  assert.equal(skillBook.weldBuildId, 1000)
  assert.equal(
    granted.playerEntities.primaryCasts[
      granted.playerEntities.identities.findIndex(({ playerId }) => playerId === 'target')
    ]?.selectedPrimaryId,
    1000,
  )
  assert.ok(hubEconomyInventoryIsValid(economy))

  const active = enterBoneyardWorld(granted, loaded)
  const activeEconomy = getPlayerEconomy(active, 'target')
  const activeSkillBook = playerSkillBookAt(active.playerEntities, 'target')!
  assert.equal(activeEconomy.gold, 750)
  assert.equal(
    activeEconomy.backpack.find(({ kind }) => kind === 'health-potion')?.quantity,
    4,
  )
  assert.ok(activeEconomy.backpack.some(({ recipeIndex }) => recipeIndex === 0))
  assert.equal(activeSkillBook.permanentRanks[72], 2)
  assert.equal(activeSkillBook.primarySkillId, 52)
  assert.equal(activeSkillBook.weldBuildId, 1000)
  assert.equal(
    active.playerEntities.primaryCasts[
      active.playerEntities.identities.findIndex(({ playerId }) => playerId === 'target')
    ]?.selectedPrimaryId,
    1000,
  )
})

test('every developer item, skill, and Weld member applies through valid player state', () => {
  let state = createGameSimulation({ target: DEFAULT_PLAYER_CHARACTER_CONFIG })
  state = applyWebLuaCommands(state, [
    ...WEB_LUA_DEVELOPER_ITEMS.map(({ key }) => ({
      itemKey: key,
      playerId: 'target',
      quantity: 1,
      type: 'grant-item' as const,
    })),
    ...WEB_LUA_DEVELOPER_SKILLS
      .filter(({ weld_only }) => !weld_only)
      .map(({ id, maximum_rank }) => ({
        playerId: 'target',
        ranks: maximum_rank,
        skillId: id,
        type: 'grant-skill' as const,
      })),
  ]).state
  const economy = getPlayerEconomy(state, 'target')
  const skillBook = playerSkillBookAt(state.playerEntities, 'target')!
  assert.ok(hubEconomyInventoryIsValid(economy))
  for (const skill of WEB_LUA_DEVELOPER_SKILLS) {
    if (skill.weld_only) continue
    assert.equal(skillBook.permanentRanks[skill.id], skill.maximum_rank, skill.name)
  }
  assert.ok(skillBook.advancedUnlocks.every(Boolean))

  for (const weld of WEB_LUA_DEVELOPER_WELDS) {
    const welded = applyWebLuaCommands(
      createGameSimulation({ target: DEFAULT_PLAYER_CHARACTER_CONFIG }),
      [{ buildId: weld.id, playerId: 'target', type: 'grant-weld' }],
    ).state
    const weldedBook = playerSkillBookAt(welded.playerEntities, 'target')!
    assert.equal(weldedBook.primarySkillId, 52, weld.name)
    assert.equal(weldedBook.weldBuildId, weld.id, weld.name)
    assert.equal(welded.playerEntities.primaryCasts[0]?.selectedPrimaryId, weld.id, weld.name)
    assert.ok(weld.component_skill_ids.every((skillId) => (
      (weldedBook.permanentRanks[skillId] ?? 0) >= 1
    )), weld.name)
  }
})

test('developer skill grants rebuild an existing level-up offer against new ranks', () => {
  const leveled = grantGameSimulationPlayerExperience(
    createGameSimulation({ target: DEFAULT_PLAYER_CHARACTER_CONFIG }),
    'target',
    100,
  )
  const before = getPlayerProgression(leveled, 'target').pendingOffer
  assert.ok(before)
  const option = before.options.find(({ skillId }) => skillId !== 52)!
  const granted = applyWebLuaCommands(leveled, [{
    playerId: 'target',
    ranks: 1,
    skillId: option.skillId,
    type: 'grant-skill',
  }]).state
  const progression = getPlayerProgression(granted, 'target')
  const skillBook = playerSkillBookAt(granted.playerEntities, 'target')!
  assert.ok(progression.pendingOffer)
  assert.equal(progression.pendingOffer.sequence, before.sequence)
  assert.notEqual(progression.pendingOffer, before)
  const rebuilt = progression.pendingOffer.options.find(({ skillId }) => (
    skillId === option.skillId
  ))
  assert.ok(rebuilt === undefined || rebuilt.targetRank > skillBook.permanentRanks[option.skillId]!)
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

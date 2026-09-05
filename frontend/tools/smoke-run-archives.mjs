import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { randomUUID } from 'node:crypto'
import { createIdlePlayerCharacterInput } from '../src/game/core-kernels/player-character.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { createGameSimulation, enterBoneyardWorld, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { prepareBoneyardWorldNavigation } from '../src/game/core-server/boneyard-world.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { RunArchiveRecorder } from '../src/game/host/run-archive.ts'
import { RunArchiveStore, readRunArchive } from '../src/game/host/run-archive-store.ts'
import { renderArchivedRun } from './render-run-archive.mjs'

const directory = await mkdtemp(join(tmpdir(), 'sdr-run-archive-smoke-'))
try {
  const loadedBoneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))
  let state = enterBoneyardWorld(createGameSimulation({
    first: { displayName: 'Archive Ether', discipline: 'body', element: 'ether' },
    second: { displayName: 'Archive Water', discipline: 'mind', element: 'water' },
  }, { gameRngSeed: 123 }), loadedBoneyard)
  state = { ...state, levelUpBarrier: null,
    world: { ...state.world, arenaTransition: null, encounter: null, waves: null } }
  prepareBoneyardWorldNavigation(state.world)
  const spawn = state.world.spawn
  const inputs = Object.fromEntries(['first', 'second'].map(playerId => [playerId, {
    ...createIdlePlayerCharacterInput(), aim: { x: spawn.x + 150, y: spawn.y },
    cast: { primary: true, quickbar: null },
  }]))
  const enemySpawnIntents = Array.from({ length: 40 }, (_, index) => ({
    enemyToken: 'SKELETON', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
    flags: [], id: index + 1, locationPolicy: 'anywhere', spawnTick: state.tick + 1,
    waveOrdinal: 1, position: {
      x: spawn.x + 150 + (index % 5) * 30, y: spawn.y - 100 + Math.floor(index / 5) * 30,
    },
  }))
  state = stepGameSimulationTick(state, inputs, { enemySpawnIntents })
  for (let index = 0; index < 30; index += 1) state = stepGameSimulationTick(state, inputs)
  assert.ok(state.world.enemies.actors.length > 0, 'the fixture must include real enemy work')
  const original = structuredClone(state)
  const captured = []
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sessionId: 'smoke', write: archive => captured.push(archive),
  })
  const overhead = []
  const simulation = []
  for (let index = -30; index < 300; index += 1) {
    const started = performance.now()
    const after = stepGameSimulationTick(state, inputs)
    const stepped = performance.now()
    recorder.observe({ before: state, after, inputs, loadedBoneyard,
      tickMs: stepped - started, behindMs: 0 })
    if (index >= 0) {
      overhead.push(performance.now() - stepped)
      simulation.push(stepped - started)
    }
  }
  assert.ok(isDeepStrictEqual(state, original), 'combat cannot mutate a retained archive checkpoint')
  recorder.close()
  assert.equal(captured.length, 1)
  const store = new RunArchiveStore(directory)
  const receipt = await store.save(captured[0])
  await store.close()
  const archive = await readRunArchive(join(directory, receipt.file))
  assert.ok(isDeepStrictEqual(archive, captured[0]))
  assert.ok(isDeepStrictEqual(
    stepGameSimulationTick(archive.worstTick.state, archive.worstTick.inputs),
    stepGameSimulationTick(state, inputs),
  ), 'the restored combat checkpoint must produce the same next state')
  const inspect = runTool('inspect', join(directory, receipt.file))
  assert.equal(inspect.runId, archive.runId)
  const benchmark = runTool('benchmark', join(directory, receipt.file), '--checkpoint', 'worst-tick', '--iterations', '2')
  assert.equal(benchmark.repeatedTickMs.count, 2)
  const noLiving = await store.save({ ...archive, id: randomUUID(), lastAlive: null, lastAliveByPlayer: new Map() })
  assert.equal(runTool('inspect', join(directory, receipt.file), '--player', 'first').tick,
    archive.lastAliveByPlayer.get('first').state.tick)
  assert.equal(runTool('inspect', join(directory, noLiving.file)).tick, null)
  const rendering = await renderArchivedRun({
    boneyard: archive.loadedBoneyard,
    snapshot: createGameSnapshot(archive.lastAlive.state, 'first'),
    playerId: 'first', headless: true, iterations: 120, width: 1600, height: 900,
  })
  assert.equal(rendering.players, 2)
  console.log(JSON.stringify({ receipt, enemyCount: state.world.enemies.actors.length,
    recorderMs: summary(overhead), simulationMs: summary(simulation), rendering }, null, 2))
} finally {
  await rm(directory, { recursive: true, force: true })
}

function runTool(...args) {
  return JSON.parse(execFileSync(process.execPath, [
    '--experimental-strip-types', 'tools/replay-run-archive.mjs', ...args,
  ], { encoding: 'utf8' }))
}

function summary(values) {
  values.sort((a, b) => a - b)
  return { mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p99: values[Math.ceil(values.length * 0.99) - 1], maximum: values.at(-1) }
}

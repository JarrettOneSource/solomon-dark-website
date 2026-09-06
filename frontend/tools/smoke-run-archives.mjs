import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { randomUUID } from 'node:crypto'
import { stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { RunArchiveRecorder } from '../src/game/host/run-archive.ts'
import { RunArchiveStore, readRunArchive } from '../src/game/host/run-archive-store.ts'
import { renderArchivedRun } from './render-run-archive.mjs'
import { createRunArchiveFixture } from './run-archive-fixture.mjs'

const directory = await mkdtemp(join(tmpdir(), 'sdr-run-archive-smoke-'))
try {
  const { loadedBoneyard, state, inputs } = createRunArchiveFixture()
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

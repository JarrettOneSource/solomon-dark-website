import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { resolveMlBotPolicySkillOffers } from '../src/game/core-server/ml-bot-policy/skill-chooser.ts'
import { RunArchiveRecorder } from '../src/game/host/run-archive.ts'
import { RunArchiveStore, readRunArchive } from '../src/game/host/run-archive-store.ts'
import { createRunArchiveFixture } from './run-archive-fixture.mjs'

const [mode, playerArgument, enemyArgument] = process.argv.slice(2)
assert.ok(mode === undefined || mode === 'on' || mode === 'off', 'Expected on, off, or no arguments')
if (mode === 'on' || mode === 'off') {
  await measure(mode === 'on', Number(playerArgument), Number(enemyArgument))
} else {
  for (const [players, enemies] of [[2, 40], [8, 200], [16, 400]]) {
    const rows = []
    for (const capture of ['off', 'on', 'on', 'off']) {
      const child = spawnSync(process.execPath, [
        '--expose-gc', '--experimental-strip-types', import.meta.filename, capture, String(players), String(enemies),
      ], { encoding: 'utf8', timeout: 180_000 })
      assert.equal(child.status, 0, child.stderr || child.stdout)
      rows.push(JSON.parse(child.stdout))
    }
    assert.equal(new Set(rows.map(row => row.hash)).size, 1, 'capture must not alter simulation output')
    const average = (capture, key) => {
      const values = rows.filter(row => row.capture === capture).map(row => row[key])
      return values.reduce((sum, value) => sum + value, 0) / values.length
    }
    console.log(JSON.stringify({ players, enemies,
      elapsedChangePercent: (average(true, 'elapsedMs') / average(false, 'elapsedMs') - 1) * 100,
      retainedHeapChangeBytes: average(true, 'retainedHeapBytes') - average(false, 'retainedHeapBytes'),
      rows,
    }))
  }
}

async function measure(capture, players, enemies) {
  assert.ok(globalThis.gc, 'Run the benchmark with --expose-gc')
  assert.ok(Number.isInteger(players) && players >= 1 && players <= 16)
  assert.ok(Number.isInteger(enemies) && enemies >= 1 && enemies <= 4_000)
  const fixture = createRunArchiveFixture(players, enemies)
  const { loadedBoneyard, inputs, playerIds } = fixture
  let state = fixture.state
  const initial = structuredClone(state)
  const archives = []
  const recorder = capture ? new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sessionId: 'benchmark', write: archive => archives.push(archive),
  }) : null
  const extensions = { filterDamage: () => 0, filterMana: input => input.delta,
    hasConsumable: () => false, createLootItems: () => [] }
  let warm = state
  for (let index = 0; index < 1000; index += 1) warm = advance(warm)
  globalThis.gc()
  const heapBefore = process.memoryUsage().heapUsed
  const recorderTimes = []
  const tickTimes = []
  const started = performance.now()
  let enemySum = 0
  let pausedTicks = 0
  const ticks = 1000
  for (let index = 0; index < ticks; index += 1) {
    const before = state
    pausedTicks += Number(state.levelUpBarrier !== null)
    const tickStarted = performance.now()
    state = advance(state)
    const stepped = performance.now()
    if (recorder) {
      recorder.observe({ before, after: state, inputs, loadedBoneyard,
        tickMs: stepped - tickStarted, behindMs: 0 })
      recorderTimes.push(performance.now() - stepped)
    }
    tickTimes.push(performance.now() - tickStarted)
    enemySum += state.world.enemies.actors.length
  }
  const elapsedMs = performance.now() - started
  globalThis.gc()
  const retainedHeapBytes = process.memoryUsage().heapUsed - heapBefore
  assert.ok(isDeepStrictEqual(fixture.state, initial), 'retained state was mutated')
  const result = {
    capture, players, enemies, ticks, pausedTicks, elapsedMs, retainedHeapBytes,
    averageEnemies: enemySum / ticks,
    tickMs: stats(tickTimes), recorderMs: recorderTimes.length ? stats(recorderTimes) : null,
    hash: createHash('sha256').update(JSON.stringify(state)).digest('hex'),
  }
  if (recorder) {
    // Separate deaths force the largest number of distinct retained world states.
    for (let index = 0; index < playerIds.length - 1; index += 1) {
      const before = state
      state = stepGameSimulationTick(state, inputs, { extensions })
      state = { ...state, playerEntities: { ...state.playerEntities,
        progressions: state.playerEntities.progressions.map((player, playerIndex) => (
          playerIndex <= index ? { ...player, lifeState: 'spectating', currentHealth: 0 } : player
        )),
      } }
      recorder.observe({ before, after: state, inputs, loadedBoneyard, tickMs: 0, behindMs: 0 })
    }
    recorder.close()
    assert.equal(archives.length, 1)
    const archive = archives[0]
    const retained = new Set([...archive.lastAliveByPlayer.values()].map(checkpoint => checkpoint.state))
    assert.equal(retained.size, players, 'each player keeps their own last living world')
    globalThis.gc()
    result.distinctPlayerStates = retained.size
    result.heapAfterDeathsBytes = process.memoryUsage().heapUsed - heapBefore
    const directory = await mkdtemp(join(tmpdir(), 'sdr-run-archive-overhead-'))
    let timer
    try {
      const store = new RunArchiveStore(directory)
      let last = performance.now()
      const gaps = []
      timer = setInterval(() => {
        const now = performance.now()
        gaps.push(now - last)
        last = now
      }, 1)
      const receipt = await store.save(archive)
      await store.close()
      await delay(5)
      clearInterval(timer)
      result.store = { ...receipt, eventLoopGapMs: stats(gaps) }
      assert.ok(isDeepStrictEqual(await readRunArchive(join(directory, receipt.file)), archive))
    } finally {
      clearInterval(timer)
      await rm(directory, { recursive: true, force: true })
    }
  }
  console.log(JSON.stringify(result))

  function advance(state) {
    const stepped = stepGameSimulationTick(state, inputs, { extensions })
    return stepped.levelUpBarrier === null ? stepped : resolveMlBotPolicySkillOffers(stepped, playerIds).state
  }
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b)
  return { mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    p99: sorted[Math.ceil(sorted.length * 0.99) - 1], maximum: sorted.at(-1) }
}

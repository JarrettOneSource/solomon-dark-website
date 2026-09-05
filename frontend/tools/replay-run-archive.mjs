import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import { readRunArchive } from '../src/game/host/run-archive-store.ts'
import { runArchivePlayers } from '../src/game/host/run-archive.ts'
import { stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { prepareBoneyardWorldNavigation } from '../src/game/core-server/boneyard-world.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    checkpoint: { type: 'string', default: 'last-alive' },
    iterations: { type: 'string', default: '200' },
    'compare-revision': { type: 'boolean', default: false },
    headless: { type: 'boolean', default: false },
    width: { type: 'string', default: '1600' },
    height: { type: 'string', default: '900' },
    'pixel-ratio': { type: 'string', default: '1' },
    player: { type: 'string' },
  },
})
const [command, path] = positionals
assert.ok(['inspect', 'benchmark', 'render'].includes(command) && path,
  'Usage: node --experimental-strip-types tools/replay-run-archive.mjs inspect|benchmark|render FILE [--checkpoint last-alive|worst-tick] [--compare-revision]')
const archive = await readRunArchive(path)
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.ok(['last-alive', 'worst-tick'].includes(values.checkpoint), 'Unknown checkpoint')
const players = runArchivePlayers(archive)
assert.ok(!values.player || players.some(player => player.playerId === values.player), 'Player ID is not in this archive')
const checkpoint = values.checkpoint === 'worst-tick' ? archive.worstTick
  : values.player ? archive.lastAliveByPlayer.get(values.player) : archive.lastAlive
const metadata = {
  archiveId: archive.id, runId: archive.runId, sessionId: archive.sessionId,
  capturedRevision: archive.revision, checkoutRevision: revision,
  capturedNodeVersion: archive.nodeVersion, nodeVersion: process.version,
  endReason: archive.endReason, endedAtUtc: archive.endedAtUtc,
  checkpoint: values.checkpoint, tick: checkpoint?.state.tick ?? null,
  players,
  boneyard: archive.loadedBoneyard.choice.name,
  originalWorstTickMs: archive.worstTick.tickMs,
  performance: archive.performance,
}
if (command === 'inspect') {
  console.log(JSON.stringify(metadata, null, 2))
} else {
  assert.ok(checkpoint, 'This segment has no living checkpoint; select --checkpoint worst-tick')
  assert.ok(revision === archive.revision || values['compare-revision'],
    `Check out ${archive.revision} for original behavior, or pass --compare-revision to measure an intentional candidate change`)
  assert.equal(archive.content.mods.length, 0,
    'This archive contains mods. Inspect preserves their state and content identities; this replay tool currently runs stock captures only.')
  const iterations = Number(values.iterations)
  assert.ok(Number.isSafeInteger(iterations) && iterations > 0 && iterations <= 100_000,
    '--iterations must be within 1..100000')
  if (command === 'benchmark') {
    prepareBoneyardWorldNavigation(checkpoint.state.world)
    const durations = []
    for (let index = -20; index < iterations; index += 1) {
      const started = performance.now()
      stepGameSimulationTick(checkpoint.state, checkpoint.inputs, {
        enemySpawnIntents: checkpoint.enemySpawnIntents,
      })
      if (index >= 0) durations.push(performance.now() - started)
    }
    console.log(JSON.stringify({ ...metadata, repeatedTickMs: summarize(durations) }, null, 2))
  } else {
    const { renderArchivedRun } = await import('./render-run-archive.mjs')
    const identities = checkpoint.state.playerEntities.identities
    const playerId = values.player ?? (identities.find((_player, index) => (
      checkpoint.state.playerEntities.progressions[index].lifeState === 'alive'
    )) ?? identities[0]).playerId
    assert.ok(identities.some(player => player.playerId === playerId), 'The selected player is absent from this checkpoint')
    const rendering = await renderArchivedRun({
      boneyard: archive.loadedBoneyard,
      snapshot: createGameSnapshot(checkpoint.state, playerId),
      playerId,
      headless: values.headless,
      iterations,
      width: Number(values.width), height: Number(values.height),
      pixelRatio: Number(values['pixel-ratio']),
    })
    console.log(JSON.stringify({ ...metadata, rendering }, null, 2))
  }
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const at = percentile => sorted[Math.ceil(sorted.length * percentile) - 1]
  return {
    count: sorted.length, mean: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p50: at(0.5), p95: at(0.95), p99: at(0.99), maximum: sorted.at(-1),
    over10ms: sorted.filter(value => value > 10).length,
  }
}

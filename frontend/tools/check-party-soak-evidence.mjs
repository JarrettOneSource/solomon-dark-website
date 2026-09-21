import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createIdlePlayerCharacterInput } from '../src/game/core-kernels/player-character.ts'
import { createGameSimulation, enterBoneyardWorld, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { RunArchiveRecorder } from '../src/game/host/run-archive.ts'
import { writeSoakEvidence } from './party-soak-evidence.mjs'

const forcedMessage = 'Forced soak archive flush failure'
const child = process.argv[2] === '--child'
const output = resolve(child ? process.argv[3] : process.env.SDR_SOAK_PROBE_OUTPUT)

if (child) {
  const loadedBoneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))
  assert.ok(loadedBoneyard)
  const before = enterBoneyardWorld(createGameSimulation({
    first: { displayName: 'First', discipline: 'body', element: 'ether' },
    second: { displayName: 'Second', discipline: 'mind', element: 'water' },
  }, { gameRngSeed: 123 }), loadedBoneyard)
  const inputs = { first: createIdlePlayerCharacterInput(), second: createIdlePlayerCharacterInput() }
  const after = stepGameSimulationTick(before, inputs)
  const recorder = new RunArchiveRecorder({
    content: { manifestSha256: '0'.repeat(64), mods: [] },
    revision: 'a'.repeat(40), sessionId: 'soak-fatal-probe',
    write: archive => {
      writeSoakEvidence(output, `archive-${archive.id}.json`, archive)
      writeSoakEvidence(output, 'archive-summary.json', {
        tick: archive.finalState.tick, endReason: archive.endReason,
      })
    },
  })
  recorder.observe({ before, after, inputs, loadedBoneyard, tickMs: 1, behindMs: 0 })
  setTimeout(() => {
    setImmediate(() => writeFileSync(join(output, 'continued-after-error'), 'unexpected'))
    try {
      throw new Error(forcedMessage)
    } catch (error) {
      // Match the native host's fatal ordering: log, close recorder, rethrow.
      writeSoakEvidence(output, 'server-fatal.json', {
        event: 'simulation.tick_failed', message: error.message, tick: after.tick,
      })
      recorder.close('server-error')
      throw error
    }
  }, 0)
} else {
  mkdirSync(output)
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', fileURLToPath(import.meta.url), '--child', output,
  ], { encoding: 'utf8', timeout: 30000 })
  writeFileSync(join(output, 'child-stderr.log'), result.stderr ?? '')
  assert.equal(result.error, undefined)
  assert.equal(result.status, 1, 'The original fatal error must still fail the process')
  assert.match(result.stderr, new RegExp(forcedMessage))
  assert.equal(existsSync(join(output, 'continued-after-error')), false)
  const archiveName = readdirSync(output).find(name => /^archive-[0-9a-f-]+\.json$/.test(name))
  assert.ok(archiveName, 'The real recorder must produce an archive')
  const archive = JSON.parse(readFileSync(join(output, archiveName), 'utf8'))
  const summary = JSON.parse(readFileSync(join(output, 'archive-summary.json'), 'utf8'))
  const error = JSON.parse(readFileSync(join(output, 'server-fatal.json'), 'utf8'))
  assert.equal(archive.endReason, 'server-error')
  assert.equal(archive.performance.tickCount, 1)
  assert.equal(archive.finalState.tick, summary.tick)
  assert.equal(archive.finalState.tick, error.tick)
  assert.equal(archive.finalState.world.kind, 'boneyard')
  assert.equal(archive.finalState.playerEntities.identities.length, 2)
  assert.equal(archive.loadedBoneyard.sourceSha256.length, 64)
  assert.equal(Object.keys(archive.lastAliveByPlayer).length, 2)
  const evidenceBefore = readFileSync(join(output, 'server-fatal.json'))
  assert.throws(() => writeSoakEvidence(output, 'server-fatal.json', {}), { code: 'EEXIST' })
  assert.deepEqual(readFileSync(join(output, 'server-fatal.json')), evidenceBefore)
  const receipt = { passed: true, atUtc: new Date().toISOString(), childExitCode: result.status,
    continuedAfterError: false, tick: archive.finalState.tick, archive: archiveName,
    archiveBytes: statSync(join(output, archiveName)).size, output }
  writeFileSync(join(output, 'probe-result.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
}

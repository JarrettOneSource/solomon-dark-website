import assert from 'node:assert/strict'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createDiagnosticCheckpointWriter, writeDiagnosticCheckpoint } from './party-soak-evidence.mjs'

const output = resolve(process.env.SDR_SOAK_PROBE_OUTPUT)
await mkdir(output)
const path = join(output, 'diagnostic-owner-save.json')
await writeFile(path, JSON.stringify({ checkpointSequence: 0 }), { mode: 0o600 })
const source = Object.freeze({
  continuation: Object.freeze({
    summary: Object.freeze({ partyRejoinToken: 'synthetic-probe-credential', activeRun: true }),
    simulation: Object.freeze({ tick: 123, nested: Object.freeze({ preserved: true }) }),
  }),
  modState: Object.freeze({ pilot: Object.freeze({ unchanged: true }) }),
})
const sourceBefore = JSON.stringify(source)
const writes = []
const errors = []
let releaseFirst, markStarted
const firstStarted = new Promise(resolveStarted => { markStarted = resolveStarted })
const gate = new Promise(resolveGate => { releaseFirst = resolveGate })
const writer = createDiagnosticCheckpointWriter(path, error => errors.push(error.code), async (target, json) => {
  const sequence = JSON.parse(json).checkpointSequence
  writes.push(sequence)
  if (sequence === 1) { markStarted(); await gate }
  await writeDiagnosticCheckpoint(target, json)
})
writer.push(1, source)
await firstStarted
writer.push(2, source)
writer.push(3, source)
assert.equal(JSON.parse(await readFile(path, 'utf8')).checkpointSequence, 0,
  'The prior complete checkpoint remains visible while a write is pending')
releaseFirst()
await writer.flush()
assert.deepEqual(writes, [1, 3], 'Intermediate pending checkpoints must coalesce')
assert.deepEqual(errors, [])
const savedText = await readFile(path, 'utf8')
const saved = JSON.parse(savedText)
assert.equal(saved.checkpointSequence, 3)
assert.equal(saved.save.continuation.summary.partyRejoinToken, null)
assert.equal(savedText.includes('synthetic-probe-credential'), false)
assert.equal(JSON.stringify(source), sourceBefore, 'The gameplay save object must remain unchanged')
assert.deepEqual(saved.save.continuation.simulation, source.continuation.simulation)
assert.deepEqual(saved.save.modState, source.modState)
assert.equal((await stat(path)).mode & 0o777, 0o600)
assert.equal(writer.status().coalesced, 1)
assert.equal(writer.status().savedSequence, 3)

const failurePath = join(output, 'diagnostic-after-write-error.json')
const failureCodes = []
const failureDuringFlush = []
let flushing = false
let failFirst = true
const failureWriter = createDiagnosticCheckpointWriter(failurePath, error => {
  failureCodes.push(error.code)
  failureDuringFlush.push(flushing)
},
  async (target, json) => {
    if (failFirst) { failFirst = false; throw Object.assign(new Error('Forced diagnostic write failure'), { code: 'EIO' }) }
    await writeDiagnosticCheckpoint(target, json)
  })
failureWriter.push(1, source)
flushing = true
await assert.rejects(failureWriter.flush(), { code: 'EIO' })
flushing = false
failureWriter.push(2, source)
await assert.rejects(failureWriter.flush(), { code: 'EIO' })
assert.deepEqual(failureCodes, ['EIO'], 'Write failures must be reported without payload/token logging')
assert.deepEqual(failureDuringFlush, [true], 'A pending failure must be reported before shutdown flush settles')
assert.equal(JSON.parse(await readFile(failurePath, 'utf8')).checkpointSequence, 2)
assert.equal(failureWriter.status().failures, 1)
const receipt = { passed: true, atUtc: new Date().toISOString(), output, writes,
  latestCheckpointParseable: true, sourceUnchanged: true, credentialRedacted: true,
  fileMode: '0600', writeFailureCodes: failureCodes, failureReportedDuringFlush: true,
  failureRemainsVisibleAfterLaterSuccess: true }
await writeFile(join(output, 'probe-result.json'), JSON.stringify(receipt, null, 2))
console.log(JSON.stringify(receipt))

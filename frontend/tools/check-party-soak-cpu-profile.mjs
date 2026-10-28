import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { createSlowWindowsCpuProfile } from './party-soak-cpu-profile.mjs'

const output = process.env.SDR_SOAK_PROBE_OUTPUT
  ? resolve(process.env.SDR_SOAK_PROBE_OUTPUT)
  : await mkdtemp(join(tmpdir(), 'solomon-soak-cpu-profile-probe-'))
await mkdir(output, { recursive: true })
const passed = []
const nativeSetTimeout = globalThis.setTimeout
const nativeClearTimeout = globalThis.clearTimeout
let now = 0
let sequence = 0
const timers = new Map()
globalThis.setTimeout = (callback, milliseconds) => {
  const id = ++sequence
  timers.set(id, { at: now + milliseconds, callback })
  return id
}
globalThis.clearTimeout = id => timers.delete(id)
const settle = async () => { for (let index = 0; index < 40; index += 1) await Promise.resolve() }
const advance = async milliseconds => {
  const target = now + milliseconds
  for (;;) {
    const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
    if (!next) break
    now = next[1].at
    timers.delete(next[0])
    next[1].callback()
    await settle()
  }
  now = target
  await settle()
}
const profile = { nodes: [{ id: 1, callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: -1, columnNumber: -1 } }],
  startTime: 1000, endTime: 25001000, samples: [1], timeDeltas: [25000000] }
const row = { client: 'windows', atUtc: new Date().toISOString(), runId: 'diagnostic-probe',
  hidden: false, lifeState: 'alive', playerCount: 2, snapshots: 100,
  renderedFrames: 400, durationMs: 5000, renderFps: 80 }
const pending = () => {
  let resolvePending
  const promise = new Promise(resolvePromise => { resolvePending = resolvePromise })
  return { promise, resolve: value => resolvePending(value) }
}
const fixture = ({ hold = {}, fail = null, realWrite = false, thresholdFps = 90 } = {}) => {
  const calls = []
  const events = []
  const errors = []
  const writes = []
  const path = join(output, `profile-${passed.length}.cpuprofile`)
  const diagnostic = createSlowWindowsCpuProfile({
    path, thresholdFps, cdp: { send(method, parameters) {
      calls.push({ method, parameters })
      if (fail === method) return Promise.reject(Object.assign(new Error(method), { code: 'EIO' }))
      return hold[method]?.promise ?? Promise.resolve(method === 'Profiler.stop' ? { profile } : {})
    } },
    event: (kind, details) => events.push({ kind, ...details }),
    onError: error => errors.push(error.code ?? error.name),
    ...(realWrite ? {} : { write: async (file, value, signal) => {
      writes.push({ file, value, signal })
      if (fail === 'profile.write') throw Object.assign(new Error('write'), { code: 'EIO' })
      await hold['profile.write']?.promise
    } }),
  })
  const feed = (count = 4, changes = {}) => {
    for (let index = 0; index < count; index += 1) diagnostic.observe({ ...row, ...changes })
  }
  return { diagnostic, calls, events, errors, writes, feed, path,
    count: method => calls.filter(call => call.method === method).length }
}

try {
  const sixtyHz = fixture({ thresholdFps: 45 })
  sixtyHz.feed(20, { renderFps: 60 })
  assert.equal(sixtyHz.diagnostic.status().attempted, false)
  sixtyHz.feed(3, { renderFps: 44 })
  sixtyHz.feed(1, { renderFps: 45 })
  assert.equal(sixtyHz.diagnostic.status().attempted, false)
  sixtyHz.feed(4, { renderFps: 44 })
  await settle()
  assert.equal(sixtyHz.count('Profiler.start'), 1)
  assert.equal(sixtyHz.events.find(event => event.kind === 'profiling.triggered').thresholdFps, 45)
  assert.equal(sixtyHz.diagnostic.status().thresholdFps, 45)
  await sixtyHz.diagnostic.close()
  passed.push('60 Hz display does not trigger at normal cadence; four windows below configured 45 FPS do')

  const reset = fixture()
  for (const invalid of [{ renderFps: 90 }, { renderFps: NaN }, { hidden: true }, { durationMs: 9000 }]) {
    reset.feed(3)
    reset.feed(1, invalid)
    assert.equal(reset.diagnostic.status().attempted, false)
  }
  reset.feed(3)
  reset.feed(10, { client: 'mac' })
  assert.equal(reset.diagnostic.status().attempted, false)
  reset.feed(1)
  reset.feed(100)
  await settle()
  assert.equal(reset.count('Profiler.start'), 1)
  await reset.diagnostic.close()
  reset.feed(100)
  assert.equal(reset.count('Profiler.start'), 1)
  passed.push('threshold reset, healthy windows, Windows ownership and one-shot admission')

  const delayedStart = pending()
  const timed = fixture({ hold: { 'Profiler.start': delayedStart }, realWrite: true })
  timed.feed()
  await settle()
  await advance(999)
  assert.equal(timed.count('Profiler.stop'), 0)
  assert.equal(timed.events.some(event => event.kind === 'profiling.start'), false)
  delayedStart.resolve({})
  await settle()
  await advance(24999)
  assert.equal(timed.count('Profiler.stop'), 0)
  await advance(1)
  await timed.diagnostic.close()
  const saved = JSON.parse(await readFile(timed.path, 'utf8'))
  assert.deepEqual(saved, profile)
  assert.equal((await stat(timed.path)).mode & 0o777, 0o600)
  assert.equal(timed.count('Profiler.stop'), 1)
  assert.equal(timed.count('Profiler.disable'), 1)
  assert.equal(timed.events.filter(event => event.kind === 'profiling.saved').length, 1)
  assert.deepEqual(timed.events.map(event => event.kind), ['profiling.triggered', 'profiling.start_requested',
    'profiling.start', 'profiling.stop_requested', 'profiling.stop', 'profiling.saved', 'profiling.finished'])
  const interval = timed.diagnostic.status()
  assert.equal(timed.diagnostic.overlaps(Date.parse(interval.diagnosticStartedAtUtc), Date.parse(interval.diagnosticFinishedAtUtc)), true)
  assert.equal(timed.diagnostic.overlaps(Date.parse(interval.diagnosticFinishedAtUtc) + 1, Date.now() + 1000), false)
  passed.push('25 seconds begin after start acknowledgement; one parseable 0600 profile and bounded interval')

  const idle = fixture()
  await idle.diagnostic.close()
  idle.feed()
  assert.equal(idle.calls.length, 0)
  passed.push('shutdown before a trigger sends no profiler commands')

  for (const stage of ['Profiler.enable', 'Profiler.start']) {
    const held = pending()
    const early = fixture({ hold: { [stage]: held } })
    early.feed()
    await settle()
    const closed = early.diagnostic.close('probe-shutdown')
    await settle()
    held.resolve({})
    await closed
    assert.equal(early.count('Profiler.start'), stage === 'Profiler.start' ? 1 : 0)
    assert.equal(early.count('Profiler.stop'), stage === 'Profiler.start' ? 1 : 0)
    assert.equal(early.count('Profiler.disable'), 1)
    assert.equal(timers.size, 0)
    passed.push(`shutdown during ${stage} joins startup and leaves no timer`)
  }

  const heldStop = pending()
  const concurrent = fixture({ hold: { 'Profiler.stop': heldStop } })
  concurrent.feed()
  await settle()
  await advance(25000)
  const closing = concurrent.diagnostic.close()
  heldStop.resolve({ profile })
  await closing
  await concurrent.diagnostic.close()
  assert.equal(concurrent.count('Profiler.stop'), 1)
  assert.equal(concurrent.count('Profiler.disable'), 1)
  assert.equal(concurrent.writes.length, 1)
  passed.push('timer expiry and repeated cleanup share one stop, write and disable')

  for (const stage of ['Profiler.enable', 'Profiler.setSamplingInterval', 'Profiler.start',
    'Profiler.stop', 'Profiler.disable', 'profile.write']) {
    const rejected = fixture({ fail: stage })
    rejected.feed()
    await settle()
    await assert.rejects(rejected.diagnostic.close(), { code: 'EIO' })
    assert.deepEqual(rejected.errors, ['EIO'])
    assert.equal(rejected.diagnostic.status().failures, 1)
    assert.equal(rejected.diagnostic.status().phase, 'failed')
    assert.equal(rejected.count('Profiler.disable'), 1)
    rejected.feed(100)
    assert.equal(rejected.events.filter(event => event.kind === 'profiling.triggered').length, 1)
    passed.push(`${stage} failure remains visible through cleanup and does not rearm`)
  }

  for (const stage of ['Profiler.start', 'Profiler.stop', 'Profiler.disable', 'profile.write']) {
    const held = pending()
    const timeout = fixture({ hold: { [stage]: held } })
    timeout.feed()
    await settle()
    const closed = timeout.diagnostic.close()
    const rejected = assert.rejects(closed, { code: 'ETIMEDOUT' })
    await settle()
    await advance(5000)
    await rejected
    assert.equal(timeout.diagnostic.status().phase, 'failed')
    const eventsBeforeLateReply = timeout.events.length
    held.resolve(stage === 'Profiler.stop' ? { profile } : {})
    await settle()
    assert.equal(timeout.events.length, eventsBeforeLateReply)
    if (stage === 'profile.write') assert.equal(timeout.writes[0].signal.aborted, true)
    assert.equal(timers.size, 0)
    passed.push(`${stage} timeout bounds cleanup and ignores late completion`)
  }
  assert.equal(timers.size, 0)
} finally {
  globalThis.setTimeout = nativeSetTimeout
  globalThis.clearTimeout = nativeClearTimeout
}

const receipt = { passed: true, atUtc: new Date().toISOString(), cases: passed, output,
  browserLaunched: false, cpuSamplingIntervalUs: 1000, productionDurationMs: 25000,
  qualifyingWindows: 4, thresholdFps: 90, commandDeadlineMs: 5000 }
await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx', mode: 0o600 })
console.log(JSON.stringify(receipt))

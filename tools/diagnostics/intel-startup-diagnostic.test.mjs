import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { HARNESS_SHA256, instrumentHarness, resolvePlaywrightImport } from './intel-startup-diagnostic.mjs'
import { createDesktopObserver, driverOwnedProcesses, installRendererTelemetry, ownedForest, parseProcessRows, redactDiagnosticText, registerDiagnosticSecret, safeURL, trustedRegisteredRoots } from './desktop-timeout-observer.mjs'
import { createHash } from 'node:crypto'
import * as diagnostics from './desktop-timeout-observer.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
test('CPU profiles keep only bounded stack and timing fields from bundled scripts', () => {
  const secret = 'PROFILE_SENTINEL_SECRET'
  registerDiagnosticSecret(secret)
  const url = 'solomon-darker://app/assets/Game-12345678.js'
  const raw = {
    startTime: 100, endTime: 500, secret, source: secret,
    nodes: [{ id: 1, hitCount: 2, children: [2], deoptReason: secret,
      callFrame: { functionName: 'renderTitle', url: url + '?token=' + secret + '#' + secret, lineNumber: 12, columnNumber: 6, scriptId: secret, locals: secret } },
    { id: 2, callFrame: { functionName: secret, url: 'file:///Users/private/' + secret + '.js', lineNumber: 1, columnNumber: 2 } },
    { id: 3, callFrame: { functionName: secret, url, lineNumber: 1, columnNumber: 2 } },
    { id: 4, callFrame: { functionName: '(idle)', url: '', lineNumber: -1, columnNumber: -1 } }],
    samples: [1, 2], timeDeltas: [100, 200], args: secret,
  }
  const value = diagnostics.sanitizeCPUProfile(raw, new Set(['/assets/Game-12345678.js']))
  assert.deepEqual(value.nodes[0], { id: 1, hitCount: 2, children: [2], callFrame: { functionName: 'renderTitle', url, lineNumber: 12, columnNumber: 6 } })
  assert.equal(value.nodes[1].callFrame.url, '')
  assert.equal(value.nodes[1].callFrame.functionName, '[omitted]')
  assert.equal(value.nodes[3].callFrame.functionName, '(idle)')
  assert.deepEqual(value.samples, [1, 2]); assert.deepEqual(value.timeDeltas, [100, 200])
  assert.equal(JSON.stringify(value).includes(secret), false)
  assert.equal(JSON.stringify(value).includes('/Users/'), false)
  assert.deepEqual(Object.keys(value).sort(), ['endTime', 'nodes', 'samples', 'startTime', 'timeDeltas', 'truncated'])
  const bounded = diagnostics.sanitizeCPUProfile({ nodes: Array.from({ length: 10_001 }, (_, id) => ({ id: id + 1 })), samples: Array(20_001).fill(1), timeDeltas: Array(20_001).fill(10_000) }, new Set())
  assert.equal(bounded.nodes.length, 10_000); assert.equal(bounded.samples.length, 20_000)
  assert.deepEqual(bounded.truncated, { nodes: true, samples: true })
})

test('native samples exclude headers, paths, arguments, addresses and binary images', () => {
  const secret = 'NATIVE_SENTINEL_SECRET'
  registerDiagnosticSecret(secret)
  const raw = `Analysis of sampling ${secret} every 1 millisecond\nProcess: ${secret}\nPath: /Users/${secret}\nCommand: --token=${secret}\nCall graph:\n    100 Thread_123 DispatchQueue_${secret}\n    + 100 start (in dyld) + 1 [0x1234]\n    + ! 80 gpu::Draw(${secret}, void*) (in libvk_swiftshader.dylib) + 44 [0x5678]\n    + ! 20 ${secret} (in ${secret}) + 2 [0x9999]\nTotal number in stack (recursive counted multiple, when >=5):\n    100 ${secret}\nBinary Images:\n    100 ${secret} /Users/${secret}\n`
  const value = diagnostics.sanitizeNativeSample(raw)
  assert.equal(value.intervalMs, 1)
  assert.deepEqual(value.frames.map(row => row.symbol), ['start', 'gpu::Draw', '[omitted]'])
  assert.deepEqual(value.frames.map(row => row.samples), [100, 80, 20])
  const output = JSON.stringify(value)
  for (const text of [secret, '/Users/', 'Command', 'Thread_123', '0x1234', 'void*', 'Binary Images']) assert.equal(output.includes(text), false, text)
  const offsetFirst = diagnostics.sanitizeNativeSample('Call graph:\n    + 40 gpu::Draw(void*) + 1942 (in Electron Framework) [0x5678]\n')
  assert.deepEqual(offsetFirst.frames[0], { depth: 1, samples: 40, symbol: 'gpu::Draw', offset: 1942 })
})

test('long task telemetry preserves a bounded chronological start and duration window', () => {
  let callback
  const state = {}
  class Image { decode() {} }
  class Mutation { observe() {} }
  class LongTasks { constructor(value) { callback = value } observe() {} }
  runInNewContext('(' + installRendererTelemetry.toString() + ')()', {
    window: state, document: { querySelector: () => null, addEventListener() {} },
    performance: { now: () => 0 }, HTMLImageElement: Image, MutationObserver: Mutation,
    PerformanceObserver: LongTasks, setInterval() {}, requestAnimationFrame() {},
  })
  callback({ getEntries: () => Array.from({ length: 300 }, (_, index) => ({ startTime: index * 100, duration: index + 50, name: 'SENTINEL', attribution: ['SENTINEL'] })) })
  const tasks = JSON.parse(JSON.stringify(state.__sdrDesktopDiagnostic.longTasks))
  assert.equal(tasks.count, 300); assert.equal(tasks.entries.length, 256)
  assert.deepEqual(tasks.entries[0], { startTime: 4400, duration: 94 })
  assert.deepEqual(tasks.entries.at(-1), { startTime: 29900, duration: 349 })
  assert.equal(tasks.dropped, 44); assert.equal(JSON.stringify(tasks).includes('SENTINEL'), false)
})
test('resolved Playwright module exposes the original Electron launcher without launching it', async () => {
  const module = await import(await resolvePlaywrightImport(process.env.SDR_SOURCE_ROOT))
  assert.equal(typeof module._electron.launch, 'function')
})
test('process parser retains identity and does not emit arguments', () => {
  const rows = parseProcessRows(' 12 1 Wed Oct 14 16:18:54 2026 0:00.01 0.3 8192 Ss /app/Solomon Darker\n 13 12 Wed Oct 14 16:18:55 2026 1:03.20 95.2 99999 R /app/Helper (GPU)\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].birth, 'Wed Oct 14 16:18:54 2026')
  assert.equal(rows[1].executable, 'Helper (GPU)')
  assert.equal(rows[1].cpuPercent, 95.2)
  assert.equal('command' in rows[1], false)
})
test('owned tree includes descendants and excludes unrelated processes', () => {
  const rows = [{pid: 1, ppid: 0}, {pid: 20, ppid: 1}, {pid: 22, ppid: 20}, {pid: 23, ppid: 22}, {pid: 30, ppid: 1}]
  assert.deepEqual(ownedForest(rows, [20]).map(row => row.pid), [20, 22, 23])
})
test('resource URLs never retain invitation or query credentials', () => {
  assert.equal(safeURL('solomondarker://127.0.0.1:123/v1/abc#secret'), 'solomondarker://[invitation-redacted]')
  assert.equal(safeURL('http://user:password@127.0.0.1:100/game?token=secret#private'), 'http://127.0.0.1:100/game')
  assert.equal(safeURL('solomon-darker://app/assets/art.png?private=secret'), 'solomon-darker://app/assets/art.png')
})
test('pre-attach launch descendants are owned without including driver or unrelated roots', () => {
  const rows = [{pid: 1, ppid: 0}, {pid: 10, ppid: 1}, {pid: 20, ppid: 10}, {pid: 21, ppid: 20}, {pid: 30, ppid: 1}]
  assert.deepEqual(driverOwnedProcesses(rows, 10).map(row => row.pid), [20, 21])
  assert.deepEqual(driverOwnedProcesses(rows, 10, [30]).map(row => row.pid), [20, 21, 30])
})
test('outer-error redaction shares registered credential and invitation secrets', () => {
  registerDiagnosticSecret('synthetic-runtime-credential')
  registerDiagnosticSecret('solomondarker://127.0.0.1:123/v1/revision#synthetic-invite-secret')
  const text = redactDiagnosticText('outer error synthetic-runtime-credential and synthetic-invite-secret')
  assert.equal(text.includes('synthetic-runtime-credential'), false)
  assert.equal(text.includes('synthetic-invite-secret'), false)
})
test('stale registered PID does not grant ownership to a reused unrelated process', () => {
  const rows = [{pid: 10, ppid: 1, birth: 'driver'}, {pid: 30, ppid: 1, birth: 'new unrelated identity'}, {pid: 31, ppid: 30, birth: 'unrelated child'}]
  const roots = trustedRegisteredRoots(rows, [30], new Map([[30, 'old app identity']]))
  assert.deepEqual(roots, [])
  assert.deepEqual(driverOwnedProcesses(rows, 10, roots), [])
})
test('decode observation returns the exact original promise and preserves rejection', async () => {
  let resolveDecode
  let original = new Promise(resolve => { resolveDecode = resolve })
  class Image { decode() { return original } }
  class Observer { observe() {} }
  const state = {}
  const context = {
    window: state, document: { querySelector: () => null, addEventListener() {} },
    performance: { now: () => 123 }, HTMLImageElement: Image,
    MutationObserver: Observer, PerformanceObserver: Observer,
    setInterval() {}, requestAnimationFrame() {},
  }
  runInNewContext('(' + installRendererTelemetry.toString() + ')()', context)
  const returned = new Image().decode()
  assert.equal(returned, original)
  assert.equal(state.__sdrDesktopDiagnostic.decodes.started, 1)
  resolveDecode('same')
  assert.equal(await returned, 'same')
  await Promise.resolve()
  assert.equal(state.__sdrDesktopDiagnostic.decodes.completed, 1)
  assert.deepEqual(Object.keys(state.__sdrDesktopDiagnostic.decodes.pending), [])
  const failure = new Error('synthetic decode failure')
  original = Promise.reject(failure)
  const rejected = new Image().decode()
  assert.equal(rejected, original)
  await assert.rejects(rejected, error => error === failure)
  assert.equal(state.__sdrDesktopDiagnostic.decodes.failed, 1)
})
test('all original assertions, timeouts, fidelity flags and success closes are preserved', async () => {
  assert.ok(process.env.SDR_SOURCE_ROOT, 'Set SDR_SOURCE_ROOT for the read-only source fixture')
  const source = await readFile(join(process.env.SDR_SOURCE_ROOT, 'frontend/tools/smoke-desktop-runtime.mjs'), 'utf8')
  assert.equal(createHash('sha256').update(source).digest('hex'), HARNESS_SHA256)
  const instrumented = instrumentHarness(source, 'file:///observer.mjs', 'file:///playwright.mjs')
  const originalAssertions = source.match(/^\s*assert\..+$/gm).map(line => line.trim())
  const diagnosticAssertions = instrumented.match(/^\s*assert\..+$/gm).map(line => line.trim()).filter(line => !line.startsWith('assert.equal(manifest.'))
  assert.deepEqual(diagnosticAssertions, originalAssertions)
  assert.equal(originalAssertions.length, 19)
  assert.deepEqual(instrumented.match(/timeout: [\d_]+/g), source.match(/timeout: [\d_]+/g))
  assert.ok(instrumented.includes("await close(guest)\n  await close(host)\n  await waitForExit(hostChild.pid)"))
  assert.ok(instrumented.includes('play.or(tutorial).first().waitFor({ timeout: 90_000 })'))
  assert.ok(instrumented.includes('diagnostics.beforeFailure(error)'))
  assert.ok(instrumented.includes("await diagnostics.beforeGuestNavigation(guest.page)\n  await guest.page.getByRole('button', { name: 'Join game', exact: true }).click()"))
  assert.equal(instrumented.match(/beforeGuestNavigation/g).length, 1)
  assert.ok(instrumented.includes('await diagnostics.endPhase(page, "title")'))
  assert.ok(instrumented.includes('await diagnostics.stop('))
  assert.ok(instrumented.includes('throw error'))
  assert.ok(!instrumented.includes("join(evidence, 'receipt.json')"))
  assert.ok(instrumented.includes('acceptance: false'))
  assert.throws(() => instrumentHarness(source + '\n', 'file:///observer.mjs', 'file:///playwright.mjs'), /unrecognized/)
})
test('inventory records external symlink text without following it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sdr-diag-inventory-test-'))
  try {
    const app = join(root, 'app'), external = join(root, 'external')
    await mkdir(app); await mkdir(external)
    await writeFile(join(app, 'normal'), 'hello')
    await writeFile(join(external, 'must-not-read'), 'outside-tree')
    await symlink(external, join(app, 'linked-directory'))
    const output = join(root, 'inventory.json')
    execFileSync('python3', [join(directory, 'package-inventory.py'), app, output])
    const rows = JSON.parse(await readFile(output, 'utf8'))
    assert.deepEqual(rows.map(row => row.path), ['linked-directory', 'normal'])
    assert.equal(rows[0].kind, 'symlink')
    assert.equal(rows[0].target, external)
    assert.equal(rows[1].sha256, createHash('sha256').update('hello').digest('hex'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('observer samples the next app after historical Electron channels are disposed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sdr-diag-lifecycle-test-'))
  const observer = await createDesktopObserver(root)
  const fixture = label => {
    const child = { pid: process.pid, exitCode: null, signalCode: null }
    let disposed = false
    const locator = { count: async () => 0, isVisible: async () => false, evaluateAll: async () => [], or() { return this } }
    const page = {
      on() {}, evaluate: async () => ({ observedApp: label }), getByRole: () => locator,
      context: () => ({ addInitScript: async () => {}, newCDPSession: async () => ({ send: async () => ({ metrics: [] }) }) }),
    }
    const app = {
      process() { if (disposed) throw new TypeError('Disposed Electron channel has no _object'); return child },
      evaluate: async () => [],
    }
    return { instance: { label, app, page }, close(signal = null) { disposed = true; child.exitCode = signal ? null : 0; child.signalCode = signal } }
  }
  try {
    const solo = fixture('solo'), resumed = fixture('resume')
    await observer.attach(solo.instance)
    await observer.beforeScreenshot('solo-live')
    solo.close()
    observer.record('test-app-closed', { label: 'solo' })
    await observer.attach(resumed.instance)
    await observer.beforeScreenshot('resume-live')
    resumed.close('SIGTERM')
    observer.record('test-app-closed', { label: 'resume' })
    await observer.beforeScreenshot('all-closed')
    const readEvents = async () => (await readFile(join(root, 'telemetry.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    let events = await readEvents()
    const closedAt = events.find(row => row.event === 'test-app-closed' && row.label === 'resume').monoMs
    const hasClosedPeriodicSample = () => events.some(row => row.event === 'snapshot-end' && row.reason === 'periodic' && row.monoMs > closedAt)
    const deadline = Date.now() + 10_000
    while (!hasClosedPeriodicSample() && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25))
      events = await readEvents()
    }
    assert.equal(hasClosedPeriodicSample(), true, 'Periodic sampling must still finish after both app channels close')
    const renderers = events.filter(row => row.event === 'probe-response' && row.channel.endsWith(':renderer'))
    assert.deepEqual([...new Set(renderers.map(row => row.value.observedApp))], ['solo', 'resume'])
    const closed = new Set()
    for (const row of events) {
      if (row.event === 'test-app-closed') closed.add(row.label)
      if (row.event === 'probe-response' && row.channel.endsWith(':renderer')) assert.equal(closed.has(row.value.observedApp), false)
    }
    assert.equal(events.filter(row => row.event === 'sampler-error').length, 0)
    assert.deepEqual(events.filter(row => row.event === 'snapshot-end' && row.reason.startsWith('before-screenshot-')).map(row => row.reason),
      ['before-screenshot-solo-live', 'before-screenshot-resume-live', 'before-screenshot-all-closed'])
  } finally {
    await observer.stop({ primaryError: null, cleanupErrors: [] })
    await rm(root, { recursive: true, force: true })
  }
})

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const profileFixture = (overrides = {}) => {
  const calls = [], events = [], sampled = []
  let time = 100
  const rows = [
    { pid: 10, ppid: 1, birth: 'guest-root' }, { pid: 11, ppid: 10, birth: 'guest-tab' },
    { pid: 12, ppid: 10, birth: 'guest-gpu' }, { pid: 20, ppid: 1, birth: 'host-root' },
    { pid: 21, ppid: 20, birth: 'host-tab' },
  ]
  const guest = { pid: 10, child: { exitCode: null, signalCode: null }, metrics: [{ pid: 11, type: 'Tab' }, { pid: 12, type: 'GPU' }, { pid: 21, type: 'Tab' }] }
  const session = { async send(method, params) { calls.push([method, params]); return method === 'Profiler.stop' ? { profile: { startTime: 100, endTime: 200, nodes: [], samples: [], timeDeltas: [] } } : {} }, async detach() { calls.push(['detach']) } }
  const controller = diagnostics.createGuestTitleDiagnostics({
    openSession: async () => session, guest, identities: new Map(rows.map(row => [row.pid, row.birth])),
    readRows: async () => rows, sampleProcess: async pid => { sampled.push(pid); return 'Call graph:\n    + 1 mach_msg (in libsystem_kernel.dylib) + 1 [0x1234]\nBinary Images:\n' },
    bundledScripts: new Set(), record: (event, value) => events.push({ event, ...value }), now: () => time,
    requestDeadlineMs: 20, ...overrides,
  })
  return { controller, calls, events, sampled, rows, guest, session, setTime(value) { time = value } }
}

test('guest profiler starts at 10 ms and stops only once on title completion', async () => {
  const f = profileFixture()
  assert.equal(await f.controller.start(), true)
  assert.deepEqual(f.calls.map(row => row[0]), ['Profiler.enable', 'Profiler.setSamplingInterval', 'Profiler.start'])
  assert.deepEqual(f.calls[1][1], { interval: 10_000 })
  f.setTime(800)
  await Promise.all([f.controller.finish('title-complete'), f.controller.finish('cleanup')])
  assert.deepEqual(f.calls.map(row => row[0]), ['Profiler.enable', 'Profiler.setSamplingInterval', 'Profiler.start', 'Profiler.stop', 'detach'])
  const profile = f.events.find(row => row.event === 'guest-cpu-profile')
  assert.equal(profile.target, 'guest-page'); assert.equal(profile.rootPid, 10); assert.equal(profile.rootBirth, 'guest-root')
  assert.equal(profile.startRequestedMonoMs, 100); assert.equal(profile.stopRequestedMonoMs, 800)
  assert.equal(profile.reason, 'title-complete'); assert.equal(await f.controller.start(), false)
})

test('failure before profile startup and closed protocol channels preserve product error ownership', async () => {
  const f = profileFixture({ openSession: async () => { throw new Error('PRIVATE_PROTOCOL_BODY') } })
  assert.equal(await f.controller.start(), false)
  await f.controller.finish('failure')
  assert.ok(f.events.some(row => row.event === 'instrumentation-error' && row.step === 'profiler-start'))
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_PROTOCOL_BODY'), false)
  const early = profileFixture({ openSession: async () => { assert.fail('Must not attach after early failure') } })
  await early.controller.finish('failure')
  assert.equal(await early.controller.start(), false)
})

test('a pending session attachment is detached if it resolves after failure', async () => {
  const attachment = deferred(), f = profileFixture({ openSession: () => attachment.promise })
  const starting = f.controller.start()
  await f.controller.finish('failure')
  attachment.resolve(f.session)
  assert.equal(await starting, false)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(f.calls, [['detach']])
})

test('pending enable cannot start a profiler after title completion', async () => {
  const enabling = deferred(), f = profileFixture()
  f.session.send = async method => { f.calls.push([method]); if (method === 'Profiler.enable') return enabling.promise; return {} }
  const starting = f.controller.start()
  await new Promise(resolve => setImmediate(resolve))
  await f.controller.finish('title-complete')
  enabling.resolve({})
  assert.equal(await starting, false)
  assert.deepEqual(f.calls.map(row => row[0]), ['Profiler.enable', 'detach'])
})

test('pending start, stop and detach cannot delay sealing or record afterward', async () => {
  for (const blocked of ['Profiler.start', 'Profiler.stop', 'detach']) {
    const pending = deferred(), f = profileFixture()
    const send = f.session.send.bind(f.session)
    f.session.send = async (method, params) => { if (method === blocked) { f.calls.push([method]); return pending.promise } return send(method, params) }
    if (blocked === 'detach') f.session.detach = async () => { f.calls.push(['detach']); return pending.promise }
    const started = Date.now()
    await f.controller.start()
    await f.controller.finish('failure')
    assert.ok(Date.now() - started < 500, blocked + ' must not hold the workload indefinitely')
    if (blocked !== 'detach') assert.ok(f.events.some(row => row.event === 'instrumentation-error' && row.kind === 'deadline'), blocked)
    f.controller.seal()
    const profiles = f.events.filter(row => row.event === 'guest-cpu-profile').length
    pending.resolve({ profile: { nodes: [], source: 'LATE_PRIVATE_BODY' } })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(f.events.filter(row => row.event === 'guest-cpu-profile').length, profiles)
    assert.equal(f.calls.filter(row => row[0] === 'detach').length, 1)
    assert.equal(JSON.stringify(f.events).includes('LATE_PRIVATE_BODY'), false)
  }
})

test('the first prolonged title renderer probe samples only guest Tab and GPU once', async () => {
  const f = profileFixture()
  await f.controller.start()
  f.setTime(5099); await f.controller.checkStall(100, 'title')
  assert.deepEqual(f.sampled, [])
  f.setTime(5100); await f.controller.checkStall(100, 'readyHub')
  assert.deepEqual(f.sampled, [])
  await Promise.all([f.controller.checkStall(100, 'title'), f.controller.checkStall(100, 'title')])
  assert.deepEqual(f.sampled.sort(), [11, 12])
  assert.equal(f.events.filter(row => row.event === 'guest-renderer-stall').length, 1)
  const captures = f.events.filter(row => row.event === 'process-stack-sample')
  assert.deepEqual(captures.map(row => row.birth).sort(), ['guest-gpu', 'guest-tab'])
  assert.ok(captures.every(row => row.startedMonoMs === 5100 && row.rootPid === 10 && row.rootBirth === 'guest-root'))
  await f.controller.finish('title-complete')
  await f.controller.checkStall(0, 'title')
  assert.equal(f.sampled.length, 2)
})

test('sampling rejects PID reuse, unrelated trees and closed guest channels', async () => {
  for (const alter of [f => { f.rows[1].birth = 'reused-tab' }, f => { f.rows[1].ppid = 20 }, f => { f.rows[0].birth = 'reused-root' }, f => { f.guest.child.exitCode = 0 }]) {
    const f = profileFixture()
    await f.controller.start(); alter(f); f.setTime(5100)
    await f.controller.checkStall(100, 'title')
    assert.equal(f.sampled.includes(11), false)
    await f.controller.finish('failure')
  }
  let f
  f = profileFixture({ sampleProcess: async pid => { if (pid === 11) f.rows[1].birth = 'reused-during-sample'; return 'Call graph:\n    + 1 render (in Electron) + 1 [0x1234]\n' } })
  await f.controller.start(); f.setTime(5100)
  await f.controller.checkStall(100, 'title')
  assert.equal(f.events.some(row => row.event === 'process-stack-sample' && row.pid === 11), false)
  assert.ok(f.events.some(row => row.event === 'instrumentation-error' && row.kind === 'identity-changed'))
  await f.controller.finish('failure')
})

test('observer launch registration does not depend on an attached Electron channel', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sdr-diag-register-test-'))
  const observer = await createDesktopObserver(root)
  try {
    observer.launching('solo')
    await observer.launched('solo', process.pid)
  } finally { await observer.stop({ primaryError: null, cleanupErrors: [] }); await rm(root, { recursive: true, force: true }) }
})

test('observer closes guest profiling across disposed channels and ignores late stop payloads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sdr-diag-profile-observer-test-'))
  const observer = await createDesktopObserver(root)
  const stopped = deferred(), calls = []
  const child = { pid: process.pid, exitCode: null, signalCode: null }
  let disposed = false
  const profileSession = { async send(method) { calls.push(method); return method === 'Profiler.stop' ? stopped.promise : {} }, async detach() { calls.push('detach') } }
  let sessions = 0
  const page = { on() {}, context: () => ({ addInitScript: async () => {}, newCDPSession: async () => ++sessions === 1 ? { send: async () => ({ metrics: [] }) } : profileSession }) }
  const app = { process() { if (disposed) throw new Error('Disposed Electron channel'); return child }, evaluate: async () => [] }
  try {
    observer.launching('guest')
    await observer.launched('guest', child.pid)
    await observer.attach({ label: 'guest', page, app })
    await observer.beforeGuestNavigation(page)
    assert.ok(calls.includes('Profiler.start'))
    disposed = true; child.exitCode = 0
    await observer.stop({ primaryError: null, cleanupErrors: [] })
    const terminal = JSON.parse(await readFile(join(root, 'diagnostic-terminal.json'), 'utf8'))
    assert.equal(terminal.status, 'diagnostic-instrumentation-failed')
    assert.equal(terminal.primaryError, null)
    assert.ok(terminal.instrumentationErrors.some(row => row.step === 'profiler-stop'))
    const before = await readFile(join(root, 'telemetry.jsonl'), 'utf8')
    stopped.resolve({ profile: { nodes: [], source: 'PRIVATE_LATE_STOP' } })
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(await readFile(join(root, 'telemetry.jsonl'), 'utf8'), before)
    assert.deepEqual(calls, ['Profiler.enable', 'Profiler.setSamplingInterval', 'Profiler.start', 'Profiler.stop', 'detach'])
  } finally { await observer.stop({ primaryError: null, cleanupErrors: [] }); await rm(root, { recursive: true, force: true }) }
})

test('title shutdown drains the existing native sample and records sampling failures separately', async () => {
  const pending = deferred(), f = profileFixture({ sampleProcess: async pid => {
    if (pid === 12) throw new Error('NATIVE_PRIVATE_COMMAND_AND_PATH')
    return pending.promise
  } })
  await f.controller.start(); f.setTime(5100)
  const capture = f.controller.checkStall(100, 'title')
  await new Promise(resolve => setImmediate(resolve))
  let finished = false
  const closing = f.controller.finish('cleanup').then(() => { finished = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(finished, false, 'Exit proof must wait for the owned native sample')
  pending.resolve('Call graph:\n    + 1 mach_msg (in libsystem_kernel.dylib) + 1 [0x1234]\n')
  await Promise.all([capture, closing])
  assert.equal(finished, true)
  assert.ok(f.events.some(row => row.event === 'instrumentation-error' && row.step === 'native-sample' && row.pid === 12))
  assert.equal(JSON.stringify(f.events).includes('NATIVE_PRIVATE_COMMAND_AND_PATH'), false)
  await f.controller.checkStall(100, 'title')
  assert.equal(f.events.filter(row => row.event === 'guest-renderer-stall').length, 1)
})

test('one pending stop retains a sanitized late profile during existing failure capture', async () => {
  const pending = deferred(), f = profileFixture()
  const send = f.session.send.bind(f.session)
  f.session.send = async (method, params) => { if (method === 'Profiler.stop') { f.calls.push([method]); return pending.promise }; return send(method, params) }
  await f.controller.start()
  await f.controller.finish('failure')
  assert.equal(f.calls.some(row => row[0] === 'detach'), false, 'Do not detach while the same stop request can still return evidence')
  assert.equal(f.events.filter(row => row.event === 'guest-cpu-profile').length, 0)
  pending.resolve({ profile: { nodes: [], source: 'PRIVATE_LATE_SOURCE', startTime: 1, endTime: 2 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.events.filter(row => row.event === 'guest-cpu-profile').length, 1)
  assert.equal(f.calls.filter(row => row[0] === 'Profiler.stop').length, 1)
  assert.equal(f.calls.filter(row => row[0] === 'detach').length, 1)
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_LATE_SOURCE'), false)
  f.controller.seal()
})

test('sealing a still-pending stop adds no wait and suppresses all late capture events', async () => {
  const pending = deferred(), f = profileFixture()
  const send = f.session.send.bind(f.session)
  f.session.send = async (method, params) => { if (method === 'Profiler.stop') { f.calls.push([method]); return pending.promise }; return send(method, params) }
  await f.controller.start(); await f.controller.finish('failure')
  assert.equal(typeof f.controller.seal, 'function')
  f.controller.seal()
  const before = JSON.stringify(f.events)
  pending.resolve({ profile: { nodes: [], source: 'PRIVATE_AFTER_SEAL' } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(JSON.stringify(f.events), before)
  assert.equal(f.calls.filter(row => row[0] === 'detach').length, 1)
  assert.equal(await f.controller.start(), false)
})

test('native failure preserves safe classification and owned partial frames without raw output', async () => {
  const f = profileFixture({ sampleProcess: async () => {
    throw Object.assign(new Error('PRIVATE_MESSAGE'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', signal: 'SIGTERM', killed: true,
      cmd: 'PRIVATE_COMMAND', stack: 'PRIVATE_STACK', stderr: 'PRIVATE_STDERR',
      stdout: 'PRIVATE_HEADER\nCall graph:\n    + 1 mach_msg (in libsystem_kernel.dylib) + 1 [0x1234]\nBinary Images:\nPRIVATE_IMAGE_PATH\n' })
  } })
  await f.controller.start(); f.setTime(5100); await f.controller.checkStall(100, 'title')
  const failures = f.events.filter(row => row.event === 'instrumentation-error' && row.kind === 'sample-failed')
  assert.equal(failures.length, 2)
  assert.ok(failures.every(row => row.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' && row.signal === 'SIGTERM' && row.killed === true && row.stdoutBytes > 0 && row.stderrBytes > 0))
  const samples = f.events.filter(row => row.event === 'process-stack-sample')
  assert.equal(samples.length, 2); assert.ok(samples.every(row => row.partial === true && row.sample.frames[0].symbol === 'mach_msg'))
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_'), false)
  await f.controller.finish('cleanup'); f.controller.seal()
})

test('partial native output still fails closed if PID identity changes', async () => {
  let f
  f = profileFixture({ sampleProcess: async pid => {
    if (pid === 11) f.rows[1].birth = 'reused-during-failed-sample'
    throw Object.assign(new Error('PRIVATE_MESSAGE'), { code: 'PRIVATE_CODE', signal: 'PRIVATE_SIGNAL', stdout: 'Call graph:\n    + 1 render (in Electron) + 1 [0x1234]\n' })
  } })
  await f.controller.start(); f.setTime(5100); await f.controller.checkStall(100, 'title')
  assert.equal(f.events.some(row => row.event === 'process-stack-sample' && row.pid === 11), false)
  assert.ok(f.events.some(row => row.kind === 'identity-changed' && row.pid === 11))
  assert.ok(f.events.some(row => row.kind === 'sample-failed' && row.code === 'other' && row.signal === 'other'))
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_'), false)
  await f.controller.finish('cleanup'); f.controller.seal()
})

test('profile serialization failure remains visible without leaking exception text', async () => {
  const f = profileFixture(), send = f.session.send.bind(f.session)
  f.session.send = async (method, params) => method === 'Profiler.stop' ? { get profile() { throw new Error('PRIVATE_PROFILE_BODY') } } : send(method, params)
  await f.controller.start(); await f.controller.finish('failure')
  assert.ok(f.events.some(row => row.event === 'instrumentation-error' && row.kind === 'capture-error'))
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_'), false)
  f.controller.seal()
})

test('failed ownership reads reject otherwise parseable partial native evidence', async () => {
  let f, reads = 0
  f = profileFixture({ readRows: async () => { if (++reads > 2) throw new Error('PRIVATE_PROC_ERROR'); return f.rows }, sampleProcess: async () => {
    throw Object.assign(new Error('PRIVATE_SAMPLE_ERROR'), { code: 1, signal: null, stdout: Buffer.from('Call graph:\n    + 1 render (in Electron) + 1 [0x1234]\n') })
  } })
  await f.controller.start(); f.setTime(5100); await f.controller.checkStall(100, 'title')
  assert.equal(f.events.some(row => row.event === 'process-stack-sample'), false)
  assert.equal(f.events.filter(row => row.kind === 'ownership-read-unavailable').length, 2)
  assert.ok(f.events.some(row => row.kind === 'sample-failed' && row.code === 1 && row.signal === null))
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_'), false)
  await f.controller.finish('cleanup'); f.controller.seal()
})

test('native errors without frames remain explicit and do not fabricate a timeout cause', async () => {
  const f = profileFixture({ sampleProcess: async () => { throw Object.assign(new Error('PRIVATE_ERROR'), { code: null, signal: 'SIGTERM', killed: true, stderr: 'PRIVATE_STDERR' }) } })
  await f.controller.start(); f.setTime(5100); await f.controller.checkStall(100, 'title')
  assert.equal(f.events.some(row => row.event === 'process-stack-sample'), false)
  const errors = f.events.filter(row => row.kind === 'sample-failed')
  assert.equal(errors.length, 2)
  assert.ok(errors.every(row => row.killed && row.code === null && row.signal === 'SIGTERM' && row.configuredTimeoutMs === 2500 && !('timedOut' in row)))
  assert.equal(JSON.stringify(f.events).includes('PRIVATE_'), false)
  await f.controller.finish('cleanup'); f.controller.seal()
})

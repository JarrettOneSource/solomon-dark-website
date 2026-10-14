import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { HARNESS_SHA256, instrumentHarness, resolvePlaywrightImport } from './intel-startup-diagnostic.mjs'
import { driverOwnedProcesses, installRendererTelemetry, ownedForest, parseProcessRows, redactDiagnosticText, registerDiagnosticSecret, safeURL, trustedRegisteredRoots } from './desktop-timeout-observer.mjs'
import { createHash } from 'node:crypto'

const directory = dirname(fileURLToPath(import.meta.url))
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

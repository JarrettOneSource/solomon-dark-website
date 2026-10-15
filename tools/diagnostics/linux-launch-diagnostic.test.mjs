import assert from 'node:assert/strict'
import test from 'node:test'
import { createProtocolRecorder, parseProcStat, ownedProcesses } from './linux-launch-observer.mjs'

test('protocol recorder omits payloads before the first output and correlates responses', () => {
  const records = []
  const recorder = createProtocolRecorder(row => records.push(row))
  recorder.begin('resume')
  const log = recorder.logger('chrome')
  const secret = 'private-invite-and-credential-sentinel'
  log('send', { id: 5, method: 'Runtime.evaluate', sessionId: secret, params: { expression: secret } })
  log('receive', { id: 5, sessionId: secret, result: { value: secret } })
  log('receive', { method: secret, sessionId: secret, params: { value: secret } })
  assert.equal(JSON.stringify(records).includes(secret), false)
  assert.equal(records[0].method, 'Runtime.evaluate')
  assert.equal(records[1].method, 'Runtime.evaluate')
  assert.equal(records[0].session, records[1].session)
  assert.equal(records[2].method, 'other')
  assert.deepEqual(recorder.pending(), [])
  assert.deepEqual(Object.keys(records[0]).sort(), ['at', 'channel', 'direction', 'event', 'id', 'launch', 'method', 'monotonicMs', 'session'].sort())
})

test('protocol recorder separates Node and Chromium IDs and retains only safe pending metadata', () => {
  const rows = []
  const recorder = createProtocolRecorder(row => rows.push(row))
  recorder.begin('solo')
  const node = recorder.logger('node')
  const chrome = recorder.logger('chrome')
  node('send', { id: 1, method: 'Runtime.enable', params: { private: 'secret' } })
  chrome('send', { id: 1, method: 'Browser.getVersion', params: {} })
  chrome('receive', { id: 1, result: {} })
  assert.equal(recorder.pending().length, 1)
  assert.equal(recorder.pending()[0].channel, 'node')
  recorder.begin('resume')
  node('receive', { id: 1, result: { secret: 'secret' } })
  assert.equal(rows.at(-1).launch, 'solo')
  assert.equal(JSON.stringify(rows).includes('secret'), false)
  recorder.end('solo')
  const count = rows.length
  node('receive', { method: 'Runtime.consoleAPICalled', params: { text: 'secret' } })
  assert.equal(rows.length, count, 'Post-launch traffic must not add diagnostic overhead or output')
})

test('Linux identity parsing ignores command text and PID reuse cannot confer ownership', () => {
  const text = '21 (name with ) private text) S 10 21 21 ' + Array(15).fill('0').join(' ') + ' 123 0 0'
  assert.deepEqual(parseProcStat(text), { pid: 21, ppid: 10, pgid: 21, sid: 21, startTicks: '123', state: 'S' })
  const root = { pid: 21, ppid: 10, pgid: 21, sid: 21, startTicks: '123', state: 'S' }
  const child = { pid: 22, ppid: 21, pgid: 21, sid: 21, startTicks: '124', state: 'S' }
  const foreign = { pid: 30, ppid: 1, pgid: 30, sid: 30, startTicks: '124', state: 'S' }
  assert.deepEqual(ownedProcesses([root, child, foreign], [root], []).map(x => x.pid), [21, 22])
  assert.deepEqual(ownedProcesses([{ ...root, startTicks: '999' }, foreign], [root], []), [])
  assert.deepEqual(ownedProcesses([{ ...child, ppid: 1 }, foreign], [root], [child]).map(x => x.pid), [22])
  assert.deepEqual(ownedProcesses([{ ...child, ppid: 1 }, foreign], [root], []).map(x => x.pid), [22])
  assert.deepEqual(ownedProcesses([{ ...child, ppid: 1, pgid: 22 }, foreign], [root], []).map(x => x.pid), [22])
  assert.deepEqual(ownedProcesses([{ ...root, startTicks: '999' }, { ...child, ppid: 1, startTicks: '1000' }], [root], []), [])
})

import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createLinuxLaunchObserver } from './linux-launch-observer.mjs'
import { assertSafeEnvironment, HARNESS_SHA256, PLAYWRIGHT_SHA256, instrumentHarness, instrumentPlaywright, prepareDiagnostic, resolvePlaywrightPackage } from './linux-launch-diagnostic.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = process.env.SDR_SOURCE_ROOT ?? resolve(directory, '../..')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

test('all raw Playwright and Node tracing environments are rejected', () => {
  assert.doesNotThrow(() => assertSafeEnvironment({}))
  for (const name of ['DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'PWDEBUGIMPL', 'PW_INSTRUMENT_MODULES', 'NODE_OPTIONS', 'NODE_DEBUG', 'npm_config_pwdebug', 'npm_package_config_pwdebug'])
    assert.throws(() => assertSafeEnvironment({ [name]: 'secret-sentinel' }), undefined, name)
})

test('source hashes fail closed and original prefix assertions, timeouts and flags survive', async () => {
  const original = await readFile(join(sourceRoot, 'frontend/tools/smoke-desktop-runtime.mjs'), 'utf8')
  assert.equal(digest(original), HARNESS_SHA256)
  assert.throws(() => instrumentHarness(original + '\n', 'file:///observer.mjs', 'file:///playwright.mjs'))
  const source = instrumentHarness(original, 'file:///observer.mjs', 'file:///playwright.mjs')
  const prefix = original.slice(0, original.indexOf("  const resumed = await launch('resume'"))
  for (const line of prefix.match(/^\s*assert\..+$/gm)) assert.ok(source.includes(line))
  const optionsStart = original.indexOf('  const app = await electron.launch({')
  const optionsEnd = original.indexOf("  app.process().stderr.on", optionsStart)
  assert.ok(source.includes(original.slice(optionsStart, optionsEnd)))
  for (const name of ['title', 'enterHub', 'readyHub', 'hubFrame', 'move', 'hostProcess', 'close', 'waitForExit']) {
    const start = original.indexOf('async function ' + name + '(')
    const next = original.indexOf('\nasync function ', start + 1)
    assert.ok(source.includes(original.slice(start, next < 0 ? original.length : next).trim()), name)
  }
  assert.ok(!source.includes('receipt.json'))
  assert.ok(!source.includes('invitation'))
  assert.ok(!source.includes('resumed.page'))
  assert.ok(!source.includes('process.stderr.write'))
  assert.ok(!source.includes('.png'))
  assert.equal((source.match(/await solo.page.screenshot\(\)/g) ?? []).length, 2)
  assert.ok(source.indexOf('diagnostics.returned(label, app)') < source.indexOf('if (label === "resume")'))
  assert.ok(source.indexOf('if (label === "resume")') < source.indexOf('const page = await app.firstWindow'))
})

test('generated Playwright has only fixed metadata hooks and retains its full import layout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'linux-diagnostic-copy-test-'))
  try {
    const { original, packageRoot } = await resolvePlaywrightPackage(sourceRoot)
    assert.equal(digest(original), PLAYWRIGHT_SHA256)
    assert.throws(() => instrumentPlaywright(original + '\n'))
    const generated = instrumentPlaywright(original)
    assert.ok(generated.includes('.logger("node")'))
    assert.ok(generated.includes('.logger("chrome")'))
    assert.ok(generated.includes('.stage("first-noninitial-navigation-ready")'))
    assert.ok(generated.includes('.stage("first-noninitial-navigation-failed")'))
    assert.equal((generated.match(/\.logger\("(?:node|chrome)"\)/g) ?? []).length, 2)
    const prepared = await prepareDiagnostic({ sourceRoot, outputDirectory: join(root, 'evidence'), runtimeDirectory: join(root, 'runtime') })
    execFileSync(process.execPath, ['--check', prepared.harnessPath])
    execFileSync(process.execPath, ['--check', join(prepared.packageCopy, 'lib/coreBundle.js')])
    const pw = await import(prepared.playwrightURL)
    assert.equal(typeof pw._electron.launch, 'function')
    for (const path of ['lib/server/electron/loader.js', 'lib/utilsBundle.js', 'lib/bootstrap.js', 'package.json'])
      assert.equal(digest(await readFile(join(prepared.packageCopy, path))), digest(await readFile(join(packageRoot, path))), path)
    assert.equal(digest(await readFile(join(packageRoot, 'lib/coreBundle.js'))), PLAYWRIGHT_SHA256)
    assert.equal(prepared.binding.acceptance, false)
  } finally { await rm(root, { recursive: true, force: true }) }
})

async function observerFixture(action) {
  const root = await mkdtemp(join(tmpdir(), 'linux-launch-observer-test-'))
  const appRoot = { pid: 90001, ppid: process.pid, pgid: 90001, sid: 90001, startTicks: '100', state: 'S' }
  const descendant = { pid: 90002, ppid: 90001, pgid: 90001, sid: 90001, startTicks: '101', state: 'S' }
  const foreign = { pid: 90003, ppid: 1, pgid: 90003, sid: 90003, startTicks: '100', state: 'S' }
  let rows = [appRoot, descendant, foreign]
  const signals = []
  const child = Object.assign(new EventEmitter(), { pid: appRoot.pid, exitCode: null, signalCode: null, stdout: new EventEmitter(), stderr: new EventEmitter() })
  const observer = createLinuxLaunchObserver({
    outputDirectory: root, executable: '/synthetic/solomon-darker', poll: false,
    readProcesses: () => rows,
    signal: (pid, signal) => { signals.push({ pid, signal }); rows = rows.filter(row => row.pid !== pid) },
  })
  try { await action({ root, observer, child, signals, setRows: next => { rows = next }, appRoot, descendant, foreign }) }
  finally { await rm(root, { recursive: true, force: true }) }
}

test('failed launch before an app exists retains safe pending methods and reaps only owned identities', async () => {
  await observerFixture(async ({ root, observer, child, signals, setRows, appRoot, descendant, foreign }) => {
    observer.begin('resume')
    observer.spawned(child, '/synthetic/solomon-darker')
    const log = observer.logger('chrome')
    log('send', { id: 9, method: 'Browser.getVersion', params: { credential: 'private-sentinel' } })
    child.stdout.emit('data', 'private-sentinel')
    child.stderr.emit('data', 'private-sentinel')
    setRows([{ ...descendant, ppid: 1 }, foreign])
    observer.failure(new Error('private-sentinel'))
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => {}), true)
    assert.deepEqual(signals.map(row => row.pid), [descendant.pid])
    const outcome = JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8'))
    assert.equal(outcome.secondLaunch, 'failed-before-resolution')
    assert.equal(outcome.processOwnershipProven, true)
    assert.equal(outcome.processExitProven, true)
    assert.equal(outcome.pending[0].method, 'Browser.getVersion')
    assert.ok(!(await readFile(join(root, 'launch-events.jsonl'), 'utf8')).includes('private-sentinel'))
    assert.ok(!JSON.stringify(outcome).includes('private-sentinel'))
  })
})

test('first launch failure is reported as second launch not reached', async () => {
  await observerFixture(async ({ root, observer, setRows }) => {
    observer.begin('solo')
    setRows([])
    observer.failure(new Error('private-sentinel'))
    await observer.cleanup('/synthetic/profiles', async () => {})
    assert.equal(JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8')).secondLaunch, 'not-reached')
  })
})

test('cleanup failure preserves outcome and never writes exception text', async () => {
  await observerFixture(async ({ root, observer, setRows }) => {
    observer.begin('solo')
    setRows([])
    observer.failure(new Error('private-sentinel'))
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => { throw new Error('private-sentinel') }), false)
    const text = await readFile(join(root, 'launch-outcome.json'), 'utf8')
    assert.equal(JSON.parse(text).cleanupFailed, true)
    assert.ok(!text.includes('private-sentinel'))
  })
})

test('PID reuse during cleanup is not signalled', async () => {
  await observerFixture(async ({ observer, child, setRows, appRoot, foreign, signals }) => {
    observer.begin('resume')
    observer.spawned(child, '/synthetic/solomon-darker')
    setRows([{ ...appRoot, startTicks: '999' }, foreign])
    observer.failure(new Error('private-sentinel'))
    await observer.cleanup('/synthetic/profiles', async () => {})
    assert.deepEqual(signals, [])
  })
})

test('initial spawn identity read failure cannot interrupt Playwright setup or claim an exit proof', async () => {
  const root = await mkdtemp(join(tmpdir(), 'linux-identity-failure-'))
  const child = Object.assign(new EventEmitter(), { pid: 90001, stdout: new EventEmitter(), stderr: new EventEmitter() })
  let failRead = false
  let profileRemoved = false
  const signals = []
  const observer = createLinuxLaunchObserver({
    outputDirectory: root, executable: '/synthetic/solomon-darker', poll: false,
    readProcesses: () => { if (failRead) throw new Error('private-sentinel'); return [] },
    signal: pid => signals.push(pid),
  })
  try {
    observer.begin('resume')
    failRead = true
    assert.doesNotThrow(() => observer.spawned(child, '/synthetic/solomon-darker'))
    failRead = false
    observer.failure(new Error('private-sentinel'))
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => { profileRemoved = true }), false)
    const outcome = JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8'))
    assert.equal(outcome.processOwnershipProven, false)
    assert.equal(outcome.processExitProven, false)
    assert.equal(profileRemoved, false)
    assert.deepEqual(signals, [])
    assert.ok(!(await readFile(join(root, 'launch-events.jsonl'), 'utf8')).includes('private-sentinel'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('Linux workflow remains one exact-branch diagnostic job with immutable artifact guards', async () => {
  const workflow = await readFile(join(directory, '../../.github/workflows/linux-launch-diagnostic.yml'), 'utf8')
  const intel = await readFile(join(directory, '../../.github/workflows/intel-startup-diagnostic.yml'), 'utf8').catch(() => '')
  assert.match(workflow, /branches:\n      - codex\/diagnose-intel-c20-sh9aksle\n    paths:/)
  for (const path of ['.github/workflows/linux-launch-diagnostic.yml', 'tools/diagnostics/linux-launch-diagnostic.mjs', 'tools/diagnostics/linux-launch-diagnostic.test.mjs', 'tools/diagnostics/linux-launch-observer.mjs'])
    assert.ok(workflow.includes('      - ' + path))
  assert.equal((workflow.match(/^  [a-z][a-z-]+:$/gm) ?? []).filter(line => !line.includes('push:')).length, 1)
  assert.match(workflow, /permissions:\n  contents: read\n  actions: read/)
  assert.ok(!workflow.includes('contents: write'))
  assert.ok(!workflow.includes('workflow_dispatch'))
  assert.ok(!workflow.includes('npm run package'))
  assert.ok(!workflow.includes('gh release'))
  assert.ok(!workflow.includes('cancel-in-progress'))
  assert.ok(workflow.includes("EXPECTED_ARTIFACT_ID: '11916140735'"))
  assert.ok(workflow.includes('057c452995a6cee268baf89bcfe41fed4a10a2313d88d0dd2b1441235b70efd0'))
  for (const required of ['digest == expected', 'inner_digest == match[1]', 'manifest["revision"] == revision', 'manifest["electronVersion"] == "43.4.0"', 'manifest["nodeRuntime"]["version"] == "22.17.0"', 'package-files-after.json', 'playwright-files-after.json', 'xvfb-run -a node', '--ignore-scripts'])
    assert.ok(workflow.includes(required), required)
  if (intel) assert.ok(!intel.split('permissions:')[0].includes('linux-launch'))
})


test('runner-dependent paths are initialized only in an available step context', async () => {
  const workflow = await readFile(join(directory, '../../.github/workflows/linux-launch-diagnostic.yml'), 'utf8')
  const jobEnv = workflow.match(/^    env:\n([\s\S]*?)^    steps:/m)?.[1]
  assert.ok(jobEnv, 'Expected one job environment block')
  assert.ok(!jobEnv.includes('runner.'), 'The runner context is unavailable in jobs.<job_id>.env')
  const prepare = workflow.split('      - name: Prepare separate evidence and verify source')[1]?.split('      - name:')[0]
  assert.ok(prepare, 'Expected the path preparation step')
  for (const variable of ['SDR_DESKTOP_APP', 'SDR_DESKTOP_EVIDENCE', 'SDR_DIAGNOSTIC_RUNTIME']) {
    assert.ok(prepare.includes('          ' + variable + ': ${{ runner.temp }}/'), variable + ' must use a step-level runner context')
    assert.ok(prepare.includes('"' + variable + '=$' + variable + '"'), variable + ' must persist for subsequent steps')
  }
  assert.ok(prepare.includes('>> "$GITHUB_ENV"'))
})

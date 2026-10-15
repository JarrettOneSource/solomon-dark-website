import assert from 'node:assert/strict'
import test from 'node:test'
import { CAPTURE_LIMITS, createProtocolRecorder, parseProcStat, parseProcessRole, ownedProcesses } from './linux-launch-observer.mjs'

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
  assert.deepEqual(Object.keys(records[0]).sort(), ['at', 'channel', 'direction', 'durationMs', 'event', 'id', 'launch', 'method', 'monotonicMs', 'outcome', 'session'].sort())
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
  assert.deepEqual(parseProcStat(text), { pid: 21, ppid: 10, pgid: 21, sid: 21, startTicks: '123', state: 'S', cpuTicks: '0' })
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
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createLinuxLaunchObserver } from './linux-launch-observer.mjs'
import { assertSafeEnvironment, REVISION, HARNESS_SHA256, PLAYWRIGHT_SHA256, instrumentHarness, instrumentPlaywright, prepareDiagnostic, resolvePlaywrightPackage } from './linux-launch-diagnostic.mjs'

const directory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = process.env.SDR_SOURCE_ROOT ?? resolve(directory, '../..')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

test('all raw Playwright and Node tracing environments are rejected', () => {
  assert.doesNotThrow(() => assertSafeEnvironment({}))
  for (const name of ['DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'PWDEBUGIMPL', 'PW_INSTRUMENT_MODULES', 'NODE_OPTIONS', 'NODE_DEBUG', 'npm_config_pwdebug', 'npm_package_config_pwdebug'])
    assert.throws(() => assertSafeEnvironment({ [name]: 'secret-sentinel' }), undefined, name)
})

test('source hashes fail closed and all original assertions, screenshots, timeouts and flags survive', async () => {
  const original = await readFile(join(sourceRoot, 'frontend/tools/smoke-desktop-runtime.mjs'), 'utf8')
  assert.equal(digest(original), HARNESS_SHA256)
  assert.throws(() => instrumentHarness(original + '\n', 'file:///observer.mjs', 'file:///playwright.mjs', '/tmp/diagnostic/captures'))
  const source = instrumentHarness(original, 'file:///observer.mjs', 'file:///playwright.mjs', '/tmp/diagnostic/captures')
  const assertions = original.match(/^\s*assert\..+$/gm)
  assert.equal(assertions.length, 19)
  for (const line of assertions) assert.ok(source.includes(line), line)
  const optionsStart = original.indexOf('  const app = await electron.launch({')
  const optionsEnd = original.indexOf("  app.process().stderr.on", optionsStart)
  assert.ok(source.includes(original.slice(optionsStart, optionsEnd)))
  for (const name of ['title', 'enterHub', 'readyHub', 'hubFrame', 'move', 'readSave', 'hostProcess', 'proveUpdatePrompt', 'close', 'waitForExit', 'freePort']) {
    const start = original.indexOf('async function ' + name + '(')
    const next = original.indexOf('\nasync function ', start + 1)
    assert.ok(source.includes(original.slice(start, next < 0 ? original.length : next).trim()), name)
  }
  assert.ok(!source.includes('receipt.json'))
  assert.ok(source.includes("const guest = await launch('guest'"))
  assert.ok(source.includes('resumed.page'))
  assert.ok(!source.includes('process.stderr.write'))
  const captures = original.match(/^\s*await (?:solo|resumed|host|guest|instance)\.page\.screenshot\(.+$/gm).filter(line => !line.includes('-failure.png'))
  assert.equal(captures.length, 6)
  for (const line of captures) assert.ok(source.includes(line), line)
  assert.ok(!source.includes('-failure.png'), 'Do not add or retain fallback captures')
  assert.ok(!source.includes('body.slice'))
  assert.ok(!source.includes('JSON.stringify({ status:'))
  const workload = original.slice(original.indexOf('try {'), original.indexOf('} catch (error) {'))
  const generatedWorkload = source.slice(source.indexOf('try {'), source.indexOf('} catch (error) {'))
  for (const line of workload.split('\n').filter(line => line.trim() && !line.includes('writeFile(') && !line.includes('process.stdout.write')))
    assert.ok(generatedWorkload.includes(line), 'Original workload line lost: ' + line)
  assert.ok(source.indexOf('diagnostics.captureStart([host, guest])') < source.indexOf("await host.page.screenshot({ path: join(evidence, 'peer-host-boneyard.png') })"))
  assert.ok(source.indexOf('diagnostics.captureStop()') > source.indexOf("await guest.page.screenshot({ path: join(evidence, 'peer-guest-boneyard.png') })"))
  assert.ok(!generatedWorkload.includes('await diagnostics.'), 'Observers cannot add workload waits')
  const workloadLines = text => text.split('\n').filter(line => line.trim() && !line.trim().startsWith('diagnostics.') && !line.includes('writeFile(') && !line.includes('process.stdout.write'))
  assert.deepEqual(workloadLines(generatedWorkload), workloadLines(workload), 'Original workload call order and gates must be exact')
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
    assert.equal(REVISION, '39875413fa2d3313d5d42170993c7dfa3e885cd1')
    assert.equal(prepared.binding.productRevision, REVISION)
    assert.match(prepared.binding.scope, /retained package 11997259442 from failed exact-source qualification run 38787359411/)
    assert.deepEqual(await readdir(join(root, 'evidence')), ['source-binding.json'])
    assert.ok((await readFile(prepared.harnessPath, 'utf8')).includes('const evidence = ' + JSON.stringify(join(prepared.generatedRoot, 'captures'))))
    await assert.rejects(prepareDiagnostic({ sourceRoot, outputDirectory: join(root, 'evidence'), runtimeDirectory: join(root, 'evidence', 'runtime') }), /separate/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

async function createDiagnosticSourceFixture(path) {
  const { packageRoot } = await resolvePlaywrightPackage(sourceRoot)
  await mkdir(join(path, 'frontend/tools'), { recursive: true })
  await mkdir(join(path, 'frontend/node_modules'), { recursive: true })
  await symlink(resolve(sourceRoot, 'frontend/tools/smoke-desktop-runtime.mjs'), join(path, 'frontend/tools/smoke-desktop-runtime.mjs'))
  await symlink(packageRoot, join(path, 'frontend/node_modules/playwright-core'), 'dir')
}

for (const ancestor of ['outputDirectory', 'runtimeDirectory']) {
  test('diagnostic rejects ' + ancestor + ' containing the product source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'linux-diagnostic-ancestor-test-'))
    try {
      const paths = { outputDirectory: join(root, 'evidence'), runtimeDirectory: join(root, 'runtime') }
      paths.sourceRoot = join(paths[ancestor], 'product')
      await createDiagnosticSourceFixture(paths.sourceRoot)
      await assert.rejects(prepareDiagnostic(paths), /outside product/)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

const diagnosticPaths = root => ({
  sourceRoot: join(root, 'product'), outputDirectory: join(root, 'evidence'),
  runtimeDirectory: join(root, 'runtime'), appRoot: join(root, 'app'),
})

test('diagnostic boundaries reject equality and both containment directions after symlink canonicalization', async () => {
  const pairs = [
    ['sourceRoot', 'outputDirectory', /outside product/],
    ['sourceRoot', 'runtimeDirectory', /outside product/],
    ['outputDirectory', 'runtimeDirectory', /separate/],
    ['appRoot', 'outputDirectory', /outside packaged app/],
    ['appRoot', 'runtimeDirectory', /outside packaged app/],
  ]
  for (const [first, second, expected] of pairs) {
    for (const relation of ['equal', 'first-parent', 'second-parent']) {
      for (const alias of [undefined, first, second]) {
        const root = await mkdtemp(join(tmpdir(), 'linux-diagnostic-boundary-test-'))
        const label = [first, second, relation, alias ?? 'direct'].join(' ')
        try {
          const paths = diagnosticPaths(root)
          if (relation === 'equal') paths[second] = paths[first]
          if (relation === 'first-parent') paths[second] = join(paths[first], 'child')
          if (relation === 'second-parent') paths[first] = join(paths[second], 'child')
          for (const path of Object.values(paths)) await mkdir(path, { recursive: true })
          if (alias) {
            await symlink(paths[alias], join(root, 'alias'), 'dir')
            paths[alias] = join(root, 'alias')
          }
          const before = (await readdir(root, { recursive: true })).sort()
          await assert.rejects(prepareDiagnostic(paths), expected, label)
          assert.deepEqual((await readdir(root, { recursive: true })).sort(), before, label)
        } finally { await rm(root, { recursive: true, force: true }) }
      }
    }
  }
})

test('filesystem roots cannot bypass diagnostic directory boundaries', async () => {
  for (const [field, expected] of [
    ['sourceRoot', /outside product/], ['outputDirectory', /separate/],
    ['runtimeDirectory', /separate/], ['appRoot', /outside packaged app/],
  ]) {
    const root = await mkdtemp(join(tmpdir(), 'linux-diagnostic-root-test-'))
    try {
      const paths = diagnosticPaths(root)
      for (const path of Object.values(paths)) await mkdir(path, { recursive: true })
      paths[field] = parse(root).root
      await assert.rejects(prepareDiagnostic(paths), expected, field)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
})

test('rejected nested paths never create directories inside source or packaged app', async () => {
  for (const owner of ['sourceRoot', 'appRoot']) {
    for (const output of ['outputDirectory', 'runtimeDirectory']) {
      for (const alias of [false, true]) {
        const root = await mkdtemp(join(tmpdir(), 'linux-diagnostic-no-write-test-'))
        const label = [owner, output, alias ? 'symlink-parent' : 'direct-parent'].join(' ')
        try {
          const paths = diagnosticPaths(root)
          for (const path of Object.values(paths)) await mkdir(path, { recursive: true })
          let parent = paths[owner]
          if (alias) {
            parent = join(root, 'alias')
            await symlink(paths[owner], parent, 'dir')
          }
          paths[output] = join(parent, 'missing', 'diagnostic')
          const before = (await readdir(root, { recursive: true })).sort()
          await assert.rejects(prepareDiagnostic(paths), /outside product|outside packaged app/, label)
          assert.deepEqual((await readdir(root, { recursive: true })).sort(), before, label)
        } finally { await rm(root, { recursive: true, force: true }) }
      }
    }
  }
})

test('disjoint sibling prefixes and symlink parents prepare without changing the original source', async () => {
  for (const alias of [false, true]) {
    const root = await mkdtemp(join(tmpdir(), 'linux-diagnostic-disjoint-test-'))
    try {
      let parent = join(root, 'workspace')
      await mkdir(parent)
      if (alias) {
        await symlink(parent, join(root, 'alias'), 'dir')
        parent = join(root, 'alias')
      }
      const paths = {
        sourceRoot: join(parent, 'product'), outputDirectory: join(parent, 'product-evidence'),
        runtimeDirectory: join(parent, 'product-runtime'), appRoot: join(parent, 'product-app'),
      }
      await createDiagnosticSourceFixture(paths.sourceRoot)
      await mkdir(paths.appRoot)
      const prepared = await prepareDiagnostic(paths)
      assert.equal(prepared.binding.acceptance, false)
      assert.deepEqual(await readdir(paths.outputDirectory), ['source-binding.json'])
      assert.deepEqual(await readdir(paths.appRoot), [])
      assert.equal(digest(await readFile(join(paths.sourceRoot, 'frontend/tools/smoke-desktop-runtime.mjs'))), HARNESS_SHA256)
      assert.equal(digest((await resolvePlaywrightPackage(sourceRoot)).original), PLAYWRIGHT_SHA256)
    } finally { await rm(root, { recursive: true, force: true }) }
  }
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
  assert.ok(workflow.includes("EXPECTED_ARTIFACT_ID: '11997259442'"))
  assert.ok(workflow.includes('70ca300f9cbf665c3700899a5b716153249d60c5dff496db40e625fd592defa7'))
  for (const required of ['digest == expected', 'inner_digest == match[1] == os.environ["EXPECTED_INNER_DIGEST"]', 'manifest_digest == os.environ["EXPECTED_MANIFEST_DIGEST"]', 'failed["head_sha"] == orchestration', 'failed["conclusion"] == "failure"', 'meta["workflow_run"]["head_sha"] == orchestration', 'EXPECTED_PRODUCT_TREE', '38787359411', '116602702052', '79edf19e60a82ff0ec5f4a512f9797e36ab6bc9269f5b9c87020e37a0dcc5a27', 'manifest["revision"] == revision', 'manifest["electronVersion"] == "43.4.0"', 'manifest["nodeRuntime"]["version"] == "22.17.0"', 'package-files-after.json', 'playwright-files-after.json', 'xvfb-run -a node', '--ignore-scripts'])
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


test('capture protocol stays observable after launch and separates both peer owners', () => {
  const records = []
  const recorder = createProtocolRecorder(row => records.push(row))
  recorder.begin('host')
  const host = recorder.logger('chrome')
  recorder.launched('host')
  recorder.begin('guest')
  const guest = recorder.logger('chrome')
  recorder.launched('guest')
  const secret = 'private-invitation-save-url-sentinel'
  for (const logger of [host, guest]) {
    logger('send', { id: 1, method: 'Page.getLayoutMetrics', sessionId: secret, params: { secret } })
    logger('receive', { id: 1, sessionId: secret, result: { secret } })
    logger('send', { id: 2, method: 'Page.captureScreenshot', sessionId: secret, params: { secret } })
  }
  host('receive', { id: 2, sessionId: secret, result: { data: secret } })
  assert.equal(recorder.pending().length, 1)
  assert.equal(recorder.pending()[0].launch, 'guest')
  assert.equal(recorder.pending()[0].method, 'Page.captureScreenshot')
  guest('receive', { id: 2, sessionId: secret, error: { message: secret } })
  assert.equal(records.at(-1).outcome, 'error')
  assert.ok(records.at(-1).durationMs >= 0)
  assert.deepEqual(recorder.pending(), [])
  guest('send', { id: 3, method: 'Page.getLayoutMetrics', params: { secret } })
  assert.equal(recorder.pending()[0].method, 'Page.getLayoutMetrics')
  const count = records.length
  host('send', { id: 4, method: 'Runtime.evaluate', params: { expression: secret } })
  assert.equal(records.length, count, 'Post-launch non-capture traffic is discarded')
  assert.ok(!JSON.stringify([records, recorder.pending()]).includes(secret))
  assert.throws(() => recorder.begin(secret))
})

test('protocol observation has finite pending, session and event limits', () => {
  const records = []
  const recorder = createProtocolRecorder(row => records.push(row))
  recorder.begin('guest')
  const log = recorder.logger('chrome')
  for (let id = 0; id < 20_000; id++)
    log('send', { id, method: 'Page.getLayoutMetrics', sessionId: 'untrusted-' + id, params: { secret: 'private-sentinel' } })
  assert.ok(records.length <= 8192)
  assert.ok(recorder.pending().length <= 256)
  assert.ok(recorder.limits().sessionLimit > 0, 'Discarded metadata must be disclosed')
  assert.ok(!JSON.stringify(records).includes('untrusted-'))
  assert.ok(!JSON.stringify(records).includes('private-sentinel'))
})


async function peerObserverFixture(action, { extraRows = [], scan = rows => rows, role = pid => pid === 91001 ? 'renderer' : pid === 92001 ? 'gpu' : 'other' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'linux-peer-observer-test-'))
  const secret = 'private-invitation-save-url-sentinel'
  let rows = [
    { pid: 91000, ppid: process.pid, pgid: 91000, sid: 91000, startTicks: '100', state: 'S', cpuTicks: '10' },
    { pid: 91001, ppid: 91000, pgid: 91000, sid: 91000, startTicks: '101', state: 'R', cpuTicks: '20' },
    { pid: 92000, ppid: process.pid, pgid: 92000, sid: 92000, startTicks: '110', state: 'S', cpuTicks: '30' },
    { pid: 92001, ppid: 92000, pgid: 92000, sid: 92000, startTicks: '111', state: 'R', cpuTicks: '40' },
    { pid: 93000, ppid: 1, pgid: 93000, sid: 93000, startTicks: '200', state: 'R', cpuTicks: '9999' },
    ...extraRows,
  ]
  const signals = []
  const roleReads = []
  const observer = createLinuxLaunchObserver({
    outputDirectory: root, executable: '/synthetic/solomon-darker', poll: false,
    readProcesses: () => scan(rows),
    readProcessRole: pid => { roleReads.push(pid); return role(pid) },
    signal: (pid, signal) => { signals.push({ pid, signal }); rows = rows.filter(row => row.pid !== pid) },
  })
  const peers = ['host', 'guest'].map((label, index) => {
    const pid = index ? 92000 : 91000
    const child = Object.assign(new EventEmitter(), { pid, exitCode: null, signalCode: null, stdout: new EventEmitter(), stderr: new EventEmitter() })
    const app = {
      process: () => child,
      close: async () => { rows = rows.filter(row => row.sid !== pid); child.exitCode = 0 },
    }
    observer.begin(label)
    observer.spawned(child, '/synthetic/solomon-darker')
    observer.returned(label, app)
    return { label, app, page: null }
  })
  try {
    await action({ root, secret, observer, peers, signals, roleReads, advanceCpu: () => { rows = rows.map(row => ({ ...row, cpuTicks: String(Number(row.cpuTicks) + 7) })) } })
  } finally {
    observer.captureStop()
    await observer.cleanup('/synthetic/profiles', async () => {})
    await rm(root, { recursive: true, force: true })
  }
}

const settleProbes = async () => { for (let step = 0; step < 6; step++) await Promise.resolve() }

test('frame probes stay non-blocking and bounded while ownership and CPU progress remain distinct', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  await peerObserverFixture(async ({ root, secret, observer, peers, roleReads, advanceCpu }) => {
    const calls = { host: 0, guest: 0 }
    peers[0].page = { evaluate: async () => {
      calls.host++
      return { frameCount: calls.host, playerCount: 2, visibility: 'visible', hidden: false, focused: true, rendererReady: true, overlayPresent: false, secret }
    } }
    peers[1].page = { evaluate: () => { calls.guest++; return new Promise(() => {}) } }
    assert.equal(observer.captureStart(peers), undefined)
    await settleProbes()
    advanceCpu()
    t.mock.timers.tick(CAPTURE_LIMITS.intervalMs)
    await settleProbes()
    assert.deepEqual(calls, { host: 2, guest: 1 }, 'One hung guest probe must not block host progress or queue more probes')
    for (let tick = 0; tick <= CAPTURE_LIMITS.ticks; tick++) {
      t.mock.timers.tick(CAPTURE_LIMITS.intervalMs)
      await settleProbes()
    }
    assert.equal(calls.host, CAPTURE_LIMITS.ticks)
    assert.equal(calls.guest, 1)
    const events = (await readFile(join(root, 'launch-events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
    const cpu = events.filter(row => row.event === 'capture-process-progress')
    assert.ok(cpu.some(row => row.owner === 'host' && row.role === 'renderer' && row.deltaCpuTicks === '7'))
    assert.ok(cpu.some(row => row.owner === 'guest' && row.role === 'gpu' && row.deltaCpuTicks === '7'))
    assert.ok(cpu.every(row => row.pid === 91001 || row.pid === 92001))
    assert.ok(!roleReads.includes(93000), 'Never read a foreign process command line')
    assert.equal(events.filter(row => row.event === 'capture-frame-progress').length, CAPTURE_LIMITS.ticks)
    const stop = events.find(row => row.event === 'capture-observation-stop')
    assert.equal(stop.probes.find(peer => peer.owner === 'guest').pending, true)
    assert.equal(stop.ticks, CAPTURE_LIMITS.ticks)
    assert.ok(!JSON.stringify(events).includes(secret))
  })
})

test('capture failure stays primary and cleanup never waits for a slow or rejected probe', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  await peerObserverFixture(async ({ root, secret, observer, peers, signals }) => {
    let rejectGuest
    peers[0].page = { evaluate: async () => { throw new Error(secret) } }
    peers[1].page = { evaluate: () => new Promise((_resolve, reject) => { rejectGuest = reject }) }
    assert.throws(() => observer.captureStart([{ ...peers[0], app: {} }, peers[1]]), /registered app/)
    observer.captureStart(peers)
    observer.stage('peer-capture-start', 'guest')
    const captureLog = observer.logger('chrome')
    captureLog('send', { id: 77, method: 'Page.captureScreenshot', params: { private: secret } })
    await settleProbes()
    const failure = Object.assign(new Error(secret), { name: 'TimeoutError' })
    observer.failure(failure)
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => {}), true)
    const before = await readFile(join(root, 'launch-events.jsonl'), 'utf8')
    rejectGuest(new Error(secret))
    await settleProbes()
    assert.equal(await readFile(join(root, 'launch-events.jsonl'), 'utf8'), before, 'Late probes must not write after cleanup')
    const outcome = JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8'))
    assert.equal(outcome.failureKind, 'TimeoutError')
    assert.equal(outcome.captureOwner, 'guest')
    assert.equal(outcome.frameCoverageLimited, true)
    assert.equal(outcome.instrumentationLimited, true)
    assert.equal(outcome.pending.find(row => row.id === 77).method, 'Page.captureScreenshot')
    assert.equal(outcome.pending.find(row => row.id === 77).launch, 'guest')
    const failed = before.trim().split('\n').map(JSON.parse).find(row => row.event === 'workload-failed')
    assert.equal(failed.captureOwner, 'guest')
    assert.equal(failed.pending.find(row => row.id === 77).method, 'Page.captureScreenshot')
    assert.equal(outcome.processExitProven, true)
    assert.equal(outcome.workloadComplete, false)
    assert.deepEqual(signals, [])
    assert.ok(!before.includes(secret))
    assert.ok(!JSON.stringify(outcome).includes(secret))
  })
})

test('process CPU counters and renderer roles project no command-line data', () => {
  const fields = ['R', '10', '21', '21', ...Array(15).fill('0'), '123', '0', '0']
  fields[11] = '9007199254740993'
  fields[12] = '100'
  assert.equal(parseProcStat('21 (private-secret) ' + fields.join(' ')).cpuTicks, '9007199254741093')
  assert.equal(parseProcessRole('/app\0--type=renderer\0private-secret\0'), 'renderer')
  assert.equal(parseProcessRole('/app\0--type=gpu-process\0private-secret\0'), 'gpu')
  assert.equal(parseProcessRole('/app\0--url=private-secret--type=renderer\0'), 'other')
  assert.throws(() => parseProcStat('21 (private-secret) ' + fields.map((value, index) => index === 11 ? 'private-secret' : value).join(' ')))
})


test('role parser recognizes rewritten Chromium titles without splitting genuine argv payloads', () => {
  for (const [marker, role] of [['renderer', 'renderer'], ['gpu-process', 'gpu']]) {
    for (const title of [
      `/app --type=${marker} --private=private-sentinel`,
      `/path with spaces/app --type=${marker} --private=private-sentinel\0\0\0`,
      `/app\t--type=${marker}\t--private=private-sentinel\0`,
      `/path with spaces/app\0--type=${marker}\0--private=private-sentinel\0`,
    ]) assert.equal(parseProcessRole(title), role)
  }
  for (const title of [
    '', '/app', '/app --type=utility',
    '/app --type=renderer-extra', '/app --type=gpu-process-extra',
    '/app --url=private-sentinel--type=renderer',
    '/app --url=private-sentinel?role=--type=gpu-process',
    '/app "--type=renderer"',
    '/app\0--url=private-sentinel --type=renderer\0',
    '/app\0--private= --type=gpu-process\0',
    '/app --type=renderer --type=gpu-process',
    '/app\0--type=renderer\0--type=utility\0',
  ]) assert.equal(parseProcessRole(title), 'other')
})

test('missing CPU role coverage stays explicit even when the workload completes', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  await peerObserverFixture(async ({ root, secret, observer, peers }) => {
    for (const peer of peers) peer.page = { evaluate: async () => ({ frameCount: 1, playerCount: 2 }) }
    observer.captureStart(peers)
    await settleProbes()
    t.mock.timers.tick(CAPTURE_LIMITS.intervalMs)
    await settleProbes()
    observer.captureStop()
    observer.stage('workload-complete')
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => {}), true)
    const outcome = JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8'))
    assert.equal(outcome.workloadComplete, true)
    assert.equal(outcome.failureKind, null)
    assert.equal(outcome.instrumentationLimited, true)
    assert.equal(outcome.captureRoleCoverage.status, 'incomplete')
    for (const owner of outcome.captureRoleCoverage.owners) {
      assert.equal(owner.samples, 2)
      assert.equal(owner.completeSamples, 0)
      assert.deepEqual(owner.processSamples, { renderer: 0, gpu: 0, other: 4, unavailable: 0 })
      assert.deepEqual(owner.cpuSamples, { renderer: 0, gpu: 0 })
    }
    const events = (await readFile(join(root, 'launch-events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(events.filter(row => row.event === 'capture-process-progress').length, 0)
    assert.ok(events.filter(row => row.event === 'capture-process-scan').every(row => row.roleCoverage.length === 2))
    assert.ok(!JSON.stringify([outcome, events]).includes(secret))
  }, { role: () => parseProcessRole('/app --private=private-invitation-save-url-sentinel') })
})


const completeRoleRows = [
  { pid: 91002, ppid: 91000, pgid: 91000, sid: 91000, startTicks: '102', state: 'S', cpuTicks: '50' },
  { pid: 92002, ppid: 92000, pgid: 92000, sid: 92000, startTicks: '112', state: 'R', cpuTicks: '60' },
]
const completeRole = pid => parseProcessRole({
  91001: '/private/path with spaces/app --type=renderer --private=private-invitation-save-url-sentinel\0\0',
  91002: '/private/path with spaces/app\0--type=gpu-process\0--private=private-invitation-save-url-sentinel\0',
  92001: '/private/app --type=gpu-process --private=private-invitation-save-url-sentinel',
  92002: '/private/app\0--type=renderer\0--private=private-invitation-save-url-sentinel\0',
}[pid] ?? '/private/app --private=private-invitation-save-url-sentinel')

async function observeTwoCpuSamples(t, fixture, check) {
  t.mock.timers.enable({ apis: ['setInterval'] })
  await peerObserverFixture(async context => {
    const { root, secret, observer, peers, advanceCpu } = context
    for (const peer of peers) peer.page = { evaluate: async () => ({ frameCount: 3, playerCount: 2 }) }
    observer.captureStart(peers)
    await settleProbes()
    advanceCpu()
    t.mock.timers.tick(CAPTURE_LIMITS.intervalMs)
    await settleProbes()
    observer.captureStop()
    observer.stage('workload-complete')
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => {}), true)
    const outcome = JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8'))
    const events = (await readFile(join(root, 'launch-events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(outcome.workloadComplete, true)
    assert.equal(outcome.failureKind, null)
    assert.ok(!JSON.stringify([outcome, events]).includes(secret))
    await check({ ...context, outcome, events })
  }, fixture)
}

test('both argv forms feed complete owned renderer and GPU CPU coverage for each peer', async t => {
  await observeTwoCpuSamples(t, { extraRows: completeRoleRows, role: completeRole }, ({ outcome, events, roleReads }) => {
    assert.equal(outcome.captureRoleCoverage.status, 'complete')
    assert.equal(outcome.frameCoverageLimited, false)
    assert.equal(outcome.instrumentationLimited, false)
    for (const owner of outcome.captureRoleCoverage.owners) {
      assert.equal(owner.samples, 2)
      assert.equal(owner.completeSamples, 2)
      assert.deepEqual(owner.processSamples, { renderer: 2, gpu: 2, other: 2, unavailable: 0 })
      assert.deepEqual(owner.cpuSamples, { renderer: 2, gpu: 2 })
      assert.deepEqual(owner.cpuDeltaSamples, { renderer: 1, gpu: 1 })
      assert.equal(owner.truncated, 0)
    }
    const cpu = events.filter(row => row.event === 'capture-process-progress')
    assert.equal(cpu.length, 8)
    assert.equal(cpu.filter(row => row.deltaCpuTicks === '7').length, 4)
    assert.ok(!roleReads.includes(93000))
    assert.ok(events.filter(row => row.event === 'capture-process-scan').every(row => row.roleCoverage.every(owner => owner.complete)))
  })
})

test('a missing or unreadable role is disclosed per owner without changing workload verdict', async t => {
  await observeTwoCpuSamples(t, { role: pid => pid === 91001 ? 'unavailable' : completeRole(pid) }, ({ outcome }) => {
    assert.equal(outcome.captureRoleCoverage.status, 'incomplete')
    assert.equal(outcome.instrumentationLimited, true)
    const [host, guest] = outcome.captureRoleCoverage.owners
    assert.deepEqual(host.processSamples, { renderer: 0, gpu: 0, other: 2, unavailable: 2 })
    assert.deepEqual(guest.processSamples, { renderer: 0, gpu: 2, other: 2, unavailable: 0 })
    assert.equal(host.completeSamples, 0)
    assert.equal(guest.completeSamples, 0)
  })
})

test('CPU emission keeps the exact process bound and reports per-owner truncation', async t => {
  const extraRows = [
    ...completeRoleRows,
    ...Array.from({ length: 130 }, (_, index) => ({
      pid: 91100 + index, ppid: 91000, pgid: 91000, sid: 91000, startTicks: String(300 + index), state: 'R', cpuTicks: '10',
    })),
  ]
  await observeTwoCpuSamples(t, { extraRows, role: pid => pid >= 91100 && pid < 91230 ? 'renderer' : completeRole(pid) }, ({ outcome, events, roleReads }) => {
    assert.deepEqual(CAPTURE_LIMITS, { intervalMs: 1000, ticks: 65, processesPerTick: 128 })
    assert.equal(events.filter(row => row.event === 'capture-process-progress').length, 2 * 128)
    assert.equal(outcome.captureRoleCoverage.status, 'incomplete')
    assert.equal(outcome.instrumentationLimited, true)
    assert.equal(outcome.captureRoleCoverage.owners.reduce((total, owner) => total + owner.truncated, 0), 12)
    assert.equal(outcome.captureRoleCoverage.owners[1].cpuSamples.renderer, 0)
    assert.equal(outcome.captureRoleCoverage.owners[1].processSamples.renderer, 2)
    assert.ok(!roleReads.includes(93000))
  })
})

test('unavailable CPU counters are coverage gaps rather than zero activity', async t => {
  const extraRows = completeRoleRows.map(row => ({ ...row, cpuTicks: undefined }))
  await observeTwoCpuSamples(t, { extraRows, role: completeRole }, ({ outcome }) => {
    assert.equal(outcome.captureRoleCoverage.status, 'incomplete')
    assert.equal(outcome.instrumentationLimited, true)
    for (const owner of outcome.captureRoleCoverage.owners) {
      assert.equal(owner.invalidCpu, 2)
      assert.equal(owner.completeSamples, 0)
    }
  })
})


test('a failed capture process scan preserves ownership and marks role coverage incomplete', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let scanFails = false
  await peerObserverFixture(async ({ root, secret, observer, peers }) => {
    for (const peer of peers) peer.page = { evaluate: async () => ({ frameCount: 1 }) }
    observer.captureStart(peers)
    await settleProbes()
    scanFails = true
    t.mock.timers.tick(CAPTURE_LIMITS.intervalMs)
    await settleProbes()
    const during = (await readFile(join(root, 'launch-events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(during.filter(row => row.event === 'process-exit-observed').length, 0)
    assert.equal(during.filter(row => row.event === 'process-scan-failed').length, 1)
    assert.ok(during.filter(row => row.event === 'capture-process-scan').at(-1).roleCoverage.every(owner => owner.scanFailed && !owner.complete))
    scanFails = false
    observer.captureStop()
    assert.equal(await observer.cleanup('/synthetic/profiles', async () => {}), false)
    const outcome = JSON.parse(await readFile(join(root, 'launch-outcome.json'), 'utf8'))
    assert.equal(outcome.captureRoleCoverage.status, 'incomplete')
    assert.equal(outcome.instrumentationLimited, true)
    assert.equal(outcome.processOwnershipProven, false)
    for (const owner of outcome.captureRoleCoverage.owners) {
      assert.equal(owner.samples, 2)
      assert.equal(owner.completeSamples, 1)
    }
    assert.ok(!JSON.stringify([outcome, during]).includes(secret))
  }, { extraRows: completeRoleRows, role: completeRole, scan: rows => { if (scanFails) throw new Error('private-sentinel'); return rows } })
})

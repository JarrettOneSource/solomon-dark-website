import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REVISION = '39875413fa2d3313d5d42170993c7dfa3e885cd1'
export const HARNESS_SHA256 = '036d980d4147f03a9043f7800866bc5b9a283a86de5a8e12f51d1f5bbbf3d3e3'
export const PLAYWRIGHT_SHA256 = '6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27'
const hash = value => createHash('sha256').update(value).digest('hex')
const HOOK = 'globalThis.__SDR_LINUX_LAUNCH_DIAGNOSTIC__'

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, 'Pinned diagnostic anchor changed')
  return source.replace(before, after)
}

export function instrumentPlaywright(original) {
  assert.equal(hash(original), PLAYWRIGHT_SHA256, 'Unrecognized Playwright bundle')
  let source = original
  const replace = (before, after) => { source = replaceOnce(source, before, after) }
  const stage = name => HOOK + '.stage(' + JSON.stringify(name) + ');'
  replace('  const spawnedProcess = childProcess.spawn(options.command, options.args || [], spawnOptions);',
    '  const spawnedProcess = childProcess.spawn(options.command, options.args || [], spawnOptions);\n  ' + HOOK + '.spawned(spawnedProcess, options.command);')
  replace('const nodeTransport = await WebSocketTransport.connect(progress2, nodeMatch[1]);',
    'const nodeTransport = await WebSocketTransport.connect(progress2, nodeMatch[1]);\n          ' + stage('node-socket-connected'))
  replace('new CRConnection(this, nodeTransport, helper.debugProtocolLogger(), browserLogsCollector)',
    'new CRConnection(this, nodeTransport, ' + HOOK + '.logger("node"), browserLogsCollector)')
  replace('const chromeTransport = await WebSocketTransport.connect(progress2, chromeMatch[1]);',
    'const chromeTransport = await WebSocketTransport.connect(progress2, chromeMatch[1]);\n          ' + stage('chrome-socket-connected'))
  // Only Electron's browserOptions block is changed. Other launchers are never used.
  const optionsStart = source.indexOf('          const browserOptions = {\n            name: "electron",')
  const optionsEnd = source.indexOf('\n          validateBrowserContextOptions', optionsStart)
  assert.ok(optionsStart > 0 && optionsEnd > optionsStart)
  const options = source.slice(optionsStart, optionsEnd)
  source = source.slice(0, optionsStart) + replaceOnce(options,
    'protocolLogger: helper.debugProtocolLogger(),', 'protocolLogger: ' + HOOK + '.logger("chrome"),') + source.slice(optionsEnd)
  replace('          const browser = await progress2.race(CRBrowser.connect(this.attribution.playwright, chromeTransport, browserOptions));',
    '          ' + stage('browser-connect-start') + '\n          const browser = await progress2.race(CRBrowser.connect(this.attribution.playwright, chromeTransport, browserOptions));\n          ' + stage('browser-connect-ready'))
  replace('          await progress2.race(app.initialize());',
    '          ' + stage('electron-initialize-start') + '\n          await progress2.race(app.initialize());\n          ' + stage('electron-initialize-ready'))
  replace('        await this._nodeSession.send("Runtime.enable", {});',
    '        await this._nodeSession.send("Runtime.enable", {});\n        ' + stage('node-runtime-enabled'))
  replace('        const version3 = await session2.send("Browser.getVersion");',
    '        const version3 = await session2.send("Browser.getVersion");\n        ' + stage('browser-version-received'))
  replace('        browser._defaultContext = new CRBrowserContext(browser, void 0, options.persistent);',
    '        ' + stage('browser-context-start') + '\n        browser._defaultContext = new CRBrowserContext(browser, void 0, options.persistent);')
  replace('        await browser._waitForAllPagesToBeInitialized();',
    '        ' + stage('browser-context-ready') + '\n        ' + stage('browser-pages-start') +
    '\n        await browser._waitForAllPagesToBeInitialized();\n        ' + stage('browser-pages-ready'))
  replace('        const promises = [\n          this._client.send("Page.enable"),',
    '        ' + stage('page-initialize-start') + '\n        const promises = [\n          this._client.send("Page.enable"),')
  replace('        promises.push(this._firstNonInitialNavigationCommittedPromise);\n        await Promise.all(promises);',
    '        ' + stage('first-noninitial-navigation-wait') +
    '\n        promises.push(this._firstNonInitialNavigationCommittedPromise);\n        await Promise.all(promises);\n        ' + stage('page-initialize-ready'))
  const frameStart = source.indexOf('    FrameSession = class _FrameSession {')
  const frameEnd = source.indexOf('\n      _isMainFrame()', frameStart)
  assert.ok(frameStart > 0 && frameEnd > frameStart)
  const constructor = source.slice(frameStart, frameEnd)
  source = source.slice(0, frameStart) + replaceOnce(constructor,
    '          this._firstNonInitialNavigationCommittedFulfill = f;\n          this._firstNonInitialNavigationCommittedReject = r;',
    '          let sdrNavigationSettled = false;\n' +
    '          this._firstNonInitialNavigationCommittedFulfill = value => { if (!sdrNavigationSettled) { sdrNavigationSettled = true; ' + stage('first-noninitial-navigation-ready') + ' } f(value); };\n' +
    '          this._firstNonInitialNavigationCommittedReject = error => { if (!sdrNavigationSettled) { sdrNavigationSettled = true; ' + stage('first-noninitial-navigation-failed') + ' } r(error); };') + source.slice(frameEnd)
  return source
}

export function instrumentHarness(original, observerURL, playwrightURL, captureDirectory) {
  assert.equal(hash(original), HARNESS_SHA256, 'Unrecognized acceptance harness')
  assert.ok(typeof captureDirectory === 'string' && isAbsolute(captureDirectory), 'A separate transient capture directory is required')
  const catchStart = original.indexOf('} catch (error) {')
  const launchStart = original.indexOf('\nasync function launch')
  assert.ok(catchStart > 0 && launchStart > catchStart)
  let source = original.slice(0, catchStart) + [
    '} catch (error) {',
    '  diagnostics.failure(error)',
    '  process.exitCode = 1',
    '} finally {',
    '  if (!await diagnostics.cleanup(profiles, rm)) process.exitCode = 1',
    '  await rm(evidence, { recursive: true, force: true })',
    '}',
  ].join('\n') + '\n' + original.slice(launchStart)
  source = 'import { createLinuxLaunchObserver } from ' + JSON.stringify(observerURL) + '\n' + source
  const replace = (before, after) => { source = replaceOnce(source, before, after) }
  replace("from 'playwright-core'", 'from ' + JSON.stringify(playwrightURL))
  // Keep the original screenshot calls and bytes; their transient directory is never uploaded.
  replace("const evidence = resolve(process.env.SDR_DESKTOP_EVIDENCE || 'reports/desktop-smoke')",
    'const evidence = ' + JSON.stringify(captureDirectory))
  replace('const receipts = { platform: process.platform, revision: manifest.revision }', [
    'const receipts = { platform: process.platform, revision: manifest.revision }',
    'const diagnostics = createLinuxLaunchObserver({ outputDirectory: resolve(process.env.SDR_DESKTOP_EVIDENCE), executable })',
    HOOK + ' = diagnostics',
  ].join('\n'))
  replace('  await waitForExit(child.pid)', '  await waitForExit(child.pid)\n  diagnostics.stage("solo-host-exited", "solo")')
  replace('async function launch(label, userData) {', 'async function launch(label, userData) {\n  diagnostics.begin(label)')
  const tick = String.fromCharCode(96)
  const field = name => '$' + '{' + name + '}'
  const stderr = "  app.process().stderr.on('data', chunk => process.stderr.write(" + tick + field('label') + ' main: ' + field('chunk') + tick + '))'
  replace(stderr, [
    '  diagnostics.returned(label, app)',
    '  if (label === "resume") diagnostics.stage("second-launch-resolved", label)',
    '  app.process().stderr.on("data", () => diagnostics.noise("main-stderr"))',
  ].join('\n'))
  replace("  page.on('requestfailed', request => process.stderr.write(" + tick + field('label') + ' request: ' + field('request.url()') + ' ' + field('request.failure()?.errorText') + '\\n' + tick + '))',
    '  page.on("requestfailed", () => diagnostics.noise("request-failed"))')
  replace("  page.on('pageerror', error => errors.push(" + tick + field('label') + ': ' + field('error.message') + tick + '))',
    '  page.on("pageerror", () => { errors.push(label + ": page-error"); diagnostics.noise("page-error") })')
  replace('      process.stderr.write(' + tick + field('label') + ': ' + field('message.text()') + '\\n' + tick + ')',
    '      diagnostics.noise("console-error")')
  replace(original.split('\n').find(line => line.startsWith("  await writeFile(join(evidence, 'receipt.json'),")),
    '  diagnostics.stage("workload-complete")')
  replace(original.split('\n').find(line => line.startsWith('  process.stdout.write(')), '')
  const ready = "    await player.page.locator('.gameplay-resume-progress-overlay').waitFor({ state: 'detached', timeout: 30_000 })"
  replace(ready, ready + '\n    diagnostics.stage("peer-boneyard-ready", player.label)')
  for (const owner of ['host', 'guest']) {
    const capture = "  await " + owner + ".page.screenshot({ path: join(evidence, 'peer-" + owner + "-boneyard.png') })"
    replace(capture, (owner === 'host' ? '  diagnostics.captureStart([host, guest])\n' : '') +
      '  diagnostics.stage("peer-capture-start", "' + owner + '")\n' + capture +
      '\n  diagnostics.stage("peer-capture-complete", "' + owner + '")' +
      (owner === 'guest' ? '\n  diagnostics.captureStop()' : ''))
  }
  const assertions = original.match(/^\s*assert\..+$/gm) ?? []
  assert.equal(assertions.length, 19)
  for (const assertion of assertions) assert.ok(source.includes(assertion), 'Original assertion lost')
  const originalLaunchOptions = original.slice(original.indexOf('  const app = await electron.launch({'), original.indexOf(stderr))
  assert.ok(source.includes(originalLaunchOptions), 'Original launch options/deadline changed')
  return source
}

export async function resolvePlaywrightPackage(sourceRoot) {
  const requireProduct = createRequire(join(sourceRoot, 'frontend/package.json'))
  const packagePath = requireProduct.resolve('playwright-core/package.json')
  const metadata = JSON.parse(await readFile(packagePath, 'utf8'))
  assert.equal(metadata.version, '1.61.1')
  const packageRoot = await realpath(dirname(packagePath))
  const original = await readFile(join(packageRoot, 'lib/coreBundle.js'), 'utf8')
  assert.equal(hash(original), PLAYWRIGHT_SHA256)
  return { packageRoot, original }
}

async function canonicalDirectory(path) {
  path = resolve(path)
  try { return await realpath(path) }
  catch (error) {
    if (error.code !== 'ENOENT' || dirname(path) === path) throw error
    return join(await canonicalDirectory(dirname(path)), basename(path))
  }
}

function directoriesOverlap(first, second) {
  return [relative(first, second), relative(second, first)].some(path =>
    !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep))
}

export async function prepareDiagnostic({ sourceRoot, outputDirectory, runtimeDirectory, appRoot }) {
  sourceRoot = await realpath(sourceRoot)
  outputDirectory = await canonicalDirectory(outputDirectory)
  runtimeDirectory = await canonicalDirectory(runtimeDirectory)
  assert.ok(!directoriesOverlap(runtimeDirectory, outputDirectory),
    'Runtime source and captures must be separate from uploaded metadata evidence')
  for (const path of [outputDirectory, runtimeDirectory])
    assert.ok(!directoriesOverlap(path, sourceRoot), 'Diagnostic output must be outside product')
  if (appRoot !== undefined) {
    appRoot = await realpath(appRoot)
    for (const path of [outputDirectory, runtimeDirectory])
      assert.ok(!directoriesOverlap(path, appRoot), 'Diagnostic output must be outside packaged app')
  }
  await mkdir(outputDirectory, { recursive: true })
  await mkdir(runtimeDirectory, { recursive: true })
  const original = await readFile(join(sourceRoot, 'frontend/tools/smoke-desktop-runtime.mjs'), 'utf8')
  const { packageRoot, original: bundle } = await resolvePlaywrightPackage(sourceRoot)
  const generatedRoot = await mkdtemp(join(runtimeDirectory, 'linux-launch-'))
  const packageCopy = join(generatedRoot, 'playwright-core')
  // Copy the complete installed package, including lib/server/electron/loader.js and assets.
  await cp(packageRoot, packageCopy, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true })
  const patchedBundle = instrumentPlaywright(bundle)
  await writeFile(join(packageCopy, 'lib/coreBundle.js'), patchedBundle)
  const observerPath = join(dirname(fileURLToPath(import.meta.url)), 'linux-launch-observer.mjs')
  const playwrightURL = pathToFileURL(join(packageCopy, 'index.mjs')).href
  const generated = instrumentHarness(original, pathToFileURL(observerPath).href, playwrightURL, join(generatedRoot, 'captures'))
  const harnessPath = join(generatedRoot, 'capture-workload.mjs')
  await writeFile(harnessPath, generated)
  assert.equal(hash(await readFile(join(packageRoot, 'lib/coreBundle.js'))), PLAYWRIGHT_SHA256)
  const binding = {
    acceptance: false, diagnostic: true, productRevision: REVISION, playwrightVersion: '1.61.1',
    originalHarnessSha256: hash(original), generatedHarnessSha256: hash(generated),
    originalPlaywrightSha256: hash(bundle), generatedPlaywrightSha256: hash(patchedBundle),
    driverSha256: hash(await readFile(fileURLToPath(import.meta.url))), observerSha256: hash(await readFile(observerPath)),
    scope: 'Full original 19-assertion smoke workload and both peer captures on retained package 11997259442 from failed exact-source qualification run 38787359411. These are newly built 39875413 bytes, not the unretained original run 38766573551 package. Any outcome is diagnostic only, not release acceptance.',
    changes: 'Metadata-only hooks in a separate dependency copy, bounded non-awaited peer frame/visibility and owned process CPU observation with explicit per-owner role coverage. Original screenshot calls write only to a transient runtime directory removed during cleanup. No raw error/receipt/body output or fallback captures. Original package, flags, workload and cleanup deadlines unchanged.',
  }
  await writeFile(join(outputDirectory, 'source-binding.json'), JSON.stringify(binding, null, 2) + '\n')
  return { harnessPath, packageCopy, playwrightURL, binding, generatedRoot }
}

export function assertSafeEnvironment(env) {
  for (const key of [
    'DEBUG', 'DEBUG_FILE', 'PWDEBUG', 'PWDEBUGIMPL', 'PW_INSTRUMENT_MODULES', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE',
    'NODE_OPTIONS', 'ELECTRON_ENABLE_LOGGING', 'ELECTRON_LOG_FILE',
  ]) {
    for (const variant of [key, 'npm_config_' + key.toLowerCase(), 'npm_package_config_' + key.toLowerCase()])
      assert.ok(!env[variant], 'Raw diagnostic logging environment is not allowed')
  }
}

async function main() {
  const flags = process.argv.slice(2)
  if (!flags.length) { console.log('Inert Linux launch diagnostic. Use --prepare-only or --run with explicit paths.'); return }
  assert.equal(flags.length, 1)
  assert.ok(flags[0] === '--prepare-only' || flags[0] === '--run')
  assertSafeEnvironment(process.env)
  for (const key of ['SDR_SOURCE_ROOT', 'SDR_DESKTOP_EVIDENCE', 'SDR_DIAGNOSTIC_RUNTIME']) assert.ok(process.env[key])
  const sourceRoot = resolve(process.env.SDR_SOURCE_ROOT)
  const outputDirectory = resolve(process.env.SDR_DESKTOP_EVIDENCE)
  const runtimeDirectory = resolve(process.env.SDR_DIAGNOSTIC_RUNTIME)
  let appRoot
  if (flags[0] === '--run') {
    assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64')
    assert.ok(process.env.SDR_DESKTOP_APP)
    appRoot = await realpath(resolve(process.env.SDR_DESKTOP_APP))
    const manifest = JSON.parse(await readFile(join(appRoot, 'desktop-package-manifest.json'), 'utf8'))
    assert.equal(manifest.revision, REVISION); assert.equal(manifest.platform, 'linux'); assert.equal(manifest.arch, 'x64')
    assert.equal(manifest.electronVersion, '43.4.0'); assert.equal(manifest.nodeRuntime.version, '22.17.0')
    assert.equal(manifest.executable, 'solomon-darker')
  }
  const prepared = await prepareDiagnostic({ sourceRoot, outputDirectory, runtimeDirectory, appRoot })
  if (flags[0] === '--prepare-only') { console.log('Prepared Linux diagnostic without launching.'); return }
  process.chdir(join(sourceRoot, 'frontend'))
  await import(pathToFileURL(prepared.harnessPath).href)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Never print exception stacks: Playwright failures can embed raw browser/protocol logs.
  main().catch(() => { process.stderr.write('Linux launch diagnostic failed; inspect allowlisted evidence.\n'); process.exitCode = 1 })
}

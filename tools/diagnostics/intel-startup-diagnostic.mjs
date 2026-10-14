import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { redactDiagnosticText } from './desktop-timeout-observer.mjs'

export const REVISION = 'c20fd89cb98c3a76f0852305252f1a3ba06fd59a'
export const HARNESS_SHA256 = '036d980d4147f03a9043f7800866bc5b9a283a86de5a8e12f51d1f5bbbf3d3e3'
const sha256 = value => createHash('sha256').update(value).digest('hex')
export async function resolvePlaywrightImport(sourceRoot) {
  const requireProduct = createRequire(join(sourceRoot, 'frontend/package.json'))
  const packagePath = requireProduct.resolve('playwright-core/package.json')
  const metadata = JSON.parse(await readFile(packagePath, 'utf8'))
  assert.equal(metadata.version, '1.61.1', 'Diagnostic requires the exact pinned Playwright version')
  return pathToFileURL(resolve(dirname(packagePath), metadata.exports['.'].import)).href
}

export function instrumentHarness(original, observerURL, playwrightURL) {
  assert.equal(sha256(original), HARNESS_SHA256, 'Refusing an unrecognized acceptance harness')
  let source = original
  const replaceOnce = (before, after) => {
    assert.equal(source.split(before).length - 1, 1, 'Diagnostic transform anchor must match exactly once: ' + before.slice(0, 100))
    source = source.replace(before, after)
  }
  replaceOnce("from 'playwright-core'", 'from ' + JSON.stringify(playwrightURL))
  source = 'import { createDesktopObserver, safeURL } from ' + JSON.stringify(observerURL) + '\n' + source
  replaceOnce('const receipts = { platform: process.platform, revision: manifest.revision }',
    'const receipts = { platform: process.platform, revision: manifest.revision }\n' +
    'const diagnostics = await createDesktopObserver(join(evidence, "diagnostic"))\nlet primaryError = null\n' +
    'assert.equal(manifest.revision, "' + REVISION + '")\nassert.equal(manifest.platform, "darwin")\nassert.equal(manifest.arch, "x64")')
  replaceOnce('  running.add(instance)', '  running.add(instance)\n  await diagnostics.attach(instance)')
  replaceOnce('async function launch(label, userData) {', 'async function launch(label, userData) {\n  diagnostics.launching(label)')
  replaceOnce("  app.process().stderr.on('data'", "  await diagnostics.launched(label, app.process().pid)\n  app.process().stderr.on('data'")
  replaceOnce('async function title(page) {', 'async function title(page) {\n  diagnostics.phase(page, "title", 90_000)')
  replaceOnce('  await play.waitFor({ timeout: 30_000 })\n}', '  await play.waitFor({ timeout: 30_000 })\n  diagnostics.endPhase(page, "title")\n}')
  replaceOnce('async function readyHub(page) {', 'async function readyHub(page) {\n  diagnostics.phase(page, "readyHub", 60_000)')
  replaceOnce("    return canvas?.dataset.hubRegion === 'courtyard' && canvas?.dataset.transitionPhase === 'none'\n  })\n}",
    "    return canvas?.dataset.hubRegion === 'courtyard' && canvas?.dataset.transitionPhase === 'none'\n  })\n  diagnostics.endPhase(page, 'readyHub')\n}")
  replaceOnce("  assert.equal(runtime.origin, 'solomon-darker://app')",
    "  diagnostics.addSecret(runtime.endpoint.credential)\n  assert.equal(runtime.origin, 'solomon-darker://app')")
  replaceOnce("  const guest = await launch('guest', join(profiles, 'guest'))",
    "  diagnostics.addSecret(invitation)\n  const guest = await launch('guest', join(profiles, 'guest'))")
  replaceOnce("join(evidence, 'receipt.json')", "join(evidence, 'diagnostic-observation.json')")
  replaceOnce("JSON.stringify({ status: 'ok', ...receipts }, null, 2)", "JSON.stringify({ status: 'ok', acceptance: false, diagnostic: true, ...receipts }, null, 2)")
  replaceOnce("JSON.stringify({ status: 'ok', ...receipts, evidence })", "JSON.stringify({ status: 'ok', acceptance: false, diagnostic: true, ...receipts, evidence })")
  const start = source.indexOf('} catch (error) {\n  process.stderr.write(')
  const end = source.indexOf('\nasync function launch', start)
  assert.ok(start > 0 && end > start)
  const catchAndCleanup = [
    '} catch (error) {',
    '  primaryError = error',
    '  try {',
    '  process.stderr.write(diagnostics.clean(String(error.stack)) + "\\n")',
    '  try { await diagnostics.beforeFailure(error) } catch (probeError) { diagnostics.record("failure-probe-error", { message: String(probeError) }) }',
    '  for (const instance of running) {',
    '    if (instance.label !== "guest" || new URL(instance.page.url()).pathname === "/game") {',
    '      await instance.page.screenshot({ path: join(evidence, instance.label + "-failure.png") }).catch(captureError => diagnostics.record("screenshot-error", { label: instance.label, message: String(captureError) }))',
    '    } else diagnostics.record("screenshot-skipped", { label: instance.label, reason: "Guest launcher can contain the invitation token" })',
    '    const body = await instance.page.locator("body").innerText().catch(() => "")',
    '    process.stderr.write(diagnostics.clean(JSON.stringify({ label: instance.label, url: safeURL(instance.page.url()), body: body.slice(0, 2500), errors })) + "\\n")',
    '  }',
    '  } catch (captureError) { process.stderr.write(diagnostics.clean("Diagnostic capture also failed: " + String(captureError)) + "\\n") }',
    '  throw error',
    '} finally {',
    '  let cleanupErrors = []',
    '  try { cleanupErrors = await diagnostics.cleanup(running, profiles, rm) }',
    '  catch (cleanupError) { cleanupErrors.push({ step: "unexpected-cleanup", message: String(cleanupError) }) }',
    '  try { diagnostics.stop({ primaryError: primaryError ? String(primaryError) : null, cleanupErrors }) }',
    '  catch (stopError) { cleanupErrors.push({ step: "observer-stop", message: String(stopError) }) }',
    '  if (primaryError === null && cleanupErrors.length) throw new AggregateError(cleanupErrors.map(row => new Error(row.step + ": " + row.message)), "Diagnostic cleanup failed")',
    '}',
    '',
  ].join('\n')
  source = source.slice(0, start) + catchAndCleanup + source.slice(end)
  source = source.replace(/^( +)await ((?:solo|resumed|host|guest|instance)\.page)\.screenshot/gm,
    (line, spaces, page) => spaces + 'await diagnostics.beforeScreenshot(' + JSON.stringify(page) + ')\n' + line)
  const tick = String.fromCharCode(96)
  const field = text => '$' + '{' + text + '}'
  const mainText = tick + field('label') + ' main: ' + field('chunk') + tick
  replaceOnce('process.stderr.write(' + mainText + ')', 'process.stderr.write(diagnostics.clean(' + mainText + '))')
  replaceOnce(field('request.url()') + ' ' + field('request.failure()?.errorText'), field('safeURL(request.url())') + ' ' + field('request.failure()?.errorText'))
  const errorText = tick + field('label') + ': ' + field('error.message') + tick
  replaceOnce('errors.push(' + errorText + ')', 'errors.push(diagnostics.clean(' + errorText + '))')
  const consoleText = tick + field('label') + ': ' + field('message.text()') + '\\n' + tick
  replaceOnce('process.stderr.write(' + consoleText + ')', 'process.stderr.write(diagnostics.clean(' + consoleText + '))')
  const originalAssertions = original.match(/^\s*assert\..+$/gm).map(line => line.trim())
  const generatedAssertions = source.match(/^\s*assert\..+$/gm).map(line => line.trim())
  for (const line of originalAssertions) assert.ok(generatedAssertions.includes(line), 'Original assertion lost: ' + line)
  assert.deepEqual(source.match(/timeout: [\d_]+/g), original.match(/timeout: [\d_]+/g), 'Original Playwright timeout options changed')
  for (const flag of ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--use-gl=angle', '--proxy-server=http://127.0.0.1:9']) assert.ok(source.includes(flag))
  return source
}

async function main() {
  const flags = new Set(process.argv.slice(2))
  if (!flags.has('--run') && !flags.has('--prepare-only')) {
    console.log('Inert by default. Set SDR_SOURCE_ROOT and SDR_DESKTOP_EVIDENCE, then use --prepare-only to verify/generate without launch, or --run on hosted darwin-x64 with SDR_DESKTOP_APP.')
    return
  }
  const sourceRoot = resolve(process.env.SDR_SOURCE_ROOT ?? '')
  assert.ok(process.env.SDR_SOURCE_ROOT, 'SDR_SOURCE_ROOT is required')
  assert.ok(process.env.SDR_DESKTOP_EVIDENCE, 'A separate SDR_DESKTOP_EVIDENCE directory is required')
  const output = resolve(process.env.SDR_DESKTOP_EVIDENCE)
  assert.ok(!output.startsWith(sourceRoot + '/'), 'Keep diagnostics outside the product checkout')
  const observerPath = join(dirname(fileURLToPath(import.meta.url)), 'desktop-timeout-observer.mjs')
  const original = await readFile(join(sourceRoot, 'frontend/tools/smoke-desktop-runtime.mjs'), 'utf8')
  const generated = instrumentHarness(original, pathToFileURL(observerPath).href, await resolvePlaywrightImport(sourceRoot))
  await mkdir(output, { recursive: true })
  const generatedPath = join(output, 'instrumented-smoke.mjs')
  await writeFile(generatedPath, generated)
  await writeFile(join(output, 'diagnostic-source-binding.json'), JSON.stringify({
    acceptance: false, productRevision: REVISION, originalHarnessSha256: sha256(original), generatedHarnessSha256: sha256(generated),
    driverSha256: sha256(await readFile(fileURLToPath(import.meta.url))), observerSha256: sha256(await readFile(observerPath)),
    originalAssertionCount: (original.match(/^\s*assert\..+$/gm) ?? []).length,
    note: 'Package bytes and original assertions/timeouts unchanged. Observers, failure capture ordering, output labels and dependency-ordered cleanup are diagnostic-only differences.',
  }, null, 2) + '\n')
  if (!flags.has('--run')) { console.log('Prepared without launching: ' + generatedPath); return }
  assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'x64')
  assert.ok(process.env.SDR_DESKTOP_APP, 'SDR_DESKTOP_APP is required')
  const app = resolve(process.env.SDR_DESKTOP_APP)
  assert.ok(!output.startsWith(app + '/'), 'Never place diagnostic files in the application package')
  const manifest = JSON.parse(await readFile(join(app, 'desktop-package-manifest.json'), 'utf8'))
  assert.equal(manifest.revision, REVISION); assert.equal(manifest.platform, 'darwin'); assert.equal(manifest.arch, 'x64')
  process.chdir(join(sourceRoot, 'frontend'))
  await import(pathToFileURL(generatedPath).href)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(redactDiagnosticText(error.stack)); process.exitCode = 1 })
}

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import { LuaFactory } from 'wasmoon'
import { createAdapter } from './adapters.mjs'
import { reviewPixiRetirements } from './media-retirement.mjs'

const { values } = parseArgs({ options: {
  client: { type: 'string' }, url: { type: 'string' }, account: { type: 'string' },
  scenario: { type: 'string' }, out: { type: 'string' },
  'rust-tools': { type: 'string' }, 'resolve-host': { type: 'string' },
  chrome: { type: 'string' },
} })
for (const key of ['client', 'url', 'scenario', 'out', 'rust-tools']) {
  assert.ok(values[key], `--${key} is required`)
}
assert.ok(['pixi', 'rust'].includes(values.client), '--client must be pixi or rust')
const require = createRequire(import.meta.url)
const helpers = resolve(values['rust-tools'])
const ui = require(resolve(helpers, 'gpu-ui.cjs'))
const { launchOwnedBrowser } = require(resolve(helpers, 'browser-lifecycle.cjs'))
const output = resolve(values.out)
await mkdir(output, { recursive: false })
process.env.OUT = output
const source = await readFile(resolve(values.scenario), 'utf8')
const receipt = {
  startedAt: new Date().toISOString(),
  client: values.client, url: values.url, scenario: resolve(values.scenario),
  scenarioSha256: createHash('sha256').update(source).digest('hex'),
  control: 'Lua scenario; ordinary browser mouse and keyboard; read-only protocol observation',
  passed: false, actions: [], checkpoints: [], errors: [],
}
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--ignore-gpu-blocklist'] : []
if (values['resolve-host']) args.push(`--host-resolver-rules=MAP ${values['resolve-host']} 127.0.0.1`)
let owner, page, watched, lua, adapter
async function record(name, parameters, operation) {
  const row = { index: receipt.actions.length, name, parameters, startedAt: Date.now() }
  receipt.actions.push(row)
  console.log(`${values.client}: ${row.index} ${name} ${JSON.stringify(parameters)}`)
  try {
    assert.deepEqual(receipt.errors, [])
    const result = await operation()
    row.completedAt = Date.now()
    if (name === 'observe') {
      const { ui: _ui, ...state } = result
      row.state = state
    } else if (typeof result === 'boolean') row.result = result
    return result
  } catch (error) {
    row.failure = error.message
    throw error
  } finally {
    await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  }
}
try {
  owner = await launchOwnedBrowser(chromium, {
    headless: true,
    executablePath: values.chrome || process.env.SDR_CHROME_PATH
      || (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'),
    args,
  })
  const context = await owner.browser.newContext({
    ignoreHTTPSErrors: Boolean(values['resolve-host']), viewport: { width: 1600, height: 900 },
  })
  if (values.account) {
    const { token } = JSON.parse(await readFile(resolve(values.account), 'utf8'))
    assert.equal(typeof token, 'string', 'the account file must contain a QA bearer token')
    await context.addInitScript(token => {
      localStorage.setItem('sdr.token', token)
      localStorage.setItem('sdr.token:/game-rust', token)
    }, token)
  }
  page = await context.newPage()
  page.setDefaultTimeout(30_000)
  watched = ui.watchErrors(page)
  await watched.ready
  adapter = await createAdapter({ page, client: values.client, helpers, ui, errors: receipt.errors, output })
  await page.goto(values.url, { waitUntil: 'domcontentloaded' })
  lua = await new LuaFactory().createEngine()
  lua.global.set('qa', {
    start: element => record('start', { element }, () => adapter.start(element)),
    click: name => record('click', { name }, () => adapter.click(name)),
    fill: (name, value) => record('fill', { name, value }, () => adapter.fill(name, value)),
    key: key => record('key', { key }, () => page.keyboard.press(key)),
    hold: (key, milliseconds) => record('hold', { key, milliseconds }, async () => {
      assert.ok(milliseconds >= 0 && milliseconds <= 10_000, 'key hold must be within ten seconds')
      await page.keyboard.down(key)
      try { await page.waitForTimeout(milliseconds) } finally { await page.keyboard.up(key) }
    }),
    observe: () => record('observe', {}, () => adapter.observe()),
    enter_boneyard: () => record('enter-boneyard', {}, () => adapter.enterBoneyard()),
    approach_solomon: () => record('approach-solomon', {}, () => adapter.approachSolomon()),
    walk_toward: (x, y, milliseconds) => record('walk-toward', { x, y, milliseconds }, () => {
      assert.ok(milliseconds > 0 && milliseconds <= 1000)
      return adapter.walkToward(x, y, milliseconds)
    }),
    cast_at: (x, y, milliseconds) => record('cast-at', { x, y, milliseconds }, () => {
      assert.ok(milliseconds > 0 && milliseconds <= 1000)
      return adapter.castAt(x, y, milliseconds)
    }),
    sleep: milliseconds => record('sleep', { milliseconds }, () => {
      assert.ok(milliseconds >= 0 && milliseconds <= 10_000)
      return page.waitForTimeout(milliseconds)
    }),
    reload_and_continue: () => record('reload-and-continue', {}, () => adapter.reloadAndContinue()),
    wait: (field, expected) => record('wait', { field, expected }, async () => {
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        assert.deepEqual(receipt.errors, [])
        assert.deepEqual(watched.errors, [])
        const state = await adapter.observe()
        if (state[field] === expected) return state
        await page.waitForTimeout(25)
      }
      throw new Error(`Expected ${field}=${expected}; actual ${JSON.stringify(await adapter.observe())}`)
    }),
    capture: name => record('capture', { name }, async () => {
      assert.match(name, /^[a-z0-9-]+$/)
      await adapter.captureReady()
      const state = await adapter.observe()
      const file = `${String(receipt.checkpoints.length + 1).padStart(3, '0')}-${name}`
      await page.screenshot({ path: resolve(output, `${file}.png`), timeout: 120_000 })
      receipt.checkpoints.push({ name, image: `${file}.png`, stateFile: `${file}.json`, state })
      await writeFile(resolve(output, `${file}.json`), JSON.stringify(state, null, 2) + '\n')
      return state
    }),
  })
  await lua.doString(source)
  receipt.behaviorPassed = true
  await ui.settleErrors(page)
  if (values.client === 'pixi') {
    const files = (await readdir(output)).filter(name => /^browser-errors-\d+\.json$/.test(name))
    const reports = await Promise.all(files.map(name => readFile(resolve(output, name), 'utf8').then(JSON.parse)))
    const review = reviewPixiRetirements(watched.errors, reports)
    receipt.expectedRetirements = review.expected
    assert.deepEqual(review.unexpected, [])
  } else assert.deepEqual(watched.errors, [])
  assert.deepEqual(receipt.errors, [])
  receipt.passed = true
} catch (error) {
  receipt.failure = error.stack
  if (page && !page.isClosed()) {
    await ui.settleErrors(page).catch(error => receipt.errors.push({ settlement: error.message }))
    await page.screenshot({ path: resolve(output, 'failure.png'), timeout: 120_000 })
      .catch(error => receipt.errors.push({ screenshot: error.message }))
    receipt.finalState = await adapter?.observe().catch(error => ({ error: error.message }))
  }
  process.exitCode = 1
} finally {
  lua?.global.close()
  try { await adapter?.close() } catch (error) {
    receipt.errors.push({ navigationCleanup: error.message })
    process.exitCode = 1
  }
  receipt.rawErrors = watched?.errors || []
  receipt.errors.push(...receipt.rawErrors.filter(error => !receipt.expectedRetirements?.some(expected =>
    expected.requestId === error.requestId && expected.url === error.url && expected.type === error.type)))
  try { if (owner) receipt.cleanup = await owner.close() } catch (error) {
    receipt.cleanup = error.cleanup
    receipt.errors.push({ cleanup: error.message })
    process.exitCode = 1
  }
  if (receipt.errors.length) receipt.passed = false
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify({ passed: receipt.passed, failure: receipt.failure, output }))
}

import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { startStaticClientServer } from '../desktop/static-client-server.mjs'

const root = fileURLToPath(new URL('../../backend/wwwroot', import.meta.url))
const { revision } = JSON.parse(await readFile(`${root}/deployment.json`, 'utf8'))
const target = revision === '1'.repeat(40) ? '2'.repeat(40) : '1'.repeat(40)
const server = await startStaticClientServer({ root })
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const receipts = []
try {
  for (const row of [
    { id: 'game-manual', path: '/game', chunk: 'Game', manifest: revision },
    { id: 'editor-manual', path: '/boneyard', chunk: 'Boneyard', manifest: revision },
    { id: 'viewer-manual', path: '/boneyards', chunk: 'BoneyardViewer', manifest: revision },
    { id: 'updated-release', path: '/boneyard', chunk: 'Boneyard', manifest: target, automatic: true },
    { id: 'stale-html-module-recovers', path: '/game', chunk: 'Game', manifest: target, automatic: true },
    { id: 'stale-html-loop', path: '/game', chunk: 'Game', manifest: target, automatic: true, persistent: true },
    { id: 'offline-manifest', path: '/game', chunk: 'Game', manifest: null },
    { id: 'blocked-storage', path: '/game', chunk: 'Game', manifest: target, blockedStorage: true },
    { id: 'runtime-error', path: '/boneyard', chunk: 'Boneyard', manifest: target, runtimeError: true },
  ]) {
    const context = await browser.newContext()
    const page = await context.newPage()
    const errors = { page: [], console: [], responses: [], requests: [] }
    let failures = 0, documents = 0
    if (row.blockedStorage) await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Blocked', 'SecurityError') } })
    })
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('requestfailed', request => errors.requests.push({
      url: request.url(), type: request.resourceType(), error: request.failure()?.errorText,
    }))
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    page.on('request', request => { if (request.resourceType() === 'document') documents += 1 })
    await page.route('**/deployment.json*', route => route.fulfill({
      status: row.manifest ? 200 : 503,
      json: row.manifest ? { revision: row.manifest } : {},
    }))
    await page.route(new RegExp(`/assets/${row.chunk}-[^/]+\\.js$`), route => {
      if (row.persistent || failures === 0) {
        failures += 1
        if (row.runtimeError) return route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("Deliberate application failure")' })
        return route.abort('failed')
      }
      return route.continue()
    })
    try {
      await page.goto(`${server.origin}${row.path}`, { waitUntil: 'domcontentloaded' })
      if (!row.automatic || row.persistent) {
        await page.getByRole('heading', { name: row.runtimeError ? 'Something went wrong' : 'Page files could not be loaded' }).waitFor({ timeout: 15_000 })
        if (row.automatic) await page.waitForFunction(() => performance.getEntriesByType('navigation')[0].type === 'reload')
        await page.waitForTimeout(800)
        assert.equal(documents, row.automatic ? 2 : 1, 'automatic recovery must not loop')
        assert.equal(await page.getByText('Unexpected Application Error!').count(), 0)
        if (row.persistent) {
          assertExpectedFailures(row, errors)
          receipts.push({ ...row, failures, documents, expectedFailureEvidence: errors })
          continue
        }
        await page.getByRole('button', { name: 'Reload page', exact: true }).click()
      }
      await page.waitForFunction(() => performance.getEntriesByType('navigation')[0].type === 'reload')
      await page.waitForLoadState('networkidle')
      assert.equal(await page.getByRole('heading', { name: 'Page files could not be loaded' }).count(), 0)
      assert.equal(await page.getByText('Unexpected Application Error!').count(), 0)
      assert.equal(new URL(page.url()).pathname, row.path)
      assert.equal(failures, 1)
      assert.equal(documents, 2)
      assertExpectedFailures(row, errors)
      receipts.push({ ...row, failures, documents, expectedFailureEvidence: errors })
    } catch (error) {
      console.error(JSON.stringify({ case: row.id, documents, failures, body: await page.locator('body').innerText(), errors }))
      throw error
    } finally {
      await context.close()
    }
  }
  const receipt = { browser: browser.version(), revision, receipts }
  if (process.env.SDR_MODULE_RECEIPT) await writeFile(process.env.SDR_MODULE_RECEIPT, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await Promise.all([browser.close(), server.close()])
}

function assertExpectedFailures(row, errors) {
  assert.deepEqual(errors.page, [])
  for (const message of errors.console) assert.ok(
    message === 'Failed to load resource: net::ERR_FAILED'
      || message.includes('Failed to fetch dynamically imported module:')
      || row.runtimeError && message.includes('Deliberate application failure')
      || row.manifest === null && message.includes('503 (Service Unavailable)'),
    `Unexpected console error: ${message}`,
  )
  for (const response of errors.responses) assert.ok(
    row.manifest === null && response.startsWith('503 ') && response.includes('/deployment.json'), response,
  )
  for (const request of errors.requests) assert.ok(
    request.url.includes(`/assets/${row.chunk}-`) && request.error === 'net::ERR_FAILED'
      // Navigations and removal of the error UI cancel obsolete font/media loads.
      || request.error === 'net::ERR_ABORTED',
    `Unexpected request failure: ${JSON.stringify(request)}`,
  )
}

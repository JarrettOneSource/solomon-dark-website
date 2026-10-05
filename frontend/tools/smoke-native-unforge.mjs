import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const reference = JSON.parse(execFileSync(fileURLToPath(new URL('../../.venv/bin/python', import.meta.url)),
  [fileURLToPath(new URL('./native-unforge-reference.py', import.meta.url))], { encoding: 'utf8' }))
assert.equal(reference.atlas_sha256, '37d5e8fc543af12a9d8019e738dbe1e29b648211144a3782c3a32e71f76cd2eb')
const vite = await createServer({ configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', root, server: { host: '127.0.0.1', port: 0 } })
await vite.listen()
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`
const errors = { console: [], page: [], responses: [], requests: [] }
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH, headless: true })
  const page = await browser.newPage()
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
  await page.route(`${origin}/__unforge`, route => route.fulfill({ body: '<!doctype html><html><body></body></html>', contentType: 'text/html' }))
  await page.goto(`${origin}/__unforge`, { waitUntil: 'domcontentloaded' })
  const receipt = await page.evaluate(async reference => {
    const { inspectNativeUnforge } = await import('/tools/native-unforge-probe.mjs')
    return inspectNativeUnforge(reference)
  }, reference)
  console.log(JSON.stringify({ atlas: reference.atlas_sha256, errors, ...receipt }))
  assert.deepEqual(errors, { console: [], page: [], responses: [], requests: [] })
  assert.equal(receipt.samples.length, 56)
  for (const sample of receipt.samples) { assert.equal(sample.differentChannels, 0, JSON.stringify(sample)); assert.ok(sample.visiblePixels > 0) }
  for (const sample of receipt.final) assert.equal(sample.differentChannels, 0, JSON.stringify(sample))
  assert.ok(receipt.retainedTarget && receipt.targetDestroyed && receipt.borrowedTexturesAlive)
} finally {
  await browser?.close()
  await vite.close()
}

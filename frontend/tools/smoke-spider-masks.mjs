import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const address = server.httpServer.address()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
})
const errors = []
const failedResponses = []
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }) })
  const base = `http://127.0.0.1:${address.port}`
  await page.route(`${base}/__spider-masks`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0"></body>' }))
  await page.goto(`${base}/__spider-masks`)
  const records = await page.evaluate(async () => {
    const { inspectSpiderCompactMasks } = await import('/tools/spider-mask-browser-probe.mjs')
    return inspectSpiderCompactMasks()
  })
  assert.equal(records.length, 8)
  for (const record of records) {
    assert.equal(record.width, 256)
    assert.equal(record.height, 256)
    assert.ok(record.nonzeroAlpha > 0, `${record.name} lost its shape mask`)
    if (record.name !== 'cell-boundary') {
      assert.ok(record.nonzeroAlpha < 256 * 256)
      assert.deepEqual(record.corners, [0, 0, 0, 0], `${record.name} filled pixels outside its masks`)
    }
    assert.equal(record.joinedTargets, 2)
    assert.equal(record.departedTargets, 1)
    assert.equal(record.departedTargetDestroyed, true)
    assert.equal(record.remainingChildren, 0)
    if (record.image) {
      await writeFile(process.env.SDR_SPIDER_MASK_SCREENSHOT || '/tmp/solomon-spider-masks.png', Buffer.from(record.image.split(',')[1], 'base64'))
      delete record.image
    }
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [])
  console.log(JSON.stringify({ status: 'ok', records, errors, failedResponses }))
} finally {
  await browser.close()
  await server.close()
}

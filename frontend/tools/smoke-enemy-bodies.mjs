import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const output = process.env.SDR_ENEMY_BODY_OUTPUT || join(tmpdir(), 'solomon-enemy-bodies')
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 4398, strictPort: true } })
await server.listen()
const errors = []
let browser
try {
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  await page.route('**/__enemy-bodies', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
  }))
  await page.goto('http://127.0.0.1:4398/__enemy-bodies')
  const receipts = []
  for (const scale of [.5, 1, 2]) {
    for (let offset = 0, total = 1; offset < total; offset += 28) {
      const label = `scale-${scale}-page-${offset / 28}`
      const receipt = await page.evaluate(async options => {
        const fixture = await import('/tools/enemy-body-smoke-fixture.mjs')
        return fixture.renderEnemyBodyMatrix(options)
      }, { scale, offset })
      total = receipt.totalVariants
      receipts.push(receipt)
      await page.locator('#enemy-body-panel').screenshot({ path: join(output, `${label}.png`) })
      for (let y = 0; y < receipt.height; y += 950) {
        await page.screenshot({ path: join(output, `${label}-strip-${String(y / 950).padStart(2, '0')}.png`), fullPage: true,
          clip: { x: 0, y, width: receipt.width, height: Math.min(950, receipt.height - y) } })
      }
      await writeFile(join(output, 'receipt.json'), JSON.stringify({ receipts, errors }, null, 2))
      assert.deepEqual(errors, [])
      assert.equal(receipt.sprites.length, receipt.count)
      assert.equal(receipt.remainingBodies, 0)
      for (const view of receipt.sprites) {
        assert.equal(view.parts.length > 0, view.name !== 'Cocoon (no body)', view.name)
        if (view.name !== 'Cocoon (no body)') assert.ok(view.parts.some(part => part.width > 0 && part.height > 0 && part.alpha > 0), view.name)
        assert.ok(view.parts.every(part => [part.x, part.y, part.width, part.height, part.alpha].every(Number.isFinite)), view.name)
      }
      console.log(JSON.stringify({ output, label, variants: receipt.variants.length, views: receipt.count, errors }))
    }
  }
} finally {
  await browser?.close()
  await server.close()
}

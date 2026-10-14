import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.SDR_SET_FRAME_OUTPUT || join(tmpdir(), 'solomon-inventory-set-frames')
await mkdir(output, { recursive: true })
const vite = await createServer({ root, configFile: join(root, 'vite.config.ts'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
const errors = { page: [], console: [], responses: [], requests: [] }
const receipt = { status: 'running', scope: 'Real retained inventory consumers/assets, stopped WebGL fixture; no ordinary gameplay/full gate claim.', rows: [], errors, sourceSha256: {} }
for (const file of ['src/game/renderer/hub-inventory/pages.ts', 'src/game/renderer/hub-inventory/equipment.ts', 'src/game/renderer/hub-inventory-item-frame.ts', 'src/game/renderer/hub-inventory/item-frame.ts', 'tools/inventory-set-frame-smoke-fixture.mjs', 'tools/smoke-inventory-set-frames.mjs']) {
  receipt.sourceSha256[file] = createHash('sha256').update(await readFile(join(root, file))).digest('hex')
}
let browser
try {
  await vite.listen()
  receipt.origin = `http://127.0.0.1:${vite.httpServer.address().port}`
  browser = await chromium.launch({ headless: true, args: ['--mute-audio'], executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
  receipt.browser = browser.version()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', e => errors.page.push(e.message))
  page.on('console', e => { if (e.type() === 'error') errors.console.push(e.text()) })
  page.on('response', r => { if (r.status() >= 400) errors.responses.push({ status: r.status(), url: r.url() }) })
  page.on('requestfailed', r => errors.requests.push({ url: r.url(), error: r.failure()?.errorText }))
  await page.route(`${receipt.origin}/__set-frame-proof`, r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body></body></html>' }))
  await page.goto(`${receipt.origin}/__set-frame-proof`)
  await page.evaluate(async () => { window.setFrameProof = await (await import('/tools/inventory-set-frame-smoke-fixture.mjs')).createSetFrameProof() })
  for (const [name, args] of [['standalone', [false, false, false]], ['companion-selected', [true, true, false]], ['ordinary-equipment', [false, false, true]]]) {
    const row = await page.evaluate(args => window.setFrameProof.render(...args), args)
    row.name = name
    receipt.rows.push(row)
    await page.screenshot({ path: join(output, `${name}.png`) })
  }
  await page.evaluate(() => window.setFrameProof.destroy())
  for (const row of receipt.rows) {
    const has = (record, x, y, width, height, alpha) => row.frames.some(f => f.record === record && f.x === x && f.y === y && f.width === width && f.height === height && f.alpha === alpha)
    for (const index of [0, 6, 8, 10]) assert.ok(has(15, 20 + Math.floor(index / 4) * 75, 492 + (index % 4) * 75, 80, 80, 1), `${row.name}: set inventory slot ${index}`)
    for (const index of [2, 4]) assert.ok(has(10, 24 + Math.floor(index / 4) * 75, 496 + (index % 4) * 75, 72, 72, 0.4), `${row.name}: ordinary inventory slot ${index}`)
    const shift = row.companion ? 0 : 53
    assert.ok(has(row.ordinaryEquipment ? 9 : 14, 1247 + shift - (row.ordinaryEquipment ? 0 : 4), 169 - (row.ordinaryEquipment ? 0 : 4), row.ordinaryEquipment ? 46 : 54, row.ordinaryEquipment ? 46 : 54, 1), `${row.name}: amulet frame`)
    assert.ok(row.tiled.length === 1 && row.tiled[0].tiles.length === (row.ordinaryEquipment ? 12 : 14), `${row.name}: native tall frame tiles`)
    assert.ok(row.retained, `${row.name}: repeated rendering retains textures`)
  }
  for (const values of Object.values(errors)) assert.equal(values.length, 0)
  receipt.status = 'passed'
} catch (error) { receipt.status = 'failed'; receipt.failure = String(error); process.exitCode = 1 }
finally { await browser?.close(); await vite.close(); await writeFile(join(output, 'result.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, output })) }

import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const evidence = process.env.SDR_TOOLTIP_EVIDENCE || '/tmp/solomon-skill-tooltip'
await mkdir(evidence, { recursive: true })
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})
await server.listen()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = { page: [], console: [], responses: [] }
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.route(`${origin}/__tooltip-probe`, route => route.fulfill({ body: '<!doctype html><body></body>', contentType: 'text/html' }))
  await page.goto(`${origin}/__tooltip-probe`)
  const result = await page.evaluate(async () => {
    const { inspectSkillTooltipRendering } = await import('/tools/skill-tooltip-render-probe.mjs')
    return inspectSkillTooltipRendering()
  })
  await writeFile(`${evidence}/meditation-render.png`, Buffer.from(result.image.split(',')[1], 'base64'))
  delete result.image
  console.log(JSON.stringify({ ...result, errors }))
  assert.deepEqual(result.failures, [], 'actual bitmap text must fit inside the painted HoverBox')
  assert.deepEqual(result.descriptionDirectives, [], 'plain description wrapper membership changed')
  assert.equal(result.retiredChildren, 0)
  assert.ok(result.cases >= 400)
  assert.ok(result.glyphs > 10000)
  assert.deepEqual(errors, { page: [], console: [], responses: [] })
} finally {
  await browser.close()
  await server.close()
}

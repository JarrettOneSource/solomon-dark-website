import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { createGameSimulation, enterBoneyardWorld } from '../src/game/core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'

const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 45))
const defaults = createGameSnapshot(enterBoneyardWorld(createGameSimulation({
  local: { discipline: 'arcane', displayName: 'Layer probe', element: 'fire' },
}), loaded), 'local')
const server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)),
  logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
})
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  const errors = [], failedResponses = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() }) })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/__ground-effect-layering`
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }))
  await page.goto(url)
  const records = await page.evaluate(async input => {
    const { inspectGroundEffectLayering } = await import('/tools/ground-effect-layering-probe.mjs')
    return inspectGroundEffectLayering(input)
  }, { loaded, defaults })
  assert.equal(records.length, 84)
  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [])
  console.log(JSON.stringify({ status: 'ok', records, errors, failedResponses }))
} finally {
  await browser.close()
  await server.close()
}

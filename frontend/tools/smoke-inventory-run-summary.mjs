import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

// This diagnostic bridge exercises the production painter unchanged. It can
// be served outside an exact baseline checkout to retain a real baseline
// image/failure before candidate acceptance; it is not a gameplay save grant.
const output = process.env.SDR_REPORT61_BROWSER_OUTPUT
assert.ok(output && resolve(output).startsWith('/Volumes/Drive/codex-acceptance/solomon-report61-d7634e23/'))
await mkdir(output, { recursive: true })
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const origin = server.resolvedUrls.local[0]
let browser = null
const errors = { console: [], page: [], responses: [] }
const observations = []
let failure = null
try {
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  await page.route('**/__report61_inventory', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
<style>body{margin:0;background:black}canvas{display:block}</style>
<script type="module">
import { createHubInventoryRenderer } from '/src/game/renderer/hub-inventory-renderer.ts'
import { createGameSimulation } from '/src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '/src/game/host/game-snapshot.ts'
const snapshot = createGameSnapshot(createGameSimulation(), 'local-player')
const player = snapshot.players['local-player']
const renderer = await createHubInventoryRenderer([])
document.body.appendChild(renderer.canvas)
const model = { kind:'inventory', config:player.config, economy:player.economy,
  progression:player.progression, belt:player.belt, dragging:null, dyeModal:null,
  flybys:[], inspection:null, notice:null, pressedControl:null, sackPath:[],
  sackTransition:null, selection:null, statsPage:0, runSummary:null }
window.report61 = {
  setSummary(summary) { renderer.setModel({...model,runSummary:summary}); renderer.render(performance.now(),1,1) }
}
document.body.dataset.ready='true'
</script>` })))
  await page.goto(new URL('__report61_inventory', origin).href)
  await page.locator('body[data-ready="true"]').waitFor({ timeout: 90_000 })
  for (const [name, summary, expected] of [
    ['survival-nonzero', { wave: 6, monstersKilled: 17, awesomeness: 91 }, ['Wave: 6', 'Kills: 17', 'Awesomeness: 91']],
    ['live-update', { wave: 7, monstersKilled: 19, awesomeness: 164 }, ['Wave: 7', 'Kills: 19', 'Awesomeness: 164']],
    ['zero-wave', { wave: 0, monstersKilled: 2, awesomeness: 71 }, ['Kills: 2', 'Awesomeness: 71']],
    ['restored-values', { wave: 12, monstersKilled: 321, awesomeness: 4567 }, ['Wave: 12', 'Kills: 321', 'Awesomeness: 4567']],
    ['actor-retired', null, []],
  ]) {
    await page.evaluate(value => window.report61.setSummary(value), summary)
    const canvas = page.locator('canvas').first()
    // Preserve the actual image and raw diagnostics before any assertion,
    // including the old painter's wrong zero strings/missing Wave.
    await canvas.screenshot({ path: join(output, `${name}.png`) })
    const diagnostic = await canvas.getAttribute('data-native-inventory-run-summary')
    const observation = { name, requestedSummary: summary, diagnostic }
    observations.push(observation)
    await writeFile(join(output, 'observations.json'), JSON.stringify({ observations, errors }, null, 2) + '\n')
    assert.ok(diagnostic !== null, 'Production inventory has no recovered live run-summary output; inspect retained baseline image')
    const lines = JSON.parse(diagnostic)
    assert.deepEqual(lines.map(line => line.text), expected)
    assert.deepEqual(lines.map(line => [line.x, line.y]), summary === null ? [] : summary.wave > 0
      ? [[800, 329], [800, 344], [800, 364]] : [[800, 344], [800, 364]])
  }
  assert.deepEqual(errors, { console: [], page: [], responses: [] })
} catch (error) {
  failure = `${error.name}: ${error.message}`
  throw error
} finally {
  await writeFile(join(output, 'receipt.json'), JSON.stringify({ observations, errors, failure,
    qualification: 'Real production inventory painter with declared read-only renderer-model fixture. Native/gameplay/current-built scene lifecycle and physical-device acceptance remain separate.' }, null, 2) + '\n')
  await browser?.close()
  await server.close()
}

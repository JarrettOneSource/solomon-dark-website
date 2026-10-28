import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'
import { createGameSimulation } from '../src/game/core-server/game-simulation.ts'
import { createGameSnapshot } from '../src/game/host/game-snapshot.ts'
import { createHubPresentationTimeline } from '../src/game/client/hub-presentation-timeline.ts'
import { createHubAmbientState, stepHubAmbient } from '../src/game/core-server/hub-ambient.ts'

// Run with the pinned tools and an isolated browser/TMPDIR on the validation host.
const evidence = process.env.SDR_GAME_TEACHER_LAYERING_EVIDENCE_ROOT
const mode = 'regression'
assert.ok(evidence, 'SDR_GAME_TEACHER_LAYERING_EVIDENCE_ROOT is required')
await mkdir(evidence, { recursive: true })
const authority = createGameSnapshot(createGameSimulation({
  local: { element: 'fire', discipline: 'arcane', displayName: 'Teacher layer probe' },
  guest: { element: 'water', discipline: 'arcane', displayName: 'Teacher guest probe' },
}), 'local')
const defaults = createHubPresentationTimeline({
  initialSnapshot: authority, initialReceivedAtMs: 0, localPlayerId: 'local',
  serverTickRate: 100, snapshotRate: 20,
}).sample(0)
const ambientSamples = []
const sampleTicks = new Set([0, 1, 2, 3, 4, 5, 6, 7, 268, 270, 300, 500])
let ambient = createHubAmbientState()
for (let tick = 0; tick <= 500; tick += 1) {
  if (sampleTicks.has(tick)) ambientSamples.push({ ...ambient, fountainParticles: [] })
  ambient = stepHubAmbient(ambient)
}
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
})
let browser
const errors = [], failedResponses = []
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH,
    headless: true, args: ['--disable-breakpad'] })
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() })
  })
  const url = `http://127.0.0.1:${server.httpServer.address().port}/__teacher_circle_layering`
  await page.route(url, route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
  }))
  await page.goto(url)
  const result = await page.evaluate(async input => {
    const { inspectTeacherCircleLayering } = await import('/tools/teacher-circle-layering-probe.mjs')
    return inspectTeacherCircleLayering(input)
  }, { defaults, ambientSamples })
  const images = []
  for (const kind of ['upperArcImage', 'controlImage']) {
    const capture = result[kind]
    for (const frame of ['without', 'withRune']) {
      const bytes = Buffer.from(capture[frame].split(',')[1], 'base64')
      const path = join(evidence, `${mode}-${kind}-${frame}.png`)
      await writeFile(path, bytes)
      images.push({ kind, frame, position: capture.position, path,
        bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
    }
    delete result[kind]
  }
  const receipt = { status: 'ok', observed_at_utc: new Date().toISOString(),
    ...result, images, errors, failedResponses }
  await writeFile(join(evidence, `${mode}-receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`)
  assert.deepEqual(errors, [])
  assert.deepEqual(failedResponses, [])
  console.log(JSON.stringify(receipt))
} catch (error) {
  const failure = { status: 'error', observed_at_utc: new Date().toISOString(),
    mode, message: error.message, errors, failedResponses }
  await writeFile(join(evidence, `${mode}-failure.json`), `${JSON.stringify(failure, null, 2)}\n`)
  console.log(JSON.stringify(failure))
  throw error
} finally {
  await browser?.close()
  await server.close()
}

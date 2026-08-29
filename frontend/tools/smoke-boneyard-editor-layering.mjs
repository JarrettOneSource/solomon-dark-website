import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

const requestedBaseUrl = process.env.SDR_GAME_SMOKE_URL?.trim()
const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const vite = requestedBaseUrl
  ? null
  : await createViteServer({
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      logLevel: 'error',
      root: frontendRoot,
      server: { host: '127.0.0.1', port: 0 },
    })
if (vite) await vite.listen()
const viteAddress = vite?.httpServer?.address()
if (vite && (!viteAddress || typeof viteAddress === 'string')) {
  await vite.close()
  throw new Error('Vite did not expose its editor layering smoke port')
}
const baseUrl = requestedBaseUrl
  || `http://127.0.0.1:${viteAddress.port}`
const screenshotPath = process.env.SDR_EDITOR_LAYERING_SCREENSHOT
  || '/tmp/solomon-editor-layering.png'

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
const pageErrors = []

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', error => pageErrors.push(error.message))
await context.route('**/deployment.json*', (route) => {
  const current = new URL(route.request().url()).searchParams.get('current')
  return route.fulfill({
    body: JSON.stringify({ revision: current }),
    contentType: 'application/json',
    headers: { 'cache-control': 'no-store' },
    status: 200,
  })
})
await context.addInitScript(() => {
  const id = 'layering-audit'
  const doc = {
    fences: [],
    groups: {},
    hasTimeline: true,
    meta: { bounds: { h: 900, w: 1_600, x: 0, y: 0 }, name: 'Layering Audit' },
    objects: [
      { eid: 'grave', pos: { x: 600, y: 100 }, typeId: 2029, variant: 0 },
      { eid: 'tree', pos: { x: 700, y: 300 }, typeId: 2001, variant: 0 },
      { eid: 'monument', pos: { x: 800, y: 400 }, typeId: 2009, variant: 0 },
      { eid: 'goodie', pos: { x: 900, y: 500 }, typeId: 2061, variant: 0 },
      { eid: 'building', pos: { x: 1_000, y: 600 }, typeId: 2040, variant: 0 },
    ],
    opaque: [],
    roads: [],
    sprites: [],
    terrain: [],
  }
  localStorage.setItem('sdr:boneyard:drafts', JSON.stringify([{
    id,
    name: doc.meta.name,
    residents: doc.objects.length,
    updatedAt: Date.now(),
  }]))
  localStorage.setItem(`sdr:boneyard:draft:${id}`, JSON.stringify({
    doc,
    format: 'sdr-boneyard-doc',
    version: 1,
  }))
})

try {
  await page.goto(`${baseUrl}/boneyard`, { waitUntil: 'domcontentloaded' })
  const canvas = page.locator('.boneyard-editor-canvas[data-editor-painter-layer-count="7"]')
  await canvas.waitFor({ timeout: 30_000 })
  const order = await canvas.evaluate(node => structuredClone(node.__sdrEditorPainterOrder))
  assert.deepEqual(order, [
    { id: 'main:0', row: 50, zIndex: 1 },
    { id: 'main:1', row: 150, zIndex: 2 },
    { id: 'main:2', row: 200, zIndex: 3 },
    { id: 'proxy:1', row: 200, zIndex: 4 },
    { id: 'main:3', row: 250, zIndex: 5 },
    { id: 'main:4', row: 300, zIndex: 6 },
    { id: 'proxy:4', row: 400, zIndex: 7 },
  ])
  await page.screenshot({ path: screenshotPath })
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])
  process.stdout.write(`${JSON.stringify({
    consoleErrors,
    order,
    pageErrors,
    screenshotPath,
  }, null, 2)}\n`)
} finally {
  await context.close()
  await browser.close()
  await vite?.close()
}

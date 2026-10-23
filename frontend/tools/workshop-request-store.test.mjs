import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'
import { chromium } from 'playwright-core'

test('native browser handoffs consume once, retain 16MiB payloads and roll back a full token store', async () => {
  const output = await build({
    entryPoints: [fileURLToPath(new URL('../src/editor/workshop-request-store.ts', import.meta.url))],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    globalName: 'WorkshopRequests',
    write: false,
    define: { 'import.meta.env.VITE_WEBSITE_BASE': JSON.stringify('/site') },
  })
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  try {
    const context = await browser.newContext()
    // A blank document supplies a real, isolated browser storage origin. No
    // Website/game endpoint is contacted and no IndexedDB implementation is mocked.
    await context.route('http://127.0.0.1/workshop-storage-test', route => route.fulfill({
      status: 200, contentType: 'text/html', body: '<!doctype html><title>Workshop storage test</title>',
    }))
    const page = await context.newPage()
    await page.goto('http://127.0.0.1/workshop-storage-test')
    await page.addScriptTag({ content: output.outputFiles[0].text })
    const result = await page.evaluate(async () => {
      const { putWorkshopRequest, consumeWorkshopRequest } = window.WorkshopRequests
      const content = 'x'.repeat(16 * 1024 * 1024)
      const id = await putWorkshopRequest({ kind: 'open', content })
      const tokenKey = `sdr:boneyard:workshop:${id}:/site`
      const tokenLength = sessionStorage.getItem(tokenKey).length
      const restored = await consumeWorkshopRequest(id)
      let repeated = null
      try { await consumeWorkshopRequest(id) } catch (reason) { repeated = reason.message }

      // Exhaust the real Web Storage quota without filling IndexedDB. A failed
      // descriptor write must retire its already-committed large payload.
      let quota = null
      try {
        for (let index = 0; index < 1000; index += 1) sessionStorage.setItem(`fill:${index}`, 'y'.repeat(64 * 1024))
      } catch (reason) { quota = reason.name }
      for (const width of [1024, 64, 1]) {
        let tail = sessionStorage.getItem('fill:tail') || ''
        for (;;) {
          try {
            sessionStorage.setItem('fill:tail', tail + 'z'.repeat(width))
            tail += 'z'.repeat(width)
          } catch { break }
        }
      }
      let denied = null
      try { await putWorkshopRequest({ kind: 'new' }) } catch (reason) { denied = reason.name }
      sessionStorage.clear()

      const count = await new Promise((resolve, reject) => {
        const open = indexedDB.open('solomon-dark-boneyard-workshop:/site', 1)
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const database = open.result
          const read = database.transaction('requests').objectStore('requests').count()
          read.onsuccess = () => { database.close(); resolve(read.result) }
          read.onerror = () => { database.close(); reject(read.error) }
        }
      })
      const next = await putWorkshopRequest({ kind: 'new' })
      const fresh = await consumeWorkshopRequest(next)
      return { tokenLength, bytes: restored.content.length, exact: restored.content === content,
        repeated, quota, denied, count, fresh }
    })
    assert.equal(result.bytes, 16 * 1024 * 1024)
    assert.equal(result.exact, true)
    assert.ok(result.tokenLength < 100)
    assert.match(result.repeated, /no longer available/)
    assert.equal(result.quota, 'QuotaExceededError')
    assert.equal(result.denied, 'QuotaExceededError')
    assert.equal(result.count, 0)
    assert.deepEqual(result.fresh, { kind: 'new' })
  } finally {
    await browser.close()
  }
})

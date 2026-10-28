import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

test('parallel guest saves fork once, preserve existing progress and never resurrect a deleted save', async () => {
  const output = await build({
    entryPoints: [fileURLToPath(new URL('../src/lib/parallel-save-migration.ts', import.meta.url))],
    bundle: true, platform: 'browser', format: 'iife', globalName: 'ParallelSaves', write: false,
  })
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  try {
    const context = await browser.newContext()
    await context.route('http://127.0.0.1/**', route => route.fulfill({
      status: 200, contentType: 'text/html', body: '<!doctype html><title>Parallel guest saves</title>',
    }))
    const page = await context.newPage()
    await page.goto('http://127.0.0.1/parallel-save-test')
    await page.addScriptTag({ content: output.outputFiles[0].text })
    const result = await page.evaluate(async () => {
      const source = 'solomon-dark-game-saves'
      const target = `${source}:/game-rust`
      async function slot(name, action, value) {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(name, 1)
          request.onupgradeneeded = () => request.result.createObjectStore('slots', { keyPath: 'slot' })
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve(request.result)
        })
        try {
          return await new Promise((resolve, reject) => {
            const transaction = db.transaction('slots', action === 'get' ? 'readonly' : 'readwrite')
            const store = transaction.objectStore('slots')
            const request = action === 'put' ? store.put(value) : action === 'delete' ? store.delete(0) : store.get(0)
            transaction.oncomplete = () => resolve(request.result ?? null)
            transaction.onabort = () => reject(transaction.error)
          })
        } finally { db.close() }
      }
      async function reset() {
        for (const name of [source, target]) {
          await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name)
            request.onsuccess = resolve
            request.onerror = () => reject(request.error)
          })
        }
      }
      const old = { slot: 0, revision: 17, document: 'retained Rust progress' }
      const later = { slot: 0, revision: 18, document: 'new PixiJS progress' }
      await slot(source, 'put', old)
      const concurrent = await Promise.all([
        window.ParallelSaves.migrateParallelGuestSave(),
        window.ParallelSaves.migrateParallelGuestSave(),
      ])
      const copied = await slot(target, 'get')
      const unchanged = await slot(source, 'get')
      await slot(source, 'put', later)
      const repeated = await window.ParallelSaves.migrateParallelGuestSave()
      const afterRootWrite = await slot(target, 'get')
      await slot(target, 'delete')
      const afterDelete = await window.ParallelSaves.migrateParallelGuestSave()
      const deleted = await slot(target, 'get')

      await reset()
      await slot(source, 'put', old)
      await slot(target, 'put', later)
      const preserved = await window.ParallelSaves.migrateParallelGuestSave()
      const existing = await slot(target, 'get')

      await reset()
      const empty = await window.ParallelSaves.migrateParallelGuestSave()
      await slot(source, 'put', later)
      const late = await window.ParallelSaves.migrateParallelGuestSave()
      const stillEmpty = await slot(target, 'get')
      return { old, later, concurrent, copied, unchanged, repeated, afterRootWrite,
        afterDelete, deleted, preserved, existing, empty, late, stillEmpty }
    })
    assert.deepEqual(result.concurrent.sort(), ['complete', 'copied'])
    assert.deepEqual(result.copied, result.old)
    assert.deepEqual(result.unchanged, result.old)
    assert.equal(result.repeated, 'complete')
    assert.deepEqual(result.afterRootWrite, result.old)
    assert.equal(result.afterDelete, 'complete')
    assert.equal(result.deleted, null)
    assert.equal(result.preserved, 'preserved')
    assert.deepEqual(result.existing, result.later)
    assert.equal(result.empty, 'empty')
    assert.equal(result.late, 'complete')
    assert.equal(result.stillEmpty, null)
  } finally { await browser.close() }
})

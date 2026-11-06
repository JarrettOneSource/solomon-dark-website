import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// The adoption runs in a real browser: IndexedDB transactions and localStorage.
test('PixiJS guest data becomes the Rust game\'s once, keeping the losing save as a backup', async () => {
  const output = await build({
    entryPoints: [fileURLToPath(new URL('../src/lib/pixijs-save-adoption.ts', import.meta.url))],
    bundle: true, platform: 'browser', format: 'iife', globalName: 'Adoption', write: false,
  })
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  try {
    const context = await browser.newContext()
    await context.route('http://127.0.0.1/**', route => route.fulfill({
      status: 200, contentType: 'text/html', body: '<!doctype html><title>PixiJS save adoption</title>',
    }))
    const page = await context.newPage()
    await page.goto('http://127.0.0.1/pixijs-save-adoption-test')
    await page.addScriptTag({ content: output.outputFiles[0].text })
    const results = await page.evaluate(async () => {
      const pixiName = 'solomon-dark-game-saves'
      const rustName = `${pixiName}:/game-rust`
      async function store(name, action, key, value) {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open(name, 1)
          request.onupgradeneeded = () => request.result.createObjectStore('slots', { keyPath: 'slot' })
          request.onerror = () => reject(request.error)
          request.onsuccess = () => resolve(request.result)
        })
        try {
          return await new Promise((resolve, reject) => {
            const transaction = db.transaction('slots', action === 'get' ? 'readonly' : 'readwrite')
            const slots = transaction.objectStore('slots')
            const request = action === 'put' ? slots.put(value) : slots.get(key)
            transaction.oncomplete = () => resolve(request.result ?? null)
            transaction.onabort = () => reject(transaction.error)
          })
        } finally { db.close() }
      }
      async function reset() {
        localStorage.clear()
        for (const name of [pixiName, rustName]) {
          await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name)
            request.onsuccess = resolve
            request.onerror = () => reject(request.error)
          })
        }
      }
      const pixiSave = { slot: 0, revision: 30, document: 'PixiJS progress' }
      const rustSave = { slot: 0, revision: 17, document: 'forked Rust copy' }
      const cases = {}

      // A returning PixiJS player who never opened /game-rust.
      await reset()
      await store(pixiName, 'put', 0, pixiSave)
      localStorage.setItem('solomon-dark-game-settings-v1', '{"musicVolume":3}')
      localStorage.setItem('sdr.game.hall-of-fame.v3', '[{"runId":"pixi-run","score":5}]')
      localStorage.setItem('sdr.game.playtime.v1', '6000')
      const concurrent = await Promise.all([window.Adoption.adoptPixiJsGuestData(), window.Adoption.adoptPixiJsGuestData()])
      cases.fresh = {
        concurrent: concurrent.sort(),
        save: await store(rustName, 'get', 0),
        settings: localStorage.getItem('solomon-dark-game-settings-v1:/game-rust'),
        hall: localStorage.getItem('sdr.game.hall-of-fame.v3:/game-rust'),
        playtime: localStorage.getItem('sdr.game.playtime.v1:/game-rust'),
        again: await window.Adoption.adoptPixiJsGuestData(),
        pixiUntouched: await store(pixiName, 'get', 0),
        pixiSettingsUntouched: localStorage.getItem('solomon-dark-game-settings-v1'),
      }

      // The player kept playing PixiJS after the fork: PixiJS's save wins, Rust's is kept.
      await reset()
      await store(pixiName, 'put', 0, pixiSave)
      await store(rustName, 'put', 0, rustSave)
      localStorage.setItem('solomon-dark-game-settings-v1', '{"musicVolume":3}')
      localStorage.setItem('solomon-dark-game-settings-v1:/game-rust', '{"musicVolume":9}')
      localStorage.setItem('sdr.game.hall-of-fame.v3', '[{"runId":"shared","score":1},{"runId":"pixi-run","score":5}]')
      localStorage.setItem('sdr.game.hall-of-fame.v3:/game-rust', '[{"runId":"shared","score":2},{"runId":"rust-run","score":7}]')
      localStorage.setItem('sdr.game.playtime.v1', '6000')
      localStorage.setItem('sdr.game.playtime.v1:/game-rust', '4000')
      cases.replaced = {
        result: await window.Adoption.adoptPixiJsGuestData(),
        save: await store(rustName, 'get', 0),
        backup: await store(rustName, 'get', 'backup:pixijs-adoption'),
        settings: localStorage.getItem('solomon-dark-game-settings-v1:/game-rust'),
        hall: JSON.parse(localStorage.getItem('sdr.game.hall-of-fame.v3:/game-rust')),
        playtime: localStorage.getItem('sdr.game.playtime.v1:/game-rust'),
      }

      // The player kept playing Rust: Rust's save stays, PixiJS's is kept.
      await reset()
      await store(pixiName, 'put', 0, { ...pixiSave, revision: 12 })
      await store(rustName, 'put', 0, { ...rustSave, revision: 40 })
      localStorage.setItem('sdr.game.hall-of-fame.v3', '[{"runId":"pixi-run"}]')
      localStorage.setItem('sdr.game.hall-of-fame.v3:/game-rust', 'not a hall')
      cases.kept = {
        result: await window.Adoption.adoptPixiJsGuestData(),
        save: await store(rustName, 'get', 0),
        backup: await store(rustName, 'get', 'backup:pixijs-adoption'),
        unreadableHallLeftAlone: localStorage.getItem('sdr.game.hall-of-fame.v3:/game-rust'),
      }

      // Nothing to adopt.
      await reset()
      cases.empty = { result: await window.Adoption.adoptPixiJsGuestData(), save: await store(rustName, 'get', 0) }
      return cases
    })

    assert.deepEqual(results.fresh.concurrent, ['adopted', 'complete'], 'two tabs adopt exactly once')
    assert.deepEqual(results.fresh.save, { slot: 0, revision: 30, document: 'PixiJS progress' })
    assert.equal(results.fresh.settings, '{"musicVolume":3}')
    assert.equal(results.fresh.hall, '[{"runId":"pixi-run","score":5}]')
    assert.equal(results.fresh.playtime, '6000', 'only the adopting tab adds playtime')
    assert.equal(results.fresh.again, 'complete')
    assert.deepEqual(results.fresh.pixiUntouched, { slot: 0, revision: 30, document: 'PixiJS progress' })
    assert.equal(results.fresh.pixiSettingsUntouched, '{"musicVolume":3}')

    assert.equal(results.replaced.result, 'replaced')
    assert.equal(results.replaced.save.document, 'PixiJS progress')
    assert.equal(results.replaced.backup.document, 'forked Rust copy')
    assert.equal(results.replaced.backup.source, 'rust')
    assert.equal(results.replaced.settings, '{"musicVolume":9}', 'existing Rust settings stay')
    assert.deepEqual(results.replaced.hall.map(row => [row.runId, row.score]),
      [['shared', 2], ['rust-run', 7], ['pixi-run', 5]], 'runs combine, the Rust row winning a shared run')
    assert.equal(results.replaced.playtime, '10000')

    assert.equal(results.kept.result, 'kept')
    assert.equal(results.kept.save.document, 'forked Rust copy')
    assert.equal(results.kept.backup.source, 'pixijs')
    assert.equal(results.kept.unreadableHallLeftAlone, 'not a hall')

    assert.deepEqual(results.empty, { result: 'empty', save: null })
  } finally {
    await browser.close()
  }
})

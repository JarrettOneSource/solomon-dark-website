// Real React effects and DOM lifecycle; only the GPU renderer and RAF delivery are controlled.
// Run on the Mac mini: node --test tools/test-native-loader-lifecycle.mjs
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

let browser
let script
before(async () => {
  const result = await build({
    absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
    entryPoints: ['tools/native-loader-lifecycle-fixture.mjs'],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    loader: { '.css': 'empty' },
    plugins: [{
      name: 'controlled-loader-renderer',
      setup(build) {
        build.onLoad({ filter: /[/\\]renderer[/\\]loader-renderer\.ts$/ }, () => ({
          contents: 'export const createLoaderRenderer = options => window.__nativeLoaderLifecycle.createRenderer(options)',
          loader: 'js',
        }))
      },
    }],
  })
  script = result.outputFiles[0].text
  browser = await chromium.launch({
    executablePath: process.env.SDR_CHROME_PATH
      || (process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : '/usr/bin/google-chrome'),
    headless: true,
  })
})
after(async () => browser?.close())

async function fixture(t) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  t.after(async () => {
    await page.close()
    assert.deepEqual(errors, [], 'unexpected browser errors')
  })
  await page.setContent('<!doctype html><style>html,body,#root,.native-loader-page,.native-loader-stage{margin:0;width:100%;height:100%}</style><div id="root"></div>')
  await page.addScriptTag({ content: script })
  return page
}

test('117 separate progress commits coalesce to one latest-value frame, then re-arm', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount()
    await loader.resolve(0)
    for (let completed = 1; completed <= 117; completed++) {
      await loader.update({ progress: completed / 118, completed, total: 118 })
    }
    const beforeFrame = structuredClone(loader.snapshot())
    await loader.frame()
    const afterFrame = structuredClone(loader.snapshot())
    await loader.update({ progress: 1 })
    const rearmed = structuredClone(loader.snapshot())
    await loader.frame()
    const completed = structuredClone(loader.snapshot())
    await loader.unmount()
    return { beforeFrame, afterFrame, rearmed, completed, unmounted: loader.snapshot() }
  })
  assert.deepEqual(result.beforeFrame.renderers[0].renders, [0])
  assert.equal(result.beforeFrame.pendingFrames, 1)
  assert.equal(result.beforeFrame.requestedFrames, 1)
  assert.match(result.beforeFrame.status, /99%/)
  assert.deepEqual(result.afterFrame.renderers[0].renders, [0, 117 / 118])
  assert.equal(result.afterFrame.pendingFrames, 0)
  assert.equal(result.rearmed.pendingFrames, 1)
  assert.deepEqual(result.completed.renderers[0].renders, [0, 117 / 118, 1])
  assert.equal(result.unmounted.renderers[0].destroys, 1)
})

test('creation paints the latest progress immediately, preserves bounded values and ignores text-only changes', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount({ props: { progress: 0.1 } })
    await loader.update({ progress: 0.8 })
    const pending = structuredClone(loader.snapshot())
    await loader.resolve(0)
    const created = structuredClone(loader.snapshot())
    await loader.update({ stage: 'Finishing', currentItem: 'last.png' })
    const textOnly = structuredClone(loader.snapshot())
    await loader.update({ progress: 2 })
    await loader.frame()
    await loader.update({ progress: -1 })
    await loader.frame()
    const bounded = structuredClone(loader.snapshot())
    await loader.unmount()
    return { pending, created, textOnly, bounded }
  })
  assert.equal(result.pending.pendingFrames, 0)
  assert.deepEqual(result.created.renderers[0].renders, [0.8])
  assert.equal(result.created.renderers[0].mounts, 1)
  assert.equal(result.created.canvases, 1)
  assert.equal(result.created.pendingFrames, 0)
  assert.equal(result.textOnly.pendingFrames, 0)
  assert.deepEqual(result.textOnly.renderers[0].renders, [0.8])
  assert.deepEqual(result.bounded.renderers[0].renders, [0.8, 1, 0])
})

test('unmount cancels its outstanding RAF including handle zero before normal renderer destruction', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount()
    await loader.resolve(0)
    await loader.update({ progress: 0.5 })
    const pending = structuredClone(loader.snapshot())
    await loader.unmount()
    await loader.frame()
    return { pending, unmounted: loader.snapshot() }
  })
  assert.equal(result.pending.pendingFrames, 1)
  assert.deepEqual(result.unmounted.cancelledFrames, [0])
  assert.equal(result.unmounted.pendingFrames, 0)
  assert.deepEqual(result.unmounted.renderers[0].renders, [0])
  assert.equal(result.unmounted.renderers[0].destroys, 1)
  assert.equal(result.unmounted.renderers[0].pendingFramesAtDestroy, 0)
  assert.equal(result.unmounted.canvases, 0)
})

test('resize retains the mounted canvas and updates its viewport while a progress frame is pending', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount()
    await loader.resolve(0)
    const canvas = document.querySelector('canvas')
    await loader.update({ progress: 0.5 })
    await loader.resize(2560, 1080)
    const resized = structuredClone(loader.snapshot())
    const retainedCanvas = canvas === document.querySelector('canvas')
    await loader.frame()
    const painted = structuredClone(loader.snapshot())
    await loader.unmount()
    return { resized, retainedCanvas, painted }
  })
  assert.equal(result.retainedCanvas, true)
  assert.equal(result.resized.creations, 1)
  assert.equal(result.resized.renderers[0].viewports.at(-1).width, 2560 / 1.2)
  assert.equal(result.resized.renderers[0].viewports.at(-1).height, 900)
  assert.equal(result.resized.pendingFrames, 1)
  assert.deepEqual(result.painted.renderers[0].renders, [0, 0.5])
})

test('remount is isolated from a cancelled old frame and an old asynchronous renderer', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount({ strict: true })
    await loader.resolve(1)
    await loader.update({ progress: 0.3 })
    await loader.unmount()
    await loader.mount({ props: { progress: 0.6 } })
    await loader.resolve(2)
    await loader.update({ progress: 0.9 })
    await loader.resolve(0)
    await loader.replayCancelledFrames()
    const beforeFrame = structuredClone(loader.snapshot())
    await loader.frame()
    const afterFrame = structuredClone(loader.snapshot())
    await loader.unmount()
    return { beforeFrame, afterFrame }
  })
  assert.equal(result.beforeFrame.renderers[0].mounts, 0)
  assert.equal(result.beforeFrame.renderers[0].destroys, 1)
  assert.deepEqual(result.beforeFrame.renderers[1].renders, [0])
  assert.deepEqual(result.beforeFrame.renderers[2].renders, [0.6])
  assert.equal(result.beforeFrame.pendingFrames, 1)
  assert.equal(result.beforeFrame.canvases, 1)
  assert.deepEqual(result.afterFrame.renderers[2].renders, [0.6, 0.9])
})

test('creation resolving after unmount is destroyed without mounting, painting or scheduling', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount()
    await loader.update({ progress: 0.9 })
    await loader.unmount()
    await loader.resolve(0)
    return loader.snapshot()
  })
  assert.equal(result.renderers[0].destroys, 1)
  assert.equal(result.renderers[0].mounts, 0)
  assert.deepEqual(result.renderers[0].renders, [])
  assert.equal(result.pendingFrames, 0)
  assert.equal(result.canvases, 0)
})

test('StrictMode replay keeps the current renderer and cancels its pending frame', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount({ strict: true })
    await loader.update({ progress: 0.4 })
    await loader.resolve(1)
    await loader.resolve(0)
    await loader.update({ progress: 0.6 })
    await loader.update({ progress: 0.9 })
    const beforeFrame = structuredClone(loader.snapshot())
    await loader.frame()
    const afterFrame = structuredClone(loader.snapshot())
    await loader.update({ progress: 1 })
    await loader.unmount()
    await loader.frame()
    return { beforeFrame, afterFrame, unmounted: loader.snapshot() }
  })
  assert.equal(result.beforeFrame.creations, 2)
  assert.equal(result.beforeFrame.renderers[0].destroys, 1)
  assert.equal(result.beforeFrame.renderers[0].mounts, 0)
  assert.deepEqual(result.beforeFrame.renderers[0].renders, [])
  assert.deepEqual(result.beforeFrame.renderers[1].renders, [0.4])
  assert.equal(result.beforeFrame.pendingFrames, 1)
  assert.deepEqual(result.afterFrame.renderers[1].renders, [0.4, 0.9])
  assert.equal(result.unmounted.renderers[1].destroys, 1)
  assert.deepEqual(result.unmounted.renderers[1].renders, [0.4, 0.9])
  assert.equal(result.unmounted.pendingFrames, 0)
})

test('renderer creation failure remains visible and schedules no progress frames', async t => {
  const page = await fixture(t)
  const result = await page.evaluate(async () => {
    const loader = window.__nativeLoaderLifecycle
    await loader.mount()
    await loader.reject(0)
    await loader.update({ progress: 0.5 })
    const failed = structuredClone(loader.snapshot())
    await loader.unmount()
    return failed
  })
  assert.equal(result.alert, 'Loader creation failed')
  assert.equal(result.pendingFrames, 0)
  assert.equal(result.canvases, 0)
})

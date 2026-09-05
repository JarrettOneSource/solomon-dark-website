import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const vite = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer.address()
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const failures = []
const receipts = []
const errors = []

try {
  for (const scenario of [
    { width: 1600, height: 1000, deviceScaleFactor: 1 },
    { width: 1920, height: 1080, deviceScaleFactor: 2 },
    { width: 896, height: 414, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.deviceScaleFactor,
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('response', response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
    })
    await page.goto(`http://127.0.0.1:${address.port}/native-ui.html`)
    await page.waitForFunction(() => document.documentElement.dataset.nativeUiWorkbench === 'ready')
    const canvas = page.locator('.native-ui-workbench-canvas')
    await settle(page)
    const initial = await canvasReceipt(canvas)
    if (!initial.matchesDisplay) failures.push({ scenario, kind: 'canvas-density', ...initial })

    await page.locator('#show-dom').click()
    const dom = page.locator('[data-native-ui-dom-workbench="ready"]:not([hidden])')
    const slider = dom.getByRole('slider', { name: 'SOUND VOL:' })
    await slider.focus()
    await slider.press('End')
    await settle(page)
    const control = await slider.evaluate(input => {
      const row = input.closest('.game-settings-range')
      const label = row.querySelector('.game-settings-native-label [data-native-ui-font]')
      const boxes = [...label.querySelectorAll('[data-native-ui-glyph]')].map(glyph => glyph.getBoundingClientRect())
      const top = Math.min(...boxes.map(box => box.top))
      const bottom = Math.max(...boxes.map(box => box.bottom))
      const rowBounds = row.getBoundingClientRect()
      const inputBounds = input.getBoundingClientRect()
      const valueBounds = row.querySelector('output').getBoundingClientRect()
      const scale = rowBounds.height / row.offsetHeight
      return {
        inkCenterOffset: ((top + bottom) / 2 - (rowBounds.top + rowBounds.height / 2)) / scale,
        value: input.value,
        valueClearOfSlider: valueBounds.left >= inputBounds.right,
      }
    })
    if (Math.abs(control.inkCenterOffset) > 1) failures.push({ scenario, kind: 'flow-alignment', ...control })
    if (control.value !== '100' || !control.valueClearOfSlider) failures.push({ scenario, kind: 'range-value-overlap', ...control })

    await dom.getByRole('tab', { name: 'TYPOGRAPHY', exact: true }).click()
    const fonts = await dom.locator('[data-typography-font]').evaluateAll(cards => cards.map(card => {
      const box = card.querySelector('[data-typography-box]')
      const boxBounds = box.getBoundingClientRect()
      const glyphs = [...box.querySelectorAll('[data-native-ui-glyph]')].map(glyph => glyph.getBoundingClientRect())
      const inkTop = Math.min(...glyphs.map(rect => rect.top))
      const inkBottom = Math.max(...glyphs.map(rect => rect.bottom))
      const baseline = card.querySelector('[data-typography-baseline]')
      const baselineBounds = baseline.getBoundingClientRect()
      const anchor = baseline.querySelector('[data-native-ui-placement="baseline"]').getBoundingClientRect()
      const scale = baselineBounds.height / 60
      return {
        font: card.dataset.typographyFont,
        flowCenterOffset: ((inkTop + inkBottom - boxBounds.top - boxBounds.bottom) / 2) / scale,
        baselineOffsetX: (anchor.x - baselineBounds.x - baselineBounds.width / 2) / scale,
        baselineOffsetY: (anchor.y - baselineBounds.y) / scale - 40,
      }
    }))
    if (fonts.length !== 10 || fonts.some(font => Math.abs(font.flowCenterOffset) > 0.05
      || Math.abs(font.baselineOffsetX) > 0.05 || Math.abs(font.baselineOffsetY) > 0.05)) {
      failures.push({ scenario, kind: 'all-font-placements', fonts })
    }

    await page.locator('#show-components').click()
    await page.setViewportSize({ width: 1366, height: 768 })
    await settle(page)
    const resized = await canvasReceipt(canvas)
    if (!resized.matchesDisplay) failures.push({ scenario, kind: 'resized-canvas-density', ...resized })
    const lifetime = await page.evaluate(async () => {
      const { createGameWebGlApplication } = await import('/src/game/renderer/game-webgl.ts')
      const gpu = await createGameWebGlApplication({ className: 'typography-lifetime-canvas', width: 160, height: 80 })
      const first = document.createElement('div')
      const second = document.createElement('div')
      for (const host of [first, second]) {
        host.style.cssText = 'position:fixed;left:0;top:0;width:160px;height:80px;transform-origin:0 0;pointer-events:none'
        document.body.append(host)
      }
      const sibling = document.createElement('span')
      second.append(sibling)
      const wait = () => new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      const read = () => {
        const rect = gpu.canvas.getBoundingClientRect()
        return { backing: [gpu.canvas.width, gpu.canvas.height], expected: [Math.round(rect.width * devicePixelRatio), Math.round(rect.height * devicePixelRatio)] }
      }
      const firstClose = gpu.mount(first)
      first.style.transform = 'scale(1.25)'
      await wait()
      const scaled = read()
      firstClose()
      const detached = !gpu.canvas.isConnected
      second.style.transform = 'scale(0.75)'
      const secondClose = gpu.mount(second)
      firstClose()
      await wait()
      const reopened = read()
      const staleClosePreservedOwner = gpu.canvas.parentElement === second
      gpu.destroy()
      secondClose()
      second.style.transform = 'scale(1.5)'
      await wait()
      const destroyed = !gpu.canvas.isConnected && sibling.parentElement === second
      first.remove()
      second.remove()
      return { scaled, detached, reopened, staleClosePreservedOwner, destroyed }
    })
    for (const phase of ['scaled', 'reopened']) {
      if (lifetime[phase].backing.some((size, axis) => Math.abs(size - lifetime[phase].expected[axis]) > 1)) {
        failures.push({ scenario, kind: `canvas-${phase}`, ...lifetime[phase] })
      }
    }
    if (!lifetime.detached || !lifetime.staleClosePreservedOwner || !lifetime.destroyed) failures.push({ scenario, kind: 'canvas-lifetime', ...lifetime })

    const cdp = await context.newCDPSession(page)
    const nextPixelRatio = scenario.deviceScaleFactor + 0.5
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: nextPixelRatio, mobile: false })
    // Chromium's metrics-only override omits the MediaQueryList change notification.
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'resolution', value: `${nextPixelRatio}dppx` }] })
    await page.waitForFunction(ratio => devicePixelRatio === ratio, nextPixelRatio)
    await page.waitForFunction(() => {
      const element = document.querySelector('.native-ui-workbench-canvas')
      const rect = element.getBoundingClientRect()
      return Math.abs(element.width - Math.round(rect.width * devicePixelRatio)) <= 1
    }, undefined, { timeout: 3000 })
    await settle(page)
    const changedDensity = await canvasReceipt(canvas)
    if (!changedDensity.matchesDisplay) failures.push({ scenario, kind: 'changed-dpr', ...changedDensity })
    receipts.push({ scenario, initial, control, fonts, resized, lifetime, changedDensity })
    await context.close()
  }
  process.stdout.write(`${JSON.stringify({ errors, failures, receipts })}\n`)
  assert.deepEqual(errors, [])
  assert.deepEqual(failures, [])
} finally {
  await browser.close()
  await vite.close()
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))))
}

async function canvasReceipt(canvas) {
  return canvas.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const expectedWidth = Math.round(bounds.width * devicePixelRatio)
    const expectedHeight = Math.round(bounds.height * devicePixelRatio)
    return {
      backing: [element.width, element.height],
      expected: [expectedWidth, expectedHeight],
      matchesDisplay: Math.abs(element.width - expectedWidth) <= 1 && Math.abs(element.height - expectedHeight) <= 1,
    }
  })
}

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_NATIVE_UI_SCREENSHOT
  || '/tmp/solomon-dark-native-ui-workbench.png'
const errors = {
  console: [],
  failedResponses: [],
  page: [],
}

const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const address = vite.httpServer?.address()
if (!address || typeof address === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its native-UI workbench port')
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
try {
  const page = await browser.newPage({ viewport: { height: 900, width: 1600 } })
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('response', response => {
    if (response.status() >= 400) {
      errors.failedResponses.push({ status: response.status(), url: response.url() })
    }
  })
  await page.goto(`http://127.0.0.1:${address.port}/native-ui.html`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForFunction(() => document.documentElement.dataset.nativeUiWorkbench === 'ready')
  const canvas = page.locator('.native-ui-workbench-canvas')
  await canvas.waitFor()
  assert.deepEqual(await canvas.evaluate(element => ({
    actionCount: element.dataset.actionCount,
    atlasCount: element.dataset.atlasCount,
    fontCount: element.dataset.fontCount,
    mode: element.dataset.mode,
    recordCount: element.dataset.recordCount,
  })), {
    actionCount: '6',
    atlasCount: '12',
    fontCount: '10',
    mode: 'components',
    recordCount: '1259',
  })
  await canvas.screenshot({ path: screenshotPath })

  const atlasCounts = {
    Bonedit: 84,
    ControlPanel: 116,
    Controls: 4,
    Create: 24,
    Fonts: 627,
    GameOver: 3,
    Inventory: 84,
    LevelPicker: 8,
    Loader: 5,
    Skills: 166,
    Title: 25,
    UI: 113,
  }
  for (const [atlas, count] of Object.entries(atlasCounts)) {
    await page.locator('#atlas').selectOption(atlas)
    await page.locator('#record').fill(`${count - 1}`)
    await page.locator('#record').dispatchEvent('change')
    await page.waitForFunction(({ expectedAtlas, expectedRecord }) => {
      const target = document.querySelector('.native-ui-workbench-canvas')
      return target?.dataset.mode === 'atlas'
        && target.dataset.atlas === expectedAtlas
        && target.dataset.record === expectedRecord
    }, { expectedAtlas: atlas, expectedRecord: `${count - 1}` })
  }
  assert.deepEqual(errors, { console: [], failedResponses: [], page: [] })
  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    atlasesExercised: Object.keys(atlasCounts),
    screenshotPath,
    errors,
  })}\n`)
} finally {
  await browser.close()
  await vite.close()
}

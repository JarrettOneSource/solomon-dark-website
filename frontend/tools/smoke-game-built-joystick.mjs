import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

// Drives the PRODUCTION bundle (vite preview + a real game host injected via
// window.solomonDarkRuntime), not the dev server. The dev server's unminified
// CSS kept the independent `translate` property that centered the joystick
// knob; the production pipeline folds that property into `transform`, which
// inline styles override. This smoke exists so build-pipeline CSS behavior is
// asserted on the surface users actually receive.
const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const endpointUrl = process.env.SDR_GAME_ENDPOINT_URL
const endpointCredential = process.env.SDR_GAME_ENDPOINT_CREDENTIAL
assert.ok(
  endpointUrl && endpointCredential,
  'SDR_GAME_ENDPOINT_URL and SDR_GAME_ENDPOINT_CREDENTIAL are required',
)
const idleScreenshotPath = process.env.SDR_JOYSTICK_IDLE_SCREENSHOT
  || '/tmp/solomon-dark-built-joystick-idle.png'
const heldScreenshotPath = process.env.SDR_JOYSTICK_HELD_SCREENSHOT
  || '/tmp/solomon-dark-built-joystick-held.png'

function rectCenter(rect) {
  assert.ok(rect, 'expected element bounds')
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

async function settledBounds(locator, page) {
  let previous = ''
  let stable = 0
  for (let sample = 0; sample < 160; sample += 1) {
    const bounds = await locator.boundingBox()
    const key = JSON.stringify(bounds)
    stable = key === previous ? stable + 1 : 0
    previous = key
    if (stable >= 10) return bounds
    await page.waitForTimeout(30)
  }
  assert.fail('knob bounds never settled')
}

const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const mobile = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 844, height: 390 },
  })
  const pageErrors = []
  mobile.on('pageerror', (error) => pageErrors.push(error.message))
  await mobile.addInitScript(([url, credential]) => {
    window.solomonDarkRuntime = { gameEndpoint: { kind: 'localhost', url, credential } }
  }, [endpointUrl, endpointCredential])

  await mobile.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  try {
    await mobile.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  } catch (error) {
    const failurePath = idleScreenshotPath.replace(/\.png$/, '-failure.png')
    await mobile.screenshot({ path: failurePath })
    process.stderr.write(`menu never appeared; page errors: ${JSON.stringify(pageErrors)}; screenshot: ${failurePath}\n`)
    throw error
  }
  await mobile.getByRole('button', { name: 'Play' }).click()
  await mobile.getByRole('button', { name: 'New Game' }).click()
  await mobile.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 15_000 })
  await mobile.getByRole('button', { name: /Water/i }).click()
  await mobile.locator('.create-menu-disciplines[data-visible="true"]').waitFor({ timeout: 15_000 })
  await mobile.locator('.create-menu-discipline-arcane').click()
  await mobile.locator('.hub-world-canvas').waitFor({ timeout: 30_000 })

  const joystick = mobile.locator('.game-touch-joystick')
  const knob = mobile.locator('.game-touch-joystick-knob')
  await joystick.waitFor()

  const idleKnobCenter = rectCenter(await settledBounds(knob, mobile))
  const base = await joystick.boundingBox()
  const baseCenter = rectCenter(base)
  assert.ok(
    Math.abs(idleKnobCenter.x - baseCenter.x) < 1,
    `idle knob must center in the base (x ${idleKnobCenter.x} vs ${baseCenter.x})`,
  )
  assert.ok(
    Math.abs(idleKnobCenter.y - baseCenter.y) < 1,
    `idle knob must center in the base (y ${idleKnobCenter.y} vs ${baseCenter.y})`,
  )
  await mobile.screenshot({ path: idleScreenshotPath })

  const cdp = await mobile.context().newCDPSession(mobile)
  const requestedOffset = base.width * 0.3
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: baseCenter.x, y: baseCenter.y }],
  })
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: baseCenter.x + requestedOffset, y: baseCenter.y }],
  })
  await mobile.waitForTimeout(60)
  const heldKnobCenter = rectCenter(await knob.boundingBox())
  assert.ok(
    Math.abs(heldKnobCenter.x - (baseCenter.x + requestedOffset)) < 1,
    `held knob must follow the touch (${heldKnobCenter.x} vs ${baseCenter.x + requestedOffset})`,
  )
  assert.ok(Math.abs(heldKnobCenter.y - baseCenter.y) < 1)
  await mobile.screenshot({ path: heldScreenshotPath })

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  const releasedKnobCenter = rectCenter(await settledBounds(knob, mobile))
  assert.ok(Math.abs(releasedKnobCenter.x - baseCenter.x) < 1)
  assert.ok(Math.abs(releasedKnobCenter.y - baseCenter.y) < 1)

  assert.deepEqual(pageErrors, [])
  process.stdout.write(
    `built-bundle joystick smoke passed: idle knob (${idleKnobCenter.x.toFixed(2)}, ${idleKnobCenter.y.toFixed(2)}) `
    + `centered in base (${baseCenter.x.toFixed(2)}, ${baseCenter.y.toFixed(2)})\n`,
  )
} finally {
  await browser.close()
}

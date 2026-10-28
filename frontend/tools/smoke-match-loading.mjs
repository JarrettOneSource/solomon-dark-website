import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4181'
const startupTimeoutMs = Number(process.env.SDR_GAME_STARTUP_TIMEOUT_MS || '240000')
const sceneTimeoutMs = Number(process.env.SDR_GAME_SCENE_TIMEOUT_MS || '180000')
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})
let page
const pageErrors = []
const consoleErrors = []
const failedResponses = []
let delayedLoadingArtRequests = 0

try {
  page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`)
    }
  })
  // Transition loading does not consume PCM. Its audio pipeline has a separate
  // browser smoke; avoid making this focused journey decode every resident WAV.
  await page.addInitScript(bypassStartupAudioPreload)
  await page.addInitScript(delayMountedLoadingArt)
  await page.addInitScript(installLoadingProbe)
  await page.route('**/deployment.json?*', route => route.fulfill({
    body: JSON.stringify({ commit: 'smoke-local' }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/match-loading-background.png?match-mount=*', async (route) => {
    delayedLoadingArtRequests += 1
    await new Promise(resolve => setTimeout(resolve, 650))
    await route.continue()
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: startupTimeoutMs })
  await page.evaluate(() => window.__sdrRestoreAudioPreload?.())
  const tutorialOffer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorialOffer.isVisible()) {
    await tutorialOffer.getByRole('button', { exact: true, name: 'NO' }).click()
    await tutorialOffer.waitFor({ state: 'detached' })
  }
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 15_000 })
  const devtools = await page.context().newCDPSession(page)
  await devtools.send('Network.enable')
  await setNetworkLatency(devtools, 750)

  await page.locator('.create-menu-discipline-arcane').click()
  const hubLoading = await captureLoading(
    page,
    devtools,
    'hub',
    '/tmp/solomon-transition-loading-hub-final.png',
  )
  await setNetworkLatency(devtools, 0)
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: sceneTimeoutMs })
  await waitForLoadingTeardown(page, 'hub')

  await page.keyboard.down('KeyD')
  await page.waitForTimeout(100)
  await setNetworkLatency(devtools, 750)
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const boneyardLoading = await captureLoading(
    page,
    devtools,
    'boneyard',
    '/tmp/solomon-transition-loading-boneyard-final.png',
  )
  await setNetworkLatency(devtools, 0)
  await page.keyboard.up('KeyD')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(80)
  await page.keyboard.up('KeyW')
  await page.locator('.boneyard-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: sceneTimeoutMs })
  await waitForLoadingTeardown(page, 'boneyard')
  const arenaProgress = page.locator(
    '.gameplay-resume-progress-overlay'
    + '[data-gameplay-resume-grace-reason="game-started"]'
    + '[data-gameplay-resume-grace-phase="progress"]',
  )
  await arenaProgress.waitFor()
  await arenaProgress.getByRole('progressbar', { name: 'Resuming gameplay' }).waitFor()
  await arenaProgress.waitFor({ state: 'detached' })

  await page.waitForTimeout(250)
  const idleStart = await playerPosition(page)
  await page.waitForTimeout(400)
  const idleEnd = await playerPosition(page)
  assert.ok(
    distance(idleStart, idleEnd) < 0.25,
    `barrier-time input replayed after reveal: ${JSON.stringify({ idleStart, idleEnd })}`,
  )
  await page.keyboard.down('KeyD')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyD')
  await page.waitForTimeout(200)
  const freshInputEnd = await playerPosition(page)
  assert.ok(
    distance(idleEnd, freshInputEnd) > 0.5,
    `fresh post-reveal input did not move the player: ${JSON.stringify({ idleEnd, freshInputEnd })}`,
  )

  const samples = await page.evaluate(() => window.__sdrMatchLoadingSamples)
  assertFlowSamples(samples, 'hub')
  assertFlowSamples(samples, 'boneyard')
  assert.equal(delayedLoadingArtRequests, 2)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])

  process.stdout.write(`${JSON.stringify({
    browserVersion: browser.version(),
    hubLoading,
    boneyardLoading,
    input: { idleStart, idleEnd, freshInputEnd },
    samples,
    pageErrors,
    consoleErrors,
    failedResponses,
    delayedLoadingArtRequests,
  }, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    body: page ? (await page.locator('body').innerText()).slice(0, 2_000) : null,
    consoleErrors,
    failedResponses,
    pageErrors,
    samples: page
      ? await page.evaluate(() => window.__sdrMatchLoadingSamples ?? [])
      : [],
    title: page ? await page.title() : null,
    url: page?.url() ?? null,
  }, null, 2)}\n`)
  throw error
} finally {
  await browser.close()
}

async function captureLoading(page, devtools, flow, screenshotPath) {
  const selector = `.match-loading-screen[data-flow="${flow}"]`
  const loading = page.locator(selector)
  await loading.waitFor({ state: 'attached', timeout: 15_000 })
  const visibleLoading = page.locator(`${selector}[data-visible="true"]`)
  await visibleLoading.waitFor({ state: 'visible', timeout: 15_000 })
  const screenshot = await devtools.send('Page.captureScreenshot', {
    captureBeyondViewport: false,
    format: 'png',
    fromSurface: true,
  })
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  const metrics = await page.evaluate((matchLoadingFlow) => (
    window.__sdrMatchLoadingSamples.findLast(
      (sample) => sample.flow === matchLoadingFlow && sample.visible && sample.metrics,
    )?.metrics
  ), flow)
  assert.ok(metrics, `missing ${flow} loading metrics`)

  closeTo(metrics.overlay.x, 0)
  closeTo(metrics.overlay.y, 0)
  const viewport = page.viewportSize()
  assert.ok(viewport, 'missing browser viewport')
  closeTo(metrics.overlay.width, viewport.width)
  closeTo(metrics.overlay.height, 900)
  closeTo(metrics.track.x, viewport.width * 0.2 - 0.5)
  closeTo(metrics.track.y, 832)
  closeTo(metrics.track.width, viewport.width * 0.6)
  closeTo(metrics.track.height, 8)
  closeTo(metrics.fill.width, viewport.width * 0.6 * metrics.progress)
  assert.equal(metrics.art.naturalWidth, 1920)
  assert.equal(metrics.art.naturalHeight, 1080)
  assert.equal(metrics.art.objectFit, 'fill')
  assert.match(metrics.art.source, /match-loading-background\.png/)
  assert.equal(metrics.scrim.height, 162)
  assert.match(metrics.scrim.background, /rgba\(0, 0, 0, 0\.7\)/)
  assert.equal(metrics.track.background, 'rgba(20, 17, 13, 0.92)')
  assert.equal(metrics.track.outline, 'rgba(105, 82, 42, 0.9)')
  assert.equal(metrics.fill.background, 'rgb(202, 161, 77)')
  assert.equal(metrics.label.color, 'rgb(242, 229, 199)')
  assert.match(metrics.label.fontFamily, /Segoe UI/)
  assert.equal(metrics.label.fontSize, '20px')
  assert.equal(metrics.label.fontWeight, '600')
  assert.equal(metrics.topElementClass, 'match-loading-screen')
  assert.equal(metrics.zIndex, '200000')
  return metrics
}

async function waitForLoadingTeardown(page, flow) {
  await page.waitForFunction(
    (matchLoadingFlow) => !document.querySelector(
      `.match-loading-screen[data-flow="${matchLoadingFlow}"]`,
    ),
    flow,
    { timeout: 15_000 },
  )
}

async function setNetworkLatency(devtools, latency) {
  await devtools.send('Network.emulateNetworkConditions', {
    offline: false,
    latency,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
}

async function playerPosition(page) {
  return page.locator('.boneyard-scene').evaluate((scene) => ({
    x: Number(scene.dataset.localPlayerX),
    y: Number(scene.dataset.localPlayerY),
  }))
}

function assertFlowSamples(samples, flow) {
  const flowSamples = samples.filter((sample) => sample.flow === flow)
  assert.ok(flowSamples.length > 0, `missing ${flow} loading samples`)
  for (let index = 1; index < flowSamples.length; index += 1) {
    assert.ok(
      flowSamples[index].progress >= flowSamples[index - 1].progress,
      `${flow} progress regressed: ${JSON.stringify(flowSamples)}`,
    )
  }
  const first = flowSamples[0]
  const visible = flowSamples.find((sample) => sample.visible)
  assert.ok(
    flowSamples.some(sample => sample.delayElapsed && !sample.artReady),
    `${flow} did not exercise delayed mounted art: ${JSON.stringify(flowSamples)}`,
  )
  for (const sample of flowSamples) {
    if (sample.artReady) continue
    assert.equal(sample.visible, false)
    assert.equal(sample.chromeVisible, false)
    assert.equal(sample.artNaturalWidth, 0)
  }
  if (flow === 'hub') {
    assert.equal(typeof first.disciplineCommitAtMs, 'number')
    const attachDelayMs = first.atMs - first.disciplineCommitAtMs
    assert.ok(
      attachDelayMs >= 0 && attachDelayMs <= 150,
      `hub loading did not attach at discipline commit: ${JSON.stringify({
        attachDelayMs,
        flowSamples,
      })}`,
    )
  }
  assert.ok(visible, `${flow} loading never became visible`)
  assert.equal(visible.artReady, true)
  assert.equal(visible.artNaturalWidth, 1920)
  assert.equal(visible.chromeVisible, true)
  assert.ok(
    visible.atMs - first.atMs >= 130,
    `${flow} loading ignored the 150 ms reveal gate: ${JSON.stringify(flowSamples)}`,
  )
  assert.equal(flowSamples.at(-1).progress, 0.92)
  if (flow === 'boneyard') {
    const preparing = flowSamples.find(sample => sample.stage === 'preparing_boneyard')
    assert.ok(preparing, `missing Preparing the boneyard stage: ${JSON.stringify(flowSamples)}`)
    assert.equal(preparing.label, 'Preparing the boneyard...')
  }
}

function closeTo(actual, expected, tolerance = 0.05) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

function distance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function installLoadingProbe() {
  const samples = []
  Object.defineProperty(window, '__sdrMatchLoadingSamples', { value: samples })
  let disciplineCommitAtMs = null
  window.addEventListener('click', (event) => {
    if (event.target instanceof Element
      && event.target.closest('.create-menu-discipline')) {
      disciplineCommitAtMs = performance.now()
    }
  }, { capture: true })
  let previousKey = ''
  const sample = () => {
    const loading = document.querySelector('.match-loading-screen')
    if (loading) {
      const art = loading.querySelector('.match-loading-art')
      const label = loading.querySelector('.match-loading-label')
      const progress = loading.querySelector('.match-loading-progress')
      const next = {
        artNaturalWidth: art instanceof HTMLImageElement ? art.naturalWidth : 0,
        artReady: loading.dataset.artReady === 'true',
        atMs: performance.now(),
        chromeVisible: [label, progress].every(element => (
          element instanceof HTMLElement
          && getComputedStyle(element).visibility === 'visible'
        )),
        delayElapsed: loading.dataset.delayElapsed === 'true',
        flow: loading.dataset.flow,
        disciplineCommitAtMs,
        label: label?.textContent?.trim() ?? null,
        stage: loading.dataset.stage,
        progress: Number(loading.dataset.progress),
        visible: loading.dataset.visible === 'true',
      }
      if (next.visible) next.metrics = loadingMetrics(loading)
      const key = JSON.stringify([
        next.flow,
        next.stage,
        next.progress,
        next.visible,
        next.artReady,
        next.delayElapsed,
      ])
      if (key !== previousKey) {
        samples.push(next)
        previousKey = key
      }
    } else {
      previousKey = ''
    }
    requestAnimationFrame(sample)
  }
  requestAnimationFrame(sample)

  function loadingMetrics(node) {
    const art = node.querySelector('.match-loading-art')
    const scrim = node.querySelector('.match-loading-scrim')
    const label = node.querySelector('.match-loading-label')
    const progress = node.querySelector('.match-loading-progress')
    const fill = node.querySelector('.match-loading-progress-fill')
    if (!(art instanceof HTMLImageElement) || !scrim || !label || !progress || !fill) {
      return null
    }
    const rect = (element) => {
      const bounds = element.getBoundingClientRect()
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      }
    }
    const progressStyle = getComputedStyle(progress)
    return {
      flow: node.dataset.flow,
      stage: node.dataset.stage,
      progress: Number(node.dataset.progress),
      visible: node.dataset.visible,
      overlay: rect(node),
      art: {
        ...rect(art),
        naturalWidth: art.naturalWidth,
        naturalHeight: art.naturalHeight,
        objectFit: getComputedStyle(art).objectFit,
        source: art.currentSrc,
      },
      scrim: {
        ...rect(scrim),
        background: getComputedStyle(scrim).backgroundImage,
      },
      label: {
        ...rect(label),
        color: getComputedStyle(label).color,
        fontFamily: getComputedStyle(label).fontFamily,
        fontSize: getComputedStyle(label).fontSize,
        fontWeight: getComputedStyle(label).fontWeight,
        text: label.textContent?.trim(),
      },
      track: {
        ...rect(progress),
        background: progressStyle.backgroundColor,
        outline: progressStyle.outlineColor,
      },
      fill: {
        ...rect(fill),
        background: getComputedStyle(fill).backgroundColor,
      },
      topElementClass: document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2,
      )?.className,
      zIndex: getComputedStyle(node).zIndex,
    }
  }
}

function delayMountedLoadingArt() {
  const sourceDescriptor = Object.getOwnPropertyDescriptor(
    HTMLImageElement.prototype,
    'src',
  )
  if (!sourceDescriptor?.get || !sourceDescriptor.set) return
  let sequence = 0
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: sourceDescriptor.configurable,
    enumerable: sourceDescriptor.enumerable,
    get: sourceDescriptor.get,
    set(value) {
      if (
        typeof value !== 'string'
        || !this.classList.contains('match-loading-art')
      ) {
        sourceDescriptor.set.call(this, value)
        return
      }
      const source = new URL(value, window.location.href)
      if (!source.searchParams.has('match-mount')) {
        sequence += 1
        source.searchParams.set('match-mount', `${sequence}`)
      }
      sourceDescriptor.set.call(this, source.href)
    },
  })
}

function bypassStartupAudioPreload() {
  const nativeLoad = HTMLMediaElement.prototype.load
  HTMLMediaElement.prototype.load = function loadWithoutDecode() {
    if (!(this instanceof HTMLAudioElement)) return nativeLoad.call(this)
    queueMicrotask(() => this.dispatchEvent(new Event('loadeddata')))
  }
  Object.defineProperty(window, '__sdrRestoreAudioPreload', {
    value: () => { HTMLMediaElement.prototype.load = nativeLoad },
  })
}

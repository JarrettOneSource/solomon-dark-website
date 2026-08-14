import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4184'
const screenshotRoot = process.env.SDR_PRIMARY_SPELL_SCREENSHOT_ROOT || '/tmp'
const CREATE_MENU_TIMEOUT_MS = 30_000
const SPELLS = [
  {
    castPose: 8,
    element: 'Ether',
    kind: 'ether',
    mode: 'one-shot',
    releaseCue: '/game/audio/sfx/magic-missile.wav',
  },
  {
    castPose: 8,
    element: 'Fire',
    kind: 'fire',
    mode: 'one-shot',
    releaseCue: '/game/audio/sfx/throw-fire.wav',
  },
  {
    castPose: 7,
    element: 'Air',
    kind: 'air',
    loopCue: '/game/audio/sfx/lightning-loop.wav',
    mode: 'channel',
    startCue: '/game/audio/sfx/lightning-start.wav',
  },
  {
    castPose: 7,
    element: 'Water',
    kind: 'water',
    loopCue: '/game/audio/sfx/ice-loop.wav',
    mode: 'channel',
    startCue: '/game/audio/sfx/ice-start.wav',
  },
  {
    castPose: 7,
    element: 'Earth',
    kind: 'earth',
    loopCue: '/game/audio/sfx/gather-rocks-loop.wav',
    mode: 'charge',
    rollingCue: '/game/audio/sfx/rolling-stone-loop.wav',
    startCue: '/game/audio/sfx/start-boulder.wav',
  },
]

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await context.addInitScript(() => {
    const events = []
    const poseEvents = []
    let nextChannel = 1
    let previousPose = null
    const nativePause = HTMLMediaElement.prototype.pause
    const nativePlay = HTMLMediaElement.prototype.play
    const sourceMatches = (actual, expected) => {
      const actualName = new URL(actual).pathname.split('/').pop()
      const expectedName = expected.split('/').pop()
      const extensionAt = expectedName.lastIndexOf('.')
      const stem = expectedName.slice(0, extensionAt)
      const extension = expectedName.slice(extensionAt)
      const suffix = actualName.slice(stem.length, -extension.length)
      return actualName === expectedName
        || (actualName.startsWith(`${stem}-`)
          && actualName.endsWith(extension)
          && /^-[\w-]+$/.test(suffix))
    }
    const channel = (media) => {
      let id = Number(media.dataset.primarySpellAudioChannel)
      if (id) return id
      id = nextChannel
      nextChannel += 1
      media.dataset.primarySpellAudioChannel = `${id}`
      return id
    }
    HTMLMediaElement.prototype.pause = function () {
      events.push({
        at: performance.now(),
        channelId: channel(this),
        currentTime: this.currentTime,
        loop: this.loop,
        src: this.src,
        type: 'pause',
        volume: this.volume,
      })
      nativePause.call(this)
    }
    HTMLMediaElement.prototype.play = function () {
      const event = {
        at: performance.now(),
        channelId: channel(this),
        currentTime: this.currentTime,
        loop: this.loop,
        src: this.src,
        type: 'play',
        volume: this.volume,
      }
      events.push(event)
      const result = nativePlay.call(this)
      void result.then(
        () => events.push({ ...event, at: performance.now(), type: 'started' }),
        () => {},
      )
      return result
    }
    Object.defineProperties(window, {
      __primarySpellAudioEvents: { value: events },
      __primarySpellPoseEvents: { value: poseEvents },
      __primarySpellAudioSourceMatches: { value: sourceMatches },
    })
    const observePose = () => {
      const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
      if (frame && frame.playerAttachmentPose !== previousPose) {
        previousPose = frame.playerAttachmentPose
        poseEvents.push({
          at: performance.now(),
          playerAttachmentPose: frame.playerAttachmentPose,
          tick: frame.tick,
        })
      }
      requestAnimationFrame(observePose)
    }
    requestAnimationFrame(observePose)
  })

  const receipts = []
  const errors = []
  let earthPage = null

  for (const spell of SPELLS) {
    const page = await context.newPage()
    watchErrors(page, errors, spell.kind)
    await enterHub(page, spell.element)
    const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
    await canvas.waitFor({ timeout: 30_000 })
    const initial = await canvas.evaluate((node) => ({ ...node.__sdrHubFrame }))
    assert.equal(initial.playerAttachmentPose, 0)
    assert.equal(initial.primarySpellCount, 0)
    const eventStart = await audioEventCount(page)
    const poseEventStart = await page.evaluate(() => window.__primarySpellPoseEvents.length)
    const target = await castTarget(canvas, 0.67, 0.42)
    await page.mouse.move(target.x, target.y)
    await page.mouse.down({ button: 'left' })

    if (spell.mode === 'one-shot') {
      await page.waitForTimeout(35)
      await page.mouse.up({ button: 'left' })
    }

    const castFrame = await waitForHubCastPose(page, poseEventStart, spell.castPose)
    assert.equal(castFrame.playerAttachmentPose, spell.castPose)
    const frame = await waitForHubSpell(page, spell.kind)
    const screenshotPath = `${screenshotRoot}/solomon-primary-${spell.kind}-hub.png`
    await page.screenshot({ path: screenshotPath })

    if (spell.startCue) await waitForAudio(page, eventStart, spell.startCue, 'play')
    if (spell.releaseCue && spell.mode === 'one-shot') {
      await waitForAudio(page, eventStart, spell.releaseCue, 'play')
    }
    if (spell.loopCue) {
      const loop = await waitForAudio(page, eventStart, spell.loopCue, 'play')
      assert.equal(loop.loop, true)
    }

    let releaseScreenshotPath = null
    if (spell.mode !== 'one-shot') {
      await page.mouse.up({ button: 'left' })
      if (spell.mode === 'channel') {
        await waitForAudio(page, eventStart, spell.loopCue, 'pause')
      } else {
        const rolling = await waitForAudio(page, eventStart, spell.rollingCue, 'play')
        assert.equal(rolling.loop, true)
        await waitForHubSpell(page, spell.kind)
        releaseScreenshotPath = `${screenshotRoot}/solomon-primary-earth-hub-release.png`
        await page.screenshot({ path: releaseScreenshotPath })
      }
    }

    const spellEvents = (await audioEvents(page)).slice(eventStart)
      .filter((event) => event.type === 'play' || event.type === 'pause')
      .map((event) => ({
        loop: event.loop,
        source: new URL(event.src).pathname,
        type: event.type,
      }))
    receipts.push({
      castPose: castFrame.playerAttachmentPose,
      element: spell.element,
      kind: spell.kind,
      primarySpellCount: frame.primarySpellCount,
      primarySpellKinds: frame.primarySpellKinds,
      releaseScreenshotPath,
      screenshotPath,
      spellEvents,
      tick: frame.tick,
    })

    if (spell.kind === 'earth') {
      earthPage = page
    } else {
      await page.close()
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  assert.ok(earthPage, 'expected the Earth character to remain connected')
  const boneyard = await castEarthInBoneyard(earthPage)
  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({
    boneyard,
    errors,
    receipts,
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
}

async function enterHub(page, element) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: CREATE_MENU_TIMEOUT_MS,
  })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 30_000 })
  try {
    await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 30_000 })
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      alert: document.querySelector('.hub-renderer-error')?.textContent?.trim() || null,
      body: document.body.innerText.slice(0, 2_000),
      rendererState: document.querySelector('.hub-scene')?.getAttribute('data-renderer-state'),
      url: location.href,
    }))
    throw new Error(`Hub renderer did not become ready: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
}

async function castEarthInBoneyard(page) {
  const enter = page.getByRole('button', { name: 'Enter the Boneyard' })
  await enter.waitFor({ timeout: 10_000 })
  await enter.click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 30_000,
  })
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 30_000 })
  const eventStart = await audioEventCount(page)
  const target = await castTarget(canvas, 0.67, 0.38)
  await page.mouse.move(target.x, target.y)
  await page.mouse.down({ button: 'left' })
  await waitForAudio(page, eventStart, '/game/audio/sfx/start-boulder.wav', 'play')
  const gather = await waitForAudio(
    page,
    eventStart,
    '/game/audio/sfx/gather-rocks-loop.wav',
    'play',
  )
  assert.equal(gather.loop, true)
  const held = await waitForBoneyardSpell(page, 'earth')
  const heldScreenshotPath = `${screenshotRoot}/solomon-primary-earth-boneyard-held.png`
  await page.screenshot({ path: heldScreenshotPath })
  await page.mouse.up({ button: 'left' })
  const rolling = await waitForAudio(
    page,
    eventStart,
    '/game/audio/sfx/rolling-stone-loop.wav',
    'play',
  )
  assert.equal(rolling.loop, true)
  const released = await waitForBoneyardSpell(page, 'earth')
  const releaseScreenshotPath = `${screenshotRoot}/solomon-primary-earth-boneyard-release.png`
  await page.screenshot({ path: releaseScreenshotPath })
  assert.ok(released.painterBandCount >= 2)
  assert.ok(released.maxDynamicZIndex > 0)
  return {
    held,
    heldScreenshotPath,
    releaseScreenshotPath,
    released,
  }
}

async function waitForHubCastPose(page, eventStart, expectedPose) {
  const handle = await page.waitForFunction(([start, pose]) => (
    window.__primarySpellPoseEvents.slice(start).find(
      (event) => event.playerAttachmentPose === pose,
    ) ?? null
  ), [eventStart, expectedPose], { timeout: 5_000 })
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForHubSpell(page, kind) {
  let handle
  try {
    handle = await page.waitForFunction(
      (expectedKind) => {
        const frame = document.querySelector('.hub-world-canvas')?.__sdrHubFrame
        return frame?.primarySpellKinds?.includes(expectedKind)
          ? { ...frame, playerPositions: { ...frame.playerPositions } }
          : null
      },
      kind,
      { timeout: 10_000 },
    )
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      audioEvents: window.__primarySpellAudioEvents,
      element: document.querySelector('.hub-scene')?.getAttribute('data-element'),
      frame: { ...document.querySelector('.hub-world-canvas')?.__sdrHubFrame },
      rendererState: document.querySelector('.hub-scene')?.getAttribute('data-renderer-state'),
    }))
    throw new Error(`Hub ${kind} cast was not observed: ${JSON.stringify(diagnostics)}`, {
      cause: error,
    })
  }
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function waitForBoneyardSpell(page, kind) {
  const handle = await page.waitForFunction(
    (expectedKind) => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      return frame?.primarySpellKinds?.includes(expectedKind) ? { ...frame } : null
    },
    kind,
    { timeout: 10_000 },
  )
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

async function castTarget(canvas, xRatio, yRatio) {
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected the gameplay canvas to have bounds')
  return {
    x: bounds.x + bounds.width * xRatio,
    y: bounds.y + bounds.height * yRatio,
  }
}

async function audioEventCount(page) {
  return page.evaluate(() => window.__primarySpellAudioEvents.length)
}

async function audioEvents(page) {
  return page.evaluate(() => window.__primarySpellAudioEvents)
}

async function waitForAudio(page, eventStart, source, type) {
  const handle = await page.waitForFunction(
    ({ expected, expectedType, start }) => {
      const events = window.__primarySpellAudioEvents.slice(start)
      return events.find((event) => (
        event.type === expectedType
        && window.__primarySpellAudioSourceMatches(event.src, expected)
      )) || null
    },
    { expected: source, expectedType: type, start: eventStart },
    { timeout: 10_000 },
  )
  const result = await handle.jsonValue()
  await handle.dispose()
  return result
}

function watchErrors(page, errors, label) {
  page.on('pageerror', (error) => errors.push({ label, message: error.message, type: 'page' }))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push({ label, message: message.text(), type: 'console' })
    }
  })
}

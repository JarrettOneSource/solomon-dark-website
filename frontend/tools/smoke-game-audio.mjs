import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4178'
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(baseUrl).origin,
        localStorage: [
          { name: 'sdr:muted', value: '1' },
          { name: 'sdr:sfx-muted', value: '1' },
        ],
      }],
    },
    viewport: { width: 1600, height: 900 },
  })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  const failedResponses = []
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack }))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ location: message.location(), text: message.text() })
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() })
    }
  })

  await page.addInitScript(() => {
    const events = []
    let nextChannel = 1
    const NativePlay = HTMLMediaElement.prototype.play
    const NativePause = HTMLMediaElement.prototype.pause
    const sourceMatches = (actual, expected) => {
      const actualName = new URL(actual).pathname.split('/').pop()
      const expectedName = expected.split('/').pop()
      const extensionAt = expectedName.lastIndexOf('.')
      const stem = expectedName.slice(0, extensionAt)
      const extension = expectedName.slice(extensionAt)
      const suffix = actualName.slice(stem.length, -extension.length)
      return actualName === expectedName
        || (actualName.startsWith(`${stem}-`) && actualName.endsWith(extension) && /^-[\w-]+$/.test(suffix))
    }
    HTMLMediaElement.prototype.pause = function () {
      let channelId = Number(this.dataset.audioSmokeChannel)
      if (!channelId) {
        channelId = nextChannel
        nextChannel += 1
        this.dataset.audioSmokeChannel = `${channelId}`
      }
      events.push({
        at: performance.now(),
        channelId,
        currentTime: this.currentTime,
        src: this.src,
        type: 'pause',
      })
      NativePause.call(this)
    }
    HTMLMediaElement.prototype.play = function () {
      let channelId = Number(this.dataset.audioSmokeChannel)
      if (!channelId) {
        channelId = nextChannel
        nextChannel += 1
        this.dataset.audioSmokeChannel = `${channelId}`
      }
      const playEvent = {
        at: performance.now(),
        channelId,
        currentTime: this.currentTime,
        loop: this.loop,
        playbackRate: this.playbackRate,
        semanticFootstepTick: document.querySelector('.boneyard-scene')
          ?.getAttribute('data-last-footstep-tick') ?? null,
        src: this.src,
        type: 'play',
        volume: this.volume,
      }
      events.push(playEvent)
      const playback = NativePlay.call(this)
      void playback.then(
        () => events.push({ ...playEvent, at: performance.now(), type: 'started' }),
        () => {},
      )
      return playback
    }
    Object.defineProperties(window, {
      __gameAudioEvents: { value: events },
      __gameAudioSourceMatches: { value: sourceMatches },
    })
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  const mutePreferences = await page.evaluate(() => ({
    music: localStorage.getItem('sdr:muted'),
    sfx: localStorage.getItem('sdr:sfx-muted'),
  }))
  assert.deepEqual(mutePreferences, { music: '1', sfx: '1' })
  await waitForPlay(page, '/game/audio/music/solomondarktheme.mp3')

  const beforeHover = await playCount(page)
  await page.getByRole('button', { name: 'Play' }).hover()
  await page.waitForTimeout(120)
  assert.equal(await playCount(page), beforeHover, 'Title hover must be silent')

  await page.getByRole('button', { name: 'Play' }).focus()
  await page.keyboard.press('Enter')
  try {
    await waitForPlay(page, '/game/audio/sfx/click.wav')
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      audioEvents: await audioEvents(page),
      consoleErrors,
      pageErrors,
    })}\n`)
    throw error
  }

  const beforeNewGameHover = await playCount(page)
  await page.getByRole('button', { name: 'New Game' }).hover()
  await page.waitForTimeout(120)
  assert.equal(await playCount(page), beforeNewGameHover, 'Play-menu hover must be silent')

  await page.getByRole('button', { name: 'New Game' }).click()
  try {
    await page.locator('.create-menu-scene').waitFor({ timeout: 30_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      consoleErrors,
      fade: await page.locator('.main-menu-screen-fade').evaluateAll((nodes) => nodes.map((node) => ({
        animationName: getComputedStyle(node).animationName,
        className: node.className,
        opacity: getComputedStyle(node).opacity,
      }))),
      pageErrors,
      url: page.url(),
    })}\n`)
    throw error
  }
  await waitForPlay(page, '/game/audio/music/selection.mp3')
  await waitForPlay(page, '/game/audio/sfx/start-cast.wav')
  await waitForPlay(page, '/game/audio/sfx/choose-element.wav')

  const fire = page.getByRole('button', { name: /fire/i })
  await fire.waitFor({ state: 'visible' })
  const beforeFireHover = await playCount(page)
  await fire.hover()
  await page.waitForTimeout(120)
  assert.equal(await playCount(page), beforeFireHover, 'Create element hover must be silent')
  await fire.click()
  await waitForPlay(page, '/game/audio/sfx/pickskill.wav')
  await waitForPlay(page, '/game/audio/sfx/throw-fire.wav')
  await waitForPlayCount(page, '/game/audio/sfx/start-cast.wav', 2)
  await waitForPlayCount(page, '/game/audio/sfx/choose-element.wav', 2)

  const discipline = page.locator('.create-menu-discipline-arcane')
  await discipline.click()
  await waitForPlayCount(page, '/game/audio/sfx/pickskill.wav', 2)
  await waitForPlay(page, '/game/audio/sfx/catchit.wav')
  try {
    await page.getByLabel(/College courtyard/).waitFor({ timeout: 30_000 })
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      body: (await page.locator('body').innerText()).slice(0, 2_000),
      consoleErrors,
      create: await page.locator('.create-menu-scene').evaluateAll((nodes) => nodes.map((node) => ({
        finalizing: node.dataset.finalizing,
        handsReady: node.dataset.handsReady,
        motionSettled: node.dataset.motionSettled,
        phase: node.dataset.phase,
      }))),
      fade: await page.locator('.main-menu-screen-fade').evaluateAll((nodes) => nodes.map((node) => ({
        animationName: getComputedStyle(node).animationName,
        className: node.className,
        opacity: getComputedStyle(node).opacity,
      }))),
      pageErrors,
      rendererState: await page.locator('.hub-scene').getAttribute('data-renderer-state').catch(() => null),
      runtimeStatus: await page.locator('.main-menu-runtime-status').allInnerTexts(),
      visibleButtons: await page.locator('button:visible').evaluateAll((nodes) => nodes.map((node) => (
        node.getAttribute('aria-label') || node.textContent?.trim()
      ))),
      url: page.url(),
    })}\n`)
    throw error
  }
  await waitForPlay(page, '/game/audio/music/academy.mp3')

  const footstepSources = [
    '/game/audio/sfx/step/step1.wav',
    '/game/audio/sfx/step/step2.wav',
  ]
  const stepCountBeforeMovement = footstepEvents(await audioEvents(page), 'play').length
  await page.keyboard.down('d')
  await waitForFootstepCount(page, footstepSources, 'play', stepCountBeforeMovement + 3)
  await page.keyboard.up('d')
  await nextPresentationFrame(page)

  const stepEventsAtRelease = footstepEvents(await audioEvents(page), 'play')
  await waitForFootstepCount(page, footstepSources, 'started', stepCountBeforeMovement + 3)
  const heldStepEvents = stepEventsAtRelease.slice(stepCountBeforeMovement)
  const heldStepStarts = footstepEvents(await audioEvents(page), 'started')
    .slice(stepCountBeforeMovement)
  assert.ok(heldStepEvents.length >= 3, `expected repeated native footsteps, got ${heldStepEvents.length}`)
  assert.ok(heldStepEvents.every((event) => event.volume === 0.5))
  const dispatchIntervalsMs = consecutiveIntervals(heldStepEvents.slice(0, 3))
  const startIntervalsMs = consecutiveIntervals(heldStepStarts.slice(0, 3))
  assertNativeFootstepIntervals(dispatchIntervalsMs, 'dispatch')

  await page.waitForTimeout(350)
  const releaseTailEvents = footstepEvents(await audioEvents(page), 'play')
    .slice(stepEventsAtRelease.length)
  assert.ok(
    releaseTailEvents.length <= 1,
    `native release tail allows at most one phase-dependent step, got ${releaseTailEvents.length}`,
  )
  const stepCountAfterReleaseTail = footstepEvents(await audioEvents(page), 'play').length
  await page.waitForTimeout(700)
  const stepEvents = footstepEvents(await audioEvents(page), 'play')
  assert.equal(
    stepEvents.length,
    stepCountAfterReleaseTail,
    'sub-threshold residual velocity must remain silent after the native release tail',
  )

  // A reused direct host may enter the 14.12-second Teacher cycle at any phase.
  await waitForPlay(page, '/game/audio/sfx/summon.wav', 16_000)
  const summon = (await audioEvents(page)).findLast((event) => (
    event.type === 'play' && sourceMatches(event.src, '/game/audio/sfx/summon.wav')
  ))
  assert.ok(summon)
  assert.ok(summon.volume >= 0.0625 && summon.volume <= 0.25)
  assert.ok(summon.playbackRate >= 1 && summon.playbackRate < 1.1)

  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 30_000,
  })
  await waitForPlay(page, '/game/audio/music/prelude.mp3', 10_000)

  const boneyardStepCountBeforeMovement = footstepEvents(
    await audioEvents(page),
    'play',
  ).length
  await page.keyboard.down('d')
  await waitForFootstepCount(
    page,
    footstepSources,
    'play',
    boneyardStepCountBeforeMovement + 6,
  )
  await page.keyboard.up('d')
  await nextPresentationFrame(page)

  const boneyardStepEventsAtRelease = footstepEvents(await audioEvents(page), 'play')
  await waitForFootstepCount(
    page,
    footstepSources,
    'started',
    boneyardStepCountBeforeMovement + 6,
  )
  const heldBoneyardSteps = boneyardStepEventsAtRelease.slice(
    boneyardStepCountBeforeMovement,
  )
  const heldBoneyardStarts = footstepEvents(await audioEvents(page), 'started')
    .slice(boneyardStepCountBeforeMovement)
  assert.ok(
    heldBoneyardSteps.length >= 6,
    `expected repeated Boneyard footsteps, got ${heldBoneyardSteps.length}`,
  )
  assert.ok(heldBoneyardSteps.every((event) => event.volume === 0.5))
  assert.ok(heldBoneyardSteps.every((event) => event.playbackRate === 1))
  const boneyardSemanticTicks = heldBoneyardSteps
    .slice(0, 6)
    .map((event) => Number(event.semanticFootstepTick))
  assert.ok(boneyardSemanticTicks.every(Number.isSafeInteger))
  assert.deepEqual(
    boneyardSemanticTicks.slice(1).map((tick, index) => (
      tick - boneyardSemanticTicks[index]
    )),
    [25, 25, 25, 25, 25],
  )
  const boneyardDispatchIntervalsMs = consecutiveIntervals(heldBoneyardSteps.slice(0, 6))
  const boneyardStartIntervalsMs = consecutiveIntervals(heldBoneyardStarts.slice(0, 6))
  assertBoneyardFootstepDelivery(boneyardDispatchIntervalsMs)

  await page.waitForTimeout(350)
  const boneyardReleaseTail = footstepEvents(await audioEvents(page), 'play')
    .slice(boneyardStepEventsAtRelease.length)
  assert.ok(
    boneyardReleaseTail.length <= 1,
    `Boneyard native release tail allows at most one step, got ${boneyardReleaseTail.length}`,
  )
  const boneyardStepCountAfterRelease = footstepEvents(
    await audioEvents(page),
    'play',
  ).length
  await page.waitForTimeout(700)
  const allStepEvents = footstepEvents(await audioEvents(page), 'play')
  assert.equal(
    allStepEvents.length,
    boneyardStepCountAfterRelease,
    'Boneyard sub-threshold residual velocity must remain silent',
  )

  const events = await audioEvents(page)
  const playedSources = events
    .filter((event) => event.type === 'play')
    .map((event) => new URL(event.src).pathname)
  const expectedMusic = [
    '/game/audio/music/solomondarktheme.mp3',
    '/game/audio/music/selection.mp3',
    '/game/audio/music/academy.mp3',
    '/game/audio/music/prelude.mp3',
  ]
  const musicSources = playedSources.filter((source) => (
    expectedMusic.some((expected) => sourceMatches(source, expected))
  ))
  assert.ok(musicSources.length >= 3)
  assert.ok(expectedMusic.every((expected) => (
    musicSources.some((source) => sourceMatches(source, expected))
  )))
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(pageErrors, [])

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    mutePreferences,
    musicSources: [...new Set(musicSources)],
    playedSources,
    dispatchIntervalsMs,
    startIntervalsMs,
    stepCount: stepEvents.length,
    boneyard: {
      dispatchIntervalsMs: boneyardDispatchIntervalsMs,
      semanticTicks: boneyardSemanticTicks,
      startIntervalsMs: boneyardStartIntervalsMs,
      stepCount: allStepEvents.length - boneyardStepCountBeforeMovement,
    },
    summon: {
      playbackRate: summon.playbackRate,
      volume: summon.volume,
    },
  })}\n`)
} finally {
  await browser.close()
}

async function audioEvents(page) {
  return page.evaluate(() => window.__gameAudioEvents)
}

async function nextPresentationFrame(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())))
}

async function playCount(page) {
  return page.evaluate(() => window.__gameAudioEvents.filter((event) => event.type === 'play').length)
}

async function waitForPlay(page, source, timeout = 5_000) {
  await page.waitForFunction(
    (expected) => window.__gameAudioEvents.some((event) => (
      event.type === 'play' && window.__gameAudioSourceMatches(event.src, expected)
    )),
    source,
    { timeout },
  )
}

async function waitForFootstepCount(page, sources, type, count, timeout = 5_000) {
  await page.waitForFunction(
    ({ expected, eventType, minimum }) => window.__gameAudioEvents.filter((event) => (
      event.type === eventType
      && expected.some((source) => window.__gameAudioSourceMatches(event.src, source))
    )).length >= minimum,
    { expected: sources, eventType: type, minimum: count },
    { timeout },
  )
}

async function waitForPlayCount(page, source, count, timeout = 5_000) {
  await page.waitForFunction(
    ({ expected, minimum }) => window.__gameAudioEvents.filter((event) => (
      event.type === 'play' && window.__gameAudioSourceMatches(event.src, expected)
    )).length >= minimum,
    { expected: source, minimum: count },
    { timeout },
  )
}

function sourceMatches(actual, expected) {
  const actualName = new URL(actual, baseUrl).pathname.split('/').pop()
  const expectedName = expected.split('/').pop()
  const extensionAt = expectedName.lastIndexOf('.')
  const stem = expectedName.slice(0, extensionAt)
  const extension = expectedName.slice(extensionAt)
  const suffix = actualName.slice(stem.length, -extension.length)
  return actualName === expectedName
    || (actualName.startsWith(`${stem}-`) && actualName.endsWith(extension) && /^-[\w-]+$/.test(suffix))
}

function footstepEvents(events, type) {
  return events.filter((event) => (
    event.type === type
    && (sourceMatches(event.src, '/game/audio/sfx/step/step1.wav')
      || sourceMatches(event.src, '/game/audio/sfx/step/step2.wav'))
  ))
}

function consecutiveIntervals(events) {
  return events.slice(1).map((event, index) => event.at - events[index].at)
}

function assertNativeFootstepIntervals(intervals, label) {
  assert.equal(intervals.length, 2)
  assert.ok(
    intervals.every((interval) => interval >= 150 && interval <= 400),
    `expected 250 ms ${label} cadence, got ${intervals.join(', ')}`,
  )
  const average = intervals.reduce((total, interval) => total + interval, 0) / intervals.length
  assert.ok(
    average >= 200 && average <= 325,
    `expected 250 ms average ${label} cadence, got ${average}`,
  )
}

function assertBoneyardFootstepDelivery(intervals) {
  assert.equal(intervals.length, 5)
  assert.ok(
    intervals.every((interval) => interval >= 0 && interval <= 750),
    `expected bounded Boneyard delivery jitter, got ${intervals.join(', ')}`,
  )
  const average = intervals.reduce((total, interval) => total + interval, 0) / intervals.length
  assert.ok(
    average >= 175 && average <= 325,
    `expected 250 ms average Boneyard delivery cadence, got ${average}`,
  )
}

import assert from 'node:assert/strict'

import { chromium } from 'playwright-core'

const baseUrl = process.env.SDR_GAME_SMOKE_URL || 'http://127.0.0.1:4178'
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
})

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push({ message: error.message, stack: error.stack }))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ location: message.location(), text: message.text() })
    }
  })

  await page.addInitScript(() => {
    const events = []
    let nextChannel = 1
    const NativePlay = HTMLMediaElement.prototype.play
    const NativePause = HTMLMediaElement.prototype.pause
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
      events.push({
        at: performance.now(),
        channelId,
        currentTime: this.currentTime,
        loop: this.loop,
        playbackRate: this.playbackRate,
        src: this.src,
        type: 'play',
        volume: this.volume,
      })
      return NativePlay.call(this)
    }
    Object.defineProperty(window, '__gameAudioEvents', { value: events })
  })

  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 90_000 })
  await waitForPlay(page, '/game/audio/music/solomondarktheme.mp3')

  const beforeHover = await playCount(page)
  await page.getByRole('button', { name: 'Play' }).hover()
  await page.waitForTimeout(120)
  assert.equal(await playCount(page), beforeHover, 'Title hover must be silent')

  await page.getByRole('button', { name: 'Play' }).focus()
  await page.keyboard.press('Enter')
  await waitForPlay(page, '/game/audio/sfx/click.wav')

  const beforeNewGameHover = await playCount(page)
  await page.getByRole('button', { name: 'New Game' }).hover()
  await page.waitForTimeout(120)
  assert.equal(await playCount(page), beforeNewGameHover, 'Play-menu hover must be silent')

  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene').waitFor({ timeout: 15_000 })
  await waitForPlay(page, '/game/audio/music/selection.mp3')
  await waitForPlay(page, '/game/audio/sfx/start-cast.wav')
  await waitForPlay(page, '/game/audio/sfx/choose-element.wav')

  const fire = page.getByRole('button', { name: /Fire/ })
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
  await page.getByLabel(/College courtyard/).waitFor({ timeout: 15_000 })
  await waitForPlay(page, '/game/audio/music/academy.mp3')

  await page.keyboard.down('d')
  await waitForEitherPlay(page, [
    '/game/audio/sfx/step/step1.wav',
    '/game/audio/sfx/step/step2.wav',
  ])
  await page.waitForTimeout(600)
  await page.keyboard.up('d')

  const stepEvents = (await audioEvents(page)).filter((event) => (
    event.type === 'play'
    && (event.src.includes('/game/audio/sfx/step/step1.wav')
      || event.src.includes('/game/audio/sfx/step/step2.wav'))
  ))
  assert.ok(stepEvents.length >= 2, `expected repeated native footsteps, got ${stepEvents.length}`)
  assert.ok(stepEvents.every((event) => event.volume === 0.5))

  await waitForPlay(page, '/game/audio/sfx/summon.wav', 7_000)
  const summon = (await audioEvents(page)).findLast((event) => (
    event.type === 'play' && event.src.includes('/game/audio/sfx/summon.wav')
  ))
  assert.ok(summon)
  assert.ok(summon.volume >= 0.0625 && summon.volume <= 0.25)
  assert.ok(summon.playbackRate >= 1 && summon.playbackRate < 1.1)

  const events = await audioEvents(page)
  const playedSources = events
    .filter((event) => event.type === 'play')
    .map((event) => new URL(event.src).pathname)
  const musicSources = playedSources.filter((source) => source.includes('/audio/music/'))
  assert.ok(musicSources.length >= 3)
  assert.ok(
    musicSources.every((source) => source.includes('/assets/game/audio/music/')),
    `public-site jukebox contaminated /game: ${musicSources.join(', ')}`,
  )
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(pageErrors, [])

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    musicSources: [...new Set(musicSources)],
    playedSources,
    stepCount: stepEvents.length,
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

async function playCount(page) {
  return page.evaluate(() => window.__gameAudioEvents.filter((event) => event.type === 'play').length)
}

async function waitForPlay(page, source, timeout = 5_000) {
  await page.waitForFunction(
    (expected) => window.__gameAudioEvents.some((event) => (
      event.type === 'play' && event.src.includes(expected)
    )),
    source,
    { timeout },
  )
}

async function waitForEitherPlay(page, sources, timeout = 5_000) {
  await page.waitForFunction(
    (expected) => window.__gameAudioEvents.some((event) => (
      event.type === 'play' && expected.some((source) => event.src.includes(source))
    )),
    sources,
    { timeout },
  )
}

async function waitForPlayCount(page, source, count, timeout = 5_000) {
  await page.waitForFunction(
    ({ expected, minimum }) => window.__gameAudioEvents.filter((event) => (
      event.type === 'play' && event.src.includes(expected)
    )).length >= minimum,
    { expected: source, minimum: count },
    { timeout },
  )
}

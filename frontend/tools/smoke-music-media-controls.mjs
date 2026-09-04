import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

import { createGameSimulation, enterBoneyardWorld } from '../src/game/core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const baseUrl = process.env.SDR_MUSIC_SMOKE_URL || 'http://127.0.0.1:5559'
const credential = 'music-media-controls-acceptance'
const host = await startGameHost({
  allowedOrigins: [new URL(baseUrl).origin],
  authentication: { credential, kind: 'shared' },
  resetWhenEmpty: true,
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
  headless: true,
})

const receipts = []
const browserVersion = browser.version()
try {
  for (const worldKind of ['hub', 'boneyard']) receipts.push(await runJourney(worldKind))
} finally {
  await Promise.all([browser.close(), host.close()])
}
console.log(JSON.stringify({ status: 'ok', browser: browserVersion, receipts }))

async function runJourney(worldKind) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  if (process.env.SDR_MUSIC_SMOKE_DEV === '1') {
    await context.route('**/deployment.json?*', route => route.fulfill({
      json: { revision: new URL(route.request().url()).searchParams.get('current') },
    }))
  }
  await context.addInitScript(installGameAudioSmokeProbe)
  await context.addInitScript(runtime => {
    window.solomonDarkRuntime = runtime
    localStorage.setItem('sdr:muted', '1')
    localStorage.setItem('sdr:sfx-muted', '1')
    const nativeSetHandler = MediaSession.prototype.setActionHandler
    window.__musicMediaActions = new Map()
    MediaSession.prototype.setActionHandler = function(action, handler) {
      if (handler) window.__musicMediaActions.set(action, handler)
      else window.__musicMediaActions.delete(action)
      return nativeSetHandler.call(this, action, handler)
    }
  }, { gameEndpoint: { credential, kind: 'localhost', url: host.address.url } })
  const page = await context.newPage()
  const errors = { page: [], console: [], responses: [], requests: [] }
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.requests.push(request.url())
  })
  try {
    await page.route('**/audio-fixture', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }))
    await page.goto(`${baseUrl}/audio-fixture`)
    await writeSave(page, fixtureSave(worldKind))
    await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
    await page.keyboard.press('Shift')
    await waitForOneSong(page, 'solomondarktheme')
    await checkMediaCycles(page)

    await mediaAction(page, 'pause')
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Last game', exact: true }).click()
    await page.locator(`.${worldKind}-scene[data-renderer-state="ready"]`).waitFor({ timeout: 60_000 })
    assert.equal((await audibleMusic(page)).length, 0, 'scene changes must respect media pause')
    await mediaAction(page, 'play')
    await waitForOneSong(page, worldKind === 'hub' ? 'academy' : 'prelude')
    const gameplay = await checkMediaCycles(page)

    await page.evaluate(() => {
      history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.waitForFunction(() => window.__musicMediaActions.size === 0)
    assert.equal((await audibleMusic(page)).length, 0, 'route teardown must silence game music')
    assert.ok((await channels(page)).every(channel => channel.paused && channel.muted && channel.outputVolume === 0))
    await page.evaluate(() => {
      history.pushState(null, '', '/game')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
    await page.keyboard.press('Shift')
    await waitForOneSong(page, 'solomondarktheme')
    await checkMediaCycles(page)
    assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [] })
    return { worldKind, mediaCycles: 18, gameplayTrack: gameplay.src, retainedChannels: (await channels(page)).length, errors }
  } finally {
    await context.close()
  }
}

async function mediaAction(page, action) {
  await page.evaluate(value => {
    const handler = window.__musicMediaActions.get(value)
    if (!handler) throw new Error(`Missing Media Session ${value} handler`)
    handler({ action: value })
  }, action)
}

function channels(page) {
  return page.evaluate(() => window.__sdrAudioMediaChannels())
}

async function audibleMusic(page) {
  return (await channels(page)).filter(channel => !channel.paused && !channel.muted && channel.outputVolume > 0.001)
}

async function waitForOneSong(page, name) {
  await page.waitForFunction(expected => {
    const live = window.__sdrAudioMediaChannels().filter(channel => !channel.paused && !channel.muted && channel.outputVolume > 0.001)
    return live.length === 1 && live[0].src.includes(expected) && live[0].outputVolume > 0.99
  }, name, { timeout: 20_000 })
}

async function checkMediaCycles(page) {
  const initial = await audibleMusic(page)
  assert.equal(initial.length, 1)
  for (let press = 0; press < 6; press += 1) {
    await mediaAction(page, 'pause')
    const before = (await channels(page)).find(channel => channel.channelId === initial[0].channelId)
    await page.keyboard.press('Shift')
    await page.waitForTimeout(100)
    const paused = (await channels(page)).find(channel => channel.channelId === before.channelId)
    assert.equal(paused.paused, true)
    assert.equal(paused.currentTime, before.currentTime, 'ordinary keys cannot rewind or restart paused music')
    assert.equal((await audibleMusic(page)).length, 0)
    assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'paused')
    await mediaAction(page, 'play')
    await page.waitForTimeout(100)
    const resumed = await audibleMusic(page)
    assert.equal(resumed.length, 1)
    assert.equal(resumed[0].channelId, initial[0].channelId)
    assert.ok(resumed[0].currentTime >= before.currentTime)
    assert.equal(await page.evaluate(() => navigator.mediaSession.playbackState), 'playing')
  }
  return initial[0]
}

function fixtureSave(worldKind) {
  let state = createGameSimulation({ owner: { discipline: 'arcane', displayName: 'Audio', element: 'fire' } })
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      economies: state.playerEntities.economies.map(economy => ({ ...economy, collegeIntroPending: false, tutorialPending: false })),
    },
  }
  const loadedBoneyard = worldKind === 'hub' ? null : materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 41))
  if (worldKind === 'boneyard') {
    assert.ok(loadedBoneyard)
    state = enterBoneyardWorld(state, loadedBoneyard)
  }
  return createGameSaveDocument({ integrity: 'local-only', loadedBoneyard, mods: [], modState: {}, playerId: 'owner', state })
}

function writeSave(page, document) {
  return page.evaluate(value => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' })
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put({ document: value, revision: 1, slot: 0 })
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => { open.result.close(); resolve() }
    }
  }), document)
}

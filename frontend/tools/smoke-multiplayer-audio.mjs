import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { createBoneyardCatalog } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const credential = randomBytes(32).toString('base64url')
const vite = await createViteServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error',
  root: frontendRoot,
  server: { host: '127.0.0.1', port: 0 },
})
await vite.listen()
const viteAddress = vite.httpServer?.address()
if (!viteAddress || typeof viteAddress === 'string') {
  await vite.close()
  throw new Error('Vite did not expose its local smoke-test port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  boneyards: createBoneyardCatalog(),
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const browserOptions = {
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
}
const [hostBrowser, guestBrowser] = await Promise.all([
  chromium.launch(browserOptions),
  chromium.launch(browserOptions),
])
const hostPage = await hostBrowser.newPage({ viewport: { width: 800, height: 450 } })
const guestPage = await guestBrowser.newPage({ viewport: { width: 800, height: 450 } })
const pages = [hostPage, guestPage]
const errors = { console: [], page: [] }

for (const page of pages) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('pageerror', (error) => errors.page.push(error.message))
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
  await installAudioProbe(page)
}

try {
  await enterHub(hostPage, 'Earth')
  await enterHub(guestPage, 'Fire')
  await Promise.all(pages.map((page) => waitForPlayers(page, 2)))

  const academy = '/game/audio/music/academy.mp3'
  assert.equal((await startsFor(hostPage, academy, 'media')).length, 1)
  assert.equal((await startsFor(guestPage, academy, 'media')).length, 1)

  await clearEvents(pages)
  await moveAndSettle(guestPage, 'd', 1_050)
  await Promise.all(pages.map((page) => waitForFootsteps(page, 3)))
  await guestPage.waitForTimeout(800)
  const hostHubSteps = await footstepStarts(hostPage)
  const guestHubSteps = await footstepStarts(guestPage)
  assertSynchronizedFootsteps(hostHubSteps, guestHubSteps, 'Hub')

  await hostPage.getByRole('button', { name: 'Enter the Boneyard' }).click()
  await Promise.all(pages.map(waitForBoneyard))
  const prelude = '/music/prelude.mp3'
  assert.equal((await startsFor(hostPage, prelude, 'media')).length, 1)
  assert.equal((await startsFor(guestPage, prelude, 'media')).length, 1)

  await clearEvents(pages)
  await moveAndSettle(guestPage, 'd', 1_050)
  await Promise.all(pages.map((page) => waitForFootsteps(page, 3)))
  await guestPage.waitForTimeout(800)
  const hostBoneyardSteps = await footstepStarts(hostPage)
  const guestBoneyardSteps = await footstepStarts(guestPage)
  assertSynchronizedFootsteps(hostBoneyardSteps, guestBoneyardSteps, 'Boneyard')

  await clearEvents(pages)
  await castFire(guestPage)
  const throwFire = '/game/audio/sfx/throw-fire.wav'
  await Promise.all(pages.map((page) => waitForStarts(page, throwFire, 1)))
  await guestPage.waitForTimeout(500)
  const hostCast = await startsFor(hostPage, throwFire, 'buffer')
  const guestCast = await startsFor(guestPage, throwFire, 'buffer')
  assert.equal(hostCast.length, 1, 'host must consume the remote Fire emission once')
  assert.equal(guestCast.length, 1, 'guest must consume its Fire emission once')

  await clearEvents(pages)
  await beginEarthCast(hostPage)
  const gatherRocks = '/game/audio/sfx/gather-rocks-loop.wav'
  await Promise.all(pages.map((page) => waitForBufferEvents(
    page,
    gatherRocks,
    'buffer-start',
    1,
  )))
  const hostGather = await startsFor(hostPage, gatherRocks, 'buffer')
  const guestGather = await startsFor(guestPage, gatherRocks, 'buffer')
  assert.equal(hostGather.length, 1)
  assert.equal(guestGather.length, 1)
  assert.equal(hostGather[0].loop, true)
  assert.equal(guestGather[0].loop, true)
  await hostPage.waitForTimeout(500)
  await hostPage.mouse.up({ button: 'left' })
  await Promise.all(pages.map((page) => waitForBufferEvents(
    page,
    gatherRocks,
    'buffer-stop',
    1,
  )))
  const rollingStone = '/game/audio/sfx/rolling-stone-loop.wav'
  await Promise.all(pages.map((page) => waitForBufferEvents(
    page,
    rollingStone,
    'buffer-start',
    1,
  )))
  const hostRolling = await startsFor(hostPage, rollingStone, 'buffer')
  const guestRolling = await startsFor(guestPage, rollingStone, 'buffer')
  assert.equal(hostRolling.length, 1)
  assert.equal(guestRolling.length, 1)
  assert.equal(hostRolling[0].loop, true)
  assert.equal(guestRolling[0].loop, true)
  const hostGatherStops = await bufferEventsFor(hostPage, gatherRocks, 'buffer-stop')
  const guestGatherStops = await bufferEventsFor(guestPage, gatherRocks, 'buffer-stop')
  assert.equal(hostGatherStops[0].channelId, hostGather[0].channelId)
  assert.equal(guestGatherStops[0].channelId, guestGather[0].channelId)

  for (const page of pages) {
    const mediaEffects = (await allEvents(page)).filter((event) => (
      event.type === 'play'
      && !isMusicSource(event.src)
    ))
    assert.deepEqual(mediaEffects, [])
  }
  assert.deepEqual(errors, { console: [], page: [] })

  process.stdout.write(`${JSON.stringify({
    status: 'ok',
    errors,
    hub: synchronizedFootstepReceipt(hostHubSteps, guestHubSteps),
    boneyard: synchronizedFootstepReceipt(hostBoneyardSteps, guestBoneyardSteps),
    fire: {
      guestVolume: guestCast[0].volume,
      hostVolume: hostCast[0].volume,
    },
    earth: {
      gatherStops: [hostGatherStops.length, guestGatherStops.length],
      gatherVolumes: [hostGather[0].volume, guestGather[0].volume],
      rollingVolumes: [hostRolling[0].volume, guestRolling[0].volume],
    },
    music: { academy, prelude },
  })}\n`)
} finally {
  await Promise.all([
    hostBrowser.close(),
    guestBrowser.close(),
    host.close(),
    vite.close(),
  ])
}

async function installAudioProbe(page) {
  await page.addInitScript(installGameAudioSmokeProbe, {
    eventsGlobal: '__multiplayerAudioEvents',
  })
}

async function enterHub(page, element) {
  await page.bringToFront()
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({
    timeout: 45_000,
  })
  await page.getByRole('button', { name: new RegExp(element, 'i') }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor({
    timeout: 15_000,
  })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
}

async function waitForPlayers(page, expected) {
  await page.waitForFunction((count) => (
    document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.playerCount === count
  ), expected, { timeout: 30_000 })
}

async function waitForBoneyard(page) {
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({
    timeout: 90_000,
  })
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerCount === 2
  ), undefined, { timeout: 30_000 })
}

async function moveAndSettle(page, key, durationMs) {
  await page.bringToFront()
  await page.keyboard.down(key)
  await page.waitForTimeout(durationMs)
  await page.keyboard.up(key)
}

async function castFire(page) {
  await page.bringToFront()
  const canvas = page.locator('.boneyard-world-canvas')
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected a Boneyard canvas for Fire casting')
  await page.mouse.move(
    bounds.x + bounds.width * 0.7,
    bounds.y + bounds.height * 0.4,
  )
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(40)
  await page.mouse.up({ button: 'left' })
}

async function beginEarthCast(page) {
  await page.bringToFront()
  const canvas = page.locator('.boneyard-world-canvas')
  const bounds = await canvas.boundingBox()
  assert.ok(bounds, 'expected a Boneyard canvas for Earth casting')
  await page.mouse.move(
    bounds.x + bounds.width * 0.7,
    bounds.y + bounds.height * 0.4,
  )
  await page.mouse.down({ button: 'left' })
}

async function clearEvents(pagesToClear) {
  await Promise.all(pagesToClear.map((page) => page.evaluate(() => {
    window.__multiplayerAudioEvents.length = 0
  })))
}

async function allEvents(page) {
  return page.evaluate(() => structuredClone(window.__multiplayerAudioEvents))
}

async function startsFor(page, expected, kind = 'either') {
  return (await allEvents(page)).filter((event) => (
    (kind === 'either'
      ? event.type === 'buffer-start' || event.type === 'play'
      : kind === 'buffer'
        ? event.type === 'buffer-start'
        : event.type === 'play')
    && sourceMatches(event.src, expected)
  ))
}

async function bufferEventsFor(page, expected, type) {
  return (await allEvents(page)).filter((event) => (
    event.type === type && sourceMatches(event.src, expected)
  ))
}

async function waitForStarts(page, source, count) {
  return waitForBufferEvents(page, source, 'buffer-start', count)
}

async function waitForBufferEvents(page, source, type, count) {
  await page.waitForFunction(({ expected, minimum, type: expectedType }) => (
    window.__multiplayerAudioEvents.filter((event) => (
      event.type === expectedType
      && (() => {
        const actualName = new URL(event.src, location.href).pathname.split('/').pop()
        const expectedName = expected.split('/').pop()
        const extensionAt = expectedName.lastIndexOf('.')
        const stem = expectedName.slice(0, extensionAt)
        const extension = expectedName.slice(extensionAt)
        const suffix = actualName.slice(stem.length, -extension.length)
        return actualName === expectedName
          || (actualName.startsWith(`${stem}-`)
            && actualName.endsWith(extension)
            && /^-[\w-]+$/.test(suffix))
      })()
    )).length >= minimum
  ), { expected: source, minimum: count, type }, { timeout: 10_000 })
}

async function waitForFootsteps(page, count) {
  await page.waitForFunction((minimum) => (
    window.__multiplayerAudioEvents.filter((event) => (
      event.type === 'buffer-start'
      && /\/step[12](?:-[\w-]+)?\.wav(?:$|[?#])/i.test(event.src)
    )).length >= minimum
  ), count, { timeout: 10_000 })
}

async function footstepStarts(page) {
  return (await allEvents(page)).filter((event) => (
    event.type === 'buffer-start'
    && (/step1(?:-[\w-]+)?\.wav(?:$|[?#])/i.test(event.src)
      || /step2(?:-[\w-]+)?\.wav(?:$|[?#])/i.test(event.src))
  ))
}

function assertSynchronizedFootsteps(hostSteps, guestSteps, scene) {
  assert.ok(hostSteps.length >= 3, `${scene} host must hear remote footsteps`)
  assert.equal(hostSteps.length, guestSteps.length, `${scene} clients must consume equal events`)
  assert.deepEqual(
    hostSteps.map((event) => audioBasename(event.src)),
    guestSteps.map((event) => audioBasename(event.src)),
    `${scene} clients must select the same replicated footstep cues`,
  )
  assert.ok(guestSteps.every((event) => event.volume === 0.5))
  assert.ok(hostSteps.every((event) => event.volume >= 0.125 && event.volume <= 0.5))
}

function synchronizedFootstepReceipt(hostSteps, guestSteps) {
  return {
    count: hostSteps.length,
    cues: hostSteps.map((event) => audioBasename(event.src)),
    guestVolumes: guestSteps.map((event) => event.volume),
    hostVolumes: hostSteps.map((event) => event.volume),
  }
}

function sourceMatches(actual, expected) {
  const actualName = audioBasename(actual)
  const expectedName = audioBasename(expected)
  const extensionAt = expectedName.lastIndexOf('.')
  const stem = expectedName.slice(0, extensionAt)
  const extension = expectedName.slice(extensionAt)
  const suffix = actualName.slice(stem.length, -extension.length)
  return actualName === expectedName
    || (actualName.startsWith(`${stem}-`) && actualName.endsWith(extension) && /^-[\w-]+$/.test(suffix))
}

function audioBasename(source) {
  return new URL(source, baseUrl).pathname.split('/').pop()
}

function isMusicSource(source) {
  return ['academy.mp3', 'prelude.mp3', 'selection.mp3', 'solomondarktheme.mp3']
    .some((expected) => sourceMatches(source, expected))
}

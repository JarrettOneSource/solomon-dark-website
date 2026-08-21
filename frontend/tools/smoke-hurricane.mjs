import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { getPlayerEconomy } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerEconomy } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const screenshotPath = process.env.SDR_HURRICANE_SMOKE_SCREENSHOT
  || '/tmp/solomon-dark-hurricane.png'
const credential = randomBytes(32).toString('base64url')
const pageErrors = []
const consoleErrors = []
const networkErrors = []

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
  throw new Error('Vite did not expose its Hurricane smoke-test port')
}
const baseUrl = `http://127.0.0.1:${viteAddress.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  snapshotRate: 100,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || defaultChromePath(),
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'failed'
    if (
      errorText === 'net::ERR_ABORTED'
      && /\/assets\/music\/(combat|death)\.mp3$/.test(new URL(request.url()).pathname)
    ) return
    networkErrors.push(`${request.url()}: ${errorText}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript((runtime) => {
    window.solomonDarkRuntime = runtime
  }, {
    gameEndpoint: {
      credential,
      kind: 'localhost',
      url: host.address.url,
    },
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(() => {
    const nativeParse = JSON.parse
    const hurricaneFrames = []
    Object.defineProperty(window, '__sdrHurricaneFrames', { value: hurricaneFrames })
    JSON.parse = function (...args) {
      const message = nativeParse.apply(this, args)
      const frame = message?.type === 'server-welcome'
        ? message.snapshot
        : message?.type === 'server-snapshot'
          ? message.frame
          : null
      if (frame?.primarySpells?.transients) {
        const hurricanes = frame.primarySpells.transients.filter((actor) => (
          actor.kind === 'air-hurricane'
        ))
        hurricaneFrames.push({ hurricanes, tick: frame.tick })
        if (hurricaneFrames.length > 2_000) hurricaneFrames.shift()
      }
      return message
    }
  })

  await enterAirHub(page, baseUrl)
  const scene = page.locator('.hub-scene[data-renderer-state="ready"]')
  const canvas = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 30_000 })
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  learnHurricane(host.state(), playerId)
  assert.equal(
    host.state().playerEntities.skillRuntimes[
      host.state().playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
    ]?.hurricaneEnabled,
    true,
  )

  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.42)
  await page.mouse.down({ button: 'left' })
  let active
  try {
    const handle = await page.waitForFunction(() => {
      const frames = window.__sdrHurricaneFrames
      for (let index = frames.length - 1; index >= 0; index -= 1) {
        const hurricane = frames[index].hurricanes[0]
        if (hurricane?.charge >= 0.5 && hurricane.contactCharge > 0) {
          return { ...frames[index], hurricane }
        }
      }
      return null
    }, undefined, { timeout: 15_000 })
    active = await handle.jsonValue()
    assert.equal(active.hurricane.kind, 'air-hurricane')
    assert.equal(active.hurricane.enhancedEffects, true)
    assert.equal(active.hurricane.damageMinimum, 10)
    assert.equal(active.hurricane.damageMaximum, 20)
    assert.equal(active.hurricane.lanes.length, 8)
    assert.ok(active.hurricane.phaseDegrees > 0)
    assert.ok(active.hurricane.contactCharge <= active.hurricane.charge)
    assert.ok(active.hurricane.charge - active.hurricane.contactCharge <= 0.0016)
    await page.waitForFunction(() => (
      document.querySelector('.hub-world-canvas')
        ?.__sdrHubFrame?.primarySpellKinds?.includes('air-hurricane')
      && window.__sdrAudioEvents?.some((event) => (
        event.type === 'buffer-start'
        && event.loop === true
        && window.__sdrAudioSourceMatches(event.src, 'steady-wind-loop.wav')
        && event.volume > 0
      ))
    ), undefined, { timeout: 10_000 })
    assert.deepEqual(await canvas.evaluate((node) => ({
      height: node.height,
      webgl2: node.getContext('webgl2') instanceof WebGL2RenderingContext,
      width: node.width,
    })), { height: 900, webgl2: true, width: 1600 })
    await page.screenshot({ path: screenshotPath })
  } finally {
    await page.mouse.up({ button: 'left' })
  }

  await page.waitForFunction(() => (
    !document.querySelector('.hub-world-canvas')
      ?.__sdrHubFrame?.primarySpellKinds?.includes('air-hurricane')
    && window.__sdrAudioEvents?.some((event) => (
      event.type === 'buffer-stop'
      && window.__sdrAudioSourceMatches(event.src, 'steady-wind-loop.wav')
    ))
  ), undefined, { timeout: 10_000 })
  assert.equal(await scene.getAttribute('data-gameplay-input-blocked'), 'false')
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(networkErrors, [])
  process.stdout.write(`${JSON.stringify({
    activeTick: active.tick,
    charge: active.hurricane.charge,
    consoleErrors,
    contactCharge: active.hurricane.contactCharge,
    damageRange: [active.hurricane.damageMinimum, active.hurricane.damageMaximum],
    lanes: active.hurricane.lanes.length,
    networkErrors,
    pageErrors,
    phaseDegrees: active.hurricane.phaseDegrees,
    protocol: 45,
    screenshotPath,
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

async function enterAirHub(page, baseUrl) {
  await page.goto(`${baseUrl}/game`, { timeout: 90_000, waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 180_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'New Game' }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]')
    .waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: /Air/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 30_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90_000 })
}

function learnHurricane(state, playerId) {
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const sourceBook = state.playerEntities.skillBooks[index]
  const permanentRanks = [...sourceBook.permanentRanks]
  const effectiveRanks = [...sourceBook.effectiveRanks]
  permanentRanks[29] = 1
  effectiveRanks[29] = 1
  const skillBooks = [...state.playerEntities.skillBooks]
  const progressions = [...state.playerEntities.progressions]
  skillBooks[index] = {
    ...sourceBook,
    effectiveRanks,
    learnedSkillOrder: sourceBook.learnedSkillOrder.includes(29)
      ? sourceBook.learnedSkillOrder
      : [...sourceBook.learnedSkillOrder, 29],
    permanentRanks,
  }
  progressions[index] = {
    ...progressions[index],
    revision: progressions[index].revision + 1,
  }
  Object.assign(state, {
    ...state,
    playerEntities: replacePlayerEconomy({
      ...state.playerEntities,
      progressions,
      skillBooks,
    }, playerId, getPlayerEconomy(state, playerId)),
  })
}

function defaultChromePath() {
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  }
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  }
  return '/usr/bin/google-chrome'
}

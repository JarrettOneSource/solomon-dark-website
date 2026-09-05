import assert from 'node:assert/strict'
import { enterElementHub, enterBoneyard, openBoneyardCombat } from './game-smoke-navigation.mjs'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { createServer as createViteServer } from 'vite'

import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { grantPlayerEntitySkillRanks } from '../src/game/core-server/player-entity-store.ts'
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
      && (
        /\/assets\/music\/(combat|death)\.mp3$/.test(new URL(request.url()).pathname)
        || new URL(request.url()).pathname === '/deployment.json'
      )
    ) return
    networkErrors.push(`${request.url()}: ${errorText}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  await page.route('**/api/mods?**', (route) => route.fulfill({
    body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/api/game/parties', (route) => route.fulfill({
    body: JSON.stringify({ items: [] }),
    contentType: 'application/json',
    status: 200,
  }))
  await page.route('**/deployment.json*', (route) => {
    const current = new URL(route.request().url()).searchParams.get('current') || 'local'
    return route.fulfill({
      body: JSON.stringify({ revision: current }),
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      status: 200,
    })
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

  await enterElementHub(page, baseUrl, 'Air')
  await enterBoneyard(page)
  const scene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 90_000 })
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  await openBoneyardCombat(host, playerId)
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
      document.querySelector('.boneyard-world-canvas')
        ?.__sdrBoneyardFrame?.primarySpellKinds?.includes('air-hurricane')
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
  } catch (error) {
    const state = host.state()
    const playerIndex = state.playerEntities.identities.findIndex(({ playerId: id }) => (
      id === playerId
    ))
    const browserDiagnostics = await page.evaluate(() => {
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      return {
        frame: frame ? {
          gameplayInputBlocked: document.querySelector('.hub-scene')
            ?.getAttribute('data-gameplay-input-blocked'),
          primarySpellKinds: frame.primarySpellKinds,
          tick: frame.tick,
        } : null,
        hurricaneFrames: window.__sdrHurricaneFrames.slice(-5),
      }
    })
    throw new Error(`Hurricane activation stalled: ${JSON.stringify({
      browser: browserDiagnostics,
      primaryCast: state.playerEntities.primaryCasts[playerIndex],
      skillRuntime: state.playerEntities.skillRuntimes[playerIndex],
      transients: state.primarySpells.transients.map(({ id, kind }) => ({ id, kind })),
      world: state.world.kind,
    })}`, { cause: error })
  } finally {
    await page.mouse.up({ button: 'left' })
  }

  await page.waitForFunction(() => (
    !document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame?.primarySpellKinds?.includes('air-hurricane')
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
    protocol: GAME_PROTOCOL_VERSION,
    screenshotPath,
    status: 'ok',
  })}\n`)
} finally {
  await browser.close()
  await host.close()
  await vite.close()
}

function learnHurricane(state, playerId) {
  let store = state.playerEntities
  let rng = createNativeRng(42)
  const index = store.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  for (const [skillId, rank] of [[29, 1], [56, 4], [64, 2]]) {
    const current = store.skillBooks[index].permanentRanks[skillId]
    if (current >= rank) continue
    const granted = grantPlayerEntitySkillRanks(store, playerId, skillId, rank - current, rng)
    store = granted.store
    rng = granted.rng
  }
  const progressions = [...store.progressions]
  progressions[index] = {
    ...progressions[index],
    currentHealth: progressions[index].maximumHealth,
    currentMana: progressions[index].maximumMana,
  }
  Object.assign(state, { playerEntities: { ...store, progressions } })
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

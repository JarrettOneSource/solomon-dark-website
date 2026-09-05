import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { grantPlayerEntitySkillRanks, setPlayerEntityMana } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { GAME_PROTOCOL_VERSION } from '../src/game/protocol/game-protocol.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'
import { enterElementHub, enterBoneyard, openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_HARDEN_SMOKE_OUTPUT || '/tmp/solomon-harden-acceptance'
await mkdir(output, { recursive: true })
const credential = randomBytes(32).toString('base64url')
const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const server = await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', root: frontendRoot, preview: { host: '127.0.0.1', port: 0 },
})
const address = server.httpServer.address()
assert.ok(address && typeof address !== 'string')
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl], authentication: { kind: 'shared', credential }, snapshotRate: 100,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const pageErrors = []
const consoleErrors = []
const networkErrors = []

try {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) networkErrors.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'failed'
    const path = new URL(request.url()).pathname
    if (failure === 'net::ERR_ABORTED' && (/\/assets\/.*(?:combat|death).*\.mp3$/.test(path)
      || path === '/deployment.json')) return
    networkErrors.push(`${request.url()}: ${failure}`)
  })
  await page.route('**/api/mods?**', (route) => route.fulfill({
    body: JSON.stringify({ items: [], page: 1, pageSize: 50, total: 0 }), contentType: 'application/json',
  }))
  await page.route('**/api/game/parties', (route) => route.fulfill({
    body: JSON.stringify({ items: [] }), contentType: 'application/json',
  }))
  await page.route('**/deployment.json*', (route) => route.fulfill({
    body: JSON.stringify({ revision: new URL(route.request().url()).searchParams.get('current') || 'local' }),
    contentType: 'application/json', headers: { 'cache-control': 'no-store' },
  }))
  await page.addInitScript((runtime) => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { credential, kind: 'localhost', url: host.address.url },
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  await page.addInitScript(() => {
    const programs = new WeakMap()
    const locations = new WeakMap()
    const modes = new Map()
    let nextProgramId = 1
    const prototype = WebGL2RenderingContext.prototype
    const getLocation = prototype.getUniformLocation
    const uniform = prototype.uniform1f
    prototype.getUniformLocation = function (program, name) {
      const location = getLocation.call(this, program, name)
      if (location && name === 'uIgnoreTextureColor') {
        if (!programs.has(program)) programs.set(program, nextProgramId++)
        locations.set(location, programs.get(program))
      }
      return location
    }
    prototype.uniform1f = function (location, value) {
      const id = locations.get(location)
      if (id !== undefined) modes.set(id, value)
      return uniform.call(this, location, value)
    }
    window.__sdrHardenGpuModes = modes
  })
  await enterElementHub(page, baseUrl, 'Water')
  await enterBoneyard(page)
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  await openBoneyardCombat(host, playerId)
  prepareLoadout(host.state(), playerId)
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 90_000 })
  const bounds = await canvas.boundingBox()
  assert.ok(bounds)
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.35)
  await page.screenshot({ path: `${output}/idle.png` })
  await page.mouse.down({ button: 'left' })
  await waitUntil(() => hardenState(host, playerId).coating === 1, 'Harden did not reach full coating', 10_000)
  await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')
    ?.__sdrBoneyardFrame?.playerHardenLayerCount === 3, undefined, { timeout: 15_000 })
  await page.waitForFunction(() => window.__sdrAudioEvents.some((event) => event.type === 'buffer-start'
    && window.__sdrAudioSourceMatches(event.src, 'harden.wav') && event.volume > 0),
  undefined, { timeout: 10_000 })
  const active = { ...hardenState(host, playerId) }
  await page.screenshot({ path: `${output}/coated.png` })
  await page.keyboard.down('d')
  await page.waitForTimeout(250)
  await page.keyboard.up('d')
  await page.screenshot({ path: `${output}/coated-moving.png` })
  await page.mouse.up({ button: 'left' })
  await waitUntil(() => hardenState(host, playerId).coating === 0, 'Harden survived release', 5_000)
  await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame?.playerHardenLayerCount === 0 && frame.primarySpellKinds?.includes('harden-shard')
  }, undefined, { timeout: 10_000 })
  assert.equal(hardenState(host, playerId).armor, 0)
  await page.waitForFunction(() => [...window.__sdrHardenGpuModes.values()].every((mode) => mode === 0),
    undefined, { timeout: 5_000 })
  await page.screenshot({ path: `${output}/shattered.png` })
  await page.waitForFunction(() => window.__sdrAudioEvents.some((event) => event.type === 'buffer-start'
    && window.__sdrAudioSourceMatches(event.src, 'ice-shatter.wav') && event.volume > 0),
  undefined, { timeout: 10_000 })
  const refreshed = host.state()
  const refreshedIndex = refreshed.playerEntities.identities.findIndex((identity) => identity.playerId === playerId)
  Object.assign(refreshed, { playerEntities: setPlayerEntityMana(
    refreshed.playerEntities, playerId, refreshed.playerEntities.progressions[refreshedIndex].maximumMana,
  ) })
  await page.mouse.down({ button: 'left' })
  await waitUntil(() => hardenState(host, playerId).coating >= 0.5, 'Harden did not re-form', 8_000)
  const shattersBeforeWeak = await page.evaluate(() => window.__sdrAudioEvents.filter((event) => (
    event.type === 'buffer-start' && window.__sdrAudioSourceMatches(event.src, 'ice-shatter.wav')
  )).length)
  const state = host.state()
  Object.assign(state, { playerEntities: setPlayerEntityMana(state.playerEntities, playerId, 0) })
  await waitUntil(() => hardenState(host, playerId).coating === 0, 'Weak Water retained Harden', 5_000)
  await page.waitForFunction((previousCount) => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.playerHardenLayerCount === 0
    && window.__sdrAudioEvents.filter((event) => event.type === 'buffer-start'
      && window.__sdrAudioSourceMatches(event.src, 'ice-shatter.wav')).length > previousCount
  ), shattersBeforeWeak, { timeout: 5_000 })
  await page.mouse.up({ button: 'left' })
  const sounds = await page.evaluate(() => window.__sdrAudioEvents.filter((event) => event.type === 'buffer-start'
    && (window.__sdrAudioSourceMatches(event.src, 'harden.wav')
      || window.__sdrAudioSourceMatches(event.src, 'ice-shatter.wav')))
    .map(({ src, playbackRate, volume }) => ({ src, playbackRate, volume })))
  assert.ok(sounds.some(({ playbackRate }) => Math.abs(playbackRate - 0.8) < 1e-6))
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors, [])
  assert.deepEqual(networkErrors, [])
  const gpuModes = await page.evaluate(() => [...window.__sdrHardenGpuModes.values()])
  assert.ok(gpuModes.length > 0)
  assert.ok(gpuModes.every((mode) => mode === 0))
  const receipt = { active, build: 'production', consoleErrors, gpuModes, networkErrors, pageErrors,
    protocol: GAME_PROTOCOL_VERSION, releaseArmor: 0, sounds, status: 'ok', viewport: [1920, 1080], weakCoating: 0 }
  await writeFile(`${output}/receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` })
  process.stderr.write(`${JSON.stringify({ consoleErrors, networkErrors, pageErrors,
    world: host.state().world.kind, harden: host.state().playerEntities.skillRuntimes.map(({ harden }) => harden) })}\n`)
  throw error
} finally {
  await page.mouse.up({ button: 'left' }).catch(() => {})
  await browser.close()
  await host.close()
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()))
}

function hardenState(host, playerId) {
  const state = host.state()
  const index = state.playerEntities.identities.findIndex((identity) => identity.playerId === playerId)
  assert.notEqual(index, -1)
  return state.playerEntities.skillRuntimes[index].harden
}

function prepareLoadout(state, playerId) {
  let store = state.playerEntities
  let rng = createNativeRng(42)
  for (const [skillId, rank] of [[32, 8], [33, 2], [34, 2], [36, 2], [56, 4], [64, 2]]) {
    const index = store.identities.findIndex((identity) => identity.playerId === playerId)
    const current = store.skillBooks[index].permanentRanks[skillId]
    if (current >= rank) continue
    const granted = grantPlayerEntitySkillRanks(store, playerId, skillId, rank - current, rng)
    store = granted.store
    rng = granted.rng
  }
  const index = store.identities.findIndex((identity) => identity.playerId === playerId)
  const progressions = [...store.progressions]
  progressions[index] = { ...progressions[index], currentHealth: progressions[index].maximumHealth,
    currentMana: progressions[index].maximumMana }
  Object.assign(state, { playerEntities: { ...store, progressions } })
}

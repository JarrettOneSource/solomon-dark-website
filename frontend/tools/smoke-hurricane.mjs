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

  await enterAirHub(page, baseUrl)
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
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: 'New Game' }).click()
  await enterCreateAfterCollegeOffice(page)
  await declineTutorialOffer(page)
  await page.getByRole('button', { name: /Air/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]')
    .waitFor({ timeout: 30_000 })
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]')
    .waitFor({ timeout: 90_000 })
  await page.locator('.match-loading-screen').waitFor({ state: 'detached', timeout: 90_000 })
}

async function enterBoneyard(page) {
  await page.getByRole('button', { name: 'Enter the Boneyard' }).click()
  const scene = page.locator('.boneyard-scene[data-renderer-state="ready"]')
  const picker = page.locator('.hub-boneyard-picker')
  await Promise.race([
    scene.waitFor({ timeout: 90_000 }),
    picker.waitFor({ timeout: 90_000 }),
  ])
  if (await picker.isVisible()) {
    const option = page.locator('.hub-boneyard-option').first()
    await option.waitFor({ timeout: 30_000 })
    await option.click()
  }
  await scene.waitFor({ timeout: 90_000 })
}

async function openBoneyardCombat(host, playerId) {
  const state = host.state()
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')) return
  const index = state.playerEntities.identities.findIndex(({ playerId: id }) => id === playerId)
  assert.notEqual(index, -1)
  const solomon = state.world.encounter?.position
  assert.ok(solomon, 'Hurricane acceptance requires the authentic Solomon encounter')
  setHostPlayerPosition(host, index, solomon)
  await waitUntil(() => {
    const current = host.state()
    return current.world.kind === 'boneyard' && current.world.encounter?.phase === 'speaking'
  }, 'Solomon did not enter the speaking phase', 10_000)
  setHostPlayerPosition(host, index, { x: solomon.x, y: solomon.y + 250 })
  await waitUntil(() => {
    const current = host.state()
    return current.world.kind === 'boneyard'
      && (current.world.encounter?.runEventId ?? 0) > 0
      && current.world.enemies.actors.some(({ lifeState }) => lifeState === 'alive')
  }, 'Solomon did not release the opening combat wave', 30_000)
}

function setHostPlayerPosition(host, index, position) {
  const state = host.state()
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = {
    ...locomotions[index],
    position: { ...position },
    velocity: { x: 0, y: 0 },
  }
  Object.assign(state, {
    playerEntities: {
      ...state.playerEntities,
      locomotions: Object.freeze(locomotions),
    },
  })
}

async function waitUntil(predicate, message, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(message)
}

async function declineTutorialOffer(page) {
  const offer = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (!await offer.isVisible()) return
  await offer.getByRole('button', { exact: true, name: 'NO' }).click()
  await offer.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function enterCreateAfterCollegeOffice(page) {
  const create = page.locator('.create-menu-scene[data-motion-settled="true"]')
  const office = page.locator('.hub-scene[data-hub-region="office"][data-story-office="true"]')
  const first = await Promise.race([
    create.waitFor({ timeout: 90_000 }).then(() => 'create'),
    office.waitFor({ timeout: 90_000 }).then(() => 'office'),
  ])
  if (first === 'create') return

  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.hub-world-canvas')
    return canvas?.getAttribute('data-hub-region') === 'office'
      && canvas?.getAttribute('data-transition-phase') === 'none'
  }, undefined, { timeout: 30_000 })
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await completeCollegeIntroDialogue(page)
  await moveHubAxis(page, 'a', 'playerX', 300, 'at-most')
  await moveHubAxis(page, 's', 'playerY', 800, 'at-least')
  await moveHubAxis(page, 'd', 'playerX', 540, 'at-least')
  await page.keyboard.down('s')
  try {
    await create.waitFor({ timeout: 30_000 })
  } finally {
    await page.keyboard.up('s')
  }
}

async function completeCollegeIntroDialogue(page) {
  const dialog = page.getByRole('dialog', { name: 'Talking to The Archchancellor' })
  if (!await dialog.isVisible()) {
    await page.keyboard.press('e')
    await dialog.waitFor({ timeout: 15_000 })
  }
  await dialog.getByRole('button', { name: 'Skip' }).click()
  for (const label of ['Solomon Dark?', 'Collateral Damage?', 'Assistance?']) {
    await dialog.getByRole('button', { exact: true, name: label }).click()
    await dialog.getByRole('button', { name: 'Skip' }).click()
  }
  await dialog.getByRole('button', { exact: true, name: 'Done' }).click()
  await dialog.getByRole('button', { name: 'Skip' }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
}

async function moveHubAxis(page, key, axis, target, direction) {
  await page.locator('.main-menu-page[data-hub-player-activity="none"]')
    .waitFor({ timeout: 30_000 })
  await page.keyboard.down(key)
  try {
    await page.waitForFunction(({ axis, direction, target }) => {
      const value = document.querySelector('.hub-world-canvas')?.__sdrHubFrame?.[axis]
      return typeof value === 'number'
        && (direction === 'at-least' ? value >= target : value <= target)
    }, { axis, direction, target }, { timeout: 15_000 })
  } finally {
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
  }
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
    currentHealth: 1_000_000,
    currentMana: 10_000,
    maximumHealth: 1_000_000,
    maximumMana: 10_000,
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

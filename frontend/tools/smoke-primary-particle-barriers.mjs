import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

import { waterFrostJetPlan } from '../src/game/core-kernels/primary-spell-water.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { grantPlayerEntitySkillRanks } from '../src/game/core-server/player-entity-store.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const screenshotRoot = process.env.SDR_PARTICLE_BARRIER_SCREENSHOTS
  || '/tmp/solomon-primary-particle-barriers'
const credential = randomBytes(32).toString('base64url')
const scene = {
  bounds: { x: 0, y: 0, w: 3000, h: 2400 },
  environmentMode: 2,
  fences: [{
    eid: 'solid-wall', typeId: 3005, segmentCode: 3,
    points: [{ x: 1800, y: 1130 }, { x: 2300, y: 1130 }],
  }],
  name: 'Particle barrier acceptance',
  objects: [{
    eid: 'grave', typeId: 2029, pos: { x: 850, y: 1000 }, variant: 0, overlayVariant: 8,
  }],
  roads: [],
  solomonDig: null,
  spawn: { x: 850, y: 1200, facingDeg: 0 },
  sprites: [],
  terrain: [],
}
const choice = {
  id: 'mod:particle-barriers:arena', name: scene.name, source: 'mod',
  modId: 'particle-barriers', modName: 'Particle barriers',
}
const geometrySha256 = boneyardGeometrySha256(scene)
const entry = { choice, scene, geometrySha256, sourceSha256: geometrySha256 }
const errors = { page: [], console: [], responses: [], requests: [], wire: [] }
const frames = []

await mkdir(screenshotRoot, { recursive: true })
const frontend = await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', preview: { host: '127.0.0.1', port: 0 }, root,
})
const address = frontend.httpServer.address()
assert.ok(address && typeof address !== 'string')
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl],
  authentication: { kind: 'shared', credential },
  boneyards: { choices: [choice], modEntries: new Map([[choice.id, entry]]) },
  luaWasmPath: fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url)),
  resetWhenEmpty: true,
  snapshotRate: 20,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})

try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  await context.route('**/deployment.json*', (route) => {
    const revision = new URL(route.request().url()).searchParams.get('current')
    return route.fulfill({ json: { revision } })
  })
  await context.addInitScript((gameEndpoint) => {
    window.solomonDarkRuntime = { gameEndpoint }
  }, { credential, kind: 'localhost', url: host.address.url })
  await context.addInitScript(installGameAudioSmokeProbe, {
    eventsGlobal: '__barrierAudioEvents', sourceMatcherGlobal: '__barrierAudioMatches',
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.page.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', (request) => errors.requests.push(request.url()))
  page.on('websocket', (socket) => {
    socket.on('socketerror', (error) => errors.wire.push(String(error)))
    socket.on('framereceived', ({ payload }) => {
      const message = JSON.parse(String(payload))
      const frame = message.type === 'server-welcome' ? message.snapshot
        : message.type === 'server-snapshot' ? message.frame : null
      if (frame) frames.push(frame)
      if (message.type === 'server-error') errors.wire.push(message)
    })
  })
  await enterArena(page)
  const receipts = []
  receipts.push(await castAtBarrier(page, 'grave-rank-1', { x: 850, y: 1200 }, false))

  const state = host.state()
  const granted = grantPlayerEntitySkillRanks(
    state.playerEntities, host.hostPlayerId(), 34, 11, state.gameRng,
  )
  Object.assign(state, { playerEntities: granted.store, gameRng: granted.rng })
  receipts.push(await castAtBarrier(page, 'grave-cone-11', { x: 850, y: 1200 }, false))
  receipts.push(await castAtBarrier(page, 'solid-wall-cone-11', { x: 2050, y: 1200 }, true))
  const audio = await page.evaluate(() => window.__barrierAudioEvents.filter(({ src }) => (
    window.__barrierAudioMatches(src, '/game/audio/sfx/ice-start.wav')
      || window.__barrierAudioMatches(src, '/game/audio/sfx/ice-loop.wav')
  )).map((event) => ({
    ...event,
    cue: window.__barrierAudioMatches(event.src, '/game/audio/sfx/ice-loop.wav') ? 'loop' : 'start',
  })))
  const loops = audio.filter(({ cue }) => cue === 'loop')
  assert.equal(loops.filter(({ type }) => type === 'play' || type === 'buffer-start').length, 3)
  assert.equal(loops.filter(({ type }) => type === 'pause' || type === 'buffer-stop').length, 3)
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [] })
  process.stdout.write(`${JSON.stringify({ status: 'ok', receipts, errors, audio })}\n`)
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0]
  if (page) await page.screenshot({ path: `${screenshotRoot}/failure.png` })
  const diagnostics = page ? await page.evaluate(() => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return {
      body: document.body.innerText,
      player: frame ? { x: frame.playerX, y: frame.playerY } : null,
      count: frame?.primarySpellCount,
      kinds: [...new Set(frame?.primarySpellKinds)],
    }
  }) : null
  process.stderr.write(`${JSON.stringify({ errors, diagnostics,
    cast: frames.at(-1)?.players[host.hostPlayerId()]?.primaryCast,
    encounter: host.state().world.encounter,
  })}\n`)
  throw error
} finally {
  await browser.close()
  await Promise.all([host.close(), frontend.close()])
}

async function enterArena(page) {
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('[data-prompt-kind="tutorial"] .stock-prompt-dialog')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New game', exact: true }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Water/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  assert.equal(host.loadedBoneyard().choice.id, choice.id)
}

async function castAtBarrier(page, name, position, expectSplay) {
  const state = host.state()
  const locomotions = [...state.playerEntities.locomotions]
  assert.equal(locomotions.length, 1)
  locomotions[0] = { ...locomotions[0], position, velocity: { x: 0, y: 0 } }
  const progressions = [...state.playerEntities.progressions]
  progressions[0] = {
    ...progressions[0], currentMana: 10000, maximumMana: 10000,
    revision: progressions[0].revision + 1,
  }
  Object.assign(state, { playerEntities: { ...state.playerEntities, locomotions, progressions } })
  await page.waitForFunction((point) => {
    const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
    return frame && Math.hypot(frame.playerX - point.x, frame.playerY - point.y) < 1
  }, position)
  const canvas = page.locator('.boneyard-world-canvas')
  const target = await canvas.evaluate((node) => {
    const frame = node.__sdrBoneyardFrame
    const rect = node.getBoundingClientRect()
    return {
      x: rect.x + frame.playerScreenX / Number(node.dataset.viewportWidth) * rect.width,
      y: rect.y + (frame.playerScreenY - 250) / Number(node.dataset.viewportHeight) * rect.height,
    }
  })
  const firstFrame = frames.length
  await page.mouse.move(target.x, target.y)
  await page.mouse.down({ button: 'left' })
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.primaryWaterMeshActorCount > 0
  ))
  await page.waitForTimeout(1500)
  const rendered = await canvas.evaluate((node) => {
    const frame = node.__sdrBoneyardFrame
    return {
      tick: frame.tick, count: frame.primaryWaterMeshActorCount,
      normalCount: frame.primaryWaterMeshNormalFrostCount, kinds: [...new Set(frame.primarySpellKinds)],
    }
  })
  const screenshot = `${screenshotRoot}/${name}.png`
  await page.screenshot({ path: screenshot })
  await page.mouse.up({ button: 'left' })
  const samples = frames.slice(firstFrame).flatMap((frame) => frame.primarySpells.transients)
    .filter(({ kind }) => kind === 'water')
  assert.ok(samples.length > 20, 'the browser must receive a sustained stream')
  const plans = samples.map(waterFrostJetPlan)
  const contacts = samples.filter(({ obstructionPoint }) => obstructionPoint !== null)
  const splays = plans.filter((plan, index) => (
    samples[index].obstructionPoint !== null
      && Math.hypot(plan.velocity.x, plan.velocity.y) < samples[index].speed * 0.6
  ))
  assert.equal(contacts.length > 0, expectSplay, `${name}: obstruction snapshots`)
  assert.equal(splays.length > 0, expectSplay, `${name}: rendered native motion`)
  assert.ok(rendered.count > 0 && rendered.normalCount > 0)
  assert.ok(plans.some(({ kind }) => kind === 'over'))
  await page.waitForFunction(() => (
    document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.primaryWaterMeshActorCount === 0
  ))
  return {
    name, samples: samples.length, contacts: contacts.length, splays: splays.length,
    speeds: [...new Set(samples.map(({ speed }) => speed))], rendered, screenshot,
  }
}

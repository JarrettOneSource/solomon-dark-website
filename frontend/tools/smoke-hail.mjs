// Run after npm run build: npm run test:hail-browser. Uses a private disposable host.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { NATIVE_HAIL_LIFETIME_TICKS, NATIVE_HAIL_MINIMUM_SCALE, NATIVE_HAIL_MAXIMUM_SCALE } from '../src/game/core-kernels/air-water-spell-actors.ts'
import { MAX_PLAYER_LEVEL, MAX_PLAYER_EXPERIENCE, NATIVE_LEVEL_THRESHOLDS } from '../src/game/core-kernels/player-progression.ts'
import { grantPlayerEntitySkillRanks, setPlayerEntityMana } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { enterElementHub, enterBoneyard, openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_HAIL_OUTPUT || '/tmp/solomon-hail'
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const frontend = await preview({ root, configFile: `${root}/vite.config.ts`, logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const credential = randomBytes(32).toString('base64url')
const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [], actors: [] }
const host = await startGameHost({ allowedOrigins: [origin], authentication: { kind: 'shared', credential },
  resetWhenEmpty: true, snapshotRate: 20,
  log: entry => { if (entry.level === 'error') errors.host.push({ event: entry.event, message: entry.message }) },
})
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
})
const context = await browser.newContext({ viewport: { width: 1638, height: 921 }, deviceScaleFactor: 1 })
const page = await context.newPage()
const phases = [], snapshots = []
let refill, sampler
try {
  page.on('pageerror', e => errors.page.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()) })
  page.on('response', r => { if (r.status() >= 400) errors.responses.push(`${r.status()} ${r.url()}`) })
  page.on('requestfailed', r => errors.requests.push(`${r.url()}: ${r.failure()?.errorText}`))
  page.on('websocket', socket => {
    socket.on('socketerror', e => errors.wire.push(String(e)))
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = decodeServerGameMessage(String(payload))
        if (message.type === 'server-error') errors.wire.push(message.message)
        if (message.type === 'server-snapshot') snapshots.push({ at: performance.now(), tick: message.frame.tick })
      } catch (e) { errors.wire.push(e.message) }
    })
  })
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } },
    { credential, kind: 'localhost', url: host.address.url })
  await page.route('**/deployment.json*', route => route.fulfill({ json: {
    revision: new URL(route.request().url()).searchParams.get('current'),
  } }))
  await enterElementHub(page, origin, 'Water')
  const playerId = host.hostPlayerId()
  assert.ok(playerId)
  const beforeCollegeGrant = host.state().playerEntities
  prepare(host.state(), playerId, 10)
  const hub = page.locator('.hub-world-canvas[data-game-renderer="pixi-webgl"]')
  const hubBounds = await hub.boundingBox()
  assert.ok(hubBounds)
  const nextId = host.state().primarySpells.nextId
  await page.mouse.move(hubBounds.x + hubBounds.width * .25, hubBounds.y + hubBounds.height * .4)
  await page.mouse.down({ button: 'left' }); await page.waitForTimeout(500); await page.mouse.up({ button: 'left' })
  assert.equal(host.state().primarySpells.nextId, nextId, 'Shared College admitted a combat emission')
  assert.equal(hailActors().length, 0)
  // Granting the maximum loadout above is solely a College admission fixture.
  // Start Boneyard phases from rank zero without altering unrelated skills.
  Object.assign(host.state(), { playerEntities: beforeCollegeGrant })
  await enterBoneyard(page)
  await openBoneyardCombat(host, playerId)
  const canvas = page.locator('.boneyard-world-canvas[data-game-renderer="pixi-webgl"]')
  await canvas.waitFor({ timeout: 90_000 })
  refill = setInterval(() => refillFixture(host.state(), playerId), 100)
  for (const rank of [0, 1, 2, 3, 10]) {
    prepare(host.state(), playerId, rank)
    Object.assign(host.state(), { gameRng: createNativeRng(42) })
    const samples = [], observed = new Set()
    sampler = setInterval(() => {
      const actors = hailActors()
      for (const actor of actors) {
        observed.add(actor.id)
        if (actor.ageTicks >= NATIVE_HAIL_LIFETIME_TICKS
          || actor.scale < NATIVE_HAIL_MINIMUM_SCALE || actor.scale > NATIVE_HAIL_MAXIMUM_SCALE) {
          if (errors.actors.length < 20) errors.actors.push({ id: actor.id, ageTicks: actor.ageTicks, scale: actor.scale })
        }
      }
      samples.push({ tick: host.state().tick, count: actors.length })
    }, 25)
    const bounds = await canvas.boundingBox()
    assert.ok(bounds)
    await page.mouse.move(bounds.x + bounds.width * .25, bounds.y + bounds.height * .4)
    const startTick = host.state().tick
    await page.mouse.down({ button: 'left' })
    await page.waitForTimeout(1800)
    const steadyFromTick = host.state().tick
    const timing = await measure(page, 5000)
    const heldTick = host.state().tick
    const actorCount = hailActors().length
    const mesh = await page.evaluate(() => {
      const frame = document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame
      return { count: frame.primaryHailMeshCount, runs: frame.primaryHailMeshRunCount }
    })
    await page.screenshot({ path: `${output}/rank-${rank}-held.png` })
    const releaseTick = host.state().tick
    await page.mouse.up({ button: 'left' })
    await waitUntil(() => hailActors().length === 0, 'Hail did not retire after release', 4000)
    const drainTicks = host.state().tick - releaseTick
    assert.ok(drainTicks <= NATIVE_HAIL_LIFETIME_TICKS + 25, 'Hail exceeded native life plus input delivery')
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame.primaryHailMeshCount), 0)
    clearInterval(sampler); sampler = undefined
    const steady = samples.filter(s => s.tick >= steadyFromTick && s.tick <= heldTick)
    assert.ok(steady.length > 0)
    const phase = { rank, startTick, heldTick, releaseTick, steadyFromTick, actorCount, mesh, drainTicks,
      maximumPopulation: Math.max(...steady.map(s => s.count)),
      meanPopulation: steady.reduce((sum, s) => sum + s.count, 0) / steady.length,
      observedActors: observed.size, timing }
    if (rank === 0) assert.equal(phase.maximumPopulation, 0)
    else assert.ok(phase.observedActors > 0, `No Hail was emitted at rank ${rank}`)
    phases.push(phase)
    await writeFile(`${output}/rank-${rank}.json`, JSON.stringify({ ...phase, samples }, null, 2))
    console.log(JSON.stringify(phase))
  }
  await page.screenshot({ path: `${output}/released.png` })
  assert.ok(Object.values(errors).every(a => a.length === 0), JSON.stringify(errors))
  const receipt = { status: 'ok', browser: browser.version(), phases, errors,
    fixture: 'maximum Cone of Ice, Frost rank eight, Hail ranks 0/1/2/3/10, health/mana replenishment, maximum player level, seeded authoritative RNG at each phase; original spell geometry/timing/damage retained',
    maximumSnapshotGapMs: Math.max(0, ...snapshots.slice(1).map((s, i) => s.at - snapshots[i].at)) }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify({ status: receipt.status, browser: receipt.browser, errors }))
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {})
  await writeFile(`${output}/failure.json`, JSON.stringify({ message: error.message, errors, phases }, null, 2))
  throw error
} finally {
  clearInterval(refill); clearInterval(sampler)
  await context.close(); await browser.close(); await host.close(); await frontend.close()
}

function hailActors() { return host.state().primarySpells.transients.filter(a => a.kind === 'water-hail') }

function prepare(state, playerId, hailRank) {
  let store = state.playerEntities, rng = createNativeRng(42)
  for (const [skillId, rank] of [[32, 8], [34, 11], [38, hailRank], [56, 4], [64, 2]]) {
    const index = store.identities.findIndex(row => row.playerId === playerId)
    const amount = Math.max(0, rank - store.skillBooks[index].permanentRanks[skillId])
    if (amount === 0) continue
    const granted = grantPlayerEntitySkillRanks(store, playerId, skillId, amount, rng)
    store = granted.store; rng = granted.rng
  }
  Object.assign(state, { playerEntities: { ...store, progressions: store.progressions.map(p => ({
    ...p, level: MAX_PLAYER_LEVEL, experience: MAX_PLAYER_EXPERIENCE,
    previousThreshold: NATIVE_LEVEL_THRESHOLDS[MAX_PLAYER_LEVEL - 1],
    nextThreshold: NATIVE_LEVEL_THRESHOLDS[MAX_PLAYER_LEVEL],
  })) } })
  refillFixture(state, playerId)
}

function refillFixture(state, playerId) {
  const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
  const store = setPlayerEntityMana(state.playerEntities, playerId, state.playerEntities.progressions[index].maximumMana)
  Object.assign(state, { playerEntities: { ...store, progressions: store.progressions.map((p, i) =>
    i === index ? { ...p, currentHealth: p.maximumHealth } : p) } })
}

async function measure(page, milliseconds) {
  return page.evaluate(milliseconds => new Promise(resolve => {
    const frames = []; let start, previous
    function sample(now) {
      start ??= now
      if (previous !== undefined) frames.push(now - previous)
      previous = now
      if (now - start < milliseconds) return requestAnimationFrame(sample)
      const total = frames.reduce((sum, value) => sum + value, 0)
      frames.sort((a, b) => a - b)
      resolve({ frames: frames.length, meanFps: frames.length * 1000 / total,
        p95Ms: frames[Math.floor(frames.length * .95)], maximumFrameMs: frames.at(-1) })
    }
    requestAnimationFrame(sample)
  }), milliseconds)
}

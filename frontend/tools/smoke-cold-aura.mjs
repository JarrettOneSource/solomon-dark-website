import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { MAX_PLAYER_LEVEL, MAX_PLAYER_EXPERIENCE, NATIVE_LEVEL_THRESHOLDS } from '../src/game/core-kernels/player-progression.ts'
import { grantPlayerEntitySkillRanks, setPlayerEntityMana } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { enterElementHub, enterBoneyard, openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

// Optional original browser-game-save.json stays private; only its hash and
// bounded effect/performance diagnostics enter the receipt.
const output = process.env.SDR_COLD_AURA_OUTPUT || '/tmp/solomon-cold-aura'
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const frontend = await preview({ root, configFile: `${root}/vite.config.ts`, logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
})
try {
  const journeys = []
  if (process.env.SDR_COLD_AURA_SAVE) {
    journeys.push(await journey('saved-continuation', await readFile(process.env.SDR_COLD_AURA_SAVE, 'utf8')))
  }
  journeys.push(await journey('boneyard'))
  journeys.push(await journey('hub'))
  const receipt = { status: 'ok', browser: browser.version(), journeys }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await frontend.close()
}

async function journey(name, original) {
  const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [] }
  const credential = randomBytes(32).toString('base64url')
  const host = await startGameHost({ allowedOrigins: [origin],
    authentication: { kind: 'shared', credential }, resetWhenEmpty: true, snapshotRate: 20,
    log: entry => { if (entry.level === 'error') errors.host.push({ event: entry.event, message: entry.message }) },
  })
  const context = await browser.newContext({ viewport: { width: 1638, height: 921 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const samples = [], windows = [], snapshots = []
  let sampler, refill
  try {
    page.on('pageerror', e => errors.page.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.console.push(m.text()) })
    page.on('response', r => { if (r.status() >= 400) errors.responses.push(`${r.status()} ${r.url()}`) })
    page.on('requestfailed', r => errors.requests.push(`${r.url()}: ${r.failure()?.errorText}`))
    page.on('websocket', socket => {
      socket.on('socketerror', e => errors.wire.push(String(e)))
      socket.on('framereceived', ({ payload }) => {
        try {
          const m = decodeServerGameMessage(String(payload))
          if (m.type === 'server-error') errors.wire.push(m.message)
          if (m.type === 'server-snapshot') snapshots.push({ at: performance.now(), tick: m.frame.tick })
        } catch (e) { errors.wire.push(e.message) }
      })
    })
    await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } },
      { credential, kind: 'localhost', url: host.address.url })
    await page.route('**/deployment.json*', route => route.fulfill({ json: {
      revision: new URL(route.request().url()).searchParams.get('current'),
    } }))
    if (original) await restoreOriginal(page, original)
    else {
      await enterElementHub(page, origin, 'Water')
      if (name === 'boneyard') {
        await enterBoneyard(page)
        await openBoneyardCombat(host, host.hostPlayerId())
      }
    }
    const scene = original ? 'boneyard' : name
    const canvas = page.locator(`.${scene}-world-canvas[data-game-renderer="pixi-webgl"]`)
    await canvas.waitFor({ timeout: 90_000 })
    const start = performance.now()
    const sample = () => {
      const state = host.state(), auras = auraActors(host)
      samples.push({ at: performance.now() - start, tick: state.tick, auras: auras.length,
        maximumAge: Math.max(0, ...auras.map(a => a.ageTicks)),
        maximumDuration: Math.max(0, ...auras.map(a => a.durationTicks)) })
    }
    sample(); sampler = setInterval(sample, 100)
    let drainTicks = null
    if (original) {
      assert.equal(auraActors(host).length, 0, 'Legacy Aura actors survived recovery')
      await page.screenshot({ path: `${output}/${name}-restored.png` })
      windows.push({ name: 'original-save-5s', ...await measure(page, 5000) })
      await page.screenshot({ path: `${output}/${name}-after-5s.png` })
      windows.push({ name: 'original-save-15s', ...await measure(page, 10000) })
      await page.screenshot({ path: `${output}/${name}-after-15s.png` })
      assert.ok(samples.every(s => s.auras === 0))
    } else if (scene === 'hub') {
      // Product policy seals combat in the shared College (parity ledger 141).
      // A lower-level Sprite fixture is not permission to bypass this gate.
      const playerId = host.hostPlayerId()
      prepareMaximumAura(host.state(), playerId)
      const nextId = host.state().primarySpells.nextId
      const bounds = await canvas.boundingBox()
      assert.ok(bounds)
      await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .4)
      await page.mouse.down({ button: 'left' })
      windows.push({ name: 'college-combat-sealed-6s', ...await measure(page, 6000) })
      await page.mouse.up({ button: 'left' })
      assert.ok(samples.every(s => s.auras === 0))
      assert.equal(host.state().primarySpells.nextId, nextId, 'College admitted a combat emission')
      await page.screenshot({ path: `${output}/${name}-sealed.png` })
    } else {
      const playerId = host.hostPlayerId()
      prepareMaximumAura(host.state(), playerId)
      refill = setInterval(() => refillFixture(host.state(), playerId), 100)
      const bounds = await canvas.boundingBox()
      assert.ok(bounds)
      await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .4)
      await page.mouse.down({ button: 'left' })
      await waitUntil(() => auraActors(host).length >= 22, `${name}: Aura did not reach native steady state`, 15_000)
      windows.push({ name: 'maximum-rank-held-6s', ...await measure(page, 6000) })
      await page.screenshot({ path: `${output}/${name}-held.png` })
      assert.ok(samples.every(s => s.auras <= 23 && s.maximumAge < 138 && s.maximumDuration <= 138))
      assert.ok(samples.some(s => s.auras >= 22))
      const releaseTick = host.state().tick
      await page.mouse.up({ button: 'left' })
      await waitUntil(() => auraActors(host).length === 0, `${name}: Aura did not drain after release`, 5000)
      drainTicks = host.state().tick - releaseTick
      assert.ok(drainTicks <= 160, 'Release exceeded native life plus input-delivery allowance')
      windows.push({ name: 'released-2s', ...await measure(page, 2000) })
      await page.screenshot({ path: `${output}/${name}-released.png` })
      if (scene === 'boneyard') {
        assert.equal(await page.evaluate(() => document.querySelector('.boneyard-world-canvas')
          .__sdrBoneyardFrame.primaryWaterAuraMeshCount), 0)
      }
    }
    assert.ok(Object.values(errors).every(a => a.length === 0), JSON.stringify(errors))
    const active = snapshots.filter(s => s.at >= start)
    const receipt = { name, errors, windows, samples, drainTicks,
      saveSha256: original ? createHash('sha256').update(original).digest('hex') : null,
      fixture: original ? 'unaltered original gameplay; private recovery token cleared'
        : scene === 'hub' ? 'maximum Aura loadout; shared College combat remains sealed'
          : 'maximum authored Aura rank; mana/health replenishment and maximum level for uninterrupted measurement',
      maximumSnapshotGapMs: Math.max(0, ...active.slice(1).map((s, i) => s.at - active[i].at)),
    }
    await writeFile(`${output}/${name}.json`, JSON.stringify(receipt, null, 2))
    return { ...receipt, samples: undefined, maximumPopulation: Math.max(...samples.map(s => s.auras)) }
  } catch (e) {
    await page.screenshot({ path: `${output}/${name}-failure.png` }).catch(() => {})
    console.error(JSON.stringify({ name, errors, samples: samples.slice(-5), message: e.message }))
    throw e
  } finally {
    clearInterval(sampler); clearInterval(refill)
    await context.close(); await host.close()
  }
}

function auraActors(host) {
  return host.state().primarySpells.transients.filter(a => a.kind === 'water-aura')
}

async function restoreOriginal(page, original) {
  const save = JSON.parse(original)
  save.continuation.summary.partyRejoinToken = null
  await page.route(`${origin}/__aura_seed`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }))
  await page.goto(`${origin}/__aura_seed`)
  await page.evaluate(document => new Promise((resolve, reject) => {
    const request = indexedDB.open('solomon-dark-game-saves', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('slots', { keyPath: 'slot' })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const transaction = request.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put({ slot: 0, revision: 1, document })
      transaction.oncomplete = () => { request.result.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  }), JSON.stringify(save))
  await page.goto(`${origin}/game`)
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30_000 })
}

async function measure(page, milliseconds) {
  return page.evaluate(milliseconds => new Promise(resolve => {
    const frames = []
    let start, previous
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

function prepareMaximumAura(state, playerId) {
  let store = state.playerEntities, rng = createNativeRng(42)
  for (const [skillId, rank] of [[32, 8], [37, 10], [56, 4], [64, 2]]) {
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

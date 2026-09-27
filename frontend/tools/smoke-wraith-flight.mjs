import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { createServer, preview } from 'vite'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { createBoneyardEnemyStore, positionBoneyardEnemy, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { createGameSimulation, enterBoneyardWorld, getPlayerCharacter, getPlayerProgression } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { EntityReplicationReconstructor } from '../src/game/protocol/entity-replication.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { createGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { WEB_GAME_SAVE_SLOT } from '../src/game/save/game-save-contract.ts'
import { waitUntil } from './game-smoke-navigation.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.SDR_WRAITH_OUTPUT || await mkdtemp(join(tmpdir(), 'solomon-wraith-'))
await mkdir(output, { recursive: true })
const mobile = process.env.SDR_WRAITH_MOBILE === '1'
const built = process.env.SDR_WRAITH_BUILT === '1'
const owner = 'wraith-owner'
const credential = randomBytes(32).toString('base64url')
const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 91))
assert.ok(loaded)
let state = enterBoneyardWorld(createGameSimulation({ [owner]: {
  discipline: 'arcane', displayName: 'Wraith flight', element: 'fire',
} }), loaded)
const bounds = state.world.bounds
const playerPosition = resolveBoneyardSpawnPosition({ x: bounds.x + bounds.w / 2,
  y: bounds.y + bounds.h / 2 }, bounds, state.world.collision, 25)
state = { ...state, playerEntities: replacePlayerCharacter(state.playerEntities, owner, {
  ...getPlayerCharacter(state, owner), position: playerPosition,
}) }
const order = createNativeWorldManagerOrder(state.worldManagerOrder)
const enemies = stepBoneyardEnemyStore(createBoneyardEnemyStore('wraith-browser'), {
  tick: state.tick, players: {}, projectileWorldBlocked: () => false,
  resolveMovement: request => request.requestedPosition,
  registerWorldPainter: order.register,
  resolveSpawnIntents: () => [{ enemyToken: 'WRAITH', nativeTypeId: 1007, flags: [],
    id: 1, spawnTick: state.tick, waveOrdinal: 24, locationPolicy: 'anywhere',
    position: { x: playerPosition.x + 150, y: playerPosition.y } }],
}).store
// A diagnostic old save reproduces the persisted state of the stalled actor.
const saved = JSON.parse(createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: loaded,
  mods: [], modState: {}, playerId: owner, state: { ...state,
    worldManagerOrder: order.state(),
    world: { ...state.world, arenaTransition: null, encounter: null, waves: null, enemies },
  } }))
saved.schemaVersion = 43
const oldActor = saved.continuation.simulation.world.enemies.actors[0]
oldActor.brain = { ...oldActor.brain, restingSpeed: .26820915937423706, currentSpeed: .001,
  currentTurnGain: 5455.5, targetTurnGain: 5457.5, flybyTicksRemaining: 0, contactCooldownTicks: 0 }
const document = JSON.stringify(saved)
const vite = built
  ? await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port: 0 } })
  : await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } })
if (!built) await vite.listen()
const baseUrl = `http://127.0.0.1:${vite.httpServer.address().port}`
const errors = { page: [], console: [], responses: [], wire: [], host: [] }
const host = await startGameHost({ allowedOrigins: [baseUrl], authentication: { kind: 'shared', credential },
  snapshotRate: 20, log: entry => { if (entry.level === 'error') errors.host.push(entry.message) } })
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH || '/usr/bin/google-chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-audio-output'] })
const page = await browser.newPage(mobile
  ? { viewport: { width: 896, height: 414 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1600, height: 900 } })
const wire = new EntityReplicationReconstructor()
let latest = null
let sequence = 0
page.on('pageerror', error => errors.page.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
page.on('websocket', socket => {
  if (new URL(socket.url()).href !== new URL(host.address.url).href) return
  socket.on('framereceived', ({ payload }) => {
    try {
      const message = decodeServerGameMessage(Buffer.isBuffer(payload) ? payload.toString() : payload)
      if (message.type === 'server-welcome') {
        wire.reset(message.snapshot, message.snapshotSequence)
        latest = message.snapshot; sequence = message.snapshotSequence
      } else if (message.type === 'server-snapshot' && message.sequence > sequence) {
        latest = wire.apply(message.frame, message.sequence); sequence = message.sequence
      }
    } catch (error) { errors.wire.push(error.message) }
  })
})
try {
  await page.route('**/__wraith_seed', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Wraith fixture</title>' }))
  await page.route('**/deployment.json?*', route => route.fulfill({ json: { revision: new URL(route.request().url()).searchParams.get('current') } }))
  await page.addInitScript(runtime => { window.solomonDarkRuntime = runtime }, {
    gameEndpoint: { kind: 'localhost', credential, url: host.address.url },
  })
  await page.goto(`${baseUrl}/__wraith_seed`)
  await page.evaluate(record => new Promise((resolve, reject) => {
    const open = indexedDB.open('solomon-dark-game-saves', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' })
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const transaction = open.result.transaction('slots', 'readwrite')
      transaction.objectStore('slots').put(record)
      transaction.oncomplete = () => { open.result.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
    }
  }), { document, revision: 1, slot: WEB_GAME_SAVE_SLOT })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).click({ timeout: 180000 })
  await page.getByRole('button', { name: 'Last game', exact: true }).click()
  const scene = page.locator('.boneyard-scene[data-renderer-state="ready"][data-gameplay-input-blocked="false"]')
  await scene.waitFor({ timeout: 90000 })
  const canvas = page.locator('.boneyard-world-canvas')
  await waitUntil(() => host.state().world.kind === 'boneyard' && host.state().world.enemies.actors.length === 1,
    'restored Wraith', 30000)
  const restored = structuredClone(host.state().world.enemies.actors[0].brain)
  assert.ok(restored.restingSpeed >= 16 && restored.currentSpeed > 15)
  assert.ok(restored.currentTurnGain < 20)
  const flight = await sampleFlight(canvas, 600)
  await page.screenshot({ path: join(output, 'flight.png') })

  // Position one real actor at contact; retain its actual damage and Dazzle code.
  const live = host.state()
  const player = getPlayerCharacter(live, owner)
  const beforeHealth = getPlayerProgression(live, owner).currentHealth
  const positioned = positionBoneyardEnemy(live.world.enemies, 1, player.position).store
  live.world = { ...live.world, enemies: { ...positioned, actors: positioned.actors.map(actor => ({
    ...actor, brain: { ...actor.brain, contactCooldownTicks: 0 },
  })) } }
  await waitUntil(() => getPlayerProgression(host.state(), owner).currentHealth < beforeHealth - 3,
    'Wraith contact damage', 10000)
  const hit = getPlayerProgression(host.state(), owner)
  assert.ok(hit.dazzleTicksRemaining > 0 && hit.dazzleTicksRemaining <= 50)
  const contact = { beforeHealth, afterHealth: hit.currentHealth, dazzleTicks: hit.dazzleTicksRemaining }
  await page.screenshot({ path: join(output, 'contact.png') })
  await waitUntil(() => getPlayerProgression(host.state(), owner).dazzleTicksRemaining === 0,
    'Dazzle recovery', 10000)

  await scene.focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor()
  await page.waitForTimeout(350)
  const frozen = retainedFlight()
  await page.waitForTimeout(500)
  assert.deepEqual(retainedFlight(), frozen)
  await pause.getByRole('button', { name: 'RESUME GAME', exact: true }).click()
  await scene.waitFor()
  const resumed = await sampleFlight(canvas, 600)
  assert.ok(latest?.world.kind === 'boneyard' && latest.world.enemies.some(actor => actor.id === 1))
  assert.ok(sequence > 100)
  assert.equal(getPlayerProgression(host.state(), owner).lifeState, 'alive')
  for (const value of Object.values(errors)) assert.deepEqual(value, [])
  const graphics = await canvas.evaluate(node => {
    const gl = node.getContext('webgl2') || node.getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    return { renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null }
  })
  const receipt = { status: 'ok', browser: browser.version(), built, mobile, graphics,
    fixture: 'Private schema43 stalled-flight save; one ordinary Wraith, default player health; diagnostic contact placement.',
    restored, flight, contact, pausedFlightUnchanged: true, resumed, sequence, errors }
  await writeFile(join(output, 'receipt.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} catch (error) {
  await page.screenshot({ path: join(output, 'failure.png') }).catch(() => {})
  console.error(JSON.stringify({ errors, text: (await page.locator('body').innerText()).slice(-1000) }))
  throw error
} finally {
  await browser.close(); await host.close()
  if (built) await new Promise((resolve, reject) => vite.httpServer.close(error => error ? reject(error) : resolve()))
  else await vite.close()
}

function retainedFlight() {
  const actor = host.state().world.enemies.actors[0]
  return structuredClone({ position: actor.position, brain: actor.brain })
}

async function sampleFlight(canvas, ticks) {
  const receipt = await canvas.evaluate((node, ticks) => new Promise((resolve, reject) => {
    const start = node.__sdrBoneyardFrame.tick
    const deadline = performance.now() + 30000
    let prior = null
    let distance = 0
    let renderedBodies = 0
    let samples = 0
    const positions = []
    function observe() {
      if (performance.now() > deadline) return reject(new Error('flight world did not advance'))
      const frame = node.__sdrBoneyardFrame
      const enemy = frame.enemySamples.find(enemy => enemy.id === 1)
      if (!enemy) return reject(new Error('rendered Wraith disappeared'))
      const sample = { tick: frame.tick, x: enemy.x, y: enemy.y, bodyEntry: enemy.bodyEntry }
      if (prior && sample.tick > prior.tick) {
        distance += Math.hypot(sample.x - prior.x, sample.y - prior.y)
        samples++
        if (positions.length < 12) positions.push(sample)
      }
      if (sample.bodyEntry >= 2070 && sample.bodyEntry <= 2087) renderedBodies++
      prior = sample
      if (frame.tick - start >= ticks) return resolve({
        ticks: frame.tick - start, distance, samples, renderedBodies, positions,
      })
      requestAnimationFrame(observe)
    }
    requestAnimationFrame(observe)
  }), ticks)
  assert.ok(receipt.distance > 1000, `rendered Wraith stalled: ${JSON.stringify(receipt)}`)
  assert.ok(receipt.samples >= 25 && receipt.renderedBodies > 0, JSON.stringify(receipt))
  return receipt
}

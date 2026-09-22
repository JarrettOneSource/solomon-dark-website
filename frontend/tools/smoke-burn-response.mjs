// Real Mac Chrome journey for native periodic hit response and Burn teardown.
import assert from 'node:assert/strict'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { applyNativeSecondaryFireBurn, resetNativeSecondaryWorld } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { boneyardNativeSecondaryTarget } from '../src/game/core-server/native-secondary-world.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const complexLighting = process.env.SDR_BURN_COMPLEX_LIGHTING !== '0'
const screenshotRoot = process.env.SDR_BURN_SCREENSHOTS || '/tmp/soggy-20260922-r02-browser'
const credential = randomBytes(32).toString('base64url')
const scene = {
  bounds: { x: 0, y: 0, w: 2400, h: 2000 }, environmentMode: 2,
  fences: [], name: 'Burn response acceptance', objects: [], roads: [], solomonDig: null,
  spawn: { x: 1200, y: 1000, facingDeg: 180 }, sprites: [], terrain: [],
}
const choice = {
  id: 'mod:burn-response:arena', name: scene.name, source: 'mod',
  modId: 'burn-response', modName: 'Burn response',
}
const geometrySha256 = boneyardGeometrySha256(scene)
const entry = { choice, scene, geometrySha256, sourceSha256: geometrySha256 }
const errors = { page: [], console: [], responses: [], requests: [], wire: [] }
const frames = []
await mkdir(screenshotRoot, { recursive: true })
const frontend = await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  logLevel: 'error', preview: { host: '127.0.0.1', port: 0 },
  root: fileURLToPath(new URL('../', import.meta.url)),
})
const address = frontend.httpServer.address()
assert.ok(address && typeof address !== 'string')
const baseUrl = `http://127.0.0.1:${address.port}`
const host = await startGameHost({
  allowedOrigins: [baseUrl], authentication: { kind: 'shared', credential },
  boneyards: { choices: [choice], modEntries: new Map([[choice.id, entry]]) },
  luaWasmPath: fileURLToPath(new URL('../node_modules/wasmoon/dist/glue.wasm', import.meta.url)),
  resetWhenEmpty: true, snapshotRate: 20,
})
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'], headless: true,
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
let page
try {
  page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.route('**/deployment.json*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } }, {
    credential, kind: 'localhost', url: host.address.url,
  })
  await page.addInitScript(({ key, settings }) => localStorage.setItem(key, JSON.stringify(settings)), {
    key: GAME_SETTINGS_STORAGE_KEY, settings: { ...DEFAULT_GAME_SETTINGS, complexLighting },
  })
  await page.addInitScript(installGameAudioSmokeProbe)
  page.on('pageerror', error => errors.page.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
  page.on('response', response => {
    if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`)
  })
  page.on('requestfailed', request => errors.requests.push(request.url()))
  page.on('websocket', socket => {
    socket.on('socketerror', error => errors.wire.push(String(error)))
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = decodeServerGameMessage(String(payload))
        const frame = message.type === 'server-welcome' ? message.snapshot
          : message.type === 'server-snapshot' ? message.frame : null
        if (frame) frames.push(frame)
        if (message.type === 'server-error') errors.wire.push(message.message)
      } catch (error) {
        errors.wire.push(error.message)
      }
    })
  })
  await page.goto(`${baseUrl}/game`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
  const tutorial = page.locator('[data-prompt-kind="tutorial"] .stock-prompt-dialog')
  if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'New game', exact: true }).click()
  await page.locator('.create-menu-scene[data-motion-settled="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: /Fire/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  assert.equal(host.loadedBoneyard().choice.id, choice.id)

  const canvas = page.locator('.boneyard-world-canvas')
  const state = host.state()
  const playerId = host.hostPlayerId()
  const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = { ...progressions[index], currentHealth: 500, maximumHealth: 500 }
  Object.assign(state, { playerEntities: { ...state.playerEntities, progressions } })
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const nextId = state.world.enemies.nextActorId
  const families = [ ['ZOMBIE', 1006], ['SKELETON', 1001], ['IMP', 1004] ]
  const spawned = stepBoneyardEnemyStore({ ...state.world.enemies, lastStepTick: state.tick - 1 }, {
    projectileWorldBlocked: () => false, players: {}, tick: state.tick,
    registerWorldPainter: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => families.map(([enemyToken, nativeTypeId], offset) => ({
      enemyToken, nativeTypeId, flags: [], id: nextId + offset, locationPolicy: 'anywhere',
      position: { x: 1000 + offset * 200, y: 800 }, spawnTick: state.tick, waveOrdinal: 1,
    })),
  }).store
  const ids = families.map((_, offset) => nextId + offset)
  Object.assign(state, { worldManagerOrder: order.state(), world: { ...state.world,
    enemies: { ...spawned, actors: spawned.actors.filter(actor => ids.includes(actor.id)) } } })
  await page.waitForFunction(ids => ids.every(id => document.querySelector('.boneyard-world-canvas')
    .__sdrBoneyardFrame.enemySamples.some(enemy => enemy.id === id)), ids)
  const capture = () => canvas.evaluate((node, ids) => {
    const frame = node.__sdrBoneyardFrame
    return { tick: frame.tick, enemies: frame.enemySamples.filter(enemy => ids.includes(enemy.id)),
      kinds: frame.secondaryAbilityKinds, particles: frame.secondaryAbilityPrimitiveCount,
      lights: frame.lightMiscTailCandidateCount }
  }, ids)
  const baseline = await capture()

  // A normal accepted hit remains a visible, decaying body redraw.
  const directState = host.state()
  const direct = damageBoneyardEnemy(directState.world.enemies, {
    actorId: ids[0], amount: 0.01, sourcePlayerId: playerId, tick: directState.tick,
  })
  Object.assign(directState, { world: { ...directState.world, enemies: direct.store } })
  await page.waitForFunction(id => document.querySelector('.boneyard-world-canvas')
    .__sdrBoneyardFrame.enemySamples.find(enemy => enemy.id === id)?.hitFlash > 0, ids[0])
  const normalHit = await capture()
  await page.waitForFunction(id => document.querySelector('.boneyard-world-canvas')
    .__sdrBoneyardFrame.enemySamples.find(enemy => enemy.id === id)?.hitFlash === 0, ids[0])
  await page.screenshot({ path: `${screenshotRoot}/before-burn.png` })

  function ignite(targetIds) {
    const current = host.state()
    let secondary = current.secondaryAbilities
    for (const id of targetIds) {
      const target = boneyardNativeSecondaryTarget(current.world.enemies, id)
      assert.ok(target)
      secondary = applyNativeSecondaryFireBurn(secondary, {
        damage: 0.2, ownerId: playerId, rank: 1, skillId: 22, target,
        worldKey: `boneyard:${current.world.runId}`,
      })
    }
    Object.assign(current, { secondaryAbilities: secondary })
    return current.tick
  }
  const burnTick = ignite(ids)
  await page.waitForFunction(() => {
    const frame = document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame
    return frame.secondaryAbilityKinds.includes('fire-burn-flame') && frame.secondaryAbilityPrimitiveCount > 0
  })
  const samples = []
  for (let sample = 0; sample < 6; sample += 1) {
    await page.waitForTimeout(100)
    samples.push(await capture())
  }
  for (const sample of samples) {
    assert.equal(sample.enemies.length, 3)
    assert.ok(sample.enemies.every(enemy => enemy.hitFlash === 0), 'Burn must never draw the solid red body')
  }
  const burning = samples.at(-1)
  if (complexLighting) assert.ok(burning.lights > baseline.lights, 'target-owned Burn lights remain')
  for (const enemy of burning.enemies) {
    assert.ok(enemy.currentHealth < baseline.enemies.find(row => row.id === enemy.id).currentHealth)
  }
  await page.screenshot({ path: `${screenshotRoot}/burning.png` })
  const parentIds = host.state().secondaryAbilities.actors.filter(actor => actor.kind === 'fire-burn').map(actor => actor.id)
  const refreshTick = ignite(ids)
  assert.deepEqual(host.state().secondaryAbilities.actors.filter(actor => actor.kind === 'fire-burn').map(actor => actor.id), parentIds)
  await waitUntil(() => host.state().tick >= burnTick + 210, 'original burn lifetime did not elapse')
  assert.equal(host.state().secondaryAbilities.actors.filter(actor => actor.kind === 'fire-burn').length, 3)
  await waitUntil(() => !host.state().secondaryAbilities.actors.some(actor => actor.kind === 'fire-burn' || actor.kind === 'fire-burn-flame'), 'Burn and flame children did not expire')
  await page.waitForFunction(() => !document.querySelector('.boneyard-world-canvas')
    .__sdrBoneyardFrame.secondaryAbilityKinds.some(kind => kind.startsWith('fire-burn')))
  const expired = await capture()
  assert.ok(expired.enemies.every(enemy => enemy.hitFlash === 0))
  assert.equal(expired.lights, baseline.lights)
  await page.screenshot({ path: `${screenshotRoot}/expired.png` })

  ignite([ids[0]])
  await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')
    .__sdrBoneyardFrame.secondaryAbilityKinds.includes('fire-burn'))
  const removal = host.state()
  Object.assign(removal, { world: { ...removal.world, enemies: { ...removal.world.enemies,
    actors: removal.world.enemies.actors.filter(actor => actor.id !== ids[0]) } } })
  await waitUntil(() => !host.state().secondaryAbilities.actors.some(actor => actor.kind === 'fire-burn'), 'orphan Burn survived target removal')
  ignite([ids[1]])
  const reset = host.state()
  Object.assign(reset, { secondaryAbilities: resetNativeSecondaryWorld(reset.secondaryAbilities, `boneyard:${reset.world.runId}`) })
  await page.waitForFunction(() => !document.querySelector('.boneyard-world-canvas')
    .__sdrBoneyardFrame.secondaryAbilityKinds.some(kind => kind.startsWith('fire-burn')))
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [] })
  process.stdout.write(`${JSON.stringify({ status: 'ok', browser: browser.version(), complexLighting, baseline, normalHit,
    burnTick, refreshTick, burning, sampledFrames: samples.length, expired,
    targetRemoval: 'passed', worldReset: 'passed', wireFrames: frames.length, errors })}\n`)
} catch (error) {
  if (page) await page.screenshot({ path: `${screenshotRoot}/failure.png` })
  process.stderr.write(`${JSON.stringify({ errors })}\n`)
  throw error
} finally {
  await browser.close()
  await Promise.all([host.close(), frontend.close()])
}

async function waitUntil(predicate, message, timeout = 15_000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error(message)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

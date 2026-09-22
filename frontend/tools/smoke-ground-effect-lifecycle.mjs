import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { startGameHost } from '../src/game/host/game-host.ts'
import { NATIVE_GENERATED_BONEYARDS } from '../src/game/host/native-generated-boneyards.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { EntityReplicationReconstructor } from '../src/game/protocol/entity-replication.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_STORAGE_KEY } from '../src/game/game-settings.ts'
import { enterElementHub, startElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'
import { acceptGroundEffects } from './ground-effects-smoke-acceptance.mjs'

// Exercise the built client and real account API with exclusively task-owned storage.
const repository = resolve(import.meta.dirname, '../..')
const storage = await mkdtemp(resolve(tmpdir(), 'ground-effect-lifecycle-'))
const backend = spawn(process.env.SDR_DOTNET || 'dotnet', [resolve(repository, 'backend/bin/Release/net10.0/Server.dll')], {
  cwd: repository,
  env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Production', ASPNETCORE_URLS: 'http://127.0.0.1:0',
    ASPNETCORE_WEBROOT: resolve(repository, 'backend/wwwroot'), Storage__Root: storage,
    Jwt__Secret: randomBytes(40).toString('hex') }, stdio: ['ignore', 'pipe', 'pipe'],
})
let host, browser
const pageErrors = [], consoleErrors = [], failedResponses = [], requestFailures = []
const expectedMissingSaves = []
try {
  const baseUrl = await backendReady(backend)
  const credential = randomBytes(32).toString('base64url')
  host = await startGameHost({ allowedOrigins: [baseUrl], authentication: { kind: 'shared', credential },
    createBoneyardSeedBytes: () => { const seed = Buffer.alloc(16); seed.writeUInt32BE(4); return seed },
    resetWhenEmpty: true, snapshotRate: 20 })
  browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const wire = observeWire(page, host.address.url)
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url })
  })
  page.on('requestfailed', request => requestFailures.push({ url: request.url(), failure: request.failure() }))
  page.on('response', response => {
    if (response.status() < 400) return
    const record = { status: response.status(), url: response.url() }
    if (record.status === 404 && new URL(record.url).pathname === '/api/game/saves/0') expectedMissingSaves.push(record)
    else failedResponses.push(record)
  })
  await page.route('**/deployment.json?*', route => route.fulfill({
    json: { revision: new URL(route.request().url()).searchParams.get('current') },
  }))
  await page.addInitScript(({ endpoint, settingsKey, settings }) => {
    window.solomonDarkRuntime = { gameEndpoint: endpoint }
    localStorage.setItem(settingsKey, JSON.stringify(settings))
  }, { endpoint: { credential, kind: 'localhost', url: host.address.url },
    settingsKey: GAME_SETTINGS_STORAGE_KEY, settings: { ...DEFAULT_GAME_SETTINGS, complexLighting: false } })

  const output = process.env.SDR_GROUND_LIFECYCLE_SCREENSHOT_PREFIX || resolve(storage, 'lifecycle')
  await enterElementHub(page, baseUrl, 'water')
  await enterBoneyard(page)
  const first = await freshOpening('guest-first')
  const firstLive = await acceptGroundEffects({ host, page, wire, screenshotPath: `${output}-guest-live.png`,
    onLiveEffects: async receipt => {
      const saved = await leaveLive()
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await page.getByRole('button', { name: 'Last game', exact: true }).click()
      await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90000 })
      await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
        && wire.latestSnapshot.world.runId === saved.runId && wire.latestSnapshot.world.spiderRemains.length > 0,
      'same-run continuation lost live Spider remains', 15000)
      const restored = groundState(wire.latestSnapshot.world)
      assert.ok(restored.pools > 0 && restored.stains > 0)
      await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 15000 })
      await leaveLive()
      return { ...receipt, saved, restored }
    } })

  // No page navigation between the old renderer's disposal and New Game.
  await startElementHub(page, 'water')
  await enterBoneyard(page)
  const second = await freshOpening('guest-new-game')
  assert.notEqual(second.runId, first.runId)
  const secondLive = await acceptGroundEffects({ host, page, wire, screenshotPath: `${output}-guest-second-live.png`,
    onLiveEffects: async receipt => ({ ...receipt, saved: await leaveLive() }) })

  const username = `Ground${Date.now()}`
  const password = randomBytes(24).toString('base64url')
  const registered = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      username, email: `${username}@example.invalid`, password,
    }) })
  assert.equal(registered.status, 201)
  await page.goto(`${baseUrl}/login`)
  await page.getByPlaceholder('Faelificus').fill(username)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(`${baseUrl}/account`)
  await enterElementHub(page, baseUrl, 'water')
  await enterBoneyard(page)
  const account = await freshOpening('signed-in-new-game')
  assert.notEqual(account.runId, second.runId)
  assert.equal(await page.locator('.game-account-name-hud').textContent(), username)
  await leave()

  assert.deepEqual(wire.errors, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleErrors.filter(error => !(new URL(error.url || baseUrl).pathname === '/api/game/saves/0'
    && error.text.includes('404') && expectedMissingSaves.some(response => response.url === error.url))), [])
  assert.deepEqual(failedResponses, [])
  assert.deepEqual(requestFailures, [])
  console.log(JSON.stringify({ status: 'ok', first, firstLive, second, secondLive, account,
    pageErrors, consoleErrors, failedResponses, requestFailures, expectedMissingSaves, wireErrors: wire.errors }))

  async function freshOpening(label) {
    await waitUntil(() => wire.loadedBoneyard?.runId === host.state().world.runId
      && wire.latestSnapshot?.world.kind === 'boneyard'
      && wire.latestSnapshot.world.runId === host.state().world.runId, 'fresh world did not reach the browser', 15000)
    const loaded = wire.loadedBoneyard
    assert.deepEqual(loaded.scene, NATIVE_GENERATED_BONEYARDS[4].scene)
    const world = host.state().world
    assert.equal(world.enemies.spiderRemains.length, 0)
    const ground = groundState(wire.latestSnapshot.world)
    assert.deepEqual(ground, { remains: 0, pools: 0, stains: 0, splats: 0 })
    const patch = loaded.scene.sprites.find(sprite => sprite.eid === 'sprite-63')
    assert.equal(patch.atlasEntry, 26)
    assert.equal(patch.deadHawgEntry, 140)
    const playerId = host.hostPlayerId()
    const dig = world.encounter.position
    host.state().playerEntities = replacePlayerCharacter(host.state().playerEntities, playerId, {
      ...getPlayerCharacter(host.state(), playerId), position: { x: dig.x, y: dig.y - 130 }, velocity: { x: 0, y: 0 },
    })
    const tick = host.state().tick
    await waitUntil(() => wire.latestSnapshot.tick > tick + 10, 'opening position did not replicate', 10000)
    await page.screenshot({ path: `${output}-${label}.png` })
    return { runId: world.runId, ground, sourceSha256: loaded.sourceSha256, patch }
  }

  async function leaveLive() {
    assert.ok(host.state().world.enemies.spiderRemains.some(remains => remains.state.decal !== null),
      'live-boundary test waited until Spider effects had retired')
    await leave()
    const saved = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('solomon-dark-game-saves', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const read = db.transaction('slots', 'readonly').objectStore('slots').get(0)
        read.onerror = () => { db.close(); reject(read.error) }
        read.onsuccess = () => { db.close(); resolve(JSON.parse(read.result.document).continuation.simulation.world) }
      }
    }))
    assert.ok(saved.enemies.spiderRemains.some(remains => remains.state.decal !== null))
    assert.ok(saved.enemies.projectiles.some(projectile => projectile.kind === 'poison-pool'))
    assert.ok(saved.enemies.deathEffects.some(effect => effect.kind === 'fade-perspective-clipped'))
    return { runId: saved.runId, remains: saved.enemies.spiderRemains.length,
      life: saved.enemies.spiderRemains[0].state.life }
  }

  async function leave() {
    await page.locator('.boneyard-scene').focus()
    await page.keyboard.press('Escape')
    const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
    await pause.waitFor({ timeout: 10000 })
    await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 })
    assert.equal(await page.locator('.boneyard-world-canvas').count(), 0)
  }
} finally {
  await browser?.close()
  await host?.close()
  await new Promise(resolve => {
    if (backend.exitCode !== null) return resolve()
    backend.once('exit', resolve)
    backend.kill('SIGTERM')
  })
  await rm(storage, { recursive: true, force: true })
}

function groundState(world) {
  return { remains: world.spiderRemains.length,
    pools: world.enemyProjectiles.filter(projectile => projectile.kind === 'poison-pool').length,
    stains: world.deathEffects.filter(effect => effect.kind === 'fade-perspective-clipped').length,
    splats: world.deathEffects.filter(effect => effect.kind === 'late-splat').length }
}

function observeWire(page, endpoint) {
  const wire = { latestSnapshot: null, loadedBoneyard: null, errors: [] }
  const reconstructor = new EntityReplicationReconstructor()
  page.on('websocket', socket => {
    if (socket.url() !== endpoint) return
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = decodeServerGameMessage(Buffer.isBuffer(payload) ? payload.toString() : payload)
        if (message.type === 'server-boneyard-loaded') wire.loadedBoneyard = message.boneyard
        if (message.type === 'server-welcome') {
          reconstructor.reset(message.snapshot, message.snapshotSequence)
          wire.latestSnapshot = message.snapshot
        } else if (message.type === 'server-snapshot') {
          wire.latestSnapshot = reconstructor.apply(message.frame, message.sequence)
        }
      } catch (error) { wire.errors.push(error.message) }
    })
  })
  return wire
}

function backendReady(process) {
  return new Promise((resolve, reject) => {
    let log = ''
    const timer = setTimeout(() => reject(new Error(`backend startup timed out: ${log}`)), 30000)
    const onExit = code => { clearTimeout(timer); reject(new Error(`backend exited ${code}: ${log}`)) }
    process.once('exit', onExit)
    const output = chunk => {
      log = (log + chunk).slice(-8000)
      const address = /Now listening on: (http:\/\/127\.0\.0\.1:\d+)/.exec(log)
      if (!address) return
      clearTimeout(timer)
      process.removeListener('exit', onExit)
      resolve(address[1])
    }
    process.stdout.on('data', output)
    process.stderr.on('data', output)
  })
}

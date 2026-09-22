import assert from 'node:assert/strict'
import { randomBytes, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { MAX_PLAYER_LEVEL, MAX_PLAYER_EXPERIENCE, NATIVE_LEVEL_THRESHOLDS } from '../src/game/core-kernels/player-progression.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-director.ts'
import { stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { grantPlayerEntitySkillRanks } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { enterElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

// Optional private continuation is never copied into a public receipt.
const output = process.env.SDR_COFFIN_OUTPUT || '/tmp/solomon-coffin-spawn'
const viewport = { width: 1638, height: 921 }
const deviceScaleFactor = 1.5625
await mkdir(output, { recursive: true })
const frontend = await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 },
})
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'],
})
const receipts = []
try {
  if (process.env.SDR_COFFIN_SAVE) {
    const original = await readFile(process.env.SDR_COFFIN_SAVE, 'utf8')
    const save = JSON.parse(original)
    save.continuation.summary.partyRejoinToken = null
    const restored = await journey('saved-continuation', JSON.stringify(save),
      createHash('sha256').update(original).digest('hex'))
    receipts.push(restored)
    await writeFile(`${output}/saved-continuation.json`, JSON.stringify(restored, null, 2))
  }
  receipts.push(await journey('native-burst'))
  const receipt = { status: 'ok', browser: browser.version(), viewport, deviceScaleFactor, receipts }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await frontend.close()
}

async function journey(name, document, saveSha256) {
  const credential = randomBytes(32).toString('base64url')
  const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [] }
  const warnings = []
  const archives = []
  let wireFrames = 0
  const scene = {
    bounds: { x: 0, y: 0, w: 2400, h: 2000 }, environmentMode: 2,
    fences: [], name: 'Coffin lifecycle acceptance', objects: [], roads: [], solomonDig: null,
    spawn: { x: 1200, y: 1000, facingDeg: 180 }, sprites: [], terrain: [],
  }
  const choice = { id: 'mod:coffin-proof:arena', name: scene.name, source: 'mod',
    modId: 'coffin-proof', modName: 'Coffin proof' }
  const hash = boneyardGeometrySha256(scene)
  const host = await startGameHost({
    allowedOrigins: [origin], authentication: { kind: 'shared', credential },
    ...(document ? {} : { boneyards: { choices: [choice], modEntries: new Map([
      [choice.id, { choice, scene, geometrySha256: hash, sourceSha256: hash }],
    ]) } }),
    resetWhenEmpty: true, snapshotRate: 20,
    archiveRun: archive => archives.push({ performance: archive.performance,
      worstTickMs: archive.worstTick.tickMs, endReason: archive.endReason }),
    log: entry => {
      if (entry.level === 'error') errors.host.push({ event: entry.event, message: entry.message })
      if (entry.event === 'simulation.tick_lag') warnings.push(entry.details)
    },
  })
  const context = await browser.newContext({ viewport, deviceScaleFactor })
  const page = await context.newPage()
  const windows = []
  try {
    await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } }, {
      credential, kind: 'localhost', url: host.address.url,
    })
    await page.addInitScript(installGameAudioSmokeProbe)
    await page.route('**/deployment.json*', route => route.fulfill({
      json: { revision: new URL(route.request().url()).searchParams.get('current') },
    }))
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
    page.on('websocket', socket => {
      socket.on('socketerror', error => errors.wire.push(String(error)))
      socket.on('framereceived', ({ payload }) => {
        try {
          const message = decodeServerGameMessage(String(payload))
          if (message.type === 'server-snapshot' || message.type === 'server-welcome') wireFrames++
          if (message.type === 'server-error') errors.wire.push(message.message)
        } catch (error) { errors.wire.push(error.message) }
      })
    })
    if (document) {
      await page.route(`${origin}/__coffin_seed`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }))
      await page.goto(`${origin}/__coffin_seed`)
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
      }), document)
      await page.goto(`${origin}/game`)
      await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 90_000 })
      const tutorial = page.getByRole('dialog', { name: 'Play the Tutorial?' })
      if (await tutorial.isVisible()) await tutorial.getByRole('button', { name: 'NO', exact: true }).click()
      await page.getByRole('button', { name: 'Play', exact: true }).click()
      await page.getByRole('button', { name: 'Last game', exact: true }).click()
    } else {
      await enterElementHub(page, origin, 'Air')
      await enterBoneyard(page)
    }
    await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 30_000 })
    const baseline = await measure(page, 3000)
    windows.push({ name: 'baseline', ...baseline })
    await page.screenshot({ path: `${output}/${name}-baseline.png` })
    const playerId = host.hostPlayerId()
    let burst
    if (document) {
      const before = host.state()
      const coffin = before.world.enemies.actors.find(actor => actor.config.enemyToken === 'COFFIN')
      assert.ok(coffin)
      const playerIndex = before.playerEntities.identities.findIndex(row => row.playerId === playerId)
      const locomotions = before.playerEntities.locomotions.map((row, index) => index === playerIndex
        ? { ...row, position: { x: coffin.position.x, y: coffin.position.y + 100 }, velocity: { x: 0, y: 0 } }
        : row)
      Object.assign(before, { playerEntities: { ...before.playerEntities, locomotions } })
      windows.push({ name: 'saved-coffins-in-view', ...await measure(page, 3000) })
      await page.screenshot({ path: `${output}/${name}-coffins.png` })
      let childIds
      const measured = await measure(page, 5000, () => {
        const current = host.state()
        const coffins = current.world.enemies.actors.filter(actor => actor.config.enemyToken === 'COFFIN')
        childIds = current.world.enemies.maggots.map(actor => actor.id)
        assert.equal(coffins.length, 2)
        let enemies = current.world.enemies
        for (const actor of coffins) enemies = damageBoneyardEnemy(enemies, {
          actorId: actor.id, amount: actor.currentHealth, sourcePlayerId: playerId, tick: current.tick,
        }).store
        Object.assign(current, { world: { ...current.world, enemies } })
        burst = { coffins: coffins.length, children: childIds.length }
      })
      windows.push({ name: 'saved-owner-death', ...measured })
      assert.ok(host.state().world.enemies.maggots.every(actor => !childIds.includes(actor.id)))
    } else {
      learnHurricane(host.state(), playerId)
      const canvas = page.locator('.boneyard-world-canvas')
      const box = await canvas.boundingBox()
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5)
      await page.mouse.down()
      try {
        await waitUntil(() => host.state().primarySpells.transients.some(actor => (
          actor.kind === 'air-hurricane' && actor.contactCharge > 0.5
        )), 'Hurricane did not charge', 15_000)
        windows.push({ name: 'hurricane-baseline', ...await measure(page, 2000) })
        const flags = [[], ['FLAG_MANYMAGGOTS'], ['FLAG_STRONGMAGGOTS'], ['FLAG_MANYMAGGOTS', 'FLAG_STRONGMAGGOTS']]
        let ids
        const measuring = measure(page, 8000, () => {
          const state = host.state()
          const index = state.playerEntities.identities.findIndex(row => row.playerId === playerId)
          const center = state.playerEntities.locomotions[index].position
          const order = createNativeWorldManagerOrder(state.worldManagerOrder)
          const firstId = state.world.enemies.nextActorId
          const spawned = stepBoneyardEnemyStore({ ...state.world.enemies, lastStepTick: state.tick - 1 }, {
            players: {}, tick: state.tick, projectileWorldBlocked: () => false,
            registerWorldPainter: order.register, resolveMovement: ({ requestedPosition }) => requestedPosition,
            resolveSpawnIntents: () => Array.from({ length: 8 }, (_, i) => ({
              enemyToken: 'COFFIN', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.COFFIN,
              flags: flags[i % 4], id: firstId + i, locationPolicy: 'anywhere',
              position: { x: center.x + Math.cos(i * Math.PI / 4) * 130,
                y: center.y + Math.sin(i * Math.PI / 4) * 130 },
              spawnTick: state.tick, waveOrdinal: 22,
            })),
          }).store
          ids = spawned.actors.filter(actor => actor.id >= firstId).map(actor => actor.id)
          assert.equal(ids.length, 8)
          Object.assign(state, { world: { ...state.world, enemies: spawned }, worldManagerOrder: order.state() })
        })
        await waitUntil(() => ids && host.state().world.enemies.actors
          .filter(actor => ids.includes(actor.id))
          .every(actor => actor.brain.family === 'coffin' && actor.brain.phase !== 'hidden'),
        'Coffins did not enter their native visible phase', 12_000)
        const current = host.state()
        const alive = current.world.enemies.actors.filter(actor => ids.includes(actor.id) && actor.lifeState === 'alive')
        assert.ok(alive.length > 0)
        assert.ok(current.primarySpells.transients.some(actor => actor.kind === 'air-hurricane' && actor.contactCharge > 0))
        const order = createNativeWorldManagerOrder(current.worldManagerOrder)
        let enemies = current.world.enemies
        for (const actor of alive) {
          assert.equal(actor.hurricaneContactCooldown, 0, 'Coffins never enter Badguy Hurricane contact')
          assert.deepEqual(actor.position, actor.brain.anchorPosition, 'Coffins retain their native root')
          // Hurricane is presentation-only for this sibling. Drive the burst
          // through the same eligible damage/terminal owner used by other skills.
          const damaged = damageBoneyardEnemy(enemies, { actorId: actor.id,
            amount: actor.currentHealth, magic: true, hasMagicDamage: true,
            sourcePlayerId: playerId, tick: current.tick, registerWorldPainter: order.register })
          assert.equal(damaged.accepted, true)
          enemies = damaged.store
        }
        Object.assign(current, { world: { ...current.world, enemies }, worldManagerOrder: order.state() })
        await waitUntil(() => host.state().world.enemies.deathEffects.some(effect => effect.role === 'coffin-skull'),
          'Eligible damage did not retire the emerging Coffins', 12_000)
        await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')
          .__sdrBoneyardFrame.enemyDeathEffectVisibleCount > 100)
        // GPU readback/PNG encoding must not contaminate the timed burst.
        const measured = await measuring
        assert.ok(measured.peakVisibleEffects >= 500, 'the complete terminal burst must reach the renderer')
        windows.push({ name: 'spawn-and-immediate-death', ...measured })
        assert.ok(host.state().world.enemies.actors.every(actor => !ids.includes(actor.id)))
        burst = { coffins: ids.length, styles: flags, removed: ids.length,
          hurricaneExcluded: true, lethalSource: 'shared-magic-damage' }
      } finally { await page.mouse.up() }
    }
    await page.screenshot({ path: `${output}/${name}-after.png` })
    windows.push({ name: 'restoration', ...await measure(page, 3000) })
    if (!document) {
      await waitUntil(() => host.state().world.enemies.deathEffects.length === 0,
        'independent debris did not retire', 20_000)
      await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas').__sdrBoneyardFrame.enemyDeathEffectCount === 0)
      assert.ok(await page.evaluate(() => window.__sdrAudioEvents.some(event => (
        event.type === 'buffer-start' && window.__sdrAudioSourceMatches(event.src, 'coffin-break.wav')
      ))), 'Coffin break audio must remain')
    }
    assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [], host: [] })
    for (const window of windows) {
      assert.ok(window.actionMs < 250, `${name}/${window.name}: host action stalled for ${window.actionMs} ms`)
      assert.ok(window.maximum < 250, `${name}/${window.name}: a frame stalled for ${window.maximum} ms`)
      assert.ok(window.p99 < 50, `${name}/${window.name}: p99 frame interval ${window.p99} ms`)
      assert.ok(window.tickAdvance >= window.milliseconds * 0.08,
        `${name}/${window.name}: simulation did not advance at least 80% of real time`)
    }
    return { name, saveSha256, burst, windows, wireFrames, warnings, archives, errors }
  } catch (error) {
    await page.screenshot({ path: `${output}/${name}-failure.png` })
    console.error(JSON.stringify({ name, errors, windows, stateTick: host.state().tick }))
    throw error
  } finally {
    await context.close()
    await host.close()
  }
}

async function measure(page, milliseconds, onStarted) {
  await page.evaluate(milliseconds => new Promise(started => {
    let finish
    window.__sdrCoffinMeasurement = new Promise(resolve => { finish = resolve })
    const frames = [], ticks = [], effects = [], visibleEffects = [], children = []
    let first, previous
    function sample(now) {
      if (first === undefined) { first = now; started() }
      if (previous !== undefined) frames.push(now - previous)
      previous = now
      const frame = document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame
      if (frame) {
        ticks.push(frame.tick); effects.push(frame.enemyDeathEffectCount)
        visibleEffects.push(frame.enemyDeathEffectVisibleCount); children.push(frame.maggotCount)
      }
      if (now - first < milliseconds) return requestAnimationFrame(sample)
      frames.sort((a, b) => a - b)
      finish({ milliseconds, frames: frames.length, p95: frames[Math.ceil(frames.length * .95) - 1],
        p99: frames[Math.ceil(frames.length * .99) - 1], maximum: frames.at(-1),
        over100: frames.filter(value => value > 100).length,
        tickAdvance: ticks.at(-1) - ticks[0], peakEffects: Math.max(...effects),
        peakVisibleEffects: Math.max(...visibleEffects), peakMaggots: Math.max(...children) })
    }
    requestAnimationFrame(sample)
  }), milliseconds)
  // Acknowledge the first sampled frame before changing host state. Otherwise
  // the very allocation frame being investigated could precede the measurement.
  const actionStart = performance.now()
  await onStarted?.()
  const actionMs = performance.now() - actionStart
  return { ...await page.evaluate(() => window.__sdrCoffinMeasurement), actionMs }
}

function learnHurricane(state, playerId) {
  let store = state.playerEntities
  let rng = createNativeRng(42)
  const index = store.identities.findIndex(row => row.playerId === playerId)
  for (const [skillId, rank] of [[29, 1], [56, 4], [64, 2]]) {
    const granted = grantPlayerEntitySkillRanks(store, playerId, skillId,
      Math.max(0, rank - store.skillBooks[index].permanentRanks[skillId]), rng)
    store = granted.store; rng = granted.rng
  }
  state.playerEntities = { ...store, progressions: store.progressions.map(value => ({
    ...value, currentHealth: value.maximumHealth, currentMana: value.maximumMana,
    // Keep the terminal-burst measurement running through native XP awards;
    // a level-up modal would pause the remaining Coffins and invalidate timing.
    level: MAX_PLAYER_LEVEL, experience: MAX_PLAYER_EXPERIENCE,
    previousThreshold: NATIVE_LEVEL_THRESHOLDS[MAX_PLAYER_LEVEL - 1],
    nextThreshold: NATIVE_LEVEL_THRESHOLDS[MAX_PLAYER_LEVEL],
  })) }
}

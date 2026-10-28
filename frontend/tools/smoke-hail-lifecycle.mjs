import { GameWelcomeReceiver } from '../src/game/protocol/game-welcome-transfer.ts'
// Run against the built client with a private disposable host.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { gameRunWorldTick } from '../src/game/core-kernels/game-run.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'
import { nativeSkillMinimumLevel, NATIVE_LEVEL_THRESHOLDS } from '../src/game/core-kernels/player-progression.ts'
import { grantGameSimulationPlayerExperience, getPlayerProgression, getPlayerSkillBook, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { damagePlayerEntity, grantPlayerEntitySkillRanks, setPlayerEntityMana } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'
import { enterElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_HAIL_LIFECYCLE_OUTPUT || '/tmp/solomon-hail-lifecycle'
await mkdir(output, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const frontend = await preview({ root, configFile: `${root}/vite.config.ts`, logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 } })
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({ executablePath: process.env.SDR_CHROME_PATH,
  headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
try {
  const journeys = []
  for (const [enhancedEffects, exit] of [[true, 'input'], [false, 'automatic']]) {
    const result = await journey(enhancedEffects, exit)
    journeys.push(result)
    await writeFile(`${output}/${exit}-receipt.json`, JSON.stringify(result, null, 2))
  }
  const receipt = { status: 'ok', browser: browser.version(), journeys }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await frontend.close()
}

async function journey(enhancedEffects, exit) {
  const scene = { bounds: { x: 0, y: 0, w: 2400, h: 2000 }, environmentMode: 2,
    fences: [], name: 'Hail lifecycle acceptance', objects: [], roads: [], solomonDig: null,
    spawn: { x: 1200, y: 1000, facingDeg: 180 }, sprites: [], terrain: [] }
  const choice = { id: 'mod:hail-lifecycle:arena', name: scene.name, source: 'mod',
    modId: 'hail-lifecycle', modName: 'Hail lifecycle' }
  const hash = boneyardGeometrySha256(scene)
  const credential = randomBytes(32).toString('base64url')
  const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [] }
  const frames = []
  const host = await startGameHost({ allowedOrigins: [origin],
    authentication: { kind: 'shared', credential }, resetWhenEmpty: true, snapshotRate: 20,
    boneyards: { choices: [choice], modEntries: new Map([
      [choice.id, { choice, scene, geometrySha256: hash, sourceSha256: hash }],
    ]) }, log: entry => { if (entry.level === 'error') errors.host.push(entry.event) } })
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const page = await context.newPage()
  const hail = () => host.state().primarySpells.transients.filter(actor => actor.kind === 'water-hail')
  try {
    page.on('pageerror', error => errors.page.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.responses.push(`${response.status()} ${response.url()}`) })
    page.on('requestfailed', request => errors.requests.push(`${request.url()}: ${request.failure()?.errorText}`))
    page.on('websocket', socket => {
      socket.on('socketerror', error => errors.wire.push(String(error)))
      const welcomeReceiver = new GameWelcomeReceiver()
      socket.on('close', () => welcomeReceiver.close())
      socket.on('framereceived', ({ payload }) => {
        try {
          const message = welcomeReceiver.receivePayload(String(payload), () => {})
          if (message === null) return
          if (message.type === 'server-error') errors.wire.push(message.message)
          if (message.type === 'server-snapshot') frames.push({ tick: message.frame.tick,
            run: message.frame.run, hail: message.frame.primarySpells.hail.rows.length })
        } catch (error) { errors.wire.push(error.message) }
      })
    })
    await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } },
      { credential, kind: 'localhost', sessionKind: 'standalone', url: host.address.url })
    await page.route('**/deployment.json*', route => route.fulfill({ json: {
      revision: new URL(route.request().url()).searchParams.get('current'),
    } }))
    await enterElementHub(page, origin, 'Water')
    const playerId = host.hostPlayerId()
    assert.ok(playerId)
    await enterBoneyard(page)
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
    const canvas = page.locator('.boneyard-world-canvas')
    const bounds = await canvas.boundingBox()
    assert.ok(bounds)
    if (!enhancedEffects) {
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'GAME SETTINGS', exact: true }).click()
      await page.getByRole('button', { name: 'TWEAK GAME', exact: true }).click()
      const toggle = page.getByRole('button', { name: 'ENHANCED EFFECTS', exact: true })
      await toggle.click()
      await waitUntil(() => host.state().enhancedEffects === false, 'Effects setting was not accepted', 10_000)
      await page.waitForFunction(() => document.querySelector('button[aria-label="ENHANCED EFFECTS"]')
        ?.getAttribute('aria-pressed') === 'false')
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await page.keyboard.press('Escape')
      await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
    }
    assert.equal(host.state().enhancedEffects, enhancedEffects)
    // Prerequisite ranks and deterministic offer seed are local test setup; acquisition uses the real picker.
    let store = host.state().playerEntities
    for (const [skillId, rank] of [[32, 8], [34, 11]]) {
      const amount = rank - getPlayerSkillBook(host.state(), playerId).permanentRanks[skillId]
      store = grantPlayerEntitySkillRanks(store, playerId, skillId, amount, createNativeRng(42)).store
      Object.assign(host.state(), { playerEntities: store })
    }
    const fixtureLevel = nativeSkillMinimumLevel(38) - 1
    Object.assign(host.state(), { playerEntities: { ...store, progressions: store.progressions.map((row, index) =>
      index === store.identities.findIndex(identity => identity.playerId === playerId)
        ? { ...row, level: fixtureLevel, experience: NATIVE_LEVEL_THRESHOLDS[fixtureLevel - 1],
          previousThreshold: NATIVE_LEVEL_THRESHOLDS[fixtureLevel - 1], nextThreshold: NATIVE_LEVEL_THRESHOLDS[fixtureLevel] }
        : row) } })
    let offered
    const before = host.state()
    const playerIndex = before.playerEntities.identities.findIndex(row => row.playerId === playerId)
    const progression = getPlayerProgression(before, playerId)
    for (let seed = 0; seed < 1000; seed++) {
      const candidate = grantGameSimulationPlayerExperience({ ...before,
        playerEntities: { ...before.playerEntities, progressions: before.playerEntities.progressions.map((row, index) =>
          index === playerIndex ? { ...row, offerSeed: seed } : row) },
      }, playerId, progression.nextThreshold - progression.experience + 1)
      if (getPlayerProgression(candidate, playerId).pendingOffer?.options.some(option => option.skillId === 38)) {
        offered = candidate
        break
      }
    }
    assert.ok(offered, 'No legal Hail offer was found')
    Object.assign(host.state(), offered)
    await page.mouse.click(bounds.x + bounds.width * .75, bounds.y + bounds.height * .4)
    await page.locator('.skill-picker-action[data-skill-id="38"]').click()
    await waitUntil(() => getPlayerSkillBook(host.state(), playerId).permanentRanks[38] === 1,
      'Hail selection was not accepted', 10_000)
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
    async function cast() {
      const index = host.state().playerEntities.identities.findIndex(row => row.playerId === playerId)
      const maximumMana = host.state().playerEntities.progressions[index].maximumMana
      Object.assign(host.state(), { playerEntities: setPlayerEntityMana(host.state().playerEntities, playerId, maximumMana) })
      await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .4)
      await page.mouse.down({ button: 'left' })
      await waitUntil(() => hail().length >= 5, 'Frost Jet did not emit learned Hail', 10_000)
    }
    await cast()
    const leveled = grantGameSimulationPlayerExperience(host.state(), playerId,
      getPlayerProgression(host.state(), playerId).nextThreshold - getPlayerProgression(host.state(), playerId).experience + 1)
    Object.assign(host.state(), leveled)
    await page.mouse.up({ button: 'left' })
    await page.locator('.skill-picker-stage[data-reveal-interactive="true"]').waitFor()
    const heldTick = host.state().tick
    const heldHail = structuredClone(hail())
    await page.waitForTimeout(300)
    assert.equal(host.state().tick, heldTick)
    assert.deepEqual(hail(), heldHail)
    await page.locator('.skill-picker-action').first().click()
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
    await cast()
    await page.mouse.up({ button: 'left' })
    await page.keyboard.press('Escape')
    const pausedHail = structuredClone(hail())
    assert.ok(pausedHail.length > 0)
    await page.locator('.gameplay-pause-stage').getByRole('button', { name: 'LEAVE GAME', exact: true }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor()
    const saved = await localSave(page)
    const restored = restoreGameSaveDocument(saved.document)
    const savedHail = restored.state.primarySpells.transients.filter(actor => actor.kind === 'water-hail')
    assert.ok(savedHail.length > 0, 'Checkpoint lost live Hail')
    assert.equal(restored.state.enhancedEffects, enhancedEffects)
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    await page.getByRole('button', { name: 'Last game', exact: true }).click()
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor({ timeout: 90_000 })
    assert.equal(getPlayerSkillBook(host.state(), playerId).permanentRanks[38], 1)
    await cast()
    const active = host.state()
    const terminal = stepGameSimulationTick({ ...active,
      playerEntities: damagePlayerEntity(active.playerEntities, playerId, 10_000, active.tick),
    }, {})
    assert.equal(terminal.run.phase, 'game-over')
    Object.assign(active, terminal)
    await page.mouse.up({ button: 'left' })
    const frozenHail = structuredClone(hail())
    assert.ok(frozenHail.length > 0)
    const samples = []
    for (const elapsed of [50, 300, 500]) {
      await waitUntil(() => host.state().run.gameOverTicks >= elapsed, 'Game Over clock stalled', 8000)
      assert.equal(gameRunWorldTick(host.state().tick, host.state().run), terminal.tick)
      assert.deepEqual(hail(), frozenHail)
      await page.waitForFunction(count => document.querySelector('.boneyard-world-canvas')
        ?.__sdrBoneyardFrame?.primaryHailMeshCount === count, frozenHail.length)
      samples.push(await canvas.evaluate(node => {
        const f = node.__sdrBoneyardFrame
        return { tick: f.tick, worldTick: Math.floor(f.tick) - f.runGameOverTicks,
          gameOverTicks: f.runGameOverTicks, hailCount: f.primaryHailMeshCount,
          deathTick: f.localPlayerDeathTick, deathFrame: f.playerDeathFrame }
      }))
    }
    assert.ok(samples.every(sample => sample.worldTick === terminal.tick))
    await page.screenshot({ path: `${output}/${exit}-frozen-hail.png` })
    if (exit === 'input') await page.locator('.boneyard-game-over[data-input-ready="true"]').click()
    await waitUntil(() => host.state().run.phase === 'loadout', 'Game Over exit stalled', 20_000)
    await page.locator('.create-menu-scene').waitFor()
    const terminalFrames = frames.filter(frame => frame.run.phase === 'game-over')
    assert.ok(terminalFrames.length > 50)
    assert.ok(terminalFrames.every(frame => frame.hail === frozenHail.length))
    assert.deepEqual(host.state().primarySpells.transients, [])
    assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [], host: [] })
    return { enhancedEffects, exit, acquiredRank: 1, heldTick, heldHailCount: heldHail.length,
      savedTick: restored.state.tick, savedHailCount: savedHail.length, frozenTick: terminal.tick,
      frozenHailCount: frozenHail.length, frozenAges: frozenHail.map(actor => actor.ageTicks),
      frozenBirthTicks: frozenHail.map(actor => actor.birthTick), terminalFrames: terminalFrames.length, samples, errors }
  } catch (error) {
    console.error(error.message)
    await writeFile(`${output}/${exit}-failure.json`, JSON.stringify({ message: error.message, errors,
      phase: host.state().run.phase, tick: host.state().tick,
      frames: frames.slice(-3) }, null, 2))
    await page.screenshot({ path: `${output}/${exit}-failure.png` })
    throw error
  } finally {
    await context.close()
    await host.close()
  }
}

async function localSave(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const opened = indexedDB.open('solomon-dark-game-saves', 1)
    opened.onerror = () => reject(opened.error)
    opened.onsuccess = () => {
      const database = opened.result
      const request = database.transaction('slots', 'readonly').objectStore('slots').get(0)
      request.onerror = () => { database.close(); reject(request.error) }
      request.onsuccess = () => { database.close(); resolve(request.result) }
    }
  }))
}

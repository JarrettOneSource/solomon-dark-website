import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { gameRunWorldTick } from '../src/game/core-kernels/game-run.ts'
import { stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { damagePlayerEntity } from '../src/game/core-server/player-entity-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { enterElementHub, enterBoneyard, waitUntil } from './game-smoke-navigation.mjs'

const output = process.env.SDR_GAME_OVER_MAGE_OUTPUT || '/tmp/solomon-game-over-mage'
await mkdir(output, { recursive: true })
const frontend = await preview({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 },
})
const origin = `http://127.0.0.1:${frontend.httpServer.address().port}`
const browser = await chromium.launch({
  executablePath: process.env.SDR_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
try {
  const receipts = []
  for (const exit of ['automatic', 'input']) receipts.push(await journey(exit))
  const receipt = { status: 'ok', browser: browser.version(), receipts }
  await writeFile(`${output}/receipt.json`, JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt))
} finally {
  await browser.close()
  await frontend.close()
}

async function journey(exit) {
  const credential = randomBytes(32).toString('base64url')
  const scene = {
    bounds: { x: 0, y: 0, w: 2400, h: 2000 }, environmentMode: 2,
    fences: [], name: 'Terminal Mage acceptance', objects: [], roads: [], solomonDig: null,
    spawn: { x: 1200, y: 1000, facingDeg: 180 }, sprites: [], terrain: [],
  }
  const choice = { id: 'mod:terminal-mage:arena', name: scene.name, source: 'mod',
    modId: 'terminal-mage', modName: 'Terminal Mage' }
  const hash = boneyardGeometrySha256(scene)
  const errors = { page: [], console: [], responses: [], requests: [], wire: [], host: [] }
  const frames = []
  const host = await startGameHost({
    allowedOrigins: [origin], authentication: { kind: 'shared', credential },
    boneyards: { choices: [choice], modEntries: new Map([
      [choice.id, { choice, scene, geometrySha256: hash, sourceSha256: hash }],
    ]) },
    resetWhenEmpty: true, snapshotRate: 20,
    log: entry => { if (entry.level === 'error') errors.host.push(entry.event) },
  })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  try {
    await page.addInitScript(gameEndpoint => { window.solomonDarkRuntime = { gameEndpoint } }, {
      credential, kind: 'localhost', url: host.address.url,
    })
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
          const frame = message.type === 'server-welcome' ? message.snapshot
            : message.type === 'server-snapshot' ? message.frame : null
          if (frame) frames.push({ at: performance.now(), tick: frame.tick, run: frame.run,
            pulseCount: frame.world.kind === 'boneyard' ? frame.world.mageLightningPulses.length : 0,
            deathTick: Object.values(frame.players)[0]?.progression.deathTick,
          })
          if (message.type === 'server-error') errors.wire.push(message.message)
        } catch (error) { errors.wire.push(error.message) }
      })
    })
    await enterElementHub(page, origin, 'Air')
    await enterBoneyard(page)
    await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
    const playerId = host.hostPlayerId()
    const active = host.state()
    const terminal = stepGameSimulationTick({ ...active, playerEntities: damagePlayerEntity(
      active.playerEntities, playerId, 1000, active.tick,
    ) }, {})
    assert.equal(terminal.run.phase, 'game-over')
    const order = createNativeWorldManagerOrder(terminal.worldManagerOrder)
    const creator = order.register('actor')
    const pulses = []
    // Valid orphan fixtures isolate terminal ownership from Mage AI randomness.
    // Both native contact variants and every live age use their exact registrations.
    for (let age = 4; age >= 0; age--) {
      for (const kind of ['world', 'target-attached']) {
        pulses.push({ id: pulses.length + 1, ownerActorId: 1, tick: terminal.tick - age,
          seed: 42 + age, source: { x: 1000, y: 950 }, midpoint: { x: 1100, y: 950 },
          endpoint: { x: 1200, y: 950 }, lightRegistration: creator,
          painterRegistrations: Array.from({ length: kind === 'world' ? 3 : 2 }, () => order.register('actor')),
          contact: kind === 'world' ? { kind, position: { x: 1200, y: 950 } }
            : { kind, localOffset: { x: 0, y: -25 }, targetPlayerId: playerId },
        })
      }
    }
    Object.assign(active, terminal, { worldManagerOrder: order.state(), world: {
      ...terminal.world, enemies: { ...terminal.world.enemies, mageLightningPulses: pulses,
        nextMageLightningPulseId: pulses.length + 1 },
    } })
    const canvas = page.locator('.boneyard-world-canvas')
    await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')
      ?.__sdrBoneyardFrame?.mageLightningCount === 8)
    const samples = []
    for (const age of [50, 300, 500]) {
      await waitUntil(() => host.state().run.gameOverTicks >= age, `terminal clock failed to reach ${age}`, 8000)
      const sample = await canvas.evaluate(node => {
        const f = node.__sdrBoneyardFrame
        return { tick: f.tick, gameOverTicks: f.runGameOverTicks, pulses: f.mageLightningCount,
          deathTick: f.localPlayerDeathTick, deathFrame: f.playerDeathFrame }
      })
      // World coronas live five ages; attached coronas live only three.
      // The wire retains all ten factories, while only eight still draw.
      assert.equal(sample.pulses, 8)
      if (age === 300) assert.equal(sample.deathFrame, 3)
      assert.equal(gameRunWorldTick(host.state().tick, host.state().run), terminal.tick)
      samples.push(sample)
    }
    await page.screenshot({ path: `${output}/${exit}-frozen-world.png` })
    if (exit === 'input') await page.locator('.boneyard-game-over[data-input-ready="true"]').click()
    await waitUntil(() => host.state().run.phase === 'loadout', `${exit}: terminal exit stalled`, 20_000)
    await page.locator('.create-menu-scene').waitFor({ timeout: 30_000 })
    const terminalFrames = frames.filter(frame => frame.run.phase === 'game-over')
    assert.ok(terminalFrames.length > 50)
    assert.ok(terminalFrames.every(frame => frame.pulseCount === 10))
    assert.ok(terminalFrames.some(frame => frame.deathTick >= 159))
    assert.ok(terminalFrames.some(frame => frame.run.gameOverExitKind === exit))
    const maximumSnapshotGapMs = Math.max(...terminalFrames.slice(1).map((frame, index) => (
      frame.at - terminalFrames[index].at
    )))
    assert.ok(maximumSnapshotGapMs < 1000, `snapshot delivery stalled: ${maximumSnapshotGapMs}`)
    await page.screenshot({ path: `${output}/${exit}-loadout.png` })
    assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [], host: [] })
    return { exit, frozenTick: terminal.tick, contacts: ['world', 'target-attached'], ages: [0, 1, 2, 3, 4],
      samples, terminalFrames: terminalFrames.length, maximumSnapshotGapMs, finalPhase: host.state().run.phase, errors }
  } catch (error) {
    console.error(JSON.stringify({ exit, errors, phase: host.state().run.phase }))
    await page.screenshot({ path: `${output}/${exit}-failure.png` })
    throw error
  } finally {
    await context.close()
    await host.close()
  }
}

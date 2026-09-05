import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { planPlayerCharacterTick } from '../src/game/core-kernels/player-character.ts'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { chromium } from 'playwright-core'
import { preview } from 'vite'

import { NATIVE_MAGE_ACTION_PROGRAMS, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { startGameHost } from '../src/game/host/game-host.ts'
import { boneyardGeometrySha256 } from '../src/game/host/project-boneyard.ts'
import { decodeServerGameMessage } from '../src/game/protocol/game-protocol.ts'
import { createNativeSecondaryPlayerState } from '../src/game/core-kernels/native-secondary-abilities.ts'
import { installGameAudioSmokeProbe } from './game-audio-smoke-probe.mjs'

const screenshotRoot = process.env.SDR_MAGE_EFFECT_SCREENSHOTS || '/tmp/solomon-mage-player-effects'
const credential = randomBytes(32).toString('base64url')
const scene = {
  bounds: { x: 0, y: 0, w: 2400, h: 2000 }, environmentMode: 2,
  fences: [], name: 'Mage contact acceptance', objects: [], roads: [], solomonDig: null,
  spawn: { x: 1200, y: 1000, facingDeg: 180 }, sprites: [], terrain: [],
}
const choice = {
  id: 'mod:mage-contact:arena', name: scene.name, source: 'mod',
  modId: 'mage-contact', modName: 'Mage contact',
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
  await page.getByRole('button', { name: /Water/i }).click()
  await page.locator('.create-menu-disciplines[data-visible="true"]').waitFor()
  await page.locator('.create-menu-discipline-arcane').click()
  await page.locator('.hub-scene[data-renderer-state="ready"]').waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Enter the Boneyard', exact: true }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.boneyard-scene[data-gameplay-input-blocked="false"]').waitFor()
  assert.equal(host.loadedBoneyard().choice.id, choice.id)

  const receipts = []
  for (const [element, protection] of [
    ['fire', 'harden'], ['frost', 'harden'], ['poison', 'harden'], ['lightning', 'harden'],
    ['frost', 'shield'], ['poison', 'shield'],
  ]) receipts.push(await mageImpact(element, protection))
  assert.deepEqual(errors, { page: [], console: [], responses: [], requests: [], wire: [] })
  process.stdout.write(`${JSON.stringify({ status: 'ok', browser: browser.version(), receipts, errors })}\n`)
} catch (error) {
  if (page) await page.screenshot({ path: `${screenshotRoot}/failure.png` })
  process.stderr.write(`${JSON.stringify({ errors, player: playerProgression(), body: page ? await page.locator('body').innerText() : null })}\n`)
  throw error
} finally {
  await browser.close()
  await Promise.all([host.close(), frontend.close()])
}

function playerProgression() {
  const state = host.state()
  return state.playerEntities.progressions[state.playerEntities.identities.findIndex(({ playerId }) => playerId === host.hostPlayerId())]
}

async function mageImpact(element, protection) {
  const playerId = host.hostPlayerId()
  const state = host.state()
  const index = state.playerEntities.identities.findIndex(identity => identity.playerId === playerId)
  const progressions = [...state.playerEntities.progressions]
  progressions[index] = {
    ...progressions[index], currentHealth: 50, maximumHealth: 50, lastDamageTick: null,
    poisonTicksRemaining: 0, poisonDamagePerTick: 0, poisonBeforeCold: false,
    coldSlowTicksRemaining: 0, dazzleTicksRemaining: 0,
  }
  const locomotions = [...state.playerEntities.locomotions]
  locomotions[index] = { ...locomotions[index], position: { x: 1200, y: 1000 }, velocity: { x: 0, y: 0 } }
  const skillRuntimes = [...state.playerEntities.skillRuntimes]
  skillRuntimes[index] = { ...skillRuntimes[index], harden: { armor: protection === 'harden' ? 100 : 0, coating: 0 } }
  Object.assign(state, {
    playerEntities: { ...state.playerEntities, locomotions, progressions, skillRuntimes },
    secondaryAbilities: { ...state.secondaryAbilities, players: {
      ...state.secondaryAbilities.players,
      [playerId]: { ...createNativeSecondaryPlayerState(), magicShieldAbsorb: protection === 'shield' ? 100 : 0,
        magicShieldMaximum: protection === 'shield' ? 100 : 0 },
    } },
    world: { ...state.world, enemies: { ...state.world.enemies, actors: [], projectiles: [], deathEffects: [] } },
  })
  await page.waitForTimeout(200)
  const canvas = page.locator('.boneyard-world-canvas')
  const baseline = await canvas.evaluate(node => ({ tint: node.__sdrBoneyardFrame.playerMaterialTint, tick: node.__sdrBoneyardFrame.tick }))
  const mark = frames.length
  const audioMark = await page.evaluate(() => window.__sdrAudioEvents.length)
  const before = host.state()
  const store = before.world.enemies
  const nextId = store.nextActorId
  const order = createNativeWorldManagerOrder(before.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore({ ...store, lastStepTick: before.tick - 1 }, {
    firstProjectileWorldContact: () => null, players: {}, tick: before.tick,
    registerWorldPainter: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{ enemyToken: 'SKELETONMAGE', flags: [`FLAG_CAST${element.toUpperCase()}`],
      id: nextId, locationPolicy: 'anywhere', nativeTypeId: 1003,
      position: { x: 1050, y: 1000 }, spawnTick: before.tick, waveOrdinal: 1 }],
  }).store
  const mage = spawned.actors.find(actor => actor.id === nextId)
  assert.equal(mage.brain.family, 'mage')
  Object.assign(before, { worldManagerOrder: order.state(), world: { ...before.world, enemies: {
    ...spawned, actors: [{ ...mage, targetPlayerId: playerId, brain: { ...mage.brain,
      phase: 'cast', castProgram: 'short', castRoll: 0,
      actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress, markerEmitted: false } }],
  } } })
  await waitUntil(() => element === 'frost' ? playerProgression().coldSlowTicksRemaining > 0
    : element === 'poison' ? playerProgression().poisonTicksRemaining > 0
      : playerProgression().currentHealth < 49.9, `${element}: impact did not affect player`)
  const contactTick = host.state().tick
  let lightningDuringChannel = null
  if (element === 'lightning') {
    await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')?.__sdrBoneyardFrame?.mageLightningCount > 0)
    lightningDuringChannel = await canvas.evaluate(node => ({ count: node.__sdrBoneyardFrame.mageLightningCount, tick: node.__sdrBoneyardFrame.tick }))
    await page.screenshot({ path: `${screenshotRoot}/lightning-channel.png` })
    await waitUntil(() => host.state().tick >= before.tick + 50, 'lightning channel did not complete')
  }
  const after = host.state()
  Object.assign(after, { world: { ...after.world, enemies: { ...after.world.enemies, actors: [] } } })
  await page.waitForTimeout(180)
  const rendered = await canvas.evaluate(node => {
    const frame = node.__sdrBoneyardFrame
    return { tick: frame.tick, tint: frame.playerMaterialTint, shield: frame.playerMagicShieldVisible,
      lightning: frame.mageLightningCount, deathEffects: frame.enemyDeathEffectVisibleCount }
  })
  const wirePlayers = frames.slice(mark).flatMap(frame => frame.players[playerId] ? [frame.players[playerId]] : [])
  assert.ok(wirePlayers.length > 0)
  if (element === 'frost') {
    assert.ok(wirePlayers.some(player => player.progression.coldSlowTicksRemaining > 0 && player.movementScale < 1))
    assert.notEqual(rendered.tint, baseline.tint)
    assert.ok(rendered.deathEffects >= 12)
    if (protection === 'shield') assert.equal(playerProgression().currentHealth, 50)
  } else if (element === 'poison') {
    assert.ok(wirePlayers.some(player => player.progression.poisonTicksRemaining > 0 && player.progression.poisonDamagePerTick > 0))
    assert.notEqual(rendered.tint, baseline.tint)
    assert.ok(rendered.deathEffects >= 12)
  }
  if (protection === 'harden' || element === 'poison') assert.ok(playerProgression().currentHealth < 50)
  const screenshot = `${screenshotRoot}/${element}-${protection}.png`
  await page.screenshot({ path: screenshot })
  let statusAudio = []
  if (element === 'frost' || element === 'poison') {
    const cue = element === 'frost' ? 'frosted' : 'poisoned'
    statusAudio = await page.evaluate(({ audioMark, cue }) => window.__sdrAudioEvents.slice(audioMark)
      .filter(event => window.__sdrAudioSourceMatches(event.src, `${cue}.wav`)
        && (event.type === 'play' || event.type === 'buffer-start')), { audioMark, cue })
    assert.equal(statusAudio.length, 1, `${element}: first status must play once`)
    assert.equal(statusAudio[0].playbackRate, 1.5)
  }
  const health = playerProgression().currentHealth
  let movement = null
  if (element === 'frost') {
    const slowed = await travelRight(page, index)
    await waitUntil(() => playerProgression().coldSlowTicksRemaining === 0, 'frost did not expire')
    await page.waitForTimeout(200)
    const restored = await canvas.evaluate(node => node.__sdrBoneyardFrame.playerMaterialTint)
    assert.equal(restored, baseline.tint)
    const normal = await travelRight(page, index)
    movement = { slowed, normal, ratio: slowed / normal }
    assert.ok(movement.ratio > 0.45 && movement.ratio < 0.55, 'cold must halve actual player travel per tick')
  }
  if (element === 'poison' && protection === 'shield') {
    await waitUntil(() => playerProgression().poisonTicksRemaining === 0, 'poison did not expire')
    await page.waitForTimeout(200)
    assert.equal(await canvas.evaluate(node => node.__sdrBoneyardFrame.playerMaterialTint), baseline.tint)
  }
  return { element, protection, contactTick, health, baseline, rendered, statusAudio, screenshot, lightningDuringChannel, movement }
}

async function travelRight(page, index) {
  const moving = () => planPlayerCharacterTick(host.state().playerEntities.locomotions[index],
    { movement: { x: 0, y: 0 } }, 1).movementActive
  await page.keyboard.down('d')
  try {
    await waitUntil(moving, 'movement input was not applied')
    const start = { tick: host.state().tick, x: host.state().playerEntities.locomotions[index].position.x }
    await page.waitForTimeout(180)
    const finish = host.state()
    return (finish.playerEntities.locomotions[index].position.x - start.x) / (finish.tick - start.tick)
  } finally {
    await page.keyboard.up('d')
    await waitUntil(() => !moving(), 'movement did not stop')
  }
}

async function waitUntil(predicate, message, timeout = 15_000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error(message)
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

import assert from 'node:assert/strict'
import { createNativeRng, drawNativeInteger } from '../src/game/core-kernels/native-rng.ts'
import { createNativeSpiderWaveState } from '../src/game/core-kernels/native-spider-wave-program.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

/** The waves harness owns the built app, authenticated host, wire decoder and browser. */
export async function acceptSpiderSystem({ host, page, wire, screenshotPath }) {
  let playerId = host.hostPlayerId()
  await openBoneyardCombat(host, playerId)
  let state = host.state()
  const initialWorld = state.world
  assert.equal(initialWorld.kind, 'boneyard')
  assert.ok(initialWorld.waves?.spiderWaves.length)
  const phase = initialWorld.waves.spiderWaves[0]
  const bounds = initialWorld.arenaTransition.combatBounds
  const position = resolveBoneyardSpawnPosition({
    x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2,
  }, bounds, initialWorld.collision, 25)
  state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
    ...getPlayerCharacter(state, playerId), position, velocity: { x: 0, y: 0 }, headingIndex: 6,
  })
  state.world = {
    ...initialWorld,
    enemies: { ...initialWorld.enemies, actors: [], maggots: [], projectiles: [] },
    encounter: { ...initialWorld.encounter, phase: 'gone', targetPlayerId: null },
    arenaTransition: { ...initialWorld.arenaTransition, blendFactor: 1, cameraBounds: bounds, phase: 'sealed', sealTicksRemaining: 0 },
    waves: {
      ...initialWorld.waves, phase: 'interwave', interwaveDelayTicks: 100_000,
      spiderState: createNativeSpiderWaveState(), waveOrdinal: phase.startWave - 1,
    },
  }
  await ticks(host, 20)
  assert.equal(spiders(host).length, 0, 'Spider phase started before its authored wave')
  state = host.state()
  state.world = { ...state.world, waves: { ...state.world.waves, waveOrdinal: phase.startWave } }
  await waitUntil(() => spiders(host).length > 0, 'native survival Spider program did not spawn', 15_000)
  await ticks(host, 25)
  const births = spiders(host).map(actor => ({ id: actor.id, flags: actor.config.flags, spawnTick: actor.spawnTick }))
  const expectedFlags = phase.commands.find(command => command.kind === 'spawn').flags
  assert.ok(births.every(actor => JSON.stringify(actor.flags) === JSON.stringify(expectedFlags)))
  state = host.state()
  state.world = {
    ...state.world,
    enemies: { ...state.world.enemies, actors: state.world.enemies.actors.map((actor, index) => ({
      ...actor, position: resolveBoneyardSpawnPosition({ x: position.x + 150 + index * 45, y: position.y - index * 50 }, bounds, state.world.collision, 15),
      targetPlayerId: playerId, nextTargetRefreshTick: state.tick + 100_000,
      brain: { ...actor.brain, actionState: 3, actionTicksRemaining: 100_000 },
    })) },
  }
  await page.waitForFunction(() => document.querySelector('.boneyard-world-canvas')?.dataset.enemyFamilies.includes('SPIDER'))
  await page.screenshot({ path: imagePath(screenshotPath, 'spiders') })

  const severities = []
  const silkIds = []
  for (let severity = 1; severity <= 3; severity += 1) {
    primeSpit(host, playerId, position, bounds)
    await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
      && wire.latestSnapshot.world.spiderSilks.length > 0, 'client did not receive live Silk', 10_000)
    silkIds.push(...wire.latestSnapshot.world.spiderSilks.map(silk => silk.id))
    await waitUntil(() => host.state().world.enemies.webbedPlayers[playerId]?.severity === severity,
      `Silk did not apply web severity ${severity}`, 10_000)
    await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
      && wire.latestSnapshot.world.webbedPlayers[playerId]?.severity === severity,
    'client did not receive the authoritative web severity', 10_000)
    severities.push(severity)
    await page.screenshot({ path: imagePath(screenshotPath, `web-${severity}`) })
  }
  assert.equal(host.state().world.enemies.actors.filter(actor => actor.brain.family === 'cocoon').length, 1)
  await page.keyboard.down('d')
  const heldPosition = { ...getPlayerCharacter(host.state(), playerId).position }
  await ticks(host, 25)
  await page.keyboard.up('d')
  assert.deepEqual(getPlayerCharacter(host.state(), playerId).position, heldPosition)

  await page.locator('.boneyard-scene').focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10_000 })
  const pausedTick = host.state().tick
  const pausedWeb = { ...host.state().world.enemies.webbedPlayers[playerId] }
  await page.waitForTimeout(300)
  assert.equal(host.state().tick, pausedTick)
  assert.deepEqual(host.state().world.enemies.webbedPlayers[playerId], pausedWeb)
  const runId = host.state().world.runId
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Last game' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  playerId = host.hostPlayerId()
  await waitUntil(() => host.state().world.kind === 'boneyard'
    && host.state().world.runId === runId
    && host.state().world.enemies.webbedPlayers[playerId]?.severity === 3,
  'Last game did not restore the full Cocoon with its owner', 15_000)
  await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
    && wire.latestSnapshot.world.webbedPlayers[playerId]?.severity === 3,
  'client did not render the restored Cocoon', 15_000)
  await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 15_000 })
  await page.screenshot({ path: imagePath(screenshotPath, 'restored') })

  const player = getPlayerCharacter(host.state(), playerId)
  const aim = { x: player.position.x + 250, y: player.position.y }
  const canvas = page.locator('.boneyard-world-canvas')
  const screen = await canvas.evaluate((node, point) => {
    const frame = node.__sdrBoneyardFrame
    const rect = node.getBoundingClientRect()
    return { x: rect.x + rect.width / 2 + (point.x - frame.cameraX) * frame.cameraZoom,
      y: rect.y + rect.height / 2 + (point.y - frame.cameraY) * frame.cameraZoom }
  }, aim)
  await page.mouse.move(screen.x, screen.y)
  await page.mouse.down({ button: 'left' })
  try {
    await waitUntil(() => host.state().world.enemies.webbedPlayers[playerId] === undefined,
      'real primary fire did not break the Cocoon', 12_000)
  } finally { await page.mouse.up({ button: 'left' }) }
  await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
    && wire.latestSnapshot.world.webbedPlayers[playerId] === undefined,
  'client retained the released Cocoon', 10_000)
  assert.ok([...wire.events.values()].some(event => event.type === 'cocoon-released'))
  await page.screenshot({ path: imagePath(screenshotPath, 'released') })

  state = host.state()
  const victim = spiders(host)[0]
  assert.ok(victim)
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const killed = damageBoneyardEnemy(state.world.enemies, {
    actorId: victim.id, amount: victim.currentHealth, magic: true, sourcePlayerId: playerId,
    tick: state.tick, registerWorldPainter: order.register,
  })
  state.world = { ...state.world, enemies: killed.store }
  state.worldManagerOrder = order.state()
  await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
    && wire.latestSnapshot.world.spiderRemains.some(remains => remains.state.decal !== null),
  'normal Spider death did not replicate its corpse and decal', 10_000)
  await page.screenshot({ path: imagePath(screenshotPath, 'corpse') })
  const audio = await page.evaluate(() => window.__sdrAudioPlaySources.map(source => new URL(source, location.href).pathname))
  for (const name of ['shoot-web-', 'disintegrate', 'webbed-', 'spider-die']) {
    assert.ok(audio.some(source => source.includes(name)), `missing real audio playback: ${name}`)
  }
  return { phase: phase.name, startWave: phase.startWave, births, severities, silkIds, pausedTick, restoredRunId: runId, audio: audio.filter(source => /shoot-web|disintegrate|webbed-|spider-die/.test(source)) }
}

function spiders(host) { return host.state().world.enemies.actors.filter(actor => actor.config.enemyToken === 'SPIDER' && actor.lifeState === 'alive') }
function imagePath(path, label) { return path.replace(/(\.[^.]+)$/, `-${label}$1`) }
async function ticks(host, count) {
  const target = host.state().tick + count
  await waitUntil(() => host.state().tick >= target, 'host simulation stopped advancing', 10_000)
}

function primeSpit(host, playerId, position, bounds) {
  const state = host.state()
  const victim = spiders(host)[0]
  assert.ok(victim)
  let seed = 0
  while (drawNativeInteger(createNativeRng(seed), 2).value !== 1) seed += 1
  state.world = { ...state.world, enemies: {
    ...state.world.enemies, spiderSpitTicksRemaining: 0, steeringRngState: createNativeRng(seed),
    actors: state.world.enemies.actors.map(actor => actor.id !== victim.id ? actor : {
      ...actor, targetPlayerId: playerId, nextTargetRefreshTick: state.tick + 100_000,
      position: resolveBoneyardSpawnPosition({ x: position.x + 150, y: position.y }, bounds, state.world.collision, 15),
      brain: { ...actor.brain, actionState: 0, spitTicksRemaining: 0, preferredDistance: 400, attached: false },
    }),
  } }
}

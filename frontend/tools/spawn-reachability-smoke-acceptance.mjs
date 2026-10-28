import assert from 'node:assert/strict'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-director.ts'
import { canPlaceBoneyardBody } from '../src/game/core-server/boneyard-collision.ts'
import { findBoneyardEnemyRoute } from '../src/game/core-server/boneyard-enemy-navigation.ts'
import { getPlayerCharacter, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

const targets = [
  { x: 1677.5550758053128, y: 1662.4328215429884 },
  { x: 1889.337238244112, y: 2017.5395967006748 },
  { x: 1892.5419160366123, y: 2014.3349189081746 },
  { x: 1896.25439403125, y: 2011.7354138308917 },
  { x: 1900.3618704627625, y: 2009.8200661151864 },
  { x: 1904.7395417382616, y: 2008.6470726321872 },
  { x: 1083.281494140625, y: 3095.406251 },
]

/** The established waves harness owns the real client, wire decoder and isolated host. */
export async function acceptSpawnReachability({ host, page, wire, screenshotPath }) {
  assert.equal(wire.loadedBoneyard.sourceSha256,
    '624b79ae325daa714b24017e0a308c64519f7481eb206e4489968217b1a2e123')
  let playerId = host.hostPlayerId()
  await openBoneyardCombat(host, playerId)
  await waitUntil(() => host.state().world.arenaTransition.phase === 'sealed',
    'native arena did not finish sealing', 15_000)
  const runId = host.state().world.runId
  const families = ['SKELETON', 'SKELETONARCHER', 'ZOMBIE', 'DEMON']
  const receipts = []
  for (const [index, target] of targets.entries()) {
    receipts.push(await spawnAtTarget(target, families[index % families.length], index))
  }

  await page.locator('.boneyard-scene').focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10_000 })
  const pausedTick = host.state().tick
  await page.waitForTimeout(300)
  assert.equal(host.state().tick, pausedTick)
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Last game' }).click()
  await page.locator('.boneyard-scene[data-renderer-state="ready"]').waitFor({ timeout: 90_000 })
  await page.locator('.main-menu-page[data-gameplay-resume-grace="none"]').waitFor({ timeout: 15_000 })
  assert.equal(host.state().world.runId, runId)
  playerId = host.hostPlayerId()
  receipts.push(await spawnAtTarget(targets[1], 'DEMON', targets.length))
  assert.equal(await page.getByRole('dialog', { name: 'Disconnected from server' }).count(), 0)
  return { runId, pausedTick, receipts, restored: true,
    fixture: 'Real College/Boneyard admission; public native map; legal player roots, health replenishment and explicit spawn intents only' }

  async function spawnAtTarget(target, enemyToken, index) {
    const state = host.state()
    assert.equal(state.world.kind, 'boneyard')
    const bounds = state.world.arenaTransition.combatBounds
    assert.ok(canPlaceBoneyardBody(target, bounds, state.world.collision, 25))
    state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
      ...getPlayerCharacter(state, playerId), position: target, velocity: { x: 0, y: 0 },
    })
    state.playerEntities = { ...state.playerEntities, progressions: state.playerEntities.progressions.map(row => ({
      ...row, currentHealth: row.maximumHealth, currentMana: row.maximumMana,
    })) }
    state.world = { ...state.world, waves: { ...state.world.waves, phase: 'interwave', interwaveDelayTicks: 100_000 } }
    const beforeIds = new Set(state.world.enemies.actors.map(actor => actor.id))
    const result = stepGameSimulationTick(state, {}, { enemySpawnIntents: [{
      id: 90_000 + index, enemyToken, nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken],
      flags: [], locationPolicy: 'anywhere', positionPolicy: 'dark', spawnTick: state.tick + 1,
      waveOrdinal: 1, position: { x: 2515.25634765625, y: 1162.121337890625 },
    }] })
    Object.assign(state, result)
    const actor = state.world.enemies.actors.find(row => !beforeIds.has(row.id))
    assert.ok(actor, 'normal world materialization did not admit the requested enemy')
    assert.ok(canPlaceBoneyardBody(actor.position, bounds, state.world.collision, actor.config.collisionRadius))
    assert.ok(findBoneyardEnemyRoute({ start: actor.position, end: target, bounds,
      world: state.world.collision, bodyRadius: actor.config.collisionRadius,
      endBodyRadius: 25, clearance: enemyToken === 'DEMON' ? 50 : 25 }))
    await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
      && wire.latestSnapshot.world.enemies.some(row => row.id === actor.id),
    'client did not receive the newly materialized enemy', 15_000)
    const spawnTick = state.tick
    await waitUntil(() => host.state().tick >= spawnTick + 30,
      'authoritative gameplay stopped after placement', 10_000)
    await page.screenshot({ path: screenshotPath.replace(/(\.[^.]+)?$/, `-pocket-${index}$1`) })
    return { enemyToken, id: actor.id, target, position: actor.position,
      radius: actor.config.collisionRadius, spawnTick, continuedTick: host.state().tick }
  }
}

import assert from 'node:assert/strict'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { getPlayerCharacter, getPlayerProgression } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

export async function acceptGroundEffects({ host, page, wire, screenshotPath }) {
  const playerId = host.hostPlayerId()
  await openBoneyardCombat(host, playerId)
  const state = host.state()
  const world = state.world
  const bounds = world.arenaTransition.combatBounds
  const center = resolveBoneyardSpawnPosition({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, bounds, world.collision, 25)
  const start = resolveBoneyardSpawnPosition({ x: center.x - 100, y: center.y }, bounds, world.collision, 25)
  state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
    ...getPlayerCharacter(state, playerId), position: start, velocity: { x: 0, y: 0 },
  })
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const staged = stepBoneyardEnemyStore({ ...world.enemies, actors: [], deathEffects: [],
    maggots: [], projectiles: [], lastStepTick: state.tick - 1 }, {
    tick: state.tick, paused: true, players: {}, projectileWorldBlocked: () => false,
    registerWorldPainter: order.register, resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [
      { enemyToken: 'ZOMBIE', nativeTypeId: 1006, flags: [] },
      { enemyToken: 'ZOMBIE', nativeTypeId: 1006, flags: ['FLAG_ROTTEN'] },
      { enemyToken: 'SPIDER', nativeTypeId: 2057, flags: [] },
    ].map((recipe, index) => ({ ...recipe, id: index + 1, locationPolicy: 'anywhere',
      spawnTick: state.tick, waveOrdinal: 0,
      position: { x: center.x, y: center.y + (index - 1) * 25 },
    })),
  })
  let enemies = { ...staged.store, actors: staged.store.actors.map(actor => ({ ...actor,
    config: { ...actor.config, experience: 0 }, nextMovementTick: Number.MAX_SAFE_INTEGER,
    nextTargetRefreshTick: Number.MAX_SAFE_INTEGER, targetPlayerId: null,
  })) }
  assert.equal(enemies.actors.length, 3)
  for (const actor of enemies.actors) {
    enemies = damageBoneyardEnemy(enemies, { actorId: actor.id, amount: 100000,
      sourcePlayerId: playerId, tick: state.tick, registerWorldPainter: order.register }).store
  }
  state.worldManagerOrder = order.state()
  state.world = { ...world, enemies,
    encounter: { ...world.encounter, phase: 'gone', targetPlayerId: null },
    arenaTransition: { ...world.arenaTransition, blendFactor: 1, cameraBounds: bounds,
      phase: 'sealed', sealTicksRemaining: 0 },
    waves: { ...world.waves, phase: 'interwave', interwaveDelayTicks: 1000000 },
  }
  await waitUntil(() => {
    const current = wire.latestSnapshot?.world
    return current?.kind === 'boneyard' && current.enemyProjectiles.some(p => p.kind === 'poison-pool')
      && current.spiderRemains.some(r => r.state.decal !== null)
      && current.deathEffects.filter(effect => effect.kind === 'fade-perspective-clipped').length === 2
  }, 'ground effects did not reach the browser', 15000)
  const stains = wire.latestSnapshot.world.deathEffects.filter(effect => effect.kind === 'fade-perspective-clipped')
  assert.ok(stains.every(effect => effect.presentationOwner === 'background' && effect.painterRegistration === null))
  const startingHealth = getPlayerProgression(host.state(), playerId).currentHealth
  assert.equal(getPlayerProgression(host.state(), playerId).poisonTicksRemaining, 0)
  await page.locator('.boneyard-scene').focus()
  await page.keyboard.down('d')
  try {
    await waitUntil(() => getPlayerProgression(host.state(), playerId).poisonTicksRemaining > 0,
      'walking onto the pool did not apply poison', 10000)
  } finally { await page.keyboard.up('d') }
  await waitUntil(() => getPlayerProgression(host.state(), playerId).currentHealth < startingHealth,
    'poison did not damage the player', 10000)
  const poisoned = getPlayerProgression(host.state(), playerId)
  assert.ok(getPlayerCharacter(host.state(), playerId).position.x > start.x)
  await waitUntil(() => wire.latestSnapshot?.players[playerId]?.progression.poisonTicksRemaining > 0,
    'poison status did not replicate', 10000)
  await page.screenshot({ path: screenshotPath })
  const samples = await page.locator('.boneyard-world-canvas').evaluate(canvas => ({
    renderer: canvas.dataset.rendererName,
    environmentLights: canvas.__sdrBoneyardFrame.environmentLightSamples,
    health: canvas.__sdrBoneyardFrame.localPlayerHealth,
  }))
  assert.equal(samples.renderer, 'webgl')
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10000 })
  const pausedTick = host.state().tick
  await page.waitForTimeout(200)
  assert.equal(host.state().tick, pausedTick)
  await page.keyboard.press('Escape')
  await pause.waitFor({ state: 'hidden', timeout: 10000 })

  const retiring = host.state()
  retiring.world = { ...retiring.world, enemies: { ...retiring.world.enemies,
    projectiles: retiring.world.enemies.projectiles.map(projectile => projectile.kind === 'poison-pool'
      ? { ...projectile, ageTicks: 3100 } : projectile),
    deathEffects: retiring.world.enemies.deathEffects.map(effect =>
      effect.kind === 'fade-perspective-clipped' || effect.kind === 'late-splat'
        ? { ...effect, opacityTimer: .02 } : effect),
    spiderRemains: retiring.world.enemies.spiderRemains.map(remains => ({ ...remains, state: { ...remains.state, life: .02 } })),
  } }
  await waitUntil(() => wire.latestSnapshot.world.enemyProjectiles.some(p => p.kind === 'poison-pool' && p.ageTicks > 3100),
    'pool fade did not replicate', 10000)
  await waitUntil(() => {
    const current = wire.latestSnapshot.world
    return current.kind === 'boneyard' && !current.enemyProjectiles.some(p => p.kind === 'poison-pool')
      && current.spiderRemains.length === 0
      && !current.deathEffects.some(effect => effect.kind === 'fade-perspective-clipped' || effect.kind === 'late-splat')
  }, 'ground effects did not retire', 15000)
  await page.keyboard.press('Escape')
  await pause.waitFor({ timeout: 10000 })
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30000 })
  assert.equal(await page.locator('.boneyard-world-canvas').count(), 0)
  return { stains: stains.length, startingHealth, poisonedHealth: poisoned.currentHealth,
    poisonTicks: poisoned.poisonTicksRemaining, samples, pausedTick, retired: true, rendererReleased: true }
}

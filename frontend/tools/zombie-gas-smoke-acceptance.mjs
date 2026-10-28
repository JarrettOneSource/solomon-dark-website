import assert from 'node:assert/strict'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import { getPlayerCharacter, getPlayerProgression } from '../src/game/core-server/game-simulation.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { openBoneyardCombat, waitUntil } from './game-smoke-navigation.mjs'

export async function acceptZombieGasSystem({ host, page, wire, screenshotPath }) {
  const playerId = host.hostPlayerId()
  await openBoneyardCombat(host, playerId)
  const state = host.state()
  const world = state.world
  const bounds = world.arenaTransition.combatBounds
  const center = resolveBoneyardSpawnPosition({ x: bounds.x + bounds.w / 2,
    y: bounds.y + bounds.h / 2 }, bounds, world.collision, 25)
  state.playerEntities = replacePlayerCharacter(state.playerEntities, playerId, {
    ...getPlayerCharacter(state, playerId), position: center, velocity: { x: 0, y: 0 },
  })
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const staged = stepBoneyardEnemyStore({ ...world.enemies, actors: [], deathEffects: [],
    maggots: [], projectiles: [], lastStepTick: state.tick - 1 }, {
    tick: state.tick, paused: true, players: {}, projectileWorldBlocked: () => false,
    registerWorldPainter: order.register,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => Array.from({ length: 9 }, (_, index) => ({
      enemyToken: 'ZOMBIE', flags: index === 8 ? [] : ['FLAG_ROTTEN'], id: index + 1,
      locationPolicy: 'anywhere', nativeTypeId: 1006, spawnTick: state.tick, waveOrdinal: 0,
      position: resolveBoneyardSpawnPosition({ x: center.x + (index % 3 - 1) * 100,
        y: center.y - 120 - Math.floor(index / 3) * 75 }, bounds, world.collision, 15),
    })),
  })
  const actors = staged.store.actors.map(actor => ({ ...actor, targetPlayerId: null,
    // Keep retirement observable without entering a level-up choice barrier.
    config: { ...actor.config, experience: 0 },
    nextMovementTick: Number.MAX_SAFE_INTEGER, nextTargetRefreshTick: Number.MAX_SAFE_INTEGER }))
  const rottenIds = new Set(actors.filter(actor => actor.config.family.rotten).map(actor => actor.id))
  assert.equal(rottenIds.size, 8)
  state.worldManagerOrder = order.state()
  state.world = { ...world, enemies: { ...staged.store, actors },
    encounter: { ...world.encounter, phase: 'gone', targetPlayerId: null },
    arenaTransition: { ...world.arenaTransition, blendFactor: 1, cameraBounds: bounds,
      phase: 'sealed', sealTicksRemaining: 0 },
    waves: { ...world.waves, phase: 'interwave', interwaveDelayTicks: 1_000_000 },
  }
  const hostBirths = new Map()
  const wireBirths = new Map()
  const wireEffects = new Set()
  await waitUntil(() => {
    const current = host.state()
    for (const effect of current.world.enemies.deathEffects) {
      if (effect.role !== 'zombie-rotten-particle') continue
      assert.ok(rottenIds.has(effect.ownerActorId), 'ordinary Zombie must not emit gas')
      if (effect.spawnTick !== current.tick) continue
      assert.equal(effect.framePhase, effect.frameVelocity)
      assert.ok(effect.alpha >= .017 && effect.alpha <= .035,
        `gas ${effect.id} was published at alpha ${effect.alpha}`)
      hostBirths.set(effect.id, { alpha: effect.alpha, phase: effect.framePhase, tick: effect.spawnTick })
    }
    const snapshot = wire.latestSnapshot
    if (snapshot?.world.kind === 'boneyard') {
      for (const effect of snapshot.world.deathEffects) {
        if (effect.kind !== 'move-fade-sin') continue
        assert.equal(effect.tint, 0x2d3f2d)
        assert.equal(effect.blendMode, 'normal')
        assert.equal(effect.presentationOwner, 'pre-world-queue')
        assert.ok(effect.entry === 10 || effect.entry === 11)
        wireEffects.add(effect.id)
        if (effect.ageTicks === 0) {
          // Compact snapshots round alpha to 1/1024.
          assert.ok(effect.alpha >= Math.round(Math.sin(Math.PI / 180) * 1024) / 1024
            && effect.alpha <= Math.round(Math.sin(2 * Math.PI / 180) * 1024) / 1024)
          wireBirths.set(effect.id, effect.alpha)
        }
      }
    }
    return hostBirths.size >= 20 && wireBirths.size >= 2
  }, 'did not observe newborn gas through the authoritative host and real socket', 20_000)
  await page.screenshot({ path: imagePath(screenshotPath, 'gas') })
  await page.locator('.boneyard-scene').focus()
  await page.keyboard.press('Escape')
  const pause = page.locator('.gameplay-pause-stage[data-gameplay-pause-view="owner"]')
  await pause.waitFor({ timeout: 10_000 })
  const pausedTick = host.state().tick
  const pausedEffects = JSON.stringify(host.state().world.enemies.deathEffects)
  await page.waitForTimeout(250)
  assert.equal(host.state().tick, pausedTick)
  assert.equal(JSON.stringify(host.state().world.enemies.deathEffects), pausedEffects)
  await page.keyboard.press('Escape')
  await pause.waitFor({ state: 'hidden', timeout: 10_000 })
  await waitUntil(() => host.state().tick > pausedTick, 'resume did not advance the host', 10_000)
  const killing = host.state()
  const killOrder = createNativeWorldManagerOrder(killing.worldManagerOrder)
  let enemies = killing.world.enemies
  for (const actor of enemies.actors) {
    if (!rottenIds.has(actor.id)) continue
    enemies = damageBoneyardEnemy(enemies, { actorId: actor.id, amount: 100_000,
      sourcePlayerId: playerId, tick: killing.tick, registerWorldPainter: killOrder.register }).store
  }
  assert.ok(enemies.deathEffects.some(effect => effect.role === 'zombie-rotten-particle'))
  killing.world = { ...killing.world, enemies }
  killing.worldManagerOrder = killOrder.state()
  await waitUntil(() => {
    const current = host.state()
    assert.deepEqual(getPlayerProgression(current, playerId).pendingLevels, [])
    return !current.world.enemies.deathEffects.some(effect => effect.role === 'zombie-rotten-particle')
  }, 'detached gas failed to retire after its parents died', 10_000)
  await waitUntil(() => wire.latestSnapshot?.world.kind === 'boneyard'
    && !wire.latestSnapshot.world.deathEffects.some(effect => effect.kind === 'move-fade-sin'),
  'client retained expired gas', 10_000)
  await page.screenshot({ path: imagePath(screenshotPath, 'retired') })
  await page.locator('.boneyard-scene').focus()
  await page.keyboard.press('Escape')
  await pause.waitFor({ timeout: 10_000 })
  await pause.getByRole('button', { name: 'LEAVE GAME' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor({ timeout: 30_000 })
  assert.equal(await page.locator('.boneyard-world-canvas').count(), 0)
  return { hostBirths: [...hostBirths.values()], wireBirths: [...wireBirths.values()],
    wireEffects: wireEffects.size, pausedTick, retired: true, rendererReleased: true }
}

function imagePath(path, label) { return path.replace(/(\.[^.]+)$/, `-${label}$1`) }

import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeSilk } from '../core-kernels/native-silk.ts'
import { createNativeSilkFragments } from '../core-kernels/native-silk-force.ts'
import { createNativeDeadSpider } from '../core-kernels/native-dead-spider.ts'
import { applyNativeWebbed } from '../core-kernels/native-webbed.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../host/boneyard-catalog.ts'
import { createGameSimulation, enterBoneyardWorld, removePlayerCharacter } from '../core-server/game-simulation.ts'
import { stepBoneyardEnemyStore } from '../core-server/boneyard-enemy-store.ts'
import { addNativeCocoon } from '../core-server/enemies/construction.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from './game-save-document.ts'

test('schema 33 resumes Spider brains, web restraints, Silk, fragment and corpse ownership without replaying births', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 67))!
  const state = enterBoneyardWorld(createGameSimulation({ owner: {
    displayName: 'Spider save', element: 'fire', discipline: 'arcane',
  } }), loaded)
  if (state.world.kind !== 'boneyard') throw new Error('Expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const position = state.world.spawn
  const players = { owner: {
    alive: true, connected: true, eligible: true, collisionRadius: 25,
    position, headingDeg: 90, velocityPerTick: { x: 0, y: 0 },
  } }
  let enemies = stepBoneyardEnemyStore(state.world.enemies, {
    tick: 0, players, lightAt: () => 1, projectileWorldBlocked: () => false,
    resolveMovement: request => request.requestedPosition, registerWorldPainter: order.register,
    resolveSpawnIntents: () => [{
      enemyToken: 'SPIDER', nativeTypeId: 2057, flags: [], id: 1,
      locationPolicy: 'anywhere', position, spawnTick: 0, waveOrdinal: 4,
    }],
  }).store
  const web = applyNativeWebbed(applyNativeWebbed(applyNativeWebbed(null, 10), 20), 10)
  enemies = addNativeCocoon({ ...enemies, webbedPlayers: { owner: web } }, 'owner', position, players, 0, order.register).store
  const silk = createNativeSilk(position, { position: { x: position.x + 100, y: position.y }, velocityPerTick: { x: 0, y: 0 } }, 20, createNativeRng(37)).state
  const fragments = createNativeSilkFragments({ ...silk, phase: 2 }, { x: 1, y: 0 }, () => 1, createNativeRng(9))
  enemies = {
    ...enemies, nextProjectileId: 2, nextDeathEffectId: 2 + fragments.fragments.length,
    nextNativeRegistrationOrder: enemies.nextNativeRegistrationOrder + 1,
    nextNativeCellBindingOrder: enemies.nextNativeCellBindingOrder + 1,
    silks: [{ id: 1, ownerActorId: 1, spawnTick: 0, state: silk,
      painterRegistration: order.register('actor'), nativeRegistrationOrder: enemies.nextNativeRegistrationOrder,
      nativeCellBindingOrder: enemies.nextNativeCellBindingOrder }],
    spiderRemains: [{ id: 1, spawnTick: 0, state: createNativeDeadSpider(position, 180) }],
    silkFragments: fragments.fragments.map((state, index) => ({ id: 2 + index, spawnTick: 0, state })),
  }
  const saved = { ...state, world: { ...state.world, enemies }, worldManagerOrder: order.state() }
  const document = createGameSaveDocument({ integrity: 'local-only', loadedBoneyard: loaded,
    mods: [], modState: {}, playerId: 'owner', state: saved })
  const restored = restoreGameSaveDocument(document).state
  if (restored.world.kind !== 'boneyard') throw new Error('Expected restored Boneyard')
  assert.equal(JSON.stringify(restored.world.enemies), JSON.stringify(saved.world.enemies))
  assert.deepEqual(restored.world.waves?.spiderState, saved.world.waves?.spiderState)
  const removed = removePlayerCharacter(restored, 'owner')
  if (removed.world.kind !== 'boneyard') throw new Error('Expected retained world')
  assert.deepEqual(removed.world.enemies.webbedPlayers, {})
  assert.equal(removed.world.enemies.actors.some(actor => actor.brain.family === 'cocoon'), false)
  assert.equal(removed.world.enemies.silks.length, 1)
})

test('published schema 32 saves retain projectile state and initialize only upcoming Spider phases', () => {
  const loaded = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))!
  const state = enterBoneyardWorld(createGameSimulation({ owner: {
    displayName: 'Published save', element: 'fire', discipline: 'arcane',
  } }), loaded)
  if (state.world.kind !== 'boneyard' || state.world.waves === null) throw new Error('Expected survival')
  const knockback = {
    actorId: 1, delta: { x: -4.5, y: 0 }, eventId: 1,
    lastStepTick: 0, playerId: 'owner', remainingTicks: 5,
  }
  const bindings = { owner: { cellX: 0, cellY: 0, order: 1 } }
  const saved = {
    ...state,
    world: {
      ...state.world,
      enemies: {
        ...state.world.enemies, lastStepTick: 0, nextActorId: 2, nextEventId: 2,
        nextNativeCellBindingOrder: 2, projectileKnockbacks: [knockback], targetCellBindings: bindings,
      },
      waves: { ...state.world.waves, waveOrdinal: 20 },
    },
  }
  const legacy = JSON.parse(createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: loaded, mods: [], modState: {}, playerId: 'owner', state: saved,
  }))
  legacy.schemaVersion = 32
  const world = legacy.continuation.simulation.world
  for (const key of ['silks', 'silkFragments', 'spiderRemains', 'webbedPlayers', 'spiderSpitTicksRemaining']) {
    delete world.enemies[key]
  }
  delete world.waves.spiderWaves
  delete world.waves.spiderState
  const restored = restoreGameSaveDocument(JSON.stringify(legacy)).state.world
  if (restored.kind !== 'boneyard' || restored.waves === null) throw new Error('Expected restored survival')
  assert.deepEqual(restored.enemies.projectileKnockbacks, [knockback])
  assert.deepEqual(restored.enemies.targetCellBindings, bindings)
  assert.deepEqual(restored.enemies.silks, [])
  assert.deepEqual(restored.enemies.webbedPlayers, {})
  const { spiderWaves, spiderState } = restored.waves
  assert.ok(spiderWaves.length > 0)
  assert.ok(spiderWaves.slice(0, spiderState.phaseIndex).every(phase => phase.startWave < 20))
  assert.ok(spiderWaves.slice(spiderState.phaseIndex).every(phase => phase.startWave >= 20))
  assert.equal(spiderState.active, false)
})

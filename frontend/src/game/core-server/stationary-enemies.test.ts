import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveActorMotion } from '../core-kernels/actor-physics.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import type { BoneyardEnemySpawnIntent } from '../core-kernels/boneyard-wave-director.ts'
import { createNativeHurricanePresentation } from '../core-kernels/native-hurricane.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256, nativePortalRecipe } from '../core-kernels/native-survival-portal.ts'
import { createPrimarySpellSimulation } from '../core-kernels/primary-spells.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { materializeStockTutorial } from '../host/boneyard-catalog.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../save/game-save-document.ts'
import { createBoneyardEnemyStore, positionBoneyardEnemy, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import { boneyardEnemyBodies } from './boneyard-world-placement.ts'
import { resolveBoneyardSpellCombat } from './boneyard-spell-combat.ts'
import type { BoneyardEnemyStore } from './enemies/model.ts'
import { createGameSimulation, enterBoneyardWorld } from './game-simulation.ts'

const position = { x: 100, y: 0 }
const context = {
  players: {}, projectileWorldBlocked: () => false,
  resolveSpawnIntents: () => [],
  resolveMovement: (request: { requestedPosition: Readonly<{ x: number; y: number }> }) => request.requestedPosition,
}

function spawn(intent: BoneyardEnemySpawnIntent): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('stationary-hostiles'), {
    ...context, tick: 0, resolveSpawnIntents: () => [intent],
  }).store
}

function advance(store: BoneyardEnemyStore, tick: number): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(store, { ...context, tick }).store
}

function intent(enemyToken: BoneyardEnemySpawnIntent['enemyToken']): BoneyardEnemySpawnIntent {
  return { enemyToken, nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES[enemyToken], flags: [],
    id: 1, locationPolicy: 'anywhere', position, spawnTick: 0, waveOrdinal: 40 }
}

function hurricane(store: BoneyardEnemyStore) {
  return resolveBoneyardSpellCombat(store, { ...createPrimarySpellSimulation(), transients: [{
    ...createNativeHurricanePresentation(createNativeRng(29)).program,
    ageTicks: 1, birthTick: 0, charge: 1, contactCharge: 1,
    damageMinimum: 10, damageMaximum: 20, enhancedEffects: true,
    id: 10, kind: 'air-hurricane', ownerId: 'wizard', phaseDegrees: 0,
    position: { x: 0, y: 0 }, worldKey: 'stationary-hostiles',
  }] }, [], 1, 'stationary-hostiles', createNativeRng(2900))
}

for (const [sha, program] of Object.entries(NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256)) {
  for (const phase of program.phases) {
    test(`${sha.slice(0, 8)} ${phase.name} resists bodies and never receives Hurricane contact`, () => {
      let store = spawn({ ...intent('PORTAL'), authoredRecipe: nativePortalRecipe(phase) })
      assert.equal(boneyardEnemyBodies(store)[0]!.pushResistance, 150)
      for (let tick = 1; tick <= 10; tick++) store = advance(store, tick)
      const result = hurricane(store)
      assert.deepEqual(result.enemies.actors[0]!.position, position)
      assert.equal(result.enemies.actors[0]!.currentHealth, phase.maximumHealth)
      assert.deepEqual(result.hits, [])
      assert.deepEqual(result.rng, createNativeRng(2900))
    })
  }
}

for (const token of ['COFFIN', 'COCOON'] as const) {
  test(`${token} owns its tick instead of receiving Badguy Hurricane contact`, () => {
    const source = spawn(intent(token))
    const actor = source.actors[0]!
    const store = { ...source, actors: [{ ...actor, currentHealth: 100,
      hurricaneContactCooldown: 0,
      brain: actor.brain.family === 'coffin' ? { ...actor.brain, phase: 'open' as const } : actor.brain,
    }] }
    const result = hurricane(store)
    assert.deepEqual(result.enemies.actors[0]!.position, position)
    assert.equal(result.enemies.actors[0]!.currentHealth, 100)
    assert.deepEqual(result.hits, [])
    assert.deepEqual(result.rng, createNativeRng(2900))
  })
}

test('Portal captures its settled materialization root and restores it after an external impulse', () => {
  const phase = Object.values(NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256)[0]!.phases[0]!
  let store = spawn({ ...intent('PORTAL'), authoredRecipe: nativePortalRecipe(phase) })
  const settled = { x: 120, y: 20 }
  store = positionBoneyardEnemy(store, 1, settled).store
  for (let tick = 1; tick <= 10; tick++) store = advance(store, tick)
  for (let tick = 11; tick <= 20; tick++) {
    const impulse = { x: settled.x + 5, y: settled.y - 3 }
    const moved = positionBoneyardEnemy(store, 1, impulse)
    assert.equal(moved.accepted, true, 'the native MoveByDelta override still accepts impulses')
    assert.deepEqual(moved.store.actors[0]!.position, impulse)
    store = advance(moved.store, tick)
    assert.deepEqual(store.actors[0]!.position, settled)
  }
})

test('Coffin restores its initialized root through every living phase after external impulses', () => {
  let source = spawn(intent('COFFIN'))
  assert.equal(boneyardEnemyBodies(source).length, 0, 'hidden Coffin is not a contact body')
  const actor = source.actors[0]!
  assert.ok(actor.brain.family === 'coffin')
  for (const phase of ['hidden', 'rising', 'holding', 'opening', 'open'] as const) {
    source = { ...source, actors: [{ ...actor, brain: { ...actor.brain, phase } }] }
    if (phase !== 'hidden') assert.equal(boneyardEnemyBodies(source)[0]!.pushResistance, 1)
    const moved = positionBoneyardEnemy(source, 1, { x: 125, y: 30 }).store
    assert.deepEqual(advance(moved, 1).actors[0]!.position, position)
  }
})

test('mobile Badguy children retain Hurricane motion and damage', () => {
  for (const token of ['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE', 'IMP', 'ZOMBIE', 'WRAITH', 'DEMON', 'SPIDER'] as const) {
    const source = spawn(intent(token))
    const store = { ...source, actors: source.actors.map(actor => ({ ...actor,
      currentHealth: 100, hurricaneContactCooldown: 0,
    })) }
    const result = hurricane(store)
    assert.notDeepEqual(result.enemies.actors[0]!.position, position, token)
    assert.ok(result.enemies.actors[0]!.currentHealth < 100, token)
  }
})

test('a player walking into a Portal separates without moving its root', () => {
  const phase = Object.values(NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256)[0]!.phases[0]!
  let store = spawn({ ...intent('PORTAL'), authoredRecipe: nativePortalRecipe(phase) })
  for (let tick = 1; tick <= 10; tick++) store = advance(store, tick)
  let bodies = [{ id: 'player', position: { x: 50, y: 0 }, radius: 25,
    delta: { x: 5, y: 0 }, pushStrength: 12, pushResistance: 10, driven: true,
  }, ...boneyardEnemyBodies(store)]
  for (let tick = 0; tick < 60; tick++) {
    bodies = resolveActorMotion(bodies, {
      canPlace: () => true,
      move: (_id, root, delta) => ({ x: root.x + delta.x, y: root.y + delta.y }),
    }, () => true)
    assert.deepEqual(bodies[1]!.position, position)
  }
  assert.ok(bodies[0]!.position.x <= 70)
})

test('stationary roots survive save/resume and legacy roots migrate without inventing an old position', () => {
  const loadedBoneyard = materializeStockTutorial(Buffer.alloc(16, 8))
  const state = enterBoneyardWorld(createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Anchor save', element: 'air' },
  }), loadedBoneyard)
  assert.ok(state.world.kind === 'boneyard')
  const phase = Object.values(NATIVE_PORTAL_PROGRAM_BY_SOURCE_SHA256)[0]!.phases[0]!
  for (const token of ['PORTAL', 'COFFIN'] as const) {
    const order = createNativeWorldManagerOrder(state.worldManagerOrder)
    let store = stepBoneyardEnemyStore(state.world.enemies, { ...context, tick: 0,
      registerWorldPainter: order.register, resolveSpawnIntents: () => [{ ...intent(token),
        ...(token === 'PORTAL' ? { authoredRecipe: nativePortalRecipe(phase) } : {}),
      }],
    }).store
    for (let tick = 1; tick <= 10; tick++) store = stepBoneyardEnemyStore(store, {
      ...context, tick, registerWorldPainter: order.register,
    }).store
    const displaced = { x: 125, y: 20 }
    store = positionBoneyardEnemy(store, 1, displaced).store
    const document = createGameSaveDocument({ loadedBoneyard, playerId: 'owner',
      mods: [], modState: {}, integrity: 'local-only', state: { ...state, tick: 10,
        world: { ...state.world, enemies: store }, worldManagerOrder: order.state(),
      },
    })
    for (const legacy of [false, true]) {
      const parsed = JSON.parse(document)
      if (legacy) {
        parsed.schemaVersion = 37
        delete parsed.continuation.simulation.world.enemies.actors[0].brain.anchorPosition
      }
      const restored = restoreGameSaveDocument(JSON.stringify(parsed)).state
      assert.ok(restored.world.kind === 'boneyard')
      assert.deepEqual(advance(restored.world.enemies, 11).actors[0]!.position,
        legacy ? displaced : position)
    }
    const invalid = JSON.parse(document)
    invalid.continuation.simulation.world.enemies.actors[0].brain.anchorPosition.x = 'invalid'
    assert.throws(() => restoreGameSaveDocument(JSON.stringify(invalid)), /anchor X/)
  }
})

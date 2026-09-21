import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { nativeFacultyRecipe } from '../src/game/core-kernels/native-survival-faculty.ts'
import { createNativeWorldManagerOrder } from '../src/game/core-kernels/native-world-manager-order.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { damageBoneyardEnemy } from '../src/game/core-server/enemies/damage.ts'
import type { BoneyardEnemyStoreStepContext } from '../src/game/core-server/enemies/model.ts'
import { createGameSimulation, enterBoneyardWorld } from '../src/game/core-server/game-simulation.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'
import { createGameSaveDocument, type CreateGameSaveDocumentOptions } from '../src/game/save/game-save-document.ts'

/** Ordinary native death ticks; the returned save retains the largest population. */
export function createNativeFacultyDeathSaveFixture(members: 1 | 3 = 3): CreateGameSaveDocumentOptions {
  const loadedBoneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16, 47))
  if (!loadedBoneyard) throw new Error('native Faculty save fixture requires a stock Boneyard')
  const initial = enterBoneyardWorld(createGameSimulation({ owner: {
    discipline: 'arcane', displayName: 'Faculty save regression', element: 'fire',
  } }), loadedBoneyard)
  if (initial.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const order = createNativeWorldManagerOrder(initial.worldManagerOrder)
  const context: BoneyardEnemyStoreStepContext = {
    nativeViewBounds: { x: -800, y: -500, w: 1600, h: 1000 },
    projectileWorldBlocked: () => false,
    clipSpellSegment: ({ end }) => end,
    players: { owner: { alive: true, collisionRadius: 25, connected: true, eligible: true,
      headingDeg: 0, position: { x: 0, y: -200 }, velocityPerTick: { x: 0, y: 0 } } },
    resolveMovement: ({ position }) => position,
    resolveSpawnIntents: () => [],
    registerWorldPainter: order.register,
    tick: initial.tick,
  }
  let store = stepBoneyardEnemyStore(createBoneyardEnemyStore('faculty-integration'), {
    ...context,
    resolveSpawnIntents: () => (['Dire Sirmin', 'Dire Lucritius', 'Dire Aliss'] as const)
      .slice(0, members).map((name, index) => ({
        authoredRecipe: nativeFacultyRecipe(loadedBoneyard.sourceSha256, name),
        enemyToken: 'DIREFACULTY', flags: [], id: index + 1,
        locationPolicy: 'anywhere', nativeTypeId: 1010, pathfindingMode: 2,
        position: { x: index * 10, y: 0 }, spawnTick: initial.tick, waveOrdinal: 32,
      })),
  }).store
  for (const actor of store.actors) store = damageBoneyardEnemy(store, {
    actorId: actor.id, amount: actor.currentHealth + 1, tick: initial.tick, sourcePlayerId: 'owner',
  }).store
  let peak = store
  let peakOrder = order.state()
  for (let age = 1; age <= 1100; age += 1) {
    store = stepBoneyardEnemyStore(store, { ...context, tick: initial.tick + age }).store
    if (store.deathEffects.length > peak.deathEffects.length) {
      peak = store
      peakOrder = order.state()
    }
  }
  if (store.actors.length || store.deathEffects.length) throw new Error('native Faculty death did not retire')
  return {
    integrity: 'local-only', loadedBoneyard, mods: [], modState: {}, playerId: 'owner',
    state: { ...initial, tick: peak.lastStepTick, worldManagerOrder: peakOrder,
      world: { ...initial.world, enemies: peak } },
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const destination = process.argv[2]
  if (!destination) throw new Error('native Faculty save fixture requires an output file')
  const options = createNativeFacultyDeathSaveFixture()
  const document = createGameSaveDocument(options)
  writeFileSync(destination, document, { mode: 0o600, flag: 'wx' })
  console.log(JSON.stringify({ bytes: Buffer.byteLength(document), tick: options.state.tick }))
}

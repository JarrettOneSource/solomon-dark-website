import assert from 'node:assert/strict'
import { createIdlePlayerCharacterInput } from '../src/game/core-kernels/player-character.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-schema.ts'
import { createGameSimulation, enterBoneyardWorld, stepGameSimulationTick } from '../src/game/core-server/game-simulation.ts'
import { prepareBoneyardWorldNavigation } from '../src/game/core-server/boneyard-world.ts'
import { createBoneyardCatalog, materializeBoneyard } from '../src/game/host/boneyard-catalog.ts'

export function createRunArchiveFixture(playerCount = 2, enemyCount = 40) {
  const loadedBoneyard = materializeBoneyard(createBoneyardCatalog(), 'default-random', Buffer.alloc(16))
  // Separate benchmark processes must be able to compare the complete state.
  loadedBoneyard.runId = '0'.repeat(32)
  const playerIds = Array.from({ length: playerCount }, (_, index) => (
    index === 0 ? 'first' : index === 1 ? 'second' : `player-${index + 1}`
  ))
  let state = enterBoneyardWorld(createGameSimulation(Object.fromEntries(playerIds.map((id, index) => [id, {
    displayName: `Archive ${index + 1}`, discipline: index % 2 ? 'mind' : 'body',
    element: index % 2 ? 'water' : 'ether',
  }])), { gameRngSeed: 123 }), loadedBoneyard)
  state = { ...state, levelUpBarrier: null,
    world: { ...state.world, arenaTransition: null, encounter: null, waves: null } }
  prepareBoneyardWorldNavigation(state.world)
  const spawn = state.world.spawn
  const inputs = Object.fromEntries(playerIds.map(playerId => [playerId, {
    ...createIdlePlayerCharacterInput(), aim: { x: spawn.x + 150, y: spawn.y },
    cast: { primary: true, quickbar: null },
  }]))
  const enemySpawnIntents = Array.from({ length: enemyCount }, (_, index) => ({
    enemyToken: 'SKELETON', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
    flags: [], id: index + 1, locationPolicy: 'anywhere', spawnTick: state.tick + 1,
    waveOrdinal: 1, position: {
      x: spawn.x + 150 + (index % 5) * 30, y: spawn.y - 100 + Math.floor(index / 5) * 30,
    },
  }))
  state = stepGameSimulationTick(state, inputs, { enemySpawnIntents })
  for (let index = 0; index < 30; index += 1) state = stepGameSimulationTick(state, inputs)
  assert.ok(state.world.enemies.actors.length > 0, 'the fixture must include real enemy work')
  return { loadedBoneyard, state, inputs, playerIds }
}

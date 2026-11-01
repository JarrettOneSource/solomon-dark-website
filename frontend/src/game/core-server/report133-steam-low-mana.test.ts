import assert from 'node:assert/strict'
import test from 'node:test'

import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-director.ts'
import { applyNativeSecondaryTargetEffect } from '../core-kernels/native-secondary-abilities.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameSnapshotFrame } from '../protocol/entity-replication.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from './boneyard-enemy-store.ts'
import {
  createGameSimulation, enterBoneyardWorld, stepGameSimulationTick, type GameSimulationState,
} from './game-simulation.ts'
import { grantPlayerEntityWeldBuild, setPlayerEntityMana } from './player-entity-store.ts'

const HELD: PlayerCharacterInput = {
  aim: { x: 450, y: 250 }, cast: { primary: true, quickbar: null }, movement: { x: 0, y: 0 },
  viewportHeight: 900, viewportWidth: 1600,
}

function steamGame(caster: string): GameSimulationState {
  let state = enterBoneyardWorld(createGameSimulation({
    owner: { discipline: 'mind', displayName: 'Owner', element: 'water' },
    peer: { discipline: 'mind', displayName: 'Peer', element: 'water' },
  }), {
    choice: { id: 'empty', name: 'Empty', source: 'default' }, geometrySha256: 'b'.repeat(64),
    runId: 'steam', seed: 'steam', sourceSha256: 'c'.repeat(64),
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2, fences: [], name: 'Steam',
      objects: [], roads: [], solomonDig: null, sprites: [], terrain: [],
      spawn: { facingDeg: 180, x: 250, y: 250 },
    },
  })
  const grant = grantPlayerEntityWeldBuild(state.playerEntities, caster, 1005, createNativeRng(17))
  state = { ...state, playerEntities: grant.store }
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('steam'), {
    tick: 0, players: {}, projectileWorldBlocked: () => false, registerWorldPainter: order.register,
    resolveMovement: request => request.requestedPosition,
    resolveSpawnIntents: () => [{ enemyToken: 'SKELETON', flags: [], id: 1,
      locationPolicy: 'anywhere', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 350, y: 250 }, spawnTick: 0, waveOrdinal: 1 }],
  }).store
  return {
    ...state, worldManagerOrder: order.state(),
    world: { ...state.world, enemies: { ...spawned,
      actors: spawned.actors.map(actor => ({ ...actor, currentHealth: 100000, maximumHealth: 100000 })),
    } },
    secondaryAbilities: applyNativeSecondaryTargetEffect(state.secondaryAbilities, 'boneyard:steam', 1,
      { frozenTicks: 1000000, frozenTimeScale: 0 }),
  }
}

for (const caster of ['owner', 'peer']) {
  for (const mana of [0, 0.000001, 10000]) {
    test(`held Steam damages a mob for ${caster} with mana ${mana}`, () => {
      let state = steamGame(caster)
      const maximumMana = createGameSnapshot(state, caster).players[caster]!.progression.maximumMana
      let contacts = 0
      for (let tick = 0; tick < 180; tick++) {
        state = stepGameSimulationTick({ ...state,
          playerEntities: setPlayerEntityMana(state.playerEntities, caster,
            Math.min(mana, maximumMana)),
        }, { [caster]: HELD })
        contacts += state.primarySpells.transients.filter(effect => (
          effect.kind === 'weld-steam' && effect.ownerId === caster && effect.contactDue
        )).length
      }
      assert.ok(contacts > 0, 'held normal particles must reach their contact clock')
      if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
      assert.ok(state.world.enemies.actors[0]!.currentHealth < 100000,
        '0x00543266 grants the weak normal particle damage lane')
      assert.equal(state.world.enemies.actors[0]!.lastDamagedByPlayerId, caster)
      const snapshot = createGameSnapshot(state, caster)
      const message = {
        acknowledgedInputSequence: 0, frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
        sequence: 1, type: 'server-snapshot' as const,
      }
      assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
      const particles = snapshot.primarySpells.transients.filter(effect => effect.kind === 'weld-steam')
      assert.ok(particles.length > 0)
      if (mana < 1) {
        assert.ok(particles.every(effect => effect.variant === 'normal' && effect.contactEnabled
          && effect.alphaMultiplier === 0.25))
      }
      for (let tick = 0; tick < 1100; tick++) state = stepGameSimulationTick(state, {})
      assert.equal(state.primarySpells.transients.some(effect => effect.kind === 'weld-steam'), false)
      assert.equal(state.secondaryAbilities.targetEffects.some(effect => effect.steamed !== null), false)
    })
  }
}

test('running out of mana changes new Steam particles without rewriting retained strength', () => {
  let state = steamGame('owner')
  const maximumMana = createGameSnapshot(state, 'owner').players.owner!.progression.maximumMana
  for (let tick = 0; tick < 100; tick++) state = stepGameSimulationTick({ ...state,
    playerEntities: setPlayerEntityMana(state.playerEntities, 'owner', maximumMana),
  }, { owner: HELD })
  const funded = state.primarySpells.transients.findLast(effect => (
    effect.kind === 'weld-steam' && effect.variant === 'normal'
  ))
  assert.ok(funded?.kind === 'weld-steam')
  const oldNextId = state.primarySpells.nextId
  for (let tick = 0; tick < 2; tick++) state = stepGameSimulationTick({ ...state,
    playerEntities: setPlayerEntityMana(state.playerEntities, 'owner', 0),
  }, { owner: HELD })
  const retained = state.primarySpells.transients.find(effect => effect.id === funded.id)
  assert.ok(retained?.kind === 'weld-steam')
  assert.equal(retained.contactDamage, funded.contactDamage)
  assert.equal(retained.alphaMultiplier, 1)
  const weak = state.primarySpells.transients.find(effect => (
    effect.kind === 'weld-steam' && effect.id >= oldNextId
  ))
  assert.ok(weak?.kind === 'weld-steam')
  assert.equal(weak.contactEnabled, true)
  assert.equal(weak.contactDamage, funded.contactDamage * 0.5)
  assert.equal(weak.alphaMultiplier, 0.25)
})

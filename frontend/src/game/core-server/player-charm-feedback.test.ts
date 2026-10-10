import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createNativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameSnapshotFrame } from '../protocol/entity-replication.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import { parseGameSaveDocument, record } from '../save/game-save-contract.ts'
import { createGameSaveDocument, restoreGameSaveDocument } from '../save/game-save-document.ts'
import { emitPlayerCheatDeathFeedback } from './boneyard-player-status.ts'
import {
  createGameSimulation, damageGameSimulationPlayer, enterBoneyardWorld,
  getPlayerProgression, stepGameSimulationTick, type GameSimulationState,
} from './game-simulation.ts'
import { applyPlayerContacts } from './player-contact-system.ts'
import {
  applyPlayerEntityHagathaPurchaseEffects, playerCharacterRecords, playerEconomyAt,
  poisonPlayerEntity, replacePlayerEconomy,
} from './player-entity-store.ts'

const BONEYARD: LoadedBoneyard = {
  choice: { id: 'empty', name: 'Empty', source: 'default' },
  geometrySha256: 'b'.repeat(64), runId: 'charm-feedback', seed: 'charms', sourceSha256: 'c'.repeat(64),
  scene: {
    bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2,
    fences: [], name: 'Charms', objects: [], roads: [], solomonDig: null,
    spawn: { facingDeg: 180, x: 250, y: 250 }, sprites: [], terrain: [],
  },
}

function charmGame(selectors: readonly number[] = [24, 25]): GameSimulationState {
  let state = createGameSimulation({
    owner: { discipline: 'arcane', displayName: 'Owner', element: 'ether' },
    peer: { discipline: 'arcane', displayName: 'Peer', element: 'fire' },
  })
  for (const playerId of ['owner', 'peer']) {
    const economy = playerEconomyAt(state.playerEntities, playerId)!
    const playerSelectors = playerId === 'owner' ? selectors : [24, 25]
    state = { ...state, playerEntities: replacePlayerEconomy(state.playerEntities, playerId, {
      ...economy, firstMixedSelectors: [...playerSelectors], ownedPerkSelectors: [...playerSelectors],
      revision: economy.revision + 1,
    }) }
    state = { ...state, playerEntities: applyPlayerEntityHagathaPurchaseEffects(
      state.playerEntities, playerId, playerSelectors, createNativeRng(1),
    ).store }
  }
  return enterBoneyardWorld(state, BONEYARD)
}

function lossEvents(state: GameSimulationState) {
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  return state.world.enemyEvents.filter(event => event.type === 'player-charm-lost')
}

for (const selectors of [[24], [25], [24, 25]]) {
  test(`authoritative damage emits one loss for ${selectors.join('+')}, never zero or repeated damage`, () => {
    const source = charmGame(selectors)
    assert.deepEqual(lossEvents(source), [])
    assert.deepEqual(lossEvents(damageGameSimulationPlayer(source, 'owner', 0, source.tick)), [])
    const hurt = damageGameSimulationPlayer(source, 'owner', 1, source.tick)
    assert.equal(lossEvents(hurt).length, 1)
    assert.equal(lossEvents(hurt)[0]!.targetPlayerId, 'owner')
    assert.equal(lossEvents(hurt)[0]!.actorId, 0)
    assert.deepEqual(getPlayerProgression(hurt, 'owner').hagathaRuntime, {
      cheatDeathCharges: 0, reverieActive: false, serendipityActive: false,
    })
    assert.equal(getPlayerProgression(hurt, 'peer').hagathaRuntime.reverieActive, true)
    assert.equal(getPlayerProgression(hurt, 'peer').hagathaRuntime.serendipityActive, true)
    assert.equal(lossEvents(damageGameSimulationPlayer(hurt, 'owner', 1, hurt.tick)).length, 1)

    const snapshot = createGameSnapshot(hurt, 'owner')
    const message = {
      acknowledgedInputSequence: 0, frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
      sequence: 1, type: 'server-snapshot' as const,
    }
    assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
  })
}

test('fully absorbed contact stays active; admitted damage uses the same loss event', () => {
  const state = charmGame()
  const shielded = { ...state, secondaryAbilities: { ...state.secondaryAbilities, players: {
    ...state.secondaryAbilities.players,
    owner: { ...createNativeSecondaryPlayerState(), magicShieldAbsorb: 100, magicShieldMaximum: 100 },
  } } }
  const damage = { actorId: 1, eventId: 1, magicDamage: 0, physicalDamage: 1, playerId: 'owner',
    coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0 }
  const absorbed = applyPlayerContacts(shielded, playerCharacterRecords(shielded.playerEntities), [damage], 1, undefined)
  assert.equal(absorbed.playerEntities.progressions[0]!.hagathaRuntime.reverieActive, true)
  assert.equal(absorbed.playerDamageSoundEvents.some(event => event.type === 'player-charm-lost'), false)
  const hurt = applyPlayerContacts(state, playerCharacterRecords(state.playerEntities), [damage], 1, undefined)
  assert.equal(hurt.playerDamageSoundEvents.filter(event => event.type === 'player-charm-lost').length, 1)
  assert.equal(hurt.playerEntities.progressions[0]!.hagathaRuntime.reverieActive, false)
})

test('charm loss wire feedback rejects foreign payload, nonzero actor, and missing owner', () => {
  const source = charmGame()
  const hurt = damageGameSimulationPlayer(source, 'owner', 1, source.tick)
  const frame = createGameSnapshotFrame(createGameSnapshot(hurt, 'owner'), 0, undefined, true)
  if (frame.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  for (const invalid of [
    { actorId: 1 }, { targetPlayerId: undefined }, { sourcePosition: undefined },
    { sound: 'blind' }, { stream: 'solomon-hello-1' },
  ]) {
    const malformed: unknown = {
      acknowledgedInputSequence: 0,
      frame: { ...frame, world: { ...frame.world,
        enemyEvents: [{ ...frame.world.enemyEvents[0]!, ...invalid }],
      } },
      sequence: 1, type: 'server-snapshot',
    }
    assert.throws(() => decodeServerGameMessage(JSON.stringify(malformed)))
  }
})

test('poison publishes one loss on its first positive health tick', () => {
  const initial = charmGame()
  const poisoned = { ...initial, playerEntities: poisonPlayerEntity(initial.playerEntities, 'owner', 10, 1) }
  const hurt = stepGameSimulationTick(poisoned, {})
  assert.equal(lossEvents(hurt).length, 1)
  assert.equal(getPlayerProgression(hurt, 'owner').hagathaRuntime.serendipityActive, false)
  assert.equal(lossEvents(stepGameSimulationTick(hurt, {})).length, 1)
  const prevented = stepGameSimulationTick(poisoned, {}, { extensions: {
    createLootItems: () => [],
    filterDamage: input => input.damageKind === 'poison' ? 0 : input.amount,
    filterMana: input => input.delta,
    hasConsumable: () => false,
  } })
  assert.deepEqual(lossEvents(prevented), [])
  assert.equal(getPlayerProgression(prevented, 'owner').hagathaRuntime.reverieActive, true)
})

test('lethal loss precedes Cheat Death without replacing its existing rescue event', () => {
  const state = charmGame([7, 24, 25])
  const rescued = damageGameSimulationPlayer(state, 'owner', 100, state.tick)
  assert.equal(rescued.world.kind, 'boneyard')
  if (rescued.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(rescued.world.enemyEvents.map(event => event.type), ['player-charm-lost', 'player-cheat-death'])
  assert.equal(getPlayerProgression(rescued, 'owner').lifeState, 'alive')
  assert.equal(getPlayerProgression(rescued, 'owner').hagathaRuntime.cheatDeathCharges, 0)
  const lethal = damageGameSimulationPlayer(charmGame(), 'owner', 100, state.tick)
  assert.equal(lossEvents(lethal).length, 1)
  assert.equal(getPlayerProgression(lethal, 'owner').lifeState, 'lethal-pending')
})

test('save omits only ephemeral charm loss, preserves live state and event IDs, and permits a fresh later loss', () => {
  const source = charmGame()
  const hurt = damageGameSimulationPlayer(source, 'owner', 1, source.tick)
  if (hurt.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const adjacent = emitPlayerCheatDeathFeedback(hurt.world.enemies, {
    playerId: 'owner', position: { x: 250, y: 250 }, tick: hurt.tick, worldKey: BONEYARD.runId,
  })
  const live: GameSimulationState = { ...hurt, world: { ...hurt.world, enemies: adjacent.store,
    enemyEvents: [...hurt.world.enemyEvents, adjacent.event],
  } }
  if (live.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const liveEvents = live.world.enemyEvents
  const beforeEvents = structuredClone(liveEvents)
  const nextEventId = live.world.enemies.nextEventId
  const document = createGameSaveDocument({
    integrity: 'local-only', loadedBoneyard: BONEYARD, mods: [], modState: {}, playerId: 'owner', state: live,
  })
  assert.equal(live.world.enemyEvents, liveEvents)
  assert.deepEqual(live.world.enemyEvents, beforeEvents)
  assert.equal(live.world.enemies.nextEventId, nextEventId)
  const continuation = parseGameSaveDocument(document).continuation
  assert.ok(continuation)
  const savedWorld = record(record(continuation.simulation, 'simulation').world, 'world')
  assert.deepEqual(savedWorld.enemyEvents, [adjacent.event])
  assert.equal(record(savedWorld.enemies, 'enemies').nextEventId, nextEventId)

  const restored = restoreGameSaveDocument(document).state
  if (restored.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.deepEqual(restored.world.enemyEvents, [adjacent.event])
  assert.equal(restored.world.enemies.nextEventId, nextEventId)
  assert.deepEqual(getPlayerProgression(restored, 'owner').hagathaRuntime,
    getPlayerProgression(hurt, 'owner').hagathaRuntime)
  assert.deepEqual(lossEvents(restored), [])
  assert.deepEqual(lossEvents(damageGameSimulationPlayer(restored, 'owner', 1, restored.tick)), [])
  const rearmed = { ...restored, playerEntities: applyPlayerEntityHagathaPurchaseEffects(
    restored.playerEntities, 'owner', [24, 25], createNativeRng(1),
  ).store }
  assert.deepEqual(lossEvents(rearmed), [])
  assert.equal(getPlayerProgression(rearmed, 'owner').hagathaRuntime.reverieActive, true)
  const laterLoss = lossEvents(damageGameSimulationPlayer(rearmed, 'owner', 1, rearmed.tick))
  assert.equal(laterLoss.length, 1)
  assert.equal(laterLoss[0]!.eventId, nextEventId)
  assert.ok(laterLoss[0]!.eventId > adjacent.event.eventId)
})

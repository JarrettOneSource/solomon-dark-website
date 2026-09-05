import assert from 'node:assert/strict'
import test from 'node:test'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { playerDeflectReflectionSourceInRange, resolvePlayerHarmfulContact } from '../core-kernels/player-harmful-contact.ts'
import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameSnapshotFrame, createReplicatedEntityBaseline, EntityReplicationReconstructor } from '../protocol/entity-replication.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import {
  addPlayerCharacter, createGameSimulation, enterBoneyardWorld, removePlayerCharacter,
  returnGameSimulationToHub, stepGameSimulationTick,
  type GameSimulationState,
} from './game-simulation.ts'
import { createPlayerEntityStore, damagePlayerEntity, grantPlayerEntitySkillRanks, playerSkillDerivedStatsAt, setPlayerEntityMana } from './player-entity-store.ts'
import { synchronizePlayerHardenEffects } from './player-harden-effects.ts'

const HELD: PlayerCharacterInput = {
  aim: { x: 250, y: 50 }, cast: { primary: true, quickbar: null },
  movement: { x: 0, y: 0 }, viewportHeight: 900, viewportWidth: 1600,
}

function waterGame(rank = 2): GameSimulationState {
  let state = enterBoneyardWorld(createGameSimulation({ water: {
    discipline: 'mind', displayName: 'Harden', element: 'water',
  } }), {
    choice: { id: 'empty', name: 'Empty', source: 'default' },
    geometrySha256: 'b'.repeat(64), runId: 'harden', seed: 'harden', sourceSha256: 'c'.repeat(64),
    scene: {
      bounds: { x: 0, y: 0, w: 500, h: 500 }, environmentMode: 2,
      fences: [], name: 'Harden', objects: [], roads: [], solomonDig: null,
      spawn: { facingDeg: 180, x: 250, y: 250 }, sprites: [], terrain: [],
    },
  })
  if (rank > 0) state = { ...state, playerEntities: grantPlayerEntitySkillRanks(
    state.playerEntities, 'water', 36, rank, createNativeRng(1),
  ).store }
  return { ...state, playerEntities: {
    ...state.playerEntities,
    progressions: state.playerEntities.progressions.map((progression) => ({
      ...progression, currentMana: 10000, maximumMana: 10000,
    })),
  } }
}

function cast(state: GameSimulationState, ticks: number): GameSimulationState {
  for (let tick = 0; tick < ticks; tick++) state = stepGameSimulationTick(state, { water: HELD })
  return state
}

function roundTrip(state: GameSimulationState) {
  const snapshot = createGameSnapshot(state, 'water')
  const message = {
    acknowledgedInputSequence: 0,
    frame: createGameSnapshotFrame(snapshot, 0, undefined, true),
    sequence: 1, type: 'server-snapshot' as const,
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
  return snapshot
}

test('real Water casting publishes coating, physical protection, and both formation cues', () => {
  const started = cast(waterGame(), 1)
  const start = roundTrip(started)
  assert.equal(start.players.water!.progression.hardenCoating, Math.fround(0.005))
  assert.deepEqual(start.secondaryAbilities.events.filter(({ skillId }) => skillId === 36)
    .map(({ cue, pitch, gain }) => [cue, pitch, gain]), [['harden', Math.fround(0.8), 1]])
  const formed = cast(started, 50)
  assert.equal(formed.secondaryAbilities.events.filter(({ skillId, pitch }) => skillId === 36 && pitch === 1).length, 2)
  const state = cast(formed, 150)
  const snapshot = roundTrip(state)
  assert.equal(snapshot.players.water!.progression.hardenCoating, 1)
  const runtime = state.playerEntities.skillRuntimes[0]!
  const derived = playerSkillDerivedStatsAt(state.playerEntities, 'water')
  assert.ok(derived)
  const physical = resolvePlayerHarmfulContact(runtime, derived, state.playerEntities.progressions[0]!,
    10, 'physical', false, false, createNativeRng(1), { x: 250, y: 250 })
  const magic = resolvePlayerHarmfulContact(runtime, derived, state.playerEntities.progressions[0]!,
    10, 'magic', false, false, createNativeRng(1), { x: 250, y: 250 })
  assert.equal(physical.damage, 0)
  assert.equal(magic.damage, 10)
  assert.equal(magic.hardenChip, null)
  assert.ok(runtime.harden.armor > 24)
  const deflected = resolvePlayerHarmfulContact(runtime, { ...derived, deflectChancePercent: 100 },
    state.playerEntities.progressions[0]!, 10, 'physical', true, false, createNativeRng(1), { x: 250, y: 250 })
  assert.equal(deflected.deflected, true)
  assert.equal(deflected.hardenChip, null)
})

test('release and weak Water clear real armor, publish breakup, and leave no fragments after expiry', () => {
  for (const weak of [false, true]) {
    let state = cast(waterGame(), 201)
    if (weak) state = { ...state, playerEntities: setPlayerEntityMana(state.playerEntities, 'water', 0) }
    state = stepGameSimulationTick(state, { water: { ...HELD, cast: { primary: weak, quickbar: null } } })
    const snapshot = roundTrip(state)
    assert.deepEqual(state.playerEntities.skillRuntimes[0]!.harden, { armor: 0, coating: 0 })
    assert.equal(snapshot.players.water!.progression.hardenCoating, 0)
    assert.equal(snapshot.primarySpells.transients.filter(({ kind }) => kind === 'harden-shard').length, 18)
    assert.equal(snapshot.primarySpells.transients.filter(({ kind }) => kind === 'harden-burst').length, 1)
    const sound = snapshot.secondaryAbilities.events.findLast(({ cue }) => cue === 'ice-shatter')
    assert.ok(sound)
    assert.equal(sound.gain, 1)
    assert.ok(sound.pitch >= 0.9 && sound.pitch <= 1.1)
    for (let tick = 0; tick < 1_100; tick++) state = stepGameSimulationTick(state, {})
    assert.equal(state.primarySpells.transients.some(({ kind }) => kind.startsWith('harden-')), false)
    roundTrip(state)
  }
})

test('unlearned Frost Jet has no coating, Harden audio, or Harden fragments', () => {
  const state = cast(waterGame(0), 60)
  assert.deepEqual(state.playerEntities.skillRuntimes[0]!.harden, { armor: 0, coating: 0 })
  assert.equal(state.secondaryAbilities.events.some(({ skillId }) => skillId === 36), false)
  assert.equal(state.primarySpells.transients.some(({ kind }) => kind.startsWith('harden-')), false)
})

test('Harden belongs to one player and clears on death, removal, and returning to College', () => {
  let state = cast(waterGame(), 60)
  state = addPlayerCharacter(state, 'guest', { discipline: 'body', displayName: 'Guest', element: 'fire' })
  let snapshot = roundTrip(state)
  assert.ok(snapshot.players.water!.progression.hardenCoating > 0)
  assert.equal(snapshot.players.guest!.progression.hardenCoating, 0)
  const returned = returnGameSimulationToHub(state)
  snapshot = roundTrip(returned)
  assert.equal(snapshot.players.water!.progression.hardenCoating, 0)
  assert.equal(returned.primarySpells.transients.length, 0)
  const killed = stepGameSimulationTick({
    ...state,
    playerEntities: damagePlayerEntity(state.playerEntities, 'water', 10000, state.tick),
  }, { water: HELD })
  assert.equal(killed.playerEntities.skillRuntimes[0]!.harden.coating, 0)
  assert.equal(killed.playerEntities.skillRuntimes[0]!.harden.armor, 0)
  const removed = removePlayerCharacter(killed, 'water')
  assert.equal(removed.primarySpells.transients.some(({ ownerId }) => ownerId === 'water'), false)
})

test('a late client receives existing coating and reconstructs release fragments without stale armor', () => {
  const state = cast(waterGame(), 60)
  const initial = roundTrip(state)
  const client = new EntityReplicationReconstructor()
  client.reset(initial, 1)
  const release = roundTrip(stepGameSimulationTick(state, {}))
  const frame = createGameSnapshotFrame(release, 1, createReplicatedEntityBaseline(initial))
  const decoded = decodeServerGameMessage(encodeGameMessage({
    acknowledgedInputSequence: 0, frame, sequence: 2, type: 'server-snapshot',
  }))
  assert.equal(decoded.type, 'server-snapshot')
  if (decoded.type !== 'server-snapshot') throw new Error('expected a game snapshot')
  const reconstructed = client.apply(decoded.frame, decoded.sequence)
  assert.ok(initial.players.water!.progression.hardenCoating > 0)
  assert.equal(reconstructed.players.water!.progression.hardenCoating, 0)
  assert.equal(reconstructed.primarySpells.transients.filter(({ kind }) => kind === 'harden-shard').length, 6)
  assert.equal(reconstructed.primarySpells.transients.filter(({ kind }) => kind === 'harden-burst').length, 1)
})

test('a physical contact emits one cosmetic chip while invalid and magic contacts cannot', () => {
  const state = cast(waterGame(), 60)
  const runtime = state.playerEntities.skillRuntimes[0]!
  const derived = playerSkillDerivedStatsAt(state.playerEntities, 'water')!
  const progression = state.playerEntities.progressions[0]!
  const position = { x: 250, y: 250 }
  for (const amount of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => resolvePlayerHarmfulContact(runtime, derived, progression,
      amount, 'physical', false, false, createNativeRng(1), position), /finite and non-negative/)
  }
  const contact = resolvePlayerHarmfulContact(runtime, derived, progression,
    5, 'physical', false, false, createNativeRng(3), position)
  assert.ok(contact.hardenChip)
  assert.equal(contact.damage, 0)
  const result = synchronizePlayerHardenEffects({
    after: state.playerEntities, before: state.playerEntities,
    chips: [{ chip: contact.hardenChip, ownerId: 'water', position, worldKey: 'boneyard:harden' }],
    register: createNativeWorldManagerOrder(state.worldManagerOrder).register,
    rng: state.combatRng, secondary: state.secondaryAbilities, spells: state.primarySpells,
    tick: state.tick, worldKey: () => 'boneyard:harden',
  })
  const shard = result.spells.transients.findLast(({ kind }) => kind === 'harden-shard')
  assert.ok(shard?.kind === 'harden-shard')
  assert.equal(shard.ownerId, 'water')
  assert.deepEqual(shard.position, contact.hardenChip.shard.position)
  assert.deepEqual(shard.painterRegistrations?.map(({ managerLane }) => managerLane), ['transient'])
  const sound = result.secondary.events.at(-1)!
  assert.equal(sound.cue, 'ice-shatter')
  assert.equal(sound.pitch, contact.hardenChip.pitch)
  assert.equal(sound.gain, 1)
  roundTrip({ ...state, primarySpells: result.spells, secondaryAbilities: result.secondary })
  const newOwner = synchronizePlayerHardenEffects({
    after: state.playerEntities, before: createPlayerEntityStore(), chips: [],
    register: createNativeWorldManagerOrder().register, rng: state.combatRng,
    secondary: state.secondaryAbilities, spells: state.primarySpells,
    tick: state.tick, worldKey: () => 'boneyard:harden',
  })
  assert.strictEqual(newOwner.spells, state.primarySpells)
  assert.strictEqual(newOwner.secondary, state.secondaryAbilities)
})

test('Deflect reflection uses the native strict radius and only concentrated physical contacts', () => {
  assert.equal(playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, { x: 59, y: 0 }, 10), true)
  assert.equal(playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, { x: 60, y: 0 }, 10), false)
  for (const radius of [-1, Number.NaN, Infinity]) {
    assert.throws(() => playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, radius, { x: 0, y: 0 }, 10), /radii/)
    assert.throws(() => playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, { x: 0, y: 0 }, radius), /radii/)
  }
  assert.throws(() => playerDeflectReflectionSourceInRange({ x: NaN, y: 0 }, 25, { x: 0, y: 0 }, 10), /positions/)
  assert.throws(() => playerDeflectReflectionSourceInRange({ x: 0, y: 0 }, 25, { x: 0, y: Infinity }, 10), /positions/)
  const state = waterGame()
  const source = state.playerEntities.skillRuntimes[0]!
  const derived = { ...playerSkillDerivedStatsAt(state.playerEntities, 'water')!, deflectChancePercent: 100 }
  for (const kind of ['magic', 'physical'] as const) {
    for (const inRange of [false, true]) {
      for (const concentrationSkillIdA of [null, 68]) {
        const contact = resolvePlayerHarmfulContact({ ...source, concentrationSkillIdA }, derived,
          state.playerEntities.progressions[0]!, 10, kind, true, inRange, createNativeRng(1), { x: 0, y: 0 })
        assert.equal(contact.damage, 0)
        assert.equal(contact.reflectedDamage, kind === 'physical' && inRange && concentrationSkillIdA === 68 ? 50 : 0)
      }
    }
  }
})

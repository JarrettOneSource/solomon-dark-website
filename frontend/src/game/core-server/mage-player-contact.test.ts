import { createNativeWorldManagerOrder } from '../core-kernels/native-world-manager-order.ts'
import { createNativeTutorialState } from '../core-kernels/native-tutorial.ts'
import { createSolomonEncounter } from '../core-kernels/boneyard-encounter.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import { applyPlayerContacts } from './player-contact-system.ts'
import { grantPlayerEntitySkillRanks } from './player-entity-store.ts'
import { grantPlayerSkillRanks } from '../core-kernels/player-progression.ts'
import assert from 'node:assert/strict'
import test from 'node:test'

import type { LoadedBoneyard } from '../core-kernels/boneyard.ts'
import { playerMovementScale } from '../core-kernels/player-combat.ts'
import { createNativeSecondaryPlayerState } from '../core-kernels/native-secondary-abilities.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createGameSnapshot } from '../host/game-snapshot.ts'
import { createGameSnapshotFrame } from '../protocol/entity-replication.ts'
import { decodeServerGameMessage, encodeGameMessage } from '../protocol/game-protocol.ts'
import {
  createBoneyardEnemyStore,
  NATIVE_MAGE_ACTION_PROGRAMS,
  stepBoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  createGameSimulation,
  bindGameSimulationPlayerSkillQuickbar,
  enterBoneyardWorld,
  gameSimulationPlayerRecords,
  getPlayerProgression,
  stepGameSimulationTick,
  type GameSimulationState,
  type GameSimulationExtensions,
} from './game-simulation.ts'

test('a poison Mage impact poisons the player and lowers health', () => {
  let state = mageContactState('FLAG_CASTPOISON')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }
  const player = getPlayerProgression(state)
  assert.ok(player.poisonTicksRemaining > 0, 'impact must attach poison')
  assert.ok(player.currentHealth < player.maximumHealth, 'poison must reduce health')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const burst = state.world.enemies.deathEffects.filter(effect => effect.role === 'player-status-poison')
  assert.equal(burst.length, 12)
  assert.ok(burst.every(effect => effect.entry === 10 && effect.alpha === 0.5
    && effect.presentationOwner === 'pre-world-queue'))
  assert.ok(state.world.enemyEvents.some(event => event.sound === 'poisoned' && event.pitch === 1.5))
  assertWireRoundTrip(state)
})

test('a poison Mage impact bypasses Harden and applies poison', () => {
  let state = mageContactState('FLAG_CASTPOISON')
  state = {
    ...state,
    playerEntities: {
      ...state.playerEntities,
      skillRuntimes: state.playerEntities.skillRuntimes.map(runtime => ({
        ...runtime,
        harden: { armor: 100, coating: 0 },
      })),
    },
  }
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }
  assert.ok(getPlayerProgression(state).poisonTicksRemaining > 0,
    'Harden must not suppress a magic impact or its poison status')
})

test('Harden absorbs the physical half of a Firebolt while its magic half still hits', () => {
  let state = mageContactState('FLAG_CASTFIRE')
  state = { ...state, playerEntities: {
    ...state.playerEntities,
    skillRuntimes: state.playerEntities.skillRuntimes.map(runtime => ({ ...runtime, harden: { armor: 100, coating: 0 } })),
  } }
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).currentHealth < 50) break
  }
  assert.ok(Math.abs(getPlayerProgression(state).currentHealth - 38.001) < 0.000_001)
})

test('a frost Mage impact applies the native 250-tick movement slow', () => {
  let state = mageContactState('FLAG_CASTFROST')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).coldSlowTicksRemaining > 0) break
  }
  const player = getPlayerProgression(state)
  assert.equal(player.coldSlowTicksRemaining, 250)
  assert.equal(playerMovementScale(player), 0.5)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.deathEffects.filter(effect => effect.role === 'player-status-cold').length, 12)
  assert.ok(state.world.enemyEvents.some(event => event.sound === 'frosted' && event.pitch === 1.5))
})

test('a mixed contact chips Harden before the shield and Stoneskin intercept its health damage', () => {
  for (const protection of [null, 'shield', 'stoneskin'] as const) {
    const initial = mageContactState('FLAG_CASTFIRE', protection)
    const source = {
      ...initial,
      secondaryAbilities: { ...initial.secondaryAbilities, rng: createNativeRng(4) },
      playerEntities: {
        ...initial.playerEntities,
        skillRuntimes: initial.playerEntities.skillRuntimes.map(runtime => ({
          ...runtime, harden: { armor: 100, coating: 1 },
        })),
      },
    }
    const result = applyPlayerContacts(source, gameSimulationPlayerRecords(source), [{
      actorId: 1, physicalDamage: 10, magicDamage: 3, playerId: 'local-player', eventId: 1,
      coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
    }], 1, undefined)
    assert.equal(result.hardenChips.length, 1)
    assert.equal(result.hardenChips[0]!.ownerId, 'local-player')
    assert.equal(result.hardenChips[0]!.worldKey, 'boneyard:mage-contact')
    assert.deepEqual(result.hardenChips[0]!.position, { x: 500, y: 500 })
    assert.equal(result.playerEntities.progressions[0]!.currentHealth, protection === null ? 47 : 50)
  }
})

test('a poison Mage spreads its primary damage across ten seconds', () => {
  let state = mageContactState('FLAG_CASTPOISON')
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const primaryDamage = state.world.enemies.actors[0]!.config.primaryDamage!
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }
  const player = getPlayerProgression(state)
  assert.equal(player.poisonTicksRemaining, 1_000)
  assert.equal(player.poisonDamagePerTick, Math.fround(primaryDamage / 1_000))
})

test('a shield absorbs frost damage while the cold modifier still applies', () => {
  let state = mageContactState('FLAG_CASTFROST', 'shield')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).coldSlowTicksRemaining > 0) break
  }
  const player = getPlayerProgression(state)
  assert.equal(player.currentHealth, player.maximumHealth)
  assert.equal(player.coldSlowTicksRemaining, 250)
})

test('poison contact and its modifier bypass a shield', () => {
  let state = mageContactState('FLAG_CASTPOISON', 'shield')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }
  const player = getPlayerProgression(state)
  assert.equal(player.poisonTicksRemaining, 1_000)
  assert.ok(player.currentHealth < player.maximumHealth - 0.99)
  assert.equal(player.lastDamageTick, null, 'GuidedMissile suppresses the ordinary hit redraw')
})

test('poison immunity removes the poison lane and modifier while retaining the magic impact', () => {
  let state = mageContactState('FLAG_CASTPOISON', 'poison-immunity')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).currentHealth < getPlayerProgression(state).maximumHealth) break
  }
  const player = getPlayerProgression(state)
  assert.equal(player.poisonTicksRemaining, 0)
  assert.ok(Math.abs(player.currentHealth - (player.maximumHealth - 1 + 0.001)) < 0.000_01)
  assert.equal(player.lastDamageTick, null)
})

test('Stoneskin blocks the frost modifier but permits the poison lane', () => {
  let frost = mageContactState('FLAG_CASTFROST', 'stoneskin')
  let poison = mageContactState('FLAG_CASTPOISON', 'stoneskin')
  for (let tick = 0; tick < 200; tick += 1) {
    frost = stepGameSimulationTick(frost, {})
    poison = stepGameSimulationTick(poison, {})
  }
  assert.equal(getPlayerProgression(frost).coldSlowTicksRemaining, 0)
  assert.equal(getPlayerProgression(frost).currentHealth, getPlayerProgression(frost).maximumHealth)
  assert.ok(getPlayerProgression(poison).poisonTicksRemaining > 0)
})

test('shield and Stoneskin poison impacts cap the poison lane at remaining health', () => {
  for (const protection of ['shield', 'stoneskin'] as const) {
    for (const currentHealth of [0.05, -1]) {
      let state = mageContactState('FLAG_CASTPOISON', protection)
      state = {
        ...state,
        playerEntities: {
          ...state.playerEntities,
          progressions: state.playerEntities.progressions.map(player => ({
            ...player, currentHealth,
          })),
        },
      }
      for (let tick = 0; tick < 300; tick += 1) {
        state = stepGameSimulationTick(state, {})
        if (getPlayerProgression(state).poisonTicksRemaining > 0) break
      }
      assert.equal(getPlayerProgression(state).lifeState, 'alive')
      const expectedHealth = currentHealth > 0 ? 0.001 : currentHealth + state.tick * 0.001
      assert.ok(Math.abs(getPlayerProgression(state).currentHealth - expectedHealth) < 1e-8)
    }
  }
})


test('lightning Mage contacts do not trigger Flash', () => {
  let state = mageContactState('FLAG_CASTLIGHTNING')
  state = {
    ...state,
    secondaryAbilities: { ...state.secondaryAbilities, rng: createNativeRng(15) },
    playerEntities: {
      ...state.playerEntities,
      skillBooks: state.playerEntities.skillBooks.map(book => grantPlayerSkillRanks(book, 53, 1)),
    },
  }
  for (let tick = 0; tick < 50; tick += 1) {
    state = stepGameSimulationTick(state, {})
    assert.ok(state.secondaryAbilities.actors.every(actor => !actor.kind.startsWith('flash-response')))
  }
  assertWireRoundTrip(state)
})

test('a magic shield receives the hit before Stoneskin and retains cold admission', () => {
  let state = mageContactState('FLAG_CASTFROST', 'shield-stoneskin')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).coldSlowTicksRemaining > 0) break
  }
  assert.ok(getPlayerProgression(state).coldSlowTicksRemaining > 0)
  assert.ok(state.secondaryAbilities.players['local-player']!.magicShieldAbsorb < 100)
})

test('simultaneous frost and poison preserve their contact order', () => {
  for (const flags of [
    ['FLAG_CASTFROST', 'FLAG_CASTPOISON'],
    ['FLAG_CASTPOISON', 'FLAG_CASTFROST'],
  ]) {
    let state = stepGameSimulationTick(mageContactState(flags), {})
    if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    assert.equal(state.world.enemies.projectiles.length, 2)
    state = {
      ...state,
      world: {
        ...state.world,
        enemies: {
          ...state.world.enemies,
          projectiles: state.world.enemies.projectiles.map(projectile => ({
            ...projectile, position: { x: 500, y: 500 },
          })),
        },
      },
    }
    state = stepGameSimulationTick(state, {})
    const player = getPlayerProgression(state)
    assert.ok(player.coldSlowTicksRemaining > 0)
    assert.ok(player.poisonTicksRemaining > 0)
    assert.equal(player.poisonBeforeCold, flags[0] === 'FLAG_CASTPOISON')
  }
})

test('periodic poison goes through the native Deflect receiver', () => {
  let state = mageContactState('FLAG_CASTPOISON')
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }
  const healthBefore = getPlayerProgression(state).currentHealth
  state = {
    ...state,
    secondaryAbilities: { ...state.secondaryAbilities, rng: createNativeRng(121) },
    playerEntities: {
      ...state.playerEntities,
      skillBooks: state.playerEntities.skillBooks.map(book => grantPlayerSkillRanks(book, 68, 1)),
    },
  }
  state = stepGameSimulationTick(state, {})
  assert.ok(getPlayerProgression(state).currentHealth >= healthBefore)
  assert.equal(getPlayerProgression(state).poisonTicksRemaining, 999)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.ok(state.world.enemyEvents.some(event => event.tick === state.tick
    && event.targetPlayerId === 'local-player' && event.deflectPitch !== undefined))
  assertWireRoundTrip(state)
})

function assertWireRoundTrip(state: GameSimulationState): void {
  const message = {
    type: 'server-snapshot' as const,
    acknowledgedInputSequence: 0,
    sequence: 1,
    frame: createGameSnapshotFrame(createGameSnapshot(state, 'local-player'), 1, undefined),
  }
  assert.deepEqual(decodeServerGameMessage(encodeGameMessage(message)), message)
}

test('repeated poison contacts refresh without duplicating the onset burst, and expire cleanly', () => {
  let state = stepGameSimulationTick(mageContactState(['FLAG_CASTPOISON', 'FLAG_CASTPOISON']), {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  state = { ...state, world: { ...state.world, enemies: {
    ...state.world.enemies,
    projectiles: state.world.enemies.projectiles.map(projectile => ({ ...projectile, position: { x: 500, y: 500 } })),
  } } }
  state = stepGameSimulationTick(state, {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.deathEffects.filter(effect => effect.role === 'player-status-poison').length, 12)
  assert.equal(state.world.enemyEvents.filter(event => event.sound === 'poisoned').length, 1)
  state = { ...state, world: { ...state.world, enemies: { ...state.world.enemies, actors: [], projectiles: [] } } }
  for (let tick = 0; tick < 1_000; tick += 1) state = stepGameSimulationTick(state, {})
  assert.equal(getPlayerProgression(state).poisonTicksRemaining, 0)
  assert.equal(getPlayerProgression(state).poisonBeforeCold, false)
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.deathEffects.length, 0)
  assert.equal(getPlayerProgression(state).lifeState, 'alive')
  assertWireRoundTrip(state)
})

test('damage filters receive physical, magic and poison lanes and can reject the entire contact', () => {
  const source = mageContactState('FLAG_CASTPOISON')
  const received: Array<{ amount: number; kind: string }> = []
  const extensions: GameSimulationExtensions = {
    createLootItems: () => [], filterMana: input => input.delta, hasConsumable: () => false,
    filterDamage: input => {
      received.push({ amount: input.amount, kind: input.damageKind })
      return 0
    },
  }
  const contact = { actorId: 1, physicalDamage: 4, magicDamage: 6, poisonContactDamage: 1,
    playerId: 'local-player', eventId: 1, coldSlowTicks: 250, dazzleTicks: 0, poisonDamage: 2.4, poisonDuration: 10 }
  const result = applyPlayerContacts(source, gameSimulationPlayerRecords(source), [contact], 1, extensions)
  assert.deepEqual(received, [{ amount: 4, kind: 'physical' }, { amount: 6, kind: 'magic' }, { amount: 1, kind: 'poison' }])
  assert.equal(result.playerEntities.progressions[0]!.currentHealth, 50)
  assert.deepEqual(result.appliedPlayerDamage, [])
  assert.deepEqual(result.playerDamageSoundEvents, [])
  for (const invalid of [NaN, Infinity, 1_000_001]) {
    assert.throws(() => applyPlayerContacts(source, gameSimulationPlayerRecords(source), [contact], 1,
      { ...extensions, filterDamage: () => invalid }), /must be finite and within/)
  }
  const expired = applyPlayerContacts(source, gameSimulationPlayerRecords(source), [
    { ...contact, playerId: 'expired-player' }, { ...contact, playerId: 'golem:999' },
  ], 1, undefined)
  assert.equal(expired.playerEntities, source.playerEntities)
  assert.deepEqual(expired.appliedPlayerDamage, [])
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const protectedSource = { ...source, world: { ...source.world,
    tutorial: createNativeTutorialState({ x: 500, y: 500 }, 0, 'protected'),
  } }
  const protectedResult = applyPlayerContacts(protectedSource, gameSimulationPlayerRecords(protectedSource), [contact], 1, undefined)
  assert.equal(protectedResult.playerEntities, protectedSource.playerEntities)
  assert.deepEqual(protectedResult.appliedPlayerDamage, [])
})

test('later poison and cold refreshes preserve their existing status instances', () => {
  let source = mageContactState(['FLAG_CASTPOISON', 'FLAG_CASTFROST'])
  for (let tick = 0; tick < 300; tick += 1) {
    source = stepGameSimulationTick(source, {})
    const player = getPlayerProgression(source)
    if (player.poisonTicksRemaining > 0 && player.coldSlowTicksRemaining > 0) break
  }
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const effectCount = source.world.enemies.deathEffects.length
  const common = { physicalDamage: 0, magicDamage: 1, playerId: 'local-player', dazzleTicks: 0 }
  const refreshed = applyPlayerContacts(source, gameSimulationPlayerRecords(source), [
    { ...common, actorId: 1, eventId: 100, poisonContactDamage: 1, coldSlowTicks: 0, poisonDamage: 2.4, poisonDuration: 10 },
    { ...common, actorId: 2, eventId: 101, poisonContactDamage: 0, coldSlowTicks: 250, poisonDamage: 0, poisonDuration: 0 },
  ], source.tick + 1, undefined)
  assert.equal(refreshed.appliedPlayerDamage.length, 2)
  if (refreshed.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(refreshed.world.enemies.deathEffects.length, effectCount)
  assert.equal(refreshed.playerDamageSoundEvents.filter(event => event.type === 'player-status-sound').length, 0)
})

test('active or queued tutorial narration suppresses Wizard ouch while damage still applies', () => {
  const source = mageContactState('FLAG_CASTFIRE')
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const tutorial = createNativeTutorialState({ x: 500, y: 500 }, 0, 'hurt-dialogue')
  for (const current of [null, { cue: 'tutorial-accept-your-fate' as const, eventId: 1,
    speaker: 'sirmin' as const, text: 'You cannot prevail. Accept your fate!' }]) {
    const world = { ...source.world, tutorial: { ...tutorial, damageProtection: false,
      narration: { ...tutorial.narration, current,
        pending: current === null ? ['tutorial-accept-your-fate' as const] : [], ticksRemaining: 100 },
    } }
    const result = applyPlayerContacts({ ...source, world }, gameSimulationPlayerRecords(source), [{
      actorId: 1, physicalDamage: 2, magicDamage: 2, playerId: 'local-player', eventId: 1,
      coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
    }], 1, undefined)
    assert.equal(result.playerEntities.progressions[0]!.currentHealth, 46)
    assert.deepEqual(result.playerDamageSoundEvents, [])
  }
})

test('Solomon speech suppresses Wizard ouch until the dialogue ends', () => {
  const source = mageContactState('FLAG_CASTFIRE')
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const encounter = createSolomonEncounter({
    frameProgram: [0], ticksPerFrame: 5, position: { x: 200, y: 200 },
    gravePosition: { x: 190, y: 200 }, lanternPosition: { x: 210, y: 200 },
  }, 'hurt-dialogue')
  for (const phase of ['speaking', 'digging'] as const) {
    const world = { ...source.world, encounter: { ...encounter, phase } }
    const result = applyPlayerContacts({ ...source, world }, gameSimulationPlayerRecords(source), [{
      actorId: 1, physicalDamage: 2, magicDamage: 2, playerId: 'local-player', eventId: 1,
      coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
    }], 1, undefined)
    assert.equal(result.playerEntities.progressions[0]!.currentHealth, 46)
    assert.equal(result.playerDamageSoundEvents.length, phase === 'speaking' ? 0 : 1)
  }
})

test('a Coffin-owned Maggot uses the same player defense and reflection rules', () => {
  let source = mageContactState('FLAG_CASTFIRE')
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const order = createNativeWorldManagerOrder(source.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore(createBoneyardEnemyStore('contact-maggot'), {
    tick: 0, players: {}, registerWorldPainter: order.register,
    firstProjectileWorldContact: () => null,
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{ enemyToken: 'COFFIN', nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.COFFIN, id: 1, flags: [],
      position: { x: 600, y: 500 }, spawnTick: 0, waveOrdinal: 1, locationPolicy: 'anywhere' }],
  }).store
  source = { ...source, worldManagerOrder: order.state(), world: { ...source.world, enemies: spawned } }
  for (let tick = 0; tick < 1_000; tick += 1) {
    source = stepGameSimulationTick(source, {})
    if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
    if (source.world.enemies.maggots.length > 0) break
  }
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const maggot = source.world.enemies.maggots[0]
  assert.ok(maggot)
  source = { ...source,
    world: { ...source.world, enemies: { ...source.world.enemies, maggots: [
      { ...maggot, position: { x: 520, y: 500 } },
    ] } },
    secondaryAbilities: { ...source.secondaryAbilities, rng: createNativeRng(121) },
    playerEntities: { ...source.playerEntities,
      skillBooks: source.playerEntities.skillBooks.map(book => grantPlayerSkillRanks(book, 68, 1)),
      skillRuntimes: source.playerEntities.skillRuntimes.map(runtime => ({ ...runtime, concentrationSkillIdA: 68 })),
    },
  }
  const result = applyPlayerContacts(source, gameSimulationPlayerRecords(source), [{
    actorId: maggot.id, physicalDamage: 2, magicDamage: 0, playerId: 'local-player', eventId: 100,
    coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
  }], source.tick + 1, undefined)
  assert.deepEqual(result.reflectedEnemyDamage, [{ actorId: maggot.id, amount: 10, playerId: 'local-player' }])
  assert.equal(result.playerEntities.progressions[0]!.currentHealth, source.playerEntities.progressions[0]!.currentHealth)
})

test('a guided missile still applies its payload after its Mage is removed', () => {
  let state = stepGameSimulationTick(mageContactState('FLAG_CASTPOISON'), {})
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  assert.equal(state.world.enemies.projectiles.length, 1)
  state = { ...state, world: { ...state.world, enemies: { ...state.world.enemies, actors: [] } } }
  for (let tick = 0; tick < 300; tick += 1) {
    state = stepGameSimulationTick(state, {})
    if (getPlayerProgression(state).poisonTicksRemaining > 0) break
  }
  assert.equal(getPlayerProgression(state).poisonTicksRemaining, 1_000)
  assert.ok(getPlayerProgression(state).currentHealth < 50)
  assertWireRoundTrip(state)
})

test('the shared contact receiver applies both channels to Golems and reflects physical damage only', () => {
  let source = mageContactState('FLAG_CASTFIRE')
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const mage = source.world.enemies.actors[0]!
  source = { ...source, world: { ...source.world, enemies: { ...source.world.enemies, actors: [] } } }
  const granted = grantPlayerEntitySkillRanks(source.playerEntities, 'local-player', 45, 1, source.gameRng)
  source = { ...source, playerEntities: granted.store, gameRng: granted.rng }
  source = bindGameSimulationPlayerSkillQuickbar(source, 'local-player', 45, 0)!
  source = stepGameSimulationTick(source, { 'local-player': {
    aim: { x: 550, y: 500 }, cast: { primary: false, quickbar: 0 }, movement: { x: 0, y: 0 },
    viewportWidth: 1600, viewportHeight: 900,
  } })
  for (let tick = 0; tick < 410; tick += 1) source = stepGameSimulationTick(source, {})
  const golem = source.secondaryAbilities.actors.find(actor => actor.kind === 'golem')
  assert.ok(golem?.golem)
  if (source.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const golemHealth = golem.golem.currentHealth
  source = { ...source,
    world: { ...source.world, enemies: { ...source.world.enemies, actors: [
      { ...mage, position: { x: golem.position.x + 50, y: golem.position.y } },
    ] } },
    secondaryAbilities: { ...source.secondaryAbilities, actors: source.secondaryAbilities.actors.map(actor => (
      actor.id === golem.id ? { ...golem, golem: { ...golem.golem!, reflectFactor: 2 } } : actor
    )) },
  }
  const result = applyPlayerContacts(source, gameSimulationPlayerRecords(source), [{
    actorId: mage.id, physicalDamage: 10, magicDamage: 5, playerId: `golem:${golem.id}`,
    eventId: 1, coldSlowTicks: 0, dazzleTicks: 0, poisonDamage: 0, poisonDuration: 0,
  }], source.tick + 1, undefined)
  assert.equal(result.secondaryAbilities.actors.find(actor => actor.id === golem.id)?.golem?.currentHealth, golemHealth - 15)
  assert.deepEqual(result.reflectedEnemyDamage, [{ actorId: mage.id, amount: 20, playerId: 'local-player' }])
  assert.equal(result.playerEntities.progressions[0]!.currentHealth, 50)
})

function mageContactState(
  flags: string | readonly string[],
  protection: 'poison-immunity' | 'shield' | 'stoneskin' | 'shield-stoneskin' | null = null,
): GameSimulationState {
  const boneyard: LoadedBoneyard = {
    choice: {
      id: 'mod:mage-contact',
      modId: 'mage-contact',
      modName: 'Mage contact',
      name: 'Mage contact',
      source: 'mod',
    },
    geometrySha256: 'd'.repeat(64),
    runId: 'mage-contact',
    scene: {
      bounds: { x: 0, y: 0, w: 1_000, h: 1_000 },
      environmentMode: 2,
      fences: [],
      name: 'Mage contact',
      objects: [],
      roads: [],
      solomonDig: null,
      spawn: { facingDeg: 180, x: 500, y: 500 },
      sprites: [],
      terrain: [],
    },
    seed: 'mage-contact',
    sourceSha256: 'c'.repeat(64),
  }
  let state = enterBoneyardWorld(createGameSimulation(), boneyard)
  assert.equal(state.world.kind, 'boneyard')
  if (state.world.kind !== 'boneyard') throw new Error('expected Boneyard')
  const order = createNativeWorldManagerOrder(state.worldManagerOrder)
  const spawned = stepBoneyardEnemyStore(state.world.enemies, {
    firstProjectileWorldContact: () => null,
    registerWorldPainter: order.register,
    players: {},
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => (typeof flags === 'string' ? [flags] : flags).map((flag, index) => ({
      enemyToken: 'SKELETONMAGE',
      flags: [flag],
      id: index + 1,
      locationPolicy: 'anywhere',
      nativeTypeId: 1003,
      position: { x: 350, y: 500 },
      spawnTick: 0,
      waveOrdinal: 1,
    })),
    tick: 0,
  }).store
  state = {
    ...state,
    worldManagerOrder: order.state(),
    playerEntities: {
      ...state.playerEntities,
      progressions: state.playerEntities.progressions.map(progression => ({
        ...progression,
        poisonImmunityTicksRemaining: protection === 'poison-immunity' ? 1_000 : 0,
      })),
    },
    secondaryAbilities: {
      ...state.secondaryAbilities,
      players: {
        ...state.secondaryAbilities.players,
        'local-player': {
          ...createNativeSecondaryPlayerState(),
          magicShieldAbsorb: protection === 'shield' || protection === 'shield-stoneskin' ? 100 : 0,
          magicShieldMaximum: protection === 'shield' || protection === 'shield-stoneskin' ? 100 : 0,
          stoneskinTicksRemaining: protection === 'stoneskin' || protection === 'shield-stoneskin' ? 1_000 : 0,
        },
      },
    },
    world: {
      ...state.world,
      enemies: {
        ...spawned,
        actors: spawned.actors.map(mage => {
          if (mage.brain.family !== 'mage') throw new Error('expected Mage')
          return {
          ...mage,
          targetPlayerId: 'local-player',
          brain: {
            ...mage.brain,
            actionProgress: NATIVE_MAGE_ACTION_PROGRAMS.short.markerProgress,
            castProgram: 'short' as const,
            castRoll: 0,
            markerEmitted: false,
            phase: 'cast' as const,
          },
          }
        }),
      },
    },
  }
  return state
}

import assert from 'node:assert/strict'
import test from 'node:test'

import { BONEYARD_WAVE_ENEMY_TYPES } from '../core-kernels/boneyard-wave-schema.ts'
import {
  createIdlePlayerCharacterInput,
  createPlayerCharacter,
} from '../core-kernels/player-character.ts'
import {
  createNativePlayerStaffAction,
  resolveNativeStaffPhysicalContacts,
} from '../core-kernels/native-player-staff-action.ts'
import { createNativeRng } from '../core-kernels/native-rng.ts'
import { createPrimarySpellSimulation } from '../core-kernels/primary-spells.ts'
import { refreshPlayerSkillRuntime } from '../core-kernels/player-skill-runtime.ts'
import {
  createBoneyardEnemyStore,
  stepBoneyardEnemyStore,
  type BoneyardEnemyStore,
} from './boneyard-enemy-store.ts'
import {
  addPlayerEntity,
  createPlayerEntityStore,
  playerEconomyAt,
  playerSkillBookAt,
  playerSkillDerivedStatsAt,
  playerSkillRuntimeAt,
  replacePlayerEconomy,
  type PlayerEntityStore,
} from './player-entity-store.ts'
import {
  stepPlayerStaffCombatSystem,
  type PlayerStaffCombatSystemContext,
} from './player-staff-combat-system.ts'

const CONFIG = { discipline: 'body', displayName: 'Staff', element: 'air' } as const
const ETHER_CONFIG = { ...CONFIG, element: 'ether' } as const
const PLAYER_ID = 'caster'

test('the Solomon prelude gate suppresses only new automatic staff actions', () => {
  const context = staffFixture()
  const blocked = stepPlayerStaffCombatSystem({
    ...context,
    combatAdmissionEnabled: false,
  })
  assert.deepEqual(blocked.spells.transients, [])
  assert.deepEqual([...blocked.actingPlayerIds], [])
  assert.deepEqual(blocked.rng, context.rng)

  const admitted = stepPlayerStaffCombatSystem({
    ...context,
    combatAdmissionEnabled: true,
  })
  assert.equal(admitted.spells.transients[0]?.kind, 'player-staff-melee')
  assert.deepEqual([...admitted.actingPlayerIds], [PLAYER_ID])
})

test('stationary current contact cannot admit Staff melee until a movement epoch', () => {
  const context = staffFixture()
  const stationary = stepPlayerStaffCombatSystem({
    ...context,
    movementEpochActiveByPlayerId: { [PLAYER_ID]: false },
  })
  assert.deepEqual(stationary.spells.transients, [])
  assert.deepEqual([...stationary.actingPlayerIds], [])
  assert.deepEqual(stationary.rng, context.rng)

  const moving = stepPlayerStaffCombatSystem(context)
  assert.equal(moving.spells.transients[0]?.kind, 'player-staff-melee')
  assert.deepEqual([...moving.actingPlayerIds], [PLAYER_ID])
})

test('movement-result hostile contact admits without facing while nonhostile contact suppresses fallback', () => {
  const context = staffFixture()
  const facingAway = {
    ...context,
    movementContactsByPlayerId: {
      [PLAYER_ID]: [{ bodyId: 'enemy-1', staffHostile: true }],
    },
    players: {
      [PLAYER_ID]: { ...context.players[PLAYER_ID]!, headingIndex: 12 },
    },
  }
  const admitted = stepPlayerStaffCombatSystem(facingAway)
  assert.equal(admitted.spells.transients[0]?.kind, 'player-staff-melee')

  const suppressed = stepPlayerStaffCombatSystem({
    ...context,
    movementContactsByPlayerId: {
      [PLAYER_ID]: [{ bodyId: 'player-other', staffHostile: false }],
    },
  })
  assert.deepEqual(suppressed.spells.transients, [])
  assert.deepEqual(suppressed.rng, context.rng)
})

test('automatic staff admission requires the exact equipped Staff and emits one retained contact', () => {
  const equipped = staffFixture()
  const economy = playerEconomyAt(equipped.playerEntities, PLAYER_ID)!
  const unequippedEntities = replacePlayerEconomy(
    equipped.playerEntities,
    PLAYER_ID,
    { ...economy, equipment: { ...economy.equipment, weapon: null } },
  )
  const rejected = stepPlayerStaffCombatSystem({
    ...equipped,
    playerEntities: unequippedEntities,
  })
  assert.deepEqual(rejected.spells.transients, [])
  assert.equal(rejected.rng, equipped.rng)

  const seed = seedForOutcome(equipped.playerEntities, 'normal')
  let context = { ...equipped, rng: createNativeRng(seed) }
  let result = stepPlayerStaffCombatSystem(context)
  assert.equal(result.spells.transients[0]?.kind, 'player-staff-melee')
  assert.equal(playerSkillRuntimeAt(result.playerEntities, PLAYER_ID)?.staffMeleeAlternate, true)
  const initialHealth = result.enemies.actors[0]!.currentHealth

  for (let tick = 2; tick < 100; tick += 1) {
    context = {
      ...context,
      enemies: result.enemies,
      playerEntities: result.playerEntities,
      players: result.players,
      rng: result.rng,
      spells: result.spells,
      tick,
    }
    result = stepPlayerStaffCombatSystem(context)
    if (result.spells.transients.some(({ kind }) => kind === 'player-staff-contact')) break
  }
  const contact = result.spells.transients.find(({ kind }) => kind === 'player-staff-contact')
  assert.ok(contact && contact.kind === 'player-staff-contact')
  assert.deepEqual(contact.targetIds, [`enemy:${result.enemies.actors[0]!.id}`])
  assert.equal(contact.procSound, null)
  assert.equal(result.enemies.actors[0]!.currentHealth, initialHealth - 1)
  assert.equal(result.enemies.actors[0]!.lastDamagedByPlayerId, PLAYER_ID)
  assert.ok(result.events.some(({ sound }) => sound === 'bone-crack'))
})

test('Disabling Hit permanently multiplies target-owned movement and action lanes', () => {
  let context = staffFixture(rankPlayerSkill(staffFixture().playerEntities, 71, 9))
  context = {
    ...context,
    rng: createNativeRng(seedForOutcome(context.playerEntities, 'disabling-hit')),
  }
  let result = stepPlayerStaffCombatSystem(context)
  for (let tick = 2; tick < 100; tick += 1) {
    result = stepPlayerStaffCombatSystem({
      ...context,
      enemies: result.enemies,
      playerEntities: result.playerEntities,
      players: result.players,
      rng: result.rng,
      spells: result.spells,
      tick,
    })
    if (result.enemies.actors[0]!.staffActionFactor < 1) break
  }
  assert.equal(result.enemies.actors[0]!.staffActionFactor, 0.5)
  assert.equal(result.enemies.actors[0]!.staffMovementFactor, 0.75)
  const contact = result.spells.transients.find(({ kind }) => kind === 'player-staff-contact')
  assert.ok(contact && contact.kind === 'player-staff-contact')
  assert.equal(contact.procSound, 'disable-enemy')
  assert.equal(
    result.spells.transients.filter(({ kind }) => kind === 'player-staff-move-fade').length,
    50,
  )
})

test('a departed target leaves every non-normal Staff outcome silent at its marker', () => {
  const rankedEntities = rankPlayerSkill(staffFixture().playerEntities, 71, 9)
  for (const outcome of [
    'knockback',
    'disabling-hit',
    'critical-hit',
    'whirl',
  ] as const) {
    let context = staffFixture(rankedEntities)
    context = {
      ...context,
      rng: createNativeRng(seedForOutcome(context.playerEntities, outcome)),
    }
    let result = stepPlayerStaffCombatSystem(context)
    const action = result.spells.transients[0]
    assert.ok(action && (
      action.kind === 'player-staff-melee' || action.kind === 'player-staff-spin'
    ))
    assert.equal(action.outcome, outcome)
    result = {
      ...result,
      enemies: { ...result.enemies, actors: [] },
    }

    for (let tick = 2; tick < 100; tick += 1) {
      result = stepPlayerStaffCombatSystem({
        ...context,
        enemies: result.enemies,
        playerEntities: result.playerEntities,
        players: result.players,
        rng: result.rng,
        spells: result.spells,
        tick,
      })
      if (result.spells.transients.some(({ kind }) => kind === 'player-staff-contact')) break
    }

    const contact = result.spells.transients.find(({ kind }) => kind === 'player-staff-contact')
    assert.ok(contact && contact.kind === 'player-staff-contact')
    assert.equal(contact.outcome, outcome)
    assert.deepEqual(contact.targetIds, [])
    assert.equal(contact.procSound, null)
    assert.deepEqual(contact.procSoundPitches, [])
    assert.equal(
      result.spells.transients.some(({ kind }) => (
        kind === 'player-staff-smoke'
        || kind === 'player-staff-move-fade'
        || kind === 'player-staff-perspective-fade'
        || kind === 'player-staff-knockback'
      )),
      false,
    )
  }
})

test('a lethal proc still owns its same-contact Knockback actor', () => {
  let context = staffFixture(rankPlayerSkill(staffFixture().playerEntities, 71, 9))
  context = {
    ...context,
    enemies: {
      ...context.enemies,
      actors: [{ ...context.enemies.actors[0]!, currentHealth: 1 }],
    },
    rng: createNativeRng(seedForOutcome(context.playerEntities, 'knockback')),
  }
  let result = stepPlayerStaffCombatSystem(context)
  for (let tick = 2; tick < 100; tick += 1) {
    result = stepPlayerStaffCombatSystem({
      ...context,
      enemies: result.enemies,
      playerEntities: result.playerEntities,
      players: result.players,
      rng: result.rng,
      spells: result.spells,
      tick,
    })
    if (result.spells.transients.some(({ kind }) => kind === 'player-staff-contact')) break
  }
  assert.equal(result.enemies.actors[0]!.lifeState, 'dying')
  const knockback = result.spells.transients.find(({ kind }) => kind === 'player-staff-knockback')
  assert.ok(knockback && knockback.kind === 'player-staff-knockback')
  assert.deepEqual(knockback.targetIds, [`enemy:${result.enemies.actors[0]!.id}`])
})

test('an Ether Staff contact disarms Pike Skeletons before damage and retains every feedback edge', () => {
  let context = staffFixture(undefined, ETHER_CONFIG, ['FLAG_PIKE'])
  context = {
    ...context,
    playerEntities: rankPlayerSkill(context.playerEntities, 65, 15),
  }
  context = {
    ...context,
    rng: createNativeRng(seedForEtherPikeBreak(context.playerEntities)),
  }
  let result = stepPlayerStaffCombatSystem(context)
  for (let tick = 2; tick < 100; tick += 1) {
    result = stepPlayerStaffCombatSystem({
      ...context,
      enemies: result.enemies,
      playerEntities: result.playerEntities,
      players: result.players,
      rng: result.rng,
      spells: result.spells,
      tick,
    })
    if (result.spells.transients.some(({ kind }) => kind === 'player-staff-contact')) break
  }

  const skeleton = result.enemies.actors[0]!
  assert.equal(skeleton.brain.family, 'skeleton')
  assert.equal(skeleton.config.flags.includes('FLAG_PIKE'), false)
  if (skeleton.brain.family === 'skeleton') {
    assert.equal(skeleton.brain.action, 'claw')
    assert.equal(skeleton.brain.phase, 'approach')
  }
  const contact = result.spells.transients.find(({ kind }) => kind === 'player-staff-contact')
  assert.ok(contact && contact.kind === 'player-staff-contact')
  assert.equal(contact.impactSoundPitches.length, 1)
  assert.deepEqual(contact.pikeBreakSoundIndexes, [0])
  assert.equal(
    result.spells.transients.some(({ kind }) => kind === 'player-staff-contact-knockback'),
    true,
  )
  assert.equal(
    result.spells.transients.some(({ kind }) => kind === 'player-staff-pike-break'),
    true,
  )
  assert.deepEqual(result.pikeBreakFeedback, [{
    ownerId: PLAYER_ID,
    position: skeleton.position,
    worldKey: 'boneyard:test',
  }])
})

function staffFixture(
  playerEntitiesOverride?: PlayerEntityStore,
  config = CONFIG,
  flags: readonly 'FLAG_PIKE'[] = [],
): PlayerStaffCombatSystemContext {
  const player = {
    ...createPlayerCharacter(config, { x: 0, y: 0 }),
    headingIndex: 0,
  }
  const playerEntities = playerEntitiesOverride ?? addPlayerEntity(
    createPlayerEntityStore(),
    PLAYER_ID,
    config,
    player,
    1,
  )
  const spawned = spawnSkeleton(flags)
  const actor = spawned.actors[0]!
  const distance = 25 + actor.config.collisionRadius
  const enemies: BoneyardEnemyStore = {
    ...spawned,
    actors: [{
      ...actor,
      currentHealth: 1_000,
      position: { x: 0, y: -distance },
    }],
  }
  return {
    combatAdmissionEnabled: true,
    enemies,
    inputs: { [PLAYER_ID]: createIdlePlayerCharacterInput() },
    knockbackTargetVisible: () => true,
    movementContactsByPlayerId: {},
    movementEpochActiveByPlayerId: { [PLAYER_ID]: true },
    playerEntities,
    players: { [PLAYER_ID]: player },
    rng: createNativeRng(0),
    spells: createPrimarySpellSimulation(),
    tick: 1,
    worldKey: 'boneyard:test',
  }
}

function rankPlayerSkill(
  source: PlayerEntityStore,
  skillId: number,
  rank: number,
): PlayerEntityStore {
  const index = source.identities.findIndex(({ playerId }) => playerId === PLAYER_ID)
  const currentBook = source.skillBooks[index]!
  const permanentRanks = [...currentBook.permanentRanks]
  permanentRanks[skillId] = rank
  const book = {
    ...currentBook,
    effectiveRanks: Object.freeze([...permanentRanks]),
    permanentRanks: Object.freeze(permanentRanks),
  }
  const refreshed = refreshPlayerSkillRuntime(
    source.skillRuntimes[index]!,
    book,
    source.statBooks[index]!,
    source.economies[index]!,
  )
  const skillBooks = [...source.skillBooks]
  const skillRuntimes = [...source.skillRuntimes]
  skillBooks[index] = refreshed.skillBook
  skillRuntimes[index] = refreshed.runtime
  return { ...source, skillBooks, skillRuntimes }
}

function seedForOutcome(
  playerEntities: PlayerEntityStore,
  outcome: 'normal' | 'knockback' | 'disabling-hit' | 'critical-hit' | 'whirl',
): number {
  const derived = playerSkillDerivedStatsAt(playerEntities, PLAYER_ID)!
  const skillBook = playerSkillBookAt(playerEntities, PLAYER_ID)!
  if (skillBook.effectiveRanks[71] === 0 && outcome !== 'normal') {
    throw new Error('proc seed requires Fortunate Flailing')
  }
  for (let seed = 0; seed < 100_000; seed += 1) {
    const result = createNativePlayerStaffAction({
      derived,
      headingDegrees: 0,
      id: 1,
      lane: 'primary',
      origin: { x: 0, y: 0 },
      ownerId: PLAYER_ID,
      worldKey: 'boneyard:test',
    }, createNativeRng(seed))
    if (result.action.outcome === outcome) return seed
  }
  throw new Error(`No deterministic seed produced ${outcome}`)
}

function seedForEtherPikeBreak(playerEntities: PlayerEntityStore): number {
  const derived = playerSkillDerivedStatsAt(playerEntities, PLAYER_ID)!
  for (let seed = 0; seed < 100_000; seed += 1) {
    const spawned = createNativePlayerStaffAction({
      derived,
      headingDegrees: 0,
      id: 1,
      lane: 'primary',
      origin: { x: 0, y: 0 },
      ownerId: PLAYER_ID,
      worldKey: 'boneyard:test',
    }, createNativeRng(seed))
    if (spawned.action.outcome !== 'normal') continue
    const contact = resolveNativeStaffPhysicalContacts(
      spawned.action,
      [{
        collisionRadius: 10,
        id: 'enemy:1',
        pike: true,
        position: { x: 0, y: -35 },
      }],
      'ether',
      derived.staffDamageSecondary,
      spawned.rng,
    )
    if (contact.impacts[0]?.pikeBreakPresentationRng !== null) return seed
  }
  throw new Error('No deterministic seed produced the Ether Pike-break branch')
}

function spawnSkeleton(flags: readonly 'FLAG_PIKE'[] = []): BoneyardEnemyStore {
  return stepBoneyardEnemyStore(createBoneyardEnemyStore('staff-system'), {
    firstProjectileWorldContact: () => null,
    players: {
      [PLAYER_ID]: {
        alive: true,
        collisionRadius: 25,
        connected: true,
        eligible: true,
        position: { x: 500, y: 0 },
        velocityPerTick: { x: 0, y: 0 },
      },
    },
    resolveMovement: ({ requestedPosition }) => requestedPosition,
    resolveSpawnIntents: () => [{
      enemyToken: 'SKELETON',
      flags,
      id: 1,
      locationPolicy: 'anywhere',
      nativeTypeId: BONEYARD_WAVE_ENEMY_TYPES.SKELETON,
      position: { x: 0, y: 0 },
      spawnTick: 0,
      waveOrdinal: 1,
    }],
    tick: 0,
  }).store
}
